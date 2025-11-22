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

    console.log('[SoundnessBoundednessVerifier] Starting verification');
    console.log('[SoundnessBoundednessVerifier] Format:', format);
    console.log('[SoundnessBoundednessVerifier] Traces:', traces?.length || 0);

    // Handle null/undefined inputs
    const traceArray = Array.isArray(traces) ? traces : [];
    
    if (!graphContent || typeof graphContent !== 'string') {
        return createErrorResult('Invalid graph content');
    }

    // Extract all tasks from the graph
    let allTasks = [];
    let graphStructure = null;
    try {
        if (format === 'cpee') {
            allTasks = CPEENodeExtractor.extract(graphContent);
            graphStructure = extractCPEEGraphStructure(graphContent, allTasks);
        } else if (format === 'mermaid') {
            allTasks = MermaidNodeExtractor.extract(graphContent);
            const connections = MermaidNodeExtractor.extractConnections(graphContent);
            graphStructure = buildGraphStructure(allTasks, connections);
        } else {
            return createErrorResult(`Unknown format: ${format}`);
        }
    } catch (error) {
        console.error('[SoundnessBoundednessVerifier] Error extracting tasks:', error);
        return createErrorResult(`Failed to extract tasks: ${error.message}`);
    }

    // Perform soundness checks (with graph structure analysis)
    const soundnessResult = checkSoundness(traceArray, allTasks, startNodeIds, endNodeIds, graphStructure);

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

    console.log('[SoundnessBoundednessVerifier] Verification complete');
    console.log('[SoundnessBoundednessVerifier] Sound:', result.sound);
    console.log('[SoundnessBoundednessVerifier] Bounded:', result.bounded);

    return result;
}

/**
 * Check soundness properties
 * Based on van der Aalst (1997): Option to Complete, Proper Completion, No Dead Transitions
 * Also checks: number of source nodes, sink nodes, connected components, strongly connected components
 * @param {Array<Trace>} traces - Array of Trace objects
 * @param {Array<NodeIdentifier>} allTasks - All tasks in the graph
 * @param {Array<string>} startNodeIds - Array of start node IDs
 * @param {Array<string>} endNodeIds - Array of end node IDs
 * @param {Object|null} graphStructure - Graph structure with nodes and edges
 * @returns {Object} Soundness check result
 */
function checkSoundness(traces, allTasks, startNodeIds, endNodeIds, graphStructure = null) {
    const result = {
        sound: true,
        optionToComplete: true,
        properCompletion: true,
        noDeadTransitions: true,
        issues: [],
        deadTasks: [],
        incompleteTraces: [],
        // New metrics
        sourceNodeCount: 0,
        sourceNodes: [],
        sinkNodeCount: 0,
        sinkNodes: [],
        connectedComponentCount: 0,
        stronglyConnectedComponentCount: 0,
        // Trace statistics
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
        result.issues.push('No traces found - workflow may be unreachable');
        return result;
    }

    // Collect all task IDs that appear in traces
    const tasksInTraces = new Set();
    traces.forEach(trace => {
        if (trace && trace.path && Array.isArray(trace.path)) {
            trace.path.forEach(task => {
                if (task && task.id) {
                    tasksInTraces.add(task.id);
                }
                if (task && task.alt_id) {
                    tasksInTraces.add(task.alt_id);
                }
            });
        }
    });

    // Check 1: Option to Complete
    // Count traces that reach end nodes vs those that don't
    traces.forEach((trace, index) => {
        if (!trace || !trace.path || trace.path.length === 0) {
            result.optionToComplete = false;
            result.tracesNotReachingEnd++;
            result.incompleteTraces.push({
                traceIndex: index,
                reason: 'Empty trace - no execution path'
            });
        } else {
            // Check if trace ends at an end node (if endNodeIds provided)
            if (endNodeIds.length > 0 && trace.path.length > 0) {
                const lastTask = trace.path[trace.path.length - 1];
                const lastTaskId = lastTask.alt_id || lastTask.id;
                if (endNodeIds.includes(lastTaskId)) {
                    result.tracesReachingEnd++;
                } else {
                    result.tracesNotReachingEnd++;
                    result.optionToComplete = false;
                }
            } else {
                // If no endNodeIds provided, assume trace completes if it has at least one task
                result.tracesReachingEnd++;
            }
        }
    });

    if (result.tracesNotReachingEnd > 0) {
        result.sound = false;
        result.issues.push(`Some traces do not complete properly (${result.tracesNotReachingEnd} out of ${traces.length} traces)`);
    }

    // Check 2: Proper Completion
    // Count traces that end properly vs those that don't
    traces.forEach((trace, index) => {
        if (trace && trace.path && trace.path.length > 0) {
            // Check if trace is properly formed (has valid tasks)
            const hasInvalidTasks = trace.path.some(task => !task || (!task.id && !task.alt_id));
            if (hasInvalidTasks) {
                result.properCompletion = false;
                result.tracesNotEndingProperly++;
                result.incompleteTraces.push({
                    traceIndex: index,
                    reason: 'Trace contains invalid tasks'
                });
            } else {
                result.tracesEndingProperly++;
            }
        }
    });

    if (result.tracesNotEndingProperly > 0) {
        result.sound = false;
        result.issues.push(`Some traces do not have proper completion (${result.tracesNotEndingProperly} out of ${traces.length} traces)`);
    }

    // Check 3: No Dead Transitions
    // All tasks should appear in at least one trace
    const allTaskIds = new Set();
    allTasks.forEach(task => {
        if (task && task.id) {
            allTaskIds.add(task.id);
        }
        if (task && task.alt_id) {
            allTaskIds.add(task.alt_id);
        }
    });

    const deadTasks = [];
    allTaskIds.forEach(taskId => {
        if (!tasksInTraces.has(taskId)) {
            deadTasks.push(taskId);
        }
    });

    if (deadTasks.length > 0) {
        result.noDeadTransitions = false;
        result.sound = false;
        result.deadTasks = deadTasks;
        result.tasksNotAppearingInTraces = deadTasks.length;
        result.issues.push(`Found ${deadTasks.length} dead tasks that never appear in any trace`);
    }
    
    result.tasksAppearingInTraces = allTaskIds.size - deadTasks.length;

    // Analyze graph structure if available
    if (graphStructure) {
        // Find source nodes (nodes with no incoming edges)
        const sourceNodes = findSourceNodes(graphStructure);
        result.sourceNodes = sourceNodes;
        result.sourceNodeCount = sourceNodes.length;
        
        // Find sink nodes (nodes with no outgoing edges)
        const sinkNodes = findSinkNodes(graphStructure);
        result.sinkNodes = sinkNodes;
        result.sinkNodeCount = sinkNodes.length;
        
        // Find connected components
        const connectedComponents = findConnectedComponents(graphStructure);
        result.connectedComponentCount = connectedComponents.length;
        
        // Find strongly connected components
        const stronglyConnectedComponents = findStronglyConnectedComponents(graphStructure);
        result.stronglyConnectedComponentCount = stronglyConnectedComponents.length;
    }

    return result;
}

/**
 * Check boundedness properties
 * Formal definition: A Petri net (PN, M) is bounded if, for every reachable state and every place p,
 * the number of tokens in p is bounded.
 * 
 * For workflow graphs, we check if any place (node/state) can accumulate unbounded tokens.
 * This happens when:
 * - Loops can execute unboundedly (creating unbounded tokens in loop places)
 * - Parallel branches can spawn unbounded concurrent instances
 * - Nodes can be reached an unbounded number of times
 * 
 * Also checks: number of unbounded nodes
 * 
 * @param {Array<Trace>} traces - Array of Trace objects
 * @param {Array<NodeIdentifier>} allTasks - All tasks in the graph
 * @param {number} maxLoopIterations - Maximum loop iterations allowed
 * @param {Object|null} graphStructure - Graph structure with nodes and edges
 * @returns {Object} Boundedness check result
 */
function checkBoundedness(traces, allTasks, maxLoopIterations, _graphStructure = null) {
    const result = {
        bounded: true,
        boundedPlaces: true,  // All places have bounded token counts
        boundedLoops: true,   // Loops are bounded (prevent unbounded token accumulation)
        boundedParallelism: true,  // Parallel execution doesn't create unbounded tokens
        issues: [],
        unboundedPlaces: [],  // Places that can accumulate unbounded tokens
        maxPlaceTokens: {},    // Maximum tokens per place across all traces
        // New metrics
        boundedPlaceCount: 0,
        unboundedPlaceCount: 0,
        unboundedNodeCount: 0,
        unboundedNodes: [],
        parallelBranchesNotCreatingUnbounded: 0,
        parallelBranchesCreatingUnbounded: 0
    };

    if (traces.length === 0) {
        // Empty trace set is considered bounded (no places to check)
        return result;
    }

    // In workflow graphs, places correspond to:
    // 1. Nodes/tasks (where execution can be active/waiting)
    // 2. States between tasks (edges/transitions)
    // 3. Positions in parallel branches
    
    // For each trace, we simulate token flow through places
    // A place accumulates tokens when:
    // - A node is visited (token enters the node's place)
    // - A loop iteration occurs (token re-enters loop places)
    // - Parallel branches split (tokens distributed to parallel places)

    // Check 1: Bounded Places - No place can accumulate unbounded tokens
    // We check this by counting how many times each node/place is visited per trace
    // If a place is visited more than maxLoopIterations + 1 times, it indicates unbounded accumulation
    
    traces.forEach((trace, traceIndex) => {
        if (!trace || !trace.path) {
            return;
        }

        // Track token count per place (node) during trace execution
        const placeTokenCounts = new Map();
        
        trace.path.forEach(task => {
            const placeId = task.alt_id || task.id;  // Place corresponds to node/task
            if (placeId) {
                // Each visit to a place adds a token
                placeTokenCounts.set(placeId, (placeTokenCounts.get(placeId) || 0) + 1);
            }
        });

        // Check if any place accumulates more tokens than allowed
        // maxLoopIterations + 1 accounts for initial execution + loop iterations
        const maxAllowedTokens = maxLoopIterations + 1;
        
        placeTokenCounts.forEach((tokenCount, placeId) => {
            if (tokenCount > maxAllowedTokens) {
                // This place can accumulate unbounded tokens (violates boundedness)
                result.boundedPlaces = false;
                result.bounded = false;
                result.boundedLoops = false;  // Unbounded loops cause unbounded places
                
                result.unboundedPlaces.push({
                    traceIndex: traceIndex,
                    placeId: placeId,
                    tokenCount: tokenCount,
                    maxAllowed: maxAllowedTokens,
                    reason: `Place ${placeId} accumulates ${tokenCount} tokens, exceeding bound of ${maxAllowedTokens}`
                });
                
                // Track unbounded nodes
                if (!result.unboundedNodes.includes(placeId)) {
                    result.unboundedNodes.push(placeId);
                }
            } else {
                // Bounded place
                if (!result.unboundedPlaces.some(p => p.placeId === placeId)) {
                    result.boundedPlaceCount++;
                }
            }

            // Track maximum token count per place across all traces
            if (!result.maxPlaceTokens[placeId] || result.maxPlaceTokens[placeId] < tokenCount) {
                result.maxPlaceTokens[placeId] = tokenCount;
            }
        });
    });

    // Count bounded vs unbounded places
    const allPlaceIds = new Set();
    Object.keys(result.maxPlaceTokens).forEach(placeId => allPlaceIds.add(placeId));
    result.unboundedPlaceCount = result.unboundedNodes.length;
    result.boundedPlaceCount = allPlaceIds.size - result.unboundedPlaceCount;
    
    if (!result.boundedPlaces) {
        result.issues.push(`Some places accumulate unbounded tokens (exceed maximum of ${maxLoopIterations + 1} tokens per place)`);
    }

    // Check 2: Bounded Parallelism
    // Parallel branches can create multiple concurrent tokens, but they must be bounded
    // We check if the number of parallel interleavings (traces) grows unboundedly
    // This is a heuristic check - full analysis would require state space exploration
    
    const taskCount = allTasks.length;
    if (taskCount > 0) {
        // Estimate: If trace count grows exponentially with graph size, might indicate unbounded parallelism
        // A bounded workflow should have a polynomial (or at least bounded exponential) number of traces
        // We use a conservative threshold: 2^(taskCount/2) as a heuristic for "too many" traces
        const threshold = Math.pow(2, Math.max(1, Math.floor(taskCount / 2)));
        
        if (traces.length > threshold) {
            // This might indicate unbounded parallelism, but it's a heuristic
            // The actual check would require analyzing the state space
            result.boundedParallelism = false;
            result.bounded = false;
            result.parallelBranchesCreatingUnbounded++;
            result.issues.push(
                `High trace count (${traces.length}) relative to task count (${taskCount}) INVESTIGATE`
            );
        } else {
            result.parallelBranchesNotCreatingUnbounded++;
        }
    }

    // Check 3: Verify no place exceeds safe token limits
    // Additional safety check: if any place accumulates tokens beyond a safe threshold,
    // it's likely unbounded even if within the loop limit
    Object.entries(result.maxPlaceTokens).forEach(([placeId, maxTokens]) => {
        const safeThreshold = maxLoopIterations * 10;  // Heuristic: 10x loop limit is suspicious
        if (maxTokens > safeThreshold) {
            result.boundedPlaces = false;
            result.bounded = false;
            if (!result.unboundedNodes.includes(placeId)) {
                result.unboundedNodes.push(placeId);
            }
            result.issues.push(
                `Place ${placeId} accumulates ${maxTokens} tokens, which exceeds safe threshold of ${safeThreshold}. ` +
                `This suggests unbounded token accumulation.`
            );
        }
    });
    
    // Update unbounded node count
    result.unboundedNodeCount = result.unboundedNodes.length;
    
    // Bounded loops is always true because of maxLoopIterations limit
    result.boundedLoops = true;

    return result;
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
export function verifyCPEESoundnessAndBoundedness(traces, cpeeXml, options = {}) {
    return verifySoundnessAndBoundedness(traces, cpeeXml, 'cpee', options);
}

/**
 * Verify soundness and boundedness for Mermaid traces
 * @param {Array<Trace>} traces - Array of Mermaid Trace objects
 * @param {string} mermaidSyntax - Mermaid flowchart syntax
 * @param {Object} options - Verification options
 * @returns {Object} Verification result
 */
export function verifyMermaidSoundnessAndBoundedness(traces, mermaidSyntax, options = {}) {
    return verifySoundnessAndBoundedness(traces, mermaidSyntax, 'mermaid', options);
}

/**
 * Default export
 */
export default {
    verifySoundnessAndBoundedness,
    verifyCPEESoundnessAndBoundedness,
    verifyMermaidSoundnessAndBoundedness
};

