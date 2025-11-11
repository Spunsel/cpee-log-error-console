/**
 * NodeIdentifier Model
 * Standardized representation of tasks/nodes/gateways/events across different formats
 * (CPEE XML, Mermaid syntax, rendered SVGs)
 */

export class NodeIdentifier {
    /**
     * Create a NodeIdentifier
     * @param {string} id - Unique identifier for the node
     * @param {string} label - Human-readable label/name
     * @param {string} type - Node type (e.g., 'call', 'manipulate', 'task', 'gateway', 'event', 'decision')
     * @param {string} sourceFormat - Source format ('cpee', 'mermaid')
     * @param {Object} metadata - Additional format-specific metadata
     * @param {number|null} position - Position/order in the workflow (0-based index)
     * @param {string|null} altId - Alternative ID (e.g., alt_id from CPEE XML)
     */
    constructor(id, label, type, sourceFormat, metadata = {}, position = null, altId = null) {
        this.id = id;
        this.altId = altId; // Alternative ID (e.g., alt_id from CPEE XML)
        this.label = label;
        this.type = type;
        this.sourceFormat = sourceFormat;
        this.metadata = metadata;
        this.position = position;
        this.svgElement = null; // Reference to the actual SVG DOM element
    }

    /**
     * Validate the NodeIdentifier
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
     * Check exact equality with another NodeIdentifier
     * @param {NodeIdentifier} other - Other NodeIdentifier to compare
     * @returns {boolean} True if exactly equal
     */
    equals(other) {
        if (!(other instanceof NodeIdentifier)) {
            return false;
        }
        return this.id === other.id &&
               this.label === other.label &&
               this.type === other.type &&
               this.sourceFormat === other.sourceFormat;
    }

    /**
     * Check if this node matches another based on flexible criteria
     * @param {NodeIdentifier} other - Other NodeIdentifier to compare
     * @param {Object} options - Matching options
     * @returns {boolean} True if matches
     */
    matches(other, options = {}) {
        if (!(other instanceof NodeIdentifier)) {
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
     * Check if this node is similar to another (fuzzy matching)
     * @param {NodeIdentifier} other - Other NodeIdentifier to compare
     * @returns {boolean} True if similar
     */
    isSimilar(other) {
        if (!(other instanceof NodeIdentifier)) {
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
        const altIdStr = this.altId ? `, altId="${this.altId}"` : '';
        return `NodeIdentifier(id="${this.id}"${altIdStr}, label="${this.label}", type="${this.type}", source="${this.sourceFormat}", position=${this.position})`;
    }

    /**
     * Convert to plain object for serialization
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this.id,
            altId: this.altId,
            label: this.label,
            type: this.type,
            sourceFormat: this.sourceFormat,
            metadata: this.metadata,
            position: this.position
        };
    }

    /**
     * Create NodeIdentifier from plain object
     * @param {Object} obj - Plain object
     * @returns {NodeIdentifier} New NodeIdentifier instance
     */
    static fromObject(obj) {
        return new NodeIdentifier(
            obj.id,
            obj.label,
            obj.type,
            obj.sourceFormat,
            obj.metadata || {},
            obj.position !== undefined ? obj.position : null,
            obj.altId || null
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
     * Compare two NodeIdentifiers for sorting by position
     * @param {NodeIdentifier} a - First node
     * @param {NodeIdentifier} b - Second node
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
     * Find matching node in an array
     * @param {NodeIdentifier[]} nodes - Array of nodes to search
     * @param {Object} options - Matching options
     * @returns {NodeIdentifier|null} Matching node or null
     */
    findMatch(nodes, options = {}) {
        if (!Array.isArray(nodes)) {
            return null;
        }

        for (const node of nodes) {
            if (this.matches(node, options)) {
                return node;
            }
        }

        return null;
    }

    /**
     * Create a copy of this NodeIdentifier
     * @returns {NodeIdentifier} New NodeIdentifier instance
     */
    clone() {
        const cloned = new NodeIdentifier(
            this.id,
            this.label,
            this.type,
            this.sourceFormat,
            { ...this.metadata },
            this.position,
            this.altId
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
     * Check if node has metadata key
     * @param {string} key - Metadata key
     * @returns {boolean} True if key exists
     */
    hasMetadata(key) {
        return this.metadata[key] !== undefined;
    }
}

