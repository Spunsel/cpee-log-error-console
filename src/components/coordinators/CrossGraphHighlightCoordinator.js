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
     * Uses direct element-alt_id lookup from the SVG element (presetaltid theme)
     * 
     * @param {string} elementId - CPEE element-id like "choose_1", "parallel_0", "loop_0"
     * @param {string} sectionId - Section ID ('input-cpee' or 'output-cpee')
     * @returns {Object|null} Gateway object from mapping with id and altId, or null
     */
    resolveCPEEGatewayElementId(elementId, sectionId) {
        if (!this.currentStepMapping) {
            return null;
        }
        
        const container = this.sections[sectionId];
        if (!container) {
            return null;
        }
        
        // Direct element-alt_id lookup from clicked SVG element
        const clickedElement = container.querySelector(`g[element-id="${CSS.escape(elementId)}"]`);
        if (!clickedElement) {
            console.log('[CrossGraphHighlight] ✗ Element not found:', elementId);
            return null;
        }
        
        // Extract element-alt_id from the element or its parent group ("Übergruppe")
        const altId = CPEENodeExtractor.extractAltIdFromSvgElement(clickedElement);
        if (!altId) {
            console.log('[CrossGraphHighlight] ✗ No element-alt_id found on gateway:', elementId);
            return null;
        }
        
        console.log('[CrossGraphHighlight] ✓ Direct element-alt_id found:', { elementId, altId });
        
        // Find gateway in mapping by this altId
        const gateway = this.findGatewayByAltIdInSection(altId, sectionId);
        if (gateway) {
            return gateway;
        }
        
        // If not in mapping, create a basic gateway object from the SVG
        const gatewayType = this.getGatewayTypeFromElementId(elementId);
        return {
            id: altId,
            altId: altId,
            type: gatewayType || 'gateway'
        };
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
        // Track which sections have been highlighted
        const highlightedSections = new Set();
        
        taskOnlyEquivalents.forEach(({ taskId: mappedTaskId, format: mappedFormat, task: taskObject }) => {
            const mappedSectionId = mappedFormat; // Format and section ID are the same
            const isActive = (mappedFormat === sourceFormat);
            
            let highlightTaskId = mappedTaskId;
            
            if (taskObject && taskObject.metadata && taskObject.metadata.fullId) {
                highlightTaskId = taskObject.metadata.fullId;
            } else if (mappedFormat.includes('cpee') && taskObject) {
                highlightTaskId = taskObject.altId || taskObject.id || mappedTaskId;
            }
            
            console.log('[CrossGraphHighlight] mapping -> highlightInSection', { mappedSectionId, highlightTaskId, isActive, type: taskObject?.type });
            this.highlightInSection(mappedSectionId, highlightTaskId, isActive, taskObject);
            highlightedSections.add(mappedSectionId);
        });
        
        // Also highlight the source task using original ID
        this.highlightInSection(sectionId, originalTaskId, true, sourceGatewayObject);
        highlightedSections.add(sectionId);
        
        // Fallback: ensure paired CPEE section is checked if missing from equivalents
        // (e.g., if clicking in output-intermediate, also try output-cpee)
        const allSections = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        for (const targetSection of allSections) {
            if (highlightedSections.has(targetSection)) {
                continue; // Already highlighted
            }
            
            // Try to find task by baseTaskId in this section
            const task = this.currentStepMapping?.getTask(baseTaskId, targetSection);
            if (task) {
                const isCpee = targetSection.includes('cpee');
                const highlightId = isCpee ? (task.altId || task.id || baseTaskId) : (task.metadata?.fullId || task.id || baseTaskId);
                console.log('[CrossGraphHighlight] Fallback highlight in', targetSection, ':', highlightId);
                this.highlightInSection(targetSection, highlightId, false, task);
            }
        }
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
                    const targetSectionId = format; // Format and section ID are the same
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
            let targetGateway = this.findGatewayByAltIdInSection(altId, targetSection);
            
            if (!targetGateway) {
                // Special case: Mermaid has 2 parallel gateways (fork/join), CPEE has 1
                // If this is a parallel gateway click and we can't find it by alt_id,
                // try to find any parallel gateway in this section
                const isParallelGateway = originalTaskId && originalTaskId.includes(':parallelgateway:');
                
                if (isParallelGateway && isCPEESection) {
                    const parallelGateways = this.getGatewaysOfTypeInSection(targetSection, 'parallel');
                    if (parallelGateways.length > 0) {
                        // Use the first parallel gateway found - in CPEE, there's usually just one
                        // that represents the entire parallel construct
                        targetGateway = parallelGateways[0];
                        console.log('[CrossGraphHighlight] Mermaid parallel join -> CPEE parallel:', {
                            mermaidAltId: altId,
                            cpeeGateway: targetGateway.id
                        });
                    }
                }
                
                if (!targetGateway) {
                    // For CPEE sections: try paired gateway if this is an end gateway (gwXe → gwXs)
                    // CPEE only has one element for the entire gateway (no separate start/end)
                    if (isCPEESection && MermaidNodeExtractor.usesGwNamingConvention(altId)) {
                        const pairedId = MermaidNodeExtractor.getPairedGatewayId(altId);
                        if (pairedId && pairedId !== altId) {
                            targetGateway = this.findGatewayByAltIdInSection(pairedId, targetSection);
                            if (targetGateway) {
                                console.log('[CrossGraphHighlight] Found paired gateway in CPEE:', {
                                    originalAltId: altId,
                                    pairedAltId: pairedId,
                                    foundGateway: targetGateway.id
                                });
                            }
                        }
                    }
                }
                
                if (!targetGateway) {
                    // Even if gateway not in mapping, highlight source directly if this is source section
                    if (isSource && isMermaidSection) {
                        console.log('[CrossGraphHighlight] Gateway not in mapping, highlighting source directly:', originalTaskId);
                        this.highlightInSection(targetSection, originalTaskId, true, null);
                        
                        // For parallel gateways, also highlight all other parallels in this section
                        const isParallelClick = originalTaskId && originalTaskId.includes(':parallelgateway:');
                        if (isParallelClick) {
                            const allParallels = this.getGatewaysOfTypeInSection(targetSection, 'parallel');
                            for (const pg of allParallels) {
                                if (pg.id !== altId) {
                                    console.log('[CrossGraphHighlight] Also highlighting parallel gateway:', pg.id);
                                    this.highlightInSection(targetSection, pg.id, true, pg);
                                }
                            }
                        }
                    } else {
                        console.log('[CrossGraphHighlight] No gateway with alt_id', altId, 'found in section:', targetSection);
                    }
                    continue;
                }
            }
            
            console.log('[CrossGraphHighlight] Highlighting gateway in', targetSection, ':', {
                altId: altId,
                id: targetGateway.id,
                gatewayAltId: targetGateway.altId,
                isSource: isSource
            });
            
            // For CPEE sections, use direct element-alt_id lookup (presetaltid theme)
            if (isCPEESection) {
                // Direct element-alt_id lookup
                let gatewayElement = CPEENodeExtractor.findSvgElementByAltId(container, altId);
                
                // For Mermaid end gateways (gw1e), CPEE only has one element (gw1s)
                if (!gatewayElement && MermaidNodeExtractor.isEndGateway(altId)) {
                    const startId = MermaidNodeExtractor.getPairedGatewayId(altId);
                    if (startId) {
                        gatewayElement = CPEENodeExtractor.findSvgElementByAltId(container, startId);
                        if (gatewayElement) {
                            console.log('[CrossGraphHighlight] Found CPEE gateway via paired start ID:', startId);
                        }
                    }
                }
                
                // Also try the gateway's altId from the mapping if different from the resolved altId
                if (!gatewayElement && targetGateway.altId && targetGateway.altId !== altId) {
                    gatewayElement = CPEENodeExtractor.findSvgElementByAltId(container, targetGateway.altId);
                }
                
                if (gatewayElement) {
                    const elementId = gatewayElement.getAttribute('element-id');
                    console.log('[CrossGraphHighlight] ✓ Direct element-alt_id lookup successful:', {
                        altId,
                        elementId,
                        gatewayId: targetGateway.id
                    });
                    this.highlightInSection(targetSection, elementId || altId, isSource, targetGateway);
                } else {
                    console.warn('[CrossGraphHighlight] ✗ Gateway not found in CPEE SVG:', altId);
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
                }
                
                // For parallel gateways with numeric IDs, highlight ALL parallel gateways (fork + join)
                const isParallelGatewayClick = originalTaskId && originalTaskId.includes(':parallelgateway:');
                if (isParallelGatewayClick && !MermaidNodeExtractor.usesGwNamingConvention(targetGateway.id)) {
                    const allMermaidParallels = this.getGatewaysOfTypeInSection(targetSection, 'parallel');
                    for (const mermaidGateway of allMermaidParallels) {
                        if (mermaidGateway.id !== targetGateway.id) {
                            console.log('[CrossGraphHighlight] Also highlighting Mermaid parallel:', mermaidGateway.id);
                            this.highlightInSection(targetSection, mermaidGateway.id, isSource, mermaidGateway);
                        }
                    }
                } else {
                    // Keep existing CPEE source logic for parallel highlighting
                    const isCPEESource = sectionId && sectionId.includes('cpee');
                    const gatewayType = this.getGatewayTypeFromTask(sourceGatewayObject || targetGateway);
                    
                    if (isCPEESource && gatewayType === 'parallel') {
                        const allMermaidParallels = this.getGatewaysOfTypeInSection(targetSection, 'parallel');
                        for (const mermaidGateway of allMermaidParallels) {
                            if (mermaidGateway.id !== targetGateway.id) {
                                console.log('[CrossGraphHighlight] Also highlighting Mermaid parallel (from CPEE):', mermaidGateway.id);
                                this.highlightInSection(targetSection, mermaidGateway.id, false, mermaidGateway);
                            }
                        }
                    }
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
     * Get the gateway type (choose, parallel, loop) from a CPEE element-id
     * @param {string} elementId - CPEE element-id like "choose_1", "parallel_0", "loop_0"
     * @returns {string|null} Gateway type or null
     */
    getGatewayTypeFromElementId(elementId) {
        if (!elementId) {
            return null;
        }
        
        if (elementId.startsWith('choose_')) {
            return 'choose';
        }
        if (elementId.startsWith('parallel_') && !elementId.startsWith('parallel_branch_')) {
            return 'parallel';
        }
        if (elementId.startsWith('loop_')) {
            return 'loop';
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
        
        // Fallback: try altId if we have a task object
        if (!taskElement && taskObject && taskObject.altId && sectionId.includes('cpee')) {
            taskElement = this.findTaskInSVG(container, taskObject.altId);
        }
        
        // Fallback: try id if different from taskId
        if (!taskElement && taskObject && taskObject.id && taskId !== taskObject.id) {
            taskElement = this.findTaskInSVG(container, taskObject.id);
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
        // NEW: For CPEE sections, try direct element-alt_id lookup first
        // This is the preferred method when using presetaltid theme which adds
        // element-alt_id attributes directly to gateway SVG elements
        if (container.id && container.id.includes('cpee')) {
            // Try direct alt_id lookup on gateway elements
            const gatewayByAltId = CPEENodeExtractor.findSvgElementByAltId(container, taskId);
            if (gatewayByAltId) {
                console.log('[CrossGraphHighlight] ✓ Found element by direct element-alt_id:', taskId);
                return gatewayByAltId;
            }
            
            // For gw pattern IDs (gw1s, gw1e), also check the paired gateway
            // CPEE has one element for both start/end, Mermaid has separate elements
            if (MermaidNodeExtractor.usesGwNamingConvention(taskId)) {
                const pairedId = MermaidNodeExtractor.getPairedGatewayId(taskId);
                if (pairedId) {
                    const pairedGateway = CPEENodeExtractor.findSvgElementByAltId(container, pairedId);
                    if (pairedGateway) {
                        console.log('[CrossGraphHighlight] ✓ Found element by paired gateway element-alt_id:', pairedId);
                        return pairedGateway;
                    }
                }
            }
        }
        
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
