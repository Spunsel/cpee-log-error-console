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

import { HighlightingService } from '../../services/HighlightingService.js';
import { serviceFactory } from '../../core/ServiceFactory.js';

export class HighlightCoordinator {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        
        // Core services
        this.highlightingService = serviceFactory.get('HighlightingService');
        this.taskMapper = null; // Set externally
        
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
     * Handle task click event from any section
     * @param {string} taskId - Clicked task identifier
     * @param {string} sourceFormat - Source format (e.g., 'input-cpee', 'input-intermediate')
     * @param {string} sectionId - Source section identifier
     */
    onTaskClicked(taskId, sourceFormat, sectionId) {
        console.log(`[HighlightCoordinator] Task clicked: ${taskId} in ${sectionId}`);
        
        // Extract base ID from Mermaid IDs (e.g., "a2" from "flowchart-a2:task:-5")
        let baseTaskId = taskId;
        if (taskId.includes(':task:')) {
            // Extract base ID: "a2" from "flowchart-a2:task:-5"
            const match = taskId.match(/-([a-z0-9]+):task:/);
            if (match) {
                baseTaskId = match[1];
                console.log(`[HighlightCoordinator] Extracted base ID: ${baseTaskId} from ${taskId}`);
            }
        }
        
        // Check if it's the same task clicked again
        if (this.activeTaskId === taskId && this.activeSourceSection === sectionId) {
            // Clear highlights if clicking the same task again
            this.clearAllHighlights();
            this.activeTaskId = null;
            this.activeSourceFormat = null;
            this.activeSourceSection = null;
            return;
        }
        
        // Update active state
        this.activeTaskId = taskId;
        this.activeTaskBaseId = baseTaskId; // Store base ID for mapping
        this.activeSourceFormat = sourceFormat;
        this.activeSourceSection = sectionId;
        
        // Clear previous highlights
        this.clearAllHighlights();
        
        // If we have a step mapping, use it to find related tasks
        if (this.currentStepMapping) {
            this.highlightWithTaskMapper(baseTaskId, sourceFormat, sectionId, taskId);
        } else {
            // If no mapping, just highlight in the source section
            this.highlightInSection(sectionId, taskId, true);
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
        equivalentTasks.forEach(({ taskId: mappedTaskId, format: mappedFormat, confidence }) => {
            const mappedSectionId = this.formatToSectionId(mappedFormat);
            const isActive = (mappedFormat === sourceFormat);
            
            console.log(`[HighlightCoordinator] Highlighting ${mappedTaskId} in ${mappedSectionId} (isActive=${isActive}, confidence=${confidence})`);
            this.highlightInSection(mappedSectionId, mappedTaskId, isActive, confidence);
        });
        
        // Also highlight the source task using original ID
        this.highlightInSection(sectionId, originalTaskId, true);
    }

    /**
     * Find equivalent tasks for a given task using TaskMapper
     * @param {string} taskId - Source task identifier
     * @param {string} sourceFormat - Source format
     * @returns {Array} Array of { taskId, format, confidence }
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
                tasks.forEach(({ task, confidence }) => {
                    // All matches are exact (confidence always 1.0)
                    result.push({
                        taskId: task.id,
                        format: format,
                        confidence: confidence
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
        const mapping = {
            'input-cpee': 'input-cpee',
            'input-intermediate': 'input-intermediate',
            'output-intermediate': 'output-intermediate',
            'output-cpee': 'output-cpee'
        };
        return mapping[format] || format;
    }

    /**
     * Highlight a task in a specific section
     * @param {string} sectionId - Section identifier
     * @param {string} taskId - Task identifier
     * @param {boolean} isActive - Whether this is the active (clicked) task
     * @param {number} confidence - Confidence score for mapping (optional)
     */
    highlightInSection(sectionId, taskId, isActive = false) {
        const container = this.sections[sectionId];
        if (!container) {
            console.log(`[HighlightCoordinator] Section not found: ${sectionId}`);
            return;
        }
        
        // Check if section is in visual mode (not raw mode)
        if (!this.isSectionInVisualMode(sectionId)) {
            console.log(`[HighlightCoordinator] Section ${sectionId} is in raw mode, skipping highlight`);
            return;
        }
        
        // Find SVG element for this task
        const taskElement = this.findTaskInSVG(container, taskId);
        if (!taskElement) {
            console.log(`[HighlightCoordinator] Task element not found: ${taskId} in ${sectionId}`);
            return;
        }
        
        // Determine if this is CPEE or Mermaid
        const isCpeeSection = sectionId.includes('cpee');
        const isMermaidSection = sectionId.includes('intermediate');
        
        // Apply highlighting
        if (isCpeeSection) {
            this.highlightingService.highlightCPEETask(taskElement, isActive);
        } else if (isMermaidSection) {
            this.highlightingService.highlightMermaidNode(taskElement, isActive);
        } else {
            this.highlightingService.highlightElements([taskElement], isActive);
        }
        
        // Track this highlight
        if (!this.highlightedTasks.has(sectionId)) {
            this.highlightedTasks.set(sectionId, new Set());
        }
        this.highlightedTasks.get(sectionId).add(taskId);
        
        console.log(`[HighlightCoordinator] Highlighted ${taskId} in ${sectionId} (isActive=${isActive})`);
        console.log(`[HighlightCoordinator] Task element classes after highlight:`, taskElement.className);
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
        
        // Try partial ID match for Mermaid (e.g., "a2" in "flowchart-a2:task:-5")
        for (const node of nodes) {
            if (node.id && node.id.includes(taskId)) {
                console.log(`[HighlightCoordinator] ✓ Found Mermaid node by partial ID: ${node.id}`);
                return node;
            }
        }
        
        // Try to extract base ID from Mermaid format and search
        const baseIdMatch = taskId.match(/:([a-z0-9]+):task:/);
        if (baseIdMatch) {
            const baseId = baseIdMatch[1];
            console.log(`[HighlightCoordinator] Extracted base ID: ${baseId}`);
            for (const node of nodes) {
                if (node.id && node.id.includes(baseId)) {
                    console.log(`[HighlightCoordinator] ✓ Found Mermaid node by base ID: ${node.id}`);
                    return node;
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
     * Reset all state
     */
    reset() {
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
}
