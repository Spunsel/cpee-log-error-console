/**
 * Trace Comparison Coordinator
 * Coordinates trace comparison between CPEE and Mermaid formats
 * 
 * Responsibilities:
 * - Compare traces between input CPEE and input Mermaid formats
 * - Compare traces between output CPEE and output Mermaid formats
 * - Display comparison info boxes when discrepancies are found
 * - Cache comparison results
 * - Handle trace availability and edge cases
 * - Emit events for comparison results
 * - Handle step navigation and clear state appropriately
 * 
 * @class TraceComparisonCoordinator
 */

import { compareTraces } from '../../utils/trace/TraceComparison.js';
import { ComparisonInfoBox } from '../ui/ComparisonInfoBox.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class TraceComparisonCoordinator {
    /**
     * Create a new TraceComparisonCoordinator instance
     * @param {Object|null} domRegistry - DOM registry for element access
     * @param {Object|null} eventBus - Event bus for emitting comparison events
     */
    constructor(domRegistry = null, eventBus = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        
        // Cache comparison results per section pair
        this.comparisonCache = {
            input: null,
            output: null
        };
        
        // Track info box containers
        this.infoBoxContainers = {
            input: null,
            output: null
        };
        
        // Current step tracking for cache management
        this.currentStepNumber = null;
        
        // Initialize info box container references
        this.initializeContainers();
        
        // Setup event listeners for step navigation
        this.setupStepNavigationListeners();
    }
    
    /**
     * Setup event listeners for step navigation
     * Clears comparison state when navigating to a new step
     */
    setupStepNavigationListeners() {
        // Listen for step changes
        this.eventBus.on('stepViewer:stepChanged', (data) => {
            const newStepNumber = data.step?.stepNumber || null;
            if (newStepNumber !== this.currentStepNumber) {
                this.handleStepChange(newStepNumber);
            }
        });
        
        // Also listen for step navigator events
        this.eventBus.on('stepNavigator:stepChanged', (data) => {
            const newStepNumber = data.step?.stepNumber || null;
            if (newStepNumber !== this.currentStepNumber) {
                this.handleStepChange(newStepNumber);
            }
        });
    }
    
    /**
     * Handle step change - clear comparison state
     * @param {number|null} stepNumber - New step number
     */
    handleStepChange(stepNumber) {
        // Clear all info boxes
        this.clearAllInfoBoxes();
        
        // Clear cache
        this.clearCache();
        
        // Update current step number
        this.currentStepNumber = stepNumber;
    }
    
    /**
     * Initialize info box container references
     */
    initializeContainers() {
        if (!this.domRegistry) {
            console.warn('[TraceComparisonCoordinator] DOM registry not available, containers will be queried directly');
            return;
        }
        
        // Get containers by querying for comparison-info-box-container elements
        const containers = document.querySelectorAll('.comparison-info-box-container');
        containers.forEach(container => {
            const sectionPair = container.getAttribute('data-section-pair');
            if (sectionPair === 'input' || sectionPair === 'output') {
                this.infoBoxContainers[sectionPair] = container;
            }
        });
    }
    
    /**
     * Get info box container for a section pair
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @returns {HTMLElement|null} Container element or null
     */
    getContainer(sectionPair) {
        if (this.infoBoxContainers[sectionPair]) {
            return this.infoBoxContainers[sectionPair];
        }
        
        // Fallback: query directly
        const container = document.querySelector(
            `.comparison-info-box-container[data-section-pair="${sectionPair}"]`
        );
        
        if (container) {
            this.infoBoxContainers[sectionPair] = container;
        }
        
        return container;
    }
    
    /**
     * Compare input traces (input CPEE vs input Mermaid)
     * @param {Array} cpeeTraces - Array of CPEE traces
     * @param {Array} mermaidTraces - Array of Mermaid traces
     * @param {number|null} stepNumber - Optional step number for event context
     * @returns {Object|null} Comparison result or null if comparison failed
     */
    compareInputTraces(cpeeTraces, mermaidTraces, stepNumber = null) {
        // Handle null/undefined cases
        if (!cpeeTraces && !mermaidTraces) {
            this.clearInfoBox('input');
            this.emitComparisonEvent('input', null, stepNumber, 'skipped');
            return null;
        }
        
        if (!Array.isArray(cpeeTraces) || !Array.isArray(mermaidTraces)) {
            console.warn('[TraceComparisonCoordinator] Invalid trace arrays for input comparison');
            this.clearInfoBox('input');
            this.emitComparisonEvent('input', null, stepNumber, 'error');
            return null;
        }
        
        // Perform comparison
        const comparisonResult = compareTraces(cpeeTraces, mermaidTraces);
        
        // Cache result
        this.comparisonCache.input = comparisonResult;
        
        // Update info box
        this.updateInfoBox('input', comparisonResult);
        
        // Emit comparison event
        this.emitComparisonEvent('input', comparisonResult, stepNumber);
        
        return comparisonResult;
    }
    
    /**
     * Compare output traces (output CPEE vs output Mermaid)
     * @param {Array} cpeeTraces - Array of CPEE traces
     * @param {Array} mermaidTraces - Array of Mermaid traces
     * @param {number|null} stepNumber - Optional step number for event context
     * @returns {Object|null} Comparison result or null if comparison failed
     */
    compareOutputTraces(cpeeTraces, mermaidTraces, stepNumber = null) {
        // Handle null/undefined cases
        if (!cpeeTraces && !mermaidTraces) {
            this.clearInfoBox('output');
            this.emitComparisonEvent('output', null, stepNumber, 'skipped');
            return null;
        }
        
        if (!Array.isArray(cpeeTraces) || !Array.isArray(mermaidTraces)) {
            console.warn('[TraceComparisonCoordinator] Invalid trace arrays for output comparison');
            this.clearInfoBox('output');
            this.emitComparisonEvent('output', null, stepNumber, 'error');
            return null;
        }
        
        // Perform comparison
        const comparisonResult = compareTraces(cpeeTraces, mermaidTraces);
        
        // Cache result
        this.comparisonCache.output = comparisonResult;
        
        // Update info box
        this.updateInfoBox('output', comparisonResult);
        
        // Emit comparison event
        this.emitComparisonEvent('output', comparisonResult, stepNumber);
        
        return comparisonResult;
    }
    
    /**
     * Update info box for a section pair based on comparison result
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {Object} comparisonResult - Comparison result from compareTraces()
     */
    updateInfoBox(sectionPair, comparisonResult) {
        const container = this.getContainer(sectionPair);
        
        if (!container) {
            console.warn(`[TraceComparisonCoordinator] Container not found for section pair: ${sectionPair}`);
            return;
        }
        
        // Clear info box if traces match perfectly
        if (comparisonResult.isMatch && comparisonResult.traceCountMatch) {
            ComparisonInfoBox.removeInfoBox(container, sectionPair);
            return;
        }
        
        // Create or update info box
        ComparisonInfoBox.updateInfoBox(comparisonResult, sectionPair, container);
    }
    
    /**
     * Clear info box for a section pair
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     */
    clearInfoBox(sectionPair) {
        const container = this.getContainer(sectionPair);
        
        if (container) {
            ComparisonInfoBox.removeInfoBox(container, sectionPair);
        }
        
        // Clear cache
        this.comparisonCache[sectionPair] = null;
    }
    
    /**
     * Clear all info boxes
     */
    clearAllInfoBoxes() {
        this.clearInfoBox('input');
        this.clearInfoBox('output');
    }
    
    /**
     * Get cached comparison result for a section pair
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @returns {Object|null} Cached comparison result or null
     */
    getCachedResult(sectionPair) {
        return this.comparisonCache[sectionPair] || null;
    }
    
    /**
     * Clear comparison cache
     */
    clearCache() {
        this.comparisonCache = {
            input: null,
            output: null
        };
    }
    
    /**
     * Compare traces for both input and output pairs
     * @param {Object} traceData - Object with input and output traces
     * @param {Array} traceData.inputCpeeTraces - Input CPEE traces
     * @param {Array} traceData.inputMermaidTraces - Input Mermaid traces
     * @param {Array} traceData.outputCpeeTraces - Output CPEE traces
     * @param {Array} traceData.outputMermaidTraces - Output Mermaid traces
     * @param {number|null} stepNumber - Optional step number for event context
     */
    compareAllTraces(traceData, stepNumber = null) {
        if (traceData.inputCpeeTraces && traceData.inputMermaidTraces) {
            this.compareInputTraces(traceData.inputCpeeTraces, traceData.inputMermaidTraces, stepNumber);
        }
        
        if (traceData.outputCpeeTraces && traceData.outputMermaidTraces) {
            this.compareOutputTraces(traceData.outputCpeeTraces, traceData.outputMermaidTraces, stepNumber);
        }
    }
    
    /**
     * Emit comparison events based on comparison result
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {Object|null} comparisonResult - Comparison result object or null
     * @param {number|null} stepNumber - Step number for event context
     * @param {string} status - Status: 'compared', 'skipped', or 'error'
     */
    emitComparisonEvent(sectionPair, comparisonResult, stepNumber = null, status = 'compared') {
        if (status === 'skipped' || status === 'error') {
            return;
        }
        
        if (!comparisonResult) {
            console.warn(`[TraceComparisonCoordinator] No comparison result to emit for ${sectionPair}`);
            return;
        }
        
        // Emit general comparison event
        this.eventBus.emit('traceComparison:compared', {
            sectionPair,
            stepNumber: stepNumber || this.currentStepNumber,
            comparisonResult,
            timestamp: new Date().toISOString()
        }, { silent: true });
        
        // Emit specific match/mismatch events
        if (comparisonResult.isMatch && comparisonResult.traceCountMatch) {
            this.eventBus.emit('traceComparison:match', {
                sectionPair,
                stepNumber: stepNumber || this.currentStepNumber,
                comparisonResult,
                timestamp: new Date().toISOString()
            }, { silent: true });
        } else {
            this.eventBus.emit('traceComparison:mismatch', {
                sectionPair,
                stepNumber: stepNumber || this.currentStepNumber,
                comparisonResult,
                timestamp: new Date().toISOString()
            }, { silent: true });
        }
    }
}

