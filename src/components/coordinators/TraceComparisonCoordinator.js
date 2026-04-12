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
 * - Handle trace reconciliation (validating traces across graph formats)
 * 
 * @class TraceComparisonCoordinator
 */

import { compareTraces } from '../../utils/trace/TraceComparison.js';
import { ComparisonInfoBox } from '../ui/ComparisonInfoBox.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { TraceReconciliationService } from '../../services/TraceReconciliationService.js';
import { Trace } from '../../models/Trace.js';

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
        
        // Current step reference for reconciliation
        this.currentStep = null;
        
        // Reconciliation service
        this.reconciliationService = new TraceReconciliationService(this.eventBus);
        
        // Track reconciliation state per section pair
        // Once reconciliation is performed, don't reset the info box on view mode changes
        this.reconciliationState = {
            input: {
                performed: false,
                mermaidToCPEE: { validCount: 0, totalCount: 0 },
                cpeeToMermaid: { validCount: 0, totalCount: 0 }
            },
            output: {
                performed: false,
                mermaidToCPEE: { validCount: 0, totalCount: 0 },
                cpeeToMermaid: { validCount: 0, totalCount: 0 }
            }
        };
        
        // Initialize info box container references
        this.initializeContainers();
        
        // Setup event listeners for step navigation
        this.setupStepNavigationListeners();
        
        // Setup event listeners for reconciliation
        this.setupReconciliationListeners();
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
        
        // Clear reconciliation state
        this.clearReconciliationState();
        
        // Update current step number
        this.currentStepNumber = stepNumber;
    }
    
    /**
     * Clear reconciliation state for all section pairs
     */
    clearReconciliationState() {
        this.reconciliationState = {
            input: {
                performed: false,
                mermaidToCPEE: { validCount: 0, totalCount: 0 },
                cpeeToMermaid: { validCount: 0, totalCount: 0 }
            },
            output: {
                performed: false,
                mermaidToCPEE: { validCount: 0, totalCount: 0 },
                cpeeToMermaid: { validCount: 0, totalCount: 0 }
            }
        };
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
        // If reconciliation was already performed, skip re-comparison
        // The comparison state is already up-to-date
        if (this.reconciliationState.input.performed) {
            console.log('[TraceComparisonCoordinator] Skipping input comparison - reconciliation already performed');
            return this.comparisonCache.input;
        }
        
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
        
        const comparisonResult = compareTraces(cpeeTraces, mermaidTraces, { sectionPair: 'input' });
        
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
        // If reconciliation was already performed, skip re-comparison
        // The comparison state is already up-to-date
        if (this.reconciliationState.output.performed) {
            console.log('[TraceComparisonCoordinator] Skipping output comparison - reconciliation already performed');
            return this.comparisonCache.output;
        }
        
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
        
        const comparisonResult = compareTraces(cpeeTraces, mermaidTraces, { sectionPair: 'output' });
        
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
     * Clear comparison cache
     */
    clearCache() {
        this.comparisonCache = {
            input: null,
            output: null
        };
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

    /**
     * Set the current step reference (called when step changes)
     * @param {Object} step - Current step object
     */
    setCurrentStep(step) {
        this.currentStep = step;
    }

    /**
     * Setup event listeners for trace reconciliation
     */
    setupReconciliationListeners() {
        // Listen for "Try run in CPEE" button clicks
        this.eventBus.on('traceReconciliation:tryRunInCPEE', (data) => {
            this.handleTryRunInCPEE(data);
        });

        // Listen for "Try run in Mermaid" button clicks
        this.eventBus.on('traceReconciliation:tryRunInMermaid', (data) => {
            this.handleTryRunInMermaid(data);
        });
    }

    /**
     * Handle "Try run in CPEE" button click
     * Validates unique Mermaid traces against the CPEE graph
     * 
     * @param {Object} data - Event data
     * @param {string} data.sectionPair - Section pair ('input' or 'output')
     * @param {Array} data.uniqueMermaidTraces - Unique Mermaid traces to validate
     * @param {number} data.totalCount - Total count of traces to validate
     */
    handleTryRunInCPEE(data) {
        const { sectionPair, uniqueMermaidTraces, totalCount } = data;

        if (!this.currentStep) {
            console.warn('[TraceComparisonCoordinator] No current step available for reconciliation');
            ComparisonInfoBox.updateReconcileButtonState(sectionPair, 'mermaidToCPEE', 0, totalCount);
            return;
        }

        // Get CPEE content based on section pair
        let cpeeContent = null;
        try {
            if (sectionPair === 'input') {
                const rawContent = this.currentStep.getInputCpeeTreeRaw();
                cpeeContent = rawContent?.getContent() || null;
            } else if (sectionPair === 'output') {
                const rawContent = this.currentStep.getOutputCpeeTreeRaw();
                cpeeContent = rawContent?.getContent() || null;
            }
        } catch (error) {
            console.error('[TraceComparisonCoordinator] Error getting CPEE content:', error);
        }

        if (!cpeeContent) {
            console.warn('[TraceComparisonCoordinator] No CPEE content available for validation');
            ComparisonInfoBox.updateReconcileButtonState(sectionPair, 'mermaidToCPEE', 0, totalCount);
            return;
        }

        // Validate Mermaid traces in CPEE
        const result = this.reconciliationService.validateMermaidTracesInCPEE(
            uniqueMermaidTraces,
            cpeeContent,
            { maxLoopIterations: 1 }
        );

        // Update button state
        ComparisonInfoBox.updateReconcileButtonState(
            sectionPair,
            'mermaidToCPEE',
            result.validCount,
            totalCount
        );

        // Track reconciliation state
        this.reconciliationState[sectionPair].performed = true;
        this.reconciliationState[sectionPair].mermaidToCPEE = {
            validCount: result.validCount,
            totalCount: totalCount
        };

        // If any traces were validated, add them to CPEE traces and re-render
        if (result.validCount > 0) {
            this.addReconciledTracesToStep(sectionPair, 'cpee', result.validatedTraces);
            
            // Mark original Mermaid traces as reconciled
            this.markSourceTracesAsReconciled(sectionPair, 'mermaid', result.validatedTraces);

            // Re-trigger trace display update
            this.eventBus.emit('traceReconciliation:tracesAdded', {
                sectionPair,
                targetGraph: 'cpee',
                addedCount: result.validCount,
                validatedTraces: result.validatedTraces
            });
        }

        // Update comparison result and info box with remaining unique traces
        this.updateComparisonAfterReconciliation(sectionPair, 'mermaidToCPEE', result);

        // Re-run analyses that depend on traces
        this.rerunAnalyses(sectionPair);

        console.log(`[TraceComparisonCoordinator] Validated ${result.validCount}/${totalCount} Mermaid traces in CPEE for ${sectionPair}`);
    }

    /**
     * Handle "Try run in Mermaid" button click
     * Validates unique CPEE traces against the Mermaid graph
     * 
     * @param {Object} data - Event data
     * @param {string} data.sectionPair - Section pair ('input' or 'output')
     * @param {Array} data.uniqueCPEETraces - Unique CPEE traces to validate
     * @param {number} data.totalCount - Total count of traces to validate
     */
    handleTryRunInMermaid(data) {
        const { sectionPair, uniqueCPEETraces, totalCount } = data;

        if (!this.currentStep) {
            console.warn('[TraceComparisonCoordinator] No current step available for reconciliation');
            ComparisonInfoBox.updateReconcileButtonState(sectionPair, 'cpeeToMermaid', 0, totalCount);
            return;
        }

        // Get Mermaid content based on section pair
        let mermaidContent = null;
        try {
            if (sectionPair === 'input') {
                const rawContent = this.currentStep.getInputMermaidRaw();
                mermaidContent = rawContent?.getContent() || null;
            } else if (sectionPair === 'output') {
                const rawContent = this.currentStep.getOutputMermaidRaw();
                mermaidContent = rawContent?.getContent() || null;
            }
        } catch (error) {
            console.error('[TraceComparisonCoordinator] Error getting Mermaid content:', error);
        }

        if (!mermaidContent) {
            console.warn('[TraceComparisonCoordinator] No Mermaid content available for validation');
            ComparisonInfoBox.updateReconcileButtonState(sectionPair, 'cpeeToMermaid', 0, totalCount);
            return;
        }

        // Validate CPEE traces in Mermaid
        const result = this.reconciliationService.validateCPEETracesInMermaid(
            uniqueCPEETraces,
            mermaidContent,
            { maxLoopIterations: 1 }
        );

        // Update button state
        ComparisonInfoBox.updateReconcileButtonState(
            sectionPair,
            'cpeeToMermaid',
            result.validCount,
            totalCount
        );

        // Track reconciliation state
        this.reconciliationState[sectionPair].performed = true;
        this.reconciliationState[sectionPair].cpeeToMermaid = {
            validCount: result.validCount,
            totalCount: totalCount
        };

        // If any traces were validated, add them to Mermaid traces and re-render
        if (result.validCount > 0) {
            this.addReconciledTracesToStep(sectionPair, 'mermaid', result.validatedTraces);
            
            // Mark original CPEE traces as reconciled
            this.markSourceTracesAsReconciled(sectionPair, 'cpee', result.validatedTraces);

            // Re-trigger trace display update
            this.eventBus.emit('traceReconciliation:tracesAdded', {
                sectionPair,
                targetGraph: 'mermaid',
                addedCount: result.validCount,
                validatedTraces: result.validatedTraces
            });
        }

        // Update comparison result and info box with remaining unique traces
        this.updateComparisonAfterReconciliation(sectionPair, 'cpeeToMermaid', result);

        // Re-run analyses that depend on traces
        this.rerunAnalyses(sectionPair);

        console.log(`[TraceComparisonCoordinator] Validated ${result.validCount}/${totalCount} CPEE traces in Mermaid for ${sectionPair}`);
    }

    /**
     * Add reconciled traces to the step's trace list
     * 
     * @param {string} sectionPair - Section pair ('input' or 'output')
     * @param {string} targetGraph - Target graph type ('cpee' or 'mermaid')
     * @param {Array} validatedTraces - Array of validated trace objects
     */
    addReconciledTracesToStep(sectionPair, targetGraph, validatedTraces) {
        if (!this.currentStep || !validatedTraces || validatedTraces.length === 0) {
            return;
        }

        // Determine the section ID
        let sectionId;
        if (sectionPair === 'input') {
            sectionId = targetGraph === 'cpee' ? 'input-cpee' : 'input-intermediate';
        } else {
            sectionId = targetGraph === 'cpee' ? 'output-cpee' : 'output-intermediate';
        }

        // Get current traces
        const currentTraces = this.currentStep.getTraces(sectionId) || [];

        // Add reconciled traces
        const newTraces = [...currentTraces];
        for (const validatedTrace of validatedTraces) {
            // Ensure the trace is a Trace instance
            const trace = validatedTrace.trace instanceof Trace 
                ? validatedTrace.trace 
                : Trace.fromObject(validatedTrace.trace);
            
            // Mark as reconciled if not already
            if (!trace.isReconciled) {
                const sourceIndex = validatedTrace.originalMermaidTraceIndex !== undefined 
                    ? validatedTrace.originalMermaidTraceIndex 
                    : validatedTrace.originalCPEETraceIndex;
                const sourceType = validatedTrace.originalMermaidTraceIndex !== undefined 
                    ? 'mermaid' 
                    : 'cpee';
                trace.markAsReconciled(sourceIndex, sourceType);
            }

            newTraces.push(trace);
        }

        // Update step with new traces
        this.currentStep.setTraces(sectionId, newTraces);

        console.log(`[TraceComparisonCoordinator] Added ${validatedTraces.length} reconciled traces to ${sectionId}`);
    }

    /**
     * Mark source traces as reconciled (they have been validated in the other graph)
     * 
     * @param {string} sectionPair - Section pair ('input' or 'output')
     * @param {string} sourceGraph - Source graph type ('cpee' or 'mermaid')
     * @param {Array} validatedTraces - Array of validated trace objects
     */
    markSourceTracesAsReconciled(sectionPair, sourceGraph, validatedTraces) {
        if (!this.currentStep || !validatedTraces || validatedTraces.length === 0) {
            return;
        }

        // Determine the source section ID
        let sectionId;
        if (sectionPair === 'input') {
            sectionId = sourceGraph === 'cpee' ? 'input-cpee' : 'input-intermediate';
        } else {
            sectionId = sourceGraph === 'cpee' ? 'output-cpee' : 'output-intermediate';
        }

        // Get current traces
        const currentTraces = this.currentStep.getTraces(sectionId);
        if (!currentTraces || currentTraces.length === 0) {
            return;
        }

        // Get the indices of source traces that were validated
        const validatedIndices = new Set();
        for (const validatedTrace of validatedTraces) {
            const sourceIndex = sourceGraph === 'mermaid' 
                ? validatedTrace.originalMermaidTraceIndex 
                : validatedTrace.originalCPEETraceIndex;
            if (sourceIndex !== undefined) {
                validatedIndices.add(sourceIndex);
            }
        }

        // Mark those traces as reconciled
        let updated = false;
        for (const index of validatedIndices) {
            if (index < currentTraces.length) {
                const trace = currentTraces[index];
                if (trace && !trace.isReconciled) {
                    trace.isReconciled = true;
                    trace.sourceGraphType = sourceGraph === 'mermaid' ? 'cpee' : 'mermaid';
                    updated = true;
                }
            }
        }

        // Update step if any traces were marked
        if (updated) {
            this.currentStep.setTraces(sectionId, currentTraces);
            console.log(`[TraceComparisonCoordinator] Marked ${validatedIndices.size} source traces as reconciled in ${sectionId}`);
        }
    }

    /**
     * Update comparison result and info box after reconciliation
     * Removes validated traces from the unique lists and updates the display
     * 
     * @param {string} sectionPair - Section pair ('input' or 'output')
     * @param {string} direction - Reconciliation direction: 'mermaidToCPEE' or 'cpeeToMermaid'
     * @param {Object} reconciliationResult - Result from reconciliation service
     */
    updateComparisonAfterReconciliation(sectionPair, direction, reconciliationResult) {
        const cachedResult = this.comparisonCache[sectionPair];
        if (!cachedResult) {
            return;
        }

        // Get the indices of validated traces
        const validatedIndices = new Set();
        for (const result of reconciliationResult.results) {
            if (result.valid) {
                validatedIndices.add(result.originalTrace.traceIndex);
            }
        }

        // Update the unique traces lists based on direction
        if (direction === 'mermaidToCPEE') {
            // Remove validated traces from uniqueMermaidTraces
            if (cachedResult.uniqueMermaidTraces) {
                cachedResult.uniqueMermaidTraces = cachedResult.uniqueMermaidTraces.filter(
                    trace => !validatedIndices.has(trace.traceIndex)
                );
            }
        } else if (direction === 'cpeeToMermaid') {
            // Remove validated traces from uniqueCPEETraces
            if (cachedResult.uniqueCPEETraces) {
                cachedResult.uniqueCPEETraces = cachedResult.uniqueCPEETraces.filter(
                    trace => !validatedIndices.has(trace.traceIndex)
                );
            }
        }

        // Update counts
        cachedResult.problematicCount = 
            (cachedResult.uniqueCPEETraces?.length || 0) + 
            (cachedResult.uniqueMermaidTraces?.length || 0);

        // Check if all traces are now reconciled
        if (cachedResult.problematicCount === 0) {
            cachedResult.isMatch = true;
        }

        // Update the cache
        this.comparisonCache[sectionPair] = cachedResult;

        // Update the info box - update counts and lists without recreating the entire box
        const container = this.getContainer(sectionPair);
        if (container) {
            // Update the unique counts in the header
            ComparisonInfoBox.updateUniqueCounts(
                sectionPair,
                cachedResult.uniqueCPEETraces?.length || 0,
                cachedResult.uniqueMermaidTraces?.length || 0
            );
            
            // Update the unique trace lists in the details section
            ComparisonInfoBox.updateUniqueTraceLists(
                sectionPair,
                cachedResult.uniqueCPEETraces || [],
                cachedResult.uniqueMermaidTraces || []
            );
            
            // If all traces match now, hide the info box
            if (cachedResult.isMatch && cachedResult.problematicCount === 0) {
                ComparisonInfoBox.removeInfoBox(container);
            }
        }

        // Emit updated comparison event
        this.eventBus.emit('traceComparison:updated', {
            sectionPair,
            comparisonResult: cachedResult,
            reconciliationDirection: direction,
            validatedCount: validatedIndices.size,
            timestamp: new Date().toISOString()
        }, { silent: true });

        console.log(`[TraceComparisonCoordinator] Updated comparison for ${sectionPair}: uniqueCPEE=${cachedResult.uniqueCPEETraces?.length || 0}, uniqueMermaid=${cachedResult.uniqueMermaidTraces?.length || 0}`);
    }

    /**
     * Re-run analyses that depend on traces after reconciliation
     * This includes verification and reachability analysis
     * 
     * @param {string} sectionPair - Section pair ('input' or 'output')
     */
    rerunAnalyses(sectionPair) {
        if (!this.currentStep) {
            return;
        }

        // Determine which sections to re-analyze
        const sectionIds = sectionPair === 'input'
            ? ['input-cpee', 'input-intermediate']
            : ['output-cpee', 'output-intermediate'];

        // Emit event to trigger re-analysis for each section
        for (const sectionId of sectionIds) {
            const traces = this.currentStep.getTraces(sectionId);
            
            // Emit event to re-run verification
            this.eventBus.emit('traceReconciliation:rerunAnalysis', {
                sectionId,
                sectionPair,
                stepNumber: this.currentStep.stepNumber || 'unknown',
                traces,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`[TraceComparisonCoordinator] Triggered re-analysis for ${sectionPair} sections`);
    }
}

