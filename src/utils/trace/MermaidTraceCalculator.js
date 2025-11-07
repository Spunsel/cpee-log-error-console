/**
 * Mermaid Trace Calculator
 * Calculates all possible execution traces (paths) from Mermaid flowchart syntax
 * Uses DFS approach to enumerate all paths from start to end
 * Similar to "All Paths From Source to Target" problem
 */

import { Trace } from '../../models/Trace.js';

export class MermaidTraceCalculator {
    /**
     * Calculate all possible execution traces from Mermaid syntax
     * @param {string} mermaidString - Mermaid flowchart syntax
     * @param {Object} options - Calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @param {number} options.maxPathLength - Maximum path length (default: 50)
     * @returns {Trace[]} Array of Trace objects
     */
    static calculateAllTraces(mermaidString, options = {}) {
        console.log('[MermaidTraceCalculator] Starting trace calculation from Mermaid syntax...');
        
        const {
            maxLoopIterations = 1,
            maxPathLength = 50
        } = options;

        try {
            // Parse Mermaid syntax to build graph
            const graph = this.parseMermaid(mermaidString);
            
            if (!graph || graph.nodes.length === 0) {
                console.warn('[MermaidTraceCalculator] No valid graph found');
                return [];
            }
            
            console.log('[MermaidTraceCalculator] Graph parsed successfully');
            console.log(`[MermaidTraceCalculator] Found ${graph.nodes.length} nodes:`, graph.nodes.map(n => `${n.id}:${n.type}:${n.label}`));
            
            // Find start and end nodes
            const startNodes = graph.nodes.filter(n => n.type === 'startevent');
            const endNodes = graph.nodes.filter(n => n.type === 'endevent');
            
            console.log(`[MermaidTraceCalculator] Start nodes: ${startNodes.length}`, startNodes.map(n => n.id));
            console.log(`[MermaidTraceCalculator] End nodes: ${endNodes.length}`, endNodes.map(n => n.id));
            
            if (startNodes.length === 0) {
                console.warn('[MermaidTraceCalculator] No start nodes found');
                console.warn('[MermaidTraceCalculator] Available node types:', [...new Set(graph.nodes.map(n => n.type))]);
                return [];
            }
            
            if (endNodes.length === 0) {
                console.warn('[MermaidTraceCalculator] No end nodes found');
                console.warn('[MermaidTraceCalculator] Available node types:', [...new Set(graph.nodes.map(n => n.type))]);
                return [];
            }
            
            // Find all paths from each start node to each end node
            const allPaths = [];
            
            for (const startNode of startNodes) {
                for (const endNode of endNodes) {
                    this.dfsFindAllPaths(
                        graph,
                        startNode.id,
                        endNode.id,
                        [],
                        allPaths,
                        maxLoopIterations,
                        maxPathLength
                    );
                }
            }
            
            // Filter duplicate paths
            const uniquePaths = this.filterDuplicatePaths(allPaths);
            
            // Convert paths to Trace objects
            const traces = uniquePaths.map((path, index) => {
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
        for (const line of contentLines) {
            // Parse edge: node1 --> node2 or node1 -->|label| node2
            // Split by --> first, then handle edge labels
            const arrowIndex = line.indexOf('-->');
            if (arrowIndex === -1) {
                continue; // Not an edge line
            }
            
            const beforeArrow = line.substring(0, arrowIndex).trim();
            const afterArrow = line.substring(arrowIndex + 3).trim();
            
            // Extract edge label if present: |label|
            let edgeLabel = null;
            let toNodeId = afterArrow;
            
            const labelMatch = afterArrow.match(/^\|([^|]+)\|\s*(.+)$/);
            if (labelMatch) {
                edgeLabel = labelMatch[1].trim();
                toNodeId = labelMatch[2].trim();
            }
            
            const fromNodeIdFull = beforeArrow;
            const toNodeIdFull = toNodeId;
            
            // Ensure nodes exist and get their short IDs
            const fromNodeId = this.ensureNodeExists(graph, fromNodeIdFull);
            const toNodeIdShort = this.ensureNodeExists(graph, toNodeIdFull);
            
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
        // Handle nested parentheses like ((startevent))
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
     * DFS to find all paths from start to end
     * @param {Object} graph - Graph object
     * @param {string} currentNode - Current node ID
     * @param {string} targetNode - Target end node ID
     * @param {Array} currentPath - Current path being built
     * @param {Array} allPaths - Array to collect all complete paths
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {number} maxPathLength - Maximum path length
     * @param {Map} visitedCounts - Map tracking how many times each node has been visited
     */
    static dfsFindAllPaths(
        graph,
        currentNode,
        targetNode,
        currentPath,
        allPaths,
        maxLoopIterations,
        maxPathLength,
        visitedCounts = new Map()
    ) {
        // Check path length limit
        if (currentPath.length >= maxPathLength) {
            console.log(`[MermaidTraceCalculator] Path length limit reached at node ${currentNode}, path length: ${currentPath.length}`);
            return;
        }
        
        // Get node info
        const node = graph.nodes.find(n => n.id === currentNode);
        if (!node) {
            console.log(`[MermaidTraceCalculator] Node ${currentNode} not found in graph`);
            return;
        }
        
        // Check loop limit - allow maxLoopIterations + 1 visits (initial + loop iterations)
        const visitCount = visitedCounts.get(currentNode) || 0;
        if (visitCount >= maxLoopIterations + 1) {
            console.log(`[MermaidTraceCalculator] Loop limit reached for node ${currentNode}, visitCount: ${visitCount}, max: ${maxLoopIterations + 1}`);
            return;
        }
        
        console.log(`[MermaidTraceCalculator] Visiting node ${currentNode} (type: ${node.type}), visitCount: ${visitCount}, path length: ${currentPath.length}`);
        
        // Add current node to path if it's a task
        if (node.type === 'task') {
            currentPath.push({
                id: null,
                alt_id: node.id,
                task: node.label
            });
        }
        
        // Check if we reached the target
        if (currentNode === targetNode) {
            // Only save if path has at least one task
            if (currentPath.length > 0) {
                allPaths.push([...currentPath]);
            }
            // Backtrack
            if (node.type === 'task') {
                currentPath.pop();
            }
            return;
        }
        
        // Get neighbors
        const neighbors = graph.adjacencyList.get(currentNode) || [];
        
        // Handle different node types
        if (node.type === 'parallelgateway') {
            // Parallel gateway - need to collect all branches and generate permutations
            this.handleParallelGateway(
                graph,
                currentNode,
                targetNode,
                currentPath,
                allPaths,
                maxLoopIterations,
                maxPathLength,
                visitedCounts
            );
            // Backtrack after handling parallel gateway
            if (node.type === 'task') {
                currentPath.pop();
            }
            return;
        } else if (node.type === 'exclusivegateway') {
            // Exclusive gateway - explore all branches
            this.handleExclusiveGateway(
                graph,
                currentNode,
                targetNode,
                currentPath,
                allPaths,
                maxLoopIterations,
                maxPathLength,
                visitedCounts
            );
            // Backtrack after handling exclusive gateway
            if (node.type === 'task') {
                currentPath.pop();
            }
            return;
        } else {
            // Regular node or start/end event - continue DFS
            const newVisitedCounts = new Map(visitedCounts);
            newVisitedCounts.set(currentNode, visitCount + 1);
            
            for (const edge of neighbors) {
                this.dfsFindAllPaths(
                    graph,
                    edge.to,
                    targetNode,
                    currentPath,
                    allPaths,
                    maxLoopIterations,
                    maxPathLength,
                    newVisitedCounts
                );
            }
        }
        
        // Backtrack: remove current node from path
        if (node.type === 'task') {
            currentPath.pop();
        }
    }

    /**
     * Handle parallel gateway - generate all permutations of branch orderings
     * @param {Object} graph - Graph object
     * @param {string} gatewayId - Parallel gateway node ID
     * @param {string} targetNode - Target end node ID
     * @param {Array} currentPath - Current path being built
     * @param {Array} allPaths - Array to collect all complete paths
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {number} maxPathLength - Maximum path length
     * @param {Map} visitedCounts - Map tracking visit counts
     */
    static handleParallelGateway(
        graph,
        gatewayId,
        targetNode,
        currentPath,
        allPaths,
        maxLoopIterations,
        maxPathLength,
        visitedCounts
    ) {
        const neighbors = graph.adjacencyList.get(gatewayId) || [];
        
        // Find the join gateway by looking for a parallel gateway that all branches connect to
        let joinGateway = null;
        const branchTargets = neighbors.map(e => e.to);
        
        // Check each potential join gateway
        for (const potentialJoin of graph.nodes) {
            if (potentialJoin.type === 'parallelgateway' && potentialJoin.id !== gatewayId) {
                // Check if all branches eventually lead to this gateway
                let allBranchesReachJoin = true;
                for (const branchTarget of branchTargets) {
                    if (!this.pathExists(graph, branchTarget, potentialJoin.id, 20)) {
                        allBranchesReachJoin = false;
                        break;
                    }
                }
                
                // Also check if there are incoming edges from the branches (direct or indirect)
                // Count how many branches have paths that lead to this gateway
                let branchesReachingJoin = 0;
                for (const branchTarget of branchTargets) {
                    if (this.pathExists(graph, branchTarget, potentialJoin.id, 20)) {
                        branchesReachingJoin++;
                    }
                }
                
                // The join gateway should be reachable from all branches
                if (allBranchesReachJoin && branchesReachingJoin === branchTargets.length) {
                    joinGateway = potentialJoin.id;
                    break;
                }
            }
        }
        
        // If no join gateway found, treat branches as independent paths
        if (!joinGateway) {
            const newVisitedCounts = new Map(visitedCounts);
            newVisitedCounts.set(gatewayId, (visitedCounts.get(gatewayId) || 0) + 1);
            
            for (const edge of neighbors) {
                this.dfsFindAllPaths(
                    graph,
                    edge.to,
                    targetNode,
                    currentPath,
                    allPaths,
                    maxLoopIterations,
                    maxPathLength,
                    newVisitedCounts
                );
            }
            return;
        }
        
        // Collect all paths through each branch
        const branchPathLists = [];
        const newVisitedCounts = new Map(visitedCounts);
        newVisitedCounts.set(gatewayId, (visitedCounts.get(gatewayId) || 0) + 1);
        
        console.log(`[MermaidTraceCalculator] Parallel gateway ${gatewayId} has ${neighbors.length} branches, join gateway: ${joinGateway}`);
        
        for (let i = 0; i < neighbors.length; i++) {
            const edge = neighbors[i];
            const branchPaths = [];
            
            // Collect all paths along this branch until we reach the join gateway
            // Use a fresh visitedCounts for each branch to avoid interference
            const branchVisitedCounts = new Map(newVisitedCounts);
            this.collectAllBranchPaths(
                graph,
                edge.to,
                joinGateway,
                [],
                branchPaths,
                maxLoopIterations,
                maxPathLength,
                branchVisitedCounts
            );
            
            console.log(`[MermaidTraceCalculator] Branch ${i} (${edge.to} -> ${joinGateway}) collected ${branchPaths.length} paths:`, branchPaths.map(p => p.map(t => t.alt_id).join('→')));
            
            if (branchPaths.length === 0) {
                // Empty branch - add empty path
                branchPathLists.push([[]]);
            } else {
                branchPathLists.push(branchPaths);
            }
        }
        
        console.log(`[MermaidTraceCalculator] Branch path lists:`, branchPathLists.map((list, i) => `Branch ${i}: ${list.length} paths`));
        
        // Generate Cartesian product of all branch paths, then permute each combination
        const allCombinations = this.cartesianProduct(branchPathLists);
        
        console.log(`[MermaidTraceCalculator] Generated ${allCombinations.length} combinations from Cartesian product`);
        
        // For each combination, generate all permutations of branch orderings
        for (const combination of allCombinations) {
            // Generate permutations of this combination
            const branchPermutations = this.generatePermutations(combination);
            
            for (const branchOrder of branchPermutations) {
                const parallelPath = [...currentPath];
                
                // Add all tasks from branches in this order
                for (const branchTasks of branchOrder) {
                    parallelPath.push(...branchTasks);
                }
                
                // Continue DFS from join gateway
                const joinVisitedCounts = new Map(newVisitedCounts);
                joinVisitedCounts.set(joinGateway, (visitedCounts.get(joinGateway) || 0) + 1);
                
                this.dfsFindAllPaths(
                    graph,
                    joinGateway,
                    targetNode,
                    parallelPath,
                    allPaths,
                    maxLoopIterations,
                    maxPathLength,
                    joinVisitedCounts
                );
            }
        }
    }

    /**
     * Collect all paths through a branch until reaching a target node
     * @param {Object} graph - Graph object
     * @param {string} currentNode - Current node ID
     * @param {string} targetNode - Target node ID (join gateway)
     * @param {Array} currentBranchPath - Current branch path (array of task objects)
     * @param {Array} allBranchPaths - Array to collect all branch paths
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {number} maxPathLength - Maximum path length
     * @param {Map} visitedCounts - Map tracking visit counts
     */
    static collectAllBranchPaths(
        graph,
        currentNode,
        targetNode,
        currentBranchPath,
        allBranchPaths,
        maxLoopIterations,
        maxPathLength,
        visitedCounts
    ) {
        if (currentBranchPath.length >= maxPathLength) {
            return;
        }
        
        // Check if we reached the target
        if (currentNode === targetNode) {
            if (currentBranchPath.length > 0) {
                allBranchPaths.push([...currentBranchPath]);
            } else {
                // Empty branch path
                allBranchPaths.push([]);
            }
            return;
        }
        
        // Get node info
        const node = graph.nodes.find(n => n.id === currentNode);
        if (!node) {
            return;
        }
        
        // Check loop limit - allow maxLoopIterations + 1 visits
        const visitCount = visitedCounts.get(currentNode) || 0;
        if (visitCount >= maxLoopIterations + 1) {
            return;
        }
        
        // Add task to branch path if it's a task node
        const newBranchPath = [...currentBranchPath];
        if (node.type === 'task') {
            newBranchPath.push({
                id: null,
                alt_id: node.id,
                task: node.label
            });
        }
        
        // Get neighbors
        const neighbors = graph.adjacencyList.get(currentNode) || [];
        
        // Handle different node types
        if (node.type === 'exclusivegateway') {
            // Exclusive gateway in branch - explore all branches
            const newVisitedCounts = new Map(visitedCounts);
            newVisitedCounts.set(currentNode, visitCount + 1);
            
            for (const edge of neighbors) {
                // Find join gateway for this exclusive gateway
                let joinGateway = null;
                for (const potentialJoin of graph.nodes) {
                    if (potentialJoin.type === 'exclusivegateway' && potentialJoin.id !== currentNode) {
                        const incomingFromBranches = graph.edges.filter(e => 
                            e.to === potentialJoin.id && neighbors.some(n => n.to === e.from)
                        );
                        if (incomingFromBranches.length === neighbors.length) {
                            joinGateway = potentialJoin.id;
                            break;
                        }
                    }
                }
                
                if (joinGateway) {
                    // Collect path through this branch to join gateway
                    this.collectAllBranchPaths(
                        graph,
                        edge.to,
                        joinGateway,
                        newBranchPath,
                        allBranchPaths,
                        maxLoopIterations,
                        maxPathLength,
                        newVisitedCounts
                    );
                } else {
                    // No join gateway - continue directly
                    this.collectAllBranchPaths(
                        graph,
                        edge.to,
                        targetNode,
                        newBranchPath,
                        allBranchPaths,
                        maxLoopIterations,
                        maxPathLength,
                        newVisitedCounts
                    );
                }
            }
        } else {
            // Regular node - continue DFS (explore all paths, not just ones leading to target)
            const newVisitedCounts = new Map(visitedCounts);
            newVisitedCounts.set(currentNode, visitCount + 1);
            
            if (neighbors.length === 0) {
                // Dead end - save current path if it has tasks
                if (newBranchPath.length > 0) {
                    allBranchPaths.push([...newBranchPath]);
                }
                return;
            }
            
            for (const edge of neighbors) {
                // Follow all paths (they should all lead to the join gateway eventually)
                this.collectAllBranchPaths(
                    graph,
                    edge.to,
                    targetNode,
                    newBranchPath,
                    allBranchPaths,
                    maxLoopIterations,
                    maxPathLength,
                    newVisitedCounts
                );
            }
        }
    }

    /**
     * Generate Cartesian product of arrays
     * @param {Array<Array>} arrays - Array of arrays
     * @returns {Array<Array>} Cartesian product
     */
    static cartesianProduct(arrays) {
        if (arrays.length === 0) {
            return [[]];
        }
        if (arrays.length === 1) {
            return arrays[0].map(item => [item]);
        }
        
        const [first, ...rest] = arrays;
        const restProduct = this.cartesianProduct(rest);
        const result = [];
        
        for (const item of first) {
            for (const product of restProduct) {
                result.push([item, ...product]);
            }
        }
        
        return result;
    }

    /**
     * Check if a path exists from source to target
     * @param {Object} graph - Graph object
     * @param {string} source - Source node ID
     * @param {string} target - Target node ID
     * @param {number} maxDepth - Maximum search depth
     * @returns {boolean} True if path exists
     */
    static pathExists(graph, source, target, maxDepth = 10) {
        if (source === target) {
            return true;
        }
        if (maxDepth <= 0) {
            return false;
        }
        
        const neighbors = graph.adjacencyList.get(source) || [];
        for (const edge of neighbors) {
            if (this.pathExists(graph, edge.to, target, maxDepth - 1)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Handle exclusive gateway - explore all branches
     * @param {Object} graph - Graph object
     * @param {string} gatewayId - Exclusive gateway node ID
     * @param {string} targetNode - Target end node ID
     * @param {Array} currentPath - Current path being built
     * @param {Array} allPaths - Array to collect all complete paths
     * @param {number} maxLoopIterations - Maximum loop iterations
     * @param {number} maxPathLength - Maximum path length
     * @param {Map} visitedCounts - Map tracking visit counts
     */
    static handleExclusiveGateway(
        graph,
        gatewayId,
        targetNode,
        currentPath,
        allPaths,
        maxLoopIterations,
        maxPathLength,
        visitedCounts
    ) {
        const neighbors = graph.adjacencyList.get(gatewayId) || [];
        const branchTargets = neighbors.map(e => e.to);
        
        // Find join gateway by looking for an exclusive gateway that all branches connect to
        let joinGateway = null;
        for (const potentialJoin of graph.nodes) {
            if (potentialJoin.type === 'exclusivegateway' && potentialJoin.id !== gatewayId) {
                // Check if all branches lead to this gateway
                let allBranchesReachJoin = true;
                for (const branchTarget of branchTargets) {
                    if (!this.pathExists(graph, branchTarget, potentialJoin.id, 20)) {
                        allBranchesReachJoin = false;
                        break;
                    }
                }
                
                if (allBranchesReachJoin) {
                    const incomingFromBranches = graph.edges.filter(e => 
                        e.to === potentialJoin.id && branchTargets.includes(e.from)
                    );
                    // Check if branches directly connect or eventually connect
                    if (incomingFromBranches.length > 0 || allBranchesReachJoin) {
                        joinGateway = potentialJoin.id;
                        break;
                    }
                }
            }
        }
        
        const newVisitedCounts = new Map(visitedCounts);
        newVisitedCounts.set(gatewayId, (visitedCounts.get(gatewayId) || 0) + 1);
        
        // Explore each branch independently (exclusive - only one branch is taken)
        for (const edge of neighbors) {
            if (joinGateway) {
                // Collect all paths through this branch to join gateway
                const branchPaths = [];
                this.collectAllBranchPaths(
                    graph,
                    edge.to,
                    joinGateway,
                    [],
                    branchPaths,
                    maxLoopIterations,
                    maxPathLength,
                    newVisitedCounts
                );
                
                // For each path through this branch, continue from join gateway
                for (const branchTasks of branchPaths) {
                    const branchPath = [...currentPath, ...branchTasks];
                    
                    // Continue from join gateway
                    const joinVisitedCounts = new Map(newVisitedCounts);
                    joinVisitedCounts.set(joinGateway, (visitedCounts.get(joinGateway) || 0) + 1);
                    
                    this.dfsFindAllPaths(
                        graph,
                        joinGateway,
                        targetNode,
                        branchPath,
                        allPaths,
                        maxLoopIterations,
                        maxPathLength,
                        joinVisitedCounts
                    );
                }
            } else {
                // No join gateway - continue directly from branch
                // This handles cases where branches go to different targets (e.g., one to end, one loops back)
                this.dfsFindAllPaths(
                    graph,
                    edge.to,
                    targetNode,
                    currentPath,
                    allPaths,
                    maxLoopIterations,
                    maxPathLength,
                    newVisitedCounts
                );
            }
        }
    }

    /**
     * Generate all permutations of an array of arrays
     * @param {Array<Array>} arrays - Array of arrays
     * @returns {Array<Array>} All permutations
     */
    static generatePermutations(arrays) {
        if (arrays.length === 0) {
            return [[]];
        }
        if (arrays.length === 1) {
            return [arrays[0]];
        }
        
        const indices = arrays.map((_, i) => i);
        const indexPermutations = this.permuteArray(indices);
        
        return indexPermutations.map(perm => perm.map(idx => arrays[idx]));
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
     * Filter duplicate paths
     * @param {Array} paths - Array of paths
     * @returns {Array} Array of unique paths
     */
    static filterDuplicatePaths(paths) {
        const uniquePaths = new Set();
        const result = [];
        
        for (const path of paths) {
            const pathString = JSON.stringify(path.map(t => ({ id: t.id, alt_id: t.alt_id, task: t.task })));
            if (!uniquePaths.has(pathString)) {
                uniquePaths.add(pathString);
                result.push(path);
            }
        }
        
        return result;
    }

    /**
     * Determine trace type based on path
     * @param {Array} path - Path array
     * @returns {string} Trace type
     */
    static determineTraceType(path) {
        const nodeIds = path.map(t => t.alt_id);
        const uniqueNodes = new Set(nodeIds);
        if (nodeIds.length > uniqueNodes.size) {
            return 'loop';
        }
        return 'sequential';
    }
}

