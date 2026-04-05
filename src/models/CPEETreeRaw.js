/**
 * CPEETreeRaw Model
 * Represents raw CPEE tree XML content extracted from CPEE logs
 * Stores both input and output CPEE tree representations
 */

export class CPEETreeRaw {
    constructor(content = '') {
        this.content = content || '';
        this.extractedAt = new Date();
        this.isValid = this.validateXmlStructure();
    }

    /**
     * Get the raw CPEE tree content
     * @returns {string} Raw CPEE tree XML
     */
    getContent() {
        return this.content;
    }

    /**
     * Validate basic XML/CPEE tree structure
     * @returns {boolean} True if content appears to be valid CPEE tree
     */
    validateXmlStructure() {
        if (!this.content || this.content.trim().length === 0) {
            return false;
        }

        // Check for XML declaration and description tags
        const hasXmlDeclaration = /^\s*<\?xml\b/i.test(this.content);
        const hasDescriptionTag = /<description\b[^>]*>/i.test(this.content);
        const isCpeeFormat = /xmlns\s*=\s*["']http:\/\/cpee\.org/i.test(this.content);

        return (hasXmlDeclaration || hasDescriptionTag) && (isCpeeFormat || /<\w+>/i.test(this.content));
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
     * @returns {number} Number of lines in XML
     */
    getLineCount() {
        return this.content.split('\n').length;
    }

    /**
     * Extract root element tag name
     * @returns {string|null} Root element name or null
     */
    getRootElement() {
        const rootMatch = this.content.match(/<(\w+)\b[^>]*>/);
        return rootMatch ? rootMatch[1] : null;
    }

    /**
     * Get count of elements (rough estimate)
     * @returns {number} Approximate number of XML elements
     */
    getElementCount() {
        const matches = this.content.match(/<[\w-]+/g);
        return matches ? matches.length : 0;
    }

    /**
     * Convert to plain object (for serialization)
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            content: this.content,
            extractedAt: this.extractedAt,
            isValid: this.isValid,
            rootElement: this.getRootElement(),
            elementCount: this.getElementCount(),
            lineCount: this.getLineCount()
        };
    }

    /**
     * Create CPEETreeRaw from plain object
     * @param {Object} obj - Plain object with content
     * @returns {CPEETreeRaw} New CPEETreeRaw instance
     */
    static fromObject(obj) {
        const treeRaw = new CPEETreeRaw(obj.content);
        if (obj.extractedAt) {
            treeRaw.extractedAt = new Date(obj.extractedAt);
        }
        return treeRaw;
    }

    /**
     * Create empty CPEETreeRaw
     * @returns {CPEETreeRaw} Empty CPEETreeRaw instance
     */
    static empty() {
        return new CPEETreeRaw('');
    }
}
