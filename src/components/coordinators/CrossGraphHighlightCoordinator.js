    /**
     * Cross-Graph Highlight Coordinator
     * Coordinates task and gateway highlighting across all 4 content sections (cross-graph coordination)
     * Responsibilities:
     * - Track rendered SVG containers in all sections
     * - Handle task and gateway click events and propagate highlights across graphs
     * - Coordinate with HighlightingService and TaskMapping (from CPEEStep)
     * - Manage visual vs raw view mode (only highlight in visual mode)
     * - Implement state persistence across step navigation
     */

import { SVGClickDetector } from '../../utils/interaction/SVGClickDetector.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { MermaidNodeExtractor } from '../../utils/extraction/MermaidNodeExtractor.js';
import { CPEENodeExtractor } from '../../utils/extraction/CPEETNodeExtractor.js';

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
    }

    /**
     * Register a content section's SVG container
     * @param {string} sectionId - Section identifier (e.g., 'input-cpee')
     * @param {HTMLElement} container - SVG container element
     */
    registerSection(sectionId, container) {
        this.sections[sectionId] = container;
    }

    /**
     * Attach click handlers for CPEE SVG (called when SVG is ready)
     * @param {HTMLElement} svgElement - SVG container element
     * @param {string} sectionId - Section identifier
     */
    attachCPEEClickHandlers(svgElement, sectionId) {
        // Remove any existing listener for this section
        this.removeClickHandlers(sectionId);
        
        // Find all task and gateway elements and make them clickable
        const taskElements = svgElement.querySelectorAll('g.element[element-id]');
        const gatewayElements = svgElement.querySelectorAll('g.choose[element-id], g.parallel[element-id]');
        
        taskElements.forEach(taskElement => {
            taskElement.classList.add('task-clickable');
        });
        
        gatewayElements.forEach(gatewayElement => {
            gatewayElement.classList.add('task-clickable');
        });
        
        // Attach click listener for the entire SVG
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer) {
                const taskId = taskContainer.getAttribute('element-id');
                if (taskId) {
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
        // Remove any existing listener for this section
        this.removeClickHandlers(sectionId);
        
        // Find all node elements and make them clickable
        const nodeElements = svgElement.querySelectorAll('g.node');
        
        nodeElements.forEach(nodeElement => {
            nodeElement.classList.add('task-clickable');
        });
        
        // Attach click listener for the entire SVG
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer) {
                const nodeId = taskContainer.id;
                if (nodeId) {
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
        }
    }

    /**
     * Handle task click event from any section
     * @param {string} taskId - Clicked task identifier
     * @param {string} sourceFormat - Source format (e.g., 'input-cpee', 'input-intermediate')
     * @param {string} sectionId - Source section identifier
     */
    onTaskClicked(taskId, sourceFormat, sectionId) {
        // Debug: log click
        console.log('[CrossGraphHighlight] onTaskClicked', { taskId, sourceFormat, sectionId });

        // Check if clicking the same task again
        if (this.isSameTaskClicked(taskId, sectionId)) {
            console.log('[CrossGraphHighlight] same element clicked, clearing state');
            this.clearActiveState();
            return;
        }
        
        // For CPEE gateways (element-id like "choose_1", "parallel_0"), resolve to mapping ID
        let resolvedTaskId = taskId;
        let resolvedGatewayObject = null;
        if (sectionId.includes('cpee') && this.currentStepMapping) {
            if (CPEENodeExtractor.isCPEEGatewayElementId(taskId)) {
                console.log('[CrossGraphHighlight] CPEE gateway clicked, resolving element-id to mapping ID');
                const resolved = this.resolveCPEEGatewayElementId(taskId, sectionId);
                if (resolved) {
                    console.log('[CrossGraphHighlight] Resolved CPEE gateway:', {
                        elementId: taskId,
                        resolvedId: resolved.id,
                        resolvedAltId: resolved.altId,
                        sectionId: sectionId
                    });
                    resolvedTaskId = resolved.altId || resolved.id;
                    resolvedGatewayObject = resolved;
                }
            }
        }
        
        // Extract base task ID for mapping
        const baseTaskId = this.extractBaseTaskId(resolvedTaskId);
        console.log('[CrossGraphHighlight] extracted baseTaskId', { input: resolvedTaskId, baseTaskId });
        
        // Update active state
        this.setActiveState(taskId, baseTaskId, sourceFormat, sectionId);
        
        // Clear previous highlights and apply new highlights
        this.clearAllHighlights();
        this.applyHighlightsWithGatewayObject(baseTaskId, sourceFormat, sectionId, taskId, resolvedGatewayObject);
    }
    
    /**
     * Resolve CPEE gateway element-id (like "choose_1") to the actual gateway object from mapping
     * Uses index alignment:
     * - For choose/parallel: SVG gateways inverted (choose_n → first mapping gateway)
     * - For loop: Direct order (loop_0 → first mapping gateway)
     * Uses CPEENodeExtractor for parsing and type matching
     * @param {string} elementId - CPEE element-id like "choose_1", "parallel_0", "loop_0"
     * @param {string} sectionId - Section ID ('input-cpee' or 'output-cpee')
     * @returns {Object|null} Gateway object from mapping with id and altId, or null
     */
    resolveCPEEGatewayElementId(elementId, sectionId) {
        if (!this.currentStepMapping) {
            return null;
        }
        
        // Use CPEENodeExtractor to parse element-id
        const parsed = CPEENodeExtractor.parseCPEEGatewayElementId(elementId);
        if (!parsed) {
            return null;
        }
        
        const gatewayType = parsed.type;
        const svgIndex = parsed.index;
        
        console.log('[CrossGraphHighlight] Resolving CPEE gateway element-id:', {
            elementId: elementId,
            sectionId: sectionId,
            gatewayType: gatewayType,
            svgIndex: svgIndex
        });
        
        // Get all gateways of this type from the mapping for this section
        const taskIds = this.currentStepMapping.getTasksInFormat(sectionId);
        const mappingGateways = [];
        
        for (const taskIdInFormat of taskIds) {
            const task = this.currentStepMapping.getTask(taskIdInFormat, sectionId);
            if (task) {
                // Use CPEENodeExtractor for gateway type detection and matching
                const taskIsGateway = CPEENodeExtractor.isGatewayType(task.type);
                const taskMatchesType = CPEENodeExtractor.gatewayTypeMatches(task.type, gatewayType, task.metadata);
                
                if (taskIsGateway && taskMatchesType) {
                    mappingGateways.push(task);
                }
            }
        }
        
        console.log('[CrossGraphHighlight] CPEE gateways in mapping order:', mappingGateways.map(g => ({ id: g.id, altId: g.altId })));
        
        if (mappingGateways.length === 0) {
            return null;
        }
        
        // For choose/parallel: SVG gateways are inverted (choose_n maps to first mapping gateway)
        // For loop: Direct order (loop_0 maps to first mapping gateway)
        let targetIndex;
        if (gatewayType === 'loop') {
            // Direct index for loops
            targetIndex = svgIndex;
            console.log('[CrossGraphHighlight] Using direct index for loop:', { svgIndex, targetIndex });
        } else {
            // Inverted index for choose/parallel
            targetIndex = mappingGateways.length - 1 - svgIndex;
            console.log('[CrossGraphHighlight] Using inverted index for', gatewayType + ':', { svgIndex, targetIndex });
        }
        
        if (targetIndex >= 0 && targetIndex < mappingGateways.length) {
            const gateway = mappingGateways[targetIndex];
            console.log('[CrossGraphHighlight] ✓ Resolved CPEE gateway element-id to mapping gateway:', {
                elementId: elementId,
                svgIndex: svgIndex,
                targetIndex: targetIndex,
                gatewayId: gateway.id,
                gatewayAltId: gateway.altId
            });
            return gateway;
        }
        
        console.log('[CrossGraphHighlight] ✗ Could not resolve CPEE gateway element-id, index out of range');
        return null;
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
     * Extract base task or gateway ID from Mermaid ID format
     * Delegates to MermaidNodeExtractor.extractBaseId
     * @param {string} taskId - Task or gateway identifier
     * @returns {string} Base task or gateway ID
     */
    extractBaseTaskId(taskId) {
        try {
            return MermaidNodeExtractor.extractBaseId(taskId);
        } catch (e) {
            console.warn('[CrossGraphHighlight] extractBaseTaskId failed', { taskId, e });
            return taskId;
        }
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
        this.applyHighlightsWithGatewayObject(baseTaskId, sourceFormat, sectionId, originalTaskId, null);
    }
    
    /**
     * Apply highlights for a task or gateway with optional gateway object
     * @param {string} baseTaskId - Base task identifier
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Section identifier
     * @param {string} originalTaskId - Original task identifier (element-id for CPEE)
     * @param {Object|null} gatewayObject - Resolved gateway object from mapping (for CPEE gateways)
     */
    applyHighlightsWithGatewayObject(baseTaskId, sourceFormat, sectionId, originalTaskId, gatewayObject) {
        if (this.currentStepMapping) {
            this.highlightWithTaskMapper(baseTaskId, sourceFormat, sectionId, originalTaskId, gatewayObject);
        } else {
            this.highlightInSection(sectionId, originalTaskId, true, gatewayObject);
        }
    }

    /**
     * Highlight tasks using TaskMapping to find related tasks
     * @param {string} baseTaskId - Base task identifier (resolved from element-id for CPEE gateways)
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Source section identifier
     * @param {string} originalTaskId - Original task identifier (element-id for CPEE)
     * @param {Object|null} sourceGatewayObject - Resolved gateway object for CPEE gateways
     */
    highlightWithTaskMapper(baseTaskId, sourceFormat, sectionId, originalTaskId, sourceGatewayObject = null) {
        console.log('[CrossGraphHighlight] highlightWithTaskMapper', { baseTaskId, sourceFormat, sectionId, originalTaskId, hasSourceGatewayObject: !!sourceGatewayObject });
        
        // Check if this is a gateway click (using extractors for detection)
        // Check both baseTaskId and originalTaskId since originalTaskId may contain gateway markers like :exclusivegateway:
        const isGatewayClick = MermaidNodeExtractor.isGatewayId(baseTaskId) || 
                              MermaidNodeExtractor.isGatewayId(originalTaskId) ||
                              (sourceGatewayObject && CPEENodeExtractor.isGatewayType(sourceGatewayObject.type));
        
        // For gateway clicks, use dedicated gateway highlighting (bypasses broken mapping)
        if (isGatewayClick && this.currentStepMapping) {
            console.log('[CrossGraphHighlight] Gateway click detected, using dedicated gateway highlighting');
            this.highlightGatewaysAcrossAllSections(baseTaskId, sourceFormat, sectionId, originalTaskId, sourceGatewayObject);
            return;
        }
        
        // For regular task clicks, use the standard mapping-based highlighting
        const equivalentTasks = this.findEquivalentTasks(baseTaskId, sourceFormat);
        console.log('[CrossGraphHighlight] equivalents (raw)', equivalentTasks.map(e => ({ format: e.format, id: e.taskId, altId: e.task?.altId, type: e.task?.type })));
        
        // Filter out gateways - tasks should only map to tasks, not gateways
        const taskOnlyEquivalents = equivalentTasks.filter(({ task }) => {
            if (!task) { return true; } // Keep if no task object (can't determine type)
            // Exclude if it's a gateway type
            const isGateway = CPEENodeExtractor.isGatewayType(task.type) ||
                             (task.metadata && task.metadata.tagName && 
                              ['choose', 'parallel', 'loop'].includes(task.metadata.tagName));
            if (isGateway) {
                console.log('[CrossGraphHighlight] Filtering out gateway from task equivalents:', { id: task.id, altId: task.altId, type: task.type });
            }
            return !isGateway;
        });
        console.log('[CrossGraphHighlight] equivalents (tasks only)', taskOnlyEquivalents.map(e => ({ format: e.format, id: e.taskId, altId: e.task?.altId, type: e.task?.type })));
        
        if (taskOnlyEquivalents.length === 0) {
            console.log('[CrossGraphHighlight] no task equivalents from mapping, trying direct ID lookup');
            // Fallback: try to find tasks by baseTaskId directly in all sections
            this.highlightTaskByIdFallback(baseTaskId, sourceFormat, sectionId, originalTaskId);
            return;
        }
        
        // Highlight in each section
        taskOnlyEquivalents.forEach(({ taskId: mappedTaskId, format: mappedFormat, task: taskObject }) => {
            const mappedSectionId = this.formatToSectionId(mappedFormat);
            const isActive = (mappedFormat === sourceFormat);
            
            let highlightTaskId = mappedTaskId;
            
            if (taskObject && taskObject.metadata && taskObject.metadata.fullId) {
                highlightTaskId = taskObject.metadata.fullId;
            } else if (mappedFormat.includes('cpee') && taskObject) {
                highlightTaskId = taskObject.altId || taskObject.id || mappedTaskId;
            }
            
            console.log('[CrossGraphHighlight] mapping -> highlightInSection', { mappedSectionId, highlightTaskId, isActive, type: taskObject?.type });
            this.highlightInSection(mappedSectionId, highlightTaskId, isActive, taskObject);
        });
        
        // Also highlight the source task using original ID
        this.highlightInSection(sectionId, originalTaskId, true, sourceGatewayObject);
    }
    
    /**
     * Fallback method to find and highlight tasks by ID/altId when mapping fails
     * @param {string} baseTaskId - Base task ID to search for
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Source section identifier
     * @param {string} originalTaskId - Original task identifier
     */
    highlightTaskByIdFallback(baseTaskId, sourceFormat, sectionId, originalTaskId) {
        console.log('[CrossGraphHighlight] highlightTaskByIdFallback', { baseTaskId, sourceFormat, sectionId });
        
        // Always highlight the source
        this.highlightInSection(sectionId, originalTaskId, true);
        
        if (!this.currentStepMapping) {
            console.log('[CrossGraphHighlight] No mapping available for fallback');
            return;
        }
        
        // Try to find matching tasks in all other sections
        const allFormats = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        for (const format of allFormats) {
            if (format === sourceFormat) {
                continue; // Skip source format
            }
            
            const taskIds = this.currentStepMapping.getTasksInFormat(format);
            if (!taskIds || taskIds.length === 0) {
                continue;
            }
            
            // Search for task with matching id or altId
            for (const taskId of taskIds) {
                const task = this.currentStepMapping.getTask(taskId, format);
                if (!task) {
                    continue;
                }
                
                // Skip gateways
                if (CPEENodeExtractor.isGatewayType(task.type) ||
                    (task.metadata && task.metadata.tagName && 
                     ['choose', 'parallel', 'loop'].includes(task.metadata.tagName))) {
                    continue;
                }
                
                // Check if id or altId matches baseTaskId
                const matches = task.id === baseTaskId || 
                               task.altId === baseTaskId ||
                               taskId === baseTaskId;
                
                if (matches) {
                    const targetSectionId = this.formatToSectionId(format);
                    const highlightId = format.includes('cpee') ? (task.altId || task.id) : 
                                       (task.metadata?.fullId || task.id);
                    
                    console.log('[CrossGraphHighlight] Fallback found matching task:', {
                        format,
                        taskId: task.id,
                        altId: task.altId,
                        highlightId,
                        type: task.type
                    });
                    
                    this.highlightInSection(targetSectionId, highlightId, false, task);
                }
            }
        }
    }
    
    /**
     * Dedicated gateway highlighting that uses index alignment across all 4 sections
     * This bypasses the mapping which doesn't correctly link gateways between formats
     * @param {string} baseTaskId - Base gateway ID (e.g., 'gw1s', '3')
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Source section identifier
     * @param {string} originalTaskId - Original task identifier (element-id for CPEE)
     * @param {Object|null} sourceGatewayObject - Resolved gateway object for CPEE gateways
     */
    highlightGatewaysAcrossAllSections(baseTaskId, sourceFormat, sectionId, originalTaskId, sourceGatewayObject) {
        console.log('[CrossGraphHighlight] highlightGatewaysAcrossAllSections', { baseTaskId, sourceFormat, sectionId, originalTaskId });
        
        // Step 1: Determine gateway index from the source format
        const gatewayIndex = this.getGatewayIndexInFormat(baseTaskId, sourceFormat, sourceGatewayObject);
        console.log('[CrossGraphHighlight] Gateway index from source:', gatewayIndex);
        
        if (gatewayIndex < 0) {
            console.warn('[CrossGraphHighlight] Could not determine gateway index, falling back to source only');
            this.highlightInSection(sectionId, originalTaskId, true, sourceGatewayObject);
            return;
        }
        
        // Step 2: Highlight equivalent gateway in each of the 4 sections
        const allSections = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        for (const targetSection of allSections) {
            const isSource = (targetSection === sectionId);
            const container = this.sections[targetSection];
            const isMermaidSection = targetSection.includes('intermediate');
            
            if (!container) {
                console.log('[CrossGraphHighlight] No container for section:', targetSection);
                continue;
            }
            
            // Get gateway at this index for the target section
            const targetGateway = this.getGatewayAtIndex(targetSection, gatewayIndex);
            
            if (!targetGateway) {
                console.log('[CrossGraphHighlight] No gateway at index', gatewayIndex, 'for section:', targetSection);
                continue;
            }
            
            console.log('[CrossGraphHighlight] Highlighting gateway in', targetSection, ':', {
                index: gatewayIndex,
                id: targetGateway.id,
                altId: targetGateway.altId,
                isSource: isSource
            });
            
            // For source section, use original element-id
            if (isSource) {
                this.highlightInSection(targetSection, originalTaskId, true, sourceGatewayObject || targetGateway);
                
                // For Mermaid source sections with gw pattern, also highlight the paired gateway (start/end)
                if (isMermaidSection) {
                    const baseId = MermaidNodeExtractor.extractBaseId(originalTaskId);
                    if (MermaidNodeExtractor.usesGwNamingConvention(baseId)) {
                        const pairedGatewayId = this.getPairedMermaidGatewayId(originalTaskId);
                        if (pairedGatewayId) {
                            console.log('[CrossGraphHighlight] Also highlighting paired Mermaid gateway:', pairedGatewayId);
                            this.highlightInSection(targetSection, pairedGatewayId, true, null);
                        }
                    }
                    // For numeric IDs (1, 4, etc.), only highlight the single gateway - no pairing
                }
            } else {
                // For other sections, use the gateway's ID
                const targetId = targetGateway.altId || targetGateway.id;
                this.highlightInSection(targetSection, targetId, false, targetGateway);
                
                // For Mermaid target sections with gw pattern, also highlight the paired/END gateway
                if (isMermaidSection && targetGateway.id) {
                    if (MermaidNodeExtractor.usesGwNamingConvention(targetGateway.id)) {
                        const pairedGatewayId = MermaidNodeExtractor.getPairedGatewayId(targetGateway.id);
                        if (pairedGatewayId && pairedGatewayId !== targetGateway.id) {
                            console.log('[CrossGraphHighlight] Also highlighting paired gateway:', pairedGatewayId);
                            this.highlightInSection(targetSection, pairedGatewayId, false, null);
                        }
                    }
                    // For numeric IDs (1, 4, etc.), only highlight the single gateway - no pairing
                }
            }
        }
    }
    
    /**
     * Get the paired Mermaid gateway ID (start ↔ end)
     * Delegates to MermaidNodeExtractor.getPairedGatewayId
     * @param {string} gatewayId - Gateway ID (can be full Mermaid SVG ID or base ID)
     * @returns {string|null} Paired gateway ID or null
     */
    getPairedMermaidGatewayId(gatewayId) {
        return MermaidNodeExtractor.getPairedGatewayId(gatewayId);
    }
    
    /**
     * Get the index of a gateway within a format's gateway list
     * For Mermaid formats, only counts START gateways (ending with 's') to align with CPEE
     * Uses MermaidNodeExtractor and CPEENodeExtractor for gateway detection
     * @param {string} gatewayId - Gateway ID to find
     * @param {string} format - Format to search in
     * @param {Object|null} gatewayObject - Gateway object (for CPEE gateways)
     * @returns {number} Index of gateway, or -1 if not found
     */
    getGatewayIndexInFormat(gatewayId, format, gatewayObject) {
        if (!this.currentStepMapping) {
            return -1;
        }
        
        const taskIds = this.currentStepMapping.getTasksInFormat(format);
        const gateways = [];
        const isMermaidFormat = format.includes('intermediate');
        
        for (const taskId of taskIds) {
            const task = this.currentStepMapping.getTask(taskId, format);
            if (task) {
                // Use extractors to detect gateway type
                // Check type, ID pattern, metadata tagName, and metadata shape
                const isGateway = CPEENodeExtractor.isGatewayType(task.type) ||
                                 MermaidNodeExtractor.isGatewayId(task.id) ||
                                 (task.metadata && task.metadata.tagName && 
                                  ['choose', 'parallel', 'loop'].includes(task.metadata.tagName)) ||
                                 (task.metadata && task.metadata.shape === 'diamond');
                if (isGateway) {
                    // For Mermaid, only include START gateways (ending with 's') for gw pattern
                    if (isMermaidFormat) {
                        // For gw pattern (gw1s, gw2s), only include start gateways
                        if (MermaidNodeExtractor.usesGwNamingConvention(task.id)) {
                            if (MermaidNodeExtractor.isStartGateway(task.id)) {
                                gateways.push(task);
                            }
                        } else {
                            // For non-gw patterns (numeric IDs like "3", "6"), include all gateways
                            // We cannot distinguish start vs end from the ID alone
                            gateways.push(task);
                        }
                    } else {
                        gateways.push(task);
                    }
                }
            }
        }
        
        console.log('[CrossGraphHighlight] Gateways in format', format, '(filtered):', gateways.map(g => ({ id: g.id, altId: g.altId })));
        
        // Find index by matching id, altId, or gatewayObject
        for (let i = 0; i < gateways.length; i++) {
            const g = gateways[i];
            if (g.id === gatewayId || 
                g.altId === gatewayId ||
                (gatewayObject && (g.id === gatewayObject.id || g.altId === gatewayObject.altId))) {
                return i;
            }
        }
        
        // For Mermaid END gateways (ending with 'e'), find the corresponding START gateway index
        if (isMermaidFormat && MermaidNodeExtractor.isEndGateway(gatewayId)) {
            const startGatewayId = MermaidNodeExtractor.getPairedGatewayId(gatewayId);
            for (let i = 0; i < gateways.length; i++) {
                if (gateways[i].id === startGatewayId) {
                    console.log('[CrossGraphHighlight] Mapped END gateway', gatewayId, 'to START gateway', startGatewayId, 'at index', i);
                    return i;
                }
            }
        }
        
        return -1;
    }
    
    /**
     * Get gateway at a specific index within a format
     * For Mermaid formats, only counts START gateways (for gw pattern) or all gateways (for numeric IDs)
     * Uses MermaidNodeExtractor and CPEENodeExtractor for gateway detection
     * @param {string} format - Format to get gateway from
     * @param {number} index - Index of gateway
     * @returns {Object|null} Gateway object or null
     */
    getGatewayAtIndex(format, index) {
        if (!this.currentStepMapping || index < 0) {
            return null;
        }
        
        const taskIds = this.currentStepMapping.getTasksInFormat(format);
        const gateways = [];
        const isMermaidFormat = format.includes('intermediate');
        
        for (const taskId of taskIds) {
            const task = this.currentStepMapping.getTask(taskId, format);
            if (task) {
                // Use extractors to detect gateway type
                // Check type, ID pattern, metadata tagName, and metadata shape
                const isGateway = CPEENodeExtractor.isGatewayType(task.type) ||
                                 MermaidNodeExtractor.isGatewayId(task.id) ||
                                 (task.metadata && task.metadata.tagName && 
                                  ['choose', 'parallel', 'loop'].includes(task.metadata.tagName)) ||
                                 (task.metadata && task.metadata.shape === 'diamond');
                if (isGateway) {
                    // For Mermaid, filter based on naming convention
                    if (isMermaidFormat) {
                        // For gw pattern (gw1s, gw2s), only include start gateways
                        if (MermaidNodeExtractor.usesGwNamingConvention(task.id)) {
                            if (MermaidNodeExtractor.isStartGateway(task.id)) {
                                gateways.push(task);
                            }
                        } else {
                            // For non-gw patterns (numeric IDs like "3", "6"), include all gateways
                            gateways.push(task);
                        }
                    } else {
                        gateways.push(task);
                    }
                }
            }
        }
        
        if (index < gateways.length) {
            return gateways[index];
        }
        
        return null;
    }
    
    /**
     * Find equivalent tasks for a given task using TaskMapping
     * @param {string} taskId - Source task identifier
     * @param {string} sourceFormat - Source format
     * @returns {Array} Array of { taskId, format }
     */
    findEquivalentTasks(taskId, sourceFormat) {
        if (!this.currentStepMapping) {
            return [];
        }
        
        try {
            // Use the step's task mapping to find equivalent tasks
            const equivalents = this.currentStepMapping.findEquivalentTasks(taskId, sourceFormat);
            
            // Convert to array format
            const result = [];
            Object.entries(equivalents).forEach(([format, tasks]) => {
                tasks.forEach(({ task }) => {
                    result.push({
                        taskId: task.id,
                        format: format,
                        task: task // Include full task object for metadata access
                    });
                });
            });
            
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
     * Highlight a task or gateway in a specific section
     * @param {string} sectionId - Section identifier
     * @param {string} taskId - Task or gateway identifier
     * @param {boolean} isActive - Whether this is the active (clicked) task or gateway
     * @param {Object} taskObject - Optional task object with alt_id for fallback lookup
     */
    highlightInSection(sectionId, taskId, isActive = false, taskObject = null) {
        const container = this.sections[sectionId];
        if (!container) {
            console.log('[CrossGraphHighlight] no container for section', sectionId);
            return;
        }
        
        // Check if section is in visual mode
        if (!this.isSectionInVisualMode(sectionId)) {
            console.log('[CrossGraphHighlight] section not in visual mode', sectionId);
            return;
        }
        
        // Find task or gateway element
        let taskElement = this.findTaskInSVG(container, taskId);
        
        // For CPEE sections, if taskId looks like an element-id (choose_1, parallel_0), try direct lookup
        if (!taskElement && sectionId.includes('cpee') && CPEENodeExtractor.isCPEEGatewayElementId(taskId)) {
            console.log('[CrossGraphHighlight] Trying direct element-id lookup for CPEE:', taskId);
            taskElement = container.querySelector(`[element-id="${taskId}"]`);
            if (taskElement) {
                console.log('[CrossGraphHighlight] ✓ Found CPEE element by direct element-id:', taskId);
            }
        }
        
        if (sectionId === 'input-cpee' && !taskElement) {
            console.log('[CrossGraphHighlight] [INPUT-CPEE] Initial findTaskInSVG failed for taskId:', taskId);
        }
        
        // If not found and we have a task object with alt_id, try using alt_id for CPEE sections
        if (!taskElement && taskObject && taskObject.altId && sectionId.includes('cpee')) {
            console.log('[CrossGraphHighlight] fallback to altId for CPEE', taskObject.altId);
            taskElement = this.findTaskInSVG(container, taskObject.altId);
            
            if (sectionId === 'input-cpee' && !taskElement) {
                console.log('[CrossGraphHighlight] [INPUT-CPEE] Fallback to altId also failed:', taskObject.altId);
            }
        }
        
        // If still not found and we have a task object with id, try using id as fallback
        if (!taskElement && taskObject && taskObject.id && taskId !== taskObject.id) {
            console.log('[CrossGraphHighlight] fallback to id', taskObject.id);
            taskElement = this.findTaskInSVG(container, taskObject.id);
            
            if (sectionId === 'input-cpee' && !taskElement) {
                console.log('[CrossGraphHighlight] [INPUT-CPEE] Fallback to id also failed:', taskObject.id);
            }
        }
        
        // If still not found in CPEE section and it's a gateway, try to find by Mermaid mapping
        // CPEE library generates element-id like "choose_1", "parallel_2" which don't match XML ids
        if (!taskElement && sectionId.includes('cpee') && taskObject) {
            if (CPEENodeExtractor.isGatewayType(taskObject.type)) {
                console.log('[CrossGraphHighlight] attempt gateway by Mermaid mapping', {
                    sectionId: sectionId,
                    taskId: taskId,
                    taskObjectId: taskObject.id,
                    taskObjectAltId: taskObject.altId,
                    taskObjectType: taskObject.type,
                    isInputCpee: sectionId === 'input-cpee'
                });
                taskElement = this.findCPEEGatewayByMermaidMapping(container, taskObject, sectionId);
                
                if (sectionId === 'input-cpee') {
                    if (taskElement) {
                        console.log('[CrossGraphHighlight] [INPUT-CPEE] ✓ Gateway element found via mapping:', {
                            elementId: taskElement.getAttribute('element-id'),
                            taskId: taskId,
                            taskObjectAltId: taskObject.altId
                        });
                    } else {
                        console.log('[CrossGraphHighlight] [INPUT-CPEE] ✗ Gateway element NOT found via mapping');
                    }
                }
            }
        }
        
        if (!taskElement) {
            console.warn('[CrossGraphHighlight] element not found in section', { sectionId, triedId: taskId });
            return;
        }
        
        // Apply appropriate highlighting based on section type
        this.applySectionHighlight(sectionId, taskElement, isActive);
        
        // Track this highlight
        this.trackHighlight(sectionId, taskId);
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
            case 'cpee': {
                // Use gateway highlight for choose/parallel, otherwise task
                const cls = taskElement.classList || { contains: () => false };
                const isGateway = cls.contains('choose') || cls.contains('parallel') || cls.contains('complex');
                if (isGateway && this.highlightingService.highlightCPEEGateway) {
                    this.highlightingService.highlightCPEEGateway(taskElement, isActive);
                } else {
                    this.highlightingService.highlightCPEETask(taskElement, isActive);
                }
                break;
            }
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
     * Find task or gateway element in SVG container
     * @param {HTMLElement} container - SVG container element
     * @param {string} taskId - Task or gateway identifier to find (can be full SVG ID or base ID)
     * @returns {HTMLElement|null} Task or gateway element or null
     */
    findTaskInSVG(container, taskId) {
        // For CPEE gateway element-ids (choose_N, parallel_N), use specific selector
        // to find the correct gateway group element (g.element.complex)
        if (CPEENodeExtractor.isCPEEGatewayElementId(taskId)) {
            const gatewayElement = container.querySelector(`g.element.complex[element-id="${CSS.escape(taskId)}"]`);
            if (gatewayElement) {
                return gatewayElement;
            }
            // Fallback: try without .complex class (some gateways might not have it)
            const gatewayElementAlt = container.querySelector(`g.element[element-id="${CSS.escape(taskId)}"]`);
            if (gatewayElementAlt) {
                return gatewayElementAlt;
            }
        }
        
        // First, try CPEE element-id attribute (most reliable for CPEE)
        // This includes both tasks (g.element) and gateways (g.choose, g.parallel)
        // Prefer g.element elements over other elements with element-id
        const groupElements = container.querySelectorAll('g.element[element-id]');
        for (const el of groupElements) {
            const elementId = el.getAttribute('element-id');
            if (elementId === taskId) {
                return el;
            }
        }
        
        // Fallback: try any element with element-id
        const elements = container.querySelectorAll('[element-id]');
        for (const el of elements) {
            const elementId = el.getAttribute('element-id');
            if (elementId === taskId) {
                return el;
            }
        }
        // Also try by element-type+alt/id for CPEE if element-id carried those
        if (container.id && container.id.includes('cpee')) {
            const el = container.querySelector(`[element-id="${CSS.escape(taskId)}"]`);
            if (el) {
                return el;
            }
        }
        
        // For Mermaid: look for node elements
        const nodes = container.querySelectorAll('g.node');
        
        // Try exact ID match for Mermaid first (most reliable)
        for (const node of nodes) {
            if (node.id === taskId) {
                return node;
            }
        }
        
        // Extract base ID if taskId is a full Mermaid SVG ID
        // Support both task and gateway patterns
        let baseId = taskId;
        const baseIdMatch = taskId.match(/:([a-z0-9]+):task:/) || 
                           taskId.match(/^([a-z0-9]+):task:/) ||
                           taskId.match(/:([a-z0-9]+):exclusivegateway:/) ||
                           taskId.match(/^([a-z0-9]+):exclusivegateway:/) ||
                           taskId.match(/:([a-z0-9]+):parallelgateway:/) ||
                           taskId.match(/^([a-z0-9]+):parallelgateway:/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-task-|:task:|-)/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-exclusivegateway-|:exclusivegateway:|-)/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-parallelgateway-|:parallelgateway:|-)/);
        if (baseIdMatch && baseIdMatch[1]) {
            baseId = baseIdMatch[1];
        }
        
        // Try pattern matching for Mermaid with the full taskId
        // Support both task and gateway patterns
        for (const node of nodes) {
            if (node.id) {
                // Escape special regex characters in taskId
                const escapedTaskId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Try various patterns that Mermaid might use for tasks and gateways
                const patterns = [
                    new RegExp(`^flowchart-${escapedTaskId}(?:-task-|:task:|-|$)`),
                    new RegExp(`flowchart-${escapedTaskId}(?:-task-|:task:)`),
                    new RegExp(`(?:^|-)${escapedTaskId}(?:-task-|:task:)`),
                    new RegExp(`^${escapedTaskId}(?:-task-|:task:)`),
                    new RegExp(`^flowchart-${escapedTaskId}(?:-exclusivegateway-|:exclusivegateway:|-|$)`),
                    new RegExp(`flowchart-${escapedTaskId}(?:-exclusivegateway-|:exclusivegateway:)`),
                    new RegExp(`(?:^|-)${escapedTaskId}(?:-exclusivegateway-|:exclusivegateway:)`),
                    new RegExp(`^${escapedTaskId}(?:-exclusivegateway-|:exclusivegateway:)`),
                    new RegExp(`^flowchart-${escapedTaskId}(?:-parallelgateway-|:parallelgateway:|-|$)`),
                    new RegExp(`flowchart-${escapedTaskId}(?:-parallelgateway-|:parallelgateway:)`),
                    new RegExp(`(?:^|-)${escapedTaskId}(?:-parallelgateway-|:parallelgateway:)`),
                    new RegExp(`^${escapedTaskId}(?:-parallelgateway-|:parallelgateway:)`)
                ];
                
                for (const pattern of patterns) {
                    if (pattern.test(node.id)) {
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
                        new RegExp(`^${escapedBaseId}(?:-task-|:task:)`),
                        new RegExp(`^flowchart-${escapedBaseId}(?:-exclusivegateway-|:exclusivegateway:|-|$)`),
                        new RegExp(`flowchart-${escapedBaseId}(?:-exclusivegateway-|:exclusivegateway:)`),
                        new RegExp(`(?:^|-)${escapedBaseId}(?:-exclusivegateway-|:exclusivegateway:)`),
                        new RegExp(`^${escapedBaseId}(?:-exclusivegateway-|:exclusivegateway:)`),
                        new RegExp(`^flowchart-${escapedBaseId}(?:-parallelgateway-|:parallelgateway:|-|$)`),
                        new RegExp(`flowchart-${escapedBaseId}(?:-parallelgateway-|:parallelgateway:)`),
                        new RegExp(`(?:^|-)${escapedBaseId}(?:-parallelgateway-|:parallelgateway:)`),
                        new RegExp(`^${escapedBaseId}(?:-parallelgateway-|:parallelgateway:)`)
                    ];
                    
                    for (const pattern of patterns) {
                        if (pattern.test(node.id)) {
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
                return element;
            }
        } catch (e) {
            // ID selector failed
        }
        
        // Fallback: Try with base ID if different
        if (baseId !== taskId) {
            try {
                const element = container.querySelector(`#${CSS.escape(baseId)}`);
                if (element) {
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
                return element;
            }
        } catch (e) {
            // data-task-id selector failed
        }
        
        return null;
    }

    /**
     * Find CPEE gateway by matching Mermaid gateway mappings
     * 
     * Why we can't use alt_id directly:
     * The CPEE library (external) generates element-id attributes like "choose_0", "choose_1" 
     * instead of using the XML alt_id values. These generic IDs don't match the original XML identifiers.
     * 
     * Matching strategy (in order):
     * 1. First try to find by alt_id directly (checking element-id, data-alt-id, and all attributes)
     * 2. If not found, use index alignment: order of gateways in SVG (DOM order) matches 
     *    order in mapping (source order preserved from XML)
     * 3. Fallback: Match by Mermaid equivalents comparison
     * 
     * @param {HTMLElement} container - SVG container
     * @param {Object} taskObject - Task object with type, id, altId
     * @param {string} sectionId - Section ID for context
     * @returns {HTMLElement|null} Gateway element or null
     */
    findCPEEGatewayByMermaidMapping(container, taskObject, sectionId) {
        if (!taskObject || !this.currentStepMapping) {
            return null;
        }
        
        const targetId = taskObject.altId || taskObject.id;
        
        console.log('[CrossGraphHighlight] findCPEEGatewayByMermaidMapping:', {
            targetId,
            taskObjectId: taskObject.id,
            taskObjectAltId: taskObject.altId,
            sectionId,
            taskObjectType: taskObject.type,
            isInputCpee: sectionId === 'input-cpee',
            isOutputCpee: sectionId === 'output-cpee'
        });
        
        // Determine gateway type from task object
        const gatewayType = taskObject.type === 'choose' || (taskObject.metadata && taskObject.metadata.tagName === 'choose') ? 'choose' :
                          taskObject.type === 'parallel' || (taskObject.metadata && taskObject.metadata.tagName === 'parallel') ? 'parallel' :
                          taskObject.type === 'loop' || (taskObject.metadata && taskObject.metadata.tagName === 'loop') ? 'loop' :
                          // For Mermaid gateways with 'gateway' type, default to 'choose' (most common)
                          taskObject.type === 'gateway' ? 'choose' :
                          null;
        
        if (!gatewayType) {
            console.log('[CrossGraphHighlight] Could not determine gateway type for section:', sectionId);
            return null;
        }
        
        console.log('[CrossGraphHighlight] Gateway type determined:', gatewayType, 'for section:', sectionId);
        
        // FIRST: Try to find by alt_id directly (if CPEE library stores it anywhere)
        // Check common places: element-id, data-alt-id, data-alt_id, alt-id, alt_id attributes
        if (targetId) {
            const altIdSelectors = [
                `[element-id="${CSS.escape(targetId)}"]`,
                `[data-alt-id="${CSS.escape(targetId)}"]`,
                `[data-alt_id="${CSS.escape(targetId)}"]`,
                `[alt-id="${CSS.escape(targetId)}"]`,
                `[alt_id="${CSS.escape(targetId)}"]`
            ];
            
            for (const selector of altIdSelectors) {
                try {
                    const found = container.querySelector(`g.element.complex${selector}`);
                    if (found) {
                        const elementId = found.getAttribute('element-id');
                        console.log('[CrossGraphHighlight] ✓ MATCHED gateway by alt_id directly:', {
                            elementId: elementId,
                            targetId: targetId,
                            selector: selector
                        });
                        return found;
                    }
                } catch (e) {
                    // Selector failed, continue
                }
            }
            
            // Also check all gateway elements for any attribute containing alt_id
            const allGateways = container.querySelectorAll(`g.element.complex[element-id^="${gatewayType}_"]`);
            for (const gateway of allGateways) {
                // Check all attributes for alt_id
                for (const attr of gateway.attributes) {
                    if (attr.value === targetId) {
                        const elementId = gateway.getAttribute('element-id');
                        console.log('[CrossGraphHighlight] ✓ MATCHED gateway by alt_id in attribute:', {
                            elementId: elementId,
                            targetId: targetId,
                            attribute: attr.name
                        });
                        return gateway;
                    }
                }
            }
        }
        
        console.log('[CrossGraphHighlight] No direct alt_id match found, using index alignment');
        
        // Build ordered array of SVG gateways (DOM order)
        // Only consider gateways at the first level (not nested inside another gateway of the same type)
        const allSvgGateways = container.querySelectorAll(`g.element.complex[element-id^="${gatewayType}_"]`);
        const svgGateways = [];
        
        for (const svgGateway of allSvgGateways) {
            // Check if this gateway is nested inside another gateway of the same type
            // by looking for a parent that is also a gateway of this type
            let isNested = false;
            let parent = svgGateway.parentElement;
            while (parent && parent !== container) {
                if (parent.classList && parent.classList.contains('element') && parent.classList.contains('complex')) {
                    const parentElementId = parent.getAttribute('element-id');
                    if (parentElementId && parentElementId.startsWith(`${gatewayType}_`)) {
                        isNested = true;
                        break;
                    }
                }
                parent = parent.parentElement;
            }
            
            if (!isNested) {
                svgGateways.push(svgGateway);
            }
        }
        
        // For choose and parallel gateways, invert the sequence (choose_n maps to first mapping gateway)
        // For loop gateways, keep direct order (loop_0 maps to first mapping gateway)
        if (gatewayType !== 'loop') {
            svgGateways.reverse();
            console.log('[CrossGraphHighlight] SVG gateways in inverted order:', svgGateways.map(g => g.getAttribute('element-id')));
        } else {
            console.log('[CrossGraphHighlight] SVG gateways in DOM order (no inversion for loops):', svgGateways.map(g => g.getAttribute('element-id')));
        }
        
        if (sectionId === 'input-cpee') {
            console.log('[CrossGraphHighlight] [INPUT-CPEE] SVG gateways array:', svgGateways.map((g, idx) => ({
                index: idx,
                elementId: g.getAttribute('element-id')
            })));
        }
        
        if (svgGateways.length === 0) {
            console.log('[CrossGraphHighlight] No SVG gateways found at first level for section:', sectionId);
            return null;
        }
        
        // Build ordered array of mapping gateways (mapping order, preserved from source)
        const taskIds = this.currentStepMapping.getTasksInFormat(sectionId);
        const mappingGateways = [];
        
        for (const taskIdInFormat of taskIds) {
            const task = this.currentStepMapping.getTask(taskIdInFormat, sectionId);
            if (task) {
                // Use CPEENodeExtractor for gateway type detection and matching
                const taskIsGateway = CPEENodeExtractor.isGatewayType(task.type);
                const taskMatchesType = CPEENodeExtractor.gatewayTypeMatches(task.type, gatewayType, task.metadata);
                
                if (taskIsGateway && taskMatchesType) {
                    mappingGateways.push(task);
                }
            }
        }
        
        console.log('[CrossGraphHighlight] Mapping gateways in mapping order:', mappingGateways.map((g, idx) => ({
            index: idx,
            id: g.id,
            altId: g.altId,
            type: g.type
        })));
        
        if (sectionId === 'input-cpee') {
            console.log('[CrossGraphHighlight] [INPUT-CPEE] Mapping gateways array:', mappingGateways.map((g, idx) => ({
                index: idx,
                id: g.id,
                altId: g.altId,
                type: g.type
            })));
        }
        
        // Find the index of the target gateway within mappingGateways
        // Try matching by altId first (most reliable for gateways), then by id
        // Also check if taskObject matches through equivalence mapping
        let targetIndex = -1;
        
        // First pass: Direct matching
        for (let i = 0; i < mappingGateways.length; i++) {
            const mappingGateway = mappingGateways[i];
            const mappingId = mappingGateway.altId || mappingGateway.id;
            
            // Direct match: check altId, id, or both
            if (mappingId === targetId || 
                mappingGateway.id === targetId || 
                mappingGateway.altId === targetId ||
                (taskObject.altId && mappingGateway.altId === taskObject.altId) ||
                (taskObject.id && mappingGateway.id === taskObject.id)) {
                targetIndex = i;
                console.log('[CrossGraphHighlight] Found target gateway at mapping index (direct match):', i, {
                    mappingGatewayId: mappingGateway.id,
                    mappingGatewayAltId: mappingGateway.altId,
                    targetId: targetId,
                    taskObjectId: taskObject.id,
                    taskObjectAltId: taskObject.altId,
                    sectionId: sectionId
                });
                break;
            }
        }
        
        // Second pass: If no direct match, try matching through equivalence mapping
        if (targetIndex === -1 && this.currentStepMapping) {
            for (let i = 0; i < mappingGateways.length; i++) {
                const mappingGateway = mappingGateways[i];
                const mappingId = mappingGateway.altId || mappingGateway.id;
                
                // Check if this mappingGateway is equivalent to the taskObject
                // by checking if they map to the same Mermaid gateway
                try {
                    const mappingEquivalents = this.currentStepMapping.findEquivalentTasks(mappingId, sectionId);
                    const taskObjectEquivalents = this.currentStepMapping.findEquivalentTasks(targetId, sectionId);
                    
                    // Check if they share any Mermaid gateway IDs
                    const mappingMermaidIds = new Set();
                    const taskObjectMermaidIds = new Set();
                    
                    Object.entries(mappingEquivalents).forEach(([format, tasks]) => {
                        if (format.includes('intermediate')) {
                            tasks.forEach(({ task }) => {
                                // Use extractors for gateway detection
                                if (CPEENodeExtractor.isGatewayType(task.type) || MermaidNodeExtractor.isGatewayId(task.id)) {
                                    mappingMermaidIds.add(task.id);
                                }
                            });
                        }
                    });
                    
                    Object.entries(taskObjectEquivalents).forEach(([format, tasks]) => {
                        if (format.includes('intermediate')) {
                            tasks.forEach(({ task }) => {
                                // Use extractors for gateway detection
                                if (CPEENodeExtractor.isGatewayType(task.type) || MermaidNodeExtractor.isGatewayId(task.id)) {
                                    taskObjectMermaidIds.add(task.id);
                                }
                            });
                        }
                    });
                    
                    // Check if they share any Mermaid IDs
                    const sharedIds = Array.from(mappingMermaidIds).filter(id => taskObjectMermaidIds.has(id));
                    if (sharedIds.length > 0) {
                        targetIndex = i;
                        console.log('[CrossGraphHighlight] Found target gateway at mapping index (equivalence match):', i, {
                            mappingGatewayId: mappingGateway.id,
                            mappingGatewayAltId: mappingGateway.altId,
                            targetId: targetId,
                            sharedMermaidIds: sharedIds,
                            sectionId: sectionId
                        });
                        break;
                    }
                } catch (e) {
                    // Equivalence check failed, continue
                }
            }
        }
        
        console.log('[CrossGraphHighlight] Target gateway index in mapping:', targetIndex, {
            targetId: targetId,
            taskObjectId: taskObject.id,
            taskObjectAltId: taskObject.altId,
            sectionId: sectionId
        });
        
        if (sectionId === 'input-cpee') {
            console.log('[CrossGraphHighlight] [INPUT-CPEE] Target index computed:', targetIndex, {
                targetId: targetId,
                svgGatewaysCount: svgGateways.length,
                mappingGatewaysCount: mappingGateways.length
            });
        }
        
        // Primary method: Use index alignment if counts match and index is valid
        // This works for both input-cpee and output-cpee
        if (svgGateways.length === mappingGateways.length && targetIndex >= 0 && targetIndex < svgGateways.length) {
            const selectedGateway = svgGateways[targetIndex];
            const elementId = selectedGateway.getAttribute('element-id');
            const matchInfo = {
                elementId: elementId,
                svgIndex: targetIndex,
                targetId: targetId,
                mappingGatewayId: mappingGateways[targetIndex].id,
                mappingGatewayAltId: mappingGateways[targetIndex].altId,
                sectionId: sectionId
            };
            console.log('[CrossGraphHighlight] ✓ MATCHED gateway by index alignment:', matchInfo);
            
            if (sectionId === 'input-cpee') {
                console.log('[CrossGraphHighlight] [INPUT-CPEE] ✓ Successfully matched gateway:', matchInfo);
            }
            
            return selectedGateway;
        }
        
        // Fallback: If index alignment fails, use Mermaid equivalents comparison
        console.log('[CrossGraphHighlight] Index alignment failed, falling back to Mermaid equivalents comparison', {
            svgCount: svgGateways.length,
            mappingCount: mappingGateways.length,
            targetIndex: targetIndex,
            sectionId: sectionId
        });
        
        if (sectionId === 'input-cpee') {
            console.log('[CrossGraphHighlight] [INPUT-CPEE] Index alignment failed, using Mermaid equivalents fallback', {
                svgCount: svgGateways.length,
                mappingCount: mappingGateways.length,
                targetIndex: targetIndex,
                targetId: targetId
            });
        }
        
        // Get the target gateway's Mermaid equivalents (to identify which Mermaid gateway it maps to)
        const targetEquivalents = this.currentStepMapping.findEquivalentTasks(targetId, sectionId);
        
        // Extract Mermaid gateway IDs from target equivalents
        const targetMermaidIds = new Set();
        Object.entries(targetEquivalents).forEach(([format, tasks]) => {
            if (format.includes('intermediate')) {
                tasks.forEach(({ task }) => {
                    // Use extractors for gateway detection
                    if (CPEENodeExtractor.isGatewayType(task.type) || MermaidNodeExtractor.isGatewayId(task.id)) {
                        targetMermaidIds.add(task.id);
                    }
                });
            }
        });
        
        console.log('[CrossGraphHighlight] Target gateway maps to Mermaid IDs:', Array.from(targetMermaidIds));
        
        // For each SVG gateway, check which mapping gateway it corresponds to
        // by verifying they map to the same Mermaid gateway
        for (let i = 0; i < svgGateways.length; i++) {
            const svgGateway = svgGateways[i];
            const elementId = svgGateway.getAttribute('element-id');
            
            // Find which mapping gateway this SVG gateway corresponds to
            for (let j = 0; j < mappingGateways.length; j++) {
                const mappingGateway = mappingGateways[j];
                const mappingId = mappingGateway.altId || mappingGateway.id;
                
                // Get this mapping gateway's Mermaid equivalents
                const mappingEquivalents = this.currentStepMapping.findEquivalentTasks(mappingId, sectionId);
                const mappingMermaidIds = new Set();
                
                Object.entries(mappingEquivalents).forEach(([format, tasks]) => {
                    if (format.includes('intermediate')) {
                        tasks.forEach(({ task }) => {
                            // Use extractors for gateway detection
                            if (CPEENodeExtractor.isGatewayType(task.type) || MermaidNodeExtractor.isGatewayId(task.id)) {
                                mappingMermaidIds.add(task.id);
                            }
                        });
                    }
                });
                
                // Check if this mapping gateway matches our target (same Mermaid IDs)
                const targetIdsArray = Array.from(targetMermaidIds).sort();
                const mappingIdsArray = Array.from(mappingMermaidIds).sort();
                const idsMatch = targetIdsArray.length === mappingIdsArray.length &&
                                targetIdsArray.length > 0 &&
                                targetIdsArray.every((id, idx) => id === mappingIdsArray[idx]);
                
                if (idsMatch) {
                    console.log('[CrossGraphHighlight] ✓ MATCHED gateway by Mermaid mapping (fallback):', {
                        elementId: elementId,
                        svgIndex: i,
                        mappingGatewayId: mappingGateway.id,
                        mappingGatewayAltId: mappingGateway.altId,
                        targetId: targetId,
                        mermaidIds: targetIdsArray
                    });
                    return svgGateway;
                }
            }
        }
        
        console.log('[CrossGraphHighlight] No match found by index alignment or Mermaid mapping');
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
    }

    /**
     * Clear highlights when navigating to a different step
     */
    onStepChanged() {
        this.clearAllHighlights();
        this.activeTaskId = null;
        this.activeSourceFormat = null;
        this.activeSourceSection = null;
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
            return;
        }
        
        const sectionIds = Object.keys(this.sections);
        sectionIds.forEach(sectionId => {
            const container = this.domRegistry.getElementSafe(`${sectionId}-graph-container`);
            if (container) {
                this.sections[sectionId] = container;
            } else {
                this.sections[sectionId] = null;
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
                this.clearActiveState();
            }
            // If click is outside visual content boxes, do nothing (don't clear highlights)
        };
        
        // Attach listener to document (capture phase to catch all clicks)
        document.addEventListener('click', this.clickOutsideHandler, true);
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
            
            // Check for CPEE element groups with element-id attribute (tasks and gateways)
            if (element.tagName === 'g' || element.tagName === 'G') {
                const elementId = element.getAttribute('element-id');
                const elementType = element.getAttribute('element-type');
                // If it has element-id or element-type, it's a CPEE task or gateway element
                if (elementId || elementType) {
                    return true;
                }
            }
            
            // Check for Mermaid node elements (tasks and gateways)
            try {
                if (element.classList) {
                    const classList = element.classList;
                    // Mermaid nodes have class "node" (includes tasks and gateways)
                    if (classList.contains('node')) {
                        return true;
                    }
                    // CPEE elements have class "element" (tasks)
                    if (classList.contains('element') && element.getAttribute('element-id')) {
                        return true;
                    }
                    // CPEE gateways have class "choose" or "parallel"
                    if ((classList.contains('choose') || classList.contains('parallel')) && element.getAttribute('element-id')) {
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
    }
}
