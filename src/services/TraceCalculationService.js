/**
 * Trace Calculation Service
 * Handles calculation of execution traces for graph sections
 * Single responsibility: Trace calculation operations
 */

import { MermaidParser } from '../utils/content/MermaidParser.js';
import { CPEEParser } from '../utils/content/CPEEParser.js';
import { verifySoundnessAndBoundedness } from '../utils/trace/SoundnessBoundednessVerifier.js';
import { analyzeReachabilityFromTraces } from '../utils/trace/ReachabilityAnalyzer.js';
import { eventBus as defaultEventBus } from '../core/EventBus.js';

export class TraceCalculationService {
    /**
     * Section configuration mapping section IDs to their properties
     * @static
     * @type {Object<string, {rawGetter: string, isCPEE: boolean}>}
     */
    static SECTION_CONFIG = {
        'input-cpee': { rawGetter: 'getInputCpeeTreeRaw', isCPEE: true },
        'input-intermediate': { rawGetter: 'getInputMermaidRaw', isCPEE: false },
        'output-intermediate': { rawGetter: 'getOutputMermaidRaw', isCPEE: false },
        'output-cpee': { rawGetter: 'getOutputCpeeTreeRaw', isCPEE: true }
    };

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

                // Perform reachability analysis FIRST so its classification can refine
                // the soundness verdict (split Option to Complete vs. No Dead Transitions).
                let reachabilityResult = null;
                try {
                    console.log(`[TraceCalculationService] Starting reachability analysis for ${sectionId}...`);
                    const section = TraceCalculationService.SECTION_CONFIG[sectionId];

                    if (traces.length > 0) {
                        const format = section?.isCPEE ? 'cpee' : 'mermaid';

                        const CPEECalc = (typeof this.cpeeTraceCalculator?.extractAllTasksFromGraph === 'function')
                            ? this.cpeeTraceCalculator
                            : this.cpeeTraceCalculator?.constructor;
                        const MermaidCalc = (typeof this.mermaidTraceCalculator?.extractAllTasksFromGraph === 'function')
                            ? this.mermaidTraceCalculator
                            : this.mermaidTraceCalculator?.constructor;

                        let allTasksFromGraph = [];
                        let graphContent = null;
                        try {
                            const rawContent = cpeeStep[section.rawGetter]();
                            if (rawContent && !rawContent.isEmpty()) {
                                const contentString = rawContent.getContent();
                                if (contentString && contentString.trim() !== '') {
                                    graphContent = contentString;
                                    if (section.isCPEE) {
                                        allTasksFromGraph = CPEECalc.extractAllTasksFromGraph(contentString);
                                    } else {
                                        allTasksFromGraph = MermaidCalc.extractAllTasksFromGraph(contentString);
                                    }
                                }
                            }
                        } catch (extractError) {
                            console.warn(`[TraceCalculationService] Failed to extract all tasks from graph for ${sectionId}, falling back to traces:`, extractError);
                            allTasksFromGraph = this.extractAllTasksFromTraces(traces);
                        }

                        if (allTasksFromGraph.length === 0) {
                            allTasksFromGraph = this.extractAllTasksFromTraces(traces);
                        }

                        reachabilityResult = analyzeReachabilityFromTraces(
                            traces,
                            allTasksFromGraph,
                            {
                                format,
                                graphContent: !section.isCPEE ? graphContent : undefined,
                                MermaidTraceCalculator: !section.isCPEE ? MermaidCalc : undefined
                            }
                        );

                        cpeeStep.setReachabilityResult(sectionId, reachabilityResult);

                        if (reachabilityResult.success) {
                            console.log(`[TraceCalculationService] Reachability analysis complete for ${sectionId} (method=${reachabilityResult.analysisMethod}): viable=${reachabilityResult.nodeClassification?.viableCount || 0}, deadEnd=${reachabilityResult.nodeClassification?.deadEndCount || 0}, traces analyzed=${reachabilityResult.traceCount || 0}`);
                        } else {
                            console.warn(`[TraceCalculationService] Reachability analysis failed for ${sectionId}: ${reachabilityResult.error || 'Unknown error'}`);
                        }

                        if (this.eventBus) {
                            this.eventBus.emit('reachability:analyzed', {
                                sectionId: sectionId,
                                stepNumber: cpeeStep.stepNumber || 'unknown',
                                reachabilityResult: reachabilityResult
                            });
                            console.log(`[TraceCalculationService] Emitted reachability:analyzed event for ${sectionId} (Step ${cpeeStep.stepNumber || 'unknown'})`);
                        }
                    } else {
                        console.log(`[TraceCalculationService] No traces available for ${sectionId}, skipping reachability analysis`);
                    }
                } catch (reachabilityError) {
                    console.error(`[TraceCalculationService] Reachability analysis failed for ${sectionId}:`, reachabilityError);
                    console.error(`[TraceCalculationService] Error stack:`, reachabilityError.stack);
                    // Don't fail trace calculation if reachability analysis fails
                }

                // Perform soundness and boundedness verification, threading the
                // reachability result through so OTC and No Dead Transitions can be
                // separated when graph-based reachability is available.
                try {
                    const section = TraceCalculationService.SECTION_CONFIG[sectionId];
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
                                    {
                                        maxLoopIterations: maxLoopIterations,
                                        reachability: reachabilityResult
                                    }
                                );

                                cpeeStep.setVerificationResult(sectionId, verificationResult);

                                console.log(`[TraceCalculationService] Verification complete for ${sectionId}: sound=${verificationResult.sound}, bounded=${verificationResult.bounded}, deadTaskClassification=${verificationResult.soundness?.deadTaskClassification || 'n/a'}`);

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
        const section = TraceCalculationService.SECTION_CONFIG[sectionId];
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
            
            // Preprocess content before calculating traces
            if (section.isCPEE) {
                try {
                    const preprocessedResult = CPEEParser.cleanAndValidate(contentString, true);
                    contentString = preprocessedResult.xml;
                    console.log(`[TraceCalculationService] Preprocessed CPEE XML for ${sectionId}`);
                } catch (error) {
                    console.warn(`[TraceCalculationService] Failed to preprocess CPEE XML for ${sectionId}, using original:`, error);
                    // Continue with original content if preprocessing fails
                }
            } else {
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
     * Extract all unique tasks from calculated traces
     * @param {Array<Trace>} traces - Calculated traces
     * @returns {Array<Object>} Array of unique task objects with id/alt_id properties
     * @private
     */
    extractAllTasksFromTraces(traces) {
        const taskMap = new Map();
        
        for (const trace of traces) {
            // Handle both Trace objects with .path and plain arrays
            const path = trace?.path || trace;
            if (Array.isArray(path)) {
                for (const step of path) {
                    const taskId = step?.id || step?.alt_id;
                    if (taskId && !taskMap.has(taskId)) {
                        taskMap.set(taskId, {
                            id: step.id,
                            alt_id: step.alt_id,
                            task: step.task || step.label
                        });
                    }
                }
            }
        }
        
        return Array.from(taskMap.values());
    }
}

