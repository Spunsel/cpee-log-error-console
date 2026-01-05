    /**
     * Cross-Graph Highlight Coordinator
     * Coordinates task and gateway highlighting across all 4 content sections (cross-graph coordination)
     * Responsibilities:
     * - Track rendered SVG containers in all sections
     * - Handle task and gateway click events and propagate highlights across graphs
     * - Coordinate with HighlightingService and TaskMapping (from CPEEStep)
     * - Manage Graph View vs other view modes (only highlight in Graph View)
     * - Implement state persistence across step navigation
     */

import { SVGClickDetector } from '../../utils/interaction/SVGClickDetector.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { MermaidNodeExtractor } from '../../utils/extraction/MermaidNodeExtractor.js';
import { CPEENodeExtractor } from '../../utils/extraction/CPEETNodeExtractor.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

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
        
        // Event bus for trace highlight events
        this.eventBus = defaultEventBus;
        
        // Initialize click outside handler
        this.initializeClickOutsideHandler();
        
        // Setup trace highlight event listeners
        this.setupTraceHighlightListeners();
    }

    /**
     * Setup event listeners for trace highlighting
     * Listens for trace:highlight:task events from TraceContentRenderer
     * Uses the pre-existing task mapping for cross-graph highlighting
     */
    setupTraceHighlightListeners() {
        // Listen for trace task highlight requests
        this.eventBus.on('trace:highlight:task', (data) => {
            const { taskId, altId, sourceFormat, sectionId } = data;
            if (!sourceFormat || !sectionId) {
                return;
            }
            
            console.log('[CrossGraphHighlight] Received trace highlight request:', data);
            
            // Set flag to indicate this is a trace highlight
            this.isTraceHighlight = true;
            
            // Try to find the task in the pre-existing mapping using task.id first
            if (taskId && this.currentStepMapping) {
                const task = this.currentStepMapping.getTask(taskId, sourceFormat);
                if (task) {
                    console.log('[CrossGraphHighlight] Found task in mapping by id:', taskId);
                    this.onTaskClicked(taskId, sourceFormat, sectionId);
                    return;
                }
            }
            
            // Special handling for input-intermediate (Mermaid) traces:
            // Match trace alt_id to CPEE task id (not alt_id) for input-cpee sections
            if (altId && this.currentStepMapping && sourceFormat === 'input-intermediate') {
                // Search for CPEE task in input-cpee where task.id matches the trace alt_id
                const cpeeTaskIds = this.currentStepMapping.getTasksInFormat('input-cpee');
                for (const cpeeId of cpeeTaskIds) {
                    const cpeeTask = this.currentStepMapping.getTask(cpeeId, 'input-cpee');
                    if (cpeeTask && cpeeTask.id === altId) {
                        console.log('[CrossGraphHighlight] Found input-cpee task by id (from trace alt_id):', altId, '-> CPEE id:', cpeeId);
                        // Use the CPEE task id for highlighting, but keep original source format for mapping
                        this.onTaskClicked(cpeeId, sourceFormat, sectionId);
                        return;
                    }
                }
            }
            
            // Fallback: try with altId if primary lookup failed (for non-input-intermediate sources)
            if (altId && this.currentStepMapping) {
                // Search for task by altId in the mapping
                const taskIds = this.currentStepMapping.getTasksInFormat(sourceFormat);
                for (const id of taskIds) {
                    const task = this.currentStepMapping.getTask(id, sourceFormat);
                    if (task && task.altId === altId) {
                        console.log('[CrossGraphHighlight] Found task in mapping by altId:', altId, '-> id:', id);
                        this.onTaskClicked(id, sourceFormat, sectionId);
                        return;
                    }
                }
            }
            
            // Last resort: use whatever ID we have
            const fallbackId = taskId || altId;
            if (fallbackId) {
                console.log('[CrossGraphHighlight] Using fallback highlight with:', fallbackId);
                this.onTaskClicked(fallbackId, sourceFormat, sectionId);
            }
        });
        
        // Listen for trace highlight clear requests
        this.eventBus.on('trace:highlight:clear', () => {
            console.log('[CrossGraphHighlight] Received trace highlight clear request');
            // Don't emit event since TraceContentRenderer initiated the clear
            // Clear trace highlight tracking when explicitly clearing
            this.clearAllHighlights(false, true);
        });
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
        
        // Clear trace highlight flag after highlighting is complete
        // This ensures normal clicks don't accidentally use stale trace highlight data
        this.isTraceHighlight = false;
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
        
        // Find gateway in mapping by this altId (using NodeMapping's method)
        const gateway = this.currentStepMapping.findGatewayByAltId(altId, sectionId, CPEENodeExtractor.isGatewayType);
        if (gateway) {
            return gateway;
        }
        
        // If not in mapping, create a basic gateway object from the SVG
        const parsed = CPEENodeExtractor.parseCPEEGatewayElementId(elementId);
        return {
            id: altId,
            altId: altId,
            type: parsed?.type || 'gateway'
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
            } else if (taskObject) {
                // Use task.id for DOM element lookup (altId is only for cross-format matching)
                highlightTaskId = taskObject.id || mappedTaskId;
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
                // For output-cpee: ONLY match by altId, never by id
                // This is because CPEE internal IDs (a1, a3, a7) don't correspond to Mermaid task IDs
                // The alt_id attribute is what maps to Mermaid task identifiers
                let matches;
                if (format === 'output-cpee') {
                    // For CPEE output, only match by altId
                    matches = task.altId === baseTaskId;
                } else {
                    // For other formats, match by id or altId
                    matches = task.id === baseTaskId || 
                             task.altId === baseTaskId ||
                             taskId === baseTaskId;
                }
                
                if (matches) {
                    const targetSectionId = format; // Format and section ID are the same
                    // For CPEE: use task.id (internal XML id like 'a7') because SVG elements use that id
                    // NOT task.altId (like 'a3') which is just a semantic mapping attribute
                    // For Mermaid: use fullId or id
                    const highlightId = format.includes('cpee') ? task.id : 
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
            
            // Find gateway with matching alt_id in this section's mapping (using NodeMapping's method)
            let targetGateway = this.currentStepMapping.findGatewayByAltId(altId, targetSection, CPEENodeExtractor.isGatewayType);
            
            if (!targetGateway) {
                // For gw naming convention (gw1s/gw1e): try paired gateway
                // CPEE only has one element for start+end (e.g., gw1s represents both gw1s and gw1e)
                // NOTE: This does NOT apply to numeric IDs (1, 4) - they are separate gateways
                if (isCPEESection && MermaidNodeExtractor.usesGwNamingConvention(altId)) {
                    const pairedId = MermaidNodeExtractor.getPairedGatewayId(altId);
                    if (pairedId && pairedId !== altId) {
                        targetGateway = this.currentStepMapping.findGatewayByAltId(pairedId, targetSection, CPEENodeExtractor.isGatewayType);
                        if (targetGateway) {
                            console.log('[CrossGraphHighlight] Found paired gateway in CPEE (gw pattern):', {
                                originalAltId: altId,
                                pairedAltId: pairedId,
                                foundGateway: targetGateway.id
                            });
                        }
                    }
                }
                
                if (!targetGateway) {
                    // Gateway not found - highlight source if this is source section
                    if (isSource && isMermaidSection) {
                        console.log('[CrossGraphHighlight] Gateway not in mapping, highlighting source directly:', originalTaskId);
                        this.highlightInSection(targetSection, originalTaskId, true, null);
                        
                        // For gw naming convention, also highlight the paired gateway (start/end)
                        if (MermaidNodeExtractor.usesGwNamingConvention(altId)) {
                            const pairedGatewayId = MermaidNodeExtractor.getPairedGatewayId(altId);
                            if (pairedGatewayId && pairedGatewayId !== altId) {
                                console.log('[CrossGraphHighlight] Also highlighting paired Mermaid gateway:', pairedGatewayId);
                                this.highlightInSection(targetSection, pairedGatewayId, true, null);
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
                
                // For gw naming convention (gw1s/gw1e), also highlight the paired gateway
                // NOTE: This does NOT apply to numeric IDs - they are separate gateways
                if (isMermaidSection && targetGateway.id && MermaidNodeExtractor.usesGwNamingConvention(targetGateway.id)) {
                    const pairedGatewayId = MermaidNodeExtractor.getPairedGatewayId(targetGateway.id);
                    if (pairedGatewayId && pairedGatewayId !== targetGateway.id) {
                        console.log('[CrossGraphHighlight] Also highlighting paired Mermaid gateway (gw pattern):', pairedGatewayId);
                        this.highlightInSection(targetSection, pairedGatewayId, isSource, null);
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
        
        // Options for findTaskInSVG with extractor functions
        const findOptions = {
            findSvgElementByAltId: CPEENodeExtractor.findSvgElementByAltId,
            isCPEEGatewayElementId: CPEENodeExtractor.isCPEEGatewayElementId,
            usesGwNamingConvention: MermaidNodeExtractor.usesGwNamingConvention,
            getPairedGatewayId: MermaidNodeExtractor.getPairedGatewayId
        };
        
        // Find the task element using standard finding logic
        let taskElement = this.highlightingService.findTaskInSVG(container, taskId, findOptions);
        
        // Fallback: try altId if we have a task object
        if (!taskElement && taskObject && taskObject.altId && sectionId.includes('cpee')) {
            taskElement = this.highlightingService.findTaskInSVG(container, taskObject.altId, findOptions);
        }
        
        // Fallback: try id if different from taskId
        if (!taskElement && taskObject && taskObject.id && taskId !== taskObject.id) {
            taskElement = this.highlightingService.findTaskInSVG(container, taskObject.id, findOptions);
        }
        
        if (!taskElement) {
            console.warn('[CrossGraphHighlight] element not found in section', { sectionId, triedId: taskId });
            return;
        }
        
        // Apply appropriate highlighting based on section type
        this.applySectionHighlight(sectionId, taskElement, isActive);
        
        // Track this highlight
        this.trackHighlight(sectionId, taskId);
        
        // For CPEE sections: highlight all other elements with the same alt_id (e.g., duplicates in loops)
        // This applies to both normal clicks and trace highlights
        if (sectionId.includes('cpee')) {
            this.highlightAllDuplicateCPEEElements(container, taskElement, isActive);
        }
    }

    /**
     * Highlight all CPEE elements that have the same element-alt_id as the given element
     * Used for normal clicks to highlight duplicate tasks (e.g., same task appearing in loops)
     * @param {HTMLElement} container - SVG container
     * @param {HTMLElement} primaryElement - The primary element that was already highlighted
     * @param {boolean} isActive - Whether this is the active (clicked) highlight
     */
    highlightAllDuplicateCPEEElements(container, primaryElement, isActive) {
        if (!container || !primaryElement) {
            return;
        }
        
        // Get the alt_id from the primary element
        const altId = primaryElement.getAttribute('element-alt_id');
        if (!altId) {
            return;
        }
        
        // Find all elements with the same element-alt_id
        const allElements = container.querySelectorAll(`[element-alt_id="${CSS.escape(altId)}"]`);
        
        if (allElements.length <= 1) {
            return; // No duplicates to highlight
        }
        
        console.log('[CrossGraphHighlight] Highlighting duplicate CPEE elements:', {
            altId,
            totalCount: allElements.length
        });
        
        // Highlight all elements except the primary one (which is already highlighted)
        allElements.forEach(el => {
            if (el !== primaryElement) {
                // Find the parent g.element if this is a nested element
                const elementGroup = el.closest('g.element') || el;
                if (elementGroup !== primaryElement) {
                    this.applySectionHighlight(container.id, elementGroup, isActive);
                }
            }
        });
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
     * @param {boolean} emitEvent - Whether to emit event to notify TraceContentRenderer (default: true)
     * @param {boolean} clearTraceOccurrence - Whether to clear trace occurrence tracking (default: false)
     */
    clearAllHighlights(emitEvent = true, clearTraceOccurrence = false) {
        this.highlightingService.clearAllHighlights();
        this.highlightedTasks.clear();
        
        // Only clear trace highlight tracking when explicitly requested
        // (e.g., when trace highlight is cleared, not when switching between tasks)
        if (clearTraceOccurrence) {
            this.isTraceHighlight = false;
        }
        
        // Emit event to notify TraceContentRenderer to clear trace row highlights
        if (emitEvent && this.eventBus) {
            this.eventBus.emit('crossGraph:highlightsCleared');
        }
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
     * Initialize click outside handler to clear highlights when clicking inside content boxes of Graph View
     */
    initializeClickOutsideHandler() {
        // Create a view mode getter function for SVGClickDetector
        const getViewMode = (sectionId) => {
            const viewModes = this.stateManager.getState('viewModes');
            return viewModes?.[sectionId] || 'visual';
        };
        
        this.clickOutsideHandler = (event) => {
            // Check if there are any active highlights
            if (!this.hasActiveHighlights()) {
                return;
            }
            
            // Check if click is on an actual graph element (task, node, etc.)
            // If click is on a graph element, do nothing (let task click handler process it)
            const clickTarget = event.target;
            if (this.clickDetector.isClickOnGraphElement(clickTarget)) {
                return;
            }
            
            // Check if click is inside a content-box of a Graph View section
            if (this.clickDetector.isClickInsideVisualContentBox(clickTarget, getViewMode)) {
                // Click is inside a Graph View content-box but not on a graph element
                this.clearActiveState();
            }
            // If click is outside visual content boxes, do nothing (don't clear highlights)
        };
        
        // Attach listener to document (capture phase to catch all clicks)
        document.addEventListener('click', this.clickOutsideHandler, true);
    }

    /**
     * Check if there are active highlights
     * @returns {boolean} True if there are active highlights
     */
    hasActiveHighlights() {
        return this.activeTaskId !== null || this.highlightedTasks.size > 0;
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

