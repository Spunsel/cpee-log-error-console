/**
 * Highlight Coordinator
 * Coordinates task highlighting across all 4 content sections
 * Responsibilities:
 * - Track rendered SVG containers in all sections
 * - Handle task click events and propagate highlights
 * - Coordinate with HighlightingService and TaskMapper
 * - Manage visual vs raw view mode (only highlight in visual mode)
 * - Implement state persistence across step navigation
 */

import { serviceFactory } from '../../core/ServiceFactory.js';
import { SVGClickDetector } from '../../utils/interaction/SVGClickDetector.js';

export class HighlightCoordinator {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        
        // Core services
        this.highlightingService = serviceFactory.get('HighlightingService');
        this.taskMapper = null; // Set externally
        
        // Click detection
        this.clickDetector = new SVGClickDetector();
        
        // Track click listener cleanup functions
        this.clickListenerCleanups = new Map(); // Map<sectionId, cleanupFunction>
        
        // Section tracking
        this.sections = {
            'input-cpee': null,
            'input-intermediate': null,
            'output-intermediate': null,
            'output-cpee': null
        };
        
        // Current highlight state
        this.activeTaskId = null;
        this.activeSourceFormat = null;
        this.activeSourceSection = null;
        this.highlightedTasks = new Map(); // Map<sectionId, Set<taskId>>
        
        // Click outside handler
        this.clickOutsideHandler = null;
        
        // Initialize click outside handler
        this.initializeClickOutsideHandler();
        
        console.log('[HighlightCoordinator] Initialized');
    }

    /**
     * Set the TaskMapper instance
     * @param {Object} taskMapper - TaskMapper instance
     */
    setTaskMapper(taskMapper) {
        this.taskMapper = taskMapper;
        console.log('[HighlightCoordinator] TaskMapper set');
    }

    /**
     * Register a content section's SVG container
     * @param {string} sectionId - Section identifier (e.g., 'input-cpee')
     * @param {HTMLElement} container - SVG container element
     */
    registerSection(sectionId, container) {
        this.sections[sectionId] = container;
        console.log(`[HighlightCoordinator] Registered section: ${sectionId}`);
    }

    /**
     * Attach click handlers for CPEE SVG (called when SVG is ready)
     * @param {HTMLElement} svgElement - SVG container element
     * @param {string} sectionId - Section identifier
     */
    attachCPEEClickHandlers(svgElement, sectionId) {
        console.log(`[HighlightCoordinator] Attaching CPEE click handlers to ${sectionId}`);
        
        // Remove any existing listener for this section
        this.removeClickHandlers(sectionId);
        
        // Find all task elements and make them clickable
        const taskElements = svgElement.querySelectorAll('g.element[element-id]');
        console.log(`[HighlightCoordinator] Found ${taskElements.length} CPEE task elements in ${sectionId}`);
        
        taskElements.forEach(taskElement => {
            taskElement.classList.add('task-clickable');
        });
        
        // Attach click listener for the entire SVG
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer) {
                const taskId = taskContainer.getAttribute('element-id');
                if (taskId) {
                    console.log(`[HighlightCoordinator] CPEE task clicked in ${sectionId}: ${taskId}`);
                    this.onTaskClicked(taskId, sectionId, sectionId);
                }
            }
        });
        
        // Store cleanup function
        this.clickListenerCleanups.set(sectionId, cleanup);
    }

    /**
     * Attach click handlers for Mermaid SVG (called when SVG is ready)
     * @param {HTMLElement} svgElement - SVG container element
     * @param {string} sectionId - Section identifier
     */
    attachMermaidClickHandlers(svgElement, sectionId) {
        console.log(`[HighlightCoordinator] Attaching Mermaid click handlers to ${sectionId}`);
        
        // Remove any existing listener for this section
        this.removeClickHandlers(sectionId);
        
        // Find all node elements and make them clickable
        const nodeElements = svgElement.querySelectorAll('g.node');
        console.log(`[HighlightCoordinator] Found ${nodeElements.length} Mermaid node elements in ${sectionId}`);
        
        nodeElements.forEach(nodeElement => {
            nodeElement.classList.add('task-clickable');
        });
        
        // Attach click listener for the entire SVG
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer) {
                const nodeId = taskContainer.id;
                if (nodeId) {
                    console.log(`[HighlightCoordinator] Mermaid node clicked in ${sectionId}: ${nodeId}`);
                    this.onTaskClicked(nodeId, sectionId, sectionId);
                }
            }
        });
        
        // Store cleanup function
        this.clickListenerCleanups.set(sectionId, cleanup);
    }

    /**
     * Remove click handlers for a section
     * @param {string} sectionId - Section identifier
     */
    removeClickHandlers(sectionId) {
        const cleanup = this.clickListenerCleanups.get(sectionId);
        if (cleanup && typeof cleanup === 'function') {
            cleanup();
            this.clickListenerCleanups.delete(sectionId);
            console.log(`[HighlightCoordinator] Removed click handlers for ${sectionId}`);
        }
    }

    /**
     * Handle task click event from any section
     * @param {string} taskId - Clicked task identifier
     * @param {string} sourceFormat - Source format (e.g., 'input-cpee', 'input-intermediate')
     * @param {string} sectionId - Source section identifier
     */
    onTaskClicked(taskId, sourceFormat, sectionId) {
        console.log(`[HighlightCoordinator] Task clicked: ${taskId} in ${sectionId}`);
        
        // Check if clicking the same task again
        if (this.isSameTaskClicked(taskId, sectionId)) {
            this.clearActiveState();
            return;
        }
        
        // Extract base task ID for mapping
        const baseTaskId = this.extractBaseTaskId(taskId);
        
        // Update active state
        this.setActiveState(taskId, baseTaskId, sourceFormat, sectionId);
        
        // Clear previous highlights and apply new highlights
        this.clearAllHighlights();
        this.applyHighlights(baseTaskId, sourceFormat, sectionId, taskId);
    }

    /**
     * Check if the same task is clicked again
     * @param {string} taskId - Task identifier
     * @param {string} sectionId - Section identifier
     * @returns {boolean} True if same task clicked
     */
    isSameTaskClicked(taskId, sectionId) {
        return this.activeTaskId === taskId && this.activeSourceSection === sectionId;
    }

    /**
     * Extract base task ID from Mermaid ID format
     * Handles both formats:
     * - "flowchart-a1:task:-5" → "a1"
     * - "flowchart-1:task:-5" → "1"
     * - "1:task:" → "1"
     * @param {string} taskId - Task identifier
     * @returns {string} Base task ID
     */
    extractBaseTaskId(taskId) {
        // If it doesn't contain :task:, it's likely already a base ID (CPEE format)
        if (!taskId.includes(':task:')) {
            return taskId;
        }
        
        // Try pattern: flowchart-XXX:task: or XXX:task:
        // Match: -([a-z0-9]+):task: or ^([a-z0-9]+):task:
        const match = taskId.match(/-([a-z0-9]+):task:/) || taskId.match(/^([a-z0-9]+):task:/);
        if (match) {
            const baseId = match[1];
            console.log(`[HighlightCoordinator] Extracted base ID: ${baseId} from ${taskId}`);
            return baseId;
        }
        
        return taskId;
    }

    /**
     * Set active state
     * @param {string} taskId - Task identifier
     * @param {string} baseTaskId - Base task identifier
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Section identifier
     */
    setActiveState(taskId, baseTaskId, sourceFormat, sectionId) {
        this.activeTaskId = taskId;
        this.activeTaskBaseId = baseTaskId;
        this.activeSourceFormat = sourceFormat;
        this.activeSourceSection = sectionId;
    }

    /**
     * Clear active state
     */
    clearActiveState() {
        this.activeTaskId = null;
        this.activeSourceFormat = null;
        this.activeSourceSection = null;
        this.clearAllHighlights();
    }

    /**
     * Apply highlights for a task
     * @param {string} baseTaskId - Base task identifier
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Section identifier
     * @param {string} originalTaskId - Original task identifier
     */
    applyHighlights(baseTaskId, sourceFormat, sectionId, originalTaskId) {
        if (this.currentStepMapping) {
            this.highlightWithTaskMapper(baseTaskId, sourceFormat, sectionId, originalTaskId);
        } else {
            this.highlightInSection(sectionId, originalTaskId, true);
        }
    }

    /**
     * Highlight tasks using TaskMapper to find related tasks
     * @param {string} taskId - Clicked task identifier
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Source section identifier
     */
    highlightWithTaskMapper(baseTaskId, sourceFormat, sectionId, originalTaskId) {
        console.log(`[HighlightCoordinator] Using TaskMapper to find related tasks for: ${baseTaskId} (original: ${originalTaskId})`);
        console.log(`[HighlightCoordinator] Source format: ${sourceFormat}, Section ID: ${sectionId}`);
        
        // Find equivalent tasks in all formats
        const equivalentTasks = this.findEquivalentTasks(baseTaskId, sourceFormat);
        
        if (equivalentTasks.length === 0) {
            console.log(`[HighlightCoordinator] No equivalent tasks found for: ${baseTaskId}`);
            console.log(`[HighlightCoordinator] Just highlighting in source section: ${sectionId}`);
            // Just highlight in source section using original ID
            this.highlightInSection(sectionId, originalTaskId, true);
            return;
        }
        
        console.log(`[HighlightCoordinator] Found ${equivalentTasks.length} equivalent tasks`);
        
        // Highlight in each section
        equivalentTasks.forEach(({ taskId: mappedTaskId, format: mappedFormat }) => {
            const mappedSectionId = this.formatToSectionId(mappedFormat);
            const isActive = (mappedFormat === sourceFormat);
            
            console.log(`[HighlightCoordinator] Highlighting ${mappedTaskId} in ${mappedSectionId} (isActive=${isActive})`);
            this.highlightInSection(mappedSectionId, mappedTaskId, isActive);
        });
        
        // Also highlight the source task using original ID
        this.highlightInSection(sectionId, originalTaskId, true);
    }

    /**
     * Find equivalent tasks for a given task using TaskMapper
     * @param {string} taskId - Source task identifier
     * @param {string} sourceFormat - Source format
     * @returns {Array} Array of { taskId, format }
     */
    findEquivalentTasks(taskId, sourceFormat) {
        if (!this.currentStepMapping) {
            console.log('[HighlightCoordinator] No task mapping available for current step');
            return [];
        }
        
        console.log(`[HighlightCoordinator] Finding equivalent tasks for ${taskId} in ${sourceFormat}`);
        
        try {
            // Use the step's task mapping to find equivalent tasks
            const equivalents = this.currentStepMapping.findEquivalentTasks(taskId, sourceFormat);
            
            console.log(`[HighlightCoordinator] Task mapping returned:`, equivalents);
            
            // Convert to array format
            const result = [];
            Object.entries(equivalents).forEach(([format, tasks]) => {
                console.log(`[HighlightCoordinator] Format ${format} has ${tasks.length} tasks`);
                tasks.forEach(({ task }) => {
                    result.push({
                        taskId: task.id,
                        format: format
                    });
                    console.log(`[HighlightCoordinator]   → ${task.id} (${task.label}) in ${format}`);
                });
            });
            
            console.log(`[HighlightCoordinator] Found ${result.length} equivalent tasks`);
            return result;
            
        } catch (error) {
            console.error('[HighlightCoordinator] Error finding equivalent tasks:', error);
            return [];
        }
    }

    /**
     * Convert format key to section ID
     * @param {string} format - Format key (e.g., 'input-cpee')
     * @returns {string} Section ID
     */
    formatToSectionId(format) {
        // Format and section ID are the same for our sections
        return format;
    }

    /**
     * Get section type based on section ID
     * @param {string} sectionId - Section identifier
     * @returns {string} Section type
     */
    getSectionType(sectionId) {
        if (sectionId.includes('cpee')) {
            return 'cpee';
        }
        if (sectionId.includes('intermediate')) {
            return 'mermaid';
        }
        return 'unknown';
    }

    /**
     * Highlight a task in a specific section
     * @param {string} sectionId - Section identifier
     * @param {string} taskId - Task identifier
     * @param {boolean} isActive - Whether this is the active (clicked) task
     */
    highlightInSection(sectionId, taskId, isActive = false) {
        const container = this.sections[sectionId];
        if (!container) {
            console.log(`[HighlightCoordinator] Section not found: ${sectionId}`);
            return;
        }
        
        // Check if section is in visual mode
        if (!this.isSectionInVisualMode(sectionId)) {
            console.log(`[HighlightCoordinator] Section ${sectionId} is in raw mode, skipping highlight`);
            return;
        }
        
        // Find task element
        const taskElement = this.findTaskInSVG(container, taskId);
        if (!taskElement) {
            console.log(`[HighlightCoordinator] Task element not found: ${taskId} in ${sectionId}`);
            return;
        }
        
        // Apply appropriate highlighting based on section type
        this.applySectionHighlight(sectionId, taskElement, isActive);
        
        // Track this highlight
        this.trackHighlight(sectionId, taskId);
        
        console.log(`[HighlightCoordinator] Highlighted ${taskId} in ${sectionId} (isActive=${isActive})`);
    }

    /**
     * Apply highlighting based on section type
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} taskElement - Task element
     * @param {boolean} isActive - Whether this is the active task
     */
    applySectionHighlight(sectionId, taskElement, isActive) {
        const sectionType = this.getSectionType(sectionId);
        
        switch (sectionType) {
            case 'cpee':
                this.highlightingService.highlightCPEETask(taskElement, isActive);
                break;
            case 'mermaid':
                this.highlightingService.highlightMermaidNode(taskElement, isActive);
                break;
            default:
                this.highlightingService.highlightElements([taskElement], isActive);
        }
    }

    /**
     * Track a highlight
     * @param {string} sectionId - Section identifier
     * @param {string} taskId - Task identifier
     */
    trackHighlight(sectionId, taskId) {
        if (!this.highlightedTasks.has(sectionId)) {
            this.highlightedTasks.set(sectionId, new Set());
        }
        this.highlightedTasks.get(sectionId).add(taskId);
    }

    /**
     * Find task element in SVG container
     * @param {HTMLElement} container - SVG container element
     * @param {string} taskId - Task identifier to find
     * @returns {HTMLElement|null} Task element or null
     */
    findTaskInSVG(container, taskId) {
        console.log(`[HighlightCoordinator] Searching for task: ${taskId} in container`);
        
        // First, try CPEE element-id attribute (most reliable for CPEE)
        const elements = container.querySelectorAll('[element-id]');
        console.log(`[HighlightCoordinator] Found ${elements.length} elements with element-id attribute`);
        for (const el of elements) {
            const elementId = el.getAttribute('element-id');
            if (elementId === taskId) {
                console.log(`[HighlightCoordinator] ✓ Found CPEE task by element-id: ${taskId}`);
                return el;
            }
        }
        
        // For Mermaid: look for node elements
        const nodes = container.querySelectorAll('g.node');
        console.log(`[HighlightCoordinator] Found ${nodes.length} Mermaid nodes`);
        
        // Try exact ID match for Mermaid
        for (const node of nodes) {
            if (node.id === taskId) {
                console.log(`[HighlightCoordinator] ✓ Found Mermaid node by exact ID: ${taskId}`);
                return node;
            }
        }
        
        // Try partial ID match for Mermaid, but be more precise
        // Match patterns like: flowchart-XXX-task- or flowchart-XXX:task:
        // where XXX matches taskId exactly (not as substring)
        for (const node of nodes) {
            if (node.id) {
                // Try pattern: flowchart-TASKID-task- or flowchart-TASKID:task:
                const exactMatch = new RegExp(`flowchart-${taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-task-|:task:)`);
                if (exactMatch.test(node.id)) {
                    console.log(`[HighlightCoordinator] ✓ Found Mermaid node by exact pattern match: ${node.id}`);
                    return node;
                }
                // Also try simpler pattern: just the taskId followed by :task: or -task-
                const simplePattern = new RegExp(`(?:^|-)${taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-task-|:task:)`);
                if (simplePattern.test(node.id)) {
                    console.log(`[HighlightCoordinator] ✓ Found Mermaid node by simple pattern: ${node.id}`);
                    return node;
                }
            }
        }
        
        // Try to extract base ID from Mermaid format and search
        // Pattern: flowchart-XXX:task: or XXX:task:
        const baseIdMatch = taskId.match(/:([a-z0-9]+):task:/) || taskId.match(/^([a-z0-9]+):task:/);
        if (baseIdMatch) {
            const baseId = baseIdMatch[1];
            console.log(`[HighlightCoordinator] Extracted base ID: ${baseId}`);
            // Use exact pattern matching for base ID too
            for (const node of nodes) {
                if (node.id) {
                    const exactMatch = new RegExp(`flowchart-${baseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-task-|:task:)`);
                    if (exactMatch.test(node.id)) {
                        console.log(`[HighlightCoordinator] ✓ Found Mermaid node by base ID pattern: ${node.id}`);
                        return node;
                    }
                }
            }
        }
        
        // Fallback: Try to find element by ID
        try {
            const element = container.querySelector(`#${CSS.escape(taskId)}`);
            if (element) {
                console.log(`[HighlightCoordinator] ✓ Found task by ID: ${taskId}`);
                return element;
            }
        } catch (e) {
            console.log(`[HighlightCoordinator] ID selector failed: ${e.message}`);
        }
        
        // Fallback: Look for elements with data-task-id attribute
        try {
            const element = container.querySelector(`[data-task-id="${taskId}"]`);
            if (element) {
                console.log(`[HighlightCoordinator] ✓ Found task by data-task-id: ${taskId}`);
                return element;
            }
        } catch (e) {
            console.log(`[HighlightCoordinator] data-task-id selector failed`);
        }
        
        console.log(`[HighlightCoordinator] ✗ Could not find task element: ${taskId} in container`);
        return null;
    }

    /**
     * Check if a section is currently in visual mode (not raw mode)
     * @param {string} sectionId - Section identifier
     * @returns {boolean} True if section is in visual mode
     */
    isSectionInVisualMode(sectionId) {
        // Check view mode for this section
        // This would integrate with ViewModeCoordinator
        // For now, assume all sections are in visual mode
        const container = this.sections[sectionId];
        if (!container) {
            return false;
        }
        
        // Check if raw content overlay is visible
        const rawContainer = container.querySelector('.raw-content-container');
        if (rawContainer && rawContainer.style.zIndex === '10') {
            return false; // Raw mode active
        }
        
        return true; // Visual mode
    }

    /**
     * Clear all highlights
     */
    clearAllHighlights() {
        this.highlightingService.clearAllHighlights();
        this.highlightedTasks.clear();
        console.log('[HighlightCoordinator] Cleared all highlights');
    }

    /**
     * Clear highlights when navigating to a different step
     */
    onStepChanged() {
        this.clearAllHighlights();
        this.activeTaskId = null;
        this.activeSourceFormat = null;
        this.activeSourceSection = null;
        console.log('[HighlightCoordinator] Step changed, cleared highlights');
    }


    /**
     * Set the current step mapping for task lookups
     * @param {TaskMapping} taskMapping - Current step's task mapping
     */
    setCurrentStepMapping(taskMapping) {
        this.currentStepMapping = taskMapping;
    }

    /**
     * Get the current step mapping
     * @returns {TaskMapping|null} Current step mapping or null
     */
    getCurrentStepMapping() {
        return this.currentStepMapping;
    }

    /**
     * Refresh sections - re-query DOM for SVG containers
     */
    refreshSections() {
        if (!this.domRegistry) {
            console.log('[HighlightCoordinator] No DOMRegistry available');
            return;
        }
        
        const sectionIds = Object.keys(this.sections);
        sectionIds.forEach(sectionId => {
            const container = this.domRegistry.getElementSafe(`${sectionId}-graph-container`);
            if (container) {
                this.sections[sectionId] = container;
                console.log(`[HighlightCoordinator] Refreshed section: ${sectionId}`);
            } else {
                this.sections[sectionId] = null;
                console.log(`[HighlightCoordinator] Section not found: ${sectionId}`);
            }
        });
    }

    /**
     * Initialize click outside handler to clear highlights when clicking outside graphs or on empty space within graphs
     */
    initializeClickOutsideHandler() {
        this.clickOutsideHandler = (event) => {
            // Check if there are any active highlights
            if (!this.hasActiveHighlights()) {
                return;
            }
            
            // Check if click is on an actual graph element (task, node, etc.)
            // If NOT on a graph element, clear highlights (even if inside a graph container)
            const clickTarget = event.target;
            if (this.isClickOnGraphElement(clickTarget)) {
                return; // Click is on a graph element, do nothing (let task click handler process it)
            }
            
            // Click is not on a graph element (either outside graphs or on empty space within graphs)
            console.log('[HighlightCoordinator] Click not on graph element detected, clearing highlights');
            this.clearActiveState();
        };
        
        // Attach listener to document (capture phase to catch all clicks)
        document.addEventListener('click', this.clickOutsideHandler, true);
        console.log('[HighlightCoordinator] Click outside handler initialized');
    }

    /**
     * Check if there are active highlights
     * @returns {boolean} True if there are active highlights
     */
    hasActiveHighlights() {
        return this.activeTaskId !== null || this.highlightedTasks.size > 0;
    }

    /**
     * Check if a click target is on an actual graph element (task, node, etc.)
     * This distinguishes between clicking on a graph element vs empty space in a graph container
     * @param {Element} target - Click target element
     * @returns {boolean} True if click is on a graph element
     */
    isClickOnGraphElement(target) {
        if (!target) {
            return false;
        }
        
        // Walk up the DOM tree to check if we're on a graph element
        let element = target;
        while (element && element !== document.body && element !== document.documentElement) {
            // Check for task-clickable class (indicates a clickable graph element)
            try {
                if (element.classList && element.classList.contains('task-clickable')) {
                    return true;
                }
            } catch (e) {
                // Some SVG elements might not have classList, ignore
            }
            
            // Check for CPEE element groups with element-id attribute
            if (element.tagName === 'g' || element.tagName === 'G') {
                const elementId = element.getAttribute('element-id');
                const elementType = element.getAttribute('element-type');
                // If it has element-id or element-type, it's a CPEE task element
                if (elementId || elementType) {
                    return true;
                }
            }
            
            // Check for Mermaid node elements
            try {
                if (element.classList) {
                    const classList = element.classList;
                    // Mermaid nodes have class "node"
                    if (classList.contains('node')) {
                        return true;
                    }
                    // CPEE elements have class "element"
                    if (classList.contains('element') && element.getAttribute('element-id')) {
                        return true;
                    }
                }
            } catch (e) {
                // Some SVG elements might not have classList, ignore
            }
            
            // If we've reached an SVG element without finding a graph element,
            // the click is on empty space within the SVG (not on a graph element)
            if (element.tagName === 'svg' || element.tagName === 'SVG') {
                return false;
            }
            
            // If we've reached a graph container without finding a graph element,
            // the click is on empty space within the container
            if (this.isGraphContainer(element)) {
                return false;
            }
            
            element = element.parentElement;
        }
        
        return false;
    }

    /**
     * Check if an element is a graph container
     * @param {Element} element - Element to check
     * @returns {boolean} True if element is a graph container
     */
    isGraphContainer(element) {
        if (!element || !element.id) {
            return false;
        }
        
        const id = element.id;
        
        // Check for graph container IDs
        return id.includes('-graph-container') ||
               id.startsWith('graphcanvas-') ||
               id.startsWith('graphgrid-') ||
               id.startsWith('modelling-') ||
               id.includes('mermaid-graph-');
    }

    /**
     * Remove click outside handler (cleanup)
     */
    removeClickOutsideHandler() {
        if (this.clickOutsideHandler) {
            document.removeEventListener('click', this.clickOutsideHandler, true);
            this.clickOutsideHandler = null;
            console.log('[HighlightCoordinator] Click outside handler removed');
        }
    }

    /**
     * Reset all state
     */
    reset() {
        // Remove all click handlers
        this.clickListenerCleanups.forEach((cleanup, sectionId) => {
            this.removeClickHandlers(sectionId);
        });
        
        this.clearAllHighlights();
        this.activeTaskId = null;
        this.activeSourceFormat = null;
        this.activeSourceSection = null;
        this.currentStepMapping = null;
        this.sections = {
            'input-cpee': null,
            'input-intermediate': null,
            'output-intermediate': null,
            'output-cpee': null
        };
        this.highlightedTasks.clear();
        console.log('[HighlightCoordinator] Reset');
    }

    /**
     * Destroy the coordinator and clean up resources
     */
    destroy() {
        this.removeClickOutsideHandler();
        
        // Remove all click handlers
        this.clickListenerCleanups.forEach((cleanup, sectionId) => {
            this.removeClickHandlers(sectionId);
        });
        
        this.reset();
        console.log('[HighlightCoordinator] Destroyed');
    }
}
