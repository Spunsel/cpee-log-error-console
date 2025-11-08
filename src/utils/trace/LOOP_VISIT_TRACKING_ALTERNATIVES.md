# Alternatives for Fixing Loop Visit Tracking Issue

## Problem
When independent loops share a node, they share the same global visit limit. For example, if node 5 is part of two independent loops (filling adjustment and bite adjustment), visiting it 3 times (initial + 2 loops) exceeds the limit of `maxLoopIterations + 1 = 2`.

## Alternative Solutions

### Alternative 1: Path-Based Visit Tracking (Recommended)
**Concept**: Track visits per unique path context, not just node ID. Allow revisits if reached via different paths.

**Implementation**:
- Instead of `Map<nodeId, count>`, use `Map<pathSignature, count>`
- Path signature = sequence of nodes visited (or hash of path)
- Allow revisiting a node if the path to reach it is different

**Pros**:
- Handles independent loops correctly
- More accurate representation of execution paths
- Allows natural loop exploration

**Cons**:
- More memory intensive (stores paths)
- More complex to implement
- May need path length limits

**Code Structure**:
```javascript
// Instead of: visitCounts = Map<nodeId, count>
// Use: visitCounts = Map<pathSignature, count>
// pathSignature = hash or string representation of path from start to current node
```

---

### Alternative 2: Per-Loop Context Visit Tracking
**Concept**: Track visit counts separately for each loop context. When entering a loop, use separate counters for nodes within that loop.

**Implementation**:
- Track which loop(s) a node belongs to
- Maintain separate visit counts per loop context
- When a node is part of multiple loops, allow separate limits for each

**Pros**:
- Clear separation of loop contexts
- Handles shared nodes correctly
- More intuitive for loop-based workflows

**Cons**:
- Requires detecting loop boundaries (complex in graph structure)
- Need to identify which loop a node belongs to
- May be difficult to determine loop membership in complex graphs

**Code Structure**:
```javascript
// visitCounts = Map<nodeId, Map<loopContext, count>>
// loopContext = identifier for the loop (e.g., gateway ID that starts the loop)
```

---

### Alternative 3: Increase Visit Limit for Shared Nodes
**Concept**: Detect when a node is part of multiple loops and increase its visit limit proportionally.

**Implementation**:
- Pre-process graph to identify nodes in multiple loops
- For shared nodes, multiply visit limit by number of loops: `(maxLoopIterations + 1) * loopCount`

**Pros**:
- Simple to implement
- Minimal changes to existing code
- Handles the specific case well

**Cons**:
- May allow too many visits in some cases
- Doesn't distinguish between independent vs. nested loops
- Could generate more traces than intended

**Code Structure**:
```javascript
// Pre-process: identify nodes in multiple loops
// During traversal: if (nodeInMultipleLoops) {
//   limit = (maxLoopIterations + 1) * loopCount
// }
```

---

### Alternative 4: Reset Visit Counts After Loop Exit
**Concept**: When exiting a loop (reaching a join gateway), reset visit counts for nodes that were only visited within that loop.

**Implementation**:
- Track which nodes were visited within each loop
- When exiting a loop, reset counts for nodes that are only in that loop
- Keep counts for nodes shared across loops

**Pros**:
- Allows independent loops to run separately
- More accurate loop isolation
- Handles nested loops better

**Cons**:
- Complex to track which nodes belong to which loop
- Need to detect loop boundaries accurately
- May reset too aggressively

**Code Structure**:
```javascript
// Track: nodesVisitedInCurrentLoop = Set<nodeId>
// On loop exit: reset visitCounts for nodes only in that loop
```

---

### Alternative 5: Depth-Based Visit Tracking
**Concept**: Allow more visits based on recursion depth. Deeper paths (more loops) get higher limits.

**Implementation**:
- Track depth (number of loops entered)
- Visit limit = `(maxLoopIterations + 1) * (1 + depthMultiplier)`
- Or: `(maxLoopIterations + 1) + depth`

**Pros**:
- Simple to implement
- Naturally handles nested loops
- Progressive limit increase

**Cons**:
- May allow too many visits
- Doesn't distinguish independent vs. nested loops
- Could be too permissive

**Code Structure**:
```javascript
// limit = (maxLoopIterations + 1) + (depth * depthMultiplier)
// or: limit = (maxLoopIterations + 1) * (1 + depth)
```

---

### Alternative 6: Separate Visit Limits Per Loop Cycle
**Concept**: Track visits per loop cycle. Each time we enter a new loop iteration, allow fresh visits to nodes.

**Implementation**:
- Track current loop iteration number
- Reset or use separate counters when entering new loop iteration
- Allow `maxLoopIterations + 1` visits per loop cycle

**Pros**:
- Natural loop semantics
- Handles loop iterations correctly
- Clear separation of cycles

**Cons**:
- Requires detecting loop cycles (complex)
- Need to identify loop entry/exit points
- May be difficult in graph structure

**Code Structure**:
```javascript
// Track: currentLoopCycle = number
// visitCounts = Map<nodeId, Map<loopCycle, count>>
// Reset or use separate counter per cycle
```

---

## Recommendation

**Alternative 1 (Path-Based Visit Tracking)** is recommended because:
1. Most accurate representation of execution paths
2. Handles all cases: independent loops, nested loops, shared nodes
3. Natural extension of current approach
4. Can be optimized with path hashing to reduce memory

**Alternative 3 (Increase Limit for Shared Nodes)** is the simplest quick fix if you need a fast solution, but may be less accurate.

## Implementation Notes

For Alternative 1, you would:
1. Track path signature (e.g., hash of node sequence or last N nodes)
2. Check visit count per path signature, not just node ID
3. Allow revisiting a node if reached via different path

Example:
```javascript
// Current: visitCounts.get(nodeId)
// New: visitCounts.get(pathSignature + ':' + nodeId)
// pathSignature = hash of last N nodes in path, or full path if short
```

