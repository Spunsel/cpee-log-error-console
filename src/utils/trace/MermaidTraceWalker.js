/**
 * Mermaid Trace Walker
 * 
 * Walks a given trace sequence step-by-step through a Mermaid flowchart graph
 * to determine if the trace represents a valid execution path from start to end.
 * No iteration limits — the trace itself is the bound.
 * Escalate nodes terminate the walk (equivalent to CPEE escape).
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
     *
     * @returns {boolean} true when we consumed the full sequence and reached
     *   an end node or escalate node.
     */
    static walk(graph, nodeId, sequence, pos, endNodes, escalateNodes, matchedPath, depth = 0) {
        if (depth > sequence.length * 4 + graph.nodes.length * 2) { return false; }

        const node = graph.nodes.find(n => n.id === nodeId);
        if (!node) { return false; }

        if (escalateNodes.has(nodeId)) {
            return pos >= sequence.length;
        }

        if (endNodes.has(nodeId)) {
            return pos >= sequence.length;
        }

        const nexts = graph.adjacencyList.get(nodeId) || [];

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

        for (const next of nexts) {
            const ok = this.walk(graph, next, sequence, pos, endNodes, escalateNodes, matchedPath, depth + 1);
            if (ok) { return true; }
        }
        return false;
    }
}
