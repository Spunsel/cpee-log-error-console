/**
 * Trace Comparison Utility
 * Compares traces between CPEE and Mermaid formats.
 *
 * Identifier convention (canonical ID chain):
 *   Input CPEE  id  =  Input Mermaid id  =  Output Mermaid id  =  Output CPEE alt_id
 *
 * For comparison the system extracts one identifier per task:
 *   - Input CPEE    → task.id     (primary XML element id)
 *   - Input Mermaid → task.alt_id (diagram node id stored in alt_id by the calculator)
 *   - Output Mermaid→ task.alt_id (same convention)
 *   - Output CPEE   → task.alt_id (carries the preserved Mermaid id)
 *
 * When no sectionPair is supplied the legacy extraction is used (CPEE: alt_id
 * else id; Mermaid: alt_id) with dual-field matching.  This keeps all existing
 * call-sites working while new callers benefit from the simpler path.
 *
 * Performance: When sectionPair is provided, trace matching uses hash-based
 * lookup (O(n+m)) instead of pairwise comparison (O(n·m)).
 *
 * @module TraceComparison
 */

/**
 * Extract a flat identifier sequence from a CPEE trace.
 *
 * @param {Trace} cpeeTrace
 * @param {string|null} sectionPair - 'input' or 'output'; null for legacy mode
 * @returns {Array<string|null>}
 */
function extractCPEESequence(cpeeTrace, sectionPair = null) {
    if (!cpeeTrace || !cpeeTrace.path || !Array.isArray(cpeeTrace.path)) {
        return [];
    }

    if (sectionPair === 'input') {
        return cpeeTrace.path.map(task =>
            task.id !== undefined && task.id !== null ? String(task.id) : null
        );
    }

    if (sectionPair === 'output') {
        return cpeeTrace.path.map(task =>
            task.alt_id !== undefined && task.alt_id !== null ? String(task.alt_id) : null
        );
    }

    return cpeeTrace.path.map(task => {
        if (task.alt_id !== undefined && task.alt_id !== null) {
            return String(task.alt_id);
        }
        if (task.id !== undefined && task.id !== null) {
            return String(task.id);
        }
        return null;
    });
}

/**
 * Extract a flat identifier sequence from a Mermaid trace.
 * The Mermaid trace calculator stores the diagram node id in the alt_id field.
 *
 * @param {Trace} mermaidTrace
 * @returns {Array<string|null>}
 */
function extractMermaidSequence(mermaidTrace) {
    if (!mermaidTrace || !mermaidTrace.path || !Array.isArray(mermaidTrace.path)) {
        return [];
    }

    return mermaidTrace.path.map(task =>
        task.alt_id !== undefined && task.alt_id !== null ? String(task.alt_id) : null
    );
}

/**
 * Compute a hash string from a flat identifier sequence.
 * Returns null if any element is null (unhashable — can never match).
 *
 * @param {Array<string|null>} seq
 * @returns {string|null}
 * @private
 */
function hashSequence(seq) {
    for (let i = 0; i < seq.length; i++) {
        if (seq[i] === null) { return null; }
    }
    return seq.length + '\x01' + seq.join('\x00');
}

/**
 * Legacy dual-field matcher: Mermaid alt_id may equal CPEE alt_id OR CPEE id.
 * Used only when no sectionPair is provided (backward-compatible path).
 *
 * @private
 */
function compareMermaidWithCPEE(mermaidSeq, cpeeTrace) {
    if (!cpeeTrace || !cpeeTrace.path || !Array.isArray(cpeeTrace.path)) {
        return mermaidSeq.length === 0;
    }

    if (mermaidSeq.length !== cpeeTrace.path.length) {
        return false;
    }

    for (let i = 0; i < mermaidSeq.length; i++) {
        const mermaidAltId = mermaidSeq[i];
        const cpeeTask = cpeeTrace.path[i];

        if (mermaidAltId === null) {
            return false;
        }

        const cpeeAltId = cpeeTask.alt_id !== undefined && cpeeTask.alt_id !== null
            ? String(cpeeTask.alt_id)
            : null;
        const cpeeId = cpeeTask.id !== undefined && cpeeTask.id !== null
            ? String(cpeeTask.id)
            : null;

        if (mermaidAltId !== cpeeAltId && mermaidAltId !== cpeeId) {
            return false;
        }
    }

    return true;
}

/**
 * Compare traces between CPEE and Mermaid formats.
 *
 * @param {Array<Trace>} cpeeTraces
 * @param {Array<Trace>} mermaidTraces
 * @param {Object} [options]
 * @param {string|null} [options.sectionPair] - 'input' | 'output' | null.
 *   When provided, uses the simplified per-field extraction and plain string
 *   equality.  When null (default), uses the legacy dual-field matcher.
 * @returns {Object} Comparison result
 */
export function compareTraces(cpeeTraces, mermaidTraces, options = {}) {
    const { sectionPair = null } = options;

    const cpee = Array.isArray(cpeeTraces) ? cpeeTraces : [];
    const mermaid = Array.isArray(mermaidTraces) ? mermaidTraces : [];

    const traceCountMatch = cpee.length === mermaid.length;
    const totalCount = Math.max(cpee.length, mermaid.length);

    let matchCount = 0;
    const discrepancies = [];
    const details = [];
    const matchedMermaidIndices = new Set();

    // Pre-extract mermaid sequences (needed by both paths)
    const mermaidSeqs = mermaid.map(t => extractMermaidSequence(t));

    if (sectionPair) {
        // --- Hash-based O(n+m) matching ---
        // Build hash → [index] map for mermaid traces
        const mermaidHashMap = new Map();
        for (let j = 0; j < mermaid.length; j++) {
            const h = hashSequence(mermaidSeqs[j]);
            if (h !== null) {
                if (!mermaidHashMap.has(h)) { mermaidHashMap.set(h, []); }
                mermaidHashMap.get(h).push(j);
            }
        }

        for (let i = 0; i < cpee.length; i++) {
            const cpeeSeq = extractCPEESequence(cpee[i], sectionPair);
            const h = hashSequence(cpeeSeq);

            let matchedMermaidIndex = -1;
            let matchedMermaidSeq = null;

            if (h !== null) {
                const candidates = mermaidHashMap.get(h);
                if (candidates) {
                    for (const j of candidates) {
                        if (!matchedMermaidIndices.has(j)) {
                            matchedMermaidIndex = j;
                            matchedMermaidSeq = mermaidSeqs[j];
                            matchedMermaidIndices.add(j);
                            break;
                        }
                    }
                }
            }

            const sequencesMatch = matchedMermaidIndex !== -1;
            details.push({
                traceIndex: i,
                cpeeSequence: cpeeSeq,
                mermaidSequence: matchedMermaidSeq || (mermaidSeqs.length > 0 ? mermaidSeqs[0] : []),
                mermaidTraceIndex: matchedMermaidIndex,
                match: sequencesMatch
            });

            if (sequencesMatch) { matchCount++; }
            else { discrepancies.push(i); }
        }
    } else {
        // --- Legacy O(n·m) dual-field matching ---
        for (let i = 0; i < cpee.length; i++) {
            const cpeeTrace = cpee[i];
            const cpeeSeq = extractCPEESequence(cpeeTrace, null);

            let matchedMermaidIndex = -1;
            let matchedMermaidSeq = null;

            for (let j = 0; j < mermaid.length; j++) {
                if (matchedMermaidIndices.has(j)) { continue; }

                if (compareMermaidWithCPEE(mermaidSeqs[j], cpeeTrace)) {
                    matchedMermaidIndex = j;
                    matchedMermaidSeq = mermaidSeqs[j];
                    matchedMermaidIndices.add(j);
                    break;
                }
            }

            const sequencesMatch = matchedMermaidIndex !== -1;
            details.push({
                traceIndex: i,
                cpeeSequence: cpeeSeq,
                mermaidSequence: matchedMermaidSeq || (mermaidSeqs.length > 0 ? mermaidSeqs[0] : []),
                mermaidTraceIndex: matchedMermaidIndex,
                match: sequencesMatch
            });

            if (sequencesMatch) { matchCount++; }
            else { discrepancies.push(i); }
        }
    }

    const uniqueCPEETraces = [];
    const uniqueMermaidTraces = [];

    for (let i = 0; i < cpee.length; i++) {
        if (!details[i].match) {
            uniqueCPEETraces.push({ traceIndex: i, sequence: details[i].cpeeSequence });
        }
    }

    for (let j = 0; j < mermaid.length; j++) {
        if (!matchedMermaidIndices.has(j)) {
            uniqueMermaidTraces.push({
                traceIndex: j,
                sequence: mermaidSeqs[j]
            });
        }
    }

    const isMatch = matchCount === totalCount && traceCountMatch;

    return {
        matchCount,
        totalCount,
        cpeeCount: cpee.length,
        mermaidCount: mermaid.length,
        discrepancies,
        isMatch,
        traceCountMatch,
        details,
        uniqueCPEETraces,
        uniqueMermaidTraces,
        problematicCount: uniqueCPEETraces.length + uniqueMermaidTraces.length
    };
}
