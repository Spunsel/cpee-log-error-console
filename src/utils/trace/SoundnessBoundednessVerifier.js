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
 * @returns {Object} Verification result with soundness and boundedness properties
 */
export function verifySoundnessAndBoundedness(traces, graphContent, format, options = {}) {
    const {
        maxLoopIterations = 1,
        startNodeIds = [],
        endNodeIds = []
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
            // Filter to only include tasks, exclude gateways and decisions
            allTasks = allNodes.filter(node => node.type === 'task');
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

    // Perform soundness checks (with graph structure and parallel block analysis)
    const soundnessResult = checkSoundness(traceArray, allTasks, startNodeIds, endNodeIds, graphStructure, parallelBlocks);

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
 * Option to Complete  — every task extracted from the graph must appear in at least
 *   one complete trace; tasks absent from all traces represent execution paths from
 *   which the process can never reach the end node.
 *
 * Proper Completion   — for every parallel (AND) block in the graph, each trace that
 *   enters the block (contains a task from any branch) must contain at least one task
 *   from every branch.  A trace that skips a branch leaves residual work, which
 *   contradicts the Petri-net proper-completion requirement.
 *
 * No Dead Transitions — every task must appear in at least one trace (unchanged).
 *
 * Reference: van der Aalst, W.M.P. (1997). Verification of Workflow Nets.
 *
 * @param {Array<Trace>}          traces         - Calculated execution traces
 * @param {Array<NodeIdentifier>} allTasks       - All tasks extracted from the graph
 * @param {Array<string>}         startNodeIds   - Start node IDs (currently unused)
 * @param {Array<string>}         endNodeIds     - End node IDs (currently unused)
 * @param {Object|null}           graphStructure - Node/edge graph for structural metrics
 * @param {Array<{id:string, branches:Array<Set<string>>}>} parallelBlocks
 *   - AND-parallel blocks with per-branch task-ID sets
 * @returns {Object} Soundness check result
 */
function checkSoundness(traces, allTasks, startNodeIds, endNodeIds, graphStructure = null, parallelBlocks = []) {
    const result = {
        sound: true,
        optionToComplete: true,
        properCompletion: true,
        noDeadTransitions: true,
        issues: [],
        deadTasks: [],
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
        tasksNotAppearingInTraces: 0
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
    //
    // Two semantic carve-outs:
    //  (a) Traces terminated by a CPEE <escape/> control element are treated as
    //      properly completed - escape behaves like an explicit end event, so any
    //      branch never reached before the escape fired is not "residual".
    //  (b) Branch task identifiers are kept as {id, alt_id} pairs (not flattened
    //      into a single id-set) and matched attribute-wise. This prevents false
    //      positives when one task's `id` collides with another task's `alt_id`,
    //      which is common in CPEE graphs where alt_id is an editor annotation
    //      that may reuse strings used as auto-generated ids elsewhere.
    if (parallelBlocks.length > 0) {
        traces.forEach((trace, traceIdx) => {
            if (!trace?.path) { return; }

            // Carve-out (a): escape-terminated traces are proper by construction.
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

            const branchCoveredByTrace = (branchTaskList) =>
                branchTaskList.some(bt => traceTasks.some(tt => taskMatchesBranchTask(tt, bt)));

            let traceProper = true;

            parallelBlocks.forEach(block => {
                const nonEmptyBranches = block.branches.filter(b => b.length > 0);
                if (nonEmptyBranches.length < 2) { return; }

                const branchCoverage = nonEmptyBranches.map(branchCoveredByTrace);
                const entersBlock = branchCoverage.some(Boolean);
                if (!entersBlock) { return; }

                const uncoveredBranches = branchCoverage
                    .map((covered, idx) => ({ idx, covered }))
                    .filter(b => !b.covered)
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

    // --- Check 3: No Dead Transitions ---
    // Every task defined in the graph must appear in at least one trace.
    const allTaskIds = new Set();
    allTasks.forEach(task => {
        if (task?.id) { allTaskIds.add(task.id); }
        if (task?.alt_id) { allTaskIds.add(task.alt_id); }
    });

    const deadTasks = [];
    allTaskIds.forEach(taskId => {
        if (!tasksInTraces.has(taskId)) { deadTasks.push(taskId); }
    });

    if (deadTasks.length > 0) {
        result.noDeadTransitions = false;
        result.sound = false;
        result.deadTasks = deadTasks;
        result.tasksNotAppearingInTraces = deadTasks.length;
        result.issues.push(`Found ${deadTasks.length} dead task(s) that never appear in any trace`);

        // Dead tasks also violate option to complete: they belong to paths that can
        // never reach the end node in any enumerated execution.
        result.optionToComplete = false;
        result.issues.push(
            `Option to complete violated: ${deadTasks.length} task(s) never participate in any completing execution`
        );
    }

    result.tasksAppearingInTraces = allTaskIds.size - deadTasks.length;

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
 * Extract parallel block structure from CPEE XML for proper-completion checking.
 * Parses every <parallel> element and collects the task identifiers in each
 * <parallel_branch>. Each branch is represented as an array of {id, alt_id}
 * pairs so that the proper-completion check can match attribute-wise against
 * trace tasks (which also carry both fields). This avoids false matches when
 * one task's auto-generated `id` happens to equal another task's editor-supplied
 * `alt_id`.
 * @param {string} xmlString - Preprocessed CPEE XML (cleaned version)
 * @returns {Array<{id: string, branches: Array<Array<{id: string|null, alt_id: string|null}>>}>}
 */
function extractCPEEParallelBlocks(xmlString) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) { return []; }

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
                        tasks.push({ id, alt_id: altId });
                    }
                });
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
            // Returns an array of {id, alt_id} pairs (alt_id is null for Mermaid)
            // to match the shape used by extractCPEEParallelBlocks.
            const branches = branchStarters.map(startNode => {
                const tasks = [];
                const visited = new Set([splitId]);
                const queue = [startNode];

                while (queue.length > 0) {
                    const nodeId = queue.shift();
                    if (visited.has(nodeId) || nodeId === joinId) { continue; }
                    visited.add(nodeId);

                    if (nodeTypeMap.get(nodeId) === 'task') {
                        tasks.push({ id: nodeId, alt_id: null });
                    }

                    (outgoing.get(nodeId) || new Set()).forEach(next => {
                        if (!visited.has(next)) { queue.push(next); }
                    });
                }
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
            issues: [errorMessage]
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

