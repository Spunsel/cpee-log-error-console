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

const MAX_LOOP_ITERATIONS = 1;
const TIMEOUT_MS = 2000;
const MAX_GATEWAY_VISITS = MAX_LOOP_ITERATIONS + 1;

class TimeoutChecker {
    constructor(timeoutMs) {
        this.startTime = Date.now();
        this.timeoutMs = timeoutMs;
    }
    
    check() {
        if (Date.now() - this.startTime > this.timeoutMs) {
            throw new Error(`Trace calculation exceeded ${this.timeoutMs}ms timeout. The Mermaid graph is too complex to calculate all traces.`);
        }
    }
}

/**
 * GTA Topology Iterators for Graph Structure
 */
class TopologyIterators {
    /**
     * Forward Iterator - returns next component(s) in forward trace direction
     */
    static forwardIterator(graph, nodeId) {
        const outgoingEdges = graph.adjacencyList.get(nodeId) || [];
        return outgoingEdges.map(edge => edge.to);
    }

    /**
     * Backward Iterator - returns previous component(s) in backward trace direction
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
     * Cotree Iterator - checks if adding this node creates a cycle in the forward trace
     */
    static cotreeIterator(nodeId, forwardTraceSet) {
        if (!nodeId) { return false; }
        return forwardTraceSet.some(task => (task.id || task.alt_id) === nodeId);
    }

    /**
     * Check if a task is an "isolated loop task" - a task whose only incoming
     * and outgoing edges connect to the same exclusive gateway.
     */
    static isIsolatedLoopTask(graph, taskNodeId) {
        const incomingNodeIds = this.backwardIterator(graph, taskNodeId);
        const outgoingNodeIds = this.forwardIterator(graph, taskNodeId);
        
        if (incomingNodeIds.length !== 1 || outgoingNodeIds.length !== 1) { return false; }
        if (incomingNodeIds[0] !== outgoingNodeIds[0]) { return false; }
        
        const connectedNode = graph.nodes.find(n => n.id === incomingNodeIds[0]);
        return connectedNode && connectedNode.type === 'exclusivegateway';
    }
}

/**
 * GTA Trace Sets for Graph Structure
 */
class TraceSets {
    /**
     * Forward Trace (FT_i) - recursive graph traversal building execution traces.
     * 
     * @param {Object} graph - Graph object with nodes and adjacencyList
     * @param {string} currentNodeId - Current node ID
     * @param {string} targetNodeId - Target end node ID
     * @param {Array<Object>} currentFT - Current forward trace set
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {TimeoutChecker} timeoutChecker - Timeout checker
     * @param {number} nonTaskSteps - Consecutive non-task steps (for gateway-only cycle detection)
     * @param {Map<string,number>} gatewayVisits - Per-gateway visit counts (bounds gateway loops with interleaved tasks)
     * @returns {Array<Array<Object>>} Array of forward trace arrays
     */
    static forwardTrace(graph, currentNodeId, targetNodeId, currentFT, maxLoopIterations, timeoutChecker, nonTaskSteps = 0, gatewayVisits = new Map()) {
        timeoutChecker.check();
        
        if (currentNodeId === targetNodeId) {
            return [[...currentFT]];
        }
        
        const node = graph.nodes.find(n => n.id === currentNodeId);
        if (!node) { return []; }
        
        const isTaskType = node.type === 'task' || node.type.endsWith('task') || node.type === 'subprocess';
        
        if (!isTaskType && nonTaskSteps > (graph.maxGatewayOnlySteps ?? 2)) {
            return [];
        }
        
        // Cotree check: bound loop iterations for task nodes
        if (TopologyIterators.cotreeIterator(currentNodeId, currentFT)) {
            const visitCount = currentFT.filter(task => (task.id || task.alt_id) === currentNodeId).length;
            if (visitCount > maxLoopIterations) { return []; }
            
            if (isTaskType && TopologyIterators.isIsolatedLoopTask(graph, currentNodeId)) {
                if (currentFT.length > 0) {
                    const lastTaskId = currentFT[currentFT.length - 1].id || currentFT[currentFT.length - 1].alt_id;
                    if (lastTaskId === currentNodeId) { return []; }
                }
            }
        }
        
        const nextNodeIds = TopologyIterators.forwardIterator(graph, currentNodeId);
        if (nextNodeIds.length === 0) { return []; }
        
        if (isTaskType) {
            const task = MermaidTraceCalculator.extractTask(node);
            if (!task) { return []; }
            
            const newFT = [...currentFT, task];
            return nextNodeIds.flatMap(nextNodeId => 
                this.forwardTrace(graph, nextNodeId, targetNodeId, newFT, maxLoopIterations, timeoutChecker, 0, gatewayVisits)
            );
        }
        
        const nextNTS = nonTaskSteps + 1;
        
        switch (node.type) {
            case 'exclusivegateway': {
                const visits = (gatewayVisits.get(currentNodeId) || 0) + 1;
                if (visits > MAX_GATEWAY_VISITS) { return []; }
                const newGatewayVisits = new Map(gatewayVisits);
                newGatewayVisits.set(currentNodeId, visits);
                return nextNodeIds.flatMap(nextNodeId => 
                    this.forwardTrace(graph, nextNodeId, targetNodeId, currentFT, maxLoopIterations, timeoutChecker, nextNTS, newGatewayVisits)
                );
            }
            
            case 'parallelgateway':
                return this.handleParallelGateway(graph, currentNodeId, targetNodeId, currentFT, maxLoopIterations, timeoutChecker);
            
            case 'inclusivegateway':
                return this.handleInclusiveGateway(graph, currentNodeId, targetNodeId, currentFT, maxLoopIterations, timeoutChecker);
            
            case 'escalate':
                return [[...currentFT]];
            
            default:
                return this.forwardTrace(graph, nextNodeIds[0], targetNodeId, currentFT, maxLoopIterations, timeoutChecker, nextNTS, gatewayVisits);
        }
    }

    /**
     * Process parallel branches: trace each branch, strip prefix, extract shared
     * nodes, interleave unique parts, and append shared nodes.
     * 
     * @returns {Array<Array<Object>>} Interleaved traces (without FT prefix)
     */
    static processBranches(graph, branchStartIds, branchTarget, currentFT, maxLoopIterations, timeoutChecker) {
        const branchTraces = branchStartIds.map(id => {
            timeoutChecker.check();
            return this.forwardTrace(graph, id, branchTarget, currentFT, maxLoopIterations, timeoutChecker);
        });
        
        const branchSpecific = branchTraces.map(traces => 
            traces.map(trace => trace.slice(currentFT.length))
        );
        
        const sharedNodeIds = this.findSharedNodesInBranches(branchSpecific);
        
        const uniqueBranches = branchSpecific.map(traces =>
            traces.map(trace => trace.filter(task => !sharedNodeIds.has(task.id || task.alt_id)))
        );
        
        const sharedNodes = this.extractSharedNodesInOrder(branchSpecific, sharedNodeIds);
        const interleaved = MermaidTraceCalculator.interleave(uniqueBranches, timeoutChecker);
        
        return interleaved.map(trace => [...trace, ...sharedNodes]);
    }

    /**
     * Handle parallel gateway - find join gateway and interleave branches.
     */
    static handleParallelGateway(graph, splitGatewayId, targetNodeId, currentFT, maxLoopIterations, timeoutChecker) {
        const outgoingEdges = graph.adjacencyList.get(splitGatewayId) || [];
        
        if (outgoingEdges.length === 0) { return []; }
        
        if (outgoingEdges.length === 1) {
            return this.forwardTrace(graph, outgoingEdges[0].to, targetNodeId, currentFT, maxLoopIterations, timeoutChecker);
        }
        
        const branchStartIds = outgoingEdges.map(e => e.to);
        const joinGateway = MermaidTraceCalculator.findJoinGateway(graph, splitGatewayId, branchStartIds);
        const branchTarget = joinGateway || targetNodeId;
        
        const interleavedBranches = this.processBranches(graph, branchStartIds, branchTarget, currentFT, maxLoopIterations, timeoutChecker);
        
        if (!joinGateway) {
            return interleavedBranches.map(trace => [...currentFT, ...trace]);
        }
        
        timeoutChecker.check();
        const joinTraces = this.forwardTrace(graph, joinGateway, targetNodeId, currentFT, maxLoopIterations, timeoutChecker);
        
        const result = [];
        for (const branchTrace of interleavedBranches) {
            for (const joinTrace of joinTraces) {
                result.push([...currentFT, ...branchTrace, ...joinTrace.slice(currentFT.length)]);
            }
        }
        return result;
    }

    /**
     * Handle inclusive gateway (OR) - generates traces for all non-empty subsets
     * of outgoing branches.
     */
    static handleInclusiveGateway(graph, splitGatewayId, targetNodeId, currentFT, maxLoopIterations, timeoutChecker) {
        const outgoingEdges = graph.adjacencyList.get(splitGatewayId) || [];
        
        if (outgoingEdges.length === 0) { return []; }
        
        if (outgoingEdges.length === 1) {
            return this.forwardTrace(graph, outgoingEdges[0].to, targetNodeId, currentFT, maxLoopIterations, timeoutChecker);
        }
        
        const branchStartIds = outgoingEdges.map(e => e.to);
        const joinGateway = MermaidTraceCalculator.findJoinGateway(graph, splitGatewayId, branchStartIds);
        const branchTarget = joinGateway || targetNodeId;
        
        // Trace each branch once upfront
        const perBranchTraces = branchStartIds.map(id => {
            timeoutChecker.check();
            return this.forwardTrace(graph, id, branchTarget, currentFT, maxLoopIterations, timeoutChecker);
        });
        
        const perBranchSpecific = perBranchTraces.map(traces =>
            traces.map(trace => trace.slice(currentFT.length))
        );
        
        const subsets = MermaidTraceCalculator.generateNonEmptySubsets(branchStartIds.map((_, i) => i));
        const allTraces = [];
        
        for (const subset of subsets) {
            timeoutChecker.check();
            
            if (subset.length === 1) {
                for (const branchTrace of perBranchSpecific[subset[0]]) {
                    allTraces.push([...currentFT, ...branchTrace]);
                }
            } else {
                const selectedBranches = subset.map(idx => perBranchSpecific[idx]);
                const sharedNodeIds = this.findSharedNodesInBranches(selectedBranches);
                
                const uniqueBranches = selectedBranches.map(traces =>
                    traces.map(trace => trace.filter(task => !sharedNodeIds.has(task.id || task.alt_id)))
                );
                
                const sharedNodes = this.extractSharedNodesInOrder(selectedBranches, sharedNodeIds);
                const interleaved = MermaidTraceCalculator.interleave(uniqueBranches, timeoutChecker);
                
                for (const interleavedTrace of interleaved) {
                    allTraces.push([...currentFT, ...interleavedTrace, ...sharedNodes]);
                }
            }
        }
        
        if (!joinGateway) { return allTraces; }
        
        timeoutChecker.check();
        const joinTraces = this.forwardTrace(graph, joinGateway, targetNodeId, currentFT, maxLoopIterations, timeoutChecker);
        
        const result = [];
        for (const inclusiveTrace of allTraces) {
            for (const joinTrace of joinTraces) {
                result.push([...inclusiveTrace, ...joinTrace.slice(currentFT.length)]);
            }
        }
        return result;
    }

    /**
     * Find nodes that appear in multiple branches (shared/converging nodes).
     */
    static findSharedNodesInBranches(branchSpecificTraces) {
        const nodeOccurrences = new Map();
        
        for (const branchTraceArray of branchSpecificTraces) {
            const seenInBranch = new Set();
            for (const trace of branchTraceArray) {
                for (const task of trace) {
                    const taskId = task.id || task.alt_id;
                    if (taskId && !seenInBranch.has(taskId)) {
                        seenInBranch.add(taskId);
                        nodeOccurrences.set(taskId, (nodeOccurrences.get(taskId) || 0) + 1);
                    }
                }
            }
        }
        
        const sharedNodes = new Set();
        for (const [nodeId, count] of nodeOccurrences) {
            if (count > 1) { sharedNodes.add(nodeId); }
        }
        return sharedNodes;
    }

    /**
     * Extract shared nodes in their correct order from branch traces.
     */
    static extractSharedNodesInOrder(branchSpecificTraces, sharedNodeIds) {
        if (sharedNodeIds.size === 0) { return []; }
        
        for (const branchTraceArray of branchSpecificTraces) {
            if (branchTraceArray.length > 0) {
                const sharedNodesInOrder = [];
                const seen = new Set();
                
                for (const task of branchTraceArray[0]) {
                    const taskId = task.id || task.alt_id;
                    if (taskId && sharedNodeIds.has(taskId) && !seen.has(taskId)) {
                        seen.add(taskId);
                        sharedNodesInOrder.push(task);
                    }
                }
                
                if (seen.size === sharedNodeIds.size) { return sharedNodesInOrder; }
            }
        }
        
        // Fallback: collect shared nodes from all branches
        const sharedNodesInOrder = [];
        const seen = new Set();
        for (const branchTraceArray of branchSpecificTraces) {
            for (const trace of branchTraceArray) {
                for (const task of trace) {
                    const taskId = task.id || task.alt_id;
                    if (taskId && sharedNodeIds.has(taskId) && !seen.has(taskId)) {
                        seen.add(taskId);
                        sharedNodesInOrder.push(task);
                    }
                }
            }
        }
        return sharedNodesInOrder;
    }
}

export class MermaidTraceCalculator {
    /**
     * Calculate all possible execution traces from Mermaid syntax using GTA approach.
     * @param {string} mermaidString - Mermaid flowchart syntax
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @param {number} options.timeout - Timeout in ms (default: 2000)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(mermaidString, options = {}) {
        if (!mermaidString || typeof mermaidString !== 'string') { return []; }
        
        const maxLoopIterations = options.maxLoopIterations ?? MAX_LOOP_ITERATIONS;
        const timeoutMs = options.timeout ?? TIMEOUT_MS;
        const timeoutChecker = new TimeoutChecker(timeoutMs);
        
        try {
            let preprocessedCode = mermaidString;
            try {
                preprocessedCode = MermaidParser.cleanAndValidate(mermaidString, true).code;
            } catch (error) { /* continue with original */ }
            
            const graph = this.parseMermaid(preprocessedCode);
            if (!graph || graph.nodes.length === 0) { return []; }
            
            const isTaskNode = n => n.type === 'task' || n.type.endsWith('task') || n.type === 'subprocess';
            graph.maxGatewayOnlySteps = graph.nodes.filter(n => !isTaskNode(n)).length;
            
            const startNodes = graph.nodes.filter(n => n.type === 'startevent');
            const endNodes = graph.nodes.filter(n => n.type === 'endevent');
            if (startNodes.length === 0 || endNodes.length === 0) { return []; }
            
            const allTraceArrays = [];
            for (const startNode of startNodes) {
                for (const endNode of endNodes) {
                    timeoutChecker.check();
                    const traceArrays = TraceSets.forwardTrace(
                        graph, startNode.id, endNode.id, [], maxLoopIterations, timeoutChecker
                    );
                    allTraceArrays.push(...traceArrays);
                }
            }
            
            const uniqueTraces = this.filterDuplicateTraces(allTraceArrays);
            
            return uniqueTraces.map((path, index) => 
                new Trace(`trace-${index + 1}`, path, this.determineTraceType(path))
            );
            
        } catch (error) {
            if (error.message?.includes('exceeded') && error.message?.includes('timeout')) {
                throw error;
            }
            console.error('[MermaidTraceCalculator] Error calculating traces:', error);
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
     * Extract task information from a task node.
     */
    static extractTask(node) {
        if (!node || (node.type !== 'task' && node.type !== 'subprocess' && !node.type.endsWith('task'))) {
            return null;
        }
        return { id: null, alt_id: node.id, task: node.label || node.id };
    }

    /**
     * Find the join gateway for a split gateway. Prefers parallel/inclusive
     * gateways, falls back to exclusive gateways.
     */
    static findJoinGateway(graph, splitGatewayId, branchStartIds) {
        let fallbackExclusive = null;
        
        for (const node of graph.nodes) {
            if (node.id === splitGatewayId) { continue; }
            const { type } = node;
            if (type !== 'parallelgateway' && type !== 'inclusivegateway' && type !== 'exclusivegateway') { continue; }
            
            if (!branchStartIds.every(id => this.pathExists(graph, id, node.id))) { continue; }
            
            if (type !== 'exclusivegateway') { return node.id; }
            if (!fallbackExclusive) { fallbackExclusive = node.id; }
        }
        return fallbackExclusive;
    }

    /**
     * Check if a path exists from source to target (depth-bounded DFS).
     */
    static pathExists(graph, source, target, maxDepth = 50, visited = new Set()) {
        if (source === target) { return true; }
        if (maxDepth <= 0 || visited.has(source)) { return false; }
        
        visited.add(source);
        const neighbors = graph.adjacencyList.get(source) || [];
        for (const edge of neighbors) {
            if (this.pathExists(graph, edge.to, target, maxDepth - 1, visited)) {
                visited.delete(source);
                return true;
            }
        }
        visited.delete(source);
        return false;
    }

    /**
     * Parse Mermaid syntax into a graph structure.
     */
    static parseMermaid(mermaidString) {
        const graph = {
            nodes: [],
            edges: [],
            adjacencyList: new Map()
        };
        
        const lines = mermaidString.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        const contentLines = lines.filter(line => !line.match(/^(graph|flowchart)\s+(LR|TD|TB|RL|BT)/i));
        
        let lastNodeId = null;
        for (const line of contentLines) {
            const arrowIndex = line.indexOf('-->');
            if (arrowIndex === -1) {
                const nodeMatch = line.match(/^([^:]+):([^:]+):(.+)$/);
                if (nodeMatch) {
                    lastNodeId = line.trim();
                    this.ensureNodeExists(graph, lastNodeId);
                }
                continue;
            }
            
            const beforeArrow = line.substring(0, arrowIndex).trim();
            const afterArrow = line.substring(arrowIndex + 3).trim();
            
            let fromNodeIdFull;
            if (beforeArrow) {
                fromNodeIdFull = beforeArrow;
                lastNodeId = beforeArrow;
            } else if (lastNodeId) {
                fromNodeIdFull = lastNodeId;
            } else {
                continue;
            }
            
            let edgeLabel = null;
            let toNodeId = afterArrow;
            
            const quotedLabelMatch = afterArrow.match(/^\|("(?:[^"\\]|\\.)*")\|\s*(.+)$/);
            const simpleLabelMatch = afterArrow.match(/^\|([^|]+)\|\s*(.+)$/);
            
            if (quotedLabelMatch) {
                edgeLabel = quotedLabelMatch[1].trim();
                toNodeId = quotedLabelMatch[2].trim();
            } else if (simpleLabelMatch) {
                edgeLabel = simpleLabelMatch[1].trim();
                toNodeId = simpleLabelMatch[2].trim();
            }
            
            const fromNodeId = this.ensureNodeExists(graph, fromNodeIdFull);
            const toNodeIdShort = this.ensureNodeExists(graph, toNodeId);
            
            lastNodeId = toNodeId;
            
            graph.edges.push({ from: fromNodeId, to: toNodeIdShort, label: edgeLabel });
            
            if (!graph.adjacencyList.has(fromNodeId)) {
                graph.adjacencyList.set(fromNodeId, []);
            }
            graph.adjacencyList.get(fromNodeId).push({ to: toNodeIdShort, label: edgeLabel });
        }
        
        return graph;
    }

    /**
     * Ensure a node exists in the graph, parsing its id:type:(label) format.
     */
    static ensureNodeExists(graph, nodeId) {
        const existingNode = graph.nodes.find(n => n.fullId === nodeId);
        if (existingNode) { return existingNode.id; }
        
        const nodeMatchWithLabel = nodeId.match(/^([^:]+):([^:]+):(.+)$/);
        const nodeMatchWithoutLabel = nodeId.match(/^([^:]+):([^:]+):$/);
        
        let shortId, nodeType, nodeLabel;
        
        if (nodeMatchWithLabel) {
            const [, id, type, labelPart] = nodeMatchWithLabel;
            shortId = id.trim();
            nodeType = type.trim();
            let label = '';
            
            if (labelPart.startsWith('(') && labelPart.endsWith(')')) {
                label = labelPart.slice(1, -1);
                if (label.startsWith('(') && label.endsWith(')')) { label = label.slice(1, -1); }
            } else if (labelPart.startsWith('{') && labelPart.endsWith('}')) {
                label = labelPart.slice(1, -1);
            } else {
                label = labelPart;
            }
            nodeLabel = label.trim();
        } else if (nodeMatchWithoutLabel) {
            const [, id, type] = nodeMatchWithoutLabel;
            shortId = id.trim();
            nodeType = type.trim();
            nodeLabel = '';
        } else {
            shortId = nodeId;
            nodeType = 'unknown';
            nodeLabel = nodeId;
        }
        
        const existingShortIdNode = graph.nodes.find(n => n.id === shortId);
        if (existingShortIdNode) {
            if (existingShortIdNode.fullId !== nodeId) {
                existingShortIdNode.fullId = nodeId;
                if (!existingShortIdNode.label && nodeLabel) { existingShortIdNode.label = nodeLabel; }
            }
            return shortId;
        }
        
        graph.nodes.push({ id: shortId, type: nodeType, label: nodeLabel, fullId: nodeId });
        return shortId;
    }

    /**
     * Filter duplicate traces by comparing serialized task sequences.
     */
    static filterDuplicateTraces(traces) {
        const seen = new Set();
        const result = [];
        
        for (const trace of traces) {
            if (trace.length === 0) { continue; }
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
            const id = t.id || t.alt_id;
            if (seen.has(id)) { return 'loop'; }
            seen.add(id);
        }
        return 'sequential';
    }

    /**
     * Validate if a trace sequence is a valid navigable path in the Mermaid graph.
     * Uses permissive settings (higher loop iterations, longer timeout).
     */
    static validateTrace(mermaidString, traceSequence, options = {}) {
        if (!traceSequence || traceSequence.length === 0) {
            return { valid: false, matchedPath: null, reason: 'Empty trace sequence' };
        }

        try {
            const allTraces = this.calculateAllTraces(mermaidString, {
                maxLoopIterations: 4, timeout: 5000, ...options
            });
            
            if (allTraces.length === 0) {
                return { valid: false, matchedPath: null, reason: 'No traces could be calculated from Mermaid graph' };
            }

            for (const trace of allTraces) {
                if (this.traceMatchesSequence(trace, traceSequence)) {
                    return { valid: true, matchedPath: trace.path, reason: null };
                }
            }

            return { valid: false, matchedPath: null, reason: 'Trace sequence does not match any valid path in Mermaid graph' };

        } catch (error) {
            console.error('[MermaidTraceCalculator] Error validating trace:', error);
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
            const taskAltId = task.alt_id !== null ? String(task.alt_id) : null;
            const taskId = task.id !== null ? String(task.id) : null;

            if (seqIdStr !== taskAltId && seqIdStr !== taskId) { return false; }
        }
        return true;
    }

    /**
     * Validate multiple trace sequences against a Mermaid graph.
     */
    static validateMultipleTraces(mermaidString, traceSequences, options = {}) {
        let allTraces;
        try {
            allTraces = this.calculateAllTraces(mermaidString, {
                maxLoopIterations: 4, timeout: 5000, ...options
            });
        } catch (error) {
            console.error('[MermaidTraceCalculator] Error calculating traces for validation:', error);
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
     * Extract all tasks from a Mermaid graph (for reachability analysis).
     */
    static extractAllTasksFromGraph(mermaidString) {
        if (!mermaidString || typeof mermaidString !== 'string') { return []; }

        try {
            const graph = this.parseMermaid(mermaidString);
            return graph.nodes
                .filter(node => node.type === 'task' || node.type === 'subprocess' || node.type.endsWith('task'))
                .map(node => ({ id: node.id, alt_id: node.id, task: node.label || '' }));
        } catch (error) {
            console.error('[MermaidTraceCalculator] Error extracting tasks from graph:', error);
            return [];
        }
    }
}
