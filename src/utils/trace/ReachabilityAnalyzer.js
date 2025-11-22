/**
 * Reachability Analyzer
 * Implements graph reachability analysis based on "Program Analysis Via Graph Reachability" by Thomas Reps
 * 
 * Reference: Reps, T. (1998). Program Analysis Via Graph Reachability.
 * Information and Software Technology, 40(11-12), 701-726.
 * 
 * This implementation provides reachability analysis for workflow graphs in both
 * Mermaid and CPEE formats, identifying which nodes are reachable from start nodes,
 * which nodes can reach end nodes, and classifying nodes as useful, dead-end, or unreachable.
 * 
 * Key Concepts from Reps (1998):
 * - Forward Reachability: Nodes reachable from start nodes via forward edges
 * - Backward Reachability: Nodes that can reach end nodes via backward traversal
 * - Transitive Closure: Complete reachability relation between all node pairs
 * - Strongly Connected Components (SCCs): Nodes in cycles that are mutually reachable
 * 
 * The analysis helps identify:
 * - Unreachable nodes (dead code)
 * - Dead-end nodes (reachable from start but cannot reach end)
 * - Useful nodes (reachable from start AND can reach end)
 */

import { MermaidTraceCalculator } from './MermaidTraceCalculator.js';

// Global constants
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_DEPTH = 1000;

// Performance optimization: Cache for transitive closure computations
// Key: graphContent hash, Value: { transitiveClosure, timestamp, nodeCount }
const transitiveClosureCache = new Map();
const CACHE_MAX_SIZE = 50; // Maximum number of cached results
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

// Performance optimization: Memoization for reachability queries
// Key: `${fromNodeId}->${toNodeId}`, Value: boolean (is reachable)
const reachabilityQueryCache = new Map();
const QUERY_CACHE_MAX_SIZE = 1000; // Maximum number of cached queries

// Periodic cache cleaning state
let reachabilityQueryCacheCleanCounter = 0;
const REACHABILITY_QUERY_CACHE_CLEAN_INTERVAL = 100; // Clean every 100 queries

/**
 * Timeout checker class to track elapsed time during reachability analysis
 */
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

/**
 * Generate a simple hash for graph content
 * Used for caching transitive closure computations
 * @param {string} content - Graph content
 * @returns {string} Hash string
 */
function hashGraphContent(content) {
    // Simple hash function - for production, consider using a proper hash library
    let hash = 0;
    const str = content.substring(0, 1000); // Use first 1000 chars for hash
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36) + '-' + content.length;
}

/**
 * Clean expired entries from transitive closure cache
 */
function cleanTransitiveClosureCache() {
    const now = Date.now();
    for (const [key, value] of transitiveClosureCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
            transitiveClosureCache.delete(key);
        }
    }
    
    // If cache is still too large, remove oldest entries
    if (transitiveClosureCache.size > CACHE_MAX_SIZE) {
        const entries = Array.from(transitiveClosureCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, transitiveClosureCache.size - CACHE_MAX_SIZE);
        toRemove.forEach(([key]) => transitiveClosureCache.delete(key));
    }
}

/**
 * Clean expired entries from reachability query cache
 * Called periodically to avoid performance overhead
 */
function cleanReachabilityQueryCache() {
    // Simple LRU: if cache is too large, remove oldest entries
    if (reachabilityQueryCache.size > QUERY_CACHE_MAX_SIZE) {
        const entries = Array.from(reachabilityQueryCache.entries());
        const toRemove = entries.slice(0, reachabilityQueryCache.size - QUERY_CACHE_MAX_SIZE);
        toRemove.forEach(([key]) => reachabilityQueryCache.delete(key));
    }
}

/**
 * Clear all caches
 * Useful for testing or memory management
 */
export function clearReachabilityCaches() {
    transitiveClosureCache.clear();
    reachabilityQueryCache.clear();
}

/**
 * Analyze reachability of nodes in a workflow graph
 * Based on Reps (1998) graph reachability analysis approach
 * 
 * This is the main entry point for reachability analysis. It performs:
 * 1. Graph structure extraction (CPEE XML or Mermaid syntax)
 * 2. Forward reachability analysis (nodes reachable from start)
 * 3. Backward reachability analysis (nodes that can reach end)
 * 4. Bidirectional reachability (node classification: useful, dead-end, unreachable)
 * 5. Strongly Connected Components (SCC) detection (optional)
 * 6. Transitive closure computation (optional, can be expensive)
 * 
 * Performance Characteristics:
 * - Time Complexity: O(V + E) for forward/backward reachability (BFS)
 * - Time Complexity: O(V * (V + E)) for transitive closure (DFS from each node)
 * - Time Complexity: O(V + E) for SCC detection (Kosaraju's algorithm)
 * - Space Complexity: O(V + E) for adjacency lists and reachability sets
 * - For large graphs (>1000 nodes), consider increasing timeout or reducing maxDepth
 * 
 * Limitations:
 * - Very large graphs (>5000 nodes) may timeout with default settings
 * - Transitive closure computation is expensive for dense graphs
 * - Maximum traversal depth prevents infinite loops but may miss deep paths
 * 
 * @param {string} graphContent - Graph content (XML for CPEE, Mermaid syntax for Mermaid)
 * @param {string} format - Graph format ('cpee' or 'mermaid')
 * @param {Object} options - Analysis options
 * @param {Array<string>} options.startNodeIds - Array of start node IDs (optional, will be auto-detected if not provided)
 * @param {Array<string>} options.endNodeIds - Array of end node IDs (optional, will be auto-detected if not provided)
 * @param {boolean} options.includePaths - Whether to include actual paths in results (default: false)
 * @param {boolean} options.computeTransitiveClosure - Whether to compute transitive closure (default: false, can be expensive)
 * @param {number} options.timeout - Timeout in milliseconds (default: 5000)
 * @param {number} options.maxDepth - Maximum traversal depth (default: 1000)
 * @returns {Object} Comprehensive reachability analysis result with the following structure:
 *   - success: boolean - Whether analysis completed successfully
 *   - format: string - Graph format used
 *   - timestamp: string - ISO timestamp of analysis
 *   - analysisTime: number - Time taken in milliseconds
 *   - warnings: Array<string> - Array of warning messages (if any)
 *   - startNodes: Array<string> - Detected start node IDs
 *   - endNodes: Array<string> - Detected end node IDs
 *   - totalNodes: number - Total number of nodes in graph
 *   - forwardReachability: Object - Forward reachability results
 *   - backwardReachability: Object - Backward reachability results
 *   - nodeClassification: Object - Node classification (useful, dead-end, unreachable)
 *   - metrics: Object - Reachability metrics and coverage percentages
 *   - stronglyConnectedComponents: Object|null - SCC information (if computed)
 *   - transitiveClosure: Object|null - Transitive closure matrix (if computed)
 *   - error: string - Error message (if analysis failed)
 * 
 * @example
 * const result = analyzeReachability(mermaidContent, 'mermaid', {
 *   timeout: 10000,
 *   maxDepth: 500,
 *   computeTransitiveClosure: false
 * });
 * 
 * if (result.success) {
 *   console.log(`Useful nodes: ${result.nodeClassification.usefulCount}`);
 *   console.log(`Dead-end nodes: ${result.nodeClassification.deadEndCount}`);
 *   console.log(`Unreachable nodes: ${result.nodeClassification.unreachableCount}`);
 * }
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

    // Enhanced logging for debugging 
    console.log('[ReachabilityAnalyzer] ===== Starting Reachability Analysis =====');
    console.log('[ReachabilityAnalyzer] Format:', format);
    console.log('[ReachabilityAnalyzer] Timeout:', timeout, 'ms');
    console.log('[ReachabilityAnalyzer] Max Depth:', maxDepth);
    console.log('[ReachabilityAnalyzer] Include Paths:', includePaths);
    console.log('[ReachabilityAnalyzer] Compute Transitive Closure:', computeTransitiveClosure);
    console.log('[ReachabilityAnalyzer] Graph Content Length:', graphContent ? graphContent.length : 0, 'characters');

    const timeoutChecker = new TimeoutChecker(timeout);

    try {
        // Validate inputs
        if (!graphContent || typeof graphContent !== 'string') {
            return createErrorResult('Invalid graph content');
        }

        if (format !== 'cpee' && format !== 'mermaid') {
            return createErrorResult(`Unknown format: ${format}. Must be 'cpee' or 'mermaid'`);
        }

        // Extract graph structure
        let graphStructure = null;
        let allNodes = [];
        
        try {
            if (format === 'cpee') {
                graphStructure = extractCPEEGraphStructure(graphContent);
                allNodes = graphStructure.nodes;
            } else if (format === 'mermaid') {
                graphStructure = extractMermaidGraphStructure(graphContent);
                allNodes = graphStructure.nodes;
            }
        } catch (error) {
            console.error('[ReachabilityAnalyzer] Error extracting graph structure:', error);
            // Provide more specific error messages for parsing errors 
            let errorMessage = `Failed to extract graph structure: ${error.message}`;
            if (error.message.includes('parsererror') || error.message.includes('XML')) {
                errorMessage = `Failed to parse ${format === 'cpee' ? 'CPEE XML' : 'Mermaid'} content: ${error.message}. Please check that the graph content is valid.`;
            } else if (error.message.includes('syntax') || error.message.includes('parse')) {
                errorMessage = `Graph parsing error: ${error.message}. The ${format === 'cpee' ? 'XML' : 'Mermaid syntax'} may be malformed.`;
            }
            return createErrorResult(errorMessage);
        }

        // Handle empty graphs 
        if (!graphStructure || graphStructure.nodes.length === 0) {
            console.warn('[ReachabilityAnalyzer] Empty graph detected');
            return createErrorResult('No nodes found in graph. The graph appears to be empty.');
        }

        timeoutChecker.check();

        // Identify start and end nodes
        const detectedStartNodes = startNodeIds.length > 0 
            ? startNodeIds 
            : findStartNodes(graphStructure, format);
        const detectedEndNodes = endNodeIds.length > 0 
            ? endNodeIds 
            : findEndNodes(graphStructure, format);

        // Handle graphs with no start nodes 
        if (detectedStartNodes.length === 0) {
            console.warn('[ReachabilityAnalyzer] No start nodes found in graph');
            // Continue analysis but mark all nodes as unreachable from start
        }

        // Handle graphs with no end nodes 
        if (detectedEndNodes.length === 0) {
            console.warn('[ReachabilityAnalyzer] No end nodes found in graph');
            // Continue analysis but mark all nodes as unable to reach end
        }

        // Enhanced logging for node identification 
        console.log('[ReachabilityAnalyzer] Graph Structure Extracted:');
        console.log('[ReachabilityAnalyzer]   - Total Nodes:', allNodes.length);
        console.log('[ReachabilityAnalyzer]   - Total Edges:', graphStructure.edges.length);
        console.log('[ReachabilityAnalyzer]   - Back Edges (Loops):', graphStructure.backEdges.length);
        if (format === 'mermaid' && allNodes.length > 0) {
            console.log('[ReachabilityAnalyzer]   - Node IDs:', allNodes.map(n => n.id || n.alt_id).filter(Boolean).join(', '));
            console.log('[ReachabilityAnalyzer]   - Edges:', graphStructure.edges.map(e => `${e.from}->${e.to}`).join(', '));
        }
        console.log('[ReachabilityAnalyzer] Start nodes:', detectedStartNodes.length > 0 ? detectedStartNodes : '(none)');
        console.log('[ReachabilityAnalyzer] End nodes:', detectedEndNodes.length > 0 ? detectedEndNodes : '(none)');

        // Build adjacency lists for efficient traversal
        const forwardAdj = buildForwardAdjacencyList(graphStructure);
        const backwardAdj = buildBackwardAdjacencyList(graphStructure);
        
        // Debug logging for adjacency lists (for Mermaid only)
        if (format === 'mermaid') {
            console.log('[ReachabilityAnalyzer] Forward adjacency list:');
            forwardAdj.forEach((neighbors, nodeId) => {
                console.log(`[ReachabilityAnalyzer]   ${nodeId} -> [${neighbors.join(', ')}]`);
            });
            console.log('[ReachabilityAnalyzer] Backward adjacency list:');
            backwardAdj.forEach((predecessors, nodeId) => {
                console.log(`[ReachabilityAnalyzer]   ${nodeId} <- [${predecessors.join(', ')}]`);
            });
        }

        timeoutChecker.check();

        // Perform forward reachability analysis ( handle partial failures)
        console.log('[ReachabilityAnalyzer] Computing forward reachability...');
        let forwardReachability = null;
        try {
            forwardReachability = computeForwardReachability(
                forwardAdj,
                detectedStartNodes,
                allNodes,
                timeoutChecker,
                maxDepth,
                includePaths
            );
            console.log('[ReachabilityAnalyzer] Forward reachability complete:', forwardReachability.reachable.size, 'nodes reachable');
        } catch (error) {
            console.warn('[ReachabilityAnalyzer] Forward reachability analysis failed:', error);
            // Create empty result for forward reachability
            forwardReachability = {
                reachable: new Set(),
                unreachable: new Set(allNodes.map(n => n.id || n.alt_id).filter(Boolean)),
                paths: includePaths ? {} : null,
                statistics: {
                    reachableCount: 0,
                    unreachableCount: allNodes.length,
                    maxDepth: 0,
                    nodesInCycles: []
                }
            };
        }

        timeoutChecker.check();

        // Perform backward reachability analysis ( handle partial failures)
        console.log('[ReachabilityAnalyzer] Computing backward reachability...');
        let backwardReachability = null;
        try {
            backwardReachability = computeBackwardReachability(
                backwardAdj,
                detectedEndNodes,
                allNodes,
                timeoutChecker,
                maxDepth,
                includePaths
            );
            console.log('[ReachabilityAnalyzer] Backward reachability complete:', backwardReachability.reachable.size, 'nodes can reach end');
        } catch (error) {
            console.warn('[ReachabilityAnalyzer] Backward reachability analysis failed:', error);
            // Create empty result for backward reachability
            backwardReachability = {
                reachable: new Set(),
                unreachable: new Set(allNodes.map(n => n.id || n.alt_id).filter(Boolean)),
                paths: includePaths ? {} : null,
                statistics: {
                    reachableCount: 0,
                    unreachableCount: allNodes.length,
                    maxDepth: 0,
                    nodesInCycles: []
                }
            };
        }

        timeoutChecker.check();

        // Compute bidirectional reachability (useful nodes) ( handle partial failures)
        console.log('[ReachabilityAnalyzer] Computing bidirectional reachability (node classification)...');
        let bidirectionalReachability = null;
        try {
            bidirectionalReachability = computeBidirectionalReachability(
                forwardReachability,
                backwardReachability,
                allNodes
            );
            console.log('[ReachabilityAnalyzer] Node classification complete:');
            console.log('[ReachabilityAnalyzer]   - Useful:', bidirectionalReachability.useful.size);
            console.log('[ReachabilityAnalyzer]   - Dead-end:', bidirectionalReachability.deadEnd.size);
            console.log('[ReachabilityAnalyzer]   - Unreachable:', bidirectionalReachability.unreachable.size);
        } catch (error) {
            console.warn('[ReachabilityAnalyzer] Bidirectional reachability analysis failed:', error);
            // Create empty result for bidirectional reachability
            const allNodeIds = new Set(allNodes.map(n => n.id || n.alt_id).filter(Boolean));
            bidirectionalReachability = {
                useful: new Set(),
                deadEnd: new Set(),
                unreachable: allNodeIds,
                statistics: {
                    totalNodes: allNodes.length,
                    usefulCount: 0,
                    deadEndCount: 0,
                    unreachableCount: allNodes.length
                }
            };
        }

        timeoutChecker.check();

        // Detect strongly connected components (optional, for cycle analysis)
        console.log('[ReachabilityAnalyzer] Detecting strongly connected components (SCCs)...');
        let sccInfo = null;
        try {
            sccInfo = findStronglyConnectedComponents(graphStructure, timeoutChecker);
            console.log('[ReachabilityAnalyzer] SCC detection complete:', sccInfo.components.length, 'components found');
            if (sccInfo.nodesInCycles.length > 0) {
                console.log('[ReachabilityAnalyzer]   - Nodes in cycles:', sccInfo.nodesInCycles.length);
            }
        } catch (error) {
            console.warn('[ReachabilityAnalyzer] SCC detection failed:', error);
            // Continue without SCC info
        }

        timeoutChecker.check();

        // Compute transitive closure (optional, can be expensive for large graphs)
        // Performance optimization: Check cache first 
        let transitiveClosure = null;
        if (computeTransitiveClosure) {
            try {
                // Clean cache periodically
                cleanTransitiveClosureCache();
                
                // Check cache
                const cacheKey = `${format}:${hashGraphContent(graphContent)}:${allNodes.length}`;
                const cached = transitiveClosureCache.get(cacheKey);
                
                if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
                    console.log('[ReachabilityAnalyzer] Using cached transitive closure');
                    transitiveClosure = cached.transitiveClosure;
                } else {
                    console.log('[ReachabilityAnalyzer] Computing transitive closure...');
                    transitiveClosure = computeTransitiveClosureMatrix(
                        forwardAdj,
                        allNodes,
                        timeoutChecker,
                        maxDepth
                    );
                    
                    // Cache the result
                    transitiveClosureCache.set(cacheKey, {
                        transitiveClosure: transitiveClosure,
                        timestamp: Date.now(),
                        nodeCount: allNodes.length
                    });
                    
                    console.log('[ReachabilityAnalyzer] Transitive closure computed and cached');
                }
            } catch (error) {
                console.warn('[ReachabilityAnalyzer] Transitive closure computation failed:', error);
                // Continue without transitive closure
            }
        }

        // Detect edge cases and add warnings 
        const warnings = [];
        
        // Check for disconnected components
        const allReachableFromStart = forwardReachability.reachable.size;
        const allReachableToEnd = backwardReachability.reachable.size;
        if (allReachableFromStart < allNodes.length && detectedStartNodes.length > 0) {
            const disconnectedCount = allNodes.length - allReachableFromStart;
            warnings.push(`Found ${disconnectedCount} node(s) that are not reachable from start node(s). The graph may have disconnected components.`);
        }
        
        // Check for graphs with only cycles (no start/end reachability)
        if (detectedStartNodes.length === 0 && detectedEndNodes.length === 0) {
            warnings.push('Graph has no identifiable start or end nodes. All nodes may be part of cycles.');
        }
        
        // Check if graph consists only of cycles
        if (sccInfo && sccInfo.cyclicComponents.length > 0 && 
            sccInfo.cyclicComponents.length === sccInfo.components.length &&
            detectedStartNodes.length === 0) {
            warnings.push('Graph appears to consist entirely of cycles with no entry points.');
        }

        // For metrics calculation:
        // - CPEE: Count all nodes (including duplicates - same task ID can appear multiple times)
        // - Mermaid: Count only task nodes (exclude gateways and events), deduplicate by ID
        let nodesForMetrics;
        if (format === 'cpee') {
            // CPEE: Use all nodes (duplicates are intentional and should be counted)
            nodesForMetrics = allNodes;
        } else {
            // Mermaid: Filter to only task nodes (exclude gateways and events)
            nodesForMetrics = allNodes.filter(node => {
                const nodeType = node.type || 'task';
                return nodeType === 'task';
            });
        }
        
        // Calculate metrics
        const metrics = calculateReachabilityMetrics(
            forwardReachability,
            backwardReachability,
            bidirectionalReachability,
            nodesForMetrics,
            allNodes
        );

        // Filter unreachable nodes to only include task nodes (for Mermaid, exclude gateways and events)
        // For CPEE, include all nodes (duplicates are intentional)
        const taskNodeIds = new Set(nodesForMetrics.map(n => n.id || n.alt_id).filter(Boolean));
        const filterToTasks = (nodeIds) => {
            if (format === 'cpee') {
                // CPEE: Include all nodes (duplicates are intentional)
                return Array.from(nodeIds);
            } else {
                // Mermaid: Filter to only task nodes (exclude gateways and events)
                return Array.from(nodeIds).filter(nodeId => taskNodeIds.has(nodeId));
            }
        };

        // Build result object
        const result = {
            success: true,
            format: format,
            timestamp: new Date().toISOString(),
            analysisTime: timeoutChecker.getElapsed(),
            warnings: warnings.length > 0 ? warnings : undefined, // Include warnings if any
            
            // Node identification
            startNodes: detectedStartNodes,
            endNodes: detectedEndNodes,
            totalNodes: nodesForMetrics.length, // CPEE: all nodes (including duplicates), Mermaid: task nodes only
            
            // Forward reachability (filter to task nodes for counts and lists)
            forwardReachability: {
                reachableNodes: Array.from(forwardReachability.reachable),
                unreachableNodes: filterToTasks(forwardReachability.unreachable), // Filter to only tasks
                count: metrics.forwardReachableCount, // Only count task nodes
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
            
            // Backward reachability (filter to task nodes for counts and lists)
            backwardReachability: {
                reachableNodes: Array.from(backwardReachability.reachable),
                unreachableNodes: filterToTasks(backwardReachability.unreachable), // Filter to only tasks
                count: metrics.backwardReachableCount, // Only count task nodes
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
            
            // Bidirectional reachability (node classification) - filter to task nodes for counts and lists
            nodeClassification: {
                usefulNodes: filterToTasks(bidirectionalReachability.useful), // Filter to only tasks
                deadEndNodes: filterToTasks(bidirectionalReachability.deadEnd), // Filter to only tasks
                unreachableNodes: filterToTasks(bidirectionalReachability.unreachable), // Filter to only tasks
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
                        ? (metrics.usefulNodeCount / metrics.forwardReachableCount) 
                        : 0
                }
            },
            
            // Metrics
            metrics: metrics,
            
            // SCC information (if computed)
            stronglyConnectedComponents: sccInfo ? {
                components: sccInfo.components,
                count: sccInfo.components.length,
                nodesInCycles: sccInfo.nodesInCycles,
                acyclicNodes: sccInfo.acyclicNodes || [],
                cyclicComponents: sccInfo.cyclicComponents || [],
                acyclicComponents: sccInfo.acyclicComponents || [],
                nodeClassification: sccInfo.nodeClassification ? 
                    Object.fromEntries(sccInfo.nodeClassification) : {},
                statistics: sccInfo.statistics || {
                    totalComponents: sccInfo.components.length,
                    cyclicComponentCount: 0,
                    acyclicComponentCount: 0,
                    nodesInCyclesCount: sccInfo.nodesInCycles.length,
                    acyclicNodesCount: 0
                }
            } : null,
            
            // Paths (if requested)
            paths: includePaths ? {
                forwardPaths: forwardReachability.paths || {},
                backwardPaths: backwardReachability.paths || {}
            } : null,
            
            // Transitive closure (if computed)
            transitiveClosure: transitiveClosure
        };

        // Enhanced logging for analysis completion
        console.log('[ReachabilityAnalyzer] ===== Analysis Complete =====');
        console.log('[ReachabilityAnalyzer] Analysis Time:', result.analysisTime, 'ms');
        console.log('[ReachabilityAnalyzer] Node Classification:');
        if (result.metrics) {
            console.log('[ReachabilityAnalyzer]   - Useful nodes:', result.nodeClassification.usefulCount, `(${((result.metrics.usefulCoverage || 0) * 100).toFixed(1)}%)`);
            console.log('[ReachabilityAnalyzer]   - Dead-end nodes:', result.nodeClassification.deadEndCount, `(${((result.metrics.deadEndCoverage || 0) * 100).toFixed(1)}%)`);
            console.log('[ReachabilityAnalyzer]   - Unreachable nodes:', result.nodeClassification.unreachableCount, `(${((result.metrics.unreachableCoverage || 0) * 100).toFixed(1)}%)`);
        } else {
            console.log('[ReachabilityAnalyzer]   - Useful nodes:', result.nodeClassification.usefulCount);
            console.log('[ReachabilityAnalyzer]   - Dead-end nodes:', result.nodeClassification.deadEndCount);
            console.log('[ReachabilityAnalyzer]   - Unreachable nodes:', result.nodeClassification.unreachableCount);
        }
        console.log('[ReachabilityAnalyzer] Reachability Coverage:');
        if (result.forwardReachability && result.forwardReachability.coverage !== undefined) {
            console.log('[ReachabilityAnalyzer]   - Forward Coverage:', (result.forwardReachability.coverage * 100).toFixed(1), '%');
        }
        if (result.backwardReachability && result.backwardReachability.coverage !== undefined) {
            console.log('[ReachabilityAnalyzer]   - Backward Coverage:', (result.backwardReachability.coverage * 100).toFixed(1), '%');
        }
        if (result.warnings && result.warnings.length > 0) {
            console.warn('[ReachabilityAnalyzer] Warnings:', result.warnings);
        }
        if (result.stronglyConnectedComponents) {
            console.log('[ReachabilityAnalyzer] SCCs:', result.stronglyConnectedComponents.count, 'components found');
        }

        return result;

    } catch (error) {
        console.error('[ReachabilityAnalyzer] Error during analysis:', error);
        
        // Return error result with meaningful message 
        let errorMessage = `Reachability analysis failed: ${error.message}`;
        
        // Provide more specific error messages for common issues
        if (error.message && error.message.includes('timeout')) {
            errorMessage = `Reachability analysis timed out after ${timeout}ms. The graph may be too complex. Try increasing the timeout or reducing maxDepth.`;
        } else if (error.message && (error.message.includes('parse') || error.message.includes('XML'))) {
            errorMessage = `Failed to parse graph content: ${error.message}. Please check that the graph content is valid ${format === 'cpee' ? 'XML' : 'Mermaid syntax'}.`;
        } else if (error.message && error.message.includes('structure')) {
            errorMessage = `Failed to extract graph structure: ${error.message}. The graph may be malformed.`;
        }
        
        return createErrorResult(errorMessage);
    }
}

/**
 * Compute forward reachability from start nodes
 * 
 * Based on Reps (1998): nodes reachable via forward edges from start nodes.
 * Uses Breadth-First Search (BFS) to find all nodes reachable from start nodes.
 * 
 * Algorithm:
 * 1. Initialize queue with all start nodes
 * 2. Perform BFS traversal, marking all visited nodes as reachable
 * 3. Track node depths and paths (if requested)
 * 4. Identify nodes in cycles (nodes visited multiple times)
 * 5. Classify all nodes as reachable or unreachable
 * 
 * Performance Characteristics:
 * - Time Complexity: O(V + E) where V is vertices and E is edges
 * - Space Complexity: O(V) for visited set and queue
 * - Efficient for sparse graphs (typical workflow graphs)
 * 
 * Edge Cases Handled:
 * - Empty start nodes: All nodes marked as unreachable
 * - Disconnected graphs: Only nodes in connected components with start nodes are reachable
 * - Cycles: Nodes in cycles are identified but not visited multiple times
 * - Timeout: Throws error if timeout exceeded during traversal
 * 
 * @param {Map<string, Array<string>>} forwardAdj - Forward adjacency list (Map<nodeId, Array<neighborIds>>)
 * @param {Array<string>} startNodes - Array of start node IDs
 * @param {Array<Object>} allNodes - All nodes in the graph
 * @param {TimeoutChecker} timeoutChecker - Timeout checker instance to prevent infinite loops
 * @param {number} maxDepth - Maximum traversal depth to prevent excessive recursion
 * @param {boolean} includePaths - Whether to include actual paths in result (increases memory usage)
 * @returns {Object} Forward reachability result with the following properties:
 *   - reachable: Set<string> - Node IDs reachable from start nodes
 *   - unreachable: Set<string> - Node IDs not reachable from start nodes
 *   - paths: Object|null - Map from node ID to path array (if includePaths is true)
 *   - nodeDepths: Map<string, number> - Map from node ID to depth from start
 *   - statistics: Object - Statistics including reachableCount, unreachableCount, maxDepth, nodesInCycles
 */
function computeForwardReachability(forwardAdj, startNodes, allNodes, timeoutChecker, maxDepth, includePaths) {
    const reachable = new Set();
    const unreachable = new Set();
    const paths = includePaths ? {} : null;
    const nodeDepths = new Map(); // Track depth at which each node was first reached
    const nodesInCycles = new Set(); // Track nodes that are part of cycles
    
    // Initialize all nodes as unreachable
    allNodes.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (nodeId) {
            unreachable.add(nodeId);
        }
    });
    
    // If no start nodes, all nodes are unreachable
    if (startNodes.length === 0) {
        allNodes.forEach(node => {
            const nodeId = node.id || node.alt_id;
            if (nodeId) {
                unreachable.add(nodeId);
            }
        });
        return { 
            reachable, 
            unreachable, 
            paths,
            statistics: {
                reachableCount: 0,
                unreachableCount: unreachable.size,
                maxDepth: 0,
                nodesInCycles: []
            }
        };
    }
    
    // Perform BFS from all start nodes
    const visited = new Set();
    const queue = [];
    
    // Add all start nodes to queue
    startNodes.forEach(startNodeId => {
        if (forwardAdj.has(startNodeId) || allNodes.some(n => (n.id || n.alt_id) === startNodeId)) {
            queue.push({ nodeId: startNodeId, depth: 0, path: [startNodeId] });
            visited.add(startNodeId);
            reachable.add(startNodeId);
            unreachable.delete(startNodeId);
            nodeDepths.set(startNodeId, 0);
            
            if (includePaths) {
                paths[startNodeId] = [startNodeId];
            }
        }
    });
    
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
        
        const neighbors = forwardAdj.get(nodeId) || [];
        
        for (const neighborId of neighbors) {
            timeoutChecker.check();
            
            // Check if this creates a cycle (neighbor is already in current path)
            const createsCycle = includePaths && path && path.includes(neighborId);
            if (createsCycle) {
                nodesInCycles.add(neighborId);
                nodesInCycles.add(nodeId);
            }
            
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                reachable.add(neighborId);
                unreachable.delete(neighborId);
                nodeDepths.set(neighborId, depth + 1);
                
                const newPath = includePaths ? [...path, neighborId] : null;
                queue.push({ 
                    nodeId: neighborId, 
                    depth: depth + 1, 
                    path: newPath 
                });
                
                if (includePaths) {
                    paths[neighborId] = newPath;
                }
            } else {
                // Node already visited - this indicates a cycle
                // Mark nodes in cycle as reachable (they already are)
                nodesInCycles.add(neighborId);
                nodesInCycles.add(nodeId);
            }
        }
    }
    
    // Calculate statistics
    const statistics = {
        reachableCount: reachable.size,
        unreachableCount: unreachable.size,
        maxDepth: maxDepthReached,
        nodesInCycles: Array.from(nodesInCycles),
        cycleCount: nodesInCycles.size,
        averageDepth: calculateAverageDepth(nodeDepths, reachable)
    };
    
    return { 
        reachable, 
        unreachable, 
        paths,
        nodeDepths,
        statistics
    };
}

/**
 * Compute backward reachability to end nodes
 * 
 * Based on Reps (1998): nodes that can reach end nodes via backward traversal.
 * Uses Breadth-First Search (BFS) on the reverse graph to find all nodes that can reach end nodes.
 * 
 * Algorithm:
 * 1. Initialize queue with all end nodes
 * 2. Perform BFS traversal on reverse graph (backwardAdj), marking all visited nodes as reachable
 * 3. Track node depths and paths (if requested)
 * 4. Identify nodes in cycles (nodes visited multiple times)
 * 5. Classify all nodes as reachable (can reach end) or unreachable (dead-end)
 * 
 * Performance Characteristics:
 * - Time Complexity: O(V + E) where V is vertices and E is edges
 * - Space Complexity: O(V) for visited set and queue
 * - Efficient for sparse graphs (typical workflow graphs)
 * 
 * Edge Cases Handled:
 * - Empty end nodes: All nodes marked as unable to reach end
 * - Disconnected graphs: Only nodes in connected components with end nodes can reach end
 * - Cycles: Nodes in cycles are identified but not visited multiple times
 * - Timeout: Throws error if timeout exceeded during traversal
 * 
 * @param {Map<string, Array<string>>} backwardAdj - Backward adjacency list (reverse graph: Map<nodeId, Array<predecessorIds>>)
 * @param {Array<string>} endNodes - Array of end node IDs
 * @param {Array<Object>} allNodes - All nodes in the graph
 * @param {TimeoutChecker} timeoutChecker - Timeout checker instance to prevent infinite loops
 * @param {number} maxDepth - Maximum traversal depth to prevent excessive recursion
 * @param {boolean} includePaths - Whether to include actual paths in result (increases memory usage)
 * @returns {Object} Backward reachability result with the following properties:
 *   - reachable: Set<string> - Node IDs that can reach end nodes
 *   - unreachable: Set<string> - Node IDs that cannot reach end nodes (dead-ends)
 *   - paths: Object|null - Map from node ID to path array (if includePaths is true)
 *   - nodeDepths: Map<string, number> - Map from node ID to depth from end
 *   - statistics: Object - Statistics including reachableCount, unreachableCount, maxDepth, nodesInCycles
 */
function computeBackwardReachability(backwardAdj, endNodes, allNodes, timeoutChecker, maxDepth, includePaths) {
    const reachable = new Set();
    const unreachable = new Set();
    const paths = includePaths ? {} : null;
    const nodeDepths = new Map(); // Track depth at which each node was first reached
    const nodesInCycles = new Set(); // Track nodes that are part of cycles
    
    // Initialize all nodes as unreachable
    allNodes.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (nodeId) {
            unreachable.add(nodeId);
        }
    });
    
    // If no end nodes, all nodes are unreachable
    if (endNodes.length === 0) {
        allNodes.forEach(node => {
            const nodeId = node.id || node.alt_id;
            if (nodeId) {
                unreachable.add(nodeId);
            }
        });
        return { 
            reachable, 
            unreachable, 
            paths,
            statistics: {
                reachableCount: 0,
                unreachableCount: unreachable.size,
                maxDepth: 0,
                nodesInCycles: []
            }
        };
    }
    
    // Perform BFS from all end nodes (backward)
    const visited = new Set();
    const queue = [];
    
    // Add all end nodes to queue
    endNodes.forEach(endNodeId => {
        if (backwardAdj.has(endNodeId) || allNodes.some(n => (n.id || n.alt_id) === endNodeId)) {
            queue.push({ nodeId: endNodeId, depth: 0, path: [endNodeId] });
            visited.add(endNodeId);
            reachable.add(endNodeId);
            unreachable.delete(endNodeId);
            nodeDepths.set(endNodeId, 0);
            
            if (includePaths) {
                paths[endNodeId] = [endNodeId];
            }
        }
    });
    
    // BFS traversal (backward)
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
        
        const neighbors = backwardAdj.get(nodeId) || [];
        
        for (const neighborId of neighbors) {
            timeoutChecker.check();
            
            // Check if this creates a cycle (neighbor is already in current path)
            const createsCycle = includePaths && path && path.includes(neighborId);
            if (createsCycle) {
                nodesInCycles.add(neighborId);
                nodesInCycles.add(nodeId);
            }
            
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                reachable.add(neighborId);
                unreachable.delete(neighborId);
                nodeDepths.set(neighborId, depth + 1);
                
                const newPath = includePaths ? [...path, neighborId] : null;
                queue.push({ 
                    nodeId: neighborId, 
                    depth: depth + 1, 
                    path: newPath 
                });
                
                if (includePaths) {
                    paths[neighborId] = newPath;
                }
            } else {
                // Node already visited - this indicates a cycle
                // Mark nodes in cycle as reachable (they already are)
                nodesInCycles.add(neighborId);
                nodesInCycles.add(nodeId);
            }
        }
    }
    
    // Calculate statistics
    const statistics = {
        reachableCount: reachable.size,
        unreachableCount: unreachable.size,
        maxDepth: maxDepthReached,
        nodesInCycles: Array.from(nodesInCycles),
        cycleCount: nodesInCycles.size,
        averageDepth: calculateAverageDepth(nodeDepths, reachable)
    };
    
    return { 
        reachable, 
        unreachable, 
        paths,
        nodeDepths,
        statistics
    };
}

/**
 * Compute bidirectional reachability and classify nodes
 * 
 * This function classifies nodes into three categories based on forward and backward reachability:
 * 
 * Node Classification System :
 * 1. **Useful Nodes**: Nodes that are reachable from start AND can reach end
 *    - These nodes are part of valid execution paths from start to end
 *    - Represent "live" code that can be executed in a complete workflow
 * 
 * 2. **Dead-End Nodes**: Nodes that are reachable from start but CANNOT reach end
 *    - These nodes are reachable but lead to dead ends
 *    - May indicate incomplete workflows or unreachable termination points
 * 
 * 3. **Unreachable Nodes**: Nodes that are NOT reachable from start
 *    - These nodes represent "dead code" that can never be executed
 *    - May indicate disconnected components or unreachable branches
 * 
 * Based on Reps (1998): The intersection of forward and backward reachability sets
 * identifies nodes that are part of valid execution paths from start to end.
 * 
 * The classification helps identify:
 * - Workflow completeness (all useful nodes should be covered by traces)
 * - Dead code (unreachable nodes)
 * - Incomplete paths (dead-end nodes)
 * 
 * @param {Object} forwardReachability - Forward reachability result with reachable/unreachable sets
 * @param {Object} backwardReachability - Backward reachability result with reachable/unreachable sets
 * @param {Array<Object>} allNodes - All nodes in the graph
 * @returns {Object} Bidirectional reachability classification with the following properties:
 *   - useful: Set<string> - Node IDs that are useful (reachable from start AND can reach end)
 *   - deadEnd: Set<string> - Node IDs that are dead-ends (reachable from start but cannot reach end)
 *   - unreachable: Set<string> - Node IDs that are unreachable (not reachable from start)
 *   - statistics: Object - Statistics including counts, coverage percentages, and cycle information
 * 
 * @example
 * const classification = computeBidirectionalReachability(forward, backward, allNodes);
 * console.log(`Useful: ${classification.useful.size}, Dead-end: ${classification.deadEnd.size}, Unreachable: ${classification.unreachable.size}`);
 */
function computeBidirectionalReachability(forwardReachability, backwardReachability, allNodes) {
    const useful = new Set(); // Reachable from start AND can reach end
    const deadEnd = new Set(); // Reachable from start but cannot reach end
    const unreachable = new Set(); // Not reachable from start
    
    // Compute intersection of forward and backward reachability sets
    const forwardReachableSet = forwardReachability.reachable;
    const backwardReachableSet = backwardReachability.reachable;
    
    // Classify each node (classify all nodes for complete information)
    allNodes.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (!nodeId) {
            return;
        }
        
        const forwardReachable = forwardReachableSet.has(nodeId);
        const backwardReachable = backwardReachableSet.has(nodeId);
        
        if (forwardReachable && backwardReachable) {
            // Node is reachable from start AND can reach end (useful node)
            useful.add(nodeId);
        } else if (forwardReachable && !backwardReachable) {
            // Node is reachable from start but cannot reach end (dead-end node)
            deadEnd.add(nodeId);
        } else {
            // Node is not reachable from start (unreachable node)
            unreachable.add(nodeId);
        }
    });
    
    // Note: Statistics will be calculated in calculateReachabilityMetrics based on format
    // For CPEE: all nodes (including duplicates) are counted
    // For Mermaid: only task nodes are counted
    // We'll use placeholder values here that will be overridden by metrics calculation
    const usefulCount = useful.size;
    const deadEndCount = deadEnd.size;
    const unreachableCount = unreachable.size;
    
    // Calculate reachability coverage percentage (will be recalculated in metrics with proper filtering)
    // These are temporary values - actual coverage is calculated in calculateReachabilityMetrics
    const totalNodes = allNodes.length;
    const usefulCoverage = totalNodes > 0 ? (usefulCount / totalNodes) : 0;
    const deadEndCoverage = totalNodes > 0 ? (deadEndCount / totalNodes) : 0;
    const unreachableCoverage = totalNodes > 0 ? (unreachableCount / totalNodes) : 0;
    
    // Calculate forward reachability coverage
    const forwardReachableCount = forwardReachableSet.size;
    const forwardCoverage = totalNodes > 0 ? (forwardReachableCount / totalNodes) : 0;
    
    // Calculate backward reachability coverage
    const backwardReachableCount = backwardReachableSet.size;
    const backwardCoverage = totalNodes > 0 ? (backwardReachableCount / totalNodes) : 0;
    
    // Calculate intersection coverage
    const intersectionCoverage = forwardReachableCount > 0 
        ? (usefulCount / forwardReachableCount) 
        : 0;
    
    // Identify nodes that are in cycles (from forward and backward statistics)
    const forwardCycleNodes = new Set(forwardReachability.statistics?.nodesInCycles || []);
    const backwardCycleNodes = new Set(backwardReachability.statistics?.nodesInCycles || []);
    const nodesInCycles = new Set([...forwardCycleNodes, ...backwardCycleNodes]);
    
    // Classify cycle nodes by category
    const usefulNodesInCycles = Array.from(nodesInCycles).filter(nodeId => useful.has(nodeId));
    const deadEndNodesInCycles = Array.from(nodesInCycles).filter(nodeId => deadEnd.has(nodeId));
    const unreachableNodesInCycles = Array.from(nodesInCycles).filter(nodeId => unreachable.has(nodeId));
    
    // Build comprehensive statistics
    // Note: Actual counts and coverage will be recalculated in calculateReachabilityMetrics
    // based on format (CPEE: all nodes, Mermaid: task nodes only)
    const statistics = {
        totalNodes: totalNodes, // Will be overridden by metrics calculation
        usefulCount: usefulCount, // Will be overridden by metrics calculation
        deadEndCount: deadEndCount, // Will be overridden by metrics calculation
        unreachableCount: unreachableCount, // Will be overridden by metrics calculation
        usefulCoverage: usefulCoverage, // Will be overridden by metrics calculation
        deadEndCoverage: deadEndCoverage, // Will be overridden by metrics calculation
        unreachableCoverage: unreachableCoverage, // Will be overridden by metrics calculation
        forwardCoverage: forwardCoverage, // Will be overridden by metrics calculation
        backwardCoverage: backwardCoverage, // Will be overridden by metrics calculation
        intersectionCoverage: intersectionCoverage, // Will be overridden by metrics calculation
        forwardReachableCount: forwardReachableCount, // Will be overridden by metrics calculation
        backwardReachableCount: backwardReachableCount, // Will be overridden by metrics calculation
        nodesInCycles: Array.from(nodesInCycles),
        cycleCount: nodesInCycles.size,
        usefulNodesInCycles: usefulNodesInCycles,
        deadEndNodesInCycles: deadEndNodesInCycles,
        unreachableNodesInCycles: unreachableNodesInCycles
    };
    
    return { 
        useful, 
        deadEnd, 
        unreachable,
        statistics
    };
}

/**
 * Calculate average depth for reachable nodes
 * @param {Map<string, number>} nodeDepths - Map of node ID to depth
 * @param {Set<string>} reachable - Set of reachable node IDs
 * @returns {number} Average depth
 */
function calculateAverageDepth(nodeDepths, reachable) {
    if (reachable.size === 0) {
        return 0;
    }
    
    let totalDepth = 0;
    let count = 0;
    
    reachable.forEach(nodeId => {
        const depth = nodeDepths.get(nodeId);
        if (depth !== undefined) {
            totalDepth += depth;
            count++;
        }
    });
    
    return count > 0 ? totalDepth / count : 0;
}

/**
 * Calculate reachability metrics
 * @param {Object} forwardReachability - Forward reachability result
 * @param {Object} backwardReachability - Backward reachability result
 * @param {Object} bidirectionalReachability - Bidirectional reachability result
 * @param {Array<Object>} taskNodes - Task nodes only (for metrics calculation)
 * @param {Array<Object>} _allNodes - All nodes in the graph (for reference, currently unused)
 * @returns {Object} Reachability metrics
 */
function calculateReachabilityMetrics(forwardReachability, backwardReachability, bidirectionalReachability, nodesForMetrics, _allNodes) {
    const totalNodes = nodesForMetrics.length;
    
    // Count nodes based on actual node objects (not just unique IDs)
    // For CPEE: Count all node objects including duplicates (same ID can appear multiple times)
    // For Mermaid: Count task node objects (already filtered, deduplicated by ID)
    let forwardCount = 0;
    let backwardCount = 0;
    let usefulCount = 0;
    let deadEndCount = 0;
    let unreachableCount = 0;
    
    nodesForMetrics.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (!nodeId) {
            return;
        }
        
        const forwardReachable = forwardReachability.reachable.has(nodeId);
        const backwardReachable = backwardReachability.reachable.has(nodeId);
        const isUseful = bidirectionalReachability.useful.has(nodeId);
        const isDeadEnd = bidirectionalReachability.deadEnd.has(nodeId);
        const isUnreachable = bidirectionalReachability.unreachable.has(nodeId);
        
        // Count each node object (for CPEE, duplicates are counted separately)
        if (forwardReachable) {
            forwardCount++;
        }
        if (backwardReachable) {
            backwardCount++;
        }
        if (isUseful) {
            usefulCount++;
        }
        if (isDeadEnd) {
            deadEndCount++;
        }
        if (isUnreachable) {
            unreachableCount++;
        }
    });
    
    return {
        totalNodes: totalNodes,
        forwardReachableCount: forwardCount,
        backwardReachableCount: backwardCount,
        usefulNodeCount: usefulCount,
        deadEndNodeCount: deadEndCount,
        unreachableNodeCount: unreachableCount,
        forwardCoverage: totalNodes > 0 ? (forwardCount / totalNodes) : 0,
        backwardCoverage: totalNodes > 0 ? (backwardCount / totalNodes) : 0,
        usefulCoverage: totalNodes > 0 ? (usefulCount / totalNodes) : 0,
        deadEndCoverage: totalNodes > 0 ? (deadEndCount / totalNodes) : 0,
        unreachableCoverage: totalNodes > 0 ? (unreachableCount / totalNodes) : 0
    };
}

/**
 * Build forward adjacency list from graph structure
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @returns {Map<string, Array<string>>} Forward adjacency list
 */
function buildForwardAdjacencyList(graphStructure) {
    const adj = new Map();
    const { nodes, edges } = graphStructure;
    
    // Initialize all nodes
    nodes.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (nodeId) {
            adj.set(nodeId, []);
        }
    });
    
    // Add edges
    edges.forEach(edge => {
        const fromId = edge.from;
        const toId = edge.to;
        
        if (adj.has(fromId) && adj.has(toId)) {
            if (!adj.get(fromId).includes(toId)) {
                adj.get(fromId).push(toId);
            }
        }
    });
    
    return adj;
}

/**
 * Build backward adjacency list from graph structure
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @returns {Map<string, Array<string>>} Backward adjacency list
 */
function buildBackwardAdjacencyList(graphStructure) {
    const adj = new Map();
    const { nodes, edges } = graphStructure;
    
    // Initialize all nodes
    nodes.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (nodeId) {
            adj.set(nodeId, []);
        }
    });
    
    // Add reverse edges
    edges.forEach(edge => {
        const fromId = edge.from;
        const toId = edge.to;
        
        if (adj.has(toId) && adj.has(fromId)) {
            if (!adj.get(toId).includes(fromId)) {
                adj.get(toId).push(fromId);
            }
        }
    });
    
    return adj;
}

/**
 * Extract graph structure from CPEE XML
 * 
 * This function parses CPEE XML content and extracts a graph structure suitable for reachability analysis.
 * It handles all CPEE-specific constructs:
 * - Task nodes: call, manipulate, script elements
 * - Sequential flow: description elements (parent-child relationships)
 * - Exclusive gateways: choose/alternative structures (XOR splits/joins)
 * - Parallel gateways: parallel/parallel_branch structures (AND splits/joins)
 * - Loops: loop elements (identifies back edges for cycle detection)
 * 
 * Graph Structure Extraction Process:
 * 1. Parse XML using DOMParser
 * 2. Extract all task nodes (call, manipulate, script) with their IDs
 * 3. Extract sequential edges from description elements
 * 4. Extract XOR gateway edges from choose/alternative structures
 * 5. Extract AND gateway edges from parallel/parallel_branch structures
 * 6. Extract loop edges and identify back edges (cycles)
 * 7. Remove duplicate edges
 * 8. Return graph structure with nodes, edges, backEdges, and metadata
 * 
 * Edge Types:
 * - 'sequential': Normal sequential flow in description
 * - 'xor-branch': Edge from XOR gateway to alternative branch
 * - 'xor-join': Edge from alternative branch to XOR join
 * - 'and-branch': Edge from AND gateway to parallel branch
 * - 'and-join': Edge from parallel branch to AND join
 * - 'loop-entry': Edge entering a loop
 * - 'loop-exit': Edge exiting a loop
 * - 'loop-back': Back edge creating a cycle
 * 
 * @param {string} xmlContent - CPEE XML content
 * @returns {Object} Graph structure with the following properties:
 *   - nodes: Array<Object> - Array of node objects with id, alt_id, and type
 *   - edges: Array<Object> - Array of edge objects with from, to, and type
 *   - backEdges: Array<Object> - Array of back edges (loops/cycles)
 *   - metadata: Object - Metadata including hasLoops, hasParallel, hasXOR flags
 * @throws {Error} If XML parsing fails or graph structure cannot be extracted
 * 
 * @example
 * const graphStructure = extractCPEEGraphStructure(cpeeXml);
 * console.log(`Extracted ${graphStructure.nodes.length} nodes and ${graphStructure.edges.length} edges`);
 */
function extractCPEEGraphStructure(xmlContent) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML parsing error: ' + parserError.textContent);
        }
        
        const nodes = [];
        const edges = [];
        const backEdges = []; // For loop detection
        const nodeMap = new Map();
        const gatewayNodes = new Map(); // Track gateway nodes for edge extraction
        
        // Extract all task nodes (call, manipulate, script)
        const taskElements = xmlDoc.querySelectorAll('call, manipulate, script');
        taskElements.forEach((element) => {
            const id = element.getAttribute('id');
            if (id) {
                nodes.push({ id, alt_id: null, type: 'task' });
                nodeMap.set(id, element);
            }
        });
        
        // Extract edges from description elements (sequential flow)
        const descriptionElements = xmlDoc.querySelectorAll('description');
        descriptionElements.forEach(desc => {
            extractEdgesFromDescription(desc, edges, nodeMap);
        });
        
        // Extract edges from choose/alternative structures (XOR gateway)
        const chooseElements = xmlDoc.querySelectorAll('choose');
        chooseElements.forEach(choose => {
            extractEdgesFromChoose(choose, edges, nodeMap);
        });
        
        // Extract edges from parallel structures (AND gateway)
        const parallelElements = xmlDoc.querySelectorAll('parallel');
        parallelElements.forEach(parallel => {
            extractEdgesFromParallel(parallel, edges, nodeMap);
        });
        
        // Extract edges from loop structures (identify back edges)
        const loopElements = xmlDoc.querySelectorAll('loop');
        loopElements.forEach(loop => {
            extractEdgesFromLoop(loop, edges, backEdges, nodeMap);
        });
        
        // Remove duplicate edges
        const uniqueEdges = removeDuplicateEdges(edges);
        
        return { 
            nodes, 
            edges: uniqueEdges, 
            backEdges,
            metadata: {
                hasLoops: backEdges.length > 0,
                hasParallel: parallelElements.length > 0,
                hasXOR: chooseElements.length > 0
            }
        };
    } catch (error) {
        console.error('[ReachabilityAnalyzer] Error extracting CPEE graph structure:', error);
        throw error;
    }
}

/**
 * Extract edges from description element (sequential flow)
 * 
 * Description elements in CPEE represent sequential flow. This function extracts edges
 * between consecutive child elements, creating sequential edges in the graph structure.
 * 
 * Process:
 * - Filters out condition elements (not part of flow)
 * - Creates edges between consecutive children (from child[i] to child[i+1])
 * - Handles nested structures (choose, parallel, loop) by delegating to appropriate functions
 * 
 * @param {Element} desc - Description element (XML Element)
 * @param {Array<Object>} edges - Edges array to populate with {from, to, type} objects
 * @param {Map} nodeMap - Map of node IDs to elements (currently unused but kept for consistency)
 * @returns {void} Modifies edges array in place
 */
function extractEdgesFromDescription(desc, edges, nodeMap) {
    const children = Array.from(desc.children).filter(c => 
        !['condition'].includes(c.tagName.toLowerCase())
    );
    
    for (let i = 0; i < children.length - 1; i++) {
        const fromElement = children[i];
        const toElement = children[i + 1];
        
        const fromId = getNodeId(fromElement);
        const toId = getNodeId(toElement);
        
        if (fromId && toId) {
            edges.push({ from: fromId, to: toId, type: 'sequential' });
        } else if (fromId) {
            // Handle nested structures (choose, parallel, loop)
            extractEdgesFromNestedStructure(fromElement, toElement, edges, nodeMap);
        }
    }
}

/**
 * Extract edges from choose element (XOR gateway - exclusive paths)
 * 
 * Choose elements in CPEE represent exclusive gateways (XOR splits/joins). This function
 * extracts edges for each alternative branch, connecting them to the predecessor and successor
 * elements in the parent structure.
 * 
 * Process:
 * - Finds all alternative branches within the choose element
 * - Creates edges from predecessor to first element in each alternative (xor-branch)
 * - Creates sequential edges within each alternative (xor-sequential)
 * - Creates edges from last element in each alternative to successor (xor-join)
 * 
 * Edge Types:
 * - 'xor-branch': Edge from predecessor to first element in alternative
 * - 'xor-sequential': Sequential edges within alternative
 * - 'xor-join': Edge from last element in alternative to successor
 * 
 * @param {Element} choose - Choose element (XML Element representing XOR gateway)
 * @param {Array<Object>} edges - Edges array to populate with {from, to, type} objects
 * @param {Map} nodeMap - Map of node IDs to elements (currently unused but kept for consistency)
 * @returns {void} Modifies edges array in place
 */
function extractEdgesFromChoose(choose, edges, nodeMap) {
    const alternatives = Array.from(choose.querySelectorAll('alternative'));
    
    // Get parent to find incoming edge
    const parent = choose.parentElement;
    const parentChildren = parent ? Array.from(parent.children) : [];
    const chooseIndex = parentChildren.indexOf(choose);
    
    // Extract edges from each alternative branch
    alternatives.forEach(alt => {
        const altChildren = Array.from(alt.children).filter(c => 
            !['condition'].includes(c.tagName.toLowerCase())
        );
        
        // First element in alternative gets edge from choose's predecessor (if exists)
        if (altChildren.length > 0 && chooseIndex > 0) {
            const predecessor = parentChildren[chooseIndex - 1];
            const predecessorId = getNodeId(predecessor);
            const firstAltId = getNodeId(altChildren[0]);
            
            if (predecessorId && firstAltId) {
                edges.push({ from: predecessorId, to: firstAltId, type: 'xor-branch' });
            }
        }
        
        // Sequential edges within alternative
        for (let i = 0; i < altChildren.length - 1; i++) {
            const fromId = getNodeId(altChildren[i]);
            const toId = getNodeId(altChildren[i + 1]);
            if (fromId && toId) {
                edges.push({ from: fromId, to: toId, type: 'xor-sequential' });
            }
        }
        
        // Last element in alternative connects to choose's successor (if exists)
        if (altChildren.length > 0 && chooseIndex < parentChildren.length - 1) {
            const successor = parentChildren[chooseIndex + 1];
            const lastAltId = getNodeId(altChildren[altChildren.length - 1]);
            const successorId = getNodeId(successor);
            
            if (lastAltId && successorId) {
                edges.push({ from: lastAltId, to: successorId, type: 'xor-join' });
            }
        }
    });
}

/**
 * Extract edges from parallel element (AND gateway - parallel branches)
 * 
 * Parallel elements in CPEE represent parallel gateways (AND splits/joins). This function
 * extracts edges for each parallel branch, connecting them to the predecessor and successor
 * elements in the parent structure.
 * 
 * Process:
 * - Finds all parallel_branch elements within the parallel element
 * - Creates edges from predecessor to first element in each branch (and-branch)
 * - Creates sequential edges within each branch (and-sequential)
 * - Creates edges from last element in each branch to successor (and-join)
 * 
 * Edge Types:
 * - 'and-branch': Edge from predecessor to first element in parallel branch
 * - 'and-sequential': Sequential edges within parallel branch
 * - 'and-join': Edge from last element in parallel branch to successor
 * 
 * @param {Element} parallel - Parallel element (XML Element representing AND gateway)
 * @param {Array<Object>} edges - Edges array to populate with {from, to, type} objects
 * @param {Map} nodeMap - Map of node IDs to elements (currently unused but kept for consistency)
 * @returns {void} Modifies edges array in place
 */
function extractEdgesFromParallel(parallel, edges, nodeMap) {
    const branches = Array.from(parallel.querySelectorAll('parallel_branch'));
    
    // Get parent to find incoming edge
    const parent = parallel.parentElement;
    const parentChildren = parent ? Array.from(parent.children) : [];
    const parallelIndex = parentChildren.indexOf(parallel);
    
    // Extract edges from each parallel branch
    branches.forEach(branch => {
        const branchChildren = Array.from(branch.children).filter(c => 
            !['condition'].includes(c.tagName.toLowerCase())
        );
        
        // First element in branch gets edge from parallel's predecessor (if exists)
        if (branchChildren.length > 0 && parallelIndex > 0) {
            const predecessor = parentChildren[parallelIndex - 1];
            const predecessorId = getNodeId(predecessor);
            const firstBranchId = getNodeId(branchChildren[0]);
            
            if (predecessorId && firstBranchId) {
                edges.push({ from: predecessorId, to: firstBranchId, type: 'and-branch' });
            }
        }
        
        // Sequential edges within branch
        for (let i = 0; i < branchChildren.length - 1; i++) {
            const fromId = getNodeId(branchChildren[i]);
            const toId = getNodeId(branchChildren[i + 1]);
            if (fromId && toId) {
                edges.push({ from: fromId, to: toId, type: 'and-sequential' });
            }
        }
        
        // Last element in branch connects to parallel's successor (if exists)
        if (branchChildren.length > 0 && parallelIndex < parentChildren.length - 1) {
            const successor = parentChildren[parallelIndex + 1];
            const lastBranchId = getNodeId(branchChildren[branchChildren.length - 1]);
            const successorId = getNodeId(successor);
            
            if (lastBranchId && successorId) {
                edges.push({ from: lastBranchId, to: successorId, type: 'and-join' });
            }
        }
    });
}

/**
 * Extract edges from loop element (identify back edges for cycles)
 * 
 * Loop elements in CPEE represent cycles in the workflow. This function extracts edges
 * within the loop body and identifies back edges that create cycles.
 * 
 * Process:
 * - Creates sequential edges between consecutive children in loop body (loop-sequential)
 * - Identifies back edge: last element connects back to first element (loop-back)
 * - Creates entry edge from predecessor to first element in loop (loop-entry)
 * - Creates exit edge from last element in loop to successor (loop-exit)
 * 
 * Edge Types:
 * - 'loop-sequential': Sequential edges within loop body
 * - 'loop-back': Back edge creating cycle (last element to first element)
 * - 'loop-entry': Edge entering loop from predecessor
 * - 'loop-exit': Edge exiting loop to successor
 * 
 * Cycle Detection:
 * - Back edges are added to both edges and backEdges arrays
 * - Back edges are used for cycle detection and SCC analysis
 * 
 * @param {Element} loop - Loop element (XML Element representing a loop)
 * @param {Array<Object>} edges - Edges array to populate with {from, to, type} objects
 * @param {Array<Object>} backEdges - Back edges array to populate (for cycle detection)
 * @param {Map} nodeMap - Map of node IDs to elements (currently unused but kept for consistency)
 * @returns {void} Modifies edges and backEdges arrays in place
 */
function extractEdgesFromLoop(loop, edges, backEdges, nodeMap) {
    const loopId = loop.getAttribute('id');
    const children = Array.from(loop.children).filter(c => 
        !['condition'].includes(c.tagName.toLowerCase())
    );
    
    // Sequential edges within loop body
    for (let i = 0; i < children.length - 1; i++) {
        const fromId = getNodeId(children[i]);
        const toId = getNodeId(children[i + 1]);
        if (fromId && toId) {
            edges.push({ from: fromId, to: toId, type: 'loop-sequential' });
        }
    }
    
    // Identify back edge: last element in loop connects back to first element (or loop entry)
    if (children.length > 0) {
        const firstChildId = getNodeId(children[0]);
        const lastChildId = getNodeId(children[children.length - 1]);
        
        if (firstChildId && lastChildId) {
            // This is a back edge (creates cycle)
            const backEdge = { from: lastChildId, to: firstChildId, type: 'loop-back' };
            edges.push(backEdge);
            backEdges.push(backEdge);
        }
    }
    
    // Connect loop to parent structure
    const parent = loop.parentElement;
    if (parent) {
        const parentChildren = Array.from(parent.children).filter(c => 
            !['condition'].includes(c.tagName.toLowerCase())
        );
        const loopIndex = parentChildren.indexOf(loop);
        
        // Connect predecessor to first element in loop
        if (loopIndex > 0 && children.length > 0) {
            const predecessor = parentChildren[loopIndex - 1];
            const predecessorId = getNodeId(predecessor);
            const firstLoopId = getNodeId(children[0]);
            
            if (predecessorId && firstLoopId) {
                edges.push({ from: predecessorId, to: firstLoopId, type: 'loop-entry' });
            }
        }
        
        // Connect last element in loop to successor
        if (loopIndex < parentChildren.length - 1 && children.length > 0) {
            const successor = parentChildren[loopIndex + 1];
            const lastLoopId = getNodeId(children[children.length - 1]);
            const successorId = getNodeId(successor);
            
            if (lastLoopId && successorId) {
                edges.push({ from: lastLoopId, to: successorId, type: 'loop-exit' });
            }
        }
    }
}

/**
 * Extract edges from nested structure (choose, parallel, loop within description)
 * @param {Element} fromElement - Source element
 * @param {Element} toElement - Target element
 * @param {Array<Object>} edges - Edges array to populate
 * @param {Map} nodeMap - Map of node IDs to elements
 */
function extractEdgesFromNestedStructure(fromElement, toElement, edges, nodeMap) {
    const fromId = getNodeId(fromElement);
    const toId = getNodeId(toElement);
    
    if (fromId && toId) {
        edges.push({ from: fromId, to: toId, type: 'nested' });
    }
}

/**
 * Get node ID from XML element (handles various element types)
 * 
 * This helper function extracts node IDs from different CPEE XML element types.
 * It handles:
 * - Direct task elements: call, manipulate, script (returns id attribute)
 * - Nested structures: Returns ID of first task element found within
 * - Loop elements: Returns loop element's id attribute
 * 
 * @param {Element} element - XML element (may be task, nested structure, or loop)
 * @returns {string|null} Node ID if found, null otherwise
 */
function getNodeId(element) {
    if (!element) return null;
    
    // Direct task elements
    if (['call', 'manipulate', 'script'].includes(element.tagName.toLowerCase())) {
        return element.getAttribute('id');
    }
    
    // Nested structures: get first task element
    const taskElement = element.querySelector('call, manipulate, script');
    if (taskElement) {
        return taskElement.getAttribute('id');
    }
    
    // Loop element itself
    if (element.tagName.toLowerCase() === 'loop') {
        return element.getAttribute('id');
    }
    
    return null;
}

/**
 * Remove duplicate edges
 * @param {Array<Object>} edges - Edges array
 * @returns {Array<Object>} Unique edges array
 */
function removeDuplicateEdges(edges) {
    const seen = new Set();
    const unique = [];
    
    edges.forEach(edge => {
        const key = `${edge.from}->${edge.to}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(edge);
        }
    });
    
    return unique;
}

/**
 * Extract graph structure from Mermaid syntax
 * 
 * This function parses Mermaid flowchart syntax and extracts a graph structure suitable for reachability analysis.
 * It leverages MermaidTraceCalculator.parseMermaid() for parsing and then processes the result to identify:
 * - Task nodes: Regular task/activity nodes
 * - Start/End events: startevent and endevent node types
 * - Exclusive gateways: exclusivegateway node type (XOR splits/joins)
 * - Parallel gateways: parallelgateway node type (AND splits/joins)
 * - Loops: Identified by detecting back edges (cycles)
 * 
 * Graph Structure Extraction Process:
 * 1. Parse Mermaid syntax using MermaidTraceCalculator.parseMermaid()
 * 2. Map nodes to internal format with id, alt_id, and type
 * 3. Map edges and determine edge types based on source/target node types
 * 4. Identify back edges by checking for cycles (paths that create loops)
 * 5. Count gateway types for metadata
 * 6. Return graph structure with nodes, edges, backEdges, and metadata
 * 
 * Edge Types:
 * - 'sequential': Normal sequential flow between tasks
 * - 'xor-branch': Edge from XOR gateway (exclusive split)
 * - 'xor-join': Edge to XOR gateway (exclusive join)
 * - 'and-branch': Edge from AND gateway (parallel split)
 * - 'and-join': Edge to AND gateway (parallel join)
 * - 'start': Edge from start event
 * - 'end': Edge to end event
 * - 'loop-back': Back edge creating a cycle
 * 
 * @param {string} mermaidContent - Mermaid flowchart syntax
 * @returns {Object} Graph structure with the following properties:
 *   - nodes: Array<Object> - Array of node objects with id, alt_id, and type
 *   - edges: Array<Object> - Array of edge objects with from, to, and type
 *   - backEdges: Array<Object> - Array of back edges (loops/cycles)
 *   - metadata: Object - Metadata including hasLoops, hasParallel, hasXOR flags
 * @throws {Error} If Mermaid parsing fails or graph structure cannot be extracted
 * 
 * @example
 * const graphStructure = extractMermaidGraphStructure(mermaidSyntax);
 * console.log(`Extracted ${graphStructure.nodes.length} nodes and ${graphStructure.edges.length} edges`);
 */
function extractMermaidGraphStructure(mermaidContent) {
    try {
        // Use MermaidTraceCalculator's parseMermaid method
        const graph = MermaidTraceCalculator.parseMermaid(mermaidContent);
        
        // Deduplicate nodes by ID (in case parseMermaid creates duplicates)
        const nodeMap = new Map();
        graph.nodes.forEach(node => {
            const nodeId = node.id;
            if (!nodeMap.has(nodeId)) {
                nodeMap.set(nodeId, {
                    id: nodeId,
                    alt_id: nodeId,
                    type: node.type || 'task'
                });
            }
        });
        const nodes = Array.from(nodeMap.values());
        
        // Map edges and ensure they reference valid nodes
        const validNodeIds = new Set(nodes.map(n => n.id));
        const edges = graph.edges
            .filter(edge => validNodeIds.has(edge.from) && validNodeIds.has(edge.to))
            .map(edge => ({
                from: edge.from,
                to: edge.to,
                type: determineMermaidEdgeType(edge, nodes)
            }));
        
        // Remove duplicate edges (same from and to)
        const uniqueEdges = removeDuplicateEdges(edges);
        
        // Identify back edges (loops) by checking for cycles
        const backEdges = identifyMermaidBackEdges(graph, uniqueEdges);
        
        // Count gateway types
        const exclusiveGateways = nodes.filter(n => n.type === 'exclusivegateway').length;
        const parallelGateways = nodes.filter(n => n.type === 'parallelgateway').length;
        
        return { 
            nodes, 
            edges: uniqueEdges,
            backEdges,
            metadata: {
                hasLoops: backEdges.length > 0,
                hasParallel: parallelGateways > 0,
                hasXOR: exclusiveGateways > 0
            }
        };
    } catch (error) {
        console.error('[ReachabilityAnalyzer] Error extracting Mermaid graph structure:', error);
        throw error;
    }
}

/**
 * Determine edge type in Mermaid graph
 * @param {Object} edge - Edge object
 * @param {Array<Object>} nodes - All nodes in graph
 * @returns {string} Edge type
 */
function determineMermaidEdgeType(edge, nodes) {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (fromNode && fromNode.type === 'exclusivegateway') {
        return 'xor-branch';
    }
    if (fromNode && fromNode.type === 'parallelgateway') {
        return 'and-branch';
    }
    if (toNode && toNode.type === 'exclusivegateway') {
        return 'xor-join';
    }
    if (toNode && toNode.type === 'parallelgateway') {
        return 'and-join';
    }
    if (fromNode && fromNode.type === 'startevent') {
        return 'start';
    }
    if (toNode && toNode.type === 'endevent') {
        return 'end';
    }
    
    return 'sequential';
}

/**
 * Identify back edges in Mermaid graph (loops/cycles)
 * @param {Object} graph - Graph object from MermaidTraceCalculator
 * @param {Array<Object>} edges - Edges array
 * @returns {Array<Object>} Array of back edges
 */
function identifyMermaidBackEdges(graph, edges) {
    const backEdges = [];
    const adjacencyList = graph.adjacencyList;
    
    // Check each edge to see if it creates a cycle
    edges.forEach(edge => {
        // Check if there's a path from 'to' back to 'from' (indicating a cycle)
        if (hasPath(graph, edge.to, edge.from)) {
            backEdges.push({ ...edge, type: 'loop-back' });
        }
    });
    
    return backEdges;
}

/**
 * Check if there's a path from source to target (excluding direct edge)
 * Uses iterative BFS to avoid stack overflow on deep graphs
 * @param {Object} graph - Graph object
 * @param {string} source - Source node ID
 * @param {string} target - Target node ID
 * @param {Set<string>} visited - Visited nodes (initial visited set)
 * @param {number} maxDepth - Maximum search depth
 * @returns {boolean} True if path exists
 */
function hasPath(graph, source, target, visited = new Set(), maxDepth = 50) {
    // Early return: if source equals target and we've already visited at least one node, it's a cycle
    if (source === target && visited.size > 0) {
        return true; // Found a cycle (path exists and we've visited at least one node)
    }
    if (maxDepth <= 0) {
        return false;
    }
    
    // Use BFS with explicit queue to avoid recursion
    const queue = [];
    const currentVisited = new Set(visited);
    
    // Initialize: if source is already visited, no path possible
    if (currentVisited.has(source)) {
        return false;
    }
    
    // Start BFS from source
    queue.push({ nodeId: source, depth: 0 });
    currentVisited.add(source);
    
    while (queue.length > 0) {
        const { nodeId, depth } = queue.shift();
        
        // Check if we found the target and have visited at least one node (cycle detection)
        if (nodeId === target && depth > 0) {
            return true;
        }
        
        // Skip if max depth reached
        if (depth >= maxDepth) {
            continue;
        }
        
        // Get neighbors and process them
        const neighbors = graph.adjacencyList.get(nodeId) || [];
        for (const edge of neighbors) {
            const neighborId = edge.to;
            
            // Check for cycle: if neighbor is target and we've visited at least one node
            if (neighborId === target && depth >= 0) {
                return true;
            }
            
            // Skip if already visited or would exceed max depth
            if (!currentVisited.has(neighborId) && depth + 1 < maxDepth) {
                currentVisited.add(neighborId);
                queue.push({ nodeId: neighborId, depth: depth + 1 });
            }
        }
    }
    
    return false;
}

/**
 * Find start nodes in graph structure
 * 
 * Identifies start nodes based on graph format:
 * - Mermaid: Nodes of type 'startevent'
 * - CPEE: Nodes with no incoming edges (first nodes in root description)
 * 
 * Fallback Strategy:
 * - If no start events found in Mermaid, finds nodes with no incoming edges
 * - If no nodes with no incoming edges found in CPEE, returns all nodes (disconnected graph)
 * 
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @param {string} format - Graph format ('cpee' or 'mermaid')
 * @returns {Array<string>} Array of start node IDs (may be empty if no start nodes found)
 */
function findStartNodes(graphStructure, format) {
    const { nodes, edges } = graphStructure;
    
    if (format === 'mermaid') {
        // In Mermaid, start nodes are nodes of type 'startevent'
        const startEvents = nodes
            .filter(node => node.type === 'startevent')
            .map(node => node.id || node.alt_id)
            .filter(Boolean);
        
        // If no start events found, find nodes with no incoming edges
        if (startEvents.length === 0) {
            const hasIncoming = new Set(edges.map(e => e.to));
            return nodes
                .filter(node => {
                    const nodeId = node.id || node.alt_id;
                    return nodeId && !hasIncoming.has(nodeId);
                })
                .map(node => node.id || node.alt_id)
                .filter(Boolean);
        }
        
        return startEvents;
    } else if (format === 'cpee') {
        // In CPEE, start nodes are nodes with no incoming edges
        // (first nodes in root description or nodes not reached by any edge)
        const hasIncoming = new Set(edges.map(e => e.to));
        const startNodes = nodes
            .filter(node => {
                const nodeId = node.id || node.alt_id;
                return nodeId && !hasIncoming.has(nodeId);
            })
            .map(node => node.id || node.alt_id)
            .filter(Boolean);
        
        // If no nodes found, return all nodes (edge case: disconnected graph)
        return startNodes.length > 0 ? startNodes : nodes.map(n => n.id || n.alt_id).filter(Boolean);
    }
    
    return [];
}

/**
 * Find end nodes in graph structure
 * 
 * Identifies end nodes based on graph format:
 * - Mermaid: Nodes of type 'endevent'
 * - CPEE: Nodes with no outgoing edges (last nodes in description or terminal nodes)
 * 
 * Fallback Strategy:
 * - If no end events found in Mermaid, finds nodes with no outgoing edges
 * - If no nodes with no outgoing edges found in CPEE, returns all nodes (disconnected graph)
 * 
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @param {string} format - Graph format ('cpee' or 'mermaid')
 * @returns {Array<string>} Array of end node IDs (may be empty if no end nodes found)
 */
function findEndNodes(graphStructure, format) {
    const { nodes, edges } = graphStructure;
    
    if (format === 'mermaid') {
        // In Mermaid, end nodes are nodes of type 'endevent'
        const endEvents = nodes
            .filter(node => node.type === 'endevent')
            .map(node => node.id || node.alt_id)
            .filter(Boolean);
        
        // If no end events found, find nodes with no outgoing edges
        if (endEvents.length === 0) {
            const hasOutgoing = new Set(edges.map(e => e.from));
            return nodes
                .filter(node => {
                    const nodeId = node.id || node.alt_id;
                    return nodeId && !hasOutgoing.has(nodeId);
                })
                .map(node => node.id || node.alt_id)
                .filter(Boolean);
        }
        
        return endEvents;
    } else if (format === 'cpee') {
        // In CPEE, end nodes are nodes with no outgoing edges
        // (last nodes in description or nodes that don't connect to anything)
        const hasOutgoing = new Set(edges.map(e => e.from));
        const endNodes = nodes
            .filter(node => {
                const nodeId = node.id || node.alt_id;
                return nodeId && !hasOutgoing.has(nodeId);
            })
            .map(node => node.id || node.alt_id)
            .filter(Boolean);
        
        // If no nodes found, return all nodes (edge case: disconnected graph)
        return endNodes.length > 0 ? endNodes : nodes.map(n => n.id || n.alt_id).filter(Boolean);
    }
    
    return [];
}

/**
 * Find strongly connected components using Kosaraju's algorithm
 * 
 * Kosaraju's algorithm finds all strongly connected components (SCCs) in a directed graph.
 * An SCC is a maximal set of nodes where every node can reach every other node in the set.
 * 
 * Algorithm (Kosaraju's Two-Pass DFS):
 * 1. First Pass: Perform DFS on original graph to get finishing times (topological order)
 * 2. Second Pass: Perform DFS on reverse graph in reverse finish order
 * 3. Each DFS tree in step 2 is an SCC
 * 
 * Performance Characteristics:
 * - Time Complexity: O(V + E) where V is vertices and E is edges
 * - Space Complexity: O(V + E) for adjacency lists and visited sets
 * - Efficient for sparse graphs (typical workflow graphs)
 * 
 * Component Classification:
 * - Cyclic Components: SCCs with more than one node (contain cycles)
 * - Acyclic Components: SCCs with exactly one node (no cycles)
 * 
 * Uses:
 * - Cycle detection in workflow graphs
 * - Identifying nodes involved in loops
 * - Understanding graph structure and connectivity
 * 
 * Reference: Based on standard Kosaraju's algorithm for SCC detection
 * 
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @param {TimeoutChecker} timeoutChecker - Timeout checker instance to prevent infinite loops
 * @returns {Object} Comprehensive SCC information with the following properties:
 *   - components: Array<Array<string>> - Array of SCCs, each is an array of node IDs
 *   - nodeToComponent: Map<string, number> - Map from node ID to component index
 *   - nodeClassification: Map<string, Object> - Classification of each node (cyclic/acyclic)
 *   - nodesInCycles: Array<string> - Node IDs that are part of cycles
 *   - acyclicNodes: Array<string> - Node IDs that are not part of cycles
 *   - cyclicComponents: Array<Object> - Cyclic SCCs with metadata
 *   - acyclicComponents: Array<Object> - Acyclic SCCs with metadata
 *   - statistics: Object - Statistics including counts, sizes, and coverage percentages
 * 
 * @example
 * const sccInfo = findStronglyConnectedComponents(graphStructure, timeoutChecker);
 * console.log(`Found ${sccInfo.components.length} SCCs`);
 * console.log(`${sccInfo.nodesInCycles.length} nodes are in cycles`);
 */
function findStronglyConnectedComponents(graphStructure, timeoutChecker) {
    const { nodes, edges } = graphStructure;
    
    if (nodes.length === 0) {
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
    
    // Build adjacency lists (forward and reverse)
    const forwardAdj = new Map();
    const reverseAdj = new Map();
    
    nodes.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (nodeId) {
            forwardAdj.set(nodeId, []);
            reverseAdj.set(nodeId, []);
        }
    });
    
    edges.forEach(edge => {
        if (forwardAdj.has(edge.from) && forwardAdj.has(edge.to)) {
            forwardAdj.get(edge.from).push(edge.to);
            reverseAdj.get(edge.to).push(edge.from);
        }
    });
    
    // Step 1: First DFS to get finishing times (on original graph)
    // Uses iterative DFS to avoid stack overflow
    const visited = new Set();
    const finishOrder = [];
    
    nodes.forEach(node => {
        timeoutChecker.check();
        const nodeId = node.id || node.alt_id;
        if (!nodeId || visited.has(nodeId)) {
            return;
        }
        
        // Iterative DFS using explicit stack
        // Stack entries: { nodeId, neighborIndex, neighbors }
        // neighborIndex tracks which neighbor we're processing
        const stack = [];
        
        stack.push({ nodeId, neighborIndex: 0, neighbors: forwardAdj.get(nodeId) || [] });
        visited.add(nodeId);
        
        while (stack.length > 0) {
            timeoutChecker.check();
            
            const frame = stack[stack.length - 1];
            const { nodeId: currentNodeId, neighborIndex, neighbors } = frame;
            
            // Check if we've processed all neighbors
            if (neighborIndex >= neighbors.length) {
                // All neighbors processed, add to finish order and pop
                finishOrder.push(currentNodeId);
                stack.pop();
                continue;
            }
            
            // Process next neighbor
            const neighborId = neighbors[neighborIndex];
            frame.neighborIndex++; // Move to next neighbor
            
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                stack.push({ 
                    nodeId: neighborId, 
                    neighborIndex: 0, 
                    neighbors: forwardAdj.get(neighborId) || [] 
                });
            }
        }
    });
    
    // Step 2: Second DFS on reverse graph (in reverse finish order)
    // Uses iterative DFS to avoid stack overflow
    visited.clear();
    const components = [];
    const nodeToComponent = new Map();
    
    // Process in reverse finish order
    for (let i = finishOrder.length - 1; i >= 0; i--) {
        timeoutChecker.check();
        const nodeId = finishOrder[i];
        if (visited.has(nodeId)) {
            continue;
        }
        
        const component = [];
        const componentIndex = components.length;
        
        // Iterative DFS using explicit stack
        // Stack entries: { nodeId, neighborIndex, neighbors }
        const stack = [];
        stack.push({ nodeId, neighborIndex: 0, neighbors: reverseAdj.get(nodeId) || [] });
        visited.add(nodeId);
        component.push(nodeId);
        nodeToComponent.set(nodeId, componentIndex);
        
        while (stack.length > 0) {
            timeoutChecker.check();
            
            const frame = stack[stack.length - 1];
            const { neighborIndex, neighbors } = frame;
            
            // Check if we've processed all neighbors
            if (neighborIndex >= neighbors.length) {
                // All neighbors processed, pop
                stack.pop();
                continue;
            }
            
            // Process next neighbor
            const neighborId = neighbors[neighborIndex];
            frame.neighborIndex++; // Move to next neighbor
            
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
        
        if (component.length > 0) {
            components.push(component);
        }
    }
    
    // Classify components: cyclic (size > 1) vs acyclic (size = 1)
    const cyclicComponents = [];
    const acyclicComponents = [];
    const nodesInCycles = [];
    const acyclicNodes = [];
    
    components.forEach((component, index) => {
        if (component.length > 1) {
            // SCC with more than one node = cycle
            cyclicComponents.push({
                index: index,
                nodes: component,
                size: component.length,
                type: 'cyclic'
            });
            nodesInCycles.push(...component);
        } else {
            // Single node SCC = acyclic (no cycle)
            acyclicComponents.push({
                index: index,
                nodes: component,
                size: 1,
                type: 'acyclic'
            });
            acyclicNodes.push(...component);
        }
    });
    
    // Calculate statistics
    const totalComponents = components.length;
    const cyclicComponentCount = cyclicComponents.length;
    const acyclicComponentCount = acyclicComponents.length;
    const nodesInCyclesCount = nodesInCycles.length;
    const acyclicNodesCount = acyclicNodes.length;
    
    // Find largest component
    const largestComponentSize = components.length > 0
        ? Math.max(...components.map(c => c.length))
        : 0;
    
    // Calculate average component size
    const totalNodesInComponents = components.reduce((sum, c) => sum + c.length, 0);
    const averageComponentSize = totalComponents > 0
        ? totalNodesInComponents / totalComponents
        : 0;
    
    // Build node classification map (for easy lookup)
    const nodeClassification = new Map();
    nodes.forEach(node => {
        const nodeId = node.id || node.alt_id;
        if (nodeId) {
            const componentIndex = nodeToComponent.get(nodeId);
            const component = components[componentIndex];
            const isInCycle = component && component.length > 1;
            
            nodeClassification.set(nodeId, {
                componentIndex: componentIndex,
                componentSize: component ? component.length : 0,
                isInCycle: isInCycle,
                isAcyclic: !isInCycle
            });
        }
    });
    
    const statistics = {
        totalComponents: totalComponents,
        cyclicComponentCount: cyclicComponentCount,
        acyclicComponentCount: acyclicComponentCount,
        nodesInCyclesCount: nodesInCyclesCount,
        acyclicNodesCount: acyclicNodesCount,
        largestComponentSize: largestComponentSize,
        averageComponentSize: averageComponentSize,
        cycleCoverage: nodes.length > 0 ? (nodesInCyclesCount / nodes.length) * 100 : 0,
        acyclicCoverage: nodes.length > 0 ? (acyclicNodesCount / nodes.length) * 100 : 0
    };
    
    return {
        components: components,
        nodeToComponent: nodeToComponent,
        nodeClassification: nodeClassification,
        nodesInCycles: nodesInCycles,
        acyclicNodes: acyclicNodes,
        cyclicComponents: cyclicComponents,
        acyclicComponents: acyclicComponents,
        statistics: statistics
    };
}

/**
 * Compute transitive closure of graph
 * 
 * The transitive closure R is a reachability matrix where R[i][j] = true
 * if node j is reachable from node i. It represents all possible reachability
 * relationships in the graph.
 * 
 * Algorithm:
 * - For each node, perform DFS to find all reachable nodes
 * - Store results in sparse matrix representation: Map<sourceNodeId, Set<targetNodeId>>
 * - For small graphs (<=100 nodes), also build full matrix for O(1) lookup
 * 
 * Performance Characteristics:
 * - Time Complexity: O(V * (V + E)) where V is vertices and E is edges
 * - Space Complexity: O(V^2) worst case, but uses sparse representation for efficiency
 * - For large graphs (>100 nodes), only sparse matrix is built to save memory
 * - Cached results can be reused for repeated queries 
 * 
 * Limitations:
 * - Expensive for large graphs (consider timeout and maxDepth)
 * - Memory usage grows with graph size (sparse representation helps)
 * - Not computed by default (set computeTransitiveClosure: true in options)
 * 
 * Uses:
 * - Fast reachability queries: isReachable(from, to) in O(1) time
 * - Complete reachability analysis
 * - Path planning and optimization
 * 
 * Reference: Based on Reps (1998) transitive closure computation
 * 
 * @param {Map<string, Array<string>>} forwardAdj - Forward adjacency list
 * @param {Array<Object>} allNodes - All nodes in the graph
 * @param {TimeoutChecker} timeoutChecker - Timeout checker instance to prevent infinite loops
 * @param {number} maxDepth - Maximum traversal depth to prevent excessive recursion
 * @returns {Object} Transitive closure with the following properties:
 *   - matrix: Object|null - Full matrix representation (null for large graphs)
 *   - sparseMatrix: Map<string, Set<string>> - Sparse representation: Map<source, Set<target>>
 *   - nodeIndex: Map<string, number> - Map from node ID to index for efficient lookup
 *   - statistics: Object - Statistics including total nodes, reachable pairs, density
 * 
 * @example
 * const transitiveClosure = computeTransitiveClosureMatrix(forwardAdj, allNodes, timeoutChecker, maxDepth);
 * const isReachable = transitiveClosure.sparseMatrix.get('nodeA')?.has('nodeB');
 */
function computeTransitiveClosureMatrix(forwardAdj, allNodes, timeoutChecker, maxDepth) {
    const nodeIds = allNodes
        .map(node => node.id || node.alt_id)
        .filter(Boolean);
    
    if (nodeIds.length === 0) {
        return {
            matrix: {},
            sparseMatrix: new Map(),
            nodeIndex: new Map(),
            statistics: {
                totalNodes: 0,
                reachablePairs: 0,
                density: 0
            }
        };
    }
    
    // Build node index for efficient lookup
    const nodeIndex = new Map();
    nodeIds.forEach((nodeId, index) => {
        nodeIndex.set(nodeId, index);
    });
    
    // Use sparse representation: Map<sourceNodeId, Set<targetNodeId>>
    // This is more memory-efficient than a full matrix for sparse graphs
    const sparseMatrix = new Map();
    let totalReachablePairs = 0;
    
    // For each node, perform DFS to find all reachable nodes
    nodeIds.forEach(sourceNodeId => {
        timeoutChecker.check();
        
        const reachable = new Set();
        const visited = new Set();
        
        // Iterative DFS from source node using explicit stack to avoid stack overflow
        const stack = [];
        stack.push({ nodeId: sourceNodeId, depth: 0 });
        
        while (stack.length > 0) {
            timeoutChecker.check();
            
            const { nodeId, depth } = stack.pop();
            
            // Skip if already visited or max depth exceeded
            if (depth >= maxDepth || visited.has(nodeId)) {
                continue;
            }
            
            // Mark as visited and add to reachable set
            visited.add(nodeId);
            reachable.add(nodeId);
            
            // Get neighbors and push them onto stack (in reverse order to maintain DFS order)
            const neighbors = forwardAdj.get(nodeId) || [];
            // Push in reverse order so we process in original order
            for (let i = neighbors.length - 1; i >= 0; i--) {
                const neighborId = neighbors[i];
                if (!visited.has(neighborId) && depth + 1 < maxDepth) {
                    stack.push({ nodeId: neighborId, depth: depth + 1 });
                }
            }
        }
        
        sparseMatrix.set(sourceNodeId, reachable);
        totalReachablePairs += reachable.size;
    });
    
    // Calculate density (percentage of possible pairs that are reachable)
    const totalPossiblePairs = nodeIds.length * nodeIds.length;
    const density = totalPossiblePairs > 0 
        ? (totalReachablePairs / totalPossiblePairs) * 100 
        : 0;
    
    // Build full matrix representation (optional, for compatibility)
    // Only build if graph is small enough (less than 100 nodes)
    let matrix = null;
    if (nodeIds.length <= 100) {
        matrix = {};
        nodeIds.forEach(sourceId => {
            matrix[sourceId] = {};
            const reachable = sparseMatrix.get(sourceId) || new Set();
            nodeIds.forEach(targetId => {
                matrix[sourceId][targetId] = reachable.has(targetId);
            });
        });
    }
    
    const statistics = {
        totalNodes: nodeIds.length,
        reachablePairs: totalReachablePairs,
        density: density,
        representation: nodeIds.length > 100 ? 'sparse' : 'full',
        averageReachablePerNode: nodeIds.length > 0 
            ? totalReachablePairs / nodeIds.length 
            : 0
    };
    
    return {
        matrix: matrix, // Full matrix (null if graph too large)
        sparseMatrix: sparseMatrix, // Sparse representation: Map<source, Set<target>>
        nodeIndex: nodeIndex, // Map<nodeId, index> for efficient lookup
        statistics: statistics
    };
}

/**
 * Query transitive closure for reachability with memoization 
 * Fast O(1) lookup if transitive closure was computed
 * Uses memoization cache for repeated queries
 * 
 * @param {Object} transitiveClosure - Transitive closure object
 * @param {string} fromNodeId - Source node ID
 * @param {string} toNodeId - Target node ID
 * @returns {boolean} True if toNodeId is reachable from fromNodeId
 */
export function isReachable(transitiveClosure, fromNodeId, toNodeId) {
    if (!transitiveClosure || !transitiveClosure.sparseMatrix) {
        return false;
    }
    
    // Check memoization cache first 
    const queryKey = `${fromNodeId}->${toNodeId}`;
    if (reachabilityQueryCache.has(queryKey)) {
        return reachabilityQueryCache.get(queryKey);
    }
    
    // Clean cache periodically (every N queries to avoid performance overhead)
    reachabilityQueryCacheCleanCounter++;
    if (reachabilityQueryCacheCleanCounter >= REACHABILITY_QUERY_CACHE_CLEAN_INTERVAL) {
        cleanReachabilityQueryCache();
        reachabilityQueryCacheCleanCounter = 0;
    }
    
    // Compute result
    const reachable = transitiveClosure.sparseMatrix.get(fromNodeId);
    const result = reachable ? reachable.has(toNodeId) : false;
    
    // Cache the result
    reachabilityQueryCache.set(queryKey, result);
    
    return result;
}

/**
 * Get all nodes reachable from a given node using transitive closure
 * 
 * @param {Object} transitiveClosure - Transitive closure object
 * @param {string} fromNodeId - Source node ID
 * @returns {Array<string>} Array of reachable node IDs
 */
export function getReachableNodes(transitiveClosure, fromNodeId) {
    if (!transitiveClosure || !transitiveClosure.sparseMatrix) {
        return [];
    }
    
    const reachable = transitiveClosure.sparseMatrix.get(fromNodeId);
    return reachable ? Array.from(reachable) : [];
}

/**
 * Create error result object
 * @param {string} message - Error message
 * @returns {Object} Error result object
 */
function createErrorResult(message) {
    return {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
    };
}
