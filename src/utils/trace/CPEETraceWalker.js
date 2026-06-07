/**
 * CPEE Trace Walker
 *
 * Walks a given trace sequence step-by-step through a CPEE XML tree to determine
 * if the trace represents a valid execution path. No iteration limits — the trace
 * itself is the bound.
 *
 * Walking strategy: continuation-passing-style (CPS) depth-first search with
 * full backtracking. Each structural decision point (choose, loop iteration
 * count, parallel branch interleaving) is treated as a branching point. The
 * walker tries every viable option and accepts the first one that allows the
 * REMAINDER of the trace (and the remaining XML siblings after the current
 * subtree) to also succeed. If a local choice leads to a dead end further
 * down, the walker backtracks and tries the next option. This avoids the
 * greedy-local-commit problem where an early "looks good" decision blocks an
 * otherwise valid walk.
 *
 * CPEE control-flow semantics observed during walking:
 *   - <escape/>: jumps out of the NEAREST enclosing loop, even if the loop is
 *     not the immediate parent. All siblings after the escape (in every
 *     intermediate container — alternatives, parallel branches, etc.) are
 *     skipped, the current loop iteration is cut short, and no further
 *     iterations are attempted. If no ancestor is a loop, the escape is
 *     ignored (treated as a no-op for the surrounding block). Implemented by
 *     threading an `escapeCont` continuation through walking: each loop
 *     installs its own post-loop continuation as the escape target for code
 *     inside its body; nested loops shadow outer ones, matching "nearest
 *     enclosing loop" semantics.
 *   - <terminate/>: ends ALL execution. After encountering it the sequence MUST
 *     already be fully consumed; otherwise the trace cannot match this path.
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

            const ok = this.walkChildren(
                Array.from(description.children),
                0,
                sequence,
                0,
                taskMap,
                matchedPath,
                (finalPos) => finalPos === sequence.length,
                null
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

    /**
     * Filter that drops metadata-like children (underscore-prefixed tags and
     * <condition>) so they don't get walked as structural nodes.
     */
    static structuralChildren(node) {
        return Array.from(node.children || []).filter(c => {
            const t = (c.tagName || '').toLowerCase();
            return !t.startsWith('_') && t !== 'condition';
        });
    }

    // ── Core walking logic (CPS with backtracking) ───────────────────────

    /**
     * Walk a sequence of XML children (`children[idx..end]`) and, upon reaching
     * the end of the block, invoke `onComplete(pos)`. Returns true if some path
     * through this block (and its onComplete continuation) succeeds.
     *
     * Each child contributes its own continuation: the work it has to do is
     * "walk myself, then walk children[idx+1..end], then call onComplete".
     *
     * `escapeCont` carries the nearest enclosing loop's post-loop continuation
     * so that an <escape/> encountered arbitrarily deep inside the block can
     * jump directly past the loop, skipping all intermediate siblings. It is
     * `null` when no ancestor loop exists.
     */
    static walkChildren(children, idx, sequence, pos, taskMap, matchedPath, onComplete, escapeCont) {
        if (idx >= children.length) {
            return onComplete(pos);
        }
        return this.walkNode(children[idx], children, idx + 1, sequence, pos, taskMap, matchedPath, onComplete, escapeCont);
    }

    /**
     * Walk a single XML node with an explicit continuation describing what
     * comes after it in its parent block. Returns true if the node + the
     * continuation succeed for some sequence of internal choices.
     */
    static walkNode(node, parentChildren, parentNextIdx, sequence, pos, taskMap, matchedPath, onComplete, escapeCont) {
        const tag = (node.tagName || '').toLowerCase();
        const continuation = (newPos) => this.walkChildren(parentChildren, parentNextIdx, sequence, newPos, taskMap, matchedPath, onComplete, escapeCont);

        switch (tag) {
            case 'call':
            case 'manipulate':
            case 'script':
                return this.walkTask(node, continuation, sequence, pos, matchedPath);

            case 'choose':
                return this.walkChoose(node, continuation, sequence, pos, taskMap, matchedPath, escapeCont);

            case 'loop':
                return this.walkLoop(node, continuation, sequence, pos, taskMap, matchedPath, escapeCont);

            case 'parallel':
                return this.walkParallel(node, continuation, sequence, pos, taskMap, matchedPath, escapeCont);

            case 'escape':
                // Jump out of the nearest enclosing loop. The loop installed
                // its post-loop continuation as `escapeCont` when its body
                // was walked, so calling it here bypasses all intermediate
                // siblings (rest of the alternative, rest of the body, any
                // further iterations) and resumes immediately after the loop.
                // If no ancestor is a loop, the escape is ignored — fall
                // through to the local sibling continuation.
                if (escapeCont) {
                    return escapeCont(pos);
                }
                return continuation(pos);

            case 'terminate':
                // Ends ALL execution: trace must already be fully consumed.
                return pos >= sequence.length;

            case 'alternative':
            case 'otherwise':
            case 'parallel_branch':
            case 'description':
            default: {
                // Generic container: walk its structural children, then the
                // parent's continuation. The same `escapeCont` propagates
                // inwards (these containers don't shadow loops).
                const inner = this.structuralChildren(node);
                return this.walkChildren(inner, 0, sequence, pos, taskMap, matchedPath, continuation, escapeCont);
            }
        }
    }

    /**
     * A task node must match the current sequence entry. On success, push to
     * matchedPath and invoke the continuation; on failure (or if the
     * continuation later fails), restore matchedPath and return false.
     */
    static walkTask(node, continuation, sequence, pos, matchedPath) {
        if (pos >= sequence.length) { return false; }

        const task = this.extractTask(node);
        if (!task || !this.taskMatches(task, sequence[pos])) { return false; }

        matchedPath.push(task);
        if (continuation(pos + 1)) { return true; }
        matchedPath.pop();
        return false;
    }

    /**
     * Choose node: try each alternative paired with the post-choose
     * continuation. Accept the first combination that succeeds globally. This
     * is the heart of the backtracking fix — we never commit to an alternative
     * just because it locally makes progress; the rest of the trace must also
     * succeed.
     *
     * `escapeCont` is propagated into each alternative so that an <escape/>
     * deep inside any alternative can still reach the enclosing loop.
     */
    static walkChoose(node, continuation, sequence, pos, taskMap, matchedPath, escapeCont) {
        const alternatives = Array.from(node.children).filter(c => {
            const t = c.tagName.toLowerCase();
            return t === 'alternative' || t === 'otherwise';
        });

        const mode = (node.getAttribute('mode') || '').toLowerCase();
        if (mode === 'inclusive') {
            return this.walkInclusiveChoose(alternatives, continuation, sequence, pos, taskMap, matchedPath);
        }

        let escapeWasFired = false;
        const wrappedEscapeCont = escapeCont ? (escapePos) => {
            escapeWasFired = true;
            return escapeCont(escapePos);
        } : null;

        for (const alt of alternatives) {
            const altChildren = this.structuralChildren(alt);
            const saved = matchedPath.length;
            if (this.walkChildren(altChildren, 0, sequence, pos, taskMap, matchedPath, continuation, wrappedEscapeCont)) {
                return true;
            }
            matchedPath.length = saved;
            
            // If an escape fired in this alternative, don't try other alternatives.
            // The escape has committed to exiting the enclosing loop, so other
            // branches of this choose are unreachable.
            if (escapeWasFired) {
                return false;
            }
        }
        return false;
    }

    /**
     * Inclusive choose (OR gateway): one or more alternatives are taken
     * concurrently. Try every non-empty subset, treating each like a set of
     * parallel branches. (Branches are flattened by `walkParallelBranches`,
     * so escape inside one is currently treated as a no-op — same as for
     * <parallel/>.)
     */
    static walkInclusiveChoose(alternatives, continuation, sequence, pos, taskMap, matchedPath) {
        const n = alternatives.length;
        for (let mask = 1; mask < (1 << n); mask++) {
            const subset = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) { subset.push(alternatives[i]); }
            }
            const saved = matchedPath.length;
            const newPos = this.walkParallelBranches(subset, sequence, pos, taskMap, matchedPath);
            if (newPos !== -1) {
                if (continuation(newPos)) { return true; }
            }
            matchedPath.length = saved;
        }
        return false;
    }

    /**
     * Loop node: try 0, 1, 2, ... iterations and accept the first count that
     * lets the continuation succeed. We delegate to `walkLoopIter`, which
     * recursively explores additional iterations only when the body actually
     * makes progress (otherwise we'd recurse forever on an empty body).
     *
     * A new `escapeCont` is installed for code inside this loop's body: it is
     * the same as the post-loop `continuation`, so an <escape/> anywhere
     * inside the body jumps directly past this loop. Nested loops shadow
     * this — they install their own escapeCont for their own bodies.
     * `outerEscapeCont` is intentionally ignored for the body but is what
     * would apply again to code AFTER this loop (carried by `continuation`'s
     * own captured environment).
     */
    static walkLoop(node, continuation, sequence, pos, taskMap, matchedPath, _outerEscapeCont) {
        const bodyChildren = Array.from(node.children).filter(c =>
            c.tagName.toLowerCase() !== 'condition'
        );
        const innerEscapeCont = (escapePos) => continuation(escapePos);
        return this.walkLoopIter(bodyChildren, continuation, innerEscapeCont, sequence, pos, taskMap, matchedPath);
    }

    /**
     * One step of the loop search: either stop here (0 more iterations) and
     * defer to the continuation, or walk the body once (with the loop's
     * escapeCont installed) and recurse to consider further iterations.
     */
    static walkLoopIter(bodyChildren, continuation, escapeCont, sequence, pos, taskMap, matchedPath) {
        // Option A: zero more iterations — hand off to the post-loop work.
        const saved = matchedPath.length;
        if (continuation(pos)) { return true; }
        matchedPath.length = saved;

        // Option B: walk the body once. Its onComplete is "try the loop
        // again at the new position". If <escape/> fires inside the body, it
        // calls escapeCont directly and bypasses this onComplete entirely —
        // so no further iterations are attempted. If the body cannot advance,
        // we must not iterate further (would recurse infinitely on an empty
        // body).
        return this.walkChildren(bodyChildren, 0, sequence, pos, taskMap, matchedPath, (newPos) => {
            if (newPos === pos) { return false; }
            return this.walkLoopIter(bodyChildren, continuation, escapeCont, sequence, newPos, taskMap, matchedPath);
        }, escapeCont);
    }

    /**
     * Parallel node: all branches must execute concurrently and the trace may
     * interleave them in any order. We flatten each branch to its expected
     * task sequence and greedily match branch heads against the trace; see
     * `walkParallelBranches`. (Escape inside a parallel branch is currently
     * a no-op, since branches are flattened to a task list. Improving that
     * requires structural walking of branches — out of scope here.)
     */
    static walkParallel(node, continuation, sequence, pos, taskMap, matchedPath, _escapeCont) {
        const branches = Array.from(node.children).filter(c =>
            c.tagName.toLowerCase() === 'parallel_branch'
        );
        if (branches.length === 0) {
            return continuation(pos);
        }
        const saved = matchedPath.length;
        const newPos = this.walkParallelBranches(branches, sequence, pos, taskMap, matchedPath);
        if (newPos === -1) {
            matchedPath.length = saved;
            return false;
        }
        if (continuation(newPos)) { return true; }
        matchedPath.length = saved;
        return false;
    }

    /**
     * Walk a set of parallel branches whose tasks may appear interleaved in
     * the sequence. Each branch is flattened into its expected task sequence;
     * branches may interleave freely in ANY order.
     * 
     * Uses backtracking to try all possible interleavings until one succeeds.
     */
    static walkParallelBranches(branches, sequence, pos, taskMap, matchedPath) {
        const branchTasks = branches.map(branch => {
            const tasks = [];
            this.collectTasks(this.structuralChildren(branch), tasks, taskMap);
            return tasks;
        });

        const cursors = new Array(branchTasks.length).fill(0);
        const totalTasks = branchTasks.reduce((s, b) => s + b.length, 0);

        // Backtracking search for valid interleaving
        return this.tryParallelInterleaving(
            branchTasks, cursors, 0, totalTasks, sequence, pos, taskMap, matchedPath
        );
    }

    /**
     * Recursive backtracking to find a valid interleaving of parallel branches.
     * 
     * @param {Array<Array>} branchTasks - Tasks for each branch
     * @param {Array<number>} cursors - Current position in each branch
     * @param {number} consumed - Number of tasks matched so far
     * @param {number} totalTasks - Total tasks across all branches
     * @param {Array<string>} sequence - Trace sequence
     * @param {number} pos - Current position in sequence
     * @param {Map} taskMap - Task ID map
     * @param {Array} matchedPath - Accumulated matched tasks
     * @returns {number} Final position in sequence, or -1 if no valid interleaving
     */
    static tryParallelInterleaving(branchTasks, cursors, consumed, totalTasks, sequence, pos, taskMap, matchedPath) {
        // Base case: all tasks consumed
        if (consumed >= totalTasks) {
            return pos;
        }

        // No more sequence to match
        if (pos >= sequence.length) {
            return -1;
        }

        const seqId = sequence[pos];

        // Try matching current sequence position against each branch's next task
        for (let b = 0; b < branchTasks.length; b++) {
            // Skip branches that are already complete
            if (cursors[b] >= branchTasks[b].length) {
                continue;
            }

            const task = branchTasks[b][cursors[b]];
            if (this.taskMatches(task, seqId)) {
                // This branch matches - try continuing from here
                const savedPathLength = matchedPath.length;
                matchedPath.push(task);
                cursors[b]++;

                const result = this.tryParallelInterleaving(
                    branchTasks, cursors, consumed + 1, totalTasks,
                    sequence, pos + 1, taskMap, matchedPath
                );

                if (result !== -1) {
                    // Found valid interleaving
                    return result;
                }

                // Backtrack: this choice didn't work
                matchedPath.length = savedPathLength;
                cursors[b]--;
            }
        }

        // No branch matched the current sequence position
        return -1;
    }

    /**
     * Collect the flat ordered list of tasks that a set of XML children would
     * produce. Used to pre-compute expected tasks for parallel branch
     * interleaving.
     */
    static collectTasks(children, out, taskMap) {
        for (const child of children) {
            const tag = (child.tagName || '').toLowerCase();
            if (tag === 'call' || tag === 'manipulate' || tag === 'script') {
                const task = this.extractTask(child);
                if (task) { out.push(task); }
            } else if (tag === 'escape' || tag === 'terminate') {
                continue;
            } else {
                this.collectTasks(this.structuralChildren(child), out, taskMap);
            }
        }
    }
}
