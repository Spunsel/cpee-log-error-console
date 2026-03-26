/**
 * Reachability Analyzer
 * 
 * Simplified trace-based reachability analysis.
 * Derives reachability directly from calculated execution traces.
 * 
 * Key insight: If a task appears in ANY trace, it's automatically:
 * - Forward reachable (traces start from the beginning)
 * - Backward reachable (traces end at completion)
 * - Therefore: a USEFUL task
 */

/**
 * Analyze reachability based on calculated traces.
 * 
 * This approach is simpler and more accurate than static graph analysis because:
 * - If a task appears in ANY trace, it's automatically forward AND backward reachable
 * - Handles complex semantics (cancel, loops) naturally since trace calculation already does
 * - Single source of truth - uses the same logic as trace generation
 * 
 * @param {Array<Trace>} traces - Calculated execution traces
 * @param {Array<Object>} allTasks - All tasks from the graph (with id/alt_id properties)
 * @param {Object} options - Analysis options
 * @param {string} options.format - Graph format ('cpee' or 'mermaid')
 * @returns {Object} Reachability result
 */
export function analyzeReachabilityFromTraces(traces, allTasks, options = {}) {
    const { format = 'unknown' } = options;
    const startTime = Date.now();
    
    try {
        // Collect all unique task IDs that appear in any trace
        const tasksInTraces = new Set();
        const taskDetailsMap = new Map();
        
        if (traces && Array.isArray(traces)) {
            for (const trace of traces) {
                // Handle both Trace objects with .path and plain arrays
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
        
        // Collect all task IDs from the graph
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
        
        // Tasks in traces are fully reachable (start → task → end)
        const usefulTaskIds = [...tasksInTraces];
        
        // Tasks NOT in any trace are unreachable
        const unreachableTaskIds = [...allTaskIds].filter(id => !tasksInTraces.has(id));
        
        const totalTasks = allTaskIds.size;
        const usefulCount = usefulTaskIds.length;
        const deadEndCount = unreachableTaskIds.length;
        
        const forwardCoverage = totalTasks > 0 ? (usefulCount / totalTasks) * 100 : 100;
        const backwardCoverage = forwardCoverage;
        
        const elapsed = Date.now() - startTime;
        
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
                reachableNodes: usefulTaskIds,
                unreachableNodes: unreachableTaskIds,
                count: usefulCount,
                coverage: forwardCoverage,
                statistics: {
                    reachableCount: usefulCount,
                    unreachableCount: deadEndCount,
                    maxDepth: 0,
                    nodesInCycles: [],
                    cycleCount: 0,
                    averageDepth: 0
                }
            },
            
            backwardReachability: {
                reachableNodes: usefulTaskIds,
                unreachableNodes: unreachableTaskIds,
                count: usefulCount,
                coverage: backwardCoverage,
                statistics: {
                    reachableCount: usefulCount,
                    unreachableCount: deadEndCount,
                    maxDepth: 0,
                    nodesInCycles: [],
                    cycleCount: 0,
                    averageDepth: 0
                }
            },
            
            nodeClassification: {
                usefulNodes: usefulTaskIds,
                deadEndNodes: unreachableTaskIds,
                unreachableNodes: [],
                usefulCount: usefulCount,
                deadEndCount: deadEndCount,
                unreachableCount: 0,
                statistics: {
                    totalNodes: totalTasks,
                    usefulCount: usefulCount,
                    deadEndCount: deadEndCount,
                    unreachableCount: 0,
                    usefulCoverage: forwardCoverage,
                    deadEndCoverage: totalTasks > 0 ? (deadEndCount / totalTasks) * 100 : 0,
                    unreachableCoverage: 0
                }
            },
            
            warnings: unreachableTaskIds.length > 0 
                ? [`${unreachableTaskIds.length} task(s) not found in any calculated trace: ${unreachableTaskIds.join(', ')}`]
                : [],
            
            performance: {
                analysisTimeMs: elapsed,
                tracesAnalyzed: traces?.length || 0,
                tasksInTraces: tasksInTraces.size,
                totalTasksInGraph: totalTasks
            },
            
            taskDetails: {
                inTraces: usefulTaskIds.map(id => taskDetailsMap.get(id) || { id }),
                notInTraces: unreachableTaskIds.map(id => allTaskDetailsMap.get(id) || { id })
            }
        };
        
    } catch (error) {
        console.error('[ReachabilityAnalyzer] Error during trace-based analysis:', error);
        return {
            success: false,
            format,
            error: `Trace-based reachability analysis failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            analysisMethod: 'trace-based'
        };
    }
}
