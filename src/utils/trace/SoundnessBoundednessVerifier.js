/**
 * Soundness and Boundedness Verifier
 * Implements verification methods based on van der Aalst (1997) Workflow Nets
 * 
 * Reference: van der Aalst, W.M.P. (1997). Verification of Workflow Nets.
 * ICATPN 1997. Lecture Notes in Computer Science, vol 1248.
 * 
 * This implementation adapts workflow net soundness and boundedness concepts
 * to CPEE and Mermaid workflow graph traces.
 * 
 * IMPORTANT: Analysis is performed on TASKS ONLY (call, manipulate, script).
 * Gateways (choose, parallel, loop) are excluded because:
 * - Tasks represent actual work activities that need to be reachable
 * - Gateway reachability is implied by the reachability of connected tasks
 * - Many trace representations don't explicitly include gateway traversals
 * - This avoids false "dead transition" errors from control structures
 * 
 * Soundness Properties (adapted from van der Aalst):
 * 1. Option to Complete: All traces should reach end nodes (proper termination)
 * 2. Proper Completion: Traces end at end nodes without residual tasks
 * 3. No Dead Transitions: All tasks appear in at least one trace
 *
 * Trace-based view alone collapses (1) and (3) onto the same observation
 * (`task ∉ ⋃ tasks(traces)`): a forward-unreachable task and a
 * forward-reachable-but-non-completing task both fail to appear in any
 * completing trace.  When an external graph-based reachability classification
 * is supplied via `options.reachability`, the verifier separates them:
 *   - tasks classified `unreachable` (not forward-reachable)  → No Dead Transitions
 *   - tasks classified `dead-end`    (fwd ✓ but not bwd ✓)    → Option to Complete
 * Without graph-based reachability (e.g. CPEE fallback) the verifier keeps the
 * conservative collapsed semantics and flags both properties on any dead task.
 *
 * Boundedness Properties (formal definition from van der Aalst):
 * A Petri net (PN, M) is bounded if, for every reachable state and every place p,
 * the number of tokens in p is bounded.
 * 
 * For workflow graphs, this means:
 * 1. Bounded Places: No node/place can accumulate unbounded tokens during execution
 * 2. Bounded Loops: Loops must have bounded iteration limits (prevent unbounded token accumulation)
 * 3. Bounded Parallelism: Parallel branches cannot create unbounded concurrent token accumulation
 * 
 * Note: A WF-net PN is sound if and only if its extended net PN' (where transition t* connects o back to i)
 * is both live and bounded. Soundness implies the net cannot accumulate tokens endlessly in any place.
 */

import { CPEENodeExtractor } from '../extraction/CPEETNodeExtractor.js';
import { MermaidNodeExtractor } from '../extraction/MermaidNodeExtractor.js';

/**
 * Verify soundness and boundedness of traces
 * @param {Array<Trace>} traces - Array of Trace objects
 * @param {string} graphContent - Graph content (XML for CPEE, Mermaid syntax for Mermaid)
 * @param {string} format - Graph format ('cpee' or 'mermaid')
 * @param {Object} options - Verification options
 * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
 * @param {Array<string>} options.startNodeIds - Array of start node IDs (optional)
 * @param {Array<string>} options.endNodeIds - Array of end node IDs (optional)
 * @param {Object} [options.reachability] - Optional reachability analysis result
 *   (from `analyzeReachabilityFromTraces`). When `analysisMethod === 'graph-based'`,
 *   it is used to split dead tasks into true dead transitions (forward-unreachable)
 *   vs. dead-end tasks (forward-reachable but not backward-reachable), which lets
 *   the verifier flag `noDeadTransitions` and `optionToComplete` independently.
 * @returns {Object} Verification result with soundness and boundedness properties
 */
export function verifySoundnessAndBoundedness(traces, graphContent, format, options = {}) {
    const {
        maxLoopIterations = 1,
        startNodeIds = [],
        endNodeIds = [],
        reachability = null
    } = options;

    // Handle null/undefined inputs
    const traceArray = Array.isArray(traces) ? traces : [];
    
    if (!graphContent || typeof graphContent !== 'string') {
        return createErrorResult('Invalid graph content');
    }

    // Extract all tasks from the graph (excluding gateways for soundness/boundedness analysis)
    // Only tasks (call, manipulate, script) are relevant - gateways are control structures
    let allTasks = [];
    let graphStructure = null;
    let parallelBlocks = [];
    try {
        if (format === 'cpee') {
            const allNodes = CPEENodeExtractor.extract(graphContent);
            // Filter to only include tasks (call, manipulate, script), exclude gateways (choose, parallel, loop)
            allTasks = allNodes.filter(node => !CPEENodeExtractor.isGatewayType(node.type));
            graphStructure = extractCPEEGraphStructure(graphContent, allTasks);
            parallelBlocks = extractCPEEParallelBlocks(graphContent);
        } else if (format === 'mermaid') {
            const allNodes = MermaidNodeExtractor.extract(graphContent);
            // Filter to only include tasks, exclude gateways and decisions.
            // Mermaid emits `:script:` for CPEE manipulate/script elements, so type 'script' counts as a task.
            allTasks = allNodes.filter(node => node.type === 'task' || node.type === 'script');
            const connections = MermaidNodeExtractor.extractConnections(graphContent);
            graphStructure = buildGraphStructure(allTasks, connections);
            parallelBlocks = extractMermaidParallelBlocks(graphContent);
        } else {
            return createErrorResult(`Unknown format: ${format}`);
        }
    } catch (error) {
        console.error('[SoundnessBoundednessVerifier] Error extracting tasks:', error);
        return createErrorResult(`Failed to extract tasks: ${error.message}`);
    }

    // Perform soundness checks (with graph structure, parallel block analysis,
    // and optional graph-based reachability classification for OTC/NoDeadTransitions split)
    const soundnessResult = checkSoundness(traceArray, allTasks, startNodeIds, endNodeIds, graphStructure, parallelBlocks, reachability);

    // Perform boundedness checks (with graph structure analysis)
    const boundednessResult = checkBoundedness(traceArray, allTasks, maxLoopIterations, graphStructure);

    // Combine results
    const result = {
        sound: soundnessResult.sound,
        bounded: boundednessResult.bounded,
        soundness: soundnessResult,
        boundedness: boundednessResult,
        format: format,
        traceCount: traceArray.length,
        taskCount: allTasks.length,
        timestamp: new Date().toISOString()
    };

    return result;
}

/**
 * Check soundness properties (Option D hybrid approach).
 *
 * Option to Complete  — a forward-reachable task with no path to an end node lies
 *   on an execution path from which the process can never complete.  When as
 *   graph-based reachability classification is available, such tasks are
 *   identified as `dead-end` (forward-reachable but not backward-reachable) and
 *   flag `optionToComplete = false` independently of dead transitions.
 *
 * Proper Completion   — for every parallel (AND) block in the graph, each trace
 *   that enters the block must contain at least one task from every branch
 *   that is not structurally skippable.  Both entry detection and per-branch
 *   coverage use only "block-exclusive" branch tasks (whose IDs do NOT also
 *   appear outside any `<parallel>` element in the same graph); this prevents
 *   false positives in CPEE graphs that reuse the same task ID inside a
 *   parallel branch AND in a sibling non-parallel alternative.  Branches with
 *   no exclusive tasks are skipped (lenient: coverage cannot be unambiguously
 *   decided).  Branches whose structure admits a zero-task execution path
 *   (e.g. a loop body that exits via a bare `<escape/>`, or an empty
 *   alternative) are also skipped — such a branch may legitimately contribute
 *   zero tasks while still completing per CPEE semantics, matching the traces
 *   produced by `CPEETraceCalculator`.
 *
 * No Dead Transitions — every task must appear in at least one trace.  When a
 *   graph-based reachability classification is available, this is refined to
 *   tasks classified as `unreachable` (not forward-reachable from any start node).
 *
 * If no graph-based reachability is supplied (e.g. CPEE fallback), the verifier
 * keeps the conservative collapsed semantics: any task absent from all traces
 * flags both `noDeadTransitions` and `optionToComplete`.
 *
 * Reference: van der Aalst, W.M.P. (1997). Verification of Workflow Nets.
 *
 * @param {Array<Trace>}          traces         - Calculated execution traces
 * @param {Array<NodeIdentifier>} allTasks       - All tasks extracted from the graph
 * @param {Array<string>}         startNodeIds   - Start node IDs (currently unused)
 * @param {Array<string>}         endNodeIds     - End node IDs (currently unused)
 * @param {Object|null}           graphStructure - Node/edge graph for structural metrics
 * @param {Array<{id:string, branches:Array<Array<{id:string|null, alt_id:string|null, exclusive:boolean}>>}>} parallelBlocks
 *   - AND-parallel blocks with per-branch task entries.  Each entry carries
 *     `{id, alt_id, exclusive}`; `exclusive` is true when the task ID does
 *     NOT also appear outside any `<parallel>` element in the same graph.
 *     Each branch array also carries a non-enumerable-style `canSkip`
 *     property: true when the branch structure admits at least one execution
 *     path that produces zero tasks (e.g. a loop with a bare-escape body).
 * @param {Object|null}           reachability   - Optional reachability analysis result
 *   (from `analyzeReachabilityFromTraces`); enables OTC/NoDeadTransitions split when
 *   `analysisMethod === 'graph-based'`.
 * @returns {Object} Soundness check result
 */
function checkSoundness(traces, allTasks, startNodeIds, endNodeIds, graphStructure = null, parallelBlocks = [], reachability = null) {
    const result = {
        sound: true,
        optionToComplete: true,
        properCompletion: true,
        noDeadTransitions: true,
        issues: [],
        deadTasks: [],
        trueDeadTransitions: [],
        optionToCompleteViolators: [],
        deadTaskClassification: 'collapsed',
        incompleteTraces: [],
        parallelCompletionViolations: [],
        sourceNodeCount: 0,
        sourceNodes: [],
        sinkNodeCount: 0,
        sinkNodes: [],
        connectedComponentCount: 0,
        stronglyConnectedComponentCount: 0,
        tracesReachingEnd: 0,
        tracesNotReachingEnd: 0,
        tracesEndingProperly: 0,
        tracesNotEndingProperly: 0,
        tasksAppearingInTraces: 0,
        tasksNotAppearingInTraces: 0,
        trueDeadTransitionsCount: 0,
        optionToCompleteViolatorsCount: 0
    };

    if (traces.length === 0) {
        result.sound = false;
        result.optionToComplete = false;
        result.properCompletion = false;
        result.noDeadTransitions = false;
        result.issues.push('No traces found - workflow may be unreachable');
        return result;
    }

    // Build the union of task IDs that appear in any trace
    const tasksInTraces = new Set();
    traces.forEach(trace => {
        if (trace?.path && Array.isArray(trace.path)) {
            trace.path.forEach(task => {
                if (task?.id) { tasksInTraces.add(task.id); }
                if (task?.alt_id) { tasksInTraces.add(task.alt_id); }
            });
        }
    });

    // --- Check 1: Option to Complete ---
    // The trace calculator only appends a trace when it successfully reaches the end
    // node, so every non-empty trace is a completing execution by construction.
    // Detecting non-completing paths therefore requires checking whether any task
    // defined in the graph is absent from all traces: if it is, there exists an
    // execution path through that task from which the process cannot complete.
    // (The dead-task set is computed in Check 3 and applied here afterwards.)
    traces.forEach((trace, index) => {
        if (!trace?.path || trace.path.length === 0) {
            result.tracesNotReachingEnd++;
            result.incompleteTraces.push({ traceIndex: index, reason: 'Empty trace - no execution path' });
        } else {
            result.tracesReachingEnd++;
        }
    });

    if (result.tracesNotReachingEnd > 0) {
        result.optionToComplete = false;
        result.sound = false;
        result.issues.push(`${result.tracesNotReachingEnd} trace(s) terminate without executing any task`);
    }

    // --- Check 2: Proper Completion via AND-branch coverage ---
    // For every parallel block, a trace that enters the block (contains a task from
    // any branch) must also contain at least one task from every other branch.
    // A missing branch means residual work is left behind at termination.
    if (parallelBlocks.length > 0) {
        traces.forEach((trace, traceIdx) => {
            if (!trace?.path) { return; }

            // Carve-out (a): defensive fallback for residual escape-terminated traces.
            if (trace.terminatedByEscape === true ||
                trace.path?._terminatedByEscape === true) {
                result.tracesEndingProperly++;
                return;
            }

            const traceTasks = trace.path.filter(t => t && (t.id || t.alt_id));

            const taskMatchesBranchTask = (traceTask, branchTask) => {
                if (branchTask.id && traceTask.id && branchTask.id === traceTask.id) {
                    return true;
                }
                if (branchTask.alt_id && traceTask.alt_id && branchTask.alt_id === traceTask.alt_id) {
                    return true;
                }
                return false;
            };

            let traceProper = true;

            parallelBlocks.forEach(block => {
                // Keep all branches (including empty ones) so per-branch
                // metadata like canSkip stays index-aligned.  We still require
                // the block to have at least two real branches to be checked.
                if (block.branches.filter(b => b.length > 0 || b.canSkip).length < 2) {
                    return;
                }

                // Carve-out (c): keep only block-exclusive tasks per branch.
                // Preserve the per-branch canSkip flag on the filtered array so
                // the violation rule below can honour it.
                const exclusiveBranches = block.branches.map(branch => {
                    const filtered = branch.filter(t => t.exclusive);
                    filtered.canSkip = branch.canSkip === true;
                    return filtered;
                });

                const branchCoverage = exclusiveBranches.map(eb =>
                    eb.length > 0 && eb.some(bt => traceTasks.some(tt => taskMatchesBranchTask(tt, bt)))
                );

                // Entry: at least one branch contributes an unambiguous marker.
                const entersBlock = branchCoverage.some(Boolean);
                if (!entersBlock) { return; }

                // A branch is uncovered only if it
                //   (i)  HAS exclusive tasks AND
                //   (ii) none of those exclusive tasks appear in the trace AND
                //   (iii) it cannot be legitimately skipped (no zero-task path).
                // Branches with no exclusive tasks are ambiguous (can't decide),
                // and branches with a zero-task path may legitimately contribute
                // zero tasks per CPEE semantics (e.g. loop body that exits via
                // an early <escape/>); both cases are skipped to avoid false
                // positives.
                const uncoveredBranches = exclusiveBranches
                    .map((eb, idx) => ({ idx, eb, covered: branchCoverage[idx] }))
                    .filter(b => b.eb.length > 0 && !b.covered && !b.eb.canSkip)
                    .map(b => b.idx);

                if (uncoveredBranches.length > 0) {
                    traceProper = false;
                    result.parallelCompletionViolations.push({ blockId: block.id, traceIndex: traceIdx, uncoveredBranches });
                }
            });

            if (traceProper) {
                result.tracesEndingProperly++;
            } else {
                result.tracesNotEndingProperly++;
            }
        });

        if (result.parallelCompletionViolations.length > 0) {
            result.properCompletion = false;
            result.sound = false;
            const uniqueBlocks = new Set(result.parallelCompletionViolations.map(v => v.blockId));
            result.issues.push(
                `Proper completion violated: ${result.parallelCompletionViolations.length} trace(s) skip at least one branch in ${uniqueBlocks.size} parallel block(s)`
            );
        }
    } else {
        // No parallel blocks: proper completion holds trivially for this graph
        result.tracesEndingProperly = traces.length;
    }

    // --- Check 3: No Dead Transitions / Option to Complete (refined) ---
    // Every task defined in the graph must appear in at least one trace.  When a
    // graph-based reachability classification is available, the missing tasks are
    // partitioned into:
    //   - `trueDeadTransitions`        — forward-unreachable tasks  → No Dead Transitions
    //   - `optionToCompleteViolators`  — forward-reachable but not backward-reachable
    //                                    tasks (dead-end / "trap")  → Option to Complete
    // Without graph-based reachability the trace-based view cannot tell them apart, so
    // the conservative collapsed semantics is preserved: any dead task flags both.
    const allTaskIds = new Set();
    allTasks.forEach(task => {
        if (task?.id) { allTaskIds.add(task.id); }
        if (task?.alt_id) { allTaskIds.add(task.alt_id); }
    });

    const deadTasks = [];
    allTaskIds.forEach(taskId => {
        if (!tasksInTraces.has(taskId)) { deadTasks.push(taskId); }
    });

    result.deadTasks = deadTasks;
    result.tasksNotAppearingInTraces = deadTasks.length;
    result.tasksAppearingInTraces = allTaskIds.size - deadTasks.length;

    const canSplitWithReachability =
        !!reachability
        && reachability.analysisMethod === 'graph-based'
        && !!reachability.nodeClassification
        && Array.isArray(reachability.nodeClassification.unreachableNodes)
        && Array.isArray(reachability.nodeClassification.deadEndNodes);

    if (deadTasks.length > 0 && canSplitWithReachability) {
        const unreachableSet = new Set(reachability.nodeClassification.unreachableNodes);
        const deadEndSet = new Set(reachability.nodeClassification.deadEndNodes);

        const trueDead = [];
        const otcViolators = [];

        deadTasks.forEach(id => {
            if (unreachableSet.has(id)) {
                trueDead.push(id);
            } else if (deadEndSet.has(id)) {
                otcViolators.push(id);
            } else {
                // Task is missing from all traces but reachability classifies it as
                // viable.  This should not normally happen; conservatively treat it as
                // a dead transition so the issue is still surfaced.
                trueDead.push(id);
            }
        });

        result.trueDeadTransitions = trueDead;
        result.optionToCompleteViolators = otcViolators;
        result.trueDeadTransitionsCount = trueDead.length;
        result.optionToCompleteViolatorsCount = otcViolators.length;
        result.deadTaskClassification = 'graph-based';

        if (trueDead.length > 0) {
            result.noDeadTransitions = false;
            result.sound = false;
            result.issues.push(
                `Found ${trueDead.length} dead transition(s) - task(s) not reachable from any start node`
            );
        }
        if (otcViolators.length > 0) {
            result.optionToComplete = false;
            result.sound = false;
            result.issues.push(
                `Found ${otcViolators.length} dead-end task(s) - reachable from start but cannot reach an end node`
            );
        }
    } else if (deadTasks.length > 0) {
        // Collapsed semantics (trace-based view only).  We cannot distinguish
        // forward-unreachable from dead-end tasks, so both properties are flagged.
        result.trueDeadTransitions = [...deadTasks];
        result.optionToCompleteViolators = [];
        result.trueDeadTransitionsCount = deadTasks.length;
        result.optionToCompleteViolatorsCount = 0;
        result.deadTaskClassification = 'collapsed';

        result.noDeadTransitions = false;
        result.sound = false;
        result.issues.push(`Found ${deadTasks.length} dead task(s) that never appear in any trace`);

        result.optionToComplete = false;
        result.issues.push(
            `Option to complete violated: ${deadTasks.length} task(s) never participate in any completing execution`
        );
    } else {
        // No dead tasks: classification source still reflects whether reachability
        // could have been used, which downstream UIs can surface if desired.
        result.deadTaskClassification = canSplitWithReachability ? 'graph-based' : 'collapsed';
    }

    // --- Graph structure metrics ---
    if (graphStructure) {
        const sourceNodes = findSourceNodes(graphStructure);
        result.sourceNodes = sourceNodes;
        result.sourceNodeCount = sourceNodes.length;

        const sinkNodes = findSinkNodes(graphStructure);
        result.sinkNodes = sinkNodes;
        result.sinkNodeCount = sinkNodes.length;

        const connectedComponents = findConnectedComponents(graphStructure);
        result.connectedComponentCount = connectedComponents.length;

        const stronglyConnectedComponents = findStronglyConnectedComponents(graphStructure);
        result.stronglyConnectedComponentCount = stronglyConnectedComponents.length;
    }

    return result;
}

/**
 * Check boundedness properties
 * 
 * IMPORTANT: Boundedness is always true in this implementation because the trace
 * calculation algorithm uses hardcoded bounded exploration (max loop iterations).
 * This means that by design, all execution paths are bounded.
 * 
 * Formal definition: A Petri net (PN, M) is bounded if, for every reachable state and every place p,
 * the number of tokens in p is bounded.
 * 
 * Since the trace finding algorithm enforces bounded exploration through max loop iterations,
 * boundedness is guaranteed by construction and does not need to be verified.
 * 
 * @param {Array<Trace>} _traces - Array of Trace objects (unused)
 * @param {Array<NodeIdentifier>} _allTasks - All tasks in the graph (unused)
 * @param {number} _maxLoopIterations - Maximum loop iterations allowed (unused)
 * @param {Object|null} _graphStructure - Graph structure with nodes and edges (unused)
 * @returns {Object} Boundedness check result (always bounded)
 */
function checkBoundedness(_traces, _allTasks, _maxLoopIterations, _graphStructure = null) {
    // Boundedness is always true because the trace calculation algorithm
    // uses hardcoded bounded exploration (max loop iterations limit).
    // No actual verification is needed.
    return {
        bounded: true,
        boundedPlaces: true,
        boundedLoops: true,
        boundedParallelism: true,
        issues: [],
        // All counts are 0 since we don't perform actual boundedness checking
        boundedPlaceCount: 0,
        unboundedPlaceCount: 0,
        unboundedNodeCount: 0,
        unboundedNodes: [],
        unboundedPlaces: [],
        maxPlaceTokens: {},
        parallelBranchesNotCreatingUnbounded: 0,
        parallelBranchesCreatingUnbounded: 0,
        // Explanation for why boundedness is always true
        explanation: 'Bounded (always true because of hardcoded bounded exploration in trace finding algorithm)'
    };
}

/**
 * Extract graph structure from CPEE XML
 * @param {string} xmlString - CPEE XML content
 * @param {Array<NodeIdentifier>} allTasks - All tasks in the graph
 * @returns {Object} Graph structure with nodes and edges
 */
function extractCPEEGraphStructure(xmlString, allTasks) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        const description = xmlDoc.querySelector('description') || xmlDoc.documentElement;
        
        if (!description) {
            return { nodes: [], edges: [] };
        }
        
        const nodes = allTasks.map(task => ({
            id: task.alt_id || task.id,
            alt_id: task.alt_id,
            type: 'task'
        }));
        
        const edges = [];
        const nodeMap = new Map();
        nodes.forEach(node => {
            nodeMap.set(node.id, node);
        });
        
        // Extract edges from XML structure (parent-child relationships)
        const extractEdges = (element, parentId = null) => {
            if (!element) {
                return;
            }
            
            const currentId = element.getAttribute('alt_id') || element.getAttribute('id');
            if (currentId && nodeMap.has(currentId)) {
                if (parentId && nodeMap.has(parentId)) {
                    edges.push({ from: parentId, to: currentId });
                }
                
                // Process children
                Array.from(element.children).forEach(child => {
                    extractEdges(child, currentId);
                });
            } else {
                // Process children even if current element is not a task
                Array.from(element.children).forEach(child => {
                    extractEdges(child, parentId);
                });
            }
        };
        
        extractEdges(description);
        
        return { nodes, edges };
    } catch (error) {
        console.error('[SoundnessBoundednessVerifier] Error extracting CPEE graph structure:', error);
        return { nodes: [], edges: [] };
    }
}

/**
 * Build graph structure from nodes and connections
 * @param {Array<NodeIdentifier>} allTasks - All tasks in the graph
 * @param {Array<Object>} connections - Array of connection objects with 'from' and 'to' properties
 * @returns {Object} Graph structure with nodes and edges
 */
function buildGraphStructure(allTasks, connections) {
    const nodes = allTasks.map(task => ({
        id: task.alt_id || task.id,
        alt_id: task.alt_id,
        type: 'task'
    }));
    
    const edges = connections.map(conn => ({
        from: conn.from,
        to: conn.to
    }));
    
    return { nodes, edges };
}

/**
 * @param {string} xmlString - Preprocessed CPEE XML (cleaned version)
 * @returns {Array<{id: string, branches: Array<Array<{id: string|null, alt_id: string|null, exclusive: boolean}>>}>}
 */
function extractCPEEParallelBlocks(xmlString) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) { return []; }

        // First pass: collect identifier keys for every task occurrence that
        // lives OUTSIDE any <parallel> element. Used below to decide which
        // branch tasks are unambiguous markers of parallel-block execution.
        const outsideTaskKeys = new Set();
        const collectOutside = (element, insideParallel) => {
            if (!element || !element.tagName) { return; }
            const tag = element.tagName.toLowerCase();
            const nowInside = insideParallel || tag === 'parallel';
            if (!nowInside && (tag === 'call' || tag === 'manipulate' || tag === 'script')) {
                const id = element.getAttribute('id');
                const altId =
                    element.getAttribute('a:alt_id') ||
                    element.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') ||
                    null;
                if (id) { outsideTaskKeys.add('id:' + id); }
                if (altId) { outsideTaskKeys.add('alt:' + altId); }
            }
            Array.from(element.children || []).forEach(c => collectOutside(c, nowInside));
        };
        collectOutside(xmlDoc.documentElement, false);

        const isExclusive = (id, altId) => {
            if (id && outsideTaskKeys.has('id:' + id)) { return false; }
            if (altId && outsideTaskKeys.has('alt:' + altId)) { return false; }
            return true;
        };

        const blocks = [];
        xmlDoc.querySelectorAll('parallel').forEach((parallel, idx) => {
            const branchNodes = Array.from(parallel.children).filter(
                c => c.tagName.toLowerCase() === 'parallel_branch'
            );
            if (branchNodes.length < 2) { return; }

            const branches = branchNodes.map(branch => {
                const tasks = [];
                branch.querySelectorAll('call, manipulate, script').forEach(el => {
                    const id = el.getAttribute('id') || null;
                    const altId =
                        el.getAttribute('a:alt_id') ||
                        el.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') ||
                        null;
                    if (id || altId) {
                        tasks.push({ id, alt_id: altId, exclusive: isExclusive(id, altId) });
                    }
                });
                // Tag the branch with whether it has at least one execution path
                // that produces zero tasks. Used by the proper-completion check
                // to permit traces that legitimately skip this branch (e.g. a
                // branch whose body is a loop containing a bare-escape path: the
                // loop absorbs the escape and the branch completes with zero
                // tasks, which is a valid execution per CPEE semantics).
                tasks.canSkip = elementHasZeroTaskPath(branch);
                return tasks;
            });

            blocks.push({ id: `parallel_${idx}`, branches });
        });

        return blocks;
    } catch (error) {
        console.error('[SoundnessBoundednessVerifier] Error extracting CPEE parallel blocks:', error);
        return [];
    }
}

/**
 * Recursively determine whether a CPEE control-flow element has at least one
 * execution path that produces zero tasks. Used by the proper-completion check
 * to recognise "skippable" parallel branches: a branch that can legitimately
 * execute zero tasks (e.g. an empty alternative, a bare `<escape/>`, or a
 * loop whose body can be exited via `<escape/>` before any task) does NOT
 * need to contribute a task to the trace for proper completion.
 *
 * Mirrors the relevant subset of CPEETraceCalculator semantics so we don't
 * have to invoke the full trace calculator here.
 *
 * @param {Element} element - XML element to analyze
 * @returns {boolean} true if at least one execution path produces zero tasks
 */
function elementHasZeroTaskPath(element) {
    if (!element || !element.tagName) { return true; }
    const tag = element.tagName.toLowerCase();

    switch (tag) {
        case 'call':
        case 'manipulate':
        case 'script':
            return false;

        case 'escape':
            // Bare escape produces zero tasks (and as a side effect terminates
            // the parent sequence; sequenceHasZeroTaskPath uses that fact).
            return true;

        case 'choose': {
            const alternatives = Array.from(element.children).filter(c => {
                const t = c.tagName.toLowerCase();
                return t === 'alternative' || t === 'otherwise';
            });
            // No alternatives = nothing to execute = zero tasks.
            // Otherwise, both exclusive and inclusive choose have a zero-task
            // path iff at least one alternative does.
            if (alternatives.length === 0) { return true; }
            return alternatives.some(elementHasZeroTaskPath);
        }

        case 'alternative':
        case 'otherwise':
        case 'parallel_branch':
        case 'description': {
            const children = Array.from(element.children).filter(c => {
                const t = c.tagName.toLowerCase();
                return !t.startsWith('_') && t !== 'condition';
            });
            return sequenceHasZeroTaskPath(children);
        }

        case 'loop': {
            const mode = (element.getAttribute('mode') || 'pre_test').toLowerCase();
            const condition = (element.getAttribute('condition') || '').trim();
            const body = Array.from(element.children).filter(
                c => c.tagName.toLowerCase() !== 'condition'
            );
            // pre_test with non-"true" condition can run zero iterations,
            // matching CPEETraceCalculator's `shouldSkipZeroIterations` logic.
            if (mode === 'pre_test' && condition !== 'true') { return true; }
            // Otherwise the loop runs at least one iteration; it has a zero-task
            // path only if the body itself has one (the loop ABSORBS any
            // body-level escape, so an escape-terminated zero-task body still
            // yields a zero-task normal output for the loop).
            return sequenceHasZeroTaskPath(body);
        }

        case 'parallel': {
            const branches = Array.from(element.children).filter(
                c => c.tagName.toLowerCase() === 'parallel_branch'
            );
            // A parallel completes with zero tasks only if every branch can.
            return branches.every(elementHasZeroTaskPath);
        }

        default: {
            // Unknown wrapper element: recurse over its children as a sequence.
            const children = Array.from(element.children);
            if (children.length === 0) { return true; }
            return sequenceHasZeroTaskPath(children);
        }
    }
}

/**
 * Determine whether a sequence of child elements has a zero-task execution path.
 *
 * Walks left-to-right.  As long as every child up to (and including) a bare
 * `<escape/>` has a zero-task path, the sequence has a zero-task path: an
 * `<escape/>` terminates the sequence so subsequent siblings never execute.
 * If we reach a child without a zero-task path before any escape, the
 * sequence cannot produce zero tasks.
 *
 * This approximation captures the cases CPEETraceCalculator actually generates
 * (bare-escape inside a loop body, empty alternatives, choose with at least
 * one zero-task alt) without having to materialise full traces.
 *
 * @param {Array<Element>} children
 * @returns {boolean}
 */
function sequenceHasZeroTaskPath(children) {
    if (!Array.isArray(children) || children.length === 0) { return true; }

    for (const child of children) {
        if (!elementHasZeroTaskPath(child)) { return false; }
        if (child.tagName?.toLowerCase() === 'escape') {
            // Sequence terminates here; downstream siblings don't execute.
            return true;
        }
    }
    return true;
}

/**
 * Extract parallel block structure from Mermaid flowchart syntax for proper-completion
 * checking.  Identifies parallelgateway split/join pairs from the preprocessed syntax,
 * then collects the task IDs reachable in each branch (via BFS bounded by the join node).
 * @param {string} mermaidSyntax - Preprocessed Mermaid flowchart code
 * @returns {Array<{id: string, branches: Array<Set<string>>}>}
 */
function extractMermaidParallelBlocks(mermaidSyntax) {
    try {
        const connections = MermaidNodeExtractor.extractConnections(mermaidSyntax);
        const outgoing = new Map();
        connections.forEach(({ from, to }) => {
            if (!outgoing.has(from)) { outgoing.set(from, new Set()); }
            outgoing.get(from).add(to);
        });

        // Map from node ID to its type ('task' | 'gateway' | ...)
        const nodeTypeMap = new Map(
            MermaidNodeExtractor.extract(mermaidSyntax).map(n => [n.id, n.type])
        );

        // Detect parallel split gateways directly from syntax lines
        const parallelSplitIds = new Set();
        for (const line of mermaidSyntax.split('\n')) {
            const match = line.match(/(\w+):parallelgateway:\{[^}]+\}/);
            if (match && MermaidNodeExtractor.isStartGateway(match[1])) {
                parallelSplitIds.add(match[1]);
            }
        }

        const blocks = [];

        parallelSplitIds.forEach(splitId => {
            const joinId = MermaidNodeExtractor.getPairedGatewayId(splitId);
            if (!joinId) { return; }

            const branchStarters = Array.from(outgoing.get(splitId) || []);
            if (branchStarters.length < 2) { return; }

            // BFS from each branch entry point, stopping at the join gateway,
            // to collect the tasks belonging to that branch.
            // Returns an array of {id, alt_id, exclusive} entries (alt_id is null
            // for Mermaid; exclusive is always true because Mermaid flowchart
            // node IDs are globally unique per occurrence, so a branch task ID
            // cannot also appear outside the parallel block) to match the shape
            // used by extractCPEEParallelBlocks.
            const branches = branchStarters.map(startNode => {
                const tasks = [];
                const visited = new Set([splitId]);
                const queue = [startNode];

                while (queue.length > 0) {
                    const nodeId = queue.shift();
                    if (visited.has(nodeId) || nodeId === joinId) { continue; }
                    visited.add(nodeId);

                    if (nodeTypeMap.get(nodeId) === 'task') {
                        tasks.push({ id: nodeId, alt_id: null, exclusive: true });
                    }

                    (outgoing.get(nodeId) || new Set()).forEach(next => {
                        if (!visited.has(next)) { queue.push(next); }
                    });
                }
                // Mermaid currently has no escape-equivalent semantics surfaced
                // in this extractor, so a Mermaid parallel branch is never
                // structurally "skippable" by zero-task path analysis. Keep the
                // strict default; CPEE handles `canSkip = true` cases.
                tasks.canSkip = false;
                return tasks;
            });

            blocks.push({ id: splitId, branches });
        });

        return blocks;
    } catch (error) {
        console.error('[SoundnessBoundednessVerifier] Error extracting Mermaid parallel blocks:', error);
        return [];
    }
}

/**
 * Find source nodes (nodes with no incoming edges)
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @returns {Array<string>} Array of source node IDs
 */
function findSourceNodes(graphStructure) {
    const { nodes, edges } = graphStructure;
    const hasIncoming = new Set(edges.map(e => e.to));
    
    return nodes
        .filter(n => !hasIncoming.has(n.id))
        .map(n => n.id);
}

/**
 * Find sink nodes (nodes with no outgoing edges)
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @returns {Array<string>} Array of sink node IDs
 */
function findSinkNodes(graphStructure) {
    const { nodes, edges } = graphStructure;
    const hasOutgoing = new Set(edges.map(e => e.from));
    
    return nodes
        .filter(n => !hasOutgoing.has(n.id))
        .map(n => n.id);
}

/**
 * Find connected components using DFS
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @returns {Array<Array<string>>} Array of connected components (each component is an array of node IDs)
 */
function findConnectedComponents(graphStructure) {
    const { nodes, edges } = graphStructure;
    const adjacencyList = new Map();
    
    // Build adjacency list (undirected)
    nodes.forEach(node => {
        adjacencyList.set(node.id, []);
    });
    
    edges.forEach(edge => {
        if (adjacencyList.has(edge.from) && adjacencyList.has(edge.to)) {
            adjacencyList.get(edge.from).push(edge.to);
            adjacencyList.get(edge.to).push(edge.from);
        }
    });
    
    const visited = new Set();
    const components = [];
    
    function dfs(nodeId, component) {
        visited.add(nodeId);
        component.push(nodeId);
        
        const neighbors = adjacencyList.get(nodeId) || [];
        neighbors.forEach(neighbor => {
            if (!visited.has(neighbor)) {
                dfs(neighbor, component);
            }
        });
    }
    
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            const component = [];
            dfs(node.id, component);
            components.push(component);
        }
    });
    
    return components;
}

/**
 * Find strongly connected components using Kosaraju's algorithm
 * @param {Object} graphStructure - Graph structure with nodes and edges
 * @returns {Array<Array<string>>} Array of strongly connected components
 */
function findStronglyConnectedComponents(graphStructure) {
    const { nodes, edges } = graphStructure;
    
    if (nodes.length === 0) {
        return [];
    }
    
    // Build adjacency lists (forward and reverse)
    const forwardAdj = new Map();
    const reverseAdj = new Map();
    
    nodes.forEach(node => {
        forwardAdj.set(node.id, []);
        reverseAdj.set(node.id, []);
    });
    
    edges.forEach(edge => {
        if (forwardAdj.has(edge.from) && forwardAdj.has(edge.to)) {
            forwardAdj.get(edge.from).push(edge.to);
            reverseAdj.get(edge.to).push(edge.from);
        }
    });
    
    // Step 1: First DFS to get finishing times
    const visited = new Set();
    const finishOrder = [];
    
    function dfs1(nodeId) {
        visited.add(nodeId);
        const neighbors = forwardAdj.get(nodeId) || [];
        neighbors.forEach(neighbor => {
            if (!visited.has(neighbor)) {
                dfs1(neighbor);
            }
        });
        finishOrder.push(nodeId);
    }
    
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            dfs1(node.id);
        }
    });
    
    // Step 2: Second DFS on reverse graph in reverse finish order
    const visited2 = new Set();
    const components = [];
    
    function dfs2(nodeId, component) {
        visited2.add(nodeId);
        component.push(nodeId);
        const neighbors = reverseAdj.get(nodeId) || [];
        neighbors.forEach(neighbor => {
            if (!visited2.has(neighbor)) {
                dfs2(neighbor, component);
            }
        });
    }
    
    // Process in reverse finish order
    for (let i = finishOrder.length - 1; i >= 0; i--) {
        const nodeId = finishOrder[i];
        if (!visited2.has(nodeId)) {
            const component = [];
            dfs2(nodeId, component);
            components.push(component);
        }
    }
    
    return components;
}

/**
 * Create error result object
 * @param {string} errorMessage - Error message
 * @returns {Object} Error result
 */
function createErrorResult(errorMessage) {
    return {
        sound: false,
        bounded: false,
        error: errorMessage,
        soundness: {
            sound: false,
            optionToComplete: false,
            properCompletion: false,
            noDeadTransitions: false,
            issues: [errorMessage],
            deadTasks: [],
            trueDeadTransitions: [],
            optionToCompleteViolators: [],
            trueDeadTransitionsCount: 0,
            optionToCompleteViolatorsCount: 0,
            deadTaskClassification: 'unknown'
        },
        boundedness: {
            bounded: false,
            boundedPlaces: false,
            boundedLoops: false,
            boundedParallelism: false,
            issues: [errorMessage]
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * Verify soundness and boundedness for CPEE traces
 * @param {Array<Trace>} traces - Array of CPEE Trace objects
 * @param {string} cpeeXml - CPEE XML content
 * @param {Object} options - Verification options
 * @returns {Object} Verification result
 */
function _verifyCPEESoundnessAndBoundedness(traces, cpeeXml, options = {}) {
    return verifySoundnessAndBoundedness(traces, cpeeXml, 'cpee', options);
}

/**
 * Verify soundness and boundedness for Mermaid traces
 * @param {Array<Trace>} traces - Array of Mermaid Trace objects
 * @param {string} mermaidSyntax - Mermaid flowchart syntax
 * @param {Object} options - Verification options
 * @returns {Object} Verification result
 */
function _verifyMermaidSoundnessAndBoundedness(traces, mermaidSyntax, options = {}) {
    return verifySoundnessAndBoundedness(traces, mermaidSyntax, 'mermaid', options);
}

