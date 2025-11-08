/**
 * CPEE Trace Calculator
 * Calculates all possible execution traces (paths) from CPEE XML workflow
 * Uses graph traversal algorithm based on node types
 */

import { Trace } from '../../models/Trace.js';

// Global constant for maximum loop iterations (default: 1)
const MAX_LOOP_ITERATIONS = 1;

export class CPEETraceCalculator {
    /**
     * Calculate all possible execution traces from CPEE XML
     * @param {string} xmlString - CPEE XML content
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(xmlString, options = {}) {
        console.log('[CPEETraceCalculator] Starting trace calculation from CPEE XML...');
        
        const maxLoopIterations = options.maxLoopIterations !== undefined 
            ? options.maxLoopIterations 
            : MAX_LOOP_ITERATIONS;
        
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
            
            console.log('[CPEETraceCalculator] XML parsed successfully');
            
            // Get root description element
            const description = xmlDoc.querySelector('description') || xmlDoc.documentElement;
            if (!description) {
                console.warn('[CPEETraceCalculator] No description element found');
                return [];
            }
            
            // Calculate traces using graph traversal
            const traceArrays = this.traces(description, 0, maxLoopIterations);
            
            // Filter duplicate traces
            const uniqueTraces = this.filterDuplicateTraces(traceArrays);
            
            // Convert to Trace objects
            const traces = uniqueTraces.map((path, index) => {
                const trace = new Trace(`trace-${index + 1}`, path, this.determineTraceType(path));
                return trace;
            });
            
            console.log(`[CPEETraceCalculator] Calculated ${traces.length} unique traces`);
            return traces;
            
        } catch (error) {
            console.error('[CPEETraceCalculator] Error calculating traces:', error);
            return [];
        }
    }

    /**
     * Main graph traversal function
     * Returns array of trace arrays (each trace is an array of task objects)
     * @param {Element} node - XML node to process
     * @param {number} depth - Current depth (for debugging)
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @returns {Array<Array<Object>>} Array of trace arrays
     */
    static traces(node, depth = 0, maxLoopIterations = MAX_LOOP_ITERATIONS) {
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
        
        switch (tagName) {
            case 'call':
            case 'manipulate':
            case 'script': {
                const task = this.extractTask(node);
                if (task) {
                    return [[task]];
                }
                return [];
            }
            
            case 'description': {
                const children = Array.from(node.children);
                const childTraces = children.map(child => this.traces(child, depth + 1, maxLoopIterations));
                return this.combineSequential(childTraces);
            }
            
            case 'choose': {
                const alternatives = Array.from(node.children)
                    .filter(child => child.tagName.toLowerCase() === 'alternative');
                if (alternatives.length === 0) {
                    return [];
                }
                const alternativeTraces = alternatives.map(alt => this.traces(alt, depth + 1, maxLoopIterations));
                return this.union(alternativeTraces);
            }
            
            case 'alternative': {
                const children = Array.from(node.children).filter(child => 
                    child.tagName.toLowerCase() !== 'condition'
                );
                
                // Check if there's an escape in this alternative
                const escapeIndex = children.findIndex(child => child.tagName.toLowerCase() === 'escape');
                
                if (escapeIndex !== -1) {
                    // Process elements before escape, then terminate
                    const beforeEscape = children.slice(0, escapeIndex);
                    if (beforeEscape.length > 0) {
                        const beforeEscapeTraces = beforeEscape.map(child => this.traces(child, depth + 1, maxLoopIterations));
                        const combined = this.combineSequential(beforeEscapeTraces);
                        // Mark traces as terminated by escape
                        return combined.map(trace => {
                            trace._terminatedByEscape = true;
                            return trace;
                        });
                    } else {
                        // Escape is first - return empty trace marked as terminated
                        const emptyTrace = [];
                        emptyTrace._terminatedByEscape = true;
                        return [emptyTrace];
                    }
                } else {
                    // No escape - process normally
                    const childTraces = children.map(child => this.traces(child, depth + 1, maxLoopIterations));
                    return this.combineSequential(childTraces);
                }
            }
            
            case 'parallel': {
                const branches = Array.from(node.children)
                    .filter(child => child.tagName.toLowerCase() === 'parallel_branch');
                if (branches.length === 0) {
                    return [];
                }
                const branchTraces = branches.map(branch => this.traces(branch, depth + 1, maxLoopIterations));
                return this.interleave(branchTraces);
            }
            
            case 'parallel_branch': {
                const children = Array.from(node.children).filter(child => 
                    child.tagName.toLowerCase() !== 'condition'
                );
                const childTraces = children.map(child => this.traces(child, depth + 1, maxLoopIterations));
                return this.combineSequential(childTraces);
            }
            
            case 'loop': {
                const children = Array.from(node.children).filter(child => 
                    child.tagName.toLowerCase() !== 'condition'
                );
                const bodyTraces = this.combineSequential(children.map(child => this.traces(child, depth + 1, maxLoopIterations)));
                
                // Unroll 0, 1, 2 times (but bounded by maxLoopIterations)
                const maxIter = Math.min(maxLoopIterations, 2);
                const result = [];
                
                // Check if loop is directly connected to end (no next sibling)
                const isLastElement = node.nextElementSibling === null;
                
                // Check if loop is directly before closing XOR gateway (last element in choose/alternative)
                const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
                const isBeforeClosingXor = isLastElement && (parentTag === 'choose' || parentTag === 'alternative');
                
                // Check if loop is indirectly connected to end (e.g., inside another loop)
                const isInsideLoop = parentTag === 'loop';
                
                // 0 iterations (empty trace) - allow if:
                // - Not directly connected to end (has siblings), OR
                // - Indirectly connected to end via another loop gateway (nested inside a loop)
                // Skip only if directly connected to end or closing XOR gateway
                if ((!isLastElement || isInsideLoop) && !isBeforeClosingXor) {
                    result.push([]);
                }
                
                // 1 iteration
                if (maxIter >= 1) {
                    result.push(...bodyTraces);
                }
                
                // 2 iterations (if allowed)
                if (maxIter >= 2) {
                    result.push(...this.combineSequential([bodyTraces, bodyTraces]));
                }
                
                return result;
            }
            
            case 'escape': {
                // Escape terminates trace early - return empty trace marked as terminated
                // This will be handled by the parent (alternative) to stop processing
                return [];
            }
            
            default: {
                // For unknown elements, try to process children
                if (node.children && node.children.length > 0) {
                    const children = Array.from(node.children);
                    const childTraces = children.map(child => this.traces(child, depth + 1, maxLoopIterations));
                    return this.combineSequential(childTraces);
                }
                return [];
            }
        }
    }

    /**
     * Cartesian product concatenation
     * Combines sequences sequentially (each trace from first set concatenated with each trace from second set)
     * @param {Array<Array<Array<Object>>>} listOfTraceSets - Array of trace set arrays
     * @returns {Array<Array<Object>>} Combined trace arrays
     */
    static combineSequential(listOfTraceSets) {
        if (listOfTraceSets.length === 0) {
            return [[]];
        }
        
        return listOfTraceSets.reduce(
            (acc, next) => {
                // acc is array of traces (each trace is array of tasks)
                // next is array of traces (each trace is array of tasks)
                // For each trace in acc, concatenate with each trace in next
                const result = [];
                for (const a of acc) {
                    // Check if trace was terminated by escape
                    const aTerminated = a._terminatedByEscape === true;
                    
                    if (aTerminated) {
                        // If trace was terminated, don't append next - just keep the trace as is
                        result.push(a);
                    } else {
                        for (const b of next) {
                            // Check if next trace was terminated
                            const bTerminated = b._terminatedByEscape === true;
                            
                            // Create new trace by concatenating
                            const newTrace = [...a, ...b];
                            if (bTerminated) {
                                newTrace._terminatedByEscape = true;
                            }
                            result.push(newTrace);
                        }
                    }
                }
                return result;
            },
            [[]] // Start with empty trace
        );
    }

    /**
     * Parallel interleaving (permutations of branch order)
     * Each branch is treated as a single unit - tasks within a branch stay together
     * @param {Array<Array<Array<Object>>>} branches - Array of branch trace sets
     * @returns {Array<Array<Object>>} All trace arrays with branch permutations
     */
    static interleave(branches) {
        if (branches.length === 0) {
            return [[]];
        }
        if (branches.length === 1) {
            return branches[0];
        }
        
        // Generate all permutations of branch indices
        const branchIndices = branches.map((_, i) => i);
        const permutations = this.permuteArray(branchIndices);
        
        const result = [];
        
        // For each permutation, combine traces from branches in that order
        for (const perm of permutations) {
            // Get one trace from each branch (cartesian product)
            const branchTraces = perm.map(idx => branches[idx]);
            const combinations = this.cartesianProduct(branchTraces);
            
            // For each combination, concatenate the traces in order
            for (const combination of combinations) {
                const concatenated = combination.flat();
                result.push(concatenated);
            }
        }
        
        return result;
    }

    /**
     * Generate all permutations of an array
     * @param {Array} arr - Input array
     * @returns {Array<Array>} All permutations
     */
    static permuteArray(arr) {
        if (arr.length <= 1) {
            return [arr];
        }
        
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const restPerms = this.permuteArray(rest);
            for (const perm of restPerms) {
                result.push([arr[i], ...perm]);
            }
        }
        return result;
    }

    /**
     * Cartesian product of arrays
     * @param {Array<Array>} arrays - Array of arrays
     * @returns {Array<Array>} All combinations
     */
    static cartesianProduct(arrays) {
        if (arrays.length === 0) {
            return [[]];
        }
        
        return arrays.reduce((acc, next) => {
            const result = [];
            for (const a of acc) {
                for (const b of next) {
                    result.push([...a, b]);
                }
            }
            return result;
        }, [[]]);
    }

    /**
     * Union of trace sets (flatten array of trace arrays)
     * @param {Array<Array<Array<Object>>>} listOfTraceSets - Array of trace set arrays
     * @returns {Array<Array<Object>>} Flattened trace arrays
     */
    static union(listOfTraceSets) {
        return listOfTraceSets.flat();
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
                // Clean up task label - remove XML artifacts like ") & 9:task:("
                label = label.replace(/"?\s*\)\s*&\s*\d+:task:\(\s*"?/g, ', ');
                // Remove any remaining quotes around individual items
                label = label.replace(/"([^"]+)"/g, '$1');
                // Clean up any double commas or extra spaces
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
                // Return clean trace without the _terminatedByEscape property
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
