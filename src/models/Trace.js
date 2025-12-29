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
    }

    /**
     * Get trace length (number of tasks in path)
     * @returns {number} Length of the trace
     */
    get length() {
        return this.path ? this.path.length : 0;
    }

    /**
     * Validate the Trace
     * @returns {boolean} True if valid
     */
    isValid() {
        if (!this.id || typeof this.id !== 'string') {
            return false;
        }
        if (!Array.isArray(this.path)) {
            return false;
        }
        // Validate each task in path
        for (const task of this.path) {
            if (!task || typeof task !== 'object') {
                return false;
            }
            if (!task.id || typeof task.id !== 'string') {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if trace is complete (has start and end nodes)
     * @returns {boolean} True if complete
     */
    isComplete() {
        if (!this.isValid() || this.path.length === 0) {
            return false;
        }
        // A complete trace should have at least one task
        // Start/end validation can be added based on metadata if needed
        return true;
    }

    /**
     * Check exact equality with another Trace
     * @param {Trace} other - Other Trace to compare
     * @returns {boolean} True if exactly equal
     */
    equals(other) {
        if (!(other instanceof Trace)) {
            return false;
        }
        if (this.id !== other.id) {
            return false;
        }
        if (this.path.length !== other.path.length) {
            return false;
        }
        // Compare each task in path
        for (let i = 0; i < this.path.length; i++) {
            const thisTask = this.path[i];
            const otherTask = other.path[i];
            if (thisTask.id !== otherTask.id ||
                thisTask.alt_id !== otherTask.alt_id ||
                thisTask.task !== otherTask.task) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if this trace contains another trace (subsequence)
     * @param {Trace} other - Other Trace to check
     * @returns {boolean} True if this trace contains the other
     */
    contains(other) {
        if (!(other instanceof Trace) || !other.isValid()) {
            return false;
        }
        if (other.path.length === 0) {
            return true; // Empty trace is contained in any trace
        }
        if (other.path.length > this.path.length) {
            return false;
        }

        // Check if other.path is a subsequence of this.path
        let thisIndex = 0;
        for (const otherTask of other.path) {
            let found = false;
            while (thisIndex < this.path.length) {
                const thisTask = this.path[thisIndex];
                if (thisTask.id === otherTask.id) {
                    found = true;
                    thisIndex++;
                    break;
                }
                thisIndex++;
            }
            if (!found) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if this trace overlaps with another trace (has common tasks)
     * @param {Trace} other - Other Trace to check
     * @returns {boolean} True if traces overlap
     */
    overlaps(other) {
        if (!(other instanceof Trace) || !other.isValid()) {
            return false;
        }
        
        // Create sets of task IDs for efficient lookup
        const thisTaskIds = new Set(this.path.map(task => task.id));
        const otherTaskIds = new Set(other.path.map(task => task.id));
        
        // Check for any common task IDs
        for (const taskId of thisTaskIds) {
            if (otherTaskIds.has(taskId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get string representation for debugging
     * @returns {string} String representation
     */
    toString() {
        const pathStr = this.path.map(task => task.id).join(' → ');
        return `Trace(id="${this.id}", type="${this.type}", length=${this.length}, path=[${pathStr}])`;
    }

    /**
     * Get user-friendly display string
     * @param {Object} options - Display options
     * @param {boolean} options.showLabels - Show task labels instead of IDs
     * @param {string} options.separator - Separator between tasks (default: " → ")
     * @returns {string} Display string
     */
    getDisplayString(options = {}) {
        const {
            showLabels = false,
            separator = ' → '
        } = options;

        if (this.path.length === 0) {
            return '(empty trace)';
        }

        const parts = this.path.map(task => {
            if (showLabels && task.task) {
                return task.task;
            }
            return task.id;
        });

        return parts.join(separator);
    }

    /**
     * Get start node (first task in path)
     * @returns {Object|null} Start task object or null
     */
    getStartNode() {
        return this.path.length > 0 ? this.path[0] : null;
    }

    /**
     * Get end node (last task in path)
     * @returns {Object|null} End task object or null
     */
    getEndNode() {
        return this.path.length > 0 ? this.path[this.path.length - 1] : null;
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
            sourceGraphType: this.sourceGraphType
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

    /**
     * Create Trace from array of task objects (convenience method)
     * @param {string} id - Trace ID
     * @param {Array<Object>} tasks - Array of task objects: [{id, alt_id, task}, ...]
     * @param {string} type - Trace type
     * @returns {Trace} New Trace instance
     */
    static fromTasks(id, tasks, type = 'sequential') {
        return new Trace(id, tasks, type);
    }

    /**
     * Compare two Traces for sorting by length
     * @param {Trace} a - First trace
     * @param {Trace} b - Second trace
     * @returns {number} Comparison result (-1, 0, 1)
     */
    static compareByLength(a, b) {
        return a.length - b.length;
    }

    /**
     * Check if trace has a specific task ID
     * @param {string} taskId - Task ID to check
     * @returns {boolean} True if trace contains the task
     */
    hasTask(taskId) {
        return this.path.some(task => task.id === taskId);
    }

    /**
     * Get task at specific index
     * @param {number} index - Index in path
     * @returns {Object|null} Task object or null
     */
    getTaskAt(index) {
        if (index < 0 || index >= this.path.length) {
            return null;
        }
        return this.path[index];
    }

    /**
     * Get all task IDs in the trace
     * @returns {string[]} Array of task IDs
     */
    getTaskIds() {
        return this.path.map(task => task.id);
    }
}

