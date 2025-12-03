    /**
     * Cross-Graph Highlight Coordinator
     * Coordinates task and gateway highlighting across all 4 content sections (cross-graph coordination)
 * 
     * Responsibilities:
     * - Track rendered SVG containers in all sections
     * - Handle task and gateway click events and propagate highlights across graphs
     * - Coordinate with HighlightingService and TaskMapping (from CPEEStep)
     * - Manage visual vs raw view mode (only highlight in visual mode)
     */

import { SVGClickDetector } from '../../utils/interaction/SVGClickDetector.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { MermaidNodeExtractor } from '../../utils/extraction/MermaidNodeExtractor.js';
import { CPEENodeExtractor } from '../../utils/extraction/CPEETNodeExtractor.js';

export class CrossGraphHighlightCoordinator {
    constructor(domRegistry = null, highlightingService = null, stateManager = null) {
        this.domRegistry = domRegistry;
        this.highlightingService = highlightingService;
        this.stateManager = stateManager || defaultStateManager;
        
        this.clickDetector = new SVGClickDetector();
        this.clickListenerCleanups = new Map();
        
        this.sections = {
            'input-cpee': null,
            'input-intermediate': null,
            'output-intermediate': null,
            'output-cpee': null
        };
        
        this.activeTaskId = null;
        this.activeSourceSection = null;
        this.highlightedTasks = new Map();
        this.currentStepMapping = null;
        
        this.clickOutsideHandler = null;
        this.initializeClickOutsideHandler();
    }

    // ============ Section Registration ============
    
    registerSection(sectionId, container) {
        this.sections[sectionId] = container;
    }

    attachCPEEClickHandlers(svgElement, sectionId) {
        this.removeClickHandlers(sectionId);
        
        // Make all task and gateway elements clickable
        svgElement.querySelectorAll('g.element[element-id]').forEach(el => el.classList.add('task-clickable'));
        svgElement.querySelectorAll('g.choose[element-id], g.parallel[element-id]').forEach(el => el.classList.add('task-clickable'));
        
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer) {
                const taskId = taskContainer.getAttribute('element-id');
                if (taskId) {
                    this.onTaskClicked(taskId, sectionId);
                }
            }
        });
        
        this.clickListenerCleanups.set(sectionId, cleanup);
    }

    attachMermaidClickHandlers(svgElement, sectionId) {
        this.removeClickHandlers(sectionId);
        
        svgElement.querySelectorAll('g.node').forEach(el => el.classList.add('task-clickable'));
        
        const cleanup = this.clickDetector.attachClickListener(svgElement, (event, clickedElement, elementPath, taskContainer) => {
            if (taskContainer?.id) {
                this.onTaskClicked(taskContainer.id, sectionId);
            }
        });
        
        this.clickListenerCleanups.set(sectionId, cleanup);
    }

    removeClickHandlers(sectionId) {
        const cleanup = this.clickListenerCleanups.get(sectionId);
        if (cleanup) {
            cleanup();
            this.clickListenerCleanups.delete(sectionId);
        }
    }

    // ============ Click Handling ============
    
    onTaskClicked(taskId, sectionId) {
        console.log('[CrossGraphHighlight] onTaskClicked', { taskId, sectionId });

        // Toggle off if clicking same element
        if (this.activeTaskId === taskId && this.activeSourceSection === sectionId) {
            this.clearActiveState();
            return;
        }
        
        // Resolve CPEE gateway element-id to mapping ID
        let resolvedId = taskId;
        let gatewayObject = null;
        
        if (this.isCPEESection(sectionId) && CPEENodeExtractor.isCPEEGatewayElementId(taskId)) {
            const resolved = this.resolveCPEEGatewayElementId(taskId, sectionId);
            if (resolved) {
                resolvedId = resolved.altId || resolved.id;
                gatewayObject = resolved;
            }
        }
        
        const baseTaskId = this.extractBaseTaskId(resolvedId);
        
        this.activeTaskId = taskId;
        this.activeSourceSection = sectionId;
        
        this.clearAllHighlights();
        this.applyHighlights(baseTaskId, sectionId, taskId, gatewayObject);
    }

    // ============ Highlight Application ============
    
    applyHighlights(baseTaskId, sectionId, originalTaskId, gatewayObject) {
        if (!this.currentStepMapping) {
            this.highlightInSection(sectionId, originalTaskId, true, gatewayObject);
            return;
        }
        
        // Check if this is a gateway click
        const isGateway = this.isGatewayId(baseTaskId) || this.isGateway(gatewayObject);
        
        if (isGateway) {
            this.highlightGatewaysAcrossAllSections(baseTaskId, sectionId, originalTaskId, gatewayObject);
        } else {
            this.highlightTasksAcrossAllSections(baseTaskId, sectionId, originalTaskId);
        }
    }

    highlightTasksAcrossAllSections(baseTaskId, sectionId, originalTaskId) {
        const equivalents = this.findEquivalentTasks(baseTaskId, sectionId);
        
        if (equivalents.length === 0) {
            this.highlightInSection(sectionId, originalTaskId, true);
            return;
        }
        
        equivalents.forEach(({ taskId, format, task }) => {
            const targetSection = format;
            const isSource = (targetSection === sectionId);
            const highlightId = this.isCPEESection(targetSection) ? (task?.altId || task?.id || taskId) : taskId;
            this.highlightInSection(targetSection, highlightId, isSource, task);
        });
        
        // Ensure source is highlighted
        this.highlightInSection(sectionId, originalTaskId, true);
    }

    highlightGatewaysAcrossAllSections(baseTaskId, sectionId, originalTaskId, gatewayObject) {
        const gatewayIndex = this.getGatewayIndex(baseTaskId, sectionId, gatewayObject);
        
        if (gatewayIndex < 0) {
            console.warn('[CrossGraphHighlight] Could not determine gateway index');
            this.highlightInSection(sectionId, originalTaskId, true, gatewayObject);
            return;
        }
        
        const allSections = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        for (const targetSection of allSections) {
            if (!this.sections[targetSection]) {
                continue;
            }
            
            const isSource = (targetSection === sectionId);
            const isMermaid = this.isMermaidSection(targetSection);
            const targetGateway = this.getGatewayAtIndex(targetSection, gatewayIndex);
            
            if (!targetGateway) {
                continue;
            }
            
            if (isSource) {
                this.highlightInSection(targetSection, originalTaskId, true, gatewayObject || targetGateway);
            } else {
                const targetId = targetGateway.altId || targetGateway.id;
                this.highlightInSection(targetSection, targetId, false, targetGateway);
            }
            
            // For Mermaid, also highlight paired gateway (start ↔ end)
            if (isMermaid) {
                const pairedId = MermaidNodeExtractor.getPairedGatewayId(isSource ? originalTaskId : targetGateway.id);
                if (pairedId) {
                    this.highlightInSection(targetSection, pairedId, isSource, null);
                }
            }
        }
    }

    // ============ Element Finding & Highlighting ============
    
    highlightInSection(sectionId, taskId, isActive = false, taskObject = null) {
        const container = this.sections[sectionId];
        if (!container || !this.isSectionInVisualMode(sectionId)) {
            return;
        }
        
        const element = this.findElementInSection(container, taskId, sectionId, taskObject);
        
        if (!element) {
            console.warn('[CrossGraphHighlight] Element not found', { sectionId, taskId });
            return;
        }
        
        this.applyHighlightToElement(sectionId, element, isActive);
        this.highlightedTasks.set(sectionId, (this.highlightedTasks.get(sectionId) || new Set()).add(taskId));
    }

    findElementInSection(container, taskId, sectionId, taskObject) {
        const isCPEE = this.isCPEESection(sectionId);
        
        // For CPEE gateway element-ids (choose_N, parallel_N)
        if (isCPEE && CPEENodeExtractor.isCPEEGatewayElementId(taskId)) {
            return container.querySelector(`g.element.complex[element-id="${CSS.escape(taskId)}"]`) ||
                   container.querySelector(`g.element[element-id="${CSS.escape(taskId)}"]`);
        }
        
        // Try direct element-id match (CPEE)
        if (isCPEE) {
            const byElementId = container.querySelector(`g.element[element-id="${CSS.escape(taskId)}"]`);
            if (byElementId) {
                return byElementId;
            }
            
            // Try altId fallback
            if (taskObject?.altId) {
                const byAltId = container.querySelector(`g.element[element-id="${CSS.escape(taskObject.altId)}"]`);
                if (byAltId) {
                    return byAltId;
                }
            }
            
            // For gateways, use index-based mapping
            if (taskObject && this.isGateway(taskObject)) {
                return this.findCPEEGatewayByMapping(container, taskObject, sectionId);
            }
        }
        
        // For Mermaid, find by node ID
        const nodes = container.querySelectorAll('g.node');
        
        // Exact match
        for (const node of nodes) {
            if (node.id === taskId) {
                return node;
            }
        }
        
        // Pattern match for Mermaid IDs
        const baseId = this.extractBaseTaskId(taskId);
        for (const node of nodes) {
            if (node.id?.includes(baseId)) {
                return node;
            }
        }
        
        return null;
    }

    findCPEEGatewayByMapping(container, taskObject, sectionId) {
        const targetId = taskObject.altId || taskObject.id;
        const gatewayType = taskObject.type === 'choose' || taskObject.metadata?.tagName === 'choose' ? 'choose' : 'parallel';
        
        // Try direct attribute match first
        const allGateways = container.querySelectorAll(`g.element.complex[element-id^="${gatewayType}_"]`);
        for (const gateway of allGateways) {
            for (const attr of gateway.attributes) {
                if (attr.value === targetId) {
                    return gateway;
                }
            }
        }
        
        // Fall back to index alignment
        const svgGateways = this.getSVGGatewaysInOrder(container, gatewayType);
        const mappingGateways = this.getGatewaysOfType(sectionId, gatewayType);
        
        const targetIndex = mappingGateways.findIndex(g => 
            g.id === targetId || g.altId === targetId || 
            g.id === taskObject.id || g.altId === taskObject.altId
        );
        
        if (targetIndex >= 0 && targetIndex < svgGateways.length) {
            return svgGateways[targetIndex];
        }
        
        return null;
    }

    getSVGGatewaysInOrder(container, gatewayType) {
        const allGateways = container.querySelectorAll(`g.element.complex[element-id^="${gatewayType}_"]`);
        const topLevel = [];
        
        for (const gateway of allGateways) {
            // Check if nested inside another gateway of same type
            let isNested = false;
            let parent = gateway.parentElement;
            while (parent && parent !== container) {
                if (parent.classList?.contains('complex') && parent.getAttribute('element-id')?.startsWith(`${gatewayType}_`)) {
                    isNested = true;
                    break;
                }
                parent = parent.parentElement;
            }
            if (!isNested) {
                topLevel.push(gateway);
            }
        }
        
        // Reverse: SVG order is inverted relative to mapping order
        return topLevel.reverse();
    }

    applyHighlightToElement(sectionId, element, isActive) {
        if (this.isCPEESection(sectionId)) {
            const isGateway = element.classList?.contains('choose') || 
                             element.classList?.contains('parallel') || 
                             element.classList?.contains('complex');
            if (isGateway && this.highlightingService.highlightCPEEGateway) {
                this.highlightingService.highlightCPEEGateway(element, isActive);
            } else {
                this.highlightingService.highlightCPEETask(element, isActive);
            }
        } else if (this.isMermaidSection(sectionId)) {
            this.highlightingService.highlightMermaidNode(element, isActive);
        } else {
            this.highlightingService.highlightElements([element], isActive);
        }
    }

    // ============ Gateway Utilities ============
    
    isGateway(task) {
        if (!task) {
            return false;
        }
        return MermaidNodeExtractor.isGateway(task) || CPEENodeExtractor.isGateway(task);
    }

    isGatewayId(id) {
        return id && /^gw\d+/i.test(id);
    }

    getGatewaysFromFormat(format, startOnly = true) {
        if (!this.currentStepMapping) {
            return [];
        }
        
        const taskIds = this.currentStepMapping.getTasksInFormat(format);
        const gateways = [];
        const isMermaid = this.isMermaidSection(format);
        
        for (const taskId of taskIds) {
            const task = this.currentStepMapping.getTask(taskId, format);
            if (task && this.isGateway(task)) {
                if (isMermaid && startOnly) {
                    if (MermaidNodeExtractor.isStartGateway(task.id)) {
                        gateways.push(task);
                    }
                } else {
                    gateways.push(task);
                }
            }
        }
        
        return gateways;
    }

    getGatewaysOfType(format, gatewayType) {
        if (!this.currentStepMapping) {
            return [];
        }
        
        const taskIds = this.currentStepMapping.getTasksInFormat(format);
        const gateways = [];
        
        for (const taskId of taskIds) {
            const task = this.currentStepMapping.getTask(taskId, format);
            if (task && this.isGateway(task)) {
                const matchesType = gatewayType === 'choose' ? 
                    (task.type === 'choose' || task.type === 'gateway' || task.metadata?.tagName === 'choose') :
                    (task.type === 'parallel' || task.type === 'gateway' || task.metadata?.tagName === 'parallel');
                if (matchesType) {
                    gateways.push(task);
                }
            }
        }
        
        return gateways;
    }

    getGatewayIndex(gatewayId, format, gatewayObject) {
        const gateways = this.getGatewaysFromFormat(format, true);
        
        for (let i = 0; i < gateways.length; i++) {
            const g = gateways[i];
            if (g.id === gatewayId || g.altId === gatewayId ||
                (gatewayObject && (g.id === gatewayObject.id || g.altId === gatewayObject.altId))) {
                return i;
            }
        }
        
        // Handle Mermaid END gateways
        if (MermaidNodeExtractor.isEndGateway(gatewayId)) {
            const startId = MermaidNodeExtractor.toStartGatewayId(gatewayId);
            return gateways.findIndex(g => g.id === startId);
        }
        
        return -1;
    }

    getGatewayAtIndex(format, index) {
        if (index < 0) {
            return null;
        }
        const gateways = this.getGatewaysFromFormat(format, true);
        return gateways[index] || null;
    }

    resolveCPEEGatewayElementId(elementId, sectionId) {
        if (!this.currentStepMapping) {
            return null;
        }
        
        const gatewayType = CPEENodeExtractor.extractGatewayType(elementId);
        const svgIndex = CPEENodeExtractor.extractSvgIndex(elementId);
        
        if (!gatewayType || svgIndex < 0) {
            return null;
        }
        
        const mappingGateways = this.getGatewaysOfType(sectionId, gatewayType);
        if (mappingGateways.length === 0) {
            return null;
        }
        
        // SVG gateways are inverted: choose_n → first mapping, choose_0 → last
        const invertedIndex = mappingGateways.length - 1 - svgIndex;
        
        return (invertedIndex >= 0 && invertedIndex < mappingGateways.length) 
            ? mappingGateways[invertedIndex] 
            : null;
    }

    // ============ Task Mapping ============
    
    findEquivalentTasks(taskId, sourceFormat) {
        if (!this.currentStepMapping) {
            return [];
        }
        
        try {
            const equivalents = this.currentStepMapping.findEquivalentTasks(taskId, sourceFormat);
            const result = [];
            
            Object.entries(equivalents).forEach(([format, tasks]) => {
                tasks.forEach(({ task }) => {
                    result.push({ taskId: task.id, format, task });
                });
            });
            
            return result;
        } catch (error) {
            console.error('[CrossGraphHighlight] Error finding equivalents:', error);
            return [];
        }
    }

    extractBaseTaskId(taskId) {
        // Already a base ID if no type markers
        if (!/:(task|exclusivegateway|parallelgateway):/.test(taskId)) {
            return taskId;
        }
        
        // Extract from Mermaid format: flowchart-ID:type:-N or ID:type:
        const patterns = [
            /flowchart-([a-z0-9]+):/i,
            /-([a-z0-9]+):(task|exclusivegateway|parallelgateway):/i,
            /^([a-z0-9]+):(task|exclusivegateway|parallelgateway):/i
        ];
        
        for (const pattern of patterns) {
            const match = taskId.match(pattern);
            if (match?.[1]) {
                return match[1];
            }
        }
        
        return taskId;
    }

    // ============ Section Utilities ============
    
    isCPEESection(sectionId) {
        return sectionId?.includes('cpee');
    }

    isMermaidSection(sectionId) {
        return sectionId?.includes('intermediate');
    }

    isSectionInVisualMode(sectionId) {
        const viewModes = this.stateManager.getState('viewModes');
        return (viewModes?.[sectionId] || 'visual') === 'visual';
    }

    // ============ State Management ============
    
    setCurrentStepMapping(taskMapping) {
        this.currentStepMapping = taskMapping;
    }

    getCurrentStepMapping() {
        return this.currentStepMapping;
    }

    clearActiveState() {
        this.activeTaskId = null;
        this.activeSourceSection = null;
        this.clearAllHighlights();
    }

    clearAllHighlights() {
        this.highlightingService.clearAllHighlights();
        this.highlightedTasks.clear();
    }

    onStepChanged() {
        this.clearActiveState();
    }

    hasActiveHighlights() {
        return this.activeTaskId !== null || this.highlightedTasks.size > 0;
    }

    refreshSections() {
        if (!this.domRegistry) {
            return;
        }
        
        Object.keys(this.sections).forEach(sectionId => {
            const container = this.domRegistry.getElementSafe(`${sectionId}-graph-container`);
            this.sections[sectionId] = container || null;
        });
    }

    // ============ Click Outside Handler ============
    
    initializeClickOutsideHandler() {
        this.clickOutsideHandler = (event) => {
            if (!this.hasActiveHighlights()) {
                return;
            }
            
            const target = event.target;
            if (this.isClickOnGraphElement(target)) {
                return;
            }
            
            if (this.isClickInsideVisualContentBox(target)) {
                this.clearActiveState();
            }
        };
        
        document.addEventListener('click', this.clickOutsideHandler, true);
    }

    isClickInsideVisualContentBox(target) {
        let element = target;
        while (element && element !== document.body) {
            if (element.classList?.contains('content-box')) {
                const section = element.closest('[id^="input-"], [id^="output-"]');
                if (section?.id) {
                    return this.isSectionInVisualMode(section.id);
                }
                return true;
            }
            element = element.parentElement;
        }
        return false;
    }

    isClickOnGraphElement(target) {
        let element = target;
        while (element && element !== document.body) {
            // Check for clickable graph elements
            if (element.classList?.contains('task-clickable') ||
                element.classList?.contains('node') ||
                (element.tagName?.toLowerCase() === 'g' && element.getAttribute('element-id'))) {
                    return true;
            }
            
            // Stop at SVG or container boundaries
            if (element.tagName?.toLowerCase() === 'svg' || 
                element.id?.includes('-graph-container')) {
                return false;
            }
            
            element = element.parentElement;
        }
        return false;
    }

    removeClickOutsideHandler() {
        if (this.clickOutsideHandler) {
            document.removeEventListener('click', this.clickOutsideHandler, true);
            this.clickOutsideHandler = null;
        }
    }

    // ============ Cleanup ============
    
    reset() {
        this.clickListenerCleanups.forEach((cleanup, sectionId) => {
            this.removeClickHandlers(sectionId);
        });
        
        this.clearAllHighlights();
        this.activeTaskId = null;
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

    destroy() {
        this.removeClickOutsideHandler();
        this.clickListenerCleanups.forEach((_, sectionId) => {
            this.removeClickHandlers(sectionId);
        });
        this.reset();
    }

    // ============ Backward Compatibility ============
    
    /** @deprecated Use setCurrentStepMapping instead */
    setTaskMapper(_taskMapper) {}
}
