/**
 * CPEE Trace Walker
 * 
 * Walks a given trace sequence step-by-step through a CPEE XML tree to determine
 * if the trace represents a valid execution path. No iteration limits — the trace
 * itself is the bound. Escape elements terminate the walk.
 */

import { CPEEParser } from '../content/CPEEParser.js';

export class CPEETraceWalker {
    /**
     * Check whether a single trace sequence is a valid path through the CPEE graph.
     *
     * @param {string} xmlString - CPEE XML content
     * @param {Array<string>} sequence - Ordered task identifiers (id or alt_id)
     * @returns {{ valid: boolean, matchedPath: Array<Object>|null, reason: string|null }}
     */
    static validateTrace(xmlString, sequence) {
        if (!sequence || sequence.length === 0) {
            return { valid: false, matchedPath: null, reason: 'Empty trace sequence' };
        }

        try {
            const description = this.parseDescription(xmlString);
            if (!description) {
                return { valid: false, matchedPath: null, reason: 'Could not parse CPEE XML' };
            }

            const taskMap = this.buildTaskMap(description);
            const matchedPath = [];

            const ok = this.walkBlock(
                Array.from(description.children),
                sequence,
                0,
                taskMap,
                matchedPath
            );

            if (ok && matchedPath.length === sequence.length) {
                return { valid: true, matchedPath, reason: null };
            }
            return { valid: false, matchedPath: null, reason: 'Trace sequence does not match any valid path in CPEE graph' };
        } catch (error) {
            return { valid: false, matchedPath: null, reason: `Validation error: ${error.message}` };
        }
    }

    /**
     * Validate multiple trace sequences against a CPEE graph.
     *
     * @param {string} xmlString - CPEE XML content
     * @param {Array<Array<string>>} sequences - Array of trace sequences
     * @returns {{ validCount: number, invalidCount: number, results: Array }}
     */
    static validateMultipleTraces(xmlString, sequences) {
        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        for (const sequence of sequences) {
            const result = this.validateTrace(xmlString, sequence);
            if (result.valid) { validCount++; } else { invalidCount++; }
            results.push({ sequence, ...result });
        }

        return { validCount, invalidCount, results };
    }

    // ── XML parsing helpers ──────────────────────────────────────────────

    static parseDescription(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') { return null; }
        try {
            let xml = xmlString;
            try { xml = CPEEParser.cleanAndValidate(xmlString, true).xml; } catch (_) { /* ignore */ }
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            if (doc.querySelector('parsererror')) { return null; }
            return doc.querySelector('description') || doc.documentElement;
        } catch (_) { return null; }
    }

    /**
     * Build a map from every id/alt_id to the extracted task object so we can
     * resolve sequence identifiers in O(1).
     */
    static buildTaskMap(description) {
        const map = new Map();
        for (const el of description.querySelectorAll('call, manipulate, script')) {
            const task = this.extractTask(el);
            if (!task) { continue; }
            if (task.id) { map.set(task.id, task); }
            if (task.alt_id) { map.set(String(task.alt_id), task); }
        }
        return map;
    }

    static extractTask(node) {
        const id = node.getAttribute('id');
        if (!id) { return null; }

        const altId = node.getAttribute('a:alt_id')
            || node.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id')
            || null;

        let label = node.getAttribute('label') || '';
        if (!label) {
            const labelEl = node.querySelector('parameters > label');
            if (labelEl) { label = labelEl.textContent.trim(); }
        }

        return { id, alt_id: altId, task: label };
    }

    /**
     * Does a given sequence identifier match a task?
     */
    static taskMatches(task, seqId) {
        const s = String(seqId);
        return s === task.id || (task.alt_id !== null && s === String(task.alt_id));
    }

    // ── Core walking logic ───────────────────────────────────────────────

    /**
     * Walk a sequential block of XML children, consuming as many sequence
     * entries as possible starting at `pos`.
     *
     * @returns {boolean} true if the entire remaining sequence was consumed
     *   (pos reached sequence.length) after processing all children.
     */
    static walkBlock(children, sequence, pos, taskMap, matchedPath) {
        for (const child of children) {
            if (pos >= sequence.length) { return true; }

            const result = this.walkNode(child, sequence, pos, taskMap, matchedPath);
            if (result === -1) { return false; }
            pos = result;
        }
        return pos >= sequence.length;
    }

    /**
     * Walk a single XML node. Returns the new position in the sequence after
     * consuming whatever this node consumes, or -1 on failure.
     *
     * For structural nodes (choose, loop, parallel, etc.) this recurses into
     * children. For task nodes (call, manipulate, script) it consumes exactly
     * one sequence entry.
     */
    static walkNode(node, sequence, pos, taskMap, matchedPath) {
        const tag = (node.tagName || '').toLowerCase();

        switch (tag) {
            case 'call':
            case 'manipulate':
            case 'script':
                return this.walkTask(node, sequence, pos, taskMap, matchedPath);

            case 'choose':
                return this.walkChoose(node, sequence, pos, taskMap, matchedPath);

            case 'loop':
                return this.walkLoop(node, sequence, pos, taskMap, matchedPath);

            case 'parallel':
                return this.walkParallel(node, sequence, pos, taskMap, matchedPath);

            case 'alternative':
            case 'otherwise':
            case 'parallel_branch':
            case 'description':
                return this.walkContainer(node, sequence, pos, taskMap, matchedPath);

            case 'escape':
                return pos;

            default:
                return this.walkContainer(node, sequence, pos, taskMap, matchedPath);
        }
    }

    /**
     * A task node must match the current sequence entry exactly.
     */
    static walkTask(node, sequence, pos, taskMap, matchedPath) {
        if (pos >= sequence.length) { return -1; }

        const task = this.extractTask(node);
        if (!task) { return -1; }

        if (!this.taskMatches(task, sequence[pos])) { return -1; }

        matchedPath.push(task);
        return pos + 1;
    }

    /**
     * A choose node: exactly one alternative must successfully consume the
     * remaining sequence from pos.
     */
    static walkChoose(node, sequence, pos, taskMap, matchedPath) {
        const alternatives = Array.from(node.children).filter(c => {
            const t = c.tagName.toLowerCase();
            return t === 'alternative' || t === 'otherwise';
        });

        const mode = (node.getAttribute('mode') || '').toLowerCase();

        if (mode === 'inclusive') {
            return this.walkInclusiveChoose(alternatives, sequence, pos, taskMap, matchedPath);
        }

        for (const alt of alternatives) {
            const saved = matchedPath.length;
            const result = this.walkContainer(alt, sequence, pos, taskMap, matchedPath);
            if (result !== -1) { return result; }
            matchedPath.length = saved;
        }
        return -1;
    }

    /**
     * Inclusive choose (OR gateway): one or more alternatives are taken.
     * We try every non-empty subset (smallest first) and accept the first
     * that fully consumes the remaining sequence portion.
     */
    static walkInclusiveChoose(alternatives, sequence, pos, taskMap, matchedPath) {
        const n = alternatives.length;
        for (let mask = 1; mask < (1 << n); mask++) {
            const subset = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) { subset.push(alternatives[i]); }
            }
            const saved = matchedPath.length;
            const result = this.walkParallelBranches(subset, sequence, pos, taskMap, matchedPath);
            if (result !== -1) { return result; }
            matchedPath.length = saved;
        }
        return -1;
    }

    /**
     * A loop node: the body may repeat 0+ times. The trace itself bounds
     * iterations. An escape inside the body terminates the loop.
     */
    static walkLoop(node, sequence, pos, taskMap, matchedPath) {
        const bodyChildren = Array.from(node.children).filter(c =>
            c.tagName.toLowerCase() !== 'condition'
        );

        while (pos < sequence.length) {
            const saved = matchedPath.length;
            const result = this.walkBlockReturn(bodyChildren, sequence, pos, taskMap, matchedPath);

            if (result === -1) {
                matchedPath.length = saved;
                break;
            }
            if (result === pos) {
                break;
            }
            pos = result;
        }

        return pos;
    }

    /**
     * Parallel node: all branches must be consumed. The trace may interleave
     * branch tasks in any order.
     */
    static walkParallel(node, sequence, pos, taskMap, matchedPath) {
        const branches = Array.from(node.children).filter(c =>
            c.tagName.toLowerCase() === 'parallel_branch'
        );
        if (branches.length === 0) { return pos; }
        return this.walkParallelBranches(branches, sequence, pos, taskMap, matchedPath);
    }

    /**
     * Walk a set of parallel branches whose tasks may appear interleaved in
     * the sequence. Each branch is a list of XML children that must be consumed
     * in order, but branches may interleave freely.
     *
     * We flatten each branch into its expected task sequence, then greedily
     * match the trace against any branch that expects the current task.
     */
    static walkParallelBranches(branches, sequence, pos, taskMap, matchedPath) {
        const branchTasks = branches.map(branch => {
            const tasks = [];
            this.collectTasks(Array.from(branch.children).filter(c => {
                const t = c.tagName.toLowerCase();
                return !t.startsWith('_') && t !== 'condition';
            }), tasks, taskMap);
            return tasks;
        });

        const cursors = new Array(branchTasks.length).fill(0);
        const totalTasks = branchTasks.reduce((s, b) => s + b.length, 0);
        let consumed = 0;

        while (consumed < totalTasks) {
            if (pos >= sequence.length) { return -1; }

            const seqId = sequence[pos];
            let matched = false;

            for (let b = 0; b < branchTasks.length; b++) {
                if (cursors[b] >= branchTasks[b].length) { continue; }
                const task = branchTasks[b][cursors[b]];
                if (this.taskMatches(task, seqId)) {
                    matchedPath.push(task);
                    cursors[b]++;
                    pos++;
                    consumed++;
                    matched = true;
                    break;
                }
            }

            if (!matched) { return -1; }
        }

        return pos;
    }

    /**
     * Collect the flat ordered list of tasks that a set of XML children would produce.
     * Used to pre-compute expected tasks for parallel branch interleaving.
     */
    static collectTasks(children, out, taskMap) {
        for (const child of children) {
            const tag = (child.tagName || '').toLowerCase();
            if (tag === 'call' || tag === 'manipulate' || tag === 'script') {
                const task = this.extractTask(child);
                if (task) { out.push(task); }
            } else if (tag === 'escape') {
                continue;
            } else {
                const inner = Array.from(child.children || []).filter(c => {
                    const t = c.tagName.toLowerCase();
                    return !t.startsWith('_') && t !== 'condition';
                });
                this.collectTasks(inner, out, taskMap);
            }
        }
    }

    /**
     * Generic container: just walk children sequentially (skipping metadata).
     */
    static walkContainer(node, sequence, pos, taskMap, matchedPath) {
        const children = Array.from(node.children).filter(c => {
            const t = c.tagName.toLowerCase();
            return !t.startsWith('_') && t !== 'condition';
        });
        return this.walkBlockReturn(children, sequence, pos, taskMap, matchedPath);
    }

    /**
     * Like walkBlock but returns the new position instead of a boolean.
     */
    static walkBlockReturn(children, sequence, pos, taskMap, matchedPath) {
        for (const child of children) {
            const result = this.walkNode(child, sequence, pos, taskMap, matchedPath);
            if (result === -1) { return -1; }
            pos = result;
        }
        return pos;
    }
}
