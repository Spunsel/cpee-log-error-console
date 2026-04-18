/**
 * Trace Model
 * Represents a single execution trace (path from start to end nodes)
 * Each trace contains an ordered sequence of tasks/nodes that form a complete execution path
 */

export class Trace {
    /**
     * Create a Trace
     * @param {string} id - Unique identifier for the trace
     * @param {Array<Object>} path - Array of task objects: [{id, alt_id, task}, ...]
     * @param {string} type - Trace type ('sequential', 'parallel', 'loop', 'conditional')
     * @param {Object} metadata - Additional metadata (startNode, endNode, etc.)
     */
    constructor(id, path = [], type = 'sequential', metadata = {}) {
        this.id = id;
        this.path = path; // Array of task objects: [{id, alt_id, task}, ...]
        this.type = type;
        this.metadata = metadata;
        
        // Reconciliation flag - true if this trace was added through cross-graph validation
        this.isReconciled = false;
        
        // Original trace index in the source graph (for reconciled traces)
        this.sourceTraceIndex = null;
        
        // Source graph type ('cpee' or 'mermaid') for reconciled traces
        this.sourceGraphType = null;

        // True when this trace was terminated early by a CPEE <escape/> control element.
        // Escape acts like an explicit end event, so such traces are considered properly
        // completed (no residual work) regardless of any parallel/AND branches that were
        // not entered before the escape fired.
        this.terminatedByEscape = Array.isArray(path) && path._terminatedByEscape === true;
    }

    /**
     * Get trace length (number of tasks in path)
     * @returns {number} Length of the trace
     */
    get length() {
        return this.path ? this.path.length : 0;
    }

    /**
     * Convert to plain object for serialization
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this.id,
            path: this.path,
            type: this.type,
            length: this.length,
            metadata: this.metadata,
            isReconciled: this.isReconciled,
            sourceTraceIndex: this.sourceTraceIndex,
            sourceGraphType: this.sourceGraphType,
            terminatedByEscape: this.terminatedByEscape
        };
    }

    /**
     * Create Trace from plain object
     * @param {Object} obj - Plain object
     * @returns {Trace} New Trace instance
     */
    static fromObject(obj) {
        const trace = new Trace(
            obj.id,
            obj.path || [],
            obj.type || 'sequential',
            obj.metadata || {}
        );
        trace.isReconciled = obj.isReconciled || false;
        trace.sourceTraceIndex = obj.sourceTraceIndex !== undefined ? obj.sourceTraceIndex : null;
        trace.sourceGraphType = obj.sourceGraphType || null;
        if (obj.terminatedByEscape === true) {
            trace.terminatedByEscape = true;
        }
        return trace;
    }

    /**
     * Mark this trace as reconciled (added through cross-graph validation)
     * @param {number} sourceTraceIndex - Index of the original trace in the source graph
     * @param {string} sourceGraphType - Type of source graph ('cpee' or 'mermaid')
     * @returns {Trace} This trace (for chaining)
     */
    markAsReconciled(sourceTraceIndex, sourceGraphType) {
        this.isReconciled = true;
        this.sourceTraceIndex = sourceTraceIndex;
        this.sourceGraphType = sourceGraphType;
        return this;
    }

}

