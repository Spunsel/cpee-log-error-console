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

// Global constants
const MAX_LOOP_ITERATIONS = 1;
const TIMEOUT_MS = 2000;

/**
 * Timeout checker class to track elapsed time during calculation
 */
class TimeoutChecker {
    constructor(timeoutMs) {
        this.startTime = Date.now();
        this.timeoutMs = timeoutMs;
    }
    
    check() {
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.timeoutMs) {
            throw new Error(`Trace calculation exceeded ${this.timeoutMs}ms timeout. The CPEE graph is too complex to calculate all traces.`);
        }
    }
    
    getElapsed() {
        return Date.now() - this.startTime;
    }
}

/**
 * GTA Topology Iterators
 * Following the paper's definition of topology iterators
 */
class TopologyIterators {
    /**
     * Forward Iterator p[f]
     * Returns next component(s) in forward trace direction (children/outgoing edges)
     * @param {Element} node - Current XML node
     * @returns {Array<Element>} Array of child nodes (forward components)
     */
    static forwardIterator(node) {
        return Array.from(node.children || []);
    }

    /**
     * Backward Iterator p[b]
     * Returns previous component(s) in backward trace direction (parent/incoming edges)
     * For workflow execution traces, this is less relevant but included for completeness
     * @param {Element} node - Current XML node
     * @returns {Array<Element>} Array containing parent node (if exists)
     */
    static backwardIterator(node) {
        return node.parentElement ? [node.parentElement] : [];
    }

    /**
     * Feeder Path Iterator p[fp]
     * Returns component that supplies to p from reference source
     * For workflows, this is the path from start to current node (same as forward trace)
     * @param {Element} node - Current XML node
     * @param {Array<Object>} forwardTraceSet - Current forward trace set
     * @returns {Array<Object>} Feeder path (tasks from start to current node)
     */
    static feederPathIterator(node, forwardTraceSet) {
        // For workflows, feeder path is the accumulated forward trace set
        return forwardTraceSet;
    }

    /**
     * Cotree Iterator p[ct]
     * Returns cotree component that, if removed, breaks an independent loop
     * For workflows, this identifies loop nodes that create cycles
     * @param {Element} node - Current XML node (loop node)
     * @param {Array<Object>} forwardTraceSet - Current forward trace set
     * @returns {boolean} True if this node is a cotree edge (creates a loop)
     */
    static cotreeIterator(node, forwardTraceSet) {
        // Check if current node ID appears in forward trace set (loop detection)
        const nodeId = node.getAttribute('id');
        if (!nodeId) {
            return false;
        }
        
        // A cotree edge is one that creates a cycle when added to the forward trace
        return forwardTraceSet.some(task => task.id === nodeId);
    }
}

/**
 * GTA Trace Sets
 * Following the paper's definition of trace sets
 */
class TraceSets {
    /**
     * Forward Trace (FT_i)
     * Ordered set created with recursive application of forward iterator f starting at component i
     * FT_i = {p | p is reachable from i via forward iterator f}
     * 
     * @param {Element} node - Starting node
     * @param {Array<Object>} currentFT - Current forward trace set
     * @param {number} depth - Recursion depth
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker
     * @returns {Array<Array<Object>>} Array of forward trace arrays
     */
    static forwardTrace(node, currentFT, depth, maxLoopIterations, timeoutChecker) {
        if (timeoutChecker) {
            timeoutChecker.check();
        }
        
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
        
        switch (tagName) {
            case 'call':
            case 'manipulate':
            case 'script': {
                // Task node: add to forward trace set
                const task = CPEETraceCalculator.extractTask(node);
                if (!task) {
                    return [];
                }
                
                // Create new forward trace set: FT_new = FT ∪ {task}
                const newFT = [...currentFT, task];
                return [newFT];
            }
            
            case 'description': {
                // Sequential container: process children sequentially
                return this.combineSequentialForwardTrace(
                    TopologyIterators.forwardIterator(node),
                    currentFT,
                    depth,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'choose': {
                // XOR Gateway: union of alternatives (including otherwise as default branch)
                const alternatives = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return tag === 'alternative' || tag === 'otherwise';
                    });
                
                if (alternatives.length === 0) {
                    return [];
                }
                
                // Process each alternative with same forward trace set
                const alternativeTraces = alternatives.flatMap(alt => 
                    this.forwardTrace(alt, currentFT, depth + 1, maxLoopIterations, timeoutChecker)
                );
                
                return alternativeTraces;
            }
            
            case 'otherwise': {
                // Otherwise branch (default case): process children sequentially
                // Filter out metadata elements like _probability
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return !tag.startsWith('_') && tag !== 'condition';
                    });
                
                if (children.length === 0) {
                    // Empty otherwise branch - return current trace as-is
                    return [currentFT];
                }
                
                return this.combineSequentialForwardTrace(
                    children,
                    currentFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'alternative': {
                // Alternative branch: process children sequentially
                // Filter out condition and metadata elements (those starting with _)
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return !tag.startsWith('_') && tag !== 'condition';
                    });
                
                // Check for escape with alt_id="-1" (indicates trace should end)
                const escapeIndex = children.findIndex(child => {
                    if (child.tagName.toLowerCase() !== 'escape') {
                        return false;
                    }
                    // Check if escape has alt_id="-1" (or any escape if alt_id is not specified)
                    const altId = child.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') || 
                                  child.getAttribute('a:alt_id') ||
                                  child.getAttribute('alt_id');
                    // If alt_id is "-1" or not specified, treat as end node
                    return altId === '-1' || altId === null || altId === undefined;
                });
                
                if (escapeIndex !== -1) {
                    // Process only children before the escape
                    const beforeEscape = children.slice(0, escapeIndex);
                    if (beforeEscape.length > 0) {
                        const traces = this.combineSequentialForwardTrace(
                            beforeEscape,
                            currentFT,
                            depth + 1,
                            maxLoopIterations,
                            timeoutChecker
                        );
                        // Mark all traces as terminated by escape (trace ends here)
                        return traces.map(trace => {
                            trace._terminatedByEscape = true;
                            return trace;
                        });
                    } else {
                        // No tasks before escape, trace ends at current point
                        const emptyTrace = [...currentFT];
                        emptyTrace._terminatedByEscape = true;
                        return [emptyTrace];
                    }
                } else {
                    // No escape found, process all children normally
                    return this.combineSequentialForwardTrace(
                        children,
                        currentFT,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker
                    );
                }
            }
            
            case 'parallel': {
                // AND Gateway: interleave parallel branches
                const branches = TopologyIterators.forwardIterator(node)
                    .filter(child => child.tagName.toLowerCase() === 'parallel_branch');
                
                if (branches.length === 0) {
                    return [];
                }
                
                // Process each branch with same forward trace set
                const branchTraces = branches.map(branch => 
                    this.forwardTrace(branch, currentFT, depth + 1, maxLoopIterations, timeoutChecker)
                );
                
                // Extract only the new tasks from each branch (remove the common prefix)
                // Each branch trace includes currentFT as prefix, we only want the branch-specific tasks
                const branchSpecificTraces = branchTraces.map(branchTraceArray => 
                    branchTraceArray.map(trace => {
                        // Remove the common prefix (currentFT) from each trace
                        // Only keep tasks that were added by this branch
                        const prefixLength = currentFT.length;
                        return trace.slice(prefixLength);
                    })
                );
                
                // Interleave branch-specific traces
                const interleaved = CPEETraceCalculator.interleave(branchSpecificTraces, timeoutChecker);
                
                // Prepend the common prefix to each interleaved result
                return interleaved.map(interleavedTrace => [...currentFT, ...interleavedTrace]);
            }
            
            case 'parallel_branch': {
                // Parallel branch: process children sequentially
                // Filter out condition and metadata elements (those starting with _)
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return !tag.startsWith('_') && tag !== 'condition';
                    });
                
                return this.combineSequentialForwardTrace(
                    children,
                    currentFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'loop': {
                // Loop: implement Loop Trace (LT) using cotree concept
                return this.loopTrace(
                    node,
                    currentFT,
                    depth,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'escape': {
                // Escape terminates trace early
                return [];
            }
            
            default: {
                // Unknown element: try to process children
                const children = TopologyIterators.forwardIterator(node);
                if (children.length > 0) {
                    return this.combineSequentialForwardTrace(
                        children,
                        currentFT,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker
                    );
                }
                return [];
            }
        }
    }

    /**
     * Get the condition value from a loop node
     * @param {Element} loopNode - Loop node
     * @returns {string} Condition value (empty string if not found)
     */
    static getLoopCondition(loopNode) {
        // First check for condition attribute
        const conditionAttr = loopNode.getAttribute('condition');
        if (conditionAttr !== null) {
            return conditionAttr.trim();
        }
        
        // Then check for condition child element
        const conditionElement = Array.from(loopNode.children || [])
            .find(child => child.tagName.toLowerCase() === 'condition');
        if (conditionElement) {
            return conditionElement.textContent.trim();
        }
        
        return '';
    }

    /**
     * Check if any task from the loop body is already in the current trace
     * @param {Array<Array<Object>>} bodyTraces - Traces from the loop body
     * @param {Array<Object>} currentFT - Current forward trace
     * @returns {boolean} True if at least one task from body is in current trace
     */
    static hasBodyTaskInTrace(bodyTraces, currentFT) {
        // Get all task IDs from the current trace
        const currentTaskIds = new Set(currentFT.map(task => task.id).filter(id => id));
        
        // Check if any body trace contains a task that's already in the current trace
        for (const bodyTrace of bodyTraces) {
            for (const task of bodyTrace) {
                if (task.id && currentTaskIds.has(task.id)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Loop Trace (LT_ct)
     * Ordered set created by union of recursive application of fp, starting at the cotree edge for ct,
     * with recursive application of fp, starting at the adjacent edge for ct
     * 
     * For workflows: detects cycles and applies bounded iteration
     * 
     * @param {Element} loopNode - Loop node
     * @param {Array<Object>} currentFT - Current forward trace set
     * @param {number} depth - Recursion depth
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker
     * @returns {Array<Array<Object>>} Array of loop trace arrays
     */
    static loopTrace(loopNode, currentFT, depth, maxLoopIterations, timeoutChecker) {
        if (timeoutChecker) {
            timeoutChecker.check();
        }
        
        const children = TopologyIterators.forwardIterator(loopNode)
            .filter(child => child.tagName.toLowerCase() !== 'condition');
        
        // Process loop body to get body traces
        const bodyTraces = this.combineSequentialForwardTrace(
            children,
            [], // Start with empty FT for loop body
            depth + 1,
            maxLoopIterations,
            timeoutChecker
        );
        
        // Get the loop condition first to determine iteration behavior
        const condition = this.getLoopCondition(loopNode);
        
        // Determine if we should skip 0 iterations:
        // - If condition is exactly "true", skip 0 iterations (loop must execute at least once)
        // - UNLESS a task from the loop body is already in the current trace (allows exiting after one cycle)
        const isConditionTrue = condition === 'true';
        const hasBodyTaskAlreadyInTrace = this.hasBodyTaskInTrace(bodyTraces, currentFT);
        const shouldSkipZeroIterations = isConditionTrue && !hasBodyTaskAlreadyInTrace;
        
        // Check if any body trace ends with escape - if so, we may need at least 2 iterations
        // to capture the "iterate normally then escape" pattern
        const hasEscapePath = bodyTraces.some(trace => trace._terminatedByEscape === true);
        
        // Check if loop node is a cotree edge (creates a cycle)
        const loopNodeId = loopNode.getAttribute('id');
        const isCotreeEdge = loopNodeId ? 
            TopologyIterators.cotreeIterator(loopNode, currentFT) : false;
        
        // Determine iteration limit based on cotree detection
        // If loop detected in forward trace (cotree edge), limit iterations
        const iterationLimit = isCotreeEdge ? 1 : maxLoopIterations;
        
        // Only increase iterations for escape paths if the loop CAN be skipped (0 iterations allowed)
        // For mandatory loops (condition="true", no body tasks in trace), don't inflate iterations
        // as it would cause exponential trace explosion
        const minIterForEscape = (hasEscapePath && !shouldSkipZeroIterations) ? 2 : 1;
        const maxIter = Math.max(Math.min(iterationLimit, 2), minIterForEscape);
        
        // Check if we increased to 2 iterations ONLY for escape pattern (not natural iteration limit)
        // If so, the 2nd iteration should ONLY use escape-terminated body traces
        // EXCEPTION: If there are multiple distinct non-escape paths in XOR, allow all combinations
        // (e.g., XOR with "Abgelehnt" + "Genehmigt" + "escape" should allow "Abgelehnt + Genehmigt")
        const nonEscapeTraces = bodyTraces.filter(t => !t._terminatedByEscape);
        const hasMultipleNonEscapePaths = nonEscapeTraces.length > 1;
        const secondIterationIsForEscapeOnly = iterationLimit < 2 && minIterForEscape >= 2 && !hasMultipleNonEscapePaths;
        
        const result = [];
        
        // 0 iterations (condition false from start, or loop can be skipped)
        if (!shouldSkipZeroIterations) {
            // Return current forward trace (no loop execution)
            result.push([...currentFT]);
        }
        
        // 1 iteration
        if (maxIter >= 1) {
            // Combine current FT with body traces
            for (const bodyTrace of bodyTraces) {
                // Combine traces
                const combinedTrace = [...currentFT, ...bodyTrace];
                // Preserve termination flag from body trace
                if (bodyTrace._terminatedByEscape) {
                    combinedTrace._terminatedByEscape = true;
                }
                result.push(combinedTrace);
            }
        }
        
        // 2 iterations (if allowed)
        if (maxIter >= 2) {
            // For 2 iterations, combine body traces twice
            // But only if first iteration wasn't terminated
            for (const bodyTrace1 of bodyTraces) {
                // If first iteration was terminated, don't add second iteration
                if (bodyTrace1._terminatedByEscape) {
                    // Trace already ended in first iteration, don't add second
                    continue;
                }
                for (const bodyTrace2 of bodyTraces) {
                    // Skip if 2nd iteration is same branch as 1st (don't repeat same XOR branch)
                    if (bodyTrace1 === bodyTrace2) {
                        continue;
                    }
                    // If we increased iterations ONLY for escape, skip non-escape 2nd iterations
                    // (the point was to capture "iterate then escape", not "iterate then iterate")
                    if (secondIterationIsForEscapeOnly && !bodyTrace2._terminatedByEscape) {
                        continue;
                    }
                    // Combine traces
                    const combinedTrace = [...currentFT, ...bodyTrace1, ...bodyTrace2];
                    // Preserve termination flag from second iteration
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
     * Combine Sequential Forward Trace
     * Implements sequential processing where each child receives accumulated trace set
     * from previous children (GTA forward trace accumulation)
     * 
     * @param {Array<Element>} children - Child nodes to process
     * @param {Array<Object>} initialFT - Initial forward trace set
     * @param {number} depth - Recursion depth
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker
     * @returns {Array<Array<Object>>} Combined trace arrays
     */
    static combineSequentialForwardTrace(children, initialFT, depth, maxLoopIterations, timeoutChecker) {
        if (children.length === 0) {
            return [[...initialFT]];
        }
        
        // Start with initial forward trace set
        let currentTraces = [[...initialFT]];
        
        // Process each child sequentially, accumulating forward trace set
        for (const child of children) {
            if (timeoutChecker) {
                timeoutChecker.check();
            }
            
            const newTraces = [];
            
            // For each current trace, process child and accumulate
            for (const currentTrace of currentTraces) {
                if (timeoutChecker) {
                    timeoutChecker.check();
                }
                
                // Check if trace was terminated by escape
                const isTerminated = currentTrace._terminatedByEscape === true;
                
                if (isTerminated) {
                    // If terminated, don't process further children
                    newTraces.push(currentTrace);
                } else {
                    // Process child with current accumulated trace set
                    const childTraces = this.forwardTrace(
                        child,
                        currentTrace,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker
                    );
                    
                    // Accumulate child traces
                    for (const childTrace of childTraces) {
                        if (timeoutChecker) {
                            timeoutChecker.check();
                        }
                        
                        // Preserve termination flag
                        if (childTrace._terminatedByEscape) {
                            newTraces.push(childTrace);
                        } else {
                            newTraces.push(childTrace);
                        }
                    }
                }
            }
            
            currentTraces = newTraces;
        }
        
        return currentTraces;
    }
}

/**
 * GTA Trace Sets for Validation Mode
 * Same as TraceSets but with permissive rules:
 * - No semantic restrictions on loop conditions
 * - Allows 0 iterations for any loop regardless of condition
 */
class TraceSetsValidation {
    /**
     * Forward Trace for Validation (permissive mode)
     * Same as TraceSets.forwardTrace but without semantic restrictions
     */
    static forwardTrace(node, currentFT, depth, maxLoopIterations, timeoutChecker) {
        if (timeoutChecker) {
            timeoutChecker.check();
        }
        
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
        
        switch (tagName) {
            case 'call':
            case 'manipulate':
            case 'script': {
                const task = CPEETraceCalculator.extractTask(node);
                if (!task) {
                    return [];
                }
                const newFT = [...currentFT, task];
                return [newFT];
            }
            
            case 'description': {
                return this.combineSequentialForwardTrace(
                    TopologyIterators.forwardIterator(node),
                    currentFT,
                    depth,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'choose': {
                const alternatives = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return tag === 'alternative' || tag === 'otherwise';
                    });
                
                if (alternatives.length === 0) {
                    return [];
                }
                
                const alternativeTraces = alternatives.flatMap(alt => 
                    this.forwardTrace(alt, currentFT, depth + 1, maxLoopIterations, timeoutChecker)
                );
                
                return alternativeTraces;
            }
            
            case 'otherwise': {
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return !tag.startsWith('_') && tag !== 'condition';
                    });
                
                if (children.length === 0) {
                    return [currentFT];
                }
                
                return this.combineSequentialForwardTrace(
                    children,
                    currentFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'alternative': {
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => {
                        const tag = child.tagName.toLowerCase();
                        return !tag.startsWith('_') && tag !== 'condition';
                    });
                
                const escapeIndex = children.findIndex(child => {
                    if (child.tagName.toLowerCase() !== 'escape') {
                        return false;
                    }
                    const altId = child.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') || 
                                  child.getAttribute('a:alt_id') ||
                                  child.getAttribute('alt_id');
                    return altId === '-1' || altId === null || altId === undefined;
                });
                
                if (escapeIndex !== -1) {
                    const beforeEscape = children.slice(0, escapeIndex);
                    if (beforeEscape.length > 0) {
                        const traces = this.combineSequentialForwardTrace(
                            beforeEscape,
                            currentFT,
                            depth + 1,
                            maxLoopIterations,
                            timeoutChecker
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
                } else {
                    return this.combineSequentialForwardTrace(
                        children,
                        currentFT,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker
                    );
                }
            }
            
            case 'parallel': {
                const branches = TopologyIterators.forwardIterator(node)
                    .filter(child => child.tagName.toLowerCase() === 'parallel_branch');
                
                if (branches.length === 0) {
                    return [];
                }
                
                const branchTraces = branches.map(branch => 
                    this.forwardTrace(branch, currentFT, depth + 1, maxLoopIterations, timeoutChecker)
                );
                
                const branchSpecificTraces = branchTraces.map(branchTraceArray => 
                    branchTraceArray.map(trace => {
                        const prefixLength = currentFT.length;
                        return trace.slice(prefixLength);
                    })
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
                    children,
                    currentFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'loop': {
                // Permissive loop handling - no semantic restrictions
                return this.loopTracePermissive(
                    node,
                    currentFT,
                    depth,
                    maxLoopIterations,
                    timeoutChecker
                );
            }
            
            case 'escape': {
                return [];
            }
            
            default: {
                const children = TopologyIterators.forwardIterator(node);
                if (children.length > 0) {
                    return this.combineSequentialForwardTrace(
                        children,
                        currentFT,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker
                    );
                }
                return [];
            }
        }
    }

    /**
     * Permissive Loop Trace - no semantic restrictions
     * Always allows 0 iterations regardless of condition
     * Allows up to maxLoopIterations iterations
     */
    static loopTracePermissive(loopNode, currentFT, depth, maxLoopIterations, timeoutChecker) {
        if (timeoutChecker) {
            timeoutChecker.check();
        }
        
        const children = TopologyIterators.forwardIterator(loopNode)
            .filter(child => child.tagName.toLowerCase() !== 'condition');
        
        // Process loop body to get body traces
        const bodyTraces = this.combineSequentialForwardTrace(
            children,
            [],
            depth + 1,
            maxLoopIterations,
            timeoutChecker
        );
        
        // Check if any body trace ends with escape - if so, we need at least 2 iterations
        // to capture the "iterate normally then escape" pattern
        const hasEscapePath = bodyTraces.some(trace => trace._terminatedByEscape === true);
        const minIterForEscape = hasEscapePath ? 2 : 1;
        const effectiveMaxIter = Math.max(maxLoopIterations, minIterForEscape);
        
        const result = [];
        
        // Always allow 0 iterations (no semantic restriction)
        result.push([...currentFT]);
        
        // Generate traces for 1 to effectiveMaxIter iterations
        for (let iter = 1; iter <= effectiveMaxIter; iter++) {
            // Generate all combinations of body traces for this iteration count
            const iterationCombinations = this.generateIterationCombinations(
                bodyTraces, 
                iter, 
                currentFT, 
                timeoutChecker
            );
            result.push(...iterationCombinations);
        }
        
        return result;
    }

    /**
     * Generate all combinations of loop body traces for a given iteration count
     */
    static generateIterationCombinations(bodyTraces, iterationCount, prefix, timeoutChecker) {
        if (iterationCount === 0) {
            return [[...prefix]];
        }
        
        if (iterationCount === 1) {
            return bodyTraces.map(bodyTrace => {
                const combined = [...prefix, ...bodyTrace];
                if (bodyTrace._terminatedByEscape) {
                    combined._terminatedByEscape = true;
                }
                return combined;
            });
        }
        
        // For multiple iterations, combine body traces
        const results = [];
        
        for (const firstBodyTrace of bodyTraces) {
            if (timeoutChecker) {
                timeoutChecker.check();
            }
            
            // If first iteration was terminated, don't add more iterations
            if (firstBodyTrace._terminatedByEscape) {
                const combined = [...prefix, ...firstBodyTrace];
                combined._terminatedByEscape = true;
                results.push(combined);
                continue;
            }
            
            // Recursively get combinations for remaining iterations
            const remainingCombinations = this.generateIterationCombinations(
                bodyTraces,
                iterationCount - 1,
                [...prefix, ...firstBodyTrace],
                timeoutChecker
            );
            results.push(...remainingCombinations);
        }
        
        return results;
    }

    /**
     * Combine Sequential Forward Trace (same as TraceSets)
     */
    static combineSequentialForwardTrace(children, initialFT, depth, maxLoopIterations, timeoutChecker) {
        if (children.length === 0) {
            return [[...initialFT]];
        }
        
        let currentTraces = [[...initialFT]];
        
        for (const child of children) {
            if (timeoutChecker) {
                timeoutChecker.check();
            }
            
            const newTraces = [];
            
            for (const currentTrace of currentTraces) {
                if (timeoutChecker) {
                    timeoutChecker.check();
                }
                
                const isTerminated = currentTrace._terminatedByEscape === true;
                
                if (isTerminated) {
                    newTraces.push(currentTrace);
                } else {
                    const childTraces = this.forwardTrace(
                        child,
                        currentTrace,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker
                    );
                    
                    for (const childTrace of childTraces) {
                        if (timeoutChecker) {
                            timeoutChecker.check();
                        }
                        newTraces.push(childTrace);
                    }
                }
            }
            
            currentTraces = newTraces;
        }
        
        return currentTraces;
    }
}

export class CPEETraceCalculator {
    /**
     * Calculate all possible execution traces from CPEE XML using GTA approach
     * @param {string} xmlString - CPEE XML content
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(xmlString, options = {}) {
        const maxLoopIterations = options.maxLoopIterations !== undefined 
            ? options.maxLoopIterations 
            : MAX_LOOP_ITERATIONS;
        
        const timeoutChecker = new TimeoutChecker(TIMEOUT_MS);
        
        try {
            // Preprocess CPEE XML before calculating traces
            let preprocessedXml = xmlString;
            try {
                const preprocessResult = CPEEParser.cleanAndValidate(xmlString, true);
                preprocessedXml = preprocessResult.xml;
            } catch (error) {
                console.warn('[CPEETraceCalculator] Failed to preprocess CPEE XML, using original:', error);
                // Fallback to original XML if preprocessing fails
            }
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(preprocessedXml, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.warn('[CPEETraceCalculator] XML parsing error:', parserError.textContent);
                return [];
            }
            
            // Get root description element (reference source)
            const description = xmlDoc.querySelector('description') || xmlDoc.documentElement;
            if (!description) {
                console.warn('[CPEETraceCalculator] No description element found');
                return [];
            }
            
            // Initialize forward trace set: FT = [] (empty set)
            const initialForwardTrace = [];
            
            // Calculate traces using GTA forward trace
            const traceArrays = TraceSets.forwardTrace(
                description,
                initialForwardTrace,
                0,
                maxLoopIterations,
                timeoutChecker
            );
            
            // Filter duplicate traces
            const uniqueTraces = this.filterDuplicateTraces(traceArrays);
            
            // Convert to Trace objects
            const traces = uniqueTraces.map((path, index) => {
                const trace = new Trace(
                    `trace-${index + 1}`,
                    path,
                    this.determineTraceType(path)
                );
                return trace;
            });
            
            return traces;
            
        } catch (error) {
            console.error('[CPEETraceCalculator] Error calculating traces:', error);
            if (error.message && error.message.includes('exceeded') && error.message.includes('timeout')) {
                throw error;
            }
            return [];
        }
    }

    /**
     * Parallel interleaving (permutations of branch order)
     * Each branch is treated as a single unit - tasks within a branch stay together
     * @param {Array<Array<Array<Object>>>} branches - Array of branch trace sets
     *   Each branch is an array of traces, where each trace is an array of tasks
     * @param {TimeoutChecker} timeoutChecker - Timeout checker instance
     * @returns {Array<Array<Object>>} All trace arrays with branch permutations
     */
    static interleave(branches, timeoutChecker = null) {
        if (branches.length === 0) {
            return [[]];
        }
        if (branches.length === 1) {
            return branches[0];
        }
        
        if (timeoutChecker) {
            timeoutChecker.check();
        }
        
        // Generate all permutations of branch indices
        const branchIndices = branches.map((_, i) => i);
        const permutations = this.permuteArray(branchIndices, timeoutChecker);
        
        const result = [];
        
        // For each permutation, combine traces from branches in that order
        for (const perm of permutations) {
            if (timeoutChecker) {
                timeoutChecker.check();
            }
            
            // Get trace arrays for each branch in permutation order
            // branches[perm[i]] is an array of traces for that branch
            const branchTraceArrays = perm.map(idx => branches[idx]);
            
            // Take cartesian product: one trace from each branch
            // Each branchTraceArray is an array of traces, so we need to combine them
            const combinations = this.cartesianProduct(branchTraceArrays, timeoutChecker);
            
            // For each combination, concatenate the traces in order
            // Each combination is an array of traces (one from each branch)
            for (const combination of combinations) {
                if (timeoutChecker) {
                    timeoutChecker.check();
                }
                // Each element in combination is a trace (array of tasks)
                // Concatenate all tasks from all traces in the combination
                const concatenated = combination.flat();
                result.push(concatenated);
            }
        }
        
        return result;
    }

    /**
     * Generate all permutations of an array
     * @param {Array} arr - Input array
     * @param {TimeoutChecker} timeoutChecker - Timeout checker instance
     * @returns {Array<Array>} All permutations
     */
    static permuteArray(arr, timeoutChecker = null) {
        if (arr.length <= 1) {
            return [arr];
        }
        
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            if (timeoutChecker) {
                timeoutChecker.check();
            }
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const restPerms = this.permuteArray(rest, timeoutChecker);
            for (const perm of restPerms) {
                if (timeoutChecker) {
                    timeoutChecker.check();
                }
                result.push([arr[i], ...perm]);
            }
        }
        return result;
    }

    /**
     * Cartesian product of arrays
     * @param {Array<Array>} arrays - Array of arrays
     * @param {TimeoutChecker} timeoutChecker - Timeout checker instance
     * @returns {Array<Array>} All combinations
     */
    static cartesianProduct(arrays, timeoutChecker = null) {
        if (arrays.length === 0) {
            return [[]];
        }
        
        return arrays.reduce((acc, next) => {
            const result = [];
            for (const a of acc) {
                if (timeoutChecker) {
                    timeoutChecker.check();
                }
                for (const b of next) {
                    if (timeoutChecker) {
                        timeoutChecker.check();
                    }
                    result.push([...a, b]);
                }
            }
            return result;
        }, [[]]);
    }

    /**
     * Extract task information from call/manipulate/script node
     * @param {Element} callNode - Task element
     * @returns {Object|null} Task object: {id, alt_id, task} or null
     */
    static extractTask(callNode) {
        try {
            const id = callNode.getAttribute('id');
            if (!id) {
                return null;
            }
            
            const altId = callNode.getAttribute('a:alt_id') || 
                          callNode.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') ||
                          null;
            
            let label = '';
            
            // First, check for label attribute on the element itself (used by manipulate/script)
            const labelAttr = callNode.getAttribute('label');
            if (labelAttr) {
                label = labelAttr.trim();
            }
            
            // If no label attribute, check for label in parameters (used by call)
            if (!label) {
                const labelElement = callNode.querySelector('parameters > label');
                if (labelElement) {
                    label = labelElement.textContent.trim();
                    // Remove surrounding quotes if present
                    if ((label.startsWith('"') && label.endsWith('"')) || 
                        (label.startsWith("'") && label.endsWith("'"))) {
                        label = label.slice(1, -1);
                    }
                    // Clean up task label - remove XML artifacts
                    label = label.replace(/"?\s*\)\s*&\s*\d+:task:\(\s*"?/g, ', ');
                    label = label.replace(/"([^"]+)"/g, '$1');
                    label = label.replace(/,+/g, ',').replace(/,\s*,/g, ',').replace(/,\s*$/g, '');
                    label = label.trim();
                }
            }
            
            return {
                id: id,
                alt_id: altId,
                task: label
            };
        } catch (error) {
            console.error('[CPEETraceCalculator] Error extracting task:', error);
            return null;
        }
    }

    /**
     * Fix common XML issues
     * @param {string} xmlString - XML string to fix
     * @returns {string} Fixed XML string
     */
    static fixXMLIssues(xmlString) {
        let fixedXml = xmlString;
        
        // Escape unescaped < and > in attribute values
        fixedXml = fixedXml.replace(/=("([^"]*)<\s*([^"]*))"/g, (match) =>
            match.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        );
        
        fixedXml = fixedXml.replace(/=('([^']*)<\s*([^']*))'/g, (match) =>
            match.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        );
        
        // Fix comparison operators in condition attributes
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*<\s*([^"]*)"/g, 'condition="$1 &lt; $2"');
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*>\s*([^"]*)"/g, 'condition="$1 &gt; $2"');
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*<=\s*([^"]*)"/g, 'condition="$1 &lt;= $2"');
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*>=\s*([^"]*)"/g, 'condition="$1 &gt;= $2"');
        
        return fixedXml;
    }

    /**
     * Filter duplicate traces
     * @param {Array<Array<Object>>} traces - Array of trace arrays
     * @returns {Array<Array<Object>>} Array of unique trace arrays
     */
    static filterDuplicateTraces(traces) {
        const uniqueTraces = new Set();
        const result = [];
        
        for (const trace of traces) {
            // Create a clean copy without the _terminatedByEscape property for comparison
            const cleanTrace = trace.filter ? trace.filter(task => !task.escape) : [];
            
            // Skip empty traces
            if (cleanTrace.length === 0) {
                continue;
            }
            
            const traceString = JSON.stringify(cleanTrace.map(t => ({ id: t.id, alt_id: t.alt_id, task: t.task })));
            if (!uniqueTraces.has(traceString)) {
                uniqueTraces.add(traceString);
                result.push(cleanTrace);
            }
        }
        
        return result;
    }

    /**
     * Determine trace type based on path
     * @param {Array<Object>} path - Path array
     * @returns {string} Trace type
     */
    static determineTraceType(path) {
        // Check if path contains loops (repeated nodes)
        const nodeIds = path.map(t => t.id);
        const uniqueNodes = new Set(nodeIds);
        if (nodeIds.length > uniqueNodes.size) {
            return 'loop';
        }
        return 'sequential';
    }

    /**
     * Validate if a trace sequence is a valid navigable path in the CPEE graph
     * 
     * This method checks if a given sequence of task identifiers (alt_id or id)
     * can be executed as a valid path through the CPEE workflow graph.
     * 
     * Uses permissive settings for validation:
     * - Higher max loop iterations (to allow traces with multiple loop cycles)
     * - No semantic restrictions (loops with condition "true" can execute 0 times)
     * 
     * @param {string} xmlString - CPEE XML content
     * @param {Array<string>} traceSequence - Array of task identifiers (alt_id or id values)
     * @param {Object} options - Validation options
     * @returns {Object} Validation result: { valid: boolean, matchedPath: Array|null, reason: string|null }
     */
    static validateTrace(xmlString, traceSequence, options = {}) {
        if (!traceSequence || traceSequence.length === 0) {
            return { valid: false, matchedPath: null, reason: 'Empty trace sequence' };
        }

        try {
            // Calculate all possible traces with permissive settings for validation
            // Use higher loop iterations and disable semantic restrictions
            const validationOptions = {
                ...options,
                maxLoopIterations: 3,  // Allow up to 3 loop iterations for validation
                validationMode: true   // Enable permissive validation mode
            };
            
            const allTraces = this.calculateAllTracesForValidation(xmlString, validationOptions);
            
            if (allTraces.length === 0) {
                return { valid: false, matchedPath: null, reason: 'No traces could be calculated from CPEE graph' };
            }

            // Check if any calculated trace matches the input sequence
            for (const trace of allTraces) {
                if (this.traceMatchesSequence(trace, traceSequence)) {
                    return { 
                        valid: true, 
                        matchedPath: trace.path,
                        reason: null 
                    };
                }
            }

            return { valid: false, matchedPath: null, reason: 'Trace sequence does not match any valid path in CPEE graph' };

        } catch (error) {
            console.error('[CPEETraceCalculator] Error validating trace:', error);
            return { valid: false, matchedPath: null, reason: `Validation error: ${error.message}` };
        }
    }

    /**
     * Calculate all traces with permissive settings for validation purposes
     * Uses higher loop iterations and disables semantic restrictions
     * 
     * @param {string} xmlString - CPEE XML content
     * @param {Object} options - Calculation options
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTracesForValidation(xmlString, options = {}) {
        const maxLoopIterations = options.maxLoopIterations !== undefined 
            ? options.maxLoopIterations 
            : 3; // Higher default for validation
        
        // Use longer timeout for validation since we calculate more traces
        const timeoutMs = options.timeout || 5000;
        const timeoutChecker = new TimeoutChecker(timeoutMs);
        
        try {
            // Preprocess CPEE XML before calculating traces
            let preprocessedXml = xmlString;
            try {
                const preprocessResult = CPEEParser.cleanAndValidate(xmlString, true);
                preprocessedXml = preprocessResult.xml;
            } catch (error) {
                console.warn('[CPEETraceCalculator] Failed to preprocess CPEE XML, using original:', error);
            }
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(preprocessedXml, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.warn('[CPEETraceCalculator] XML parsing error:', parserError.textContent);
                return [];
            }
            
            // Get root description element
            const description = xmlDoc.querySelector('description') || xmlDoc.documentElement;
            if (!description) {
                console.warn('[CPEETraceCalculator] No description element found');
                return [];
            }
            
            // Initialize forward trace set
            const initialForwardTrace = [];
            
            // Calculate traces using GTA forward trace with validation mode
            const traceArrays = TraceSetsValidation.forwardTrace(
                description,
                initialForwardTrace,
                0,
                maxLoopIterations,
                timeoutChecker
            );
            
            // Filter duplicate traces
            const uniqueTraces = this.filterDuplicateTraces(traceArrays);
            
            // Convert to Trace objects
            const traces = uniqueTraces.map((path, index) => {
                const trace = new Trace(
                    `trace-${index + 1}`,
                    path,
                    this.determineTraceType(path)
                );
                return trace;
            });
            
            return traces;
            
        } catch (error) {
            console.error('[CPEETraceCalculator] Error calculating traces for validation:', error);
            if (error.message && error.message.includes('exceeded') && error.message.includes('timeout')) {
                throw error;
            }
            return [];
        }
    }

    /**
     * Check if a calculated trace matches a given sequence of identifiers
     * @param {Trace} trace - Calculated Trace object
     * @param {Array<string>} sequence - Array of task identifiers to match
     * @returns {boolean} True if trace matches the sequence
     */
    static traceMatchesSequence(trace, sequence) {
        if (!trace || !trace.path || trace.path.length !== sequence.length) {
            return false;
        }

        for (let i = 0; i < sequence.length; i++) {
            const task = trace.path[i];
            const seqId = sequence[i];

            // Match against alt_id (primary) or id (fallback)
            const taskAltId = task.alt_id !== undefined && task.alt_id !== null 
                ? String(task.alt_id) 
                : null;
            const taskId = task.id !== undefined && task.id !== null 
                ? String(task.id) 
                : null;

            const seqIdStr = String(seqId);

            // Check if sequence ID matches either alt_id or id
            if (seqIdStr !== taskAltId && seqIdStr !== taskId) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate multiple trace sequences against a CPEE graph
     * Uses permissive settings (higher loop iterations, no semantic restrictions)
     * 
     * @param {string} xmlString - CPEE XML content
     * @param {Array<Array<string>>} traceSequences - Array of trace sequences to validate
     * @param {Object} options - Validation options
     * @returns {Object} Validation results: { validCount, invalidCount, results: Array<{sequence, valid, matchedPath, reason}> }
     */
    static validateMultipleTraces(xmlString, traceSequences, options = {}) {
        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        // Calculate all traces once with permissive settings for efficiency
        let allTraces;
        try {
            const validationOptions = {
                ...options,
                maxLoopIterations: 3,  // Allow up to 3 loop iterations for validation
                validationMode: true
            };
            allTraces = this.calculateAllTracesForValidation(xmlString, validationOptions);
        } catch (error) {
            console.error('[CPEETraceCalculator] Error calculating traces for validation:', error);
            return {
                validCount: 0,
                invalidCount: traceSequences.length,
                results: traceSequences.map(seq => ({
                    sequence: seq,
                    valid: false,
                    matchedPath: null,
                    reason: `Calculation error: ${error.message}`
                }))
            };
        }

        for (const sequence of traceSequences) {
            let found = false;
            let matchedPath = null;

            for (const trace of allTraces) {
                if (this.traceMatchesSequence(trace, sequence)) {
                    found = true;
                    matchedPath = trace.path;
                    break;
                }
            }

            if (found) {
                validCount++;
                results.push({
                    sequence,
                    valid: true,
                    matchedPath,
                    reason: null
                });
            } else {
                invalidCount++;
                results.push({
                    sequence,
                    valid: false,
                    matchedPath: null,
                    reason: 'Trace sequence does not match any valid path'
                });
            }
        }

        return { validCount, invalidCount, results };
    }
}
