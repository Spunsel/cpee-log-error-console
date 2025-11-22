/**
 * Trace Comparison Utility
 * Compares traces between CPEE and Mermaid formats
 * 
 * This utility compares execution traces calculated from CPEE XML trees and Mermaid flowcharts
 * to identify discrepancies between the two formats.
 * 
 * Comparison Algorithm:
 * 1. First checks if trace counts match between CPEE and Mermaid
 * 2. If counts don't match, all traces are marked as discrepancies
 * 3. If counts match, compares sequences element by element:
 *    - Mermaid traces use alt_id for comparison
 *    - CPEE traces prefer alt_id over id (falls back to id if alt_id not available)
 *    - Sequences must match exactly (same length, same values in same order)
 *    - Null values are treated as non-matching
 * 
 * Edge Cases:
 * - Handles null/undefined trace arrays gracefully
 * - Handles missing or null task identifiers
 * - Returns empty arrays for invalid trace structures
 * 
 * @module TraceComparison
 */

/**
 * Extract sequence of alt_id values from a Mermaid trace
 * 
 * Extracts the alt_id values from each task in the trace path,
 * maintaining the order of execution. Returns null for tasks without alt_id.
 * 
 * @param {Trace} mermaidTrace - Mermaid trace object with path array
 * @returns {Array<string|null>} Array of alt_id values in trace execution order
 * @example
 * // Input: { path: [{ alt_id: 'A' }, { alt_id: 'B' }, { alt_id: null }] }
 * // Output: ['A', 'B', null]
 */
export function extractMermaidSequence(mermaidTrace) {
    if (!mermaidTrace || !mermaidTrace.path || !Array.isArray(mermaidTrace.path)) {
        return [];
    }

    return mermaidTrace.path.map(task => 
        // Mermaid traces use alt_id for comparison
        task.alt_id !== undefined && task.alt_id !== null ? String(task.alt_id) : null
    );
}

/**
 * Extract sequence of id or alt_id values from a CPEE trace
 * 
 * Extracts identifiers from each task in the trace path, preferring alt_id over id.
 * This allows flexible matching between CPEE and Mermaid formats where identifiers
 * may be stored differently.
 * 
 * Priority: alt_id > id > null
 * 
 * @param {Trace} cpeeTrace - CPEE trace object with path array
 * @returns {Array<string|null>} Array of id/alt_id values in trace execution order
 * @example
 * // Input: { path: [{ alt_id: 'A', id: 'A1' }, { id: 'B1' }, {}] }
 * // Output: ['A', 'B1', null]
 */
export function extractCPEESequence(cpeeTrace) {
    if (!cpeeTrace || !cpeeTrace.path || !Array.isArray(cpeeTrace.path)) {
        return [];
    }

    return cpeeTrace.path.map(task => {
        // Prefer alt_id over id for CPEE traces
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
 * Compare Mermaid sequence with CPEE trace
 * 
 * Compares a Mermaid sequence (alt_id values) with a CPEE trace.
 * Mermaid's alt_id can match either CPEE's alt_id OR id for each task.
 * 
 * @param {Array<string|null>} mermaidSeq - Mermaid sequence (alt_id values)
 * @param {Trace} cpeeTrace - CPEE trace object with path array
 * @returns {boolean} True if sequences match (Mermaid alt_id matches CPEE alt_id or id)
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

        // Mermaid alt_id must be non-null
        if (mermaidAltId === null) {
            return false;
        }

        // Check if Mermaid alt_id matches CPEE alt_id OR id
        const cpeeAltId = cpeeTask.alt_id !== undefined && cpeeTask.alt_id !== null 
            ? String(cpeeTask.alt_id) 
            : null;
        const cpeeId = cpeeTask.id !== undefined && cpeeTask.id !== null 
            ? String(cpeeTask.id) 
            : null;

        // Match if Mermaid alt_id equals CPEE alt_id OR CPEE id
        if (mermaidAltId !== cpeeAltId && mermaidAltId !== cpeeId) {
            return false;
        }
    }

    return true;
}

/**
 * Compare traces between CPEE and Mermaid formats
 * 
 * Performs comprehensive comparison of trace arrays from CPEE and Mermaid formats.
 * Returns detailed results including match statistics and per-trace comparison details.
 * 
 * Algorithm:
 * 1. Validates input arrays (handles null/undefined)
 * 2. Checks if trace counts match
 * 3. If counts don't match, marks all as discrepancies
 * 4. If counts match, compares traces order-independently:
 *    - For each CPEE trace, finds a matching Mermaid trace (by sequence content)
 *    - Mermaid traces can be in different order than CPEE traces
 *    - Each Mermaid trace can only be matched once
 *    - Mermaid's alt_id can match either CPEE's alt_id OR id for each task
 *    - Compares sequences element by element using flexible matching
 *    - Records match/mismatch status for each trace
 * 
 * Error Handling:
 * - Returns empty arrays for null/undefined inputs
 * - Handles missing trace paths gracefully
 * - Logs comparison progress for debugging
 * 
 * @param {Array<Trace>} cpeeTraces - Array of CPEE trace objects
 * @param {Array<Trace>} mermaidTraces - Array of Mermaid trace objects
 * @returns {Object} Comparison result object with the following structure:
 *   @property {number} matchCount - Number of matching traces
 *   @property {number} totalCount - Total number of traces (max of both arrays)
 *   @property {number} cpeeCount - Number of CPEE traces
 *   @property {number} mermaidCount - Number of Mermaid traces
 *   @property {Array<number>} discrepancies - Array of trace indices (0-based) with mismatches
 *   @property {boolean} isMatch - True if all traces match and counts match
 *   @property {boolean} traceCountMatch - True if trace counts are equal
 *   @property {Array<Object>} details - Detailed comparison results for each trace pair:
 *     @property {number} traceIndex - Index of the trace (0-based)
 *     @property {Array<string|null>} cpeeSequence - Extracted CPEE sequence
 *     @property {Array<string|null>} mermaidSequence - Extracted Mermaid sequence
 *     @property {boolean} match - Whether this trace pair matches
 * 
 * @example
 * const result = compareTraces(cpeeTraces, mermaidTraces);
 * if (!result.isMatch) {
 *   console.log(`Found ${result.discrepancies.length} mismatches`);
 *   result.details.forEach(detail => {
 *     if (!detail.match) {
 *       console.log(`Trace ${detail.traceIndex} mismatch`);
 *     }
 *   });
 * }
 */
export function compareTraces(cpeeTraces, mermaidTraces) {
    // Handle null/undefined inputs
    const cpee = Array.isArray(cpeeTraces) ? cpeeTraces : [];
    const mermaid = Array.isArray(mermaidTraces) ? mermaidTraces : [];

    // Check trace count match
    const traceCountMatch = cpee.length === mermaid.length;
    const totalCount = Math.max(cpee.length, mermaid.length);

    // Even if counts don't match, we still compare traces to find matches
    // Unmatched traces will be marked as unique

    // Compare traces order-independently by matching sequences
    // Mermaid traces can be in different order than CPEE traces
    let matchCount = 0;
    const discrepancies = [];
    const details = [];
    
    // Track which Mermaid traces have been matched
    const matchedMermaidIndices = new Set();
    
    // For each CPEE trace, find a matching Mermaid trace
    for (let i = 0; i < cpee.length; i++) {
        const cpeeTrace = cpee[i];
        const cpeeSeq = extractCPEESequence(cpeeTrace);
                
        // Find matching Mermaid trace (order-independent)
        let matchedMermaidIndex = -1;
        let matchedMermaidSeq = null;
        
        for (let j = 0; j < mermaid.length; j++) {
            // Skip if this Mermaid trace was already matched
            if (matchedMermaidIndices.has(j)) {
                continue;
            }
            
            const mermaidTrace = mermaid[j];
            const mermaidSeq = extractMermaidSequence(mermaidTrace);
            
            // Check if Mermaid sequence matches CPEE trace
            // Mermaid alt_id can match either CPEE alt_id or id
            if (compareMermaidWithCPEE(mermaidSeq, cpeeTrace)) {
                matchedMermaidIndex = j;
                matchedMermaidSeq = mermaidSeq;
                matchedMermaidIndices.add(j);
                break;
            }
        }
        
        const sequencesMatch = matchedMermaidIndex !== -1;
        
        const detail = {
            traceIndex: i,
            cpeeSequence: cpeeSeq,
            mermaidSequence: matchedMermaidSeq || (matchedMermaidIndex === -1 && mermaid.length > 0 ? extractMermaidSequence(mermaid[0]) : []),
            mermaidTraceIndex: matchedMermaidIndex,
            match: sequencesMatch
        };

        details.push(detail);

        if (sequencesMatch) {
            matchCount++;
        } else {
            discrepancies.push(i);
        }
    }
    
    // Find unique traces (traces that don't have matches)
    const uniqueCPEETraces = [];
    const uniqueMermaidTraces = [];
    
    // CPEE traces without matches
    for (let i = 0; i < cpee.length; i++) {
        const detail = details[i];
        if (!detail.match) {
            uniqueCPEETraces.push({
                traceIndex: i,
                sequence: detail.cpeeSequence
            });
        }
    }
    
    // Mermaid traces without matches
    for (let j = 0; j < mermaid.length; j++) {
        if (!matchedMermaidIndices.has(j)) {
            const mermaidTrace = mermaid[j];
            const mermaidSeq = extractMermaidSequence(mermaidTrace);
            uniqueMermaidTraces.push({
                traceIndex: j,
                sequence: mermaidSeq
            });
        }
    }

    const isMatch = matchCount === totalCount && traceCountMatch;
    const problematicCount = uniqueCPEETraces.length + uniqueMermaidTraces.length;

    const result = {
        matchCount: matchCount,
        totalCount: totalCount,
        cpeeCount: cpee.length,
        mermaidCount: mermaid.length,
        discrepancies: discrepancies,
        isMatch: isMatch,
        traceCountMatch: traceCountMatch,
        details: details,
        uniqueCPEETraces: uniqueCPEETraces,
        uniqueMermaidTraces: uniqueMermaidTraces,
        problematicCount: problematicCount
    };
    return result;
}

/**
 * Default export for convenience
 */
export default {
    compareTraces,
    extractMermaidSequence,
    extractCPEESequence
};

