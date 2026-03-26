/**
 * Reachability Analyzer
 * Implements graph reachability analysis based on "Program Analysis Via Graph Reachability" by Thomas Reps
 * 
 * Reference: Reps, T. (1998). Program Analysis Via Graph Reachability.
 * Information and Software Technology, 40(11-12), 701-726.
 * 
 * Key Concepts from Reps (1998):
 * - Forward Reachability: Nodes reachable from start nodes via forward edges
 * - Backward Reachability: Nodes that can reach end nodes via backward traversal
 * - Transitive Closure: Complete reachability relation between all node pairs
 * - Strongly Connected Components (SCCs): Nodes in cycles that are mutually reachable
 */

import { MermaidTraceCalculator } from './MermaidTraceCalculator.js';

// ============================================================================
// Constants and Configuration
// ============================================================================

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_DEPTH = 1000;
const CACHE_MAX_SIZE = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_CACHE_MAX_SIZE = 1000;
const REACHABILITY_QUERY_CACHE_CLEAN_INTERVAL = 100;

// Cache instances
const transitiveClosureCache = new Map();
const reachabilityQueryCache = new Map();
let reachabilityQueryCacheCleanCounter = 0;

// ============================================================================
// TimeoutChecker Class
// ============================================================================

class TimeoutChecker {
    constructor(timeoutMs) {
        this.startTime = Date.now();
        this.timeoutMs = timeoutMs;
    }
    
    check() {
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.timeoutMs) {
            throw new Error(`Reachability analysis exceeded ${this.timeoutMs}ms timeout. The graph is too complex.`);
        }
    }
    
    getElapsed() {
        return Date.now() - this.startTime;
    }
}

// ============================================================================
// Cache Management
// ============================================================================

function hashGraphContent(content) {
    let hash = 0;
    const str = content.substring(0, 1000);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36) + '-' + content.length;
}

function cleanTransitiveClosureCache() {
    const now = Date.now();
    for (const [key, value] of transitiveClosureCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
            transitiveClosureCache.delete(key);
        }
    }
    
    if (transitiveClosureCache.size > CACHE_MAX_SIZE) {
        const entries = Array.from(transitiveClosureCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        entries.slice(0, transitiveClosureCache.size - CACHE_MAX_SIZE)
            .forEach(([key]) => transitiveClosureCache.delete(key));
    }
}

function cleanReachabilityQueryCache() {
    if (reachabilityQueryCache.size > QUERY_CACHE_MAX_SIZE) {
        const entries = Array.from(reachabilityQueryCache.entries());
        entries.slice(0, reachabilityQueryCache.size - QUERY_CACHE_MAX_SIZE)
            .forEach(([key]) => reachabilityQueryCache.delete(key));
    }
}

export function clearReachabilityCaches() {
    transitiveClosureCache.clear();
    reachabilityQueryCache.clear();
}

// ============================================================================
// Utility Functions
// ============================================================================

function getNodeIdFromElement(node) {
    return node?.id || node?.alt_id || null;
}

function createEmptyReachabilityResult(allNodes, includePaths) {
    const unreachableSet = new Set(allNodes.map(n => getNodeIdFromElement(n)).filter(Boolean));
    return {
        reachable: new Set(),
        unreachable: unreachableSet,
        paths: includePaths ? {} : null,
        statistics: {
            reachableCount: 0,
            unreachableCount: unreachableSet.size,
            maxDepth: 0,
            nodesInCycles: [],
            cycleCount: 0,
            averageDepth: 0
        }
    };
}

function createErrorResult(message) {
    return {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
    };
}

function calculateAverageDepth(nodeDepths, reachable) {
    if (reachable.size === 0) {
        return 0;
    }
    
    let totalDepth = 0;
    let count = 0;
    
    for (const nodeId of reachable) {
        const depth = nodeDepths.get(nodeId);
        if (depth !== undefined) {
            totalDepth += depth;
            count++;
        }
    }
    
    return count > 0 ? totalDepth / count : 0;
}

// ============================================================================
// Core BFS Reachability Algorithm (Unified)
// ============================================================================

/**
 * Generic BFS traversal for reachability analysis.
 * Used by both forward and backward reachability computations.
 */
function performBFSReachability(adjacencyList, seedNodes, allNodes, timeoutChecker, maxDepth, includePaths) {
    const reachable = new Set();
    const unreachable = new Set();
    const paths = includePaths ? {} : null;
    const nodeDepths = new Map();
    const nodesInCycles = new Set();
    
    // Initialize all nodes as unreachable
    for (const node of allNodes) {
        const nodeId = getNodeIdFromElement(node);
        if (nodeId) {
            unreachable.add(nodeId);
        }
    }
    
    // Handle empty seed nodes
    if (seedNodes.length === 0) {
        return {
            reachable,
            unreachable,
            paths,
            nodeDepths,
            statistics: {
                reachableCount: 0,
                unreachableCount: unreachable.size,
                maxDepth: 0,
                nodesInCycles: [],
                cycleCount: 0,
                averageDepth: 0
            }
        };
    }
    
    const visited = new Set();
    const queue = [];
    
    // Initialize with seed nodes
    for (const seedNodeId of seedNodes) {
        const nodeExists = adjacencyList.has(seedNodeId) || 
            allNodes.some(n => getNodeIdFromElement(n) === seedNodeId);
        
        if (nodeExists) {
            queue.push({ nodeId: seedNodeId, depth: 0, path: [seedNodeId] });
            visited.add(seedNodeId);
            reachable.add(seedNodeId);
            unreachable.delete(seedNodeId);
            nodeDepths.set(seedNodeId, 0);
            
            if (includePaths) {
                paths[seedNodeId] = [seedNodeId];
            }
        }
    }
    
    // BFS traversal
    let maxDepthReached = 0;
    
    while (queue.length > 0) {
        timeoutChecker.check();
        
        const { nodeId, depth, path } = queue.shift();
        
        if (depth > maxDepthReached) {
            maxDepthReached = depth;
        }
        if (depth >= maxDepth) {
            continue;
        }
        
        const neighbors = adjacencyList.get(nodeId) || [];
        
        for (const neighborId of neighbors) {
            timeoutChecker.check();
            
            // Cycle detection
            if (includePaths && path?.includes(neighborId)) {
                nodesInCycles.add(neighborId);
                nodesInCycles.add(nodeId);
            }
            
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                reachable.add(neighborId);
                unreachable.delete(neighborId);
                nodeDepths.set(neighborId, depth + 1);
                
                const newPath = includePaths ? [...path, neighborId] : null;
                queue.push({ nodeId: neighborId, depth: depth + 1, path: newPath });
                
                if (includePaths) {
                    paths[neighborId] = newPath;
                }
            } else {
                nodesInCycles.add(neighborId);
                nodesInCycles.add(nodeId);
            }
        }
    }
    
    return {
        reachable,
        unreachable,
        paths,
        nodeDepths,
        statistics: {
            reachableCount: reachable.size,
            unreachableCount: unreachable.size,
            maxDepth: maxDepthReached,
            nodesInCycles: Array.from(nodesInCycles),
            cycleCount: nodesInCycles.size,
            averageDepth: calculateAverageDepth(nodeDepths, reachable)
        }
    };
}

function computeForwardReachability(forwardAdj, startNodes, allNodes, timeoutChecker, maxDepth, includePaths) {
    return performBFSReachability(forwardAdj, startNodes, allNodes, timeoutChecker, maxDepth, includePaths);
}

function computeBackwardReachability(backwardAdj, endNodes, allNodes, timeoutChecker, maxDepth, includePaths) {
    return performBFSReachability(backwardAdj, endNodes, allNodes, timeoutChecker, maxDepth, includePaths);
}

// ============================================================================
// Bidirectional Reachability and Classification
// ============================================================================

function computeBidirectionalReachability(forwardReachability, backwardReachability, allNodes) {
    const useful = new Set();
    const deadEnd = new Set();
    const unreachable = new Set();
    
    const forwardReachableSet = forwardReachability.reachable;
    const backwardReachableSet = backwardReachability.reachable;
    
    for (const node of allNodes) {
        const nodeId = getNodeIdFromElement(node);
        if (!nodeId) {
            continue;
        }
        
        const isForwardReachable = forwardReachableSet.has(nodeId);
        const isBackwardReachable = backwardReachableSet.has(nodeId);
        
        if (isForwardReachable && isBackwardReachable) {
            useful.add(nodeId);
        } else if (isForwardReachable) {
            deadEnd.add(nodeId);
        } else {
            unreachable.add(nodeId);
        }
    }
    
    // Cycle information
    const forwardCycleNodes = new Set(forwardReachability.statistics?.nodesInCycles || []);
    const backwardCycleNodes = new Set(backwardReachability.statistics?.nodesInCycles || []);
    const nodesInCycles = new Set([...forwardCycleNodes, ...backwardCycleNodes]);
    
    const totalNodes = allNodes.length;
    
    return {
        useful,
        deadEnd,
        unreachable,
        statistics: {
            totalNodes,
            usefulCount: useful.size,
            deadEndCount: deadEnd.size,
            unreachableCount: unreachable.size,
            usefulCoverage: totalNodes > 0 ? useful.size / totalNodes : 0,
            deadEndCoverage: totalNodes > 0 ? deadEnd.size / totalNodes : 0,
            unreachableCoverage: totalNodes > 0 ? unreachable.size / totalNodes : 0,
            forwardCoverage: totalNodes > 0 ? forwardReachableSet.size / totalNodes : 0,
            backwardCoverage: totalNodes > 0 ? backwardReachableSet.size / totalNodes : 0,
            intersectionCoverage: forwardReachableSet.size > 0 ? useful.size / forwardReachableSet.size : 0,
            nodesInCycles: Array.from(nodesInCycles),
            cycleCount: nodesInCycles.size,
            usefulNodesInCycles: [...nodesInCycles].filter(id => useful.has(id)),
            deadEndNodesInCycles: [...nodesInCycles].filter(id => deadEnd.has(id)),
            unreachableNodesInCycles: [...nodesInCycles].filter(id => unreachable.has(id))
        }
    };
}

function calculateReachabilityMetrics(forwardReachability, backwardReachability, bidirectionalReachability, nodesForMetrics) {
    const totalNodes = nodesForMetrics.length;
    let forwardCount = 0;
    let backwardCount = 0;
    let usefulCount = 0;
    let deadEndCount = 0;
    let unreachableCount = 0;
    
    for (const node of nodesForMetrics) {
        const nodeId = getNodeIdFromElement(node);
        if (!nodeId) {
            continue;
        }
        
        if (forwardReachability.reachable.has(nodeId)) {
            forwardCount++;
        }
        if (backwardReachability.reachable.has(nodeId)) {
            backwardCount++;
        }
        if (bidirectionalReachability.useful.has(nodeId)) {
            usefulCount++;
        }
        if (bidirectionalReachability.deadEnd.has(nodeId)) {
            deadEndCount++;
        }
        if (bidirectionalReachability.unreachable.has(nodeId)) {
            unreachableCount++;
        }
    }
    
    return {
        totalNodes,
        forwardReachableCount: forwardCount,
        backwardReachableCount: backwardCount,
        usefulNodeCount: usefulCount,
        deadEndNodeCount: deadEndCount,
        unreachableNodeCount: unreachableCount,
        forwardCoverage: totalNodes > 0 ? forwardCount / totalNodes : 0,
        backwardCoverage: totalNodes > 0 ? backwardCount / totalNodes : 0,
        usefulCoverage: totalNodes > 0 ? usefulCount / totalNodes : 0,
        deadEndCoverage: totalNodes > 0 ? deadEndCount / totalNodes : 0,
        unreachableCoverage: totalNodes > 0 ? unreachableCount / totalNodes : 0
    };
}

// ============================================================================
// Adjacency List Building
// ============================================================================

function buildAdjacencyList(graphStructure, reverse = false) {
    const adj = new Map();
    const { nodes, edges } = graphStructure;
    
    // Initialize all nodes
    for (const node of nodes) {
        const nodeId = getNodeIdFromElement(node);
        if (nodeId) {
            adj.set(nodeId, []);
        }
    }
    
    // Add edges
    for (const edge of edges) {
        const fromId = reverse ? edge.to : edge.from;
        const toId = reverse ? edge.from : edge.to;
        
        if (adj.has(fromId) && adj.has(toId)) {
            const neighbors = adj.get(fromId);
            if (!neighbors.includes(toId)) {
                neighbors.push(toId);
            }
        }
    }
    
    return adj;
}

function buildForwardAdjacencyList(graphStructure) {
    return buildAdjacencyList(graphStructure, false);
}

function buildBackwardAdjacencyList(graphStructure) {
    return buildAdjacencyList(graphStructure, true);
}

// ============================================================================
// Start/End Node Detection
// ============================================================================

function findNodesWithoutEdges(nodes, edges, direction) {
    const hasEdge = new Set(edges.map(e => direction === 'incoming' ? e.to : e.from));
    return nodes
        .filter(node => {
            const nodeId = getNodeIdFromElement(node);
            return nodeId && !hasEdge.has(nodeId);
        })
        .map(node => getNodeIdFromElement(node))
        .filter(Boolean);
}

function findStartNodes(graphStructure, format) {
    const { nodes, edges } = graphStructure;
    
    if (format === 'mermaid') {
        const startEvents = nodes
            .filter(node => node.type === 'startevent')
            .map(node => getNodeIdFromElement(node))
            .filter(Boolean);
        
        if (startEvents.length > 0) {
            return startEvents;
        }
    }
    
    // For CPEE, exclude control flow elements (escape, terminate, stop) from being start nodes
    // They are exit points, not entry points
    const taskNodes = format === 'cpee' 
        ? nodes.filter(node => node.type === 'task')
        : nodes;
    
    const noIncomingEdges = findNodesWithoutEdges(taskNodes, edges, 'incoming');
    if (noIncomingEdges.length > 0) {
        return noIncomingEdges;
    }
    
    // Fallback: return all task nodes
    return taskNodes.map(n => getNodeIdFromElement(n)).filter(Boolean);
}

function findEndNodes(graphStructure, format) {
    const { nodes, edges } = graphStructure;
    
    if (format === 'mermaid') {
        const endEvents = nodes
            .filter(node => node.type === 'endevent')
            .map(node => getNodeIdFromElement(node))
            .filter(Boolean);
        
        if (endEvents.length > 0) {
            return endEvents;
        }
    }
    
    const noOutgoingEdges = findNodesWithoutEdges(nodes, edges, 'outgoing');
    if (noOutgoingEdges.length > 0) {
        return noOutgoingEdges;
    }
    return nodes.map(n => getNodeIdFromElement(n)).filter(Boolean);
}

// ============================================================================
// CPEE XML Graph Extraction
// ============================================================================

const TASK_ELEMENTS = ['call', 'manipulate', 'script'];
const CONTROL_FLOW_ELEMENTS = ['escape', 'terminate', 'stop'];

function getNodeId(element, position = 'first') {
    if (!element) {
        return null;
    }
    
    const tagName = element.tagName?.toLowerCase();
    
    // Direct task elements
    if (TASK_ELEMENTS.includes(tagName)) {
        return element.getAttribute('id');
    }
    
    // Control flow elements (escape, terminate, stop) - create synthetic ID
    if (CONTROL_FLOW_ELEMENTS.includes(tagName)) {
        const altId = element.getAttribute('a:alt_id');
        if (altId) {
            return `__${tagName}_${altId}`;
        }
        
        // Generate ID based on parent context
        const parent = element.parentElement;
        const parentId = parent?.getAttribute('a:alt_id') || 'unknown';
        const siblings = parent ? Array.from(parent.children) : [];
        const index = siblings.indexOf(element);
        return `__${tagName}_${parentId}_${index}`;
    }
    
    // Nested structures: get first or last task element based on position
    const taskElements = element.querySelectorAll(TASK_ELEMENTS.join(', '));
    if (taskElements.length > 0) {
        const taskElement = position === 'last' 
            ? taskElements[taskElements.length - 1] 
            : taskElements[0];
        return taskElement.getAttribute('id');
    }
    
    // Check for control flow elements as fallback (for 'last' position especially)
    const controlElements = element.querySelectorAll(CONTROL_FLOW_ELEMENTS.join(', '));
    if (controlElements.length > 0) {
        const controlElement = position === 'last'
            ? controlElements[controlElements.length - 1]
            : controlElements[0];
        return getNodeId(controlElement);
    }
    
    // Loop element itself
    if (tagName === 'loop') {
        return element.getAttribute('id');
    }
    
    return null;
}

function getFilteredChildren(element) {
    return Array.from(element.children).filter(c => 
        c.tagName.toLowerCase() !== 'condition'
    );
}

function findEnclosingLoop(element) {
    let parent = element.parentElement;
    while (parent) {
        if (parent.tagName?.toLowerCase() === 'loop') {
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
}

function findLoopSuccessor(loop) {
    const parent = loop.parentElement;
    if (!parent) {
        return null;
    }
    
    const siblings = getFilteredChildren(parent);
    const loopIndex = siblings.indexOf(loop);
    
    if (loopIndex < siblings.length - 1) {
        return siblings[loopIndex + 1];
    }
    
    // Recursively find successor in parent's context
    return findLoopSuccessor(parent);
}

function extractSequentialEdges(children, edges, edgeType) {
    for (let i = 0; i < children.length - 1; i++) {
        const fromId = getNodeId(children[i], 'last');
        const toId = getNodeId(children[i + 1], 'first');
        if (fromId && toId) {
            edges.push({ from: fromId, to: toId, type: edgeType });
        }
    }
}

function getParentContext(element) {
    const parent = element.parentElement;
    const parentChildren = parent ? getFilteredChildren(parent) : [];
    const elementIndex = parentChildren.indexOf(element);
    return { parent, parentChildren, elementIndex };
}

function extractEdgesFromDescription(desc, edges, _nodeMap, escapeEdges) {
    const children = getFilteredChildren(desc);
    
    for (let i = 0; i < children.length - 1; i++) {
        const fromElement = children[i];
        const toElement = children[i + 1];
        const fromId = getNodeId(fromElement, 'last');
        const toId = getNodeId(toElement, 'first');
        
        if (fromId && toId) {
            edges.push({ from: fromId, to: toId, type: 'sequential' });
        }
    }
    
    // Handle escape elements in descriptions
    extractEscapeEdges(desc, edges, escapeEdges);
}

function extractEscapeEdges(container, edges, escapeEdges) {
    const escapeElements = container.querySelectorAll('escape');
    
    for (const escapeEl of escapeElements) {
        const escapeId = getNodeId(escapeEl);
        if (!escapeId) {
            continue;
        }
        
        // Find the enclosing loop
        const enclosingLoop = findEnclosingLoop(escapeEl);
        
        if (enclosingLoop) {
            // Find what comes after the loop
            const loopSuccessor = findLoopSuccessor(enclosingLoop);
            
            if (loopSuccessor) {
                const successorId = getNodeId(loopSuccessor);
                if (successorId) {
                    edges.push({ from: escapeId, to: successorId, type: 'escape-exit' });
                    escapeEdges.push({ from: escapeId, to: successorId, type: 'escape-exit' });
                }
            } else {
                // Escape leads to workflow end - mark it as an end node
                escapeEdges.push({ from: escapeId, to: '__workflow_end__', type: 'escape-end' });
            }
        }
    }
}

function extractEdgesFromChoose(choose, edges, _nodeMap, escapeEdges) {
    const alternatives = Array.from(choose.querySelectorAll(':scope > alternative'));
    const { parent, parentChildren, elementIndex } = getParentContext(choose);
    
    const predecessor = elementIndex > 0 ? parentChildren[elementIndex - 1] : null;
    const successor = elementIndex < parentChildren.length - 1 ? parentChildren[elementIndex + 1] : null;
    const predecessorId = predecessor ? getNodeId(predecessor, 'last') : null;
    const successorId = successor ? getNodeId(successor, 'first') : null;
    
    // Special case: if choose is first child of a loop, use loop-back edges instead
    // The loop's back edge will connect to alternatives, but we need entry edges
    const isFirstInLoop = !predecessor && parent?.tagName?.toLowerCase() === 'loop';
    
    for (const alt of alternatives) {
        const altChildren = getFilteredChildren(alt);
        
        // Edge from predecessor to first element
        if (altChildren.length > 0 && predecessorId) {
            const firstAltId = getNodeId(altChildren[0], 'first');
            if (firstAltId) {
                edges.push({ from: predecessorId, to: firstAltId, type: 'xor-branch' });
            }
        }
        
        // Sequential edges within alternative
        extractSequentialEdges(altChildren, edges, 'xor-sequential');
        
        // Edge from last element to successor
        if (altChildren.length > 0 && successorId) {
            const lastAltId = getNodeId(altChildren[altChildren.length - 1], 'last');
            if (lastAltId) {
                edges.push({ from: lastAltId, to: successorId, type: 'xor-join' });
            }
        }
        
        // Handle empty alternatives (direct predecessor to successor)
        if (altChildren.length === 0 && predecessorId && successorId) {
            edges.push({ from: predecessorId, to: successorId, type: 'xor-skip' });
        }
        
        // Handle escape elements within alternatives
        extractEscapeEdges(alt, edges, escapeEdges);
    }
    
    // For choose as first element in a loop, create back edges from all 
    // last elements in alternatives back to all first elements
    if (isFirstInLoop && alternatives.length > 0) {
        const firstElements = [];
        const lastElements = [];
        
        for (const alt of alternatives) {
            const altChildren = getFilteredChildren(alt);
            if (altChildren.length > 0) {
                const firstId = getNodeId(altChildren[0], 'first');
                const lastId = getNodeId(altChildren[altChildren.length - 1], 'last');
                if (firstId) {
                    firstElements.push(firstId);
                }
                if (lastId) {
                    lastElements.push(lastId);
                }
            }
        }
        
        // Create back edges from each last element to each first element (loop iteration)
        for (const lastId of lastElements) {
            for (const firstId of firstElements) {
                if (lastId !== firstId) {
                    edges.push({ from: lastId, to: firstId, type: 'loop-back' });
                }
            }
        }
    }
}

function extractEdgesFromParallel(parallel, edges, _nodeMap) {
    const branches = Array.from(parallel.querySelectorAll(':scope > parallel_branch'));
    const { parentChildren, elementIndex } = getParentContext(parallel);
    
    const predecessor = elementIndex > 0 ? parentChildren[elementIndex - 1] : null;
    const successor = elementIndex < parentChildren.length - 1 ? parentChildren[elementIndex + 1] : null;
    const predecessorId = predecessor ? getNodeId(predecessor, 'last') : null;
    const successorId = successor ? getNodeId(successor, 'first') : null;
    
    for (const branch of branches) {
        const branchChildren = getFilteredChildren(branch);
        
        // Edge from predecessor to first element
        if (branchChildren.length > 0 && predecessorId) {
            const firstBranchId = getNodeId(branchChildren[0], 'first');
            if (firstBranchId) {
                edges.push({ from: predecessorId, to: firstBranchId, type: 'and-branch' });
            }
        }
        
        // Sequential edges within branch
        extractSequentialEdges(branchChildren, edges, 'and-sequential');
        
        // Edge from last element to successor
        if (branchChildren.length > 0 && successorId) {
            const lastBranchId = getNodeId(branchChildren[branchChildren.length - 1], 'last');
            if (lastBranchId) {
                edges.push({ from: lastBranchId, to: successorId, type: 'and-join' });
            }
        }
    }
}

function extractEdgesFromLoop(loop, edges, backEdges, _nodeMap, escapeEdges) {
    const children = getFilteredChildren(loop);
    const { parentChildren, elementIndex } = getParentContext(loop);
    
    // Sequential edges within loop body
    extractSequentialEdges(children, edges, 'loop-sequential');
    
    // Back edge: last element connects back to first element
    // Use 'last' position to get the actual last task in nested structures
    if (children.length > 0) {
        const firstChildId = getNodeId(children[0], 'first');
        const lastChildId = getNodeId(children[children.length - 1], 'last');
        
        // Only create back edge if first and last are different (avoid self-loops)
        if (firstChildId && lastChildId && firstChildId !== lastChildId) {
            const backEdge = { from: lastChildId, to: firstChildId, type: 'loop-back' };
            edges.push(backEdge);
            backEdges.push(backEdge);
        }
    }
    
    // Connect loop to parent structure
    if (elementIndex > 0 && children.length > 0) {
        const predecessor = parentChildren[elementIndex - 1];
        const predecessorId = getNodeId(predecessor, 'last');
        const firstLoopId = getNodeId(children[0], 'first');
        
        if (predecessorId && firstLoopId) {
            edges.push({ from: predecessorId, to: firstLoopId, type: 'loop-entry' });
        }
    }
    
    if (elementIndex < parentChildren.length - 1 && children.length > 0) {
        const successor = parentChildren[elementIndex + 1];
        const lastLoopId = getNodeId(children[children.length - 1], 'last');
        const successorId = getNodeId(successor, 'first');
        
        if (lastLoopId && successorId) {
            edges.push({ from: lastLoopId, to: successorId, type: 'loop-exit' });
        }
    }
    
    // Handle escape elements within loop
    extractEscapeEdges(loop, edges, escapeEdges);
}

function removeDuplicateEdges(edges) {
    const seen = new Set();
    return edges.filter(edge => {
        const key = `${edge.from}->${edge.to}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function extractCPEEGraphStructure(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        throw new Error('XML parsing error: ' + parserError.textContent);
    }
    
    const nodes = [];
    const edges = [];
    const backEdges = [];
    const escapeEdges = [];
    const nodeMap = new Map();
    
    // Extract all task nodes
    const taskElements = xmlDoc.querySelectorAll(TASK_ELEMENTS.join(', '));
    for (const element of taskElements) {
        const id = element.getAttribute('id');
        if (id) {
            nodes.push({ id, alt_id: null, type: 'task' });
            nodeMap.set(id, element);
        }
    }
    
    // Extract escape/terminate/stop elements as special nodes
    const controlElements = xmlDoc.querySelectorAll(CONTROL_FLOW_ELEMENTS.join(', '));
    for (const element of controlElements) {
        const id = getNodeId(element);
        if (id) {
            const tagName = element.tagName.toLowerCase();
            nodes.push({ id, alt_id: null, type: tagName });
            nodeMap.set(id, element);
        }
    }
    
    // Extract edges from description elements
    const descriptionElements = xmlDoc.querySelectorAll('description');
    for (const desc of descriptionElements) {
        extractEdgesFromDescription(desc, edges, nodeMap, escapeEdges);
    }
    
    // Extract edges from choose/alternative structures
    const chooseElements = xmlDoc.querySelectorAll('choose');
    for (const choose of chooseElements) {
        extractEdgesFromChoose(choose, edges, nodeMap, escapeEdges);
    }
    
    // Extract edges from parallel structures
    const parallelElements = xmlDoc.querySelectorAll('parallel');
    for (const parallel of parallelElements) {
        extractEdgesFromParallel(parallel, edges, nodeMap);
    }
    
    // Extract edges from loop structures
    const loopElements = xmlDoc.querySelectorAll('loop');
    for (const loop of loopElements) {
        extractEdgesFromLoop(loop, edges, backEdges, nodeMap, escapeEdges);
    }
    
    const uniqueEdges = removeDuplicateEdges(edges);
    
    return {
        nodes,
        edges: uniqueEdges,
        backEdges,
        escapeEdges,
        metadata: {
            hasLoops: backEdges.length > 0,
            hasParallel: parallelElements.length > 0,
            hasXOR: chooseElements.length > 0,
            hasEscapes: escapeEdges.length > 0
        }
    };
}

// ============================================================================
// Mermaid Graph Extraction
// ============================================================================

function determineMermaidEdgeType(edge, nodes) {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (fromNode?.type === 'exclusivegateway') {
        return 'xor-branch';
    }
    if (fromNode?.type === 'parallelgateway') {
        return 'and-branch';
    }
    if (toNode?.type === 'exclusivegateway') {
        return 'xor-join';
    }
    if (toNode?.type === 'parallelgateway') {
        return 'and-join';
    }
    if (fromNode?.type === 'startevent') {
        return 'start';
    }
    if (toNode?.type === 'endevent') {
        return 'end';
    }
    
    return 'sequential';
}

function hasPath(graph, source, target, visited = new Set(), maxDepth = 50) {
    if (source === target && visited.size > 0) {
        return true;
    }
    if (maxDepth <= 0 || visited.has(source)) {
        return false;
    }
    
    const queue = [{ nodeId: source, depth: 0 }];
    const currentVisited = new Set(visited);
    currentVisited.add(source);
    
    while (queue.length > 0) {
        const { nodeId, depth } = queue.shift();
        
        if (nodeId === target && depth > 0) {
            return true;
        }
        if (depth >= maxDepth) {
            continue;
        }
        
        const neighbors = graph.adjacencyList.get(nodeId) || [];
        for (const edge of neighbors) {
            const neighborId = edge.to;
            
            if (neighborId === target && depth >= 0) {
                return true;
            }
            
            if (!currentVisited.has(neighborId) && depth + 1 < maxDepth) {
                currentVisited.add(neighborId);
                queue.push({ nodeId: neighborId, depth: depth + 1 });
            }
        }
    }
    
    return false;
}

function identifyMermaidBackEdges(graph, edges) {
    return edges
        .filter(edge => hasPath(graph, edge.to, edge.from))
        .map(edge => ({ ...edge, type: 'loop-back' }));
}

function extractMermaidGraphStructure(mermaidContent) {
    const graph = MermaidTraceCalculator.parseMermaid(mermaidContent);
    
    // Deduplicate nodes
    const nodeMap = new Map();
    for (const node of graph.nodes) {
        if (!nodeMap.has(node.id)) {
            nodeMap.set(node.id, {
                id: node.id,
                alt_id: node.id,
                type: node.type || 'task'
            });
        }
    }
    const nodes = Array.from(nodeMap.values());
    
    // Map and filter edges
    const validNodeIds = new Set(nodes.map(n => n.id));
    const edges = graph.edges
        .filter(edge => validNodeIds.has(edge.from) && validNodeIds.has(edge.to))
        .map(edge => ({
            from: edge.from,
            to: edge.to,
            type: determineMermaidEdgeType(edge, nodes)
        }));
    
    const uniqueEdges = removeDuplicateEdges(edges);
    const backEdges = identifyMermaidBackEdges(graph, uniqueEdges);
    
    return {
        nodes,
        edges: uniqueEdges,
        backEdges,
        metadata: {
            hasLoops: backEdges.length > 0,
            hasParallel: nodes.some(n => n.type === 'parallelgateway'),
            hasXOR: nodes.some(n => n.type === 'exclusivegateway')
        }
    };
}

// ============================================================================
// Strongly Connected Components (Kosaraju's Algorithm)
// ============================================================================

function findStronglyConnectedComponents(graphStructure, timeoutChecker) {
    const { nodes, edges } = graphStructure;
    
    if (nodes.length === 0) {
        return createEmptySCCResult();
    }
    
    // Build adjacency lists
    const forwardAdj = new Map();
    const reverseAdj = new Map();
    
    for (const node of nodes) {
        const nodeId = getNodeIdFromElement(node);
        if (nodeId) {
            forwardAdj.set(nodeId, []);
            reverseAdj.set(nodeId, []);
        }
    }
    
    for (const edge of edges) {
        if (forwardAdj.has(edge.from) && forwardAdj.has(edge.to)) {
            forwardAdj.get(edge.from).push(edge.to);
            reverseAdj.get(edge.to).push(edge.from);
        }
    }
    
    // First DFS: get finishing order
    const finishOrder = [];
    const visited = new Set();
    
    for (const node of nodes) {
        const nodeId = getNodeIdFromElement(node);
        if (!nodeId || visited.has(nodeId)) {
            continue;
        }
        
        iterativeDFSFirstPass(nodeId, forwardAdj, visited, finishOrder, timeoutChecker);
    }
    
    // Second DFS: find components in reverse finish order
    visited.clear();
    const components = [];
    const nodeToComponent = new Map();
    
    for (let i = finishOrder.length - 1; i >= 0; i--) {
        timeoutChecker.check();
        const nodeId = finishOrder[i];
        if (visited.has(nodeId)) {
            continue;
        }
        
        const component = [];
        iterativeDFSSecondPass(nodeId, reverseAdj, visited, component, components.length, nodeToComponent, timeoutChecker);
        
        if (component.length > 0) {
            components.push(component);
        }
    }
    
    return classifySCCComponents(components, nodeToComponent, nodes);
}

function createEmptySCCResult() {
    return {
        components: [],
        nodeToComponent: new Map(),
        nodesInCycles: [],
        acyclicNodes: [],
        cyclicComponents: [],
        acyclicComponents: [],
        statistics: {
            totalComponents: 0,
            cyclicComponentCount: 0,
            acyclicComponentCount: 0,
            nodesInCyclesCount: 0,
            acyclicNodesCount: 0,
            largestComponentSize: 0,
            averageComponentSize: 0
        }
    };
}

function iterativeDFSFirstPass(startNodeId, forwardAdj, visited, finishOrder, timeoutChecker) {
    const stack = [{ nodeId: startNodeId, neighborIndex: 0, neighbors: forwardAdj.get(startNodeId) || [] }];
    visited.add(startNodeId);
    
    while (stack.length > 0) {
        timeoutChecker.check();
        
        const frame = stack[stack.length - 1];
        
        if (frame.neighborIndex >= frame.neighbors.length) {
            finishOrder.push(frame.nodeId);
            stack.pop();
            continue;
        }
        
        const neighborId = frame.neighbors[frame.neighborIndex++];
        
        if (!visited.has(neighborId)) {
            visited.add(neighborId);
            stack.push({
                nodeId: neighborId,
                neighborIndex: 0,
                neighbors: forwardAdj.get(neighborId) || []
            });
        }
    }
}

function iterativeDFSSecondPass(startNodeId, reverseAdj, visited, component, componentIndex, nodeToComponent, timeoutChecker) {
    const stack = [{ nodeId: startNodeId, neighborIndex: 0, neighbors: reverseAdj.get(startNodeId) || [] }];
    visited.add(startNodeId);
    component.push(startNodeId);
    nodeToComponent.set(startNodeId, componentIndex);
    
    while (stack.length > 0) {
        timeoutChecker.check();
        
        const frame = stack[stack.length - 1];
        
        if (frame.neighborIndex >= frame.neighbors.length) {
            stack.pop();
            continue;
        }
        
        const neighborId = frame.neighbors[frame.neighborIndex++];
        
        if (!visited.has(neighborId)) {
            visited.add(neighborId);
            component.push(neighborId);
            nodeToComponent.set(neighborId, componentIndex);
            stack.push({
                nodeId: neighborId,
                neighborIndex: 0,
                neighbors: reverseAdj.get(neighborId) || []
            });
        }
    }
}

function classifySCCComponents(components, nodeToComponent, nodes) {
    const cyclicComponents = [];
    const acyclicComponents = [];
    const nodesInCycles = [];
    const acyclicNodes = [];
    
    components.forEach((component, index) => {
        const componentInfo = {
            index,
            nodes: component,
            size: component.length,
            type: component.length > 1 ? 'cyclic' : 'acyclic'
        };
        
        if (component.length > 1) {
            cyclicComponents.push(componentInfo);
            nodesInCycles.push(...component);
        } else {
            acyclicComponents.push(componentInfo);
            acyclicNodes.push(...component);
        }
    });
    
    const nodeClassification = new Map();
    for (const node of nodes) {
        const nodeId = getNodeIdFromElement(node);
        if (!nodeId) {
            continue;
        }
        
        const componentIndex = nodeToComponent.get(nodeId);
        const component = components[componentIndex];
        const isInCycle = component && component.length > 1;
        
        nodeClassification.set(nodeId, {
            componentIndex,
            componentSize: component?.length || 0,
            isInCycle,
            isAcyclic: !isInCycle
        });
    }
    
    const totalComponents = components.length;
    const largestComponentSize = components.length > 0 ? Math.max(...components.map(c => c.length)) : 0;
    const totalNodesInComponents = components.reduce((sum, c) => sum + c.length, 0);
    
    return {
        components,
        nodeToComponent,
        nodeClassification,
        nodesInCycles,
        acyclicNodes,
        cyclicComponents,
        acyclicComponents,
        statistics: {
            totalComponents,
            cyclicComponentCount: cyclicComponents.length,
            acyclicComponentCount: acyclicComponents.length,
            nodesInCyclesCount: nodesInCycles.length,
            acyclicNodesCount: acyclicNodes.length,
            largestComponentSize,
            averageComponentSize: totalComponents > 0 ? totalNodesInComponents / totalComponents : 0,
            cycleCoverage: nodes.length > 0 ? (nodesInCycles.length / nodes.length) * 100 : 0,
            acyclicCoverage: nodes.length > 0 ? (acyclicNodes.length / nodes.length) * 100 : 0
        }
    };
}

// ============================================================================
// Transitive Closure
// ============================================================================

function computeTransitiveClosureMatrix(forwardAdj, allNodes, timeoutChecker, maxDepth) {
    const nodeIds = allNodes.map(node => getNodeIdFromElement(node)).filter(Boolean);
    
    if (nodeIds.length === 0) {
        return {
            matrix: {},
            sparseMatrix: new Map(),
            nodeIndex: new Map(),
            statistics: { totalNodes: 0, reachablePairs: 0, density: 0 }
        };
    }
    
    const nodeIndex = new Map(nodeIds.map((id, i) => [id, i]));
    const sparseMatrix = new Map();
    let totalReachablePairs = 0;
    
    for (const sourceNodeId of nodeIds) {
        timeoutChecker.check();
        
        const reachable = new Set();
        const visited = new Set();
        const stack = [{ nodeId: sourceNodeId, depth: 0 }];
        
        while (stack.length > 0) {
            timeoutChecker.check();
            
            const { nodeId, depth } = stack.pop();
            
            if (depth >= maxDepth || visited.has(nodeId)) {
                continue;
            }
            
            visited.add(nodeId);
            reachable.add(nodeId);
            
            const neighbors = forwardAdj.get(nodeId) || [];
            for (let i = neighbors.length - 1; i >= 0; i--) {
                const neighborId = neighbors[i];
                if (!visited.has(neighborId) && depth + 1 < maxDepth) {
                    stack.push({ nodeId: neighborId, depth: depth + 1 });
                }
            }
        }
        
        sparseMatrix.set(sourceNodeId, reachable);
        totalReachablePairs += reachable.size;
    }
    
    const totalPossiblePairs = nodeIds.length * nodeIds.length;
    const density = totalPossiblePairs > 0 ? (totalReachablePairs / totalPossiblePairs) * 100 : 0;
    
    // Build full matrix only for small graphs
    let matrix = null;
    if (nodeIds.length <= 100) {
        matrix = {};
        for (const sourceId of nodeIds) {
            matrix[sourceId] = {};
            const reachable = sparseMatrix.get(sourceId) || new Set();
            for (const targetId of nodeIds) {
                matrix[sourceId][targetId] = reachable.has(targetId);
            }
        }
    }
    
    return {
        matrix,
        sparseMatrix,
        nodeIndex,
        statistics: {
            totalNodes: nodeIds.length,
            reachablePairs: totalReachablePairs,
            density,
            representation: nodeIds.length > 100 ? 'sparse' : 'full',
            averageReachablePerNode: nodeIds.length > 0 ? totalReachablePairs / nodeIds.length : 0
        }
    };
}

// ============================================================================
// Public API Functions
// ============================================================================

export function isReachable(transitiveClosure, fromNodeId, toNodeId) {
    if (!transitiveClosure?.sparseMatrix) {
        return false;
    }
    
    const queryKey = `${fromNodeId}->${toNodeId}`;
    if (reachabilityQueryCache.has(queryKey)) {
        return reachabilityQueryCache.get(queryKey);
    }
    
    reachabilityQueryCacheCleanCounter++;
    if (reachabilityQueryCacheCleanCounter >= REACHABILITY_QUERY_CACHE_CLEAN_INTERVAL) {
        cleanReachabilityQueryCache();
        reachabilityQueryCacheCleanCounter = 0;
    }
    
    const reachable = transitiveClosure.sparseMatrix.get(fromNodeId);
    const result = reachable ? reachable.has(toNodeId) : false;
    
    reachabilityQueryCache.set(queryKey, result);
    return result;
}

export function getReachableNodes(transitiveClosure, fromNodeId) {
    if (!transitiveClosure?.sparseMatrix) {
        return [];
    }
    
    const reachable = transitiveClosure.sparseMatrix.get(fromNodeId);
    return reachable ? Array.from(reachable) : [];
}

// ============================================================================
// Result Building Helpers
// ============================================================================

function buildWarnings(forwardReachability, allNodes, detectedStartNodes, detectedEndNodes, sccInfo) {
    const warnings = [];
    
    const allReachableFromStart = forwardReachability.reachable.size;
    if (allReachableFromStart < allNodes.length && detectedStartNodes.length > 0) {
        const disconnectedCount = allNodes.length - allReachableFromStart;
        warnings.push(`Found ${disconnectedCount} node(s) that are not reachable from start node(s). The graph may have disconnected components.`);
    }
    
    if (detectedStartNodes.length === 0 && detectedEndNodes.length === 0) {
        warnings.push('Graph has no identifiable start or end nodes. All nodes may be part of cycles.');
    }
    
    if (sccInfo?.cyclicComponents.length > 0 && 
        sccInfo.cyclicComponents.length === sccInfo.components.length &&
        detectedStartNodes.length === 0) {
        warnings.push('Graph appears to consist entirely of cycles with no entry points.');
    }
    
    return warnings;
}

function filterNodesByFormat(nodeIds, format, taskNodeIds) {
    if (format === 'cpee') {
        return Array.from(nodeIds);
    }
    return Array.from(nodeIds).filter(nodeId => taskNodeIds.has(nodeId));
}

function buildResultObject(params) {
    const {
        format, timeoutChecker, warnings, detectedStartNodes, detectedEndNodes,
        nodesForMetrics, forwardReachability, backwardReachability,
        bidirectionalReachability, metrics, sccInfo, includePaths, transitiveClosure,
        taskNodeIds
    } = params;
    
    const filterToTasks = (nodeIds) => filterNodesByFormat(nodeIds, format, taskNodeIds);
    
    return {
        success: true,
        format,
        timestamp: new Date().toISOString(),
        analysisTime: timeoutChecker.getElapsed(),
        warnings: warnings.length > 0 ? warnings : undefined,
        
        startNodes: detectedStartNodes,
        endNodes: detectedEndNodes,
        totalNodes: nodesForMetrics.length,
        
        forwardReachability: {
            reachableNodes: Array.from(forwardReachability.reachable),
            unreachableNodes: filterToTasks(forwardReachability.unreachable),
            count: metrics.forwardReachableCount,
            coverage: metrics.forwardCoverage,
            statistics: forwardReachability.statistics || {
                reachableCount: metrics.forwardReachableCount,
                unreachableCount: nodesForMetrics.length - metrics.forwardReachableCount,
                maxDepth: 0,
                nodesInCycles: [],
                cycleCount: 0,
                averageDepth: 0
            }
        },
        
        backwardReachability: {
            reachableNodes: Array.from(backwardReachability.reachable),
            unreachableNodes: filterToTasks(backwardReachability.unreachable),
            count: metrics.backwardReachableCount,
            coverage: metrics.backwardCoverage,
            statistics: backwardReachability.statistics || {
                reachableCount: metrics.backwardReachableCount,
                unreachableCount: nodesForMetrics.length - metrics.backwardReachableCount,
                maxDepth: 0,
                nodesInCycles: [],
                cycleCount: 0,
                averageDepth: 0
            }
        },
        
        nodeClassification: {
            usefulNodes: filterToTasks(bidirectionalReachability.useful),
            deadEndNodes: filterToTasks(bidirectionalReachability.deadEnd),
            unreachableNodes: filterToTasks(bidirectionalReachability.unreachable),
            usefulCount: metrics.usefulNodeCount,
            deadEndCount: metrics.deadEndNodeCount,
            unreachableCount: metrics.unreachableNodeCount,
            statistics: bidirectionalReachability.statistics || {
                totalNodes: nodesForMetrics.length,
                usefulCount: metrics.usefulNodeCount,
                deadEndCount: metrics.deadEndNodeCount,
                unreachableCount: metrics.unreachableNodeCount,
                usefulCoverage: metrics.usefulCoverage,
                deadEndCoverage: metrics.deadEndCoverage,
                unreachableCoverage: metrics.unreachableCoverage,
                forwardCoverage: metrics.forwardCoverage,
                backwardCoverage: metrics.backwardCoverage,
                intersectionCoverage: metrics.forwardReachableCount > 0 
                    ? metrics.usefulNodeCount / metrics.forwardReachableCount 
                    : 0
            }
        },
        
        metrics,
        
        stronglyConnectedComponents: sccInfo ? {
            components: sccInfo.components,
            count: sccInfo.components.length,
            nodesInCycles: sccInfo.nodesInCycles,
            acyclicNodes: sccInfo.acyclicNodes || [],
            cyclicComponents: sccInfo.cyclicComponents || [],
            acyclicComponents: sccInfo.acyclicComponents || [],
            nodeClassification: sccInfo.nodeClassification ? Object.fromEntries(sccInfo.nodeClassification) : {},
            statistics: sccInfo.statistics || {
                totalComponents: sccInfo.components.length,
                cyclicComponentCount: 0,
                acyclicComponentCount: 0,
                nodesInCyclesCount: sccInfo.nodesInCycles.length,
                acyclicNodesCount: 0
            }
        } : null,
        
        paths: includePaths ? {
            forwardPaths: forwardReachability.paths || {},
            backwardPaths: backwardReachability.paths || {}
        } : null,
        
        transitiveClosure
    };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze reachability of nodes in a workflow graph.
 * Main entry point for reachability analysis.
 * 
 * @param {string} graphContent - Graph content (XML for CPEE, Mermaid syntax for Mermaid)
 * @param {string} format - Graph format ('cpee' or 'mermaid')
 * @param {Object} options - Analysis options
 * @returns {Object} Comprehensive reachability analysis result
 */
export function analyzeReachability(graphContent, format, options = {}) {
    const {
        startNodeIds = [],
        endNodeIds = [],
        includePaths = false,
        computeTransitiveClosure = false,
        timeout = DEFAULT_TIMEOUT_MS,
        maxDepth = DEFAULT_MAX_DEPTH
    } = options;

    const timeoutChecker = new TimeoutChecker(timeout);

    // Validate inputs
    if (!graphContent || typeof graphContent !== 'string') {
        return createErrorResult('Invalid graph content');
    }

    if (format !== 'cpee' && format !== 'mermaid') {
        return createErrorResult(`Unknown format: ${format}. Must be 'cpee' or 'mermaid'`);
    }

    try {
        // Extract graph structure
        const graphStructure = format === 'cpee' 
            ? extractCPEEGraphStructure(graphContent)
            : extractMermaidGraphStructure(graphContent);
        
        const allNodes = graphStructure.nodes;

        if (allNodes.length === 0) {
            return createErrorResult('No nodes found in graph. The graph appears to be empty.');
        }

        timeoutChecker.check();

        // Identify start and end nodes
        const detectedStartNodes = startNodeIds.length > 0 ? startNodeIds : findStartNodes(graphStructure, format);
        const detectedEndNodes = endNodeIds.length > 0 ? endNodeIds : findEndNodes(graphStructure, format);

        // Build adjacency lists
        const forwardAdj = buildForwardAdjacencyList(graphStructure);
        const backwardAdj = buildBackwardAdjacencyList(graphStructure);

        timeoutChecker.check();

        // Perform reachability analyses with error handling
        const forwardReachability = safeExecute(
            () => computeForwardReachability(forwardAdj, detectedStartNodes, allNodes, timeoutChecker, maxDepth, includePaths),
            () => createEmptyReachabilityResult(allNodes, includePaths),
            '[ReachabilityAnalyzer] Forward reachability analysis failed'
        );

        timeoutChecker.check();

        const backwardReachability = safeExecute(
            () => computeBackwardReachability(backwardAdj, detectedEndNodes, allNodes, timeoutChecker, maxDepth, includePaths),
            () => createEmptyReachabilityResult(allNodes, includePaths),
            '[ReachabilityAnalyzer] Backward reachability analysis failed'
        );

        timeoutChecker.check();

        const bidirectionalReachability = safeExecute(
            () => computeBidirectionalReachability(forwardReachability, backwardReachability, allNodes),
            () => ({
                useful: new Set(),
                deadEnd: new Set(),
                unreachable: new Set(allNodes.map(n => getNodeIdFromElement(n)).filter(Boolean)),
                statistics: { totalNodes: allNodes.length, usefulCount: 0, deadEndCount: 0, unreachableCount: allNodes.length }
            }),
            '[ReachabilityAnalyzer] Bidirectional reachability analysis failed'
        );

        timeoutChecker.check();

        // Optional: SCC detection
        const sccInfo = safeExecute(
            () => findStronglyConnectedComponents(graphStructure, timeoutChecker),
            () => null,
            '[ReachabilityAnalyzer] SCC detection failed'
        );

        timeoutChecker.check();

        // Optional: Transitive closure
        let transitiveClosure = null;
        if (computeTransitiveClosure) {
            transitiveClosure = computeTransitiveClosureWithCache(
                graphContent, format, forwardAdj, allNodes, timeoutChecker, maxDepth
            );
        }

        // Determine nodes for metrics based on format
        const nodesForMetrics = format === 'cpee' 
            ? allNodes 
            : allNodes.filter(node => (node.type || 'task') === 'task');

        const taskNodeIds = new Set(nodesForMetrics.map(n => getNodeIdFromElement(n)).filter(Boolean));

        // Calculate metrics and build warnings
        const metrics = calculateReachabilityMetrics(forwardReachability, backwardReachability, bidirectionalReachability, nodesForMetrics);
        const warnings = buildWarnings(forwardReachability, allNodes, detectedStartNodes, detectedEndNodes, sccInfo);

        return buildResultObject({
            format, timeoutChecker, warnings, detectedStartNodes, detectedEndNodes,
            nodesForMetrics, forwardReachability, backwardReachability,
            bidirectionalReachability, metrics, sccInfo, includePaths, transitiveClosure,
            taskNodeIds
        });

    } catch (error) {
        console.error('[ReachabilityAnalyzer] Error during analysis:', error);
        return createErrorResult(getDetailedErrorMessage(error, format, timeout));
    }
}

function safeExecute(operation, fallback, errorPrefix) {
    try {
        return operation();
    } catch (error) {
        console.warn(`${errorPrefix}:`, error);
        return fallback();
    }
}

function computeTransitiveClosureWithCache(graphContent, format, forwardAdj, allNodes, timeoutChecker, maxDepth) {
    try {
        cleanTransitiveClosureCache();
        
        const cacheKey = `${format}:${hashGraphContent(graphContent)}:${allNodes.length}`;
        const cached = transitiveClosureCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
            return cached.transitiveClosure;
        }
        
        const transitiveClosure = computeTransitiveClosureMatrix(forwardAdj, allNodes, timeoutChecker, maxDepth);
        
        transitiveClosureCache.set(cacheKey, {
            transitiveClosure,
            timestamp: Date.now(),
            nodeCount: allNodes.length
        });
        
        return transitiveClosure;
    } catch (error) {
        console.warn('[ReachabilityAnalyzer] Transitive closure computation failed:', error);
        return null;
    }
}

function getDetailedErrorMessage(error, format, timeout) {
    const message = error.message || '';
    
    if (message.includes('timeout')) {
        return `Reachability analysis timed out after ${timeout}ms. The graph may be too complex. Try increasing the timeout or reducing maxDepth.`;
    }
    
    if (message.includes('parse') || message.includes('XML')) {
        return `Failed to parse graph content: ${message}. Please check that the graph content is valid ${format === 'cpee' ? 'XML' : 'Mermaid syntax'}.`;
    }
    
    if (message.includes('structure')) {
        return `Failed to extract graph structure: ${message}. The graph may be malformed.`;
    }
    
    return `Reachability analysis failed: ${message}`;
}
