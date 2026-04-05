/**
 * Trace Reconciliation Service
 * 
 * Handles validation and reconciliation of traces between CPEE and Mermaid graphs.
 * When traces are unique to one graph format, this service attempts to validate
 * them against the other graph format and adds them if they form valid paths.
 * 
 * Features:
 * - Validate Mermaid traces against CPEE graphs
 * - Validate CPEE traces against Mermaid graphs
 * - Add reconciled traces to graph trace lists
 * - Mark reconciled traces with special styling
 * - Emit events for UI updates
 * 
 * @class TraceReconciliationService
 */

import { CPEETraceCalculator } from '../utils/trace/CPEETraceCalculator.js';
import { MermaidTraceCalculator } from '../utils/trace/MermaidTraceCalculator.js';
import { Trace } from '../models/Trace.js';
import { eventBus as defaultEventBus } from '../core/EventBus.js';

export class TraceReconciliationService {
    /**
     * Create a new TraceReconciliationService instance
     * @param {Object} eventBus - Event bus for emitting events (optional)
     */
    constructor(eventBus = null) {
        this.eventBus = eventBus || defaultEventBus;
    }

    /**
     * Validate Mermaid traces against a CPEE graph
     * Attempts to run unique Mermaid traces in the CPEE graph structure
     * 
     * @param {Array<Object>} uniqueMermaidTraces - Unique Mermaid traces from comparison
     *   Each object: { traceIndex: number, sequence: Array<string> }
     * @param {string} cpeeXmlString - CPEE XML content to validate against
     * @param {Object} options - Validation options
     * @returns {Object} Validation result: { validCount, invalidCount, validatedTraces, results }
     */
    validateMermaidTracesInCPEE(uniqueMermaidTraces, cpeeXmlString, options = {}) {
        if (!uniqueMermaidTraces || uniqueMermaidTraces.length === 0) {
            return {
                validCount: 0,
                invalidCount: 0,
                validatedTraces: [],
                results: []
            };
        }

        if (!cpeeXmlString || cpeeXmlString.trim() === '') {
            return {
                validCount: 0,
                invalidCount: uniqueMermaidTraces.length,
                validatedTraces: [],
                results: uniqueMermaidTraces.map(trace => ({
                    originalTrace: trace,
                    valid: false,
                    reason: 'No CPEE content available for validation'
                }))
            };
        }

        // Extract sequences from unique traces
        const sequences = uniqueMermaidTraces.map(trace => trace.sequence);

        // Validate all sequences against CPEE graph
        const validationResult = CPEETraceCalculator.validateMultipleTraces(
            cpeeXmlString,
            sequences,
            options
        );

        // Create validated traces with reconciliation metadata
        const validatedTraces = [];
        const results = [];

        for (let i = 0; i < uniqueMermaidTraces.length; i++) {
            const originalTrace = uniqueMermaidTraces[i];
            const validation = validationResult.results[i];

            if (validation.valid && validation.matchedPath) {
                // Create a new Trace object from the matched path
                const newTrace = new Trace(
                    `reconciled-from-mermaid-${originalTrace.traceIndex}`,
                    validation.matchedPath,
                    'sequential'
                );
                newTrace.markAsReconciled(originalTrace.traceIndex, 'mermaid');

                validatedTraces.push({
                    trace: newTrace,
                    originalMermaidTraceIndex: originalTrace.traceIndex,
                    sequence: originalTrace.sequence
                });

                results.push({
                    originalTrace,
                    valid: true,
                    reconciledTrace: newTrace,
                    reason: null
                });
            } else {
                results.push({
                    originalTrace,
                    valid: false,
                    reconciledTrace: null,
                    reason: validation.reason
                });
            }
        }

        return {
            validCount: validationResult.validCount,
            invalidCount: validationResult.invalidCount,
            validatedTraces,
            results
        };
    }

    /**
     * Validate CPEE traces against a Mermaid graph
     * Attempts to run unique CPEE traces in the Mermaid graph structure
     * 
     * @param {Array<Object>} uniqueCPEETraces - Unique CPEE traces from comparison
     *   Each object: { traceIndex: number, sequence: Array<string> }
     * @param {string} mermaidString - Mermaid flowchart content to validate against
     * @param {Object} options - Validation options
     * @returns {Object} Validation result: { validCount, invalidCount, validatedTraces, results }
     */
    validateCPEETracesInMermaid(uniqueCPEETraces, mermaidString, options = {}) {
        if (!uniqueCPEETraces || uniqueCPEETraces.length === 0) {
            return {
                validCount: 0,
                invalidCount: 0,
                validatedTraces: [],
                results: []
            };
        }

        if (!mermaidString || mermaidString.trim() === '') {
            return {
                validCount: 0,
                invalidCount: uniqueCPEETraces.length,
                validatedTraces: [],
                results: uniqueCPEETraces.map(trace => ({
                    originalTrace: trace,
                    valid: false,
                    reason: 'No Mermaid content available for validation'
                }))
            };
        }

        // Extract sequences from unique traces
        const sequences = uniqueCPEETraces.map(trace => trace.sequence);

        // Validate all sequences against Mermaid graph
        const validationResult = MermaidTraceCalculator.validateMultipleTraces(
            mermaidString,
            sequences,
            options
        );

        // Create validated traces with reconciliation metadata
        const validatedTraces = [];
        const results = [];

        for (let i = 0; i < uniqueCPEETraces.length; i++) {
            const originalTrace = uniqueCPEETraces[i];
            const validation = validationResult.results[i];

            if (validation.valid && validation.matchedPath) {
                // Create a new Trace object from the matched path
                const newTrace = new Trace(
                    `reconciled-from-cpee-${originalTrace.traceIndex}`,
                    validation.matchedPath,
                    'sequential'
                );
                newTrace.markAsReconciled(originalTrace.traceIndex, 'cpee');

                validatedTraces.push({
                    trace: newTrace,
                    originalCPEETraceIndex: originalTrace.traceIndex,
                    sequence: originalTrace.sequence
                });

                results.push({
                    originalTrace,
                    valid: true,
                    reconciledTrace: newTrace,
                    reason: null
                });
            } else {
                results.push({
                    originalTrace,
                    valid: false,
                    reconciledTrace: null,
                    reason: validation.reason
                });
            }
        }

        return {
            validCount: validationResult.validCount,
            invalidCount: validationResult.invalidCount,
            validatedTraces,
            results
        };
    }

    /**
     * Perform full reconciliation for a section pair
     * Validates traces from both directions and emits events
     * 
     * @param {Object} comparisonResult - Result from TraceComparison.compareTraces()
     * @param {string} cpeeContent - CPEE XML content
     * @param {string} mermaidContent - Mermaid flowchart content
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {Object} options - Validation options
     * @returns {Object} Reconciliation result
     */
    reconcileTraces(comparisonResult, cpeeContent, mermaidContent, sectionPair, options = {}) {
        const result = {
            sectionPair,
            mermaidToCPEE: null,
            cpeeToMermaid: null,
            timestamp: new Date().toISOString()
        };

        // Validate unique Mermaid traces in CPEE
        if (comparisonResult.uniqueMermaidTraces && comparisonResult.uniqueMermaidTraces.length > 0) {
            result.mermaidToCPEE = this.validateMermaidTracesInCPEE(
                comparisonResult.uniqueMermaidTraces,
                cpeeContent,
                options
            );
        }

        // Validate unique CPEE traces in Mermaid
        if (comparisonResult.uniqueCPEETraces && comparisonResult.uniqueCPEETraces.length > 0) {
            result.cpeeToMermaid = this.validateCPEETracesInMermaid(
                comparisonResult.uniqueCPEETraces,
                mermaidContent,
                options
            );
        }

        // Emit reconciliation complete event
        this.eventBus.emit('traceReconciliation:complete', {
            sectionPair,
            result,
            timestamp: result.timestamp
        });

        return result;
    }
}

