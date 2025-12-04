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
     * Sorts SVG gateways by nesting depth to match mapping order (XML document order)
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
        
        console.log('[CrossGraphHighlight] Resolving CPEE gateway element-id:', {
            elementId: elementId,
            sectionId: sectionId,
            gatewayType: gatewayType
        });
        
        // Get all gateways of this type from the mapping for this section
        const mappingGateways = this.getGatewaysOfTypeInSection(sectionId, gatewayType);
        
        console.log('[CrossGraphHighlight] CPEE gateways in mapping order:', mappingGateways.map(g => ({ id: g.id, altId: g.altId })));
        
        if (mappingGateways.length === 0) {
            return null;
        }
        
        // Get all SVG gateways
        const container = this.sections[sectionId];
        if (!container) {
            return null;
        }
        
        const svgGatewaysNodeList = container.querySelectorAll(
            `g.element.complex[element-id^="${gatewayType}_"]`
        );
        
        const svgGatewaysArray = Array.from(svgGatewaysNodeList);
        let svgGatewaysSorted = svgGatewaysArray.map(el => el.getAttribute('element-id'));
        
        // Determine if we should reverse based on gateway type and nesting
        // - For LOOPS: Never reverse
        // - For CHOOSE/PARALLEL: Only reverse if gateways are NESTED (use metadata)
        let shouldReverse = false;
        
        if (gatewayType !== 'loop') {
            const areNested = this.areGatewaysNested(mappingGateways);
            shouldReverse = areNested;
            
            if (areNested) {
                svgGatewaysSorted = svgGatewaysSorted.reverse();
            }
        }
        
        // Find the position of the clicked element-id in the sorted list
        const sortedIndex = svgGatewaysSorted.indexOf(elementId);
        
        console.log('[CrossGraphHighlight] SVG gateways:', {
            sorted: svgGatewaysSorted,
            clickedElementId: elementId,
            sortedIndex: sortedIndex,
            gatewayType: gatewayType,
            reversed: shouldReverse,
            nested: shouldReverse
        });
        
        if (sortedIndex >= 0 && sortedIndex < mappingGateways.length) {
            const gateway = mappingGateways[sortedIndex];
            console.log('[CrossGraphHighlight] ✓ Resolved CPEE gateway element-id to mapping gateway:', {
                elementId: elementId,
                sortedIndex: sortedIndex,
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
     * Dedicated gateway highlighting using alt_id-based matching across all 4 sections
     * Matches gateways by their semantic alt_id, then finds the corresponding SVG element
     * @param {string} baseTaskId - Base gateway ID (e.g., 'gw1s', '3')
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Source section identifier
     * @param {string} originalTaskId - Original task identifier (element-id for CPEE)
     * @param {Object|null} sourceGatewayObject - Resolved gateway object for CPEE gateways
     */
    highlightGatewaysAcrossAllSections(baseTaskId, sourceFormat, sectionId, originalTaskId, sourceGatewayObject) {
        console.log('[CrossGraphHighlight] highlightGatewaysAcrossAllSections', { baseTaskId, sourceFormat, sectionId, originalTaskId });
        
        // Step 1: Determine the alt_id of the clicked gateway
        const altId = this.resolveGatewayAltId(baseTaskId, sourceFormat, sectionId, sourceGatewayObject);
        console.log('[CrossGraphHighlight] Resolved gateway alt_id:', altId);
        
        if (!altId) {
            console.warn('[CrossGraphHighlight] Could not determine gateway alt_id, falling back to source only');
            this.highlightInSection(sectionId, originalTaskId, true, sourceGatewayObject);
            return;
        }
        
        // Step 2: For each section, find and highlight the gateway with this alt_id
        const allSections = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        for (const targetSection of allSections) {
            const isSource = (targetSection === sectionId);
            const container = this.sections[targetSection];
            const isMermaidSection = targetSection.includes('intermediate');
            const isCPEESection = targetSection.includes('cpee');
            
            if (!container) {
                console.log('[CrossGraphHighlight] No container for section:', targetSection);
                continue;
            }
            
            // Find gateway with matching alt_id in this section's mapping
            const targetGateway = this.findGatewayByAltIdInSection(altId, targetSection);
            
            if (!targetGateway) {
                console.log('[CrossGraphHighlight] No gateway with alt_id', altId, 'found in section:', targetSection);
                continue;
            }
            
            console.log('[CrossGraphHighlight] Highlighting gateway in', targetSection, ':', {
                altId: altId,
                id: targetGateway.id,
                gatewayAltId: targetGateway.altId,
                isSource: isSource
            });
            
            // For CPEE sections, find the SVG element-id (choose_N, parallel_N, loop_N)
            if (isCPEESection) {
                const svgElementId = this.findCPEESvgElementIdForGateway(targetSection, targetGateway);
                if (svgElementId) {
                    console.log('[CrossGraphHighlight] Found CPEE SVG element-id:', svgElementId, 'for gateway:', targetGateway.id);
                    this.highlightInSection(targetSection, svgElementId, isSource, targetGateway);
                } else {
                    console.warn('[CrossGraphHighlight] Could not find SVG element-id for gateway:', targetGateway.id);
                    // Try fallback with altId or id
                    this.highlightInSection(targetSection, targetGateway.altId || targetGateway.id, isSource, targetGateway);
                }
            } else {
                // For Mermaid sections, use the gateway ID directly
                if (isSource) {
                    this.highlightInSection(targetSection, originalTaskId, true, sourceGatewayObject || targetGateway);
                } else {
                    this.highlightInSection(targetSection, targetGateway.id, false, targetGateway);
                }
                
                // For Mermaid sections with gw pattern, also highlight the paired gateway (start/end)
                if (isMermaidSection && targetGateway.id) {
                    if (MermaidNodeExtractor.usesGwNamingConvention(targetGateway.id)) {
                        const pairedGatewayId = MermaidNodeExtractor.getPairedGatewayId(targetGateway.id);
                        if (pairedGatewayId && pairedGatewayId !== targetGateway.id) {
                            console.log('[CrossGraphHighlight] Also highlighting paired Mermaid gateway:', pairedGatewayId);
                            this.highlightInSection(targetSection, pairedGatewayId, isSource, null);
                        }
                    }
                    // For numeric IDs (1, 4, etc.), only highlight the single gateway - no pairing
                }
            }
        }
    }
    
    /**
     * Resolve the alt_id for a gateway from any format
     * @param {string} baseTaskId - Base gateway ID
     * @param {string} sourceFormat - Source format
     * @param {string} sectionId - Section ID
     * @param {Object|null} gatewayObject - Gateway object (for CPEE gateways)
     * @returns {string|null} The alt_id for this gateway
     */
    resolveGatewayAltId(baseTaskId, sourceFormat, sectionId, gatewayObject) {
        // If we have a gateway object with altId, use it
        if (gatewayObject && gatewayObject.altId) {
            return gatewayObject.altId;
        }
        
        // If we have a gateway object with id, use it as fallback
        if (gatewayObject && gatewayObject.id) {
            return gatewayObject.id;
        }
        
        // For Mermaid sections, the baseTaskId IS the alt_id (e.g., 'gw1s', '3')
        if (sourceFormat.includes('intermediate')) {
            return baseTaskId;
        }
        
        // For CPEE sections with element-id like "choose_0", this should have been resolved earlier
        // via resolveCPEEGatewayElementId before calling this method
        return baseTaskId;
    }
    
    /**
     * Find a gateway by its alt_id in a section's mapping
     * @param {string} altId - The alt_id to search for
     * @param {string} sectionId - Section ID
     * @returns {Object|null} Gateway task object or null
     */
    findGatewayByAltIdInSection(altId, sectionId) {
        if (!this.currentStepMapping) {
            return null;
        }
        
        const taskIds = this.currentStepMapping.getTasksInFormat(sectionId);
        
        for (const taskId of taskIds) {
            const task = this.currentStepMapping.getTask(taskId, sectionId);
            if (task && this.isGatewayTask(task)) {
                // Match by altId or id
                if (task.altId === altId || task.id === altId) {
                    return task;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Find the CPEE SVG element-id (choose_N, parallel_N, loop_N) for a gateway
     * @param {string} sectionId - Section ID ('input-cpee' or 'output-cpee')
     * @param {Object} gatewayTask - Gateway task object from mapping
     * @returns {string|null} SVG element-id or null
     */
    findCPEESvgElementIdForGateway(sectionId, gatewayTask) {
        const container = this.sections[sectionId];
        if (!container) {
            return null;
        }
        
        // Determine gateway type (choose, parallel, loop)
        const gatewayType = this.getGatewayTypeFromTask(gatewayTask);
        if (!gatewayType) {
            console.log('[CrossGraphHighlight] Could not determine gateway type for task:', gatewayTask.id);
            return null;
        }
        
        console.log('[CrossGraphHighlight] Finding SVG element for gateway:', {
            sectionId,
            gatewayId: gatewayTask.id,
            gatewayAltId: gatewayTask.altId,
            gatewayType
        });
        
        // Get all gateways of this type from the mapping (in document order)
        const mappingGateways = this.getGatewaysOfTypeInSection(sectionId, gatewayType);
        
        // Find the index of our target gateway in the mapping
        const targetIndex = mappingGateways.findIndex(g => 
            g.altId === gatewayTask.altId || g.id === gatewayTask.id ||
            g.altId === gatewayTask.id || g.id === gatewayTask.altId
        );
        
        console.log('[CrossGraphHighlight] Gateway position in mapping:', {
            targetIndex,
            totalGatewaysOfType: mappingGateways.length,
            mappingGateways: mappingGateways.map(g => ({ id: g.id, altId: g.altId }))
        });
        
        if (targetIndex < 0) {
            return null;
        }
        
        // Get all SVG gateways of this type
        const svgGatewaysNodeList = container.querySelectorAll(
            `g.element.complex[element-id^="${gatewayType}_"]`
        );
        
        let svgGatewaysSorted = Array.from(svgGatewaysNodeList)
            .map(el => ({ element: el, elementId: el.getAttribute('element-id') }));
        
        // Determine if we should reverse based on gateway type and nesting
        // - For LOOPS: Never reverse - loop numbering follows document order
        // - For CHOOSE/PARALLEL: Only reverse if gateways are NESTED (one inside another)
        //   - Nested gateways: inner rendered first (choose_0), so reverse to match mapping
        //   - Sequential gateways: rendered in document order, no reverse needed
        let shouldReverse = false;
        
        if (gatewayType !== 'loop') {
            // Check if gateways are nested using mapping metadata (nesting depth)
            const areNested = this.areGatewaysNested(mappingGateways);
            shouldReverse = areNested;
            
            if (areNested) {
                svgGatewaysSorted = svgGatewaysSorted.reverse();
                console.log('[CrossGraphHighlight] SVG gateways (NESTED - reversed):', {
                    count: svgGatewaysSorted.length,
                    elementIds: svgGatewaysSorted.map(g => g.elementId)
                });
            } else {
                console.log('[CrossGraphHighlight] SVG gateways (SEQUENTIAL - not reversed):', {
                    count: svgGatewaysSorted.length,
                    elementIds: svgGatewaysSorted.map(g => g.elementId)
                });
            }
        } else {
            console.log('[CrossGraphHighlight] SVG gateways (direct order for loops):', {
                count: svgGatewaysSorted.length,
                elementIds: svgGatewaysSorted.map(g => g.elementId)
            });
        }
        
        // Handle count mismatch (e.g., SVG has loops without alt_id)
        if (svgGatewaysSorted.length !== mappingGateways.length) {
            console.log('[CrossGraphHighlight] Count mismatch - SVG has elements without alt_id:', {
                svgCount: svgGatewaysSorted.length,
                mappingCount: mappingGateways.length
            });
        }
        
        // Use index matching
        if (targetIndex < svgGatewaysSorted.length) {
            const matched = svgGatewaysSorted[targetIndex];
            console.log('[CrossGraphHighlight] Matched gateway by index:', {
                targetIndex,
                elementId: matched.elementId,
                gatewayType,
                reversed: shouldReverse
            });
            return matched.elementId;
        }
        
        return null;
    }
    
    /**
     * Check if any gateway is nested inside another gateway
     * Used to determine if we should reverse the SVG order for index matching
     * 
     * Uses metadata.nestingDepth stored during CPEE XML extraction.
     * Nested gateways have different nesting depths (0, 1, 2, etc.)
     * Sequential gateways have the same nesting depth.
     * 
     * @param {Object[]} mappingGateways - Array of gateway objects from mapping with metadata
     * @returns {boolean} True if any gateway is nested inside another
     */
    areGatewaysNested(mappingGateways) {
        if (!mappingGateways || mappingGateways.length < 2) {
            return false;
        }
        
        // Extract nesting depths from metadata
        const depths = mappingGateways
            .map(g => g.metadata?.nestingDepth)
            .filter(d => d !== undefined && d !== null);
        
        if (depths.length >= 2) {
            // Check if any gateways have different nesting depths
            const uniqueDepths = new Set(depths);
            const areNested = uniqueDepths.size > 1;
            
            console.log('[CrossGraphHighlight] Nesting detection via metadata:', {
                depths: mappingGateways.map(g => ({ 
                    id: g.id, 
                    altId: g.altId, 
                    depth: g.metadata?.nestingDepth 
                })),
                uniqueDepths: Array.from(uniqueDepths),
                areNested
            });
            
            return areNested;
        }
        
        // Fallback: if no metadata, assume not nested (sequential)
        console.log('[CrossGraphHighlight] No nesting metadata available, assuming sequential');
        return false;
    }
    
    /**
     * Check if a task is a gateway
     * @param {Object} task - Task object
     * @returns {boolean} True if it's a gateway
     */
    isGatewayTask(task) {
        if (!task) { return false; }
        return CPEENodeExtractor.isGatewayType(task.type) ||
               MermaidNodeExtractor.isGatewayId(task.id) ||
               task.type === 'gateway' ||
               (task.metadata && task.metadata.tagName && 
                ['choose', 'parallel', 'loop'].includes(task.metadata.tagName)) ||
               (task.metadata && task.metadata.shape === 'diamond');
    }
    
    /**
     * Get the gateway type (choose, parallel, loop) from a task
     * @param {Object} task - Task object
     * @returns {string|null} Gateway type or null
     */
    getGatewayTypeFromTask(task) {
        if (!task) { return null; }
        
        // Check metadata tagName first (most reliable for CPEE)
        if (task.metadata && task.metadata.tagName) {
            const tagName = task.metadata.tagName.toLowerCase();
            if (['choose', 'parallel', 'loop'].includes(tagName)) {
                return tagName;
            }
        }
        
        // Check task type
        if (task.type) {
            const type = task.type.toLowerCase();
            if (type === 'choose' || type.includes('exclusive')) {
                return 'choose';
            }
            if (type === 'parallel') {
                return 'parallel';
            }
            if (type === 'loop') {
                return 'loop';
            }
        }
        
        // For Mermaid gateways, check the full ID for type markers
        if (task.metadata && task.metadata.fullId) {
            if (task.metadata.fullId.includes(':exclusivegateway:')) {
                return 'choose';
            }
            if (task.metadata.fullId.includes(':parallelgateway:')) {
                return 'parallel';
            }
        }
        
        // Default to 'choose' for unknown gateway types (XOR is most common)
        if (this.isGatewayTask(task)) {
            return 'choose';
        }
        
        return null;
    }
    
    /**
     * Get all gateways of a specific type in a section
     * @param {string} sectionId - Section ID
     * @param {string} gatewayType - Gateway type (choose, parallel, loop)
     * @returns {Array} Array of gateway task objects
     */
    getGatewaysOfTypeInSection(sectionId, gatewayType) {
        if (!this.currentStepMapping) {
            return [];
        }
        
        const taskIds = this.currentStepMapping.getTasksInFormat(sectionId);
        const gateways = [];
        
        for (const taskId of taskIds) {
            const task = this.currentStepMapping.getTask(taskId, sectionId);
            if (task && this.isGatewayTask(task)) {
                const taskGatewayType = this.getGatewayTypeFromTask(task);
                if (taskGatewayType === gatewayType) {
                    gateways.push(task);
                }
            }
        }
        
        return gateways;
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
        
        // If still not found in CPEE section and it's a gateway, try to find by alt_id
        // CPEE library generates element-id like "choose_1", "parallel_2" which don't match XML ids
        if (!taskElement && sectionId.includes('cpee') && taskObject) {
            if (CPEENodeExtractor.isGatewayType(taskObject.type) || this.isGatewayTask(taskObject)) {
                console.log('[CrossGraphHighlight] attempt gateway by alt_id mapping', {
                    sectionId: sectionId,
                    taskId: taskId,
                    taskObjectId: taskObject.id,
                    taskObjectAltId: taskObject.altId,
                    taskObjectType: taskObject.type,
                    isInputCpee: sectionId === 'input-cpee'
                });
                
                // Use the new alt_id-based approach to find the SVG element-id
                const svgElementId = this.findCPEESvgElementIdForGateway(sectionId, taskObject);
                if (svgElementId) {
                    taskElement = container.querySelector(`g.element[element-id="${svgElementId}"]`);
                }
                
                if (sectionId === 'input-cpee') {
                    if (taskElement) {
                        console.log('[CrossGraphHighlight] [INPUT-CPEE] ✓ Gateway element found via alt_id:', {
                            elementId: taskElement.getAttribute('element-id'),
                            taskId: taskId,
                            taskObjectAltId: taskObject.altId
                        });
                    } else {
                        console.log('[CrossGraphHighlight] [INPUT-CPEE] ✗ Gateway element NOT found via alt_id');
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
