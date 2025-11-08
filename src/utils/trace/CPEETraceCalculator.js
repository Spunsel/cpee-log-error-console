/**
 * CPEE Trace Calculator
 * 
 * Calculates all possible execution traces (paths) from CPEE XML workflow using
 * a recursive graph traversal algorithm. The algorithm processes XML nodes based
 * on their type and combines traces using composition functions.
 * 
 * Algorithm Overview:
 * - Recursively traverses the XML tree starting from the root description element
 * - For each node type, applies specific trace generation logic:
 *   - call/manipulate/script: Extracts task and returns as single-element trace
 *   - description: Combines children traces sequentially (Cartesian product)
 *   - choose: Unions all alternative traces (exclusive choice)
 *   - alternative: Combines children traces sequentially
 *   - parallel: Interleaves all branch traces (all possible orderings of branches as atomic units)
 *   - parallel_branch: Combines children traces sequentially
 *   - loop: Unrolls loop body 0, 1, or 2 times (bounded by MAX_LOOP_ITERATIONS)
 *   - escape: Terminates trace early with escape marker
 * 
 * Key Features:
 * - Sequential composition: Cartesian product concatenation of trace sequences
 * - Parallel interleaving: Generates all possible orderings of parallel branches (branches treated as atomic units)
 * - Loop unrolling: Bounded iteration (default: 0 and 1 iterations)
 * - Escape handling: Stops appending tasks when escape is encountered
 * - End node handling: Excludes empty traces when loops are directly connected to end node
 * 
 * Helper Functions:
 * - combineSequential: Cartesian product concatenation with escape termination
 * - interleave: Generates all orderings of parallel branches (each branch treated as atomic unit)
 * - generatePermutations: Generates all permutations of an array
 * - cartesianProduct: Generates Cartesian product of arrays
 * - union: Flattens alternative trace sets
 * - extractTask: Extracts task information (id, alt_id, task) from call nodes
 */

import { Trace } from '../../models/Trace.js';

// Global variable for maximum loop iterations
const MAX_LOOP_ITERATIONS = 1;

    /**
 * Main entry point: Calculate all possible execution traces from CPEE XML
     * @param {string} xmlString - CPEE XML content
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @returns {Trace[]} Array of Trace objects
     */
export class CPEETraceCalculator {
    static calculateAllTraces(xmlString, options = {}) {
        console.log('[CPEETraceCalculator] Starting trace calculation from CPEE XML...');
        
        const {
            maxLoopIterations = MAX_LOOP_ITERATIONS
        } = options;

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
            // Root description is always "last" (connected to end node)
            const traceArrays = this.traces(description, 0, maxLoopIterations, true);
            
            // Filter out empty traces
            const nonEmptyTraces = traceArrays.filter(trace => trace.length > 0);
            
            // Filter duplicate traces
            const uniqueTraces = this.filterDuplicateTraces(nonEmptyTraces);
            
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
     * Recursive graph traversal function
     * Returns array of traces (each trace is an array of task objects)
     * @param {Element} node - XML node to process
     * @param {number} depth - Current depth (for debugging)
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {boolean} isLast - Whether this node is the last element in its parent
     * @param {boolean} isInRootDescription - Whether we're in the root description (for loop 0-iteration logic)
     * @returns {Array<Array<Object>>} Array of traces
     */
    static traces(node, depth = 0, maxLoopIterations = MAX_LOOP_ITERATIONS, isLast = false, isInRootDescription = true) {
        if (!node) {
            return [];
        }
        
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
                const childTraces = children.map((child, index) => {
                    const isLastChild = index === children.length - 1;
                    return this.traces(child, depth + 1, maxLoopIterations, isLastChild, isInRootDescription);
                });
                return this.combineSequential(childTraces);
                }
                
                case 'choose': {
                const alternatives = Array.from(node.querySelectorAll('alternative'));
                    if (alternatives.length === 0) {
                    return [[]];
                }
                const alternativeTraces = alternatives.map((alt, index) => {
                    const isLastAlt = index === alternatives.length - 1;
                    return this.traces(alt, depth + 1, maxLoopIterations, isLast && isLastAlt, false);
                });
                return this.union(alternativeTraces);
            }

            case 'alternative': {
                const children = Array.from(node.children).filter(child => {
                    const childTag = child.tagName ? child.tagName.toLowerCase() : '';
                    return childTag !== 'condition';
                });
                const childTraces = children.map((child, index) => {
                    const isLastChild = index === children.length - 1;
                    return this.traces(child, depth + 1, maxLoopIterations, isLast && isLastChild, false);
                    });
                return this.combineSequential(childTraces);
                }
                
                case 'parallel': {
                const branches = Array.from(node.querySelectorAll('parallel_branch'));
                    if (branches.length === 0) {
                    return [[]];
                    }
                const branchTraces = branches.map((branch, index) => {
                    const isLastBranch = index === branches.length - 1;
                    return this.traces(branch, depth + 1, maxLoopIterations, isLast && isLastBranch, false);
                });
                return this.interleave(branchTraces);
            }

            case 'parallel_branch': {
                const children = Array.from(node.children).filter(child => {
                    const childTag = child.tagName ? child.tagName.toLowerCase() : '';
                    return childTag !== 'condition';
                        });
                const childTraces = children.map((child, index) => {
                    const isLastChild = index === children.length - 1;
                    return this.traces(child, depth + 1, maxLoopIterations, isLast && isLastChild, false);
                });
                return this.combineSequential(childTraces);
                }
                
                case 'loop': {
                const children = Array.from(node.children).filter(child => {
                    const childTag = child.tagName ? child.tagName.toLowerCase() : '';
                    return childTag !== 'condition';
                });
                    
                if (children.length === 0) {
                    // Empty loop - return empty trace (0 iterations) unless directly connected to end node
                    const isDirectlyConnectedToEnd = isInRootDescription && isLast;
                    return isDirectlyConnectedToEnd ? [] : [[]];
                    }
                    
                const bodyTraces = this.combineSequential(
                    children.map((child, index) => {
                        const isLastChild = index === children.length - 1;
                        return this.traces(child, depth + 1, maxLoopIterations, isLastChild, false);
                    })
                );

                // Unroll 0, 1, 2 times (but bounded by maxLoopIterations)
                // Note: maxLoopIterations=1 means we do 0 and 1 iterations
                const result = [];
                
                // 0 iterations (loop doesn't execute)
                // Only exclude if loop is directly connected to end node (last element in root description)
                const isDirectlyConnectedToEnd = isInRootDescription && isLast;
                if (!isDirectlyConnectedToEnd) {
                    result.push([]);
                                }
                                
                // 1 iteration
                if (maxLoopIterations >= 1 && bodyTraces.length > 0) {
                    result.push(...bodyTraces);
                                    }
                
                // 2 iterations (only if maxLoopIterations >= 2)
                if (maxLoopIterations >= 2 && bodyTraces.length > 0) {
                    const twoIterations = this.combineSequential([bodyTraces, bodyTraces]);
                    result.push(...twoIterations);
                                        }

                return result;
                }
                
            case 'escape': {
                // Escape terminates trace early
                return [[{ escape: true }]];
            }

            default: {
                // Unknown element - try to process children
                if (node.children && node.children.length > 0) {
                    const children = Array.from(node.children);
                    const childTraces = children.map((child, index) => {
                        const isLastChild = index === children.length - 1;
                        return this.traces(child, depth + 1, maxLoopIterations, isLast && isLastChild, false);
                    });
                    return this.combineSequential(childTraces);
                }
                return [];
        }
        }
    }

    /**
     * Cartesian product concatenation
     * Combines sequences of traces sequentially
     * @param {Array<Array<Array<Object>>>} listOfTraceSets - Array of trace sets
     * @returns {Array<Array<Object>>} Combined traces
     */
    static combineSequential(listOfTraceSets) {
        if (listOfTraceSets.length === 0) {
            return [[]];
        }

        return listOfTraceSets.reduce(
            (acc, next) => {
                if (acc.length === 0) {
                    return next;
                    }
                if (next.length === 0) {
                    return acc;
                }
                // Check for escape in acc traces
                const result = [];
                for (const a of acc) {
                    // If trace ends with escape, don't continue - terminate early
                    const hasEscape = a.length > 0 && a[a.length - 1].escape === true;
                    if (hasEscape) {
                        result.push(a);
                            } else {
                        // Combine with all next traces
                        for (const b of next) {
                            // If b contains escape, append up to and including escape, then stop
                            const escapeIndex = b.findIndex(item => item.escape === true);
                            if (escapeIndex !== -1) {
                                // Include everything up to and including escape
                                result.push([...a, ...b.slice(0, escapeIndex + 1)]);
                            } else {
                                result.push([...a, ...b]);
                                }
                            }
                        }
                }
                return result;
            },
            [[]]
        );
                }
                
    /**
     * Parallel interleaving (all possible orderings of branches as units)
     * Each branch is treated as a single unit - tasks within a branch stay together
     * @param {Array<Array<Array<Object>>>} branches - Array of branch trace sets
     * @returns {Array<Array<Object>>} All interleaved traces
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
        const permutations = this.generatePermutations(branchIndices);
        
        const result = [];
        
        // For each branch, get all its traces
        // Then for each combination of traces (one from each branch), generate all branch orderings
        const branchTraces = branches.map(branch => branch.length > 0 ? branch : [[]]);
        
        // Generate Cartesian product of all branch traces
        const traceCombinations = this.cartesianProduct(branchTraces);
        
        // For each combination, generate all branch orderings
        for (const combination of traceCombinations) {
            for (const perm of permutations) {
                // Concatenate traces in the permuted order
                const interleaved = [];
                for (const idx of perm) {
                    interleaved.push(...combination[idx]);
                    }
                result.push(interleaved);
            }
        }
        
        return result;
    }

    /**
     * Generate all permutations of an array
     * @param {Array} arr - Input array
     * @returns {Array<Array>} All permutations
     */
    static generatePermutations(arr) {
        if (arr.length <= 1) {
            return [arr];
        }
        
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const restPerms = this.generatePermutations(rest);
            for (const perm of restPerms) {
                result.push([arr[i], ...perm]);
                                }
                            }
        return result;
    }

    /**
     * Generate Cartesian product of arrays
     * @param {Array<Array>} arrays - Array of arrays
     * @returns {Array<Array>} Cartesian product
     */
    static cartesianProduct(arrays) {
        if (arrays.length === 0) {
            return [[]];
        }
        if (arrays.length === 1) {
            return arrays[0].map(item => [item]);
        }
        
        const [first, ...rest] = arrays;
        const restProduct = this.cartesianProduct(rest);
        const result = [];
        
        for (const item of first) {
            for (const restCombo of restProduct) {
                result.push([item, ...restCombo]);
            }
        }
        
        return result;
    }

    /**
     * Union of trace sets (flatten)
     * @param {Array<Array<Array<Object>>>} listOfTraceSets - Array of trace sets
     * @returns {Array<Array<Object>>} Flattened traces
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
            const id = callNode.getAttribute('id') || null;
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
     * @returns {Array<Array<Object>>} Unique traces
     */
    static filterDuplicateTraces(traces) {
        const uniqueTraces = new Set();
        const result = [];
        
        for (const trace of traces) {
            const traceString = JSON.stringify(trace.map(t => {
                if (t.escape) {
                    return { escape: true };
                }
                return { id: t.id, alt_id: t.alt_id, task: t.task };
            }));
            if (!uniqueTraces.has(traceString)) {
                uniqueTraces.add(traceString);
                result.push(trace);
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
        const nodeIds = path.filter(t => !t.escape).map(t => t.id);
        const uniqueNodes = new Set(nodeIds);
        if (nodeIds.length > uniqueNodes.size) {
            return 'loop';
        }
        return 'sequential';
    }
}
