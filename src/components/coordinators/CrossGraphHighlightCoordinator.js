/**
 * Cross-Graph Highlight Coordinator
 * Coordinates task highlighting across all 4 content sections (cross-graph coordination)
 * Responsibilities:
 * - Track rendered SVG containers in all sections
 * - Handle task click events and propagate highlights across graphs
 * - Coordinate with HighlightingService and TaskMapping (from CPEEStep)
 * - Manage visual vs raw view mode (only highlight in visual mode)
 * - Implement state persistence across step navigation
 */

import { SVGClickDetector } from '../../utils/interaction/SVGClickDetector.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class CrossGraphHighlightCoordinator {
    constructor(domRegistry = null, highlightingService = null, stateManager = null) {
        this.domRegistry = domRegistry;
        
        // Core services injected via constructor
        this.highlightingService = highlightingService;
        this.stateManager = stateManager || defaultStateManager;
        // Task mapping is accessed via currentStepMapping (from CPEEStep)
        
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
        
        console.log('[CrossGraphHighlightCoordinator] Initialized');
    }

    /**
     * Set the TaskMapper instance
     * @deprecated Task mapping is now accessed via currentStepMapping (from CPEEStep)
     * This method is kept for backward compatibility but does nothing
     * @param {Object} _taskMapper - TaskMapper instance (unused)
     */
    setTaskMapper(_taskMapper) {
        // Task mapping is now accessed via currentStepMapping (from CPEEStep)
        // This method is kept for backward compatibility
        console.log('[CrossGraphHighlightCoordinator] setTaskMapper called (deprecated - task mapping accessed via step)');
    }

    /**
     * Register a content section's SVG container
     * @param {string} sectionId - Section identifier (e.g., 'input-cpee')
     * @param {HTMLElement} container - SVG container element
     */
    registerSection(sectionId, container) {
        this.sections[sectionId] = container;
        console.log(`[CrossGraphHighlightCoordinator] Registered section: ${sectionId}`);
    }

    /**
     * Attach click handlers for CPEE SVG (called when SVG is ready)
     * @param {HTMLElement} svgElement - SVG container element
     * @param {string} sectionId - Section identifier
     */
    attachCPEEClickHandlers(svgElement, sectionId) {
        console.log(`[CrossGraphHighlightCoordinator] Attaching CPEE click handlers to ${sectionId}`);
        
        // Remove any existing listener for this section
        this.removeClickHandlers(sectionId);
        
        // Find all task elements and make them clickable
        const taskElements = svgElement.querySelectorAll('g.element[element-id]');
        console.log(`[CrossGraphHighlightCoordinator] Found ${taskElements.length} CPEE task elements in ${sectionId}`);
        
        taskElements.forEach(taskElement => {
            taskElement.classList.add('task-clickable');
        });
        
        // Attach click listener for the entire SVG
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer) {
                const taskId = taskContainer.getAttribute('element-id');
                if (taskId) {
                    console.log(`[CrossGraphHighlightCoordinator] CPEE task clicked in ${sectionId}: ${taskId}`);
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
        console.log(`[CrossGraphHighlightCoordinator] Attaching Mermaid click handlers to ${sectionId}`);
        
        // Remove any existing listener for this section
        this.removeClickHandlers(sectionId);
        
        // Find all node elements and make them clickable
        const nodeElements = svgElement.querySelectorAll('g.node');
        console.log(`[CrossGraphHighlightCoordinator] Found ${nodeElements.length} Mermaid node elements in ${sectionId}`);
        
        nodeElements.forEach(nodeElement => {
            nodeElement.classList.add('task-clickable');
        });
        
        // Attach click listener for the entire SVG
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer) {
                const nodeId = taskContainer.id;
                if (nodeId) {
                    console.log(`[CrossGraphHighlightCoordinator] Mermaid node clicked in ${sectionId}: ${nodeId}`);
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
            console.log(`[CrossGraphHighlightCoordinator] Removed click handlers for ${sectionId}`);
        }
    }

    /**
     * Handle task click event from any section
     * @param {string} taskId - Clicked task identifier
     * @param {string} sourceFormat - Source format (e.g., 'input-cpee', 'input-intermediate')
     * @param {string} sectionId - Source section identifier
     */
    onTaskClicked(taskId, sourceFormat, sectionId) {
        console.log(`[CrossGraphHighlightCoordinator] Task clicked: ${taskId} in ${sectionId}`);
        
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
            console.log(`[CrossGraphHighlightCoordinator] Extracted base ID: ${baseId} from ${taskId}`);
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
     * Highlight tasks using TaskMapping to find related tasks
     * @param {string} taskId - Clicked task identifier
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Source section identifier
     */
    highlightWithTaskMapper(baseTaskId, sourceFormat, sectionId, originalTaskId) {
        console.log(`[CrossGraphHighlightCoordinator] Using TaskMapping to find related tasks for: ${baseTaskId} (original: ${originalTaskId})`);
        console.log(`[CrossGraphHighlightCoordinator] Source format: ${sourceFormat}, Section ID: ${sectionId}`);
        
        // Find equivalent tasks in all formats
        const equivalentTasks = this.findEquivalentTasks(baseTaskId, sourceFormat);
        
        if (equivalentTasks.length === 0) {
            console.log(`[CrossGraphHighlightCoordinator] No equivalent tasks found for: ${baseTaskId}`);
            console.log(`[CrossGraphHighlightCoordinator] Just highlighting in source section: ${sectionId}`);
            // Just highlight in source section using original ID
            this.highlightInSection(sectionId, originalTaskId, true);
            return;
        }
        
        console.log(`[CrossGraphHighlightCoordinator] Found ${equivalentTasks.length} equivalent tasks`);
        
        // Highlight in each section
        equivalentTasks.forEach(({ taskId: mappedTaskId, format: mappedFormat, task: taskObject }) => {
            const mappedSectionId = this.formatToSectionId(mappedFormat);
            const isActive = (mappedFormat === sourceFormat);
            
            // Try to use the full SVG ID from metadata if available (for Mermaid nodes)
            let highlightTaskId = mappedTaskId;
            if (taskObject && taskObject.metadata && taskObject.metadata.fullId) {
                // Prefer full SVG ID for better matching
                highlightTaskId = taskObject.metadata.fullId;
                console.log(`[CrossGraphHighlightCoordinator] Using full SVG ID from metadata: ${highlightTaskId}`);
            }
            
            console.log(`[CrossGraphHighlightCoordinator] Highlighting ${highlightTaskId} (base: ${mappedTaskId}) in ${mappedSectionId} (isActive=${isActive})`);
            this.highlightInSection(mappedSectionId, highlightTaskId, isActive);
        });
        
        // Also highlight the source task using original ID
        this.highlightInSection(sectionId, originalTaskId, true);
    }

    /**
     * Find equivalent tasks for a given task using TaskMapping
     * @param {string} taskId - Source task identifier
     * @param {string} sourceFormat - Source format
     * @returns {Array} Array of { taskId, format }
     */
    findEquivalentTasks(taskId, sourceFormat) {
        if (!this.currentStepMapping) {
            console.log('[CrossGraphHighlightCoordinator] No task mapping available for current step');
            return [];
        }
        
        console.log(`[CrossGraphHighlightCoordinator] Finding equivalent tasks for ${taskId} in ${sourceFormat}`);
        
        try {
            // Use the step's task mapping to find equivalent tasks
            const equivalents = this.currentStepMapping.findEquivalentTasks(taskId, sourceFormat);
            
            console.log(`[CrossGraphHighlightCoordinator] Task mapping returned:`, equivalents);
            
            // Convert to array format
            const result = [];
            Object.entries(equivalents).forEach(([format, tasks]) => {
                console.log(`[CrossGraphHighlightCoordinator] Format ${format} has ${tasks.length} tasks`);
                tasks.forEach(({ task }) => {
                    result.push({
                        taskId: task.id,
                        format: format,
                        task: task // Include full task object for metadata access
                    });
                    console.log(`[CrossGraphHighlightCoordinator]   → ${task.id} (${task.label}) in ${format}`);
                });
            });
            
            console.log(`[CrossGraphHighlightCoordinator] Found ${result.length} equivalent tasks`);
            return result;
            
        } catch (error) {
            console.error('[CrossGraphHighlightCoordinator] Error finding equivalent tasks:', error);
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
            console.log(`[CrossGraphHighlightCoordinator] Section not found: ${sectionId}`);
            return;
        }
        
        // Check if section is in visual mode
        if (!this.isSectionInVisualMode(sectionId)) {
            console.log(`[CrossGraphHighlightCoordinator] Section ${sectionId} is in raw mode, skipping highlight`);
            return;
        }
        
        // Find task element
        const taskElement = this.findTaskInSVG(container, taskId);
        if (!taskElement) {
            console.log(`[CrossGraphHighlightCoordinator] Task element not found: ${taskId} in ${sectionId}`);
            return;
        }
        
        // Apply appropriate highlighting based on section type
        this.applySectionHighlight(sectionId, taskElement, isActive);
        
        // Track this highlight
        this.trackHighlight(sectionId, taskId);
        
        console.log(`[CrossGraphHighlightCoordinator] Highlighted ${taskId} in ${sectionId} (isActive=${isActive})`);
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
     * @param {string} taskId - Task identifier to find (can be full SVG ID or base ID)
     * @returns {HTMLElement|null} Task element or null
     */
    findTaskInSVG(container, taskId) {
        console.log(`[CrossGraphHighlightCoordinator] Searching for task: ${taskId} in container`);
        
        // First, try CPEE element-id attribute (most reliable for CPEE)
        const elements = container.querySelectorAll('[element-id]');
        console.log(`[CrossGraphHighlightCoordinator] Found ${elements.length} elements with element-id attribute`);
        for (const el of elements) {
            const elementId = el.getAttribute('element-id');
            if (elementId === taskId) {
                console.log(`[CrossGraphHighlightCoordinator] ✓ Found CPEE task by element-id: ${taskId}`);
                return el;
            }
        }
        
        // For Mermaid: look for node elements
        const nodes = container.querySelectorAll('g.node');
        console.log(`[CrossGraphHighlightCoordinator] Found ${nodes.length} Mermaid nodes`);
        
        // Try exact ID match for Mermaid first (most reliable)
        for (const node of nodes) {
            if (node.id === taskId) {
                console.log(`[CrossGraphHighlightCoordinator] ✓ Found Mermaid node by exact ID: ${taskId}`);
                return node;
            }
        }
        
        // Extract base ID if taskId is a full Mermaid SVG ID
        let baseId = taskId;
        const baseIdMatch = taskId.match(/:([a-z0-9]+):task:/) || 
                           taskId.match(/^([a-z0-9]+):task:/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-task-|:task:|-)/);
        if (baseIdMatch && baseIdMatch[1]) {
            baseId = baseIdMatch[1];
            console.log(`[CrossGraphHighlightCoordinator] Extracted base ID: ${baseId} from ${taskId}`);
        }
        
        // Try pattern matching for Mermaid with the full taskId
        for (const node of nodes) {
            if (node.id) {
                // Escape special regex characters in taskId
                const escapedTaskId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Try various patterns that Mermaid might use
                const patterns = [
                    new RegExp(`^flowchart-${escapedTaskId}(?:-task-|:task:|-|$)`),
                    new RegExp(`flowchart-${escapedTaskId}(?:-task-|:task:)`),
                    new RegExp(`(?:^|-)${escapedTaskId}(?:-task-|:task:)`),
                    new RegExp(`^${escapedTaskId}(?:-task-|:task:)`)
                ];
                
                for (const pattern of patterns) {
                    if (pattern.test(node.id)) {
                        console.log(`[CrossGraphHighlightCoordinator] ✓ Found Mermaid node by pattern match: ${node.id} (pattern: ${pattern})`);
                        return node;
                    }
                }
            }
        }
        
        // Try pattern matching with base ID (if different from taskId)
        if (baseId !== taskId) {
            for (const node of nodes) {
                if (node.id) {
                    const escapedBaseId = baseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const patterns = [
                        new RegExp(`^flowchart-${escapedBaseId}(?:-task-|:task:|-|$)`),
                        new RegExp(`flowchart-${escapedBaseId}(?:-task-|:task:)`),
                        new RegExp(`(?:^|-)${escapedBaseId}(?:-task-|:task:)`),
                        new RegExp(`^${escapedBaseId}(?:-task-|:task:)`)
                    ];
                    
                    for (const pattern of patterns) {
                        if (pattern.test(node.id)) {
                            console.log(`[CrossGraphHighlightCoordinator] ✓ Found Mermaid node by base ID pattern: ${node.id} (baseId: ${baseId})`);
                            return node;
                        }
                    }
                }
            }
        }
        
        // Fallback: Try to find element by ID (CSS selector)
        try {
            const element = container.querySelector(`#${CSS.escape(taskId)}`);
            if (element) {
                console.log(`[CrossGraphHighlightCoordinator] ✓ Found task by CSS ID selector: ${taskId}`);
                return element;
            }
        } catch (e) {
            console.log(`[CrossGraphHighlightCoordinator] ID selector failed: ${e.message}`);
        }
        
        // Fallback: Try with base ID if different
        if (baseId !== taskId) {
            try {
                const element = container.querySelector(`#${CSS.escape(baseId)}`);
                if (element) {
                    console.log(`[CrossGraphHighlightCoordinator] ✓ Found task by base ID CSS selector: ${baseId}`);
                    return element;
                }
            } catch (e) {
                // Ignore
            }
        }
        
        // Fallback: Look for elements with data-task-id attribute
        try {
            const element = container.querySelector(`[data-task-id="${taskId}"]`);
            if (element) {
                console.log(`[CrossGraphHighlightCoordinator] ✓ Found task by data-task-id: ${taskId}`);
                return element;
            }
        } catch (e) {
            console.log(`[CrossGraphHighlightCoordinator] data-task-id selector failed`);
        }
        
        console.log(`[CrossGraphHighlightCoordinator] ✗ Could not find task element: ${taskId} (baseId: ${baseId}) in container`);
        return null;
    }

    /**
     * Check if a section is currently in visual mode (not raw/log/traces mode)
     * @param {string} sectionId - Section identifier
     * @returns {boolean} True if section is in visual mode
     */
    isSectionInVisualMode(sectionId) {
        // Query StateManager for view mode (single source of truth)
        const viewModes = this.stateManager.getState('viewModes');
        const mode = viewModes?.[sectionId] || 'visual';
        
        // Only visual mode allows highlighting
        return mode === 'visual';
    }

    /**
     * Clear all highlights
     */
    clearAllHighlights() {
        this.highlightingService.clearAllHighlights();
        this.highlightedTasks.clear();
        console.log('[CrossGraphHighlightCoordinator] Cleared all highlights');
    }

    /**
     * Clear highlights when navigating to a different step
     */
    onStepChanged() {
        this.clearAllHighlights();
        this.activeTaskId = null;
        this.activeSourceFormat = null;
        this.activeSourceSection = null;
        console.log('[CrossGraphHighlightCoordinator] Step changed, cleared highlights');
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
            console.log('[CrossGraphHighlightCoordinator] No DOMRegistry available');
            return;
        }
        
        const sectionIds = Object.keys(this.sections);
        sectionIds.forEach(sectionId => {
            const container = this.domRegistry.getElementSafe(`${sectionId}-graph-container`);
            if (container) {
                this.sections[sectionId] = container;
                console.log(`[CrossGraphHighlightCoordinator] Refreshed section: ${sectionId}`);
            } else {
                this.sections[sectionId] = null;
                console.log(`[CrossGraphHighlightCoordinator] Section not found: ${sectionId}`);
            }
        });
    }

    /**
     * Initialize click outside handler to clear highlights when clicking inside content boxes of visual view
     */
    initializeClickOutsideHandler() {
        this.clickOutsideHandler = (event) => {
            // Check if there are any active highlights
            if (!this.hasActiveHighlights()) {
                return;
            }
            
            // Check if click is on an actual graph element (task, node, etc.)
            // If click is on a graph element, do nothing (let task click handler process it)
            const clickTarget = event.target;
            if (this.isClickOnGraphElement(clickTarget)) {
                return;
            }
            
            // Check if click is inside a content-box of a visual view section
            if (this.isClickInsideVisualContentBox(clickTarget)) {
                // Click is inside a visual view content-box but not on a graph element
                console.log('[CrossGraphHighlightCoordinator] Click inside visual content-box (not on graph element) detected, clearing highlights');
                this.clearActiveState();
            }
            // If click is outside visual content boxes, do nothing (don't clear highlights)
        };
        
        // Attach listener to document (capture phase to catch all clicks)
        document.addEventListener('click', this.clickOutsideHandler, true);
        console.log('[CrossGraphHighlightCoordinator] Click outside handler initialized');
    }

    /**
     * Check if a click target is inside a content-box of a visual view section
     * @param {Element} target - Click target element
     * @returns {boolean} True if click is inside a visual view content-box
     */
    isClickInsideVisualContentBox(target) {
        if (!target) {
            return false;
        }
        
        // Walk up the DOM tree to find if we're inside a content-box
        let element = target;
        while (element && element !== document.body && element !== document.documentElement) {
            // Check if this element is a content-box or is inside one
            if (element.classList && element.classList.contains('content-box')) {
                // Found a content-box, now check if it's in visual mode using StateManager
                const sectionElement = element.closest('[id^="input-"], [id^="output-"], [id^="user-input"]');
                if (sectionElement && sectionElement.id) {
                    // Query StateManager for view mode (single source of truth)
                    const viewModes = this.stateManager.getState('viewModes');
                    const mode = viewModes?.[sectionElement.id] || 'visual';
                    
                    // Only visual mode allows highlighting
                    return mode === 'visual';
                }
                // If we found a content-box but can't determine the section, assume it's visual
                return true;
            }
            
            element = element.parentElement;
        }
        
        return false;
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
            console.log('[CrossGraphHighlightCoordinator] Click outside handler removed');
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
        console.log('[CrossGraphHighlightCoordinator] Reset');
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
        console.log('[CrossGraphHighlightCoordinator] Destroyed');
    }
}
