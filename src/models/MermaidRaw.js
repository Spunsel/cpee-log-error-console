/**
 * MermaidRaw Model
 * Represents raw Mermaid intermediate format content extracted from CPEE logs
 * Stores both input and output intermediate Mermaid representations
 */

export class MermaidRaw {
    constructor(content = '') {
        this.content = content || '';
        this.rawExposition = ''; // Completely unprocessed content from log exposition (for log view)
        this.extractedAt = new Date();
        this.isValid = this.validateMermaidSyntax();
    }

    /**
     * Get the raw Mermaid content (cleaned but not preprocessed)
     * @returns {string} Raw Mermaid diagram syntax
     */
    getContent() {
        return this.content;
    }

    /**
     * Get the completely unprocessed content from log exposition (for log view)
     * @returns {string} Unprocessed exposition content
     */
    getRawExposition() {
        return this.rawExposition || this.content;
    }

    /**
     * Set the completely unprocessed content from log exposition
     * @param {string} rawExposition - Unprocessed exposition content
     */
    setRawExposition(rawExposition) {
        this.rawExposition = rawExposition || '';
    }

    /**
     * Set the raw Mermaid content
     * @param {string} content - Mermaid diagram syntax
     */
    setContent(content) {
        this.content = content || '';
        this.extractedAt = new Date();
        this.isValid = this.validateMermaidSyntax();
    }

    /**
     * Validate basic Mermaid syntax
     * @returns {boolean} True if content appears to be valid Mermaid
     */
    validateMermaidSyntax() {
        if (!this.content || this.content.trim().length === 0) {
            return false;
        }

        // Check for common Mermaid diagram type declarations
        const mermaidPatterns = [
            /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitGraph|pie|gantt)/i,
            /graph\s+(TD|LR|RL|BT|TB)/i,
            /flowchart\s+(TD|LR|RL|BT|TB)/i
        ];

        return mermaidPatterns.some(pattern => pattern.test(this.content));
    }

    /**
     * Check if content is empty
     * @returns {boolean} True if no content
     */
    isEmpty() {
        return !this.content || this.content.trim().length === 0;
    }

    /**
     * Get content length
     * @returns {number} Length in bytes
     */
    getLength() {
        return this.content.length;
    }

    /**
     * Get number of lines
     * @returns {number} Number of lines in diagram
     */
    getLineCount() {
        return this.content.split('\n').length;
    }

    /**
     * Extract diagram type from content
     * @returns {string|null} Diagram type (graph, flowchart, etc.) or null
     */
    getDiagramType() {
        const typeMatch = this.content.match(/^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitGraph|pie|gantt)/i);
        return typeMatch ? typeMatch[1].toLowerCase() : null;
    }

    /**
     * Extract direction from graph declaration
     * @returns {string|null} Direction (TD, LR, etc.) or null
     */
    getDirection() {
        const dirMatch = this.content.match(/(?:graph|flowchart)\s+(TD|LR|RL|BT|TB)/i);
        return dirMatch ? dirMatch[1] : null;
    }

    /**
     * Get preview (first few lines)
     * @param {number} lines - Number of lines to preview
     * @returns {string} Preview of content
     */
    getPreview(lines = 3) {
        return this.content.split('\n').slice(0, lines).join('\n');
    }

    /**
     * Clone this Mermaid raw object
     * @returns {MermaidRaw} New MermaidRaw instance with same content
     */
    clone() {
        return new MermaidRaw(this.content);
    }

    /**
     * Convert to plain object (for serialization)
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            content: this.content,
            rawExposition: this.rawExposition,
            extractedAt: this.extractedAt,
            isValid: this.isValid,
            diagramType: this.getDiagramType(),
            lineCount: this.getLineCount()
        };
    }

    /**
     * Create MermaidRaw from plain object
     * @param {Object} obj - Plain object with content
     * @returns {MermaidRaw} New MermaidRaw instance
     */
    static fromObject(obj) {
        const mermaidRaw = new MermaidRaw(obj.content);
        if (obj.rawExposition) {
            mermaidRaw.rawExposition = obj.rawExposition;
        }
        if (obj.extractedAt) {
            mermaidRaw.extractedAt = new Date(obj.extractedAt);
        }
        return mermaidRaw;
    }

    /**
     * Create empty MermaidRaw
     * @returns {MermaidRaw} Empty MermaidRaw instance
     */
    static empty() {
        return new MermaidRaw('');
    }
}
