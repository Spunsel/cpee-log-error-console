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
                // XOR Gateway: union of alternatives
                const alternatives = TopologyIterators.forwardIterator(node)
                    .filter(child => child.tagName.toLowerCase() === 'alternative');
                
                if (alternatives.length === 0) {
                    return [];
                }
                
                // Process each alternative with same forward trace set
                const alternativeTraces = alternatives.flatMap(alt => 
                    this.forwardTrace(alt, currentFT, depth + 1, maxLoopIterations, timeoutChecker)
                );
                
                return alternativeTraces;
            }
            
            case 'alternative': {
                // Alternative branch: process children sequentially
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => child.tagName.toLowerCase() !== 'condition');
                
                // Check for escape
                const escapeIndex = children.findIndex(child => child.tagName.toLowerCase() === 'escape');
                
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
                const children = TopologyIterators.forwardIterator(node)
                    .filter(child => child.tagName.toLowerCase() !== 'condition');
                
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
        
        // Check if loop node is a cotree edge (creates a cycle)
        const loopNodeId = loopNode.getAttribute('id');
        const isCotreeEdge = loopNodeId ? 
            TopologyIterators.cotreeIterator(loopNode, currentFT) : false;
        
        // Get loop mode
        const mode = loopNode.getAttribute('mode')?.toLowerCase() || 'pre_test';
        
        // Determine iteration limit based on cotree detection
        // If loop detected in forward trace (cotree edge), limit iterations
        const iterationLimit = isCotreeEdge ? 1 : maxLoopIterations;
        const maxIter = Math.min(iterationLimit, 2);
        
        const result = [];
        
        // Check if loop is directly connected to end node
        const isLastElement = loopNode.nextElementSibling === null;
        const parentTag = loopNode.parentElement ? 
            loopNode.parentElement.tagName.toLowerCase() : '';
        const isDirectlyConnectedToEnd = isLastElement && parentTag === 'description';
        
        // 0 iterations (condition false from start)
        // Skip 0 iterations if loop is directly connected to end node
        if (!isDirectlyConnectedToEnd) {
            if (mode === 'pre_test' || mode === 'post_test') {
                // Return current forward trace (no loop execution)
                result.push([...currentFT]);
            } else {
                // Check if loop is before closing XOR
                const isBeforeClosingXor = isLastElement && 
                    (parentTag === 'choose' || parentTag === 'alternative');
                const isInsideLoop = parentTag === 'loop';
                
                if ((!isLastElement || isInsideLoop) && !isBeforeClosingXor) {
                    result.push([...currentFT]);
                }
            }
        }
        
        // 1 iteration
        if (maxIter >= 1) {
            // Combine current FT with body traces
            for (const bodyTrace of bodyTraces) {
                result.push([...currentFT, ...bodyTrace]);
            }
        }
        
        // 2 iterations (if allowed)
        if (maxIter >= 2) {
            // For 2 iterations, combine body traces twice
            for (const bodyTrace1 of bodyTraces) {
                for (const bodyTrace2 of bodyTraces) {
                    result.push([...currentFT, ...bodyTrace1, ...bodyTrace2]);
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
            // Fix common XML issues
            const fixedXml = this.fixXMLIssues(xmlString);
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fixedXml, 'text/xml');
            
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
}
