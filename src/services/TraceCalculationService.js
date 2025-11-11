/**
 * Trace Calculation Service
 * Handles calculation of execution traces for graph sections
 * Single responsibility: Trace calculation operations
 */

import { MermaidParser } from '../utils/content/MermaidParser.js';

export class TraceCalculationService {
    /**
     * Create a new TraceCalculationService instance
     * @param {CPEETraceCalculator} cpeeTraceCalculator - Calculator for CPEE traces
     * @param {MermaidTraceCalculator} mermaidTraceCalculator - Calculator for Mermaid traces
     */
    constructor(cpeeTraceCalculator, mermaidTraceCalculator) {
        this.cpeeTraceCalculator = cpeeTraceCalculator;
        this.mermaidTraceCalculator = mermaidTraceCalculator;
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
        
        // Store results in step
        results.forEach(({ sectionId, traces, error }) => {
            if (error) {
                // Store empty array to indicate calculation was attempted but failed
                cpeeStep.setTraces(sectionId, []);
            } else {
                cpeeStep.setTraces(sectionId, traces);
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
}

