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

}

