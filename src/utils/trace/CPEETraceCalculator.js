/**
 * CPEE Trace Calculator
 * Implements Graph Trace Analysis (GTA) approach from Tbaileh et al. (2017)
 * 
 * Reference: Tbaileh, A., Jain, H., Broadwater, R., Cordova, J., Arghandeh, R., & Dilek, M. (2017).
 * Graph Trace Analysis: An object-oriented power flow, verifications and comparisons.
 * Electric Power Systems Research, 147, 145-153.
 * 
 * This implementation adapts GTA concepts from power system analysis to workflow graph trace calculation.
 */

import { Trace } from '../../models/Trace.js';
import { CPEEParser } from '../content/CPEEParser.js';

const MAX_LOOP_ITERATIONS = 1;
const TIMEOUT_MS = 2000;

class TimeoutChecker {
    constructor(timeoutMs) {
        this.startTime = Date.now();
        this.timeoutMs = timeoutMs;
    }
    
    check() {
        if (Date.now() - this.startTime > this.timeoutMs) {
            throw new Error(`Trace calculation exceeded ${this.timeoutMs}ms timeout. The CPEE graph is too complex to calculate all traces.`);
        }
    }
}

/**
 * GTA Topology Iterators
 */
class TopologyIterators {
    /**
     * Forward Iterator - returns child elements of an XML node.
     */
    static forwardIterator(node) {
        return Array.from(node.children || []);
    }

    /**
     * Cotree Iterator - checks if a loop node's ID already appears in the forward trace.
     */
    static cotreeIterator(node, forwardTraceSet) {
        const nodeId = node.getAttribute('id');
        if (!nodeId) { return false; }
        return forwardTraceSet.some(task => task.id === nodeId);
    }
}

/**
 * GTA Trace Sets
 * 
 * @param {boolean} permissive - When true, uses relaxed loop semantics for validation:
 *   loops always allow 0 iterations regardless of condition.
 */
class TraceSets {
    /**
     * Forward Trace (FT_i) - recursive XML tree traversal building execution traces.
     * 
     * @param {Element} node - Starting XML node
     * @param {Array<Object>} currentFT - Current forward trace set
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker
     * @param {boolean} permissive - Use permissive loop semantics
     * @returns {Array<Array<Object>>} Array of forward trace arrays
     */
    static forwardTrace(node, currentFT, maxLoopIterations, timeoutChecker, permissive = false) {
        timeoutChecker.check();
        
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
        
        switch (tagName) {
            case 'call':
            case 'manipulate':
            case 'script': {
                const task = CPEETraceCalculator.extractTask(node);
                if (!task) { return []; }
                return [[...currentFT, task]];
            }
            
            case 'description': {
                return this.combineSequentialForwardTrace(
                    TopologyIterators.forwardIterator(node),
                    currentFT, maxLoopIterations, timeoutChecker, permissive
                );
            }
            
            case 'choose': {
                const alternatives = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return tag === 'alternative' || tag === 'otherwise';
                    });
                
                if (alternatives.length === 0) { return []; }
                
                const mode = (node.getAttribute('mode') || '').toLowerCase();
                
                if (mode === 'inclusive') {
                    return this.handleInclusiveChoose(
                        alternatives, currentFT, maxLoopIterations, timeoutChecker, permissive
                    );
                }
                
                return alternatives.flatMap(alt => 
                    this.forwardTrace(alt, currentFT, maxLoopIterations, timeoutChecker, permissive)
                );
            }
            
            case 'otherwise':
            case 'alternative': {
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return !tag.startsWith('_') && tag !== 'condition';
                    });
                
                if (children.length === 0) { return [currentFT]; }
                
                const escapeIndex = children.findIndex(child => {
                    if (child.tagName.toLowerCase() !== 'escape') { return false; }
                    const altId = child.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') || 
                                  child.getAttribute('a:alt_id') ||
                                  child.getAttribute('alt_id');
                    return altId === '-1' || altId === null || altId === undefined;
                });
                
                if (escapeIndex !== -1) {
                    const beforeEscape = children.slice(0, escapeIndex);
                    if (beforeEscape.length > 0) {
                        const traces = this.combineSequentialForwardTrace(
                            beforeEscape, currentFT, maxLoopIterations, timeoutChecker, permissive
                        );
                        return traces.map(trace => {
                            trace._terminatedByEscape = true;
                            return trace;
                        });
                    } else {
                        const emptyTrace = [...currentFT];
                        emptyTrace._terminatedByEscape = true;
                        return [emptyTrace];
                    }
                }
                
                return this.combineSequentialForwardTrace(
                    children, currentFT, maxLoopIterations, timeoutChecker, permissive
                );
            }
            
            case 'parallel': {
                const branches = TopologyIterators.forwardIterator(node)
                    .filter(child => child.tagName.toLowerCase() === 'parallel_branch');
                
                if (branches.length === 0) { return []; }
                
                const branchTraces = branches.map(branch => 
                    this.forwardTrace(branch, currentFT, maxLoopIterations, timeoutChecker, permissive)
                );
                
                const branchSpecificTraces = branchTraces.map(traces => 
                    traces.map(trace => trace.slice(currentFT.length))
                );
                
                const interleaved = CPEETraceCalculator.interleave(branchSpecificTraces, timeoutChecker);
                return interleaved.map(interleavedTrace => [...currentFT, ...interleavedTrace]);
            }
            
            case 'parallel_branch': {
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return !tag.startsWith('_') && tag !== 'condition';
                    });
                
                return this.combineSequentialForwardTrace(
                    children, currentFT, maxLoopIterations, timeoutChecker, permissive
                );
            }
            
            case 'loop': {
                return permissive
                    ? this.loopTracePermissive(node, currentFT, maxLoopIterations, timeoutChecker)
                    : this.loopTrace(node, currentFT, maxLoopIterations, timeoutChecker);
            }
            
            case 'escape': {
                return [];
            }
            
            default: {
                const children = TopologyIterators.forwardIterator(node);
                if (children.length > 0) {
                    return this.combineSequentialForwardTrace(
                        children, currentFT, maxLoopIterations, timeoutChecker, permissive
                    );
                }
                return [];
            }
        }
    }

    /**
     * Handle inclusive choose (OR gateway) - generates traces for all non-empty
     * subsets of alternative branches.
     */
    static handleInclusiveChoose(alternatives, currentFT, maxLoopIterations, timeoutChecker, permissive) {
        const perBranchTraces = alternatives.map(alt => {
            timeoutChecker.check();
            return this.forwardTrace(alt, currentFT, maxLoopIterations, timeoutChecker, permissive);
        });

        const perBranchSpecific = perBranchTraces.map(traces =>
            traces.map(trace => trace.slice(currentFT.length))
        );

        const subsets = CPEETraceCalculator.generateNonEmptySubsets(
            alternatives.map((_, i) => i)
        );

        const allTraces = [];

        for (const subset of subsets) {
            timeoutChecker.check();

            if (subset.length === 1) {
                for (const branchTrace of perBranchSpecific[subset[0]]) {
                    allTraces.push([...currentFT, ...branchTrace]);
                }
            } else {
                const selectedBranches = subset.map(idx => perBranchSpecific[idx]);
                const interleaved = CPEETraceCalculator.interleave(selectedBranches, timeoutChecker);
                for (const interleavedTrace of interleaved) {
                    allTraces.push([...currentFT, ...interleavedTrace]);
                }
            }
        }

        return allTraces;
    }

    /**
     * Get the condition value from a loop node.
     */
    static getLoopCondition(loopNode) {
        const conditionAttr = loopNode.getAttribute('condition');
        if (conditionAttr !== null) { return conditionAttr.trim(); }
        
        const conditionElement = Array.from(loopNode.children || [])
            .find(child => child.tagName.toLowerCase() === 'condition');
        if (conditionElement) { return conditionElement.textContent.trim(); }
        
        return '';
    }

    /**
     * Check if any task from the loop body is already in the current trace.
     */
    static hasBodyTaskInTrace(bodyTraces, currentFT) {
        const currentTaskIds = new Set(currentFT.map(task => task.id).filter(Boolean));
        
        for (const bodyTrace of bodyTraces) {
            for (const task of bodyTrace) {
                if (task.id && currentTaskIds.has(task.id)) { return true; }
            }
        }
        return false;
    }

    /**
     * Loop Trace - semantic loop handling with condition awareness.
     */
    static loopTrace(loopNode, currentFT, maxLoopIterations, timeoutChecker) {
        timeoutChecker.check();
        
        const children = TopologyIterators.forwardIterator(loopNode)
            .filter(child => child.tagName.toLowerCase() !== 'condition');
        
        const bodyTraces = this.combineSequentialForwardTrace(
            children, [], maxLoopIterations, timeoutChecker, false
        );
        
        const condition = this.getLoopCondition(loopNode);
        const isConditionTrue = condition === 'true';
        const hasBodyTaskAlreadyInTrace = this.hasBodyTaskInTrace(bodyTraces, currentFT);
        const shouldSkipZeroIterations = isConditionTrue && !hasBodyTaskAlreadyInTrace;
        
        const hasEscapePath = bodyTraces.some(trace => trace._terminatedByEscape === true);
        
        const loopNodeId = loopNode.getAttribute('id');
        const isCotreeEdge = loopNodeId ? TopologyIterators.cotreeIterator(loopNode, currentFT) : false;
        const iterationLimit = isCotreeEdge ? 1 : maxLoopIterations;
        
        const minIterForEscape = (hasEscapePath && !shouldSkipZeroIterations) ? 2 : 1;
        const maxIter = Math.max(Math.min(iterationLimit, 2), minIterForEscape);
        
        const nonEscapeTraces = bodyTraces.filter(t => !t._terminatedByEscape);
        const hasMultipleNonEscapePaths = nonEscapeTraces.length > 1;
        const secondIterationIsForEscapeOnly = iterationLimit < 2 && minIterForEscape >= 2 && !hasMultipleNonEscapePaths;
        
        const result = [];
        
        if (!shouldSkipZeroIterations) {
            result.push([...currentFT]);
        }
        
        if (maxIter >= 1) {
            for (const bodyTrace of bodyTraces) {
                const combinedTrace = [...currentFT, ...bodyTrace];
                if (bodyTrace._terminatedByEscape) {
                    combinedTrace._terminatedByEscape = true;
                }
                result.push(combinedTrace);
            }
        }
        
        if (maxIter >= 2) {
            for (const bodyTrace1 of bodyTraces) {
                if (bodyTrace1._terminatedByEscape) { continue; }
                for (const bodyTrace2 of bodyTraces) {
                    if (bodyTrace1 === bodyTrace2) { continue; }
                    if (secondIterationIsForEscapeOnly && !bodyTrace2._terminatedByEscape) { continue; }
                    const combinedTrace = [...currentFT, ...bodyTrace1, ...bodyTrace2];
                    if (bodyTrace2._terminatedByEscape) {
                        combinedTrace._terminatedByEscape = true;
                    }
                    result.push(combinedTrace);
                }
            }
        }
        
        return result;
    }

    /**
     * Permissive Loop Trace - always allows 0 iterations regardless of condition.
     */
    static loopTracePermissive(loopNode, currentFT, maxLoopIterations, timeoutChecker) {
        timeoutChecker.check();
        
        const children = TopologyIterators.forwardIterator(loopNode)
            .filter(child => child.tagName.toLowerCase() !== 'condition');
        
        const bodyTraces = this.combineSequentialForwardTrace(
            children, [], maxLoopIterations, timeoutChecker, true
        );
        
        const hasEscapePath = bodyTraces.some(trace => trace._terminatedByEscape === true);
        const minIterForEscape = hasEscapePath ? 2 : 1;
        const effectiveMaxIter = Math.max(maxLoopIterations, minIterForEscape);
        
        const result = [];
        result.push([...currentFT]);
        
        for (let iter = 1; iter <= effectiveMaxIter; iter++) {
            result.push(...this.generateIterationCombinations(bodyTraces, iter, currentFT, timeoutChecker));
        }
        
        return result;
    }

    /**
     * Generate all combinations of loop body traces for a given iteration count.
     */
    static generateIterationCombinations(bodyTraces, iterationCount, prefix, timeoutChecker) {
        if (iterationCount === 0) { return [[...prefix]]; }
        
        if (iterationCount === 1) {
            return bodyTraces.map(bodyTrace => {
                const combined = [...prefix, ...bodyTrace];
                if (bodyTrace._terminatedByEscape) {
                    combined._terminatedByEscape = true;
                }
                return combined;
            });
        }
        
        const results = [];
        for (const firstBodyTrace of bodyTraces) {
            timeoutChecker.check();
            
            if (firstBodyTrace._terminatedByEscape) {
                const combined = [...prefix, ...firstBodyTrace];
                combined._terminatedByEscape = true;
                results.push(combined);
                continue;
            }
            
            results.push(...this.generateIterationCombinations(
                bodyTraces, iterationCount - 1, [...prefix, ...firstBodyTrace], timeoutChecker
            ));
        }
        
        return results;
    }

    /**
     * Combine Sequential Forward Trace - processes children left-to-right,
     * threading trace results through. Respects escape termination.
     */
    static combineSequentialForwardTrace(children, initialFT, maxLoopIterations, timeoutChecker, permissive) {
        if (children.length === 0) { return [[...initialFT]]; }
        
        let currentTraces = [[...initialFT]];
        
        for (const child of children) {
            timeoutChecker.check();
            
            const newTraces = [];
            
            for (const currentTrace of currentTraces) {
                if (currentTrace._terminatedByEscape === true) {
                    newTraces.push(currentTrace);
                } else {
                    const childTraces = this.forwardTrace(
                        child, currentTrace, maxLoopIterations, timeoutChecker, permissive
                    );
                    newTraces.push(...childTraces);
                }
            }
            
            currentTraces = newTraces;
        }
        
        return currentTraces;
    }
}

export class CPEETraceCalculator {
    /**
     * Calculate all possible execution traces from CPEE XML using GTA approach.
     * @param {string} xmlString - CPEE XML content
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @param {number} options.timeout - Timeout in ms (default: 2000)
     * @param {boolean} options.permissive - Use permissive loop semantics (default: false)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(xmlString, options = {}) {
        const maxLoopIterations = options.maxLoopIterations ?? MAX_LOOP_ITERATIONS;
        const timeoutMs = options.timeout ?? TIMEOUT_MS;
        const permissive = options.permissive ?? false;
        const timeoutChecker = new TimeoutChecker(timeoutMs);
        
        try {
            let preprocessedXml = xmlString;
            try {
                preprocessedXml = CPEEParser.cleanAndValidate(xmlString, true).xml;
            } catch (error) { /* continue with original */ }
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(preprocessedXml, 'text/xml');
            
            if (xmlDoc.querySelector('parsererror')) { return []; }
            
            const description = xmlDoc.querySelector('description') || xmlDoc.documentElement;
            if (!description) { return []; }
            
            const traceArrays = TraceSets.forwardTrace(
                description, [], maxLoopIterations, timeoutChecker, permissive
            );
            
            const uniqueTraces = this.filterDuplicateTraces(traceArrays);
            
            return uniqueTraces.map((path, index) => 
                new Trace(`trace-${index + 1}`, path, this.determineTraceType(path))
            );
            
        } catch (error) {
            if (error.message?.includes('exceeded') && error.message?.includes('timeout')) {
                throw error;
            }
            console.error('[CPEETraceCalculator] Error calculating traces:', error);
            return [];
        }
    }

    /**
     * Parallel interleaving: all permutations of branch order × cartesian product of variants.
     */
    static interleave(branches, timeoutChecker) {
        if (branches.length === 0) { return [[]]; }
        if (branches.length === 1) { return branches[0]; }
        
        timeoutChecker.check();
        
        const permutations = this.permuteArray(branches.map((_, i) => i), timeoutChecker);
        const result = [];
        
        for (const perm of permutations) {
            timeoutChecker.check();
            const combinations = this.cartesianProduct(perm.map(idx => branches[idx]), timeoutChecker);
            for (const combination of combinations) {
                result.push(combination.flat());
            }
        }
        return result;
    }

    static permuteArray(arr, timeoutChecker) {
        if (arr.length <= 1) { return [arr]; }
        
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            timeoutChecker.check();
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            for (const perm of this.permuteArray(rest, timeoutChecker)) {
                result.push([arr[i], ...perm]);
            }
        }
        return result;
    }

    static cartesianProduct(arrays, timeoutChecker) {
        if (arrays.length === 0) { return [[]]; }
        
        return arrays.reduce((acc, next) => {
            const result = [];
            for (const a of acc) {
                for (const b of next) {
                    timeoutChecker.check();
                    result.push([...a, b]);
                }
            }
            return result;
        }, [[]]);
    }

    /**
     * Generate all non-empty subsets of an array via bitmask enumeration.
     */
    static generateNonEmptySubsets(arr) {
        const result = [];
        const n = arr.length;
        for (let mask = 1; mask < (1 << n); mask++) {
            const subset = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) { subset.push(arr[i]); }
            }
            result.push(subset);
        }
        return result;
    }

    /**
     * Extract task information from call/manipulate/script node.
     */
    static extractTask(callNode) {
        const id = callNode.getAttribute('id');
        if (!id) { return null; }
        
        const altId = callNode.getAttribute('a:alt_id') || 
                      callNode.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') ||
                      null;
        
        let label = '';
        
        const labelAttr = callNode.getAttribute('label');
        if (labelAttr) {
            label = labelAttr.trim();
        }
        
        if (!label) {
            const labelElement = callNode.querySelector('parameters > label');
            if (labelElement) {
                label = labelElement.textContent.trim();
                if ((label.startsWith('"') && label.endsWith('"')) || 
                    (label.startsWith("'") && label.endsWith("'"))) {
                    label = label.slice(1, -1);
                }
                label = label.replace(/"?\s*\)\s*&\s*\d+:task:\(\s*"?/g, ', ');
                label = label.replace(/"([^"]+)"/g, '$1');
                label = label.replace(/,+/g, ',').replace(/,\s*,/g, ',').replace(/,\s*$/g, '');
                label = label.trim();
            }
        }
        
        return { id, alt_id: altId, task: label };
    }

    /**
     * Filter duplicate traces by comparing serialized task sequences.
     */
    static filterDuplicateTraces(traces) {
        const seen = new Set();
        const result = [];
        
        for (const trace of traces) {
            if (!trace || trace.length === 0) { continue; }
            
            const key = JSON.stringify(trace.map(t => ({ id: t.id, alt_id: t.alt_id, task: t.task })));
            if (!seen.has(key)) {
                seen.add(key);
                result.push(trace);
            }
        }
        return result;
    }

    /**
     * Determine trace type: 'sequential' if all nodes unique, 'loop' if any repeats.
     */
    static determineTraceType(path) {
        const seen = new Set();
        for (const t of path) {
            if (seen.has(t.id)) { return 'loop'; }
            seen.add(t.id);
        }
        return 'sequential';
    }

    /**
     * Validate if a trace sequence is a valid navigable path in the CPEE graph.
     * Uses permissive settings (higher loop iterations, longer timeout, relaxed loop semantics).
     */
    static validateTrace(xmlString, traceSequence, options = {}) {
        if (!traceSequence || traceSequence.length === 0) {
            return { valid: false, matchedPath: null, reason: 'Empty trace sequence' };
        }

        try {
            const allTraces = this.calculateAllTraces(xmlString, {
                maxLoopIterations: 4, timeout: 5000, permissive: true, ...options
            });
            
            if (allTraces.length === 0) {
                return { valid: false, matchedPath: null, reason: 'No traces could be calculated from CPEE graph' };
            }

            for (const trace of allTraces) {
                if (this.traceMatchesSequence(trace, traceSequence)) {
                    return { valid: true, matchedPath: trace.path, reason: null };
                }
            }

            return { valid: false, matchedPath: null, reason: 'Trace sequence does not match any valid path in CPEE graph' };

        } catch (error) {
            console.error('[CPEETraceCalculator] Error validating trace:', error);
            return { valid: false, matchedPath: null, reason: `Validation error: ${error.message}` };
        }
    }

    /**
     * Check if a calculated trace matches a given sequence of identifiers.
     */
    static traceMatchesSequence(trace, sequence) {
        if (!trace?.path || trace.path.length !== sequence.length) { return false; }

        for (let i = 0; i < sequence.length; i++) {
            const task = trace.path[i];
            const seqIdStr = String(sequence[i]);
            const taskAltId = task.alt_id !== null && task.alt_id !== undefined ? String(task.alt_id) : null;
            const taskId = task.id !== null && task.id !== undefined ? String(task.id) : null;

            if (seqIdStr !== taskAltId && seqIdStr !== taskId) { return false; }
        }
        return true;
    }

    /**
     * Validate multiple trace sequences against a CPEE graph.
     */
    static validateMultipleTraces(xmlString, traceSequences, options = {}) {
        let allTraces;
        try {
            allTraces = this.calculateAllTraces(xmlString, {
                maxLoopIterations: 4, timeout: 5000, permissive: true, ...options
            });
        } catch (error) {
            console.error('[CPEETraceCalculator] Error calculating traces for validation:', error);
            return {
                validCount: 0,
                invalidCount: traceSequences.length,
                results: traceSequences.map(seq => ({
                    sequence: seq, valid: false, matchedPath: null, reason: `Calculation error: ${error.message}`
                }))
            };
        }

        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        for (const sequence of traceSequences) {
            const matchedTrace = allTraces.find(trace => this.traceMatchesSequence(trace, sequence));
            
            if (matchedTrace) {
                validCount++;
                results.push({ sequence, valid: true, matchedPath: matchedTrace.path, reason: null });
            } else {
                invalidCount++;
                results.push({ sequence, valid: false, matchedPath: null, reason: 'Trace sequence does not match any valid path' });
            }
        }

        return { validCount, invalidCount, results };
    }

    /**
     * Extract all tasks from a CPEE XML graph (for reachability analysis).
     */
    static extractAllTasksFromGraph(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') { return []; }

        try {
            let preprocessedXml = xmlString;
            try {
                preprocessedXml = CPEEParser.cleanAndValidate(xmlString, true).xml;
            } catch (error) { /* continue with original */ }
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(preprocessedXml, 'text/xml');

            if (xmlDoc.querySelector('parsererror')) { return []; }

            const tasks = [];
            for (const element of xmlDoc.querySelectorAll('call, manipulate, script')) {
                const task = this.extractTask(element);
                if (task) { tasks.push(task); }
            }
            return tasks;
        } catch (error) {
            console.error('[CPEETraceCalculator] Error extracting tasks from graph:', error);
            return [];
        }
    }
}
