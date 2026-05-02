/**
 * Mermaid Trace Walker
 *
 * Walks a given trace sequence step-by-step through a Mermaid flowchart graph
 * to determine if the trace represents a valid execution path from start to end.
 * No iteration limits — the trace itself is the bound.
 *
 * Escalate semantics: in the CPEE→Mermaid translation, BPMN escalate nodes
 * represent a `<escape/>` jumping out of an enclosing loop.  They are NOT
 * end events.  A correctly-translated graph gives the escalate node an outgoing
 * edge that bypasses the loop (typically routed via the loop's end gateway).
 * The walker therefore passes through escalate nodes following their outgoing
 * edges, only treating them as terminal when no successor exists.
 */

import { MermaidParser } from '../content/MermaidParser.js';

export class MermaidTraceWalker {
    /**
     * Check whether a single trace sequence is a valid path through the Mermaid graph.
     *
     * @param {string} mermaidString - Mermaid flowchart content
     * @param {Array<string>} sequence - Ordered task identifiers (node id or alt_id)
     * @returns {{ valid: boolean, matchedPath: Array<Object>|null, reason: string|null }}
     */
    static validateTrace(mermaidString, sequence) {
        if (!sequence || sequence.length === 0) {
            return { valid: false, matchedPath: null, reason: 'Empty trace sequence' };
        }

        try {
            const graph = this.parseGraph(mermaidString);
            if (!graph || graph.nodes.length === 0) {
                return { valid: false, matchedPath: null, reason: 'Could not parse Mermaid graph' };
            }

            const startNodes = graph.nodes.filter(n => n.type === 'startevent');
            const endNodes = new Set(graph.nodes.filter(n => n.type === 'endevent').map(n => n.id));
            // Escalate nodes are no longer treated as terminal — they're
            // pass-through control nodes that route out of the loop.  Kept here
            // only as a fallback set for nodes with no outgoing edges.
            const escalateNodes = new Set(graph.nodes.filter(n => n.type === 'escalate').map(n => n.id));

            if (startNodes.length === 0 || endNodes.size === 0) {
                return { valid: false, matchedPath: null, reason: 'Graph has no start or end node' };
            }

            for (const start of startNodes) {
                const matchedPath = [];
                const ok = this.walk(graph, start.id, sequence, 0, endNodes, escalateNodes, matchedPath);
                if (ok && matchedPath.length === sequence.length) {
                    return { valid: true, matchedPath, reason: null };
                }
            }

            return { valid: false, matchedPath: null, reason: 'Trace sequence does not match any valid path in Mermaid graph' };
        } catch (error) {
            return { valid: false, matchedPath: null, reason: `Validation error: ${error.message}` };
        }
    }

    /**
     * Validate multiple trace sequences against a Mermaid graph.
     *
     * @param {string} mermaidString - Mermaid flowchart content
     * @param {Array<Array<string>>} sequences - Array of trace sequences
     * @returns {{ validCount: number, invalidCount: number, results: Array }}
     */
    static validateMultipleTraces(mermaidString, sequences) {
        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        for (const sequence of sequences) {
            const result = this.validateTrace(mermaidString, sequence);
            if (result.valid) { validCount++; } else { invalidCount++; }
            results.push({ sequence, ...result });
        }

        return { validCount, invalidCount, results };
    }

    // ── Graph helpers ────────────────────────────────────────────────────

    static parseGraph(mermaidString) {
        if (!mermaidString || typeof mermaidString !== 'string') { return null; }
        try {
            let code = mermaidString;
            try { code = MermaidParser.cleanAndValidate(mermaidString, true).code; } catch (_) { /* ignore */ }
            return this.buildGraph(code);
        } catch (_) { return null; }
    }

    /**
     * Minimal Mermaid parser — reuses the same id:type:(label) convention
     * as MermaidTraceCalculator.parseMermaid. Produces { nodes, adjacencyList }.
     */
    static buildGraph(mermaidString) {
        const graph = { nodes: [], adjacencyList: new Map() };
        const lines = mermaidString.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const content = lines.filter(l => !l.match(/^(graph|flowchart)\s+(LR|TD|TB|RL|BT)/i));

        let lastNodeId = null;
        for (const line of content) {
            const arrowIdx = line.indexOf('-->');
            if (arrowIdx === -1) {
                const m = line.match(/^([^:]+):([^:]+):(.+)$/);
                if (m) { lastNodeId = line.trim(); this.ensureNode(graph, lastNodeId); }
                continue;
            }

            const before = line.substring(0, arrowIdx).trim();
            const after = line.substring(arrowIdx + 3).trim();
            let fromFull = before || lastNodeId;
            if (!fromFull) { continue; }
            lastNodeId = before || lastNodeId;

            let toFull = after;
            const qm = after.match(/^\|("(?:[^"\\]|\\.)*")\|\s*(.+)$/);
            const sm = after.match(/^\|([^|]+)\|\s*(.+)$/);
            if (qm) { toFull = qm[2].trim(); }
            else if (sm) { toFull = sm[2].trim(); }

            const fromId = this.ensureNode(graph, fromFull);
            const toId = this.ensureNode(graph, toFull);
            lastNodeId = toFull;

            if (!graph.adjacencyList.has(fromId)) { graph.adjacencyList.set(fromId, []); }
            graph.adjacencyList.get(fromId).push(toId);
        }
        return graph;
    }

    static ensureNode(graph, fullId) {
        const existing = graph.nodes.find(n => n.fullId === fullId);
        if (existing) { return existing.id; }

        const m = fullId.match(/^([^:]+):([^:]+):(.+)$/);
        let shortId, type, label;
        if (m) {
            shortId = m[1].trim();
            type = m[2].trim();
            let lbl = m[3].trim();
            if (lbl.startsWith('(') && lbl.endsWith(')')) { lbl = lbl.slice(1, -1); }
            if (lbl.startsWith('(') && lbl.endsWith(')')) { lbl = lbl.slice(1, -1); }
            if (lbl.startsWith('{') && lbl.endsWith('}')) { lbl = lbl.slice(1, -1); }
            label = lbl.trim();
        } else {
            shortId = fullId; type = 'unknown'; label = fullId;
        }

        const byShort = graph.nodes.find(n => n.id === shortId);
        if (byShort) { byShort.fullId = fullId; return shortId; }

        graph.nodes.push({ id: shortId, type, label, fullId });
        return shortId;
    }

    static isTask(node) {
        return node.type === 'task' || node.type === 'subprocess' || node.type.endsWith('task');
    }

    static taskMatches(node, seqId) {
        const s = String(seqId);
        return s === node.id || s === node.label;
    }

    // ── Core walking logic ───────────────────────────────────────────────

    /**
     * Recursive walk through the graph. At each node we either consume a
     * sequence entry (task nodes) or pass through (gateways, events).
     * Parallel gateways with multiple outgoing edges are handled with AND
     * semantics: every branch must complete before proceeding past the join.
     *
     * @returns {boolean} true when we consumed the full sequence and reached
     *   an end node or escalate node.
     */
    static walk(graph, nodeId, sequence, pos, endNodes, escalateNodes, matchedPath, depth = 0) {
        if (depth > sequence.length * 4 + graph.nodes.length * 2) { return false; }

        const node = graph.nodes.find(n => n.id === nodeId);
        if (!node) { return false; }

        if (endNodes.has(nodeId)) {
            return pos >= sequence.length;
        }

        const nexts = graph.adjacencyList.get(nodeId) || [];

        // Escalate is a control-flow jump (out of loop), NOT termination.
        // Follow its outgoing edges; only treat as terminal when no successor.
        if (escalateNodes.has(nodeId)) {
            if (nexts.length === 0) {
                return pos >= sequence.length;
            }
            for (const next of nexts) {
                if (this.walk(graph, next, sequence, pos, endNodes, escalateNodes, matchedPath, depth + 1)) {
                    return true;
                }
            }
            return false;
        }

        if (this.isTask(node)) {
            if (pos >= sequence.length) { return false; }
            if (!this.taskMatches(node, sequence[pos])) { return false; }

            const task = { id: null, alt_id: node.id, task: node.label || node.id };
            matchedPath.push(task);

            for (const next of nexts) {
                const ok = this.walk(graph, next, sequence, pos + 1, endNodes, escalateNodes, matchedPath, depth + 1);
                if (ok) { return true; }
            }

            matchedPath.pop();
            return false;
        }

        if (node.type === 'parallelgateway' && nexts.length > 1) {
            return this.walkAndSplit(graph, nodeId, nexts, sequence, pos, endNodes, escalateNodes, matchedPath, depth);
        }

        for (const next of nexts) {
            const ok = this.walk(graph, next, sequence, pos, endNodes, escalateNodes, matchedPath, depth + 1);
            if (ok) { return true; }
        }
        return false;
    }

    // ── AND-gateway helpers ───────────────────────────────────────────────

    /**
     * Handle a parallel gateway split: find the matching join, then walk all
     * branches simultaneously, distributing trace entries across them.
     */
    static walkAndSplit(graph, splitId, branchStarts, sequence, pos, endNodes, escalateNodes, matchedPath, depth) {
        const joinId = this.findJoinGateway(graph, splitId, branchStarts);

        const branchNodes = branchStarts.slice();
        const maxSteps = (sequence.length + 1) * branchNodes.length * graph.nodes.length;

        const ok = this.advanceBranches(
            graph, branchNodes, splitId, joinId, sequence, pos,
            endNodes, escalateNodes, matchedPath, depth + 1, 0, maxSteps
        );
        return ok;
    }

    /**
     * Interleaved branch walker. Each branch independently advances through
     * its sub-graph; task nodes consume the next trace entry, non-task nodes
     * are passed through.  A branch is "done" when it reaches the join (or an
     * end/escalate node when no join exists).  Branches that loop back to the
     * split gateway are dead-ends.  Returns true only when ALL branches are
     * done and the remainder of the trace is valid from the join onward.
     */
    static advanceBranches(graph, branchNodes, splitId, joinId, sequence, pos, endNodes, escalateNodes, matchedPath, depth, steps, maxSteps) {
        if (steps > maxSteps) { return false; }

        // A branch counts as "done" when it reaches the join, an end node, or
        // an escalate node WITH NO outgoing edges (true dead-end escalate).
        // Escalates with outgoing edges keep advancing — they jump past the
        // enclosing loop's join.
        const isDeadEndEscalate = (nodeId) =>
            escalateNodes.has(nodeId) && (graph.adjacencyList.get(nodeId) || []).length === 0;

        const allDone = branchNodes.every(nodeId => {
            if (joinId) { return nodeId === joinId; }
            return endNodes.has(nodeId) || isDeadEndEscalate(nodeId);
        });

        if (allDone) {
            if (joinId) {
                return this.walk(graph, joinId, sequence, pos, endNodes, escalateNodes, matchedPath, depth + 1);
            }
            return pos >= sequence.length;
        }

        for (let i = 0; i < branchNodes.length; i++) {
            const nodeId = branchNodes[i];

            if (joinId && nodeId === joinId) { continue; }
            if (!joinId && (endNodes.has(nodeId) || isDeadEndEscalate(nodeId))) { continue; }
            if (nodeId === splitId) { continue; }

            const node = graph.nodes.find(n => n.id === nodeId);
            if (!node) { continue; }

            const nexts = graph.adjacencyList.get(nodeId) || [];

            if (this.isTask(node)) {
                if (pos >= sequence.length || !this.taskMatches(node, sequence[pos])) { continue; }

                const task = { id: null, alt_id: node.id, task: node.label || node.id };
                matchedPath.push(task);

                for (const next of nexts) {
                    const saved = branchNodes[i];
                    branchNodes[i] = next;
                    if (this.advanceBranches(graph, branchNodes, splitId, joinId, sequence, pos + 1, endNodes, escalateNodes, matchedPath, depth, steps + 1, maxSteps)) {
                        return true;
                    }
                    branchNodes[i] = saved;
                }

                matchedPath.pop();
            } else {
                for (const next of nexts) {
                    const saved = branchNodes[i];
                    branchNodes[i] = next;
                    if (this.advanceBranches(graph, branchNodes, splitId, joinId, sequence, pos, endNodes, escalateNodes, matchedPath, depth, steps + 1, maxSteps)) {
                        return true;
                    }
                    branchNodes[i] = saved;
                }
            }
        }

        return false;
    }

    /**
     * Find a join gateway for a split: the first parallel/inclusive gateway
     * reachable from every branch start (excluding the split itself).
     */
    static findJoinGateway(graph, splitId, branchStarts) {
        let fallback = null;

        for (const node of graph.nodes) {
            if (node.id === splitId) { continue; }
            const { type } = node;
            if (type !== 'parallelgateway' && type !== 'inclusivegateway' && type !== 'exclusivegateway') { continue; }

            if (!branchStarts.every(start => this.pathExistsTo(graph, start, node.id, splitId))) { continue; }

            if (type !== 'exclusivegateway') { return node.id; }
            if (!fallback) { fallback = node.id; }
        }
        return fallback;
    }

    /**
     * DFS reachability check that avoids re-entering the split gateway.
     */
    static pathExistsTo(graph, source, target, forbiddenId, maxDepth = 50, visited = new Set()) {
        if (source === target) { return true; }
        if (maxDepth <= 0 || visited.has(source)) { return false; }

        visited.add(source);
        const nexts = graph.adjacencyList.get(source) || [];
        for (const next of nexts) {
            if (next === forbiddenId) { continue; }
            if (this.pathExistsTo(graph, next, target, forbiddenId, maxDepth - 1, visited)) {
                return true;
            }
        }
        return false;
    }
}
