/**
 * Mermaid Trace Calculator
 * Calculates all possible execution traces (paths) from Mermaid flowchart syntax
 * Uses graph traversal algorithm based on node types (similar to CPEETraceCalculator)
 */

import { Trace } from '../../models/Trace.js';

// Global constant for maximum loop iterations (default: 1)
const MAX_LOOP_ITERATIONS = 1;

export class MermaidTraceCalculator {
    /**
     * Calculate all possible execution traces from Mermaid syntax
     * @param {string} mermaidString - Mermaid flowchart syntax
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(mermaidString, options = {}) {
        console.log('[MermaidTraceCalculator] Starting trace calculation from Mermaid syntax...');
        
        const maxLoopIterations = options.maxLoopIterations !== undefined 
            ? options.maxLoopIterations 
            : MAX_LOOP_ITERATIONS;
        
        try {
            // Parse Mermaid syntax to build graph
            const graph = this.parseMermaid(mermaidString);
            
            if (!graph || graph.nodes.length === 0) {
                console.warn('[MermaidTraceCalculator] No valid graph found');
                return [];
            }
            
            console.log('[MermaidTraceCalculator] Graph parsed successfully');
            
            // Pre-process: Identify nodes in multiple loops (Alternative 3)
            const nodesInMultipleLoops = this.identifyNodesInMultipleLoops(graph);
            graph.nodesInMultipleLoops = nodesInMultipleLoops; // Store for use during traversal
            
            if (nodesInMultipleLoops.size > 0) {
                console.log('[MermaidTraceCalculator] Nodes in multiple loops:', 
                    Array.from(nodesInMultipleLoops.entries()).map(([id, count]) => `${id}:${count}`).join(', '));
            }
            
            // Find start and end nodes
            const startNodes = graph.nodes.filter(n => n.type === 'startevent');
            const endNodes = graph.nodes.filter(n => n.type === 'endevent');
            
            if (startNodes.length === 0) {
                console.warn('[MermaidTraceCalculator] No start nodes found');
                return [];
            }
            
            if (endNodes.length === 0) {
                console.warn('[MermaidTraceCalculator] No end nodes found');
                return [];
            }
            
            // Calculate traces from each start node to each end node
            const allTraceArrays = [];
            
            for (const startNode of startNodes) {
                for (const endNode of endNodes) {
                    const traceArrays = this.traces(
                        graph,
                        startNode.id,
                        endNode.id,
                        0,
                        maxLoopIterations,
                        new Map()
                    );
                    allTraceArrays.push(...traceArrays);
                }
            }
            
            // Filter duplicate traces
            const uniqueTraces = this.filterDuplicateTraces(allTraceArrays);
            
            // Convert to Trace objects
            const traces = uniqueTraces.map((path, index) => {
                const trace = new Trace(`trace-${index + 1}`, path, this.determineTraceType(path));
                return trace;
            });
            
            console.log(`[MermaidTraceCalculator] Calculated ${traces.length} unique traces`);
            return traces;
            
        } catch (error) {
            console.error('[MermaidTraceCalculator] Error calculating traces:', error);
            return [];
        }
    }

    /**
     * Main graph traversal function
     * Returns array of trace arrays (each trace is an array of task objects)
     * @param {Object} graph - Graph object with nodes and edges
     * @param {string} currentNodeId - Current node ID
     * @param {string} targetNodeId - Target end node ID
     * @param {number} depth - Current depth (for debugging)
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {Map<string, number>} visitCounts - Map of node IDs to visit counts (for cycle detection)
     * @returns {Array<Array<Object>>} Array of trace arrays
     */
    static traces(graph, currentNodeId, targetNodeId, depth = 0, maxLoopIterations = MAX_LOOP_ITERATIONS, visitCounts = new Map()) {
        // Check if we reached the target
        if (currentNodeId === targetNodeId) {
            return [[]]; // Return empty trace (base case)
        }
        
        // Get node info
        const node = graph.nodes.find(n => n.id === currentNodeId);
        if (!node) {
            return [];
        }
        
        // Check loop limit - allow maxLoopIterations + 1 visits (initial + loop iterations)
        // For nodes in multiple loops, increase limit proportionally (Alternative 3)
        const loopCount = graph.nodesInMultipleLoops?.get(currentNodeId) || 1;
        const visitLimit = (maxLoopIterations + 1) * loopCount;
        
        const currentVisitCount = visitCounts.get(currentNodeId) || 0;
        if (currentVisitCount >= visitLimit) {
            return []; // Loop limit reached
        }
        
        // Increment visit count for current node
        const newVisitCounts = new Map(visitCounts);
        newVisitCounts.set(currentNodeId, currentVisitCount + 1);
        
        // Get outgoing edges
        const outgoingEdges = graph.adjacencyList.get(currentNodeId) || [];
        
        if (outgoingEdges.length === 0) {
            // Dead end (not the target)
            return [];
        }
        
        // Handle different node types
        switch (node.type) {
            case 'task': {
                // Task node - extract task and continue
                const task = this.extractTask(node);
                if (!task) {
                    return [];
                }
                
                // Get traces from all outgoing edges
                const childTraceSets = outgoingEdges.map(edge => 
                    this.traces(graph, edge.to, targetNodeId, depth + 1, maxLoopIterations, newVisitCounts)
                );
                
                // If multiple outgoing edges, treat as alternatives (union)
                // Otherwise, combine sequentially: task + each child trace
                if (outgoingEdges.length > 1) {
                    const alternativeTraces = this.union(childTraceSets);
                    return alternativeTraces.map(trace => [task, ...trace]);
                } else {
                    // Single outgoing edge - combine sequentially
                    const result = [];
                    for (const childTraces of childTraceSets) {
                        for (const childTrace of childTraces) {
                            result.push([task, ...childTrace]);
                        }
                    }
                    return result;
                }
            }
            
            case 'exclusivegateway': {
                // Exclusive gateway (XOR) - union of all alternatives
                const alternativeTraces = outgoingEdges.map(edge => 
                    this.traces(graph, edge.to, targetNodeId, depth + 1, maxLoopIterations, newVisitCounts)
                );
                return this.union(alternativeTraces);
            }
            
            case 'parallelgateway': {
                // Parallel gateway - need to find join gateway and interleave branches
                return this.handleParallelGateway(
                    graph,
                    currentNodeId,
                    targetNodeId,
                    depth,
                    maxLoopIterations,
                    newVisitCounts
                );
            }
            
            case 'startevent':
            case 'endevent': {
                // Start/end events - just pass through
                const childTraceSets = outgoingEdges.map(edge => 
                    this.traces(graph, edge.to, targetNodeId, depth + 1, maxLoopIterations, newVisitCounts)
                );
                return this.combineSequential(childTraceSets);
            }
            
            default: {
                // Unknown node type - treat as pass-through
                const childTraceSets = outgoingEdges.map(edge => 
                    this.traces(graph, edge.to, targetNodeId, depth + 1, maxLoopIterations, newVisitCounts)
                );
                return this.combineSequential(childTraceSets);
            }
        }
    }

    /**
     * Handle parallel gateway - find join gateway and interleave branches
     * @param {Object} graph - Graph object
     * @param {string} splitGatewayId - Parallel split gateway node ID
     * @param {string} targetNodeId - Target end node ID
     * @param {number} depth - Current depth
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {Map<string, number>} visitCounts - Map of visit counts
     * @returns {Array<Array<Object>>} Array of trace arrays
     */
    static handleParallelGateway(graph, splitGatewayId, targetNodeId, depth, maxLoopIterations, visitCounts) {
        const outgoingEdges = graph.adjacencyList.get(splitGatewayId) || [];
        
        if (outgoingEdges.length === 0) {
            return [];
        }
        
        // Find the join gateway (parallel gateway that all branches connect to)
        const joinGateway = this.findJoinGateway(graph, splitGatewayId, outgoingEdges.map(e => e.to));
        
        if (!joinGateway) {
            // No join gateway found - treat branches as independent paths to target
            const branchTraces = outgoingEdges.map(edge => 
                this.traces(graph, edge.to, targetNodeId, depth + 1, maxLoopIterations, new Map(visitCounts))
            );
            return this.union(branchTraces);
        }
        
        // Collect traces through each branch until join gateway
        // Each branch should use a fresh visit count map to allow independent exploration
        const branchTraceSets = [];
        
        for (const edge of outgoingEdges) {
            const branchTraces = this.traces(
                graph,
                edge.to,
                joinGateway,
                depth + 1,
                maxLoopIterations,
                new Map(visitCounts)
            );
            branchTraceSets.push(branchTraces);
        }
        
        // Interleave branches (generate all permutations of branch orderings)
        const interleavedTraces = this.interleave(branchTraceSets);
        
        // Continue from join gateway to target
        // Use the original visitCounts to maintain loop limits across the parallel section
        const joinTraces = this.traces(
            graph,
            joinGateway,
            targetNodeId,
            depth + 1,
            maxLoopIterations,
            new Map(visitCounts)
        );
        
        // Combine interleaved traces with join traces
        const result = [];
        for (const interleavedTrace of interleavedTraces) {
            for (const joinTrace of joinTraces) {
                result.push([...interleavedTrace, ...joinTrace]);
            }
        }
        
        return result;
    }

    /**
     * Find the join gateway for a parallel split gateway
     * @param {Object} graph - Graph object
     * @param {string} splitGatewayId - Split gateway ID
     * @param {Array<string>} branchStartIds - IDs of nodes where branches start
     * @returns {string|null} Join gateway ID or null
     */
    static findJoinGateway(graph, splitGatewayId, branchStartIds) {
        // Look for a parallel gateway that all branches can reach
        for (const node of graph.nodes) {
            if (node.type === 'parallelgateway' && node.id !== splitGatewayId) {
                // Check if all branches can reach this gateway
                let allBranchesReach = true;
                for (const branchStartId of branchStartIds) {
                    if (!this.pathExists(graph, branchStartId, node.id)) {
                        allBranchesReach = false;
                        break;
                    }
                }
                
                if (allBranchesReach) {
                    return node.id;
                }
            }
        }
        
        return null;
    }

    /**
     * Check if a path exists from source to target
     * @param {Object} graph - Graph object
     * @param {string} source - Source node ID
     * @param {string} target - Target node ID
     * @param {number} maxDepth - Maximum search depth (default: 50)
     * @param {Set<string>} visited - Visited nodes (for cycle detection)
     * @returns {boolean} True if path exists
     */
    static pathExists(graph, source, target, maxDepth = 50, visited = new Set()) {
        if (source === target) {
            return true;
        }
        if (maxDepth <= 0 || visited.has(source)) {
            return false;
        }
        
        const newVisited = new Set(visited);
        newVisited.add(source);
        
        const neighbors = graph.adjacencyList.get(source) || [];
        for (const edge of neighbors) {
            if (this.pathExists(graph, edge.to, target, maxDepth - 1, newVisited)) {
                return true;
            }
        }
        
        return false;
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
                    for (const b of next) {
                        result.push([...a, ...b]);
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
     * Extract task information from task node
     * @param {Object} node - Node object
     * @returns {Object|null} Task object: {id, alt_id, task} or null
     */
    static extractTask(node) {
        try {
            if (!node || node.type !== 'task') {
                return null;
            }
            
            return {
                id: null,
                alt_id: node.id,
                task: node.label || node.id
            };
        } catch (error) {
            console.error('[MermaidTraceCalculator] Error extracting task:', error);
            return null;
        }
    }

    /**
     * Parse Mermaid syntax into a graph structure
     * @param {string} mermaidString - Mermaid flowchart syntax
     * @returns {Object} Graph object with nodes and edges
     */
    static parseMermaid(mermaidString) {
        const graph = {
            nodes: [],
            edges: [],
            adjacencyList: new Map()
        };
        
        // Normalize line endings and split into lines
        const lines = mermaidString.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        
        // Skip graph/flowchart declaration line
        const contentLines = lines.filter(line => 
            !line.match(/^(graph|flowchart)\s+(LR|TD|TB|RL|BT)/i)
        );
        
        // Parse nodes and edges
        let lastNodeId = null; // Track last node for continuation lines
        for (const line of contentLines) {
            // Parse edge: node1 --> node2 or node1 -->|label| node2
            const arrowIndex = line.indexOf('-->');
            if (arrowIndex === -1) {
                // No arrow - might be a node definition, try to extract it
                // Check if it looks like a node: id:type:(label)
                const nodeMatch = line.match(/^([^:]+):([^:]+):(.+)$/);
                if (nodeMatch) {
                    lastNodeId = line.trim();
                    this.ensureNodeExists(graph, lastNodeId);
                }
                continue;
            }
            
            const beforeArrow = line.substring(0, arrowIndex).trim();
            const afterArrow = line.substring(arrowIndex + 3).trim();
            
            // Handle continuation lines (arrow on separate line)
            let fromNodeIdFull;
            if (beforeArrow) {
                // Normal case: node1 --> node2
                fromNodeIdFull = beforeArrow;
                lastNodeId = beforeArrow; // Update last node
            } else if (lastNodeId) {
                // Continuation line: --> node2 (use last node as source)
                fromNodeIdFull = lastNodeId;
            } else {
                // Skip invalid edge (no source node)
                console.warn(`[MermaidTraceCalculator] Skipping edge with no source: ${line}`);
                continue;
            }
            
            // Extract edge label if present: |label|
            let edgeLabel = null;
            let toNodeId = afterArrow;
            
            const labelMatch = afterArrow.match(/^\|([^|]+)\|\s*(.+)$/);
            if (labelMatch) {
                edgeLabel = labelMatch[1].trim();
                toNodeId = labelMatch[2].trim();
            }
            
            const toNodeIdFull = toNodeId;
            
            // Ensure nodes exist and get their short IDs
            const fromNodeId = this.ensureNodeExists(graph, fromNodeIdFull);
            const toNodeIdShort = this.ensureNodeExists(graph, toNodeIdFull);
            
            // Update last node to the destination
            lastNodeId = toNodeIdFull;
            
            // Add edge (using short IDs)
            graph.edges.push({
                from: fromNodeId,
                to: toNodeIdShort,
                label: edgeLabel
            });
            
            // Add to adjacency list (using short IDs)
            if (!graph.adjacencyList.has(fromNodeId)) {
                graph.adjacencyList.set(fromNodeId, []);
            }
            graph.adjacencyList.get(fromNodeId).push({
                to: toNodeIdShort,
                label: edgeLabel
            });
        }
        
        return graph;
    }

    /**
     * Ensure a node exists in the graph, parsing it if needed
     * @param {Object} graph - Graph object
     * @param {string} nodeId - Node identifier (full ID like "0:startevent:((startevent))")
     * @returns {string} The short node ID (like "0")
     */
    static ensureNodeExists(graph, nodeId) {
        // Check if node already exists by fullId
        const existingNode = graph.nodes.find(n => n.fullId === nodeId);
        if (existingNode) {
            return existingNode.id; // Return the short ID
        }
        
        // Parse node definition: id:type:(label) or id:type:{label} or id:type:((label))
        const nodeMatch = nodeId.match(/^([^:]+):([^:]+):(.+)$/);
        
        let shortId, nodeType, nodeLabel;
        
        if (nodeMatch) {
            const [, id, type, labelPart] = nodeMatch;
            shortId = id.trim();
            nodeType = type.trim();
            let label = '';
            
            // Extract label from parentheses or curly braces (handle nested)
            if (labelPart.startsWith('(') && labelPart.endsWith(')')) {
                // Remove outer parentheses (handle nested like ((label)))
                label = labelPart.slice(1, -1);
                // If still has outer parentheses, remove them too
                if (label.startsWith('(') && label.endsWith(')')) {
                    label = label.slice(1, -1);
                }
            } else if (labelPart.startsWith('{') && labelPart.endsWith('}')) {
                // Remove outer curly braces
                label = labelPart.slice(1, -1);
            } else {
                // No parentheses/braces, use as-is
                label = labelPart;
            }
            
            nodeLabel = label.trim();
        } else {
            // If parsing fails, use the full ID as both short ID and label
            shortId = nodeId;
            nodeType = 'unknown';
            nodeLabel = nodeId;
        }
        
        // Check if a node with this short ID already exists
        const existingShortIdNode = graph.nodes.find(n => n.id === shortId);
        if (existingShortIdNode) {
            // Update the fullId if different
            if (existingShortIdNode.fullId !== nodeId) {
                existingShortIdNode.fullId = nodeId;
            }
            return shortId;
        }
        
        graph.nodes.push({
            id: shortId,
            type: nodeType,
            label: nodeLabel,
            fullId: nodeId
        });
        
        return shortId;
    }

    /**
     * Identify nodes that are part of multiple loops (Alternative 3)
     * Detects cycles in the graph and counts how many loops each node belongs to
     * @param {Object} graph - Graph object with nodes and edges
     * @returns {Map<string, number>} Map of nodeId -> loopCount (only for nodes in multiple loops)
     */
    static identifyNodesInMultipleLoops(graph) {
        const nodeLoopCounts = new Map();
        
        // Initialize all nodes with 0 loop count
        for (const node of graph.nodes) {
            nodeLoopCounts.set(node.id, 0);
        }
        
        // Find all cycles in the graph
        const cycles = this.findAllCycles(graph);
        
        // Count how many cycles each node belongs to
        for (const cycle of cycles) {
            for (const nodeId of cycle) {
                const currentCount = nodeLoopCounts.get(nodeId) || 0;
                nodeLoopCounts.set(nodeId, currentCount + 1);
            }
        }
        
        // Return only nodes that are in multiple loops (loopCount > 1)
        const result = new Map();
        for (const [nodeId, loopCount] of nodeLoopCounts) {
            if (loopCount > 1) {
                result.set(nodeId, loopCount);
            }
        }
        
        return result;
    }

    /**
     * Find all cycles in the graph
     * A cycle is a path that starts and ends at the same node
     * @param {Object} graph - Graph object with nodes and edges
     * @returns {Array<Set<string>>} Array of cycles, each cycle is a Set of node IDs
     */
    static findAllCycles(graph) {
        const allCycles = [];
        const cycleSignatures = new Set(); // To avoid duplicates
        
        // For each node, try to find cycles starting from it
        for (const node of graph.nodes) {
            // Find cycles starting from this node
            const cyclesFromNode = this.findCyclesFromNode(graph, node.id, new Set(), []);
            
            for (const cycle of cyclesFromNode) {
                // Create a normalized signature for the cycle (sorted node IDs)
                const cycleSet = new Set(cycle);
                const signature = Array.from(cycleSet).sort().join(',');
                
                // Only add if we haven't seen this cycle before
                if (!cycleSignatures.has(signature) && cycleSet.size > 1) {
                    cycleSignatures.add(signature);
                    allCycles.push(cycleSet);
                }
            }
        }
        
        return allCycles;
    }

    /**
     * Find cycles starting from a specific node using DFS
     * @param {Object} graph - Graph object
     * @param {string} currentNode - Current node ID
     * @param {Set<string>} visitedInPath - Nodes visited in current path
     * @param {Array<string>} currentPath - Current path being explored
     * @param {number} maxDepth - Maximum search depth (default: 20)
     * @returns {Array<Array<string>>} Array of cycles (each cycle is an array of node IDs)
     */
    static findCyclesFromNode(graph, currentNode, visitedInPath = new Set(), currentPath = [], maxDepth = 20) {
        if (maxDepth <= 0) {
            return [];
        }
        
        // If we've visited this node in the current path, we found a cycle
        if (visitedInPath.has(currentNode)) {
            const cycleStartIndex = currentPath.indexOf(currentNode);
            if (cycleStartIndex !== -1) {
                // Extract the cycle: from cycleStartIndex to end, then back to start
                const cycle = currentPath.slice(cycleStartIndex);
                cycle.push(currentNode); // Complete the cycle by returning to start
                return [cycle];
            }
            return [];
        }
        
        // Add current node to path
        const newVisitedInPath = new Set(visitedInPath);
        newVisitedInPath.add(currentNode);
        const newPath = [...currentPath, currentNode];
        
        // Get outgoing edges
        const neighbors = graph.adjacencyList.get(currentNode) || [];
        const cycles = [];
        
        // Explore each neighbor
        for (const edge of neighbors) {
            const cyclesFromNeighbor = this.findCyclesFromNode(
                graph,
                edge.to,
                newVisitedInPath,
                newPath,
                maxDepth - 1
            );
            cycles.push(...cyclesFromNeighbor);
        }
        
        return cycles;
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
            // Skip empty traces
            if (trace.length === 0) {
                continue;
            }
            
            const traceString = JSON.stringify(trace.map(t => ({ id: t.id, alt_id: t.alt_id, task: t.task })));
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
        const nodeIds = path.map(t => t.id || t.alt_id);
        const uniqueNodes = new Set(nodeIds);
        if (nodeIds.length > uniqueNodes.size) {
            return 'loop';
        }
        return 'sequential';
    }
}
