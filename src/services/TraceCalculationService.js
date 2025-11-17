/**
 * Trace Calculation Service
 * Handles calculation of execution traces for graph sections
 * Single responsibility: Trace calculation operations
 */

import { MermaidParser } from '../utils/content/MermaidParser.js';
import { verifySoundnessAndBoundedness } from '../utils/trace/SoundnessBoundednessVerifier.js';
import { analyzeReachability } from '../utils/trace/ReachabilityAnalyzer.js';
import { eventBus as defaultEventBus } from '../core/EventBus.js';

export class TraceCalculationService {
    /**
     * Create a new TraceCalculationService instance
     * @param {CPEETraceCalculator} cpeeTraceCalculator - Calculator for CPEE traces
     * @param {MermaidTraceCalculator} mermaidTraceCalculator - Calculator for Mermaid traces
     * @param {Object} eventBus - Event bus for emitting events (optional, uses default if not provided)
     */
    constructor(cpeeTraceCalculator, mermaidTraceCalculator, eventBus = null) {
        this.cpeeTraceCalculator = cpeeTraceCalculator;
        this.mermaidTraceCalculator = mermaidTraceCalculator;
        this.eventBus = eventBus || defaultEventBus;
    }

    /**
     * Calculate traces for all graph sections in a step
     * @param {CPEEStep} cpeeStep - Step to calculate traces for
     * @param {Object} options - Trace calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @param {number} options.maxPathLength - Maximum path length (default: 50)
     * @returns {Promise<void>}
     */
    async calculateTracesForStep(cpeeStep, options = {}) {
        const { maxLoopIterations = 1, maxPathLength = 50 } = options;
        const traceOptions = { maxLoopIterations, maxPathLength };
        
        const sections = [
            { id: 'input-cpee', rawGetter: 'getInputCpeeTreeRaw', isCPEE: true },
            { id: 'input-intermediate', rawGetter: 'getInputMermaidRaw', isCPEE: false },
            { id: 'output-intermediate', rawGetter: 'getOutputMermaidRaw', isCPEE: false },
            { id: 'output-cpee', rawGetter: 'getOutputCpeeTreeRaw', isCPEE: true }
        ];
        
        // Calculate traces in parallel for all sections
        const tracePromises = sections.map(section => {
            try {
                const traces = this.calculateTracesForSection(cpeeStep, section.id, traceOptions);
                return Promise.resolve({ sectionId: section.id, traces, error: null });
            } catch (error) {
                // Handle timeout errors and other exceptions
                return Promise.resolve({ sectionId: section.id, traces: [], error });
            }
        });
        
        // Wait for all trace calculations to complete
        const results = await Promise.all(tracePromises);
        
        // Store results in step and perform verification
        results.forEach(({ sectionId, traces, error }) => {
            if (error) {
                // Store empty array to indicate calculation was attempted but failed
                cpeeStep.setTraces(sectionId, []);
            } else {
                cpeeStep.setTraces(sectionId, traces);
                
                // Perform soundness and boundedness verification
                try {
                    const sectionConfig = {
                        'input-cpee': { rawGetter: 'getInputCpeeTreeRaw', isCPEE: true },
                        'input-intermediate': { rawGetter: 'getInputMermaidRaw', isCPEE: false },
                        'output-intermediate': { rawGetter: 'getOutputMermaidRaw', isCPEE: false },
                        'output-cpee': { rawGetter: 'getOutputCpeeTreeRaw', isCPEE: true }
                    };
                    
                    const section = sectionConfig[sectionId];
                    if (section) {
                        const rawContent = cpeeStep[section.rawGetter]();
                        if (rawContent && !rawContent.isEmpty()) {
                            const contentString = rawContent.getContent();
                            if (contentString && contentString.trim() !== '') {
                                const format = section.isCPEE ? 'cpee' : 'mermaid';
                                const verificationResult = verifySoundnessAndBoundedness(
                                    traces,
                                    contentString,
                                    format,
                                    { maxLoopIterations: maxLoopIterations }
                                );
                                
                                // Store verification result in step
                                cpeeStep.setVerificationResult(sectionId, verificationResult);
                                
                                console.log(`[TraceCalculationService] Verification complete for ${sectionId}: sound=${verificationResult.sound}, bounded=${verificationResult.bounded}`);
                                
                                // Emit verification completion event (Phase 34.11)
                                this.eventBus.emit('verification:complete', {
                                    sectionId: sectionId,
                                    stepNumber: cpeeStep.stepNumber || 'unknown',
                                    verificationResult: verificationResult
                                });
                            }
                        }
                    }
                } catch (verificationError) {
                    console.warn(`[TraceCalculationService] Verification failed for ${sectionId}:`, verificationError);
                    // Don't fail trace calculation if verification fails
                }
                
                // Perform reachability analysis (Phase 35.10)
                try {
                    console.log(`[TraceCalculationService] Starting reachability analysis for ${sectionId}...`);
                    const sectionConfig = {
                        'input-cpee': { rawGetter: 'getInputCpeeTreeRaw', isCPEE: true },
                        'input-intermediate': { rawGetter: 'getInputMermaidRaw', isCPEE: false },
                        'output-intermediate': { rawGetter: 'getOutputMermaidRaw', isCPEE: false },
                        'output-cpee': { rawGetter: 'getOutputCpeeTreeRaw', isCPEE: true }
                    };
                    
                    const section = sectionConfig[sectionId];
                    if (!section) {
                        console.warn(`[TraceCalculationService] No section config found for ${sectionId}, skipping reachability analysis`);
                    } else {
                        const rawContent = cpeeStep[section.rawGetter]();
                        if (!rawContent || rawContent.isEmpty()) {
                            console.warn(`[TraceCalculationService] No raw content available for ${sectionId}, skipping reachability analysis`);
                        } else {
                            let contentString = rawContent.getContent();
                            if (!contentString || contentString.trim() === '') {
                                console.warn(`[TraceCalculationService] Empty content string for ${sectionId}, skipping reachability analysis`);
                            } else {
                                // Preprocess Mermaid code before reachability analysis (for consistency with ContentViewCoordinator)
                                if (!section.isCPEE) {
                                    try {
                                        const preprocessedResult = MermaidParser.cleanAndValidate(contentString, true);
                                        contentString = preprocessedResult.code;
                                        console.log(`[TraceCalculationService] Preprocessed Mermaid code for reachability analysis in ${sectionId}`);
                                    } catch (error) {
                                        console.warn(`[TraceCalculationService] Failed to preprocess Mermaid for ${sectionId}, using original:`, error);
                                        // Continue with original content if preprocessing fails
                                    }
                                }
                                
                                const format = section.isCPEE ? 'cpee' : 'mermaid';
                                console.log(`[TraceCalculationService] Performing reachability analysis for ${sectionId} (format: ${format}, content length: ${contentString.length})`);
                                
                                // Perform reachability analysis
                                const reachabilityResult = analyzeReachability(
                                    contentString,
                                    format,
                                    { 
                                        maxLoopIterations: maxLoopIterations,
                                        timeout: 5000,
                                        computeTransitiveClosure: false // Optional, can be expensive
                                    }
                                );
                                
                                // Store reachability result in step
                                cpeeStep.setReachabilityResult(sectionId, reachabilityResult);
                                
                                if (reachabilityResult.success) {
                                    // Validate trace completeness using reachability information
                                    if (traces.length > 0) {
                                        this.validateTraceCompleteness(traces, reachabilityResult, sectionId);
                                    }
                                    
                                    console.log(`[TraceCalculationService] Reachability analysis complete for ${sectionId}: useful=${reachabilityResult.nodeClassification?.usefulCount || 0}, deadEnd=${reachabilityResult.nodeClassification?.deadEndCount || 0}, unreachable=${reachabilityResult.nodeClassification?.unreachableCount || 0}`);
                                } else {
                                    console.warn(`[TraceCalculationService] Reachability analysis failed for ${sectionId}: ${reachabilityResult.error || 'Unknown error'}`);
                                }
                                
                                // Emit reachability analysis completion event (Phase 35.20)
                                if (this.eventBus) {
                                    this.eventBus.emit('reachability:analyzed', {
                                        sectionId: sectionId,
                                        stepNumber: cpeeStep.stepNumber || 'unknown',
                                        reachabilityResult: reachabilityResult
                                    });
                                    console.log(`[TraceCalculationService] Emitted reachability:analyzed event for ${sectionId} (Step ${cpeeStep.stepNumber || 'unknown'})`);
                                }
                                
                                // State Management (Phase 35.19):
                                // Reachability results are stored in the step model (cpeeStep.reachabilityResults)
                                // Step data is automatically persisted as part of instance data, so no explicit
                                // state persistence is needed. The results are available when the step is loaded.
                            }
                        }
                    }
                } catch (reachabilityError) {
                    console.error(`[TraceCalculationService] Reachability analysis failed for ${sectionId}:`, reachabilityError);
                    console.error(`[TraceCalculationService] Error stack:`, reachabilityError.stack);
                    // Don't fail trace calculation if reachability analysis fails
                }
            }
        });
    }

    /**
     * Calculate traces for a single section
     * @param {CPEEStep} cpeeStep - Step containing the section
     * @param {string} sectionId - Section identifier
     * @param {Object} options - Trace calculation options
     * @returns {Array} Calculated traces
     * @private
     */
    calculateTracesForSection(cpeeStep, sectionId, options) {
        // Map section ID to configuration
        const sectionConfig = {
            'input-cpee': { rawGetter: 'getInputCpeeTreeRaw', isCPEE: true },
            'input-intermediate': { rawGetter: 'getInputMermaidRaw', isCPEE: false },
            'output-intermediate': { rawGetter: 'getOutputMermaidRaw', isCPEE: false },
            'output-cpee': { rawGetter: 'getOutputCpeeTreeRaw', isCPEE: true }
        };
        
        const section = sectionConfig[sectionId];
        if (!section) {
            console.warn(`[TraceCalculationService] Unknown section ID: ${sectionId}`);
            return [];
        }
        
        try {
            console.log(`[TraceCalculationService] Calculating traces for ${sectionId} in Step ${cpeeStep.stepNumber}`);
            
            // Get raw content
            const rawContent = cpeeStep[section.rawGetter]();
            if (!rawContent || rawContent.isEmpty()) {
                console.log(`[TraceCalculationService] No raw content available for ${sectionId} in Step ${cpeeStep.stepNumber}`);
                return [];
            }
            
            let contentString = rawContent.getContent();
            if (!contentString || contentString.trim() === '') {
                console.log(`[TraceCalculationService] Empty content for ${sectionId} in Step ${cpeeStep.stepNumber}`);
                return [];
            }
            
            // Preprocess Mermaid code before calculating traces
            if (!section.isCPEE) {
                try {
                    const preprocessedResult = MermaidParser.cleanAndValidate(contentString, true);
                    contentString = preprocessedResult.code;
                    console.log(`[TraceCalculationService] Preprocessed Mermaid code for ${sectionId}`);
                } catch (error) {
                    console.warn(`[TraceCalculationService] Failed to preprocess Mermaid code for ${sectionId}, using original:`, error);
                    // Continue with original content if preprocessing fails
                }
            }
            
            // Calculate traces based on content type
            // Trace calculators have static methods - get the class (works with both class and instance)
            const CPEETraceCalculatorClass = (typeof this.cpeeTraceCalculator.calculateAllTraces === 'function')
                ? this.cpeeTraceCalculator
                : this.cpeeTraceCalculator.constructor;
            const MermaidTraceCalculatorClass = (typeof this.mermaidTraceCalculator.calculateAllTraces === 'function')
                ? this.mermaidTraceCalculator
                : this.mermaidTraceCalculator.constructor;
            
            let traces = [];
            if (section.isCPEE) {
                traces = CPEETraceCalculatorClass.calculateAllTraces(contentString, options);
            } else {
                traces = MermaidTraceCalculatorClass.calculateAllTraces(contentString, options);
            }
            
            console.log(`[TraceCalculationService] Calculated ${traces.length} traces for ${sectionId} in Step ${cpeeStep.stepNumber}`);
            return traces;
            
        } catch (error) {
            console.error(`[TraceCalculationService] Failed to calculate traces for ${sectionId} in Step ${cpeeStep.stepNumber}:`, error);
            // Re-throw timeout errors so they can be displayed in the UI
            if (error.message && error.message.includes('exceeded') && error.message.includes('timeout')) {
                throw error;
            }
            return [];
        }
    }

    /**
     * Validate trace completeness using reachability information
     * Checks if all reachable nodes appear in traces and flags missing coverage
     * 
     * @param {Array<Trace>} traces - Calculated traces
     * @param {Object} reachabilityResult - Reachability analysis result
     * @param {string} sectionId - Section identifier
     * @private
     */
    validateTraceCompleteness(traces, reachabilityResult, sectionId) {
        if (!reachabilityResult.success || !reachabilityResult.nodeClassification) {
            return;
        }
        
        // Collect all node IDs that appear in traces
        const nodesInTraces = new Set();
        traces.forEach(trace => {
            if (trace && trace.path) {
                trace.path.forEach(task => {
                    const nodeId = task.id || task.alt_id;
                    if (nodeId) {
                        nodesInTraces.add(nodeId);
                    }
                });
            }
        });
        
        // Check if all useful nodes appear in traces
        const usefulNodes = new Set(reachabilityResult.nodeClassification.usefulNodes || []);
        const missingUsefulNodes = Array.from(usefulNodes).filter(nodeId => !nodesInTraces.has(nodeId));
        
        if (missingUsefulNodes.length > 0) {
            console.warn(`[TraceCalculationService] Trace completeness issue for ${sectionId}: ${missingUsefulNodes.length} useful nodes not covered by traces:`, missingUsefulNodes);
        }
        
        // Check if traces cover all reachable paths (forward reachability)
        const forwardReachableNodes = new Set(reachabilityResult.forwardReachability?.reachableNodes || []);
        const missingReachableNodes = Array.from(forwardReachableNodes).filter(nodeId => !nodesInTraces.has(nodeId));
        
        if (missingReachableNodes.length > 0) {
            console.warn(`[TraceCalculationService] Trace completeness issue for ${sectionId}: ${missingReachableNodes.length} forward-reachable nodes not covered by traces:`, missingReachableNodes);
        }
        
        // Calculate coverage percentage
        const totalUsefulNodes = usefulNodes.size;
        const coveredUsefulNodes = Array.from(usefulNodes).filter(nodeId => nodesInTraces.has(nodeId)).length;
        const usefulCoverage = totalUsefulNodes > 0 ? (coveredUsefulNodes / totalUsefulNodes) * 100 : 100;
        
        if (usefulCoverage < 100) {
            console.warn(`[TraceCalculationService] Trace coverage for ${sectionId}: ${usefulCoverage.toFixed(1)}% of useful nodes covered (${coveredUsefulNodes}/${totalUsefulNodes})`);
        } else {
            console.log(`[TraceCalculationService] Trace coverage for ${sectionId}: 100% of useful nodes covered`);
        }
    }
}

