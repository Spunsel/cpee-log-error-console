/**
 * Reachability Analyzer
 * 
 * Hybrid trace-based + graph-based reachability analysis.
 * 
 * Uses graph structure (BFS on adjacency lists) to determine:
 * - Forward reachability: which tasks can be reached from start nodes
 * - Backward reachability: which tasks can reach end nodes
 * 
 * Trace data supplements graph analysis with information about which
 * execution paths are actually exercised.
 * 
 * Task classification:
 * - Viable: forward reachable AND backward reachable
 * - Dead-end: forward reachable but NOT backward reachable
 * - Unreachable: NOT forward reachable (regardless of backward)
 */

/**
 * BFS over an adjacency map starting from a set of source node IDs.
 * Returns the set of all reachable node IDs (including the sources).
 */
function bfsReachable(adjacency, sourceIds) {
    const visited = new Set();
    const queue = [...sourceIds];
    for (const id of queue) { visited.add(id); }

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = adjacency.get(current) || [];
        for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push(neighborId);
            }
        }
    }
    return visited;
}

/**
 * Build forward and reverse adjacency maps from graph edges.
 * Maps nodeId → [neighborId, ...] (plain IDs, no edge metadata).
 */
function buildAdjacencyMaps(edges) {
    const forward = new Map();
    const reverse = new Map();
    for (const edge of edges) {
        if (!forward.has(edge.from)) {
            forward.set(edge.from, []);
        }
        if (!reverse.has(edge.to)) {
            reverse.set(edge.to, []);
        }
        forward.get(edge.from).push(edge.to);
        reverse.get(edge.to).push(edge.from);
    }
    return { forward, reverse };
}

/**
 * Perform graph-based reachability analysis on a Mermaid graph.
 * Parses the graph to get nodes/edges, then runs BFS in both directions.
 */
function analyzeGraphReachability(graphContent, MermaidTraceCalculator) {
    const graph = MermaidTraceCalculator.parseMermaid(graphContent);
    if (!graph || graph.nodes.length === 0) {
        return null;
    }

    const startNodeIds = graph.nodes.filter(n => n.type === 'startevent').map(n => n.id);
    const endNodeIds = graph.nodes.filter(n => n.type === 'endevent').map(n => n.id);
    if (startNodeIds.length === 0 || endNodeIds.length === 0) {
        return null;
    }

    const { forward, reverse } = buildAdjacencyMaps(graph.edges);

    const forwardReachableAll = bfsReachable(forward, startNodeIds);
    const backwardReachableAll = bfsReachable(reverse, endNodeIds);

    const taskNodes = graph.nodes.filter(
        n => n.type === 'task' || n.type === 'subprocess' || n.type.endsWith('task')
    );

    const forwardReachableTasks = [];
    const forwardUnreachableTasks = [];
    const backwardReachableTasks = [];
    const backwardUnreachableTasks = [];
    const viableTasks = [];
    const deadEndTasks = [];
    const unreachableTasks = [];

    for (const node of taskNodes) {
        const fwd = forwardReachableAll.has(node.id);
        const bwd = backwardReachableAll.has(node.id);

        if (fwd) {
            forwardReachableTasks.push(node.id);
        } else {
            forwardUnreachableTasks.push(node.id);
        }

        if (bwd) {
            backwardReachableTasks.push(node.id);
        } else {
            backwardUnreachableTasks.push(node.id);
        }

        if (fwd && bwd) {
            viableTasks.push(node.id);
        } else if (fwd && !bwd) {
            deadEndTasks.push(node.id);
        } else {
            unreachableTasks.push(node.id);
        }
    }

    return {
        taskNodes,
        startNodeIds,
        endNodeIds,
        forwardReachableTasks,
        forwardUnreachableTasks,
        backwardReachableTasks,
        backwardUnreachableTasks,
        viableTasks,
        deadEndTasks,
        unreachableTasks
    };
}

/**
 * Analyze reachability using graph structure with trace data as supplement.
 * 
 * For Mermaid graphs: uses BFS on the graph for accurate forward/backward reachability.
 * For CPEE graphs or when graph parsing fails: falls back to trace-based analysis.
 * 
 * @param {Array<Trace>} traces - Calculated execution traces
 * @param {Array<Object>} allTasks - All tasks from the graph (with id/alt_id properties)
 * @param {Object} options - Analysis options
 * @param {string} options.format - Graph format ('cpee' or 'mermaid')
 * @param {string} [options.graphContent] - Raw graph content string for graph-based analysis
 * @param {Object} [options.MermaidTraceCalculator] - MermaidTraceCalculator class reference
 * @returns {Object} Reachability result
 */
export function analyzeReachabilityFromTraces(traces, allTasks, options = {}) {
    const { format = 'unknown', graphContent, MermaidTraceCalculator: MTC } = options;
    const startTime = Date.now();

    try {
        // Attempt graph-based analysis for Mermaid graphs
        if (format === 'mermaid' && graphContent && MTC) {
            const graphResult = analyzeGraphReachability(graphContent, MTC);
            if (graphResult) {
                return buildResult(graphResult, traces, format, startTime);
            }
        }

        // Fallback: trace-based analysis (original logic)
        return traceBasedAnalysis(traces, allTasks, format, startTime);

    } catch (error) {
        console.error('[ReachabilityAnalyzer] Error during analysis:', error);
        return {
            success: false,
            format,
            error: `Reachability analysis failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            analysisMethod: 'trace-based'
        };
    }
}

/**
 * Build the result object from graph-based reachability data.
 */
function buildResult(gr, traces, format, startTime) {
    const totalTasks = gr.taskNodes.length;
    const viableCount = gr.viableTasks.length;
    const deadEndCount = gr.deadEndTasks.length;
    const unreachableCount = gr.unreachableTasks.length;

    const fwdCount = gr.forwardReachableTasks.length;
    const fwdCoverage = totalTasks > 0 ? fwdCount / totalTasks : 1;
    const bwdCount = gr.backwardReachableTasks.length;
    const bwdCoverage = totalTasks > 0 ? bwdCount / totalTasks : 1;

    const warnings = [];
    if (deadEndCount > 0) {
        warnings.push(`${deadEndCount} task(s) reachable from start but cannot reach end: ${gr.deadEndTasks.join(', ')}`);
    }
    if (unreachableCount > 0) {
        warnings.push(`${unreachableCount} task(s) not reachable from start: ${gr.unreachableTasks.join(', ')}`);
    }

    return {
        success: true,
        format,
        timestamp: new Date().toISOString(),
        analysisMethod: 'graph-based',

        startNodes: gr.startNodeIds,
        endNodes: gr.endNodeIds,
        totalNodes: totalTasks,
        traceCount: traces?.length || 0,

        forwardReachability: {
            reachableNodes: gr.forwardReachableTasks,
            unreachableNodes: gr.forwardUnreachableTasks,
            count: fwdCount,
            coverage: fwdCoverage,
            statistics: {
                reachableCount: fwdCount,
                unreachableCount: gr.forwardUnreachableTasks.length,
                maxDepth: 0,
                nodesInCycles: [],
                cycleCount: 0,
                averageDepth: 0
            }
        },

        backwardReachability: {
            reachableNodes: gr.backwardReachableTasks,
            unreachableNodes: gr.backwardUnreachableTasks,
            count: bwdCount,
            coverage: bwdCoverage,
            statistics: {
                reachableCount: bwdCount,
                unreachableCount: gr.backwardUnreachableTasks.length,
                maxDepth: 0,
                nodesInCycles: [],
                cycleCount: 0,
                averageDepth: 0
            }
        },

        bidirectionalReachability: {
            deadEndNodes: gr.deadEndTasks,
            unreachableNodes: gr.unreachableTasks,
            statistics: {
                reachabilityCoverage: totalTasks > 0 ? viableCount / totalTasks : 1
            }
        },

        nodeClassification: {
            viableNodes: gr.viableTasks,
            deadEndNodes: gr.deadEndTasks,
            unreachableNodes: gr.unreachableTasks,
            viableCount,
            deadEndCount,
            unreachableCount,
            statistics: {
                totalNodes: totalTasks,
                viableCount,
                deadEndCount,
                unreachableCount,
                viableCoverage: totalTasks > 0 ? viableCount / totalTasks : 1,
                deadEndCoverage: totalTasks > 0 ? deadEndCount / totalTasks : 0,
                unreachableCoverage: totalTasks > 0 ? unreachableCount / totalTasks : 0
            }
        },

        warnings,

        performance: {
            analysisTimeMs: Date.now() - startTime,
            tracesAnalyzed: traces?.length || 0,
            tasksInGraph: totalTasks,
            totalTasksInGraph: totalTasks
        },

        taskDetails: {
            inTraces: gr.viableTasks.map(id => ({ id })),
            notInTraces: [...gr.deadEndTasks, ...gr.unreachableTasks].map(id => ({ id }))
        }
    };
}

/**
 * Fallback: purely trace-based reachability (for CPEE or when graph parsing fails).
 * If a task appears in any trace it is considered viable. Otherwise unreachable.
 */
function traceBasedAnalysis(traces, allTasks, format, startTime) {
    const tasksInTraces = new Set();
    const taskDetailsMap = new Map();

    if (traces && Array.isArray(traces)) {
        for (const trace of traces) {
            const path = trace?.path || trace;
            if (Array.isArray(path)) {
                for (const step of path) {
                    const taskId = step?.id || step?.alt_id;
                    if (taskId) {
                        tasksInTraces.add(taskId);
                        if (!taskDetailsMap.has(taskId)) {
                            taskDetailsMap.set(taskId, {
                                id: step.id,
                                alt_id: step.alt_id,
                                task: step.task || step.label
                            });
                        }
                    }
                }
            }
        }
    }

    const allTaskIds = new Set();
    const allTaskDetailsMap = new Map();

    if (allTasks && Array.isArray(allTasks)) {
        for (const task of allTasks) {
            const taskId = task?.id || task?.alt_id;
            if (taskId) {
                allTaskIds.add(taskId);
                allTaskDetailsMap.set(taskId, task);
            }
        }
    }

    const viableTaskIds = [...tasksInTraces];
    const unreachableTaskIds = [...allTaskIds].filter(id => !tasksInTraces.has(id));

    const totalTasks = allTaskIds.size;
    const viableCount = viableTaskIds.length;
    const deadEndCount = unreachableTaskIds.length;

    const forwardCoverage = totalTasks > 0 ? (viableCount / totalTasks) : 1;
    const backwardCoverage = forwardCoverage;

    return {
        success: true,
        format,
        timestamp: new Date().toISOString(),
        analysisMethod: 'trace-based',

        startNodes: [],
        endNodes: [],
        totalNodes: totalTasks,
        traceCount: traces?.length || 0,

        forwardReachability: {
            reachableNodes: viableTaskIds,
            unreachableNodes: unreachableTaskIds,
            count: viableCount,
            coverage: forwardCoverage,
            statistics: {
                reachableCount: viableCount,
                unreachableCount: deadEndCount,
                maxDepth: 0,
                nodesInCycles: [],
                cycleCount: 0,
                averageDepth: 0
            }
        },

        backwardReachability: {
            reachableNodes: viableTaskIds,
            unreachableNodes: unreachableTaskIds,
            count: viableCount,
            coverage: backwardCoverage,
            statistics: {
                reachableCount: viableCount,
                unreachableCount: deadEndCount,
                maxDepth: 0,
                nodesInCycles: [],
                cycleCount: 0,
                averageDepth: 0
            }
        },

        bidirectionalReachability: {
            deadEndNodes: [],
            unreachableNodes: unreachableTaskIds,
            statistics: {
                reachabilityCoverage: forwardCoverage
            }
        },

        nodeClassification: {
            viableNodes: viableTaskIds,
            deadEndNodes: unreachableTaskIds,
            unreachableNodes: [],
            viableCount,
            deadEndCount,
            unreachableCount: 0,
            statistics: {
                totalNodes: totalTasks,
                viableCount,
                deadEndCount,
                unreachableCount: 0,
                viableCoverage: forwardCoverage,
                deadEndCoverage: totalTasks > 0 ? (deadEndCount / totalTasks) : 0,
                unreachableCoverage: 0
            }
        },

        warnings: unreachableTaskIds.length > 0
            ? [`${unreachableTaskIds.length} task(s) not found in any calculated trace: ${unreachableTaskIds.join(', ')}`]
            : [],

        performance: {
            analysisTimeMs: Date.now() - startTime,
            tracesAnalyzed: traces?.length || 0,
            tasksInTraces: tasksInTraces.size,
            totalTasksInGraph: totalTasks
        },

        taskDetails: {
            inTraces: viableTaskIds.map(id => taskDetailsMap.get(id) || { id }),
            notInTraces: unreachableTaskIds.map(id => allTaskDetailsMap.get(id) || { id })
        }
    };
}
