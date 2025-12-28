/**
 * Mermaid Trace Calculator
 * Implements Graph Trace Analysis (GTA) approach from Tbaileh et al. (2017)
 * 
 * Reference: Tbaileh, A., Jain, H., Broadwater, R., Cordova, J., Arghandeh, R., & Dilek, M. (2017).
 * Graph Trace Analysis: An object-oriented power flow, verifications and comparisons.
 * Electric Power Systems Research, 147, 145-153.
 * 
 * This implementation adapts GTA concepts from power system analysis to workflow graph trace calculation.
 */

import { Trace } from '../../models/Trace.js';
import { MermaidParser } from '../content/MermaidParser.js';

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
            throw new Error(`Trace calculation exceeded ${this.timeoutMs}ms timeout. The Mermaid graph is too complex to calculate all traces.`);
        }
    }
    
    getElapsed() {
        return Date.now() - this.startTime;
    }
}

/**
 * GTA Topology Iterators for Graph Structure
 * Following the paper's definition of topology iterators, adapted for graph-based workflows
 */
class TopologyIterators {
    /**
     * Forward Iterator p[f]
     * Returns next component(s) in forward trace direction (outgoing edges)
     * @param {Object} graph - Graph object
     * @param {string} nodeId - Current node ID
     * @returns {Array<string>} Array of next node IDs (forward components)
     */
    static forwardIterator(graph, nodeId) {
        const outgoingEdges = graph.adjacencyList.get(nodeId) || [];
        return outgoingEdges.map(edge => edge.to);
    }

    /**
     * Backward Iterator p[b]
     * Returns previous component(s) in backward trace direction (incoming edges)
     * @param {Object} graph - Graph object
     * @param {string} nodeId - Current node ID
     * @returns {Array<string>} Array of previous node IDs
     */
    static backwardIterator(graph, nodeId) {
        const result = [];
        for (const [fromId, edges] of graph.adjacencyList.entries()) {
            if (edges.some(edge => edge.to === nodeId)) {
                result.push(fromId);
            }
        }
        return result;
    }

    /**
     * Feeder Path Iterator p[fp]
     * Returns component that supplies to p from reference source
     * For workflows, this is the path from start to current node (same as forward trace)
     * @param {Array<Object>} forwardTraceSet - Current forward trace set
     * @returns {Array<Object>} Feeder path (tasks from start to current node)
     */
    static feederPathIterator(forwardTraceSet) {
        // For workflows, feeder path is the accumulated forward trace set
        return forwardTraceSet;
    }

    /**
     * Cotree Iterator p[ct]
     * Returns cotree component that, if removed, breaks an independent loop
     * For workflows, this identifies nodes that create cycles
     * @param {string} nodeId - Current node ID
     * @param {Array<Object>} forwardTraceSet - Current forward trace set
     * @returns {boolean} True if this node is a cotree edge (creates a loop)
     */
    static cotreeIterator(nodeId, forwardTraceSet) {
        if (!nodeId) {
            return false;
        }
        
        // A cotree edge is one that creates a cycle when added to the forward trace
        // Check if current node ID appears in forward trace set
        return forwardTraceSet.some(task => {
            const taskId = task.id || task.alt_id;
            return taskId === nodeId;
        });
    }
}

/**
 * GTA Trace Sets for Graph Structure
 * Following the paper's definition of trace sets, adapted for graph-based workflows
 */
class TraceSets {
    /**
     * Forward Trace (FT_i)
     * Ordered set created with recursive application of forward iterator f starting at component i
     * FT_i = {p | p is reachable from i via forward iterator f}
     * 
     * @param {Object} graph - Graph object
     * @param {string} currentNodeId - Current node ID
     * @param {string} targetNodeId - Target end node ID
     * @param {Array<Object>} currentFT - Current forward trace set
     * @param {number} depth - Recursion depth
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker
     * @param {Set<string>} visitedNodes - Set of visited node IDs (for cycle detection in non-task nodes)
     * @returns {Array<Array<Object>>} Array of forward trace arrays
     */
    static forwardTrace(graph, currentNodeId, targetNodeId, currentFT, depth, maxLoopIterations, timeoutChecker, visitedNodes = new Set()) {
        if (timeoutChecker) {
            timeoutChecker.check();
        }
        
        // Check if we reached the target
        if (currentNodeId === targetNodeId) {
            return [[...currentFT]]; // Return current forward trace set
        }
        
        // Get node info
        const node = graph.nodes.find(n => n.id === currentNodeId);
        if (!node) {
            return [];
        }
        
        // Check if this non-task node was already visited in this path (cycle through gateways)
        const isTaskType = node.type === 'task' || node.type.endsWith('task');
        if (!isTaskType && visitedNodes.has(currentNodeId)) {
            // Cycle detected through non-task nodes (e.g., gateways)
            // This prevents infinite loops between gateways
            return [];
        }
        
        // Check if loop detected (cotree edge) for task nodes
        const isCotreeEdge = TopologyIterators.cotreeIterator(currentNodeId, currentFT);
        if (isCotreeEdge) {
            // Loop detected - apply bounded iteration
            // Count how many times this node appears in current trace (before adding current visit)
            const visitCount = currentFT.filter(task => {
                const taskId = task.id || task.alt_id;
                return taskId === currentNodeId;
            }).length;
            
            // Block if visitCount exceeds maxLoopIterations (safety check)
            if (visitCount > maxLoopIterations) {
                return []; // Loop limit reached - cannot repeat loop more than 1 time
            }
        }
        
        // Create new visited set with current node (for non-task nodes)
        const newVisitedNodes = new Set(visitedNodes);
        if (!isTaskType) {
            newVisitedNodes.add(currentNodeId);
        }
        
        // Get outgoing edges (forward iterator)
        const nextNodeIds = TopologyIterators.forwardIterator(graph, currentNodeId);
        
        if (nextNodeIds.length === 0) {
            // Dead end (not the target)
            return [];
        }
        
        // Handle different node types
        if (isTaskType) {
            // Task node: add to forward trace set
            const task = MermaidTraceCalculator.extractTask(node);
            if (!task) {
                return [];
            }
            
            // Create new forward trace set: FT_new = FT ∪ {task}
            const newFT = [...currentFT, task];
            
            // If task has multiple outgoing edges, treat them as XOR alternatives (union)
            // This handles cases like self-loops where a task can either loop back or continue
            if (nextNodeIds.length > 1) {
                // Process each alternative path with same forward trace set
                // Reset visitedNodes for task nodes (they use currentFT for cycle detection)
                const alternativeTraces = nextNodeIds.flatMap(nextNodeId => 
                    this.forwardTrace(
                        graph,
                        nextNodeId,
                        targetNodeId,
                        newFT,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker,
                        new Set() // Reset visited for new path after task
                    )
                );
                return alternativeTraces;
            } else {
                // Single outgoing edge: process sequentially
                return this.combineSequentialForwardTrace(
                    graph,
                    nextNodeIds,
                    targetNodeId,
                    newFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker,
                    new Set() // Reset visited for new path after task
                );
            }
        }
        
        switch (node.type) {
            case 'exclusivegateway': {
                // XOR Gateway: union of alternatives
                // Process each alternative with same forward trace set
                const alternativeTraces = nextNodeIds.flatMap(nextNodeId => 
                    this.forwardTrace(
                        graph,
                        nextNodeId,
                        targetNodeId,
                        currentFT,
                        depth + 1,
                        maxLoopIterations,
                        timeoutChecker,
                        newVisitedNodes
                    )
                );
                
                return alternativeTraces;
            }
            
            case 'parallelgateway': {
                // AND Gateway: interleave parallel branches
                return this.handleParallelGateway(
                    graph,
                    currentNodeId,
                    targetNodeId,
                    currentFT,
                    depth,
                    maxLoopIterations,
                    timeoutChecker,
                    newVisitedNodes
                );
            }
            
            case 'startevent':
            case 'endevent': {
                // Start/end events: pass through (no task added)
                return this.combineSequentialForwardTrace(
                    graph,
                    nextNodeIds,
                    targetNodeId,
                    currentFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker,
                    newVisitedNodes
                );
            }
            
            default: {
                // Unknown node type: treat as pass-through
                return this.combineSequentialForwardTrace(
                    graph,
                    nextNodeIds,
                    targetNodeId,
                    currentFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker,
                    newVisitedNodes
                );
            }
        }
    }

    /**
     * Handle parallel gateway - find join gateway and interleave branches
     * @param {Object} graph - Graph object
     * @param {string} splitGatewayId - Parallel split gateway node ID
     * @param {string} targetNodeId - Target end node ID
     * @param {Array<Object>} currentFT - Current forward trace set
     * @param {number} depth - Current depth
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker instance
     * @param {Set<string>} visitedNodes - Set of visited node IDs
     * @returns {Array<Array<Object>>} Array of trace arrays
     */
    static handleParallelGateway(graph, splitGatewayId, targetNodeId, currentFT, depth, maxLoopIterations, timeoutChecker = null, visitedNodes = new Set()) {
        const outgoingEdges = graph.adjacencyList.get(splitGatewayId) || [];
        
        if (outgoingEdges.length === 0) {
            return [];
        }
        
        // Check if this is a JOIN gateway (single outgoing edge) vs SPLIT gateway (multiple outgoing edges)
        // JOIN gateways converge multiple paths into one - they should be treated as pass-through
        if (outgoingEdges.length === 1) {
            // This is a JOIN gateway (or single path through) - just continue to the next node
            return this.forwardTrace(
                graph,
                outgoingEdges[0].to,
                targetNodeId,
                currentFT,
                depth + 1,
                maxLoopIterations,
                timeoutChecker,
                visitedNodes
            );
        }
        
        // Find the join gateway (parallel gateway that all branches connect to)
        const branchStartIds = outgoingEdges.map(e => e.to);
        const joinGateway = MermaidTraceCalculator.findJoinGateway(graph, splitGatewayId, branchStartIds);
        
        if (!joinGateway) {
            // No explicit join gateway found - still interleave branches to target
            // (parallel branches should be interleaved, not treated as XOR alternatives)
            const branchTraces = branchStartIds.map(branchStartId => 
                this.forwardTrace(
                    graph,
                    branchStartId,
                    targetNodeId,
                    currentFT,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker,
                    new Set(visitedNodes)
                )
            );
            
            // Extract branch-specific traces (remove common prefix)
            const branchSpecificTraces = branchTraces.map(branchTraceArray => 
                branchTraceArray.map(trace => {
                    const prefixLength = currentFT.length;
                    return trace.slice(prefixLength);
                })
            );
            
            // Interleave the branch traces
            const interleaved = MermaidTraceCalculator.interleave(branchSpecificTraces, timeoutChecker);
            
            // Return interleaved traces with common prefix
            return interleaved.map(interleavedTrace => [...currentFT, ...interleavedTrace]);
        }
        
        // Collect traces through each branch until join gateway
        // Each branch processes with same forward trace set
        const branchTraces = branchStartIds.map(branchStartId => {
            if (timeoutChecker) {
                timeoutChecker.check();
            }
            return this.forwardTrace(
                graph,
                branchStartId,
                joinGateway,
                currentFT,
                depth + 1,
                maxLoopIterations,
                timeoutChecker,
                new Set(visitedNodes)
            );
        });
        
        // Extract only the new tasks from each branch (remove the common prefix)
        const branchSpecificTraces = branchTraces.map(branchTraceArray => 
            branchTraceArray.map(trace => {
                // Remove the common prefix (currentFT) from each trace
                const prefixLength = currentFT.length;
                return trace.slice(prefixLength);
            })
        );
        
        // Interleave branch-specific traces
        const interleaved = MermaidTraceCalculator.interleave(branchSpecificTraces, timeoutChecker);
        
        // Continue from join gateway to target
        if (timeoutChecker) {
            timeoutChecker.check();
        }
        const joinTraces = this.forwardTrace(
            graph,
            joinGateway,
            targetNodeId,
            currentFT,
            depth + 1,
            maxLoopIterations,
            timeoutChecker,
            new Set(visitedNodes)
        );
        
        // Combine interleaved traces with join traces
        const result = [];
        for (const interleavedTrace of interleaved) {
            for (const joinTrace of joinTraces) {
                // Prepend common prefix and combine
                const combinedTrace = [...currentFT, ...interleavedTrace];
                // Remove common prefix from join trace and append
                const joinTraceSuffix = joinTrace.slice(currentFT.length);
                result.push([...combinedTrace, ...joinTraceSuffix]);
            }
        }
        
        return result;
    }

    /**
     * Combine Sequential Forward Trace
     * Implements sequential processing where each next node receives accumulated trace set
     * 
     * @param {Object} graph - Graph object
     * @param {Array<string>} nextNodeIds - Next node IDs to process
     * @param {string} targetNodeId - Target end node ID
     * @param {Array<Object>} initialFT - Initial forward trace set
     * @param {number} depth - Recursion depth
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker
     * @param {Set<string>} visitedNodes - Set of visited node IDs
     * @returns {Array<Array<Object>>} Combined trace arrays
     */
    static combineSequentialForwardTrace(graph, nextNodeIds, targetNodeId, initialFT, depth, maxLoopIterations, timeoutChecker, visitedNodes = new Set()) {
        if (nextNodeIds.length === 0) {
            return [[...initialFT]];
        }
        
        // Start with initial forward trace set
        let currentTraces = [[...initialFT]];
        
        // Process each next node sequentially, accumulating forward trace set
        for (const nextNodeId of nextNodeIds) {
            if (timeoutChecker) {
                timeoutChecker.check();
            }
            
            const newTraces = [];
            
            // For each current trace, process next node and accumulate
            for (const currentTrace of currentTraces) {
                if (timeoutChecker) {
                    timeoutChecker.check();
                }
                
                // Process next node with current accumulated trace set
                const nextTraces = this.forwardTrace(
                    graph,
                    nextNodeId,
                    targetNodeId,
                    currentTrace,
                    depth + 1,
                    maxLoopIterations,
                    timeoutChecker,
                    visitedNodes
                );
                
                // Accumulate next traces
                newTraces.push(...nextTraces);
            }
            
            currentTraces = newTraces;
        }
        
        return currentTraces;
    }
}

export class MermaidTraceCalculator {
    /**
     * Calculate all possible execution traces from Mermaid syntax using GTA approach
     * @param {string} mermaidString - Mermaid flowchart syntax
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(mermaidString, options = {}) {
        // Log input for debugging
        if (!mermaidString || typeof mermaidString !== 'string') {
            console.warn('[MermaidTraceCalculator] Invalid input: mermaidString is', typeof mermaidString, mermaidString);
            return [];
        }
        
        const maxLoopIterations = options.maxLoopIterations !== undefined 
            ? options.maxLoopIterations 
            : MAX_LOOP_ITERATIONS;
        
        // Create timeout checker
        const timeoutChecker = new TimeoutChecker(TIMEOUT_MS);
        
        try {
            // Preprocess Mermaid code before calculating traces
            let preprocessedCode = mermaidString;
            try {
                const preprocessResult = MermaidParser.cleanAndValidate(mermaidString, true);
                preprocessedCode = preprocessResult.code;
            } catch (error) {
                console.warn('[MermaidTraceCalculator] Failed to preprocess Mermaid code, using original:', error);
            }
            
            // Parse Mermaid syntax to build graph
            const graph = this.parseMermaid(preprocessedCode);
            
            if (!graph || graph.nodes.length === 0) {
                console.warn('[MermaidTraceCalculator] No valid graph found');
                return [];
            }
            
            // Pre-process: Identify nodes in multiple loops
            const nodesInMultipleLoops = this.identifyNodesInMultipleLoops(graph);
            graph.nodesInMultipleLoops = nodesInMultipleLoops;
            
            // Find start and end nodes (reference sources and targets)
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
            
            // Calculate traces from each start node to each end node using GTA
            const allTraceArrays = [];
            
            for (const startNode of startNodes) {
                for (const endNode of endNodes) {
                    if (timeoutChecker) {
                        timeoutChecker.check();
                    }
                    
                    // Initialize forward trace set: FT = [] (empty set)
                    const initialForwardTrace = [];
                    
                    // Calculate traces using GTA forward trace
                    const traceArrays = TraceSets.forwardTrace(
                        graph,
                        startNode.id,
                        endNode.id,
                        initialForwardTrace,
                        0,
                        maxLoopIterations,
                        timeoutChecker
                    );
                    
                    allTraceArrays.push(...traceArrays);
                }
            }
            
            // Filter duplicate traces
            const uniqueTraces = this.filterDuplicateTraces(allTraceArrays);
            
            // Convert to Trace objects
            const traces = uniqueTraces.map((path, index) => {
                const trace = new Trace(
                    `trace-${index + 1}`,
                    path,
                    this.determineTraceType(path, graph)
                );
                return trace;
            });
            
            return traces;
            
        } catch (error) {
            // Re-throw timeout errors so they can be displayed in the UI
            if (error.message && error.message.includes('exceeded') && error.message.includes('timeout')) {
                throw error;
            }
            console.error('[MermaidTraceCalculator] Error calculating traces:', error);
            return [];
        }
    }

    /**
     * Parallel interleaving (permutations of branch order)
     * Each branch is treated as a single unit - tasks within a branch stay together
     * @param {Array<Array<Array<Object>>>} branches - Array of branch trace sets
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
            const branchTraceArrays = perm.map(idx => branches[idx]);
            
            // Take cartesian product: one trace from each branch
            const combinations = this.cartesianProduct(branchTraceArrays, timeoutChecker);
            
            // For each combination, concatenate the traces in order
            for (const combination of combinations) {
                if (timeoutChecker) {
                    timeoutChecker.check();
                }
                // Each element in combination is a trace (array of tasks)
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
     * Extract task information from task node
     * @param {Object} node - Node object
     * @returns {Object|null} Task object: {id, alt_id, task} or null
     */
    static extractTask(node) {
        try {
            // Accept any task type (task, scripttask, servicetask, usertask, etc.)
            if (!node || (node.type !== 'task' && !node.type.endsWith('task'))) {
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
     * Find the join gateway for a parallel split gateway
     * @param {Object} graph - Graph object
     * @param {string} splitGatewayId - Split gateway ID
     * @param {Array<string>} branchStartIds - IDs of nodes where branches start
     * @returns {string|null} Join gateway ID or null
     */
    static findJoinGateway(graph, splitGatewayId, branchStartIds) {
        // First, look for a parallel gateway that all branches can reach
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
        
        // If no parallel gateway found, look for any gateway (exclusive or parallel)
        // that all branches converge at - this handles cases where parallel branches
        // converge at an exclusive gateway before continuing
        for (const node of graph.nodes) {
            if ((node.type === 'exclusivegateway' || node.type === 'parallelgateway') && 
                node.id !== splitGatewayId) {
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
        let lastNodeId = null;
        let skippedLines = 0;
        for (const line of contentLines) {
            // Parse edge: node1 --> node2 or node1 -->|label| node2
            const arrowIndex = line.indexOf('-->');
            if (arrowIndex === -1) {
                // No arrow - might be a node definition
                const nodeMatch = line.match(/^([^:]+):([^:]+):(.+)$/);
                if (nodeMatch) {
                    lastNodeId = line.trim();
                    this.ensureNodeExists(graph, lastNodeId);
                }
                continue;
            }
            
            const beforeArrow = line.substring(0, arrowIndex).trim();
            const afterArrow = line.substring(arrowIndex + 3).trim();
            
            // Handle continuation lines
            let fromNodeIdFull;
            if (beforeArrow) {
                fromNodeIdFull = beforeArrow;
                lastNodeId = beforeArrow;
            } else if (lastNodeId) {
                fromNodeIdFull = lastNodeId;
            } else {
                skippedLines++;
                if (skippedLines <= 5) {
                    console.warn(`[MermaidTraceCalculator] Skipping edge with no source: ${line}`);
                }
                continue;
            }
            
            // Extract edge label if present
            let edgeLabel = null;
            let toNodeId = afterArrow;
            
            // Handle edge labels that may contain quoted strings with | characters
            // Examples: |"data.refill == 'yes'"| or |"|"| (empty/default condition)
            // First try to match quoted string labels, then fall back to simple labels
            const quotedLabelMatch = afterArrow.match(/^\|("(?:[^"\\]|\\.)*")\|\s*(.+)$/);
            const simpleLabelMatch = afterArrow.match(/^\|([^|]+)\|\s*(.+)$/);
            
            if (quotedLabelMatch) {
                // Quoted label like |"data.refill == 'yes'"| or |"|"|
                edgeLabel = quotedLabelMatch[1].trim();
                toNodeId = quotedLabelMatch[2].trim();
            } else if (simpleLabelMatch) {
                // Simple label without quotes
                edgeLabel = simpleLabelMatch[1].trim();
                toNodeId = simpleLabelMatch[2].trim();
            }
            
            const toNodeIdFull = toNodeId;
            
            // Ensure nodes exist
            const fromNodeId = this.ensureNodeExists(graph, fromNodeIdFull);
            const toNodeIdShort = this.ensureNodeExists(graph, toNodeIdFull);
            
            lastNodeId = toNodeIdFull;
            
            // Add edge
            graph.edges.push({
                from: fromNodeId,
                to: toNodeIdShort,
                label: edgeLabel
            });
            
            // Add to adjacency list
            if (!graph.adjacencyList.has(fromNodeId)) {
                graph.adjacencyList.set(fromNodeId, []);
            }
            graph.adjacencyList.get(fromNodeId).push({
                to: toNodeIdShort,
                label: edgeLabel
            });
        }
        
        if (skippedLines > 5) {
            console.warn(`[MermaidTraceCalculator] Skipped ${skippedLines} lines total (only first 5 logged)`);
        }
                
        return graph;
    }

    /**
     * Ensure a node exists in the graph, parsing it if needed
     * @param {Object} graph - Graph object
     * @param {string} nodeId - Node identifier
     * @returns {string} The short node ID
     */
    static ensureNodeExists(graph, nodeId) {
        const existingNode = graph.nodes.find(n => n.fullId === nodeId);
        if (existingNode) {
            return existingNode.id;
        }
        
        // Parse node definition: id:type:(label) or id:type: or id:type:{x}
        // Handle cases: id:type:, id:type:(label), id:type:{x}
        const nodeMatchWithLabel = nodeId.match(/^([^:]+):([^:]+):(.+)$/);
        const nodeMatchWithoutLabel = nodeId.match(/^([^:]+):([^:]+):$/);
        
        let shortId, nodeType, nodeLabel;
        
        if (nodeMatchWithLabel) {
            // Has label: id:type:(label) or id:type:{x}
            const [, id, type, labelPart] = nodeMatchWithLabel;
            shortId = id.trim();
            nodeType = type.trim();
            let label = '';
            
            // Extract label from parentheses or curly braces
            if (labelPart.startsWith('(') && labelPart.endsWith(')')) {
                label = labelPart.slice(1, -1);
                if (label.startsWith('(') && label.endsWith(')')) {
                    label = label.slice(1, -1);
                }
            } else if (labelPart.startsWith('{') && labelPart.endsWith('}')) {
                label = labelPart.slice(1, -1);
            } else {
                label = labelPart;
            }
            
            nodeLabel = label.trim();
        } else if (nodeMatchWithoutLabel) {
            // No label: id:type: - extract just the id part
            const [, id, type] = nodeMatchWithoutLabel;
            shortId = id.trim();
            nodeType = type.trim();
            nodeLabel = '';
        } else {
            // Fallback: treat as simple ID
            shortId = nodeId;
            nodeType = 'unknown';
            nodeLabel = nodeId;
        }
        
        // Check if node with short ID already exists (this handles deduplication)
        const existingShortIdNode = graph.nodes.find(n => n.id === shortId);
        if (existingShortIdNode) {
            // Update fullId if it's different (preserve the most complete version)
            if (existingShortIdNode.fullId !== nodeId) {
                existingShortIdNode.fullId = nodeId;
                // Update label if the new one is more complete (has label when existing doesn't)
                if (!existingShortIdNode.label && nodeLabel) {
                    existingShortIdNode.label = nodeLabel;
                }
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
     * Identify nodes that are part of multiple loops
     * @param {Object} graph - Graph object
     * @returns {Map<string, number>} Map of nodeId -> loopCount
     */
    static identifyNodesInMultipleLoops(graph) {
        const nodeLoopCounts = new Map();
        
        for (const node of graph.nodes) {
            nodeLoopCounts.set(node.id, 0);
        }
        
        const cycles = this.findAllCycles(graph);
        
        for (const cycle of cycles) {
            for (const nodeId of cycle) {
                const currentCount = nodeLoopCounts.get(nodeId) || 0;
                nodeLoopCounts.set(nodeId, currentCount + 1);
            }
        }
        
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
     * @param {Object} graph - Graph object
     * @returns {Array<Set<string>>} Array of cycles
     */
    static findAllCycles(graph) {
        const allCycles = [];
        const cycleSignatures = new Set();
        
        for (const node of graph.nodes) {
            const cyclesFromNode = this.findCyclesFromNode(graph, node.id, new Set(), []);
            
            for (const cycle of cyclesFromNode) {
                const cycleSet = new Set(cycle);
                const signature = Array.from(cycleSet).sort().join(',');
                
                if (!cycleSignatures.has(signature) && cycleSet.size > 1) {
                    cycleSignatures.add(signature);
                    allCycles.push(cycleSet);
                }
            }
        }
        
        return allCycles;
    }

    /**
     * Find cycles starting from a specific node
     * @param {Object} graph - Graph object
     * @param {string} currentNode - Current node ID
     * @param {Set<string>} visitedInPath - Nodes visited in current path
     * @param {Array<string>} currentPath - Current path being explored
     * @param {number} maxDepth - Maximum search depth
     * @returns {Array<Array<string>>} Array of cycles
     */
    static findCyclesFromNode(graph, currentNode, visitedInPath = new Set(), currentPath = [], maxDepth = 20) {
        if (maxDepth <= 0) {
            return [];
        }
        
        if (visitedInPath.has(currentNode)) {
            const cycleStartIndex = currentPath.indexOf(currentNode);
            if (cycleStartIndex !== -1) {
                const cycle = currentPath.slice(cycleStartIndex);
                cycle.push(currentNode);
                return [cycle];
            }
            return [];
        }
        
        const newVisitedInPath = new Set(visitedInPath);
        newVisitedInPath.add(currentNode);
        const newPath = [...currentPath, currentNode];
        
        const neighbors = graph.adjacencyList.get(currentNode) || [];
        const cycles = [];
        
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
     * @param {Object} graph - Graph object
     * @returns {string} Trace type
     */
    static determineTraceType(path, graph = null) {
        const nodeIds = path.map(t => t.id || t.alt_id);
        const uniqueNodes = new Set(nodeIds);
        
        if (nodeIds.length === uniqueNodes.size) {
            return 'sequential';
        }
        
        const nodeOccurrences = new Map();
        for (let i = 0; i < nodeIds.length; i++) {
            const nodeId = nodeIds[i];
            if (!nodeOccurrences.has(nodeId)) {
                nodeOccurrences.set(nodeId, []);
            }
            nodeOccurrences.get(nodeId).push(i);
        }
        
        for (const [nodeId, indices] of nodeOccurrences) {
            if (indices.length < 2) {
                continue;
            }
            
            if (graph && this.hasCycleIncludingNode(graph, nodeId)) {
                return 'loop';
            }
            
            if (!graph) {
                return 'loop';
            }
        }
        
        return 'sequential';
    }
    
    /**
     * Check if a node is part of a cycle
     * @param {Object} graph - Graph object
     * @param {string} nodeId - Node ID to check
     * @returns {boolean} True if node is part of a cycle
     */
    static hasCycleIncludingNode(graph, nodeId) {
        const visited = new Set();
        return this.hasPathToSelf(graph, nodeId, nodeId, visited, 50);
    }
    
    /**
     * Check if there's a path from a node back to itself
     * @param {Object} graph - Graph object
     * @param {string} startNode - Starting node
     * @param {string} targetNode - Target node
     * @param {Set<string>} visited - Visited nodes
     * @param {number} maxDepth - Maximum search depth
     * @returns {boolean} True if path exists
     */
    static hasPathToSelf(graph, startNode, targetNode, visited = new Set(), maxDepth = 50) {
        if (maxDepth <= 0) {
            return false;
        }
        
        const neighbors = graph.adjacencyList.get(startNode) || [];
        for (const edge of neighbors) {
            if (edge.to === targetNode && visited.size > 0) {
                return true;
            }
            
            if (!visited.has(edge.to)) {
                const newVisited = new Set(visited);
                newVisited.add(edge.to);
                if (this.hasPathToSelf(graph, edge.to, targetNode, newVisited, maxDepth - 1)) {
                    return true;
                }
            }
        }
        
        return false;
    }
}
