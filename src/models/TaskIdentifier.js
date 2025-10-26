/**
 * TaskIdentifier Model
 * Standardized representation of tasks/nodes across different formats
 * (CPEE XML, Mermaid syntax, rendered SVGs)
 */

export class TaskIdentifier {
    /**
     * Create a TaskIdentifier
     * @param {string} id - Unique identifier for the task
     * @param {string} label - Human-readable label/name
     * @param {string} type - Task type (e.g., 'call', 'manipulate', 'task', 'decision')
     * @param {string} sourceFormat - Source format ('cpee', 'mermaid')
     * @param {Object} metadata - Additional format-specific metadata
     * @param {number|null} position - Position/order in the workflow (0-based index)
     */
    constructor(id, label, type, sourceFormat, metadata = {}, position = null) {
        this.id = id;
        this.label = label;
        this.type = type;
        this.sourceFormat = sourceFormat;
        this.metadata = metadata;
        this.position = position;
        this.svgElement = null; // Reference to the actual SVG DOM element
    }

    /**
     * Validate the TaskIdentifier
     * @returns {boolean} True if valid
     */
    isValid() {
        if (!this.id || typeof this.id !== 'string') {
            return false;
        }
        if (!this.label || typeof this.label !== 'string') {
            return false;
        }
        if (!this.type || typeof this.type !== 'string') {
            return false;
        }
        if (!['cpee', 'mermaid'].includes(this.sourceFormat)) {
            return false;
        }
        return true;
    }

    /**
     * Check exact equality with another TaskIdentifier
     * @param {TaskIdentifier} other - Other TaskIdentifier to compare
     * @returns {boolean} True if exactly equal
     */
    equals(other) {
        if (!(other instanceof TaskIdentifier)) {
            return false;
        }
        return this.id === other.id &&
               this.label === other.label &&
               this.type === other.type &&
               this.sourceFormat === other.sourceFormat;
    }

    /**
     * Check if this task matches another based on flexible criteria
     * @param {TaskIdentifier} other - Other TaskIdentifier to compare
     * @param {Object} options - Matching options
     * @returns {boolean} True if matches
     */
    matches(other, options = {}) {
        if (!(other instanceof TaskIdentifier)) {
            return false;
        }

        const {
            matchId = true,
            matchLabel = true,
            matchType = false,
            matchPosition = false,
            caseInsensitive = true
        } = options;

        if (matchId) {
            const thisId = caseInsensitive ? this.id.toLowerCase() : this.id;
            const otherId = caseInsensitive ? other.id.toLowerCase() : other.id;
            if (thisId !== otherId) {
                return false;
            }
        }

        if (matchLabel) {
            const thisLabel = caseInsensitive ? this.label.toLowerCase() : this.label;
            const otherLabel = caseInsensitive ? other.label.toLowerCase() : other.label;
            if (thisLabel !== otherLabel) {
                return false;
            }
        }

        if (matchType && this.type !== other.type) {
            return false;
        }

        if (matchPosition && this.position !== other.position) {
            return false;
        }

        return true;
    }

    /**
     * Check if this task is similar to another (fuzzy matching)
     * @param {TaskIdentifier} other - Other TaskIdentifier to compare
     * @returns {boolean} True if similar
     */
    isSimilar(other) {
        if (!(other instanceof TaskIdentifier)) {
            return false;
        }

        // Case-insensitive ID or label match
        const thisId = this.id.toLowerCase();
        const otherId = other.id.toLowerCase();
        const thisLabel = this.label.toLowerCase();
        const otherLabel = other.label.toLowerCase();

        return thisId === otherId || thisLabel === otherLabel;
    }

    /**
     * Get string representation for debugging
     * @returns {string} String representation
     */
    toString() {
        return `TaskIdentifier(id="${this.id}", label="${this.label}", type="${this.type}", source="${this.sourceFormat}", position=${this.position})`;
    }

    /**
     * Convert to plain object for serialization
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this.id,
            label: this.label,
            type: this.type,
            sourceFormat: this.sourceFormat,
            metadata: this.metadata,
            position: this.position
        };
    }

    /**
     * Create TaskIdentifier from plain object
     * @param {Object} obj - Plain object
     * @returns {TaskIdentifier} New TaskIdentifier instance
     */
    static fromObject(obj) {
        return new TaskIdentifier(
            obj.id,
            obj.label,
            obj.type,
            obj.sourceFormat,
            obj.metadata || {},
            obj.position !== undefined ? obj.position : null
        );
    }

    /**
     * Set reference to SVG element
     * @param {Element} element - SVG DOM element
     */
    setSVGElement(element) {
        this.svgElement = element;
    }

    /**
     * Get reference to SVG element
     * @returns {Element|null} SVG DOM element or null
     */
    getSVGElement() {
        return this.svgElement;
    }

    /**
     * Compare two TaskIdentifiers for sorting by position
     * @param {TaskIdentifier} a - First task
     * @param {TaskIdentifier} b - Second task
     * @returns {number} Comparison result (-1, 0, 1)
     */
    static compareByPosition(a, b) {
        if (a.position === null && b.position === null) {
            return 0;
        }
        if (a.position === null) {
            return 1;
        }
        if (b.position === null) {
            return -1;
        }
        return a.position - b.position;
    }

    /**
     * Find matching task in an array
     * @param {TaskIdentifier[]} tasks - Array of tasks to search
     * @param {Object} options - Matching options
     * @returns {TaskIdentifier|null} Matching task or null
     */
    findMatch(tasks, options = {}) {
        if (!Array.isArray(tasks)) {
            return null;
        }

        for (const task of tasks) {
            if (this.matches(task, options)) {
                return task;
            }
        }

        return null;
    }

    /**
     * Create a copy of this TaskIdentifier
     * @returns {TaskIdentifier} New TaskIdentifier instance
     */
    clone() {
        const cloned = new TaskIdentifier(
            this.id,
            this.label,
            this.type,
            this.sourceFormat,
            { ...this.metadata },
            this.position
        );
        cloned.svgElement = this.svgElement;
        return cloned;
    }

    /**
     * Update metadata
     * @param {Object} updates - Metadata updates
     */
    updateMetadata(updates) {
        this.metadata = { ...this.metadata, ...updates };
    }

    /**
     * Get metadata value
     * @param {string} key - Metadata key
     * @param {*} defaultValue - Default value if key not found
     * @returns {*} Metadata value
     */
    getMetadata(key, defaultValue = null) {
        return this.metadata[key] !== undefined ? this.metadata[key] : defaultValue;
    }

    /**
     * Check if task has metadata key
     * @param {string} key - Metadata key
     * @returns {boolean} True if key exists
     */
    hasMetadata(key) {
        return this.metadata[key] !== undefined;
    }
}

