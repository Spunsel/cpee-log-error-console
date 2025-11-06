/**
 * CPEE Trace Calculator
 * Calculates all possible execution traces (paths) from CPEE XML workflow
 * Uses DFS approach to enumerate all paths from start to end
 * Similar to "All Paths From Source to Target" problem
 */

import { Trace } from '../../models/Trace.js';

export class CPEETraceCalculator {
    /**
     * Calculate all possible execution traces from CPEE XML
     * @param {string} xmlString - CPEE XML content
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @param {number} options.maxPathLength - Maximum path length (default: 50)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(xmlString, options = {}) {
        console.log('[CPEETraceCalculator] Starting trace calculation from CPEE XML...');
        
        const {
            maxLoopIterations = 1,
            maxPathLength = 50
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
            
            // Find all paths using DFS traversal
            const allPaths = [];
            const elements = Array.from(description.children);
            
            // Start DFS from the beginning
            this.dfsFindAllPaths(elements, [], allPaths, maxLoopIterations, maxPathLength);
            
            // Filter duplicate paths
            const uniquePaths = this.filterDuplicatePaths(allPaths);
            
            // Convert paths to Trace objects
            const traces = uniquePaths.map((path, index) => {
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
     * DFS to find all paths from start to end
     * Similar to "All Paths From Source to Target" algorithm
     * @param {Array} elements - Elements to process (like graph nodes)
     * @param {Array} currentPath - Current path being built (array of task objects)
     * @param {Array} allPaths - Array to collect all complete paths
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {number} maxPathLength - Maximum path length
     * @param {Map} loopCounts - Map tracking how many times each loop has been iterated in current path
     */
    static dfsFindAllPaths(elements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts = new Map()) {
        // Check path length limit
        if (currentPath.length >= maxPathLength) {
            return;
        }
        
        // Process each element in order (sequential traversal)
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const tagName = element.tagName.toLowerCase();
            const remainingElements = elements.slice(i + 1);
            
            switch (tagName) {
                case 'call':
                case 'manipulate':
                case 'script': {
                    // Simple task - add to path and continue
                    const task = this.extractTask(element);
                    if (task) {
                        currentPath.push(task);
                    }
                    // Continue with remaining elements
                    if (remainingElements.length > 0) {
                        this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                    } else {
                        // Reached end - save complete path
                        if (currentPath.length > 0) {
                            allPaths.push([...currentPath]);
                        }
                    }
                    // Backtrack: remove task from path
                    if (task) {
                        currentPath.pop();
                    }
                    return; // Done with this branch
                }
                
                case 'choose': {
                    // Exclusive choice - branch for each alternative (including empty)
                    const alternatives = Array.from(element.children).filter(child =>
                        child.tagName.toLowerCase() === 'alternative'
                    );
                    
                    if (alternatives.length === 0) {
                        // No alternatives - continue with remaining elements
                        this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                        return;
                    }
                    
                    // Process each alternative (each creates a separate path branch)
                    alternatives.forEach((alternative) => {
                        const altPath = [...currentPath]; // Copy path for this alternative
                        const altChildren = Array.from(alternative.children).filter(child =>
                            child.tagName.toLowerCase() !== 'condition'
                        );
                        
                        // Check if this alternative has an escape
                        const escapeIndex = altChildren.findIndex(child => child.tagName.toLowerCase() === 'escape');
                        const hasEscapeInThisAlt = escapeIndex !== -1;
                        
                        if (hasEscapeInThisAlt) {
                            // Process elements before escape, then escape terminates the path
                            const beforeEscape = altChildren.slice(0, escapeIndex);
                            if (beforeEscape.length > 0) {
                                // Process elements before escape - this will generate paths
                                // Then we add the escape element which will terminate each path
                                const combinedWithEscape = [...beforeEscape, altChildren[escapeIndex]];
                                this.dfsFindAllPaths(combinedWithEscape, altPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                            } else {
                                // Escape is first - just process the escape which will save the path
                                this.dfsFindAllPaths([altChildren[escapeIndex]], altPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                            }
                        } else {
                            // No escape - process alternative content (if any) and then continue with remaining
                            if (altChildren.length > 0) {
                                // Process alternative content first, then continue with remaining elements
                                // Combine alternative children with remaining elements to process in one go
                                const combinedElements = [...altChildren, ...remainingElements];
                                this.dfsFindAllPaths(combinedElements, altPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                            } else {
                                // Empty alternative - continue with remaining elements
                                if (remainingElements.length > 0) {
                                    this.dfsFindAllPaths(remainingElements, altPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                                } else {
                                    // Reached end - save path
                                    if (altPath.length > 0) {
                                        allPaths.push([...altPath]);
                                    }
                                }
                            }
                        }
                    });
                    return; // Choose handled all alternatives
                }
                
                case 'parallel': {
                    // Parallel - generate all permutations of branch task orderings
                    const branches = Array.from(element.children).filter(child =>
                        child.tagName.toLowerCase() === 'parallel_branch'
                    );
                    
                    if (branches.length === 0) {
                        // No branches - continue with remaining elements
                        this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                        return;
                    }
                    
                    // Extract tasks from each branch (each branch may have multiple tasks)
                    const branchTaskLists = [];
                    branches.forEach((branch) => {
                        const branchTasks = [];
                        const branchChildren = Array.from(branch.children);
                        branchChildren.forEach(child => {
                            const childTag = child.tagName.toLowerCase();
                            if (childTag === 'call' || childTag === 'manipulate' || childTag === 'script') {
                                const task = this.extractTask(child);
                                if (task) {
                                    branchTasks.push(task);
                                }
                            } else if (childTag !== 'condition') {
                                // Process nested structures in branch
                                const nestedPaths = this.accumulateTasksFromElements([child], [], maxLoopIterations, maxPathLength, loopCounts);
                                if (nestedPaths.length > 0) {
                                    branchTasks.push(...nestedPaths[0]);
                                }
                            }
                        });
                        if (branchTasks.length > 0) {
                            branchTaskLists.push(branchTasks);
                        }
                    });
                    
                    if (branchTaskLists.length === 0) {
                        // All branches empty - skip parallel, continue
                        this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                        return;
                    }
                    
                    // Generate all permutations of branch orderings
                    const branchPermutations = this.generatePermutations(branchTaskLists);
                    
                    // For each permutation, create a path and continue
                    branchPermutations.forEach(branchOrder => {
                        const parallelPath = [...currentPath];
                        // Flatten the branch order into a single task list
                        branchOrder.forEach(branchTasks => {
                            parallelPath.push(...branchTasks);
                        });
                        
                        // Continue with remaining elements after parallel
                        if (remainingElements.length > 0) {
                            this.dfsFindAllPaths(remainingElements, parallelPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                        } else {
                            // Reached end - save path
                            if (parallelPath.length > 0) {
                                allPaths.push([...parallelPath]);
                            }
                        }
                    });
                    
                    // If there are empty branches, also generate path without parallel content
                    const hasEmptyBranches = branches.length > branchTaskLists.length;
                    if (hasEmptyBranches) {
                        if (remainingElements.length > 0) {
                            this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                        } else {
                            if (currentPath.length > 0) {
                                allPaths.push([...currentPath]);
                            }
                        }
                    }
                    return; // Parallel handled
                }
                
                case 'loop': {
                    // Loop - enumerate 0 to maxLoopIterations iterations
                    const loopChildren = Array.from(element.children).filter(child =>
                        child.tagName.toLowerCase() !== 'condition'
                    );
                    
                    if (loopChildren.length === 0) {
                        // Empty loop - continue with remaining (0 iterations)
                        this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                        return;
                    }
                    
                    // Get loop key for tracking iterations
                    const loopKey = this.getElementKey(element);
                    const currentLoopCount = (loopCounts.get(loopKey) || 0);
                    
                    if (currentLoopCount >= maxLoopIterations) {
                        // Already at max iterations for this loop - skip and continue
                        this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                        return;
                    }
                    
                    // Process 0 to maxLoopIterations iterations
                    for (let iterations = 0; iterations <= maxLoopIterations; iterations++) {
                        if (iterations === 0) {
                            // 0 iterations - just continue with remaining (don't increment loop count)
                            if (remainingElements.length > 0) {
                                this.dfsFindAllPaths(remainingElements, currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                            } else {
                                if (currentPath.length > 0) {
                                    allPaths.push([...currentPath]);
                                }
                            }
                        } else {
                            // For this iteration count, we need to generate all paths through loop content
                            // For nested loops, this will recursively generate all combinations
                            const newLoopCounts = new Map(loopCounts);
                            newLoopCounts.set(loopKey, currentLoopCount + iterations);
                            
                            // Get all paths through loop content (once) - recursively handles nested loops
                            const loopContentPaths = this.accumulateTasksFromElements(loopChildren, [], maxLoopIterations, maxPathLength, newLoopCounts);
                            
                            if (loopContentPaths.length === 0) {
                                // No paths through loop content - skip this iteration
                                continue;
                            }
                            
                            // For each path through loop content, repeat it 'iterations' times
                            loopContentPaths.forEach(loopContentPath => {
                                const iteratedPath = [...currentPath];
                                
                                // Check if this path was terminated by escape
                                const wasTerminated = loopContentPath._terminatedByEscape === true;
                                
                                // Repeat loop content path 'iterations' times
                                for (let iter = 0; iter < iterations; iter++) {
                                    // Create a fresh copy for each iteration to avoid reference issues
                                    const pathCopy = loopContentPath.map(task => ({ ...task }));
                                    iteratedPath.push(...pathCopy);
                                }
                                
                                // If path was terminated by escape, don't continue with remaining elements
                                if (wasTerminated) {
                                    // Reached end (terminated by escape) - save path
                                    if (iteratedPath.length > 0) {
                                        allPaths.push([...iteratedPath]);
                                    }
                                } else {
                                    // Continue with remaining elements after loop
                                    if (remainingElements.length > 0) {
                                        this.dfsFindAllPaths(remainingElements, iteratedPath, allPaths, maxLoopIterations, maxPathLength, newLoopCounts);
                                    } else {
                                        // Reached end - save path
                                        if (iteratedPath.length > 0) {
                                            allPaths.push([...iteratedPath]);
                                        }
                                    }
                                }
                            });
                        }
                    }
                    return; // Loop handled
                }
                
                case 'escape':
                    // Escape - terminate path immediately (save current path and stop)
                    if (currentPath.length > 0) {
                        allPaths.push([...currentPath]);
                    }
                    return; // Don't process remaining elements after escape
                
                default:
                    // Unknown element - process children if any
                    if (element.children && element.children.length > 0) {
                        this.dfsFindAllPaths(Array.from(element.children), currentPath, allPaths, maxLoopIterations, maxPathLength, loopCounts);
                    }
                    break;
            }
        }
        
        // Don't save paths here - paths should only be saved when we explicitly reach the end
        // (either in call/choose/loop cases, or when remainingElements is empty)
    }

    /**
     * Accumulate tasks from elements into paths (for loop iterations)
     * Returns all possible paths through the elements
     * @param {Array} elements - Elements to process
     * @param {Array} currentPath - Current path being built
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {number} maxPathLength - Maximum path length
     * @param {Map} loopCounts - Loop iteration counts
     * @returns {Array} Array of paths (each path is an array of task objects)
     *                  Paths that end with escape are marked with a special property
     */
    static accumulateTasksFromElements(elements, currentPath, maxLoopIterations, maxPathLength, loopCounts) {
        if (currentPath.length >= maxPathLength) {
            return [[...currentPath]];
        }
        
        const allPaths = [];
        
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const tagName = element.tagName.toLowerCase();
            const remainingElements = elements.slice(i + 1);
            
            switch (tagName) {
                case 'call':
                case 'manipulate':
                case 'script': {
                    const task = this.extractTask(element);
                    if (task) {
                        currentPath.push(task);
                    }
                    // Continue with remaining
                    if (remainingElements.length > 0) {
                        const paths = this.accumulateTasksFromElements(remainingElements, currentPath, maxLoopIterations, maxPathLength, loopCounts);
                        allPaths.push(...paths);
                    } else {
                        // End of elements - return current path
                        allPaths.push([...currentPath]);
                    }
                    // Backtrack
                    if (task) {
                        currentPath.pop();
                    }
                    return allPaths.length > 0 ? allPaths : [[...currentPath]];
                }
                
                case 'choose': {
                    // For choose, generate paths for each alternative
                    const alternatives = Array.from(element.children).filter(child =>
                        child.tagName.toLowerCase() === 'alternative'
                    );
                    
                    if (alternatives.length === 0) {
                        // No alternatives - continue with remaining
                        if (remainingElements.length > 0) {
                            return this.accumulateTasksFromElements(remainingElements, currentPath, maxLoopIterations, maxPathLength, loopCounts);
                        }
                        return [[...currentPath]];
                    }
                    
                    // Process each alternative
                    alternatives.forEach((alternative) => {
                        const altPath = [...currentPath];
                        const altChildren = Array.from(alternative.children).filter(child =>
                            child.tagName.toLowerCase() !== 'condition'
                        );
                        
                        // Check if this alternative has an escape
                        const escapeIndex = altChildren.findIndex(child => child.tagName.toLowerCase() === 'escape');
                        const hasEscapeInThisAlt = escapeIndex !== -1;
                        
                        if (hasEscapeInThisAlt) {
                            // Process elements before escape
                            const beforeEscape = altChildren.slice(0, escapeIndex);
                            if (beforeEscape.length > 0) {
                                const beforeEscapePaths = this.accumulateTasksFromElements(beforeEscape, altPath, maxLoopIterations, maxPathLength, loopCounts);
                                // Escape terminates path - mark paths as terminated and don't continue
                                beforeEscapePaths.forEach(ep => {
                                    if (ep.length > 0) {
                                        // Mark path as terminated by escape
                                        ep._terminatedByEscape = true;
                                        allPaths.push(ep);
                                    }
                                });
                            } else {
                                // Escape is first - just save current path (marked as terminated)
                                if (altPath.length > 0) {
                                    altPath._terminatedByEscape = true;
                                    allPaths.push(altPath);
                                }
                            }
                        } else {
                            // No escape - process alternative content and continue
                            if (altChildren.length > 0) {
                                const altPaths = this.accumulateTasksFromElements(altChildren, altPath, maxLoopIterations, maxPathLength, loopCounts);
                                altPaths.forEach(ap => {
                                    // Continue with remaining elements
                                    if (remainingElements.length > 0) {
                                        const contPaths = this.accumulateTasksFromElements(remainingElements, ap, maxLoopIterations, maxPathLength, loopCounts);
                                        allPaths.push(...contPaths);
                                    } else {
                                        allPaths.push(ap);
                                    }
                                });
                            } else {
                                // Empty alternative - continue with remaining
                                if (remainingElements.length > 0) {
                                    const contPaths = this.accumulateTasksFromElements(remainingElements, altPath, maxLoopIterations, maxPathLength, loopCounts);
                                    allPaths.push(...contPaths);
                                } else {
                                    allPaths.push(altPath);
                                }
                            }
                        }
                    });
                    return allPaths.length > 0 ? allPaths : [[...currentPath]];
                }
                
                case 'parallel': {
                    // Extract tasks from each branch
                    const branches = Array.from(element.children).filter(child =>
                        child.tagName.toLowerCase() === 'parallel_branch'
                    );
                    
                    const branchTaskLists = [];
                    branches.forEach((branch) => {
                        const branchTasks = [];
                        const branchChildren = Array.from(branch.children);
                        branchChildren.forEach(child => {
                            const childTag = child.tagName.toLowerCase();
                            if (childTag === 'call' || childTag === 'manipulate' || childTag === 'script') {
                                const task = this.extractTask(child);
                                if (task) {
                                    branchTasks.push(task);
                                }
                            } else if (childTag !== 'condition') {
                                // Process nested structures
                                const nestedPaths = this.accumulateTasksFromElements([child], [], maxLoopIterations, maxPathLength, loopCounts);
                                if (nestedPaths.length > 0) {
                                    branchTasks.push(...nestedPaths[0]);
                                }
                            }
                        });
                        if (branchTasks.length > 0) {
                            branchTaskLists.push(branchTasks);
                        }
                    });
                    
                    if (branchTaskLists.length === 0) {
                        // All branches empty - continue with remaining
                        if (remainingElements.length > 0) {
                            return this.accumulateTasksFromElements(remainingElements, currentPath, maxLoopIterations, maxPathLength, loopCounts);
                        }
                        return [[...currentPath]];
                    }
                    
                    // Generate all permutations of branch orderings
                    const branchPermutations = this.generatePermutations(branchTaskLists);
                    const resultPaths = [];
                    
                    branchPermutations.forEach(branchOrder => {
                        const parallelPath = [...currentPath];
                        // Flatten the branch order into a single task list
                        branchOrder.forEach(branchTasks => {
                            parallelPath.push(...branchTasks);
                        });
                        
                        // Continue with remaining
                        if (remainingElements.length > 0) {
                            const contPaths = this.accumulateTasksFromElements(remainingElements, parallelPath, maxLoopIterations, maxPathLength, loopCounts);
                            resultPaths.push(...contPaths);
                        } else {
                            resultPaths.push([...parallelPath]);
                        }
                    });
                    
                    return resultPaths.length > 0 ? resultPaths : [[...currentPath]];
                }
                
                case 'loop': {
                    // Nested loop - process 0 to maxLoopIterations iterations
                    const loopChildren = Array.from(element.children).filter(child =>
                        child.tagName.toLowerCase() !== 'condition'
                    );
                    
                    const loopKey = this.getElementKey(element);
                    const currentLoopCount = loopCounts.get(loopKey) || 0;
                    
                    if (currentLoopCount >= maxLoopIterations) {
                        // Skip nested loop, continue with remaining
                        if (remainingElements.length > 0) {
                            return this.accumulateTasksFromElements(remainingElements, currentPath, maxLoopIterations, maxPathLength, loopCounts);
                        }
                        return [[...currentPath]];
                    }
                    
                    const newLoopCounts = new Map(loopCounts);
                    newLoopCounts.set(loopKey, currentLoopCount + 1);
                    
                    // Get all paths through loop content (once)
                    const loopContentPaths = this.accumulateTasksFromElements(loopChildren, [], maxLoopIterations, maxPathLength, newLoopCounts);
                    
                    const resultPaths = [];
                    
                    // Process 0 to maxLoopIterations iterations
                    for (let iter = 0; iter <= maxLoopIterations; iter++) {
                        if (iter === 0) {
                            // 0 iterations - save current path (loop doesn't execute)
                            // This is a valid path where the loop condition is false
                            const zeroIterPath = [...currentPath];
                            // Continue with remaining elements if any
                            if (remainingElements.length > 0) {
                                const contPaths = this.accumulateTasksFromElements(remainingElements, zeroIterPath, maxLoopIterations, maxPathLength, loopCounts);
                                resultPaths.push(...contPaths);
                            } else {
                                // No remaining elements - save the path as-is
                                if (zeroIterPath.length > 0 || currentPath.length > 0) {
                                    resultPaths.push([...zeroIterPath]);
                                }
                            }
                        } else {
                            // For iter > 0, repeat each path through loop content 'iter' times
                            if (loopContentPaths.length === 0) {
                                // No paths through loop content - skip this iteration
                                continue;
                            }
                            
                            loopContentPaths.forEach(loopContentPath => {
                                const iterPath = [...currentPath];
                                
                                // Check if this path was terminated by escape
                                const wasTerminated = loopContentPath._terminatedByEscape === true;
                                
                                // Repeat loop content path 'iter' times
                                for (let i = 0; i < iter; i++) {
                                    // Create a fresh copy for each iteration to avoid reference issues
                                    const pathCopy = loopContentPath.map(task => ({ ...task }));
                                    iterPath.push(...pathCopy);
                                }
                                
                                // If path was terminated by escape, mark the iterated path and don't continue
                                if (wasTerminated) {
                                    iterPath._terminatedByEscape = true;
                                    resultPaths.push(iterPath);
                                } else {
                                    // Continue with remaining elements
                                    if (remainingElements.length > 0) {
                                        const contPaths = this.accumulateTasksFromElements(remainingElements, iterPath, maxLoopIterations, maxPathLength, loopCounts);
                                        resultPaths.push(...contPaths);
                                    } else {
                                        resultPaths.push(iterPath);
                                    }
                                }
                            });
                        }
                    }
                    
                    return resultPaths.length > 0 ? resultPaths : [[...currentPath]];
                }
                
                default:
                    if (element.children && element.children.length > 0) {
                        return this.accumulateTasksFromElements(Array.from(element.children), currentPath, maxLoopIterations, maxPathLength, loopCounts);
                    }
                    break;
            }
        }
        
        return allPaths.length > 0 ? allPaths : (currentPath.length > 0 ? [[...currentPath]] : []);
    }

    /**
     * Get a unique key for an element (for loop tracking)
     * @param {Element} element - XML element
     * @returns {string} Unique key
     */
    static getElementKey(element) {
        // Use a combination of tag name and a unique identifier
        let key = element.tagName;
        if (element.getAttribute('id')) {
            key += `-${element.getAttribute('id')}`;
        }
        if (element.getAttribute('a:alt_id')) {
            key += `-alt${element.getAttribute('a:alt_id')}`;
        }
        // Add parent context for uniqueness
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element);
            key = `${parent.tagName}[${index}].${key}`;
            element = parent;
            parent = parent.parentElement;
            depth++;
        }
        return key;
    }

    /**
     * Extract task information from element
     * @param {Element} element - Task element
     * @returns {Object|null} Task object: {id, alt_id, task} or null
     */
    static extractTask(element) {
        try {
            const id = element.getAttribute('id') || null;
            if (!id) {
                return null;
            }
            
            const altId = element.getAttribute('a:alt_id') || 
                          element.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') ||
                          null;
            
            let label = '';
            const labelElement = element.querySelector('parameters > label');
            if (labelElement) {
                label = labelElement.textContent.trim();
                // Remove surrounding quotes if present
                if ((label.startsWith('"') && label.endsWith('"')) || 
                    (label.startsWith("'") && label.endsWith("'"))) {
                    label = label.slice(1, -1);
                }
                // Clean up task label - remove XML artifacts like ") & 9:task:("
                // The pattern is: "text") & N:task:("text" 
                // Replace ") & N:task:(" patterns (with optional quotes) with ", "
                // Handle both quoted: ") & N:task:("text" and unquoted: ") & N:task:(text"
                label = label.replace(/"?\s*\)\s*&\s*\d+:task:\(\s*"?/g, ', ');
                // Remove any remaining quotes around individual items (but preserve the text)
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
     * Filter duplicate paths
     * @param {Array} paths - Array of paths
     * @returns {Array} Array of unique paths
     */
    static filterDuplicatePaths(paths) {
        const uniquePaths = new Set();
        const result = [];
        
        for (const path of paths) {
            const pathString = JSON.stringify(path.map(t => ({ id: t.id, alt_id: t.alt_id, task: t.task })));
            if (!uniquePaths.has(pathString)) {
                uniquePaths.add(pathString);
                result.push(path);
            }
        }
        
        return result;
    }

    /**
     * Determine trace type based on path
     * @param {Array} path - Path array
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
     * Generate all permutations of an array of arrays
     * Each inner array represents tasks from one parallel branch
     * @param {Array<Array>} arrays - Array of arrays (each array is tasks from one branch)
     * @returns {Array<Array>} All permutations of branch orderings
     */
    static generatePermutations(arrays) {
        if (arrays.length === 0) {
            return [[]];
        }
        if (arrays.length === 1) {
            return [arrays[0]];
        }
        
        // Generate all permutations of the array indices
        const indices = arrays.map((_, i) => i);
        const indexPermutations = this.permuteArray(indices);
        
        // Map each index permutation to the actual branch task arrays
        return indexPermutations.map(perm => perm.map(idx => arrays[idx]));
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
}
