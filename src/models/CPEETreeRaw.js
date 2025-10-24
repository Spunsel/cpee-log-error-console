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
     * Set the raw CPEE tree content
     * @param {string} content - CPEE tree XML
     */
    setContent(content) {
        this.content = content || '';
        this.extractedAt = new Date();
        this.isValid = this.validateXmlStructure();
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
     * Extract CPEE namespace
     * @returns {string|null} Namespace URI or null
     */
    getNamespace() {
        const nsMatch = this.content.match(/xmlns\s*=\s*["']([^"']+)["']/);
        return nsMatch ? nsMatch[1] : null;
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
     * Extract CPEE attributes
     * @returns {Object} Object with various CPEE attributes
     */
    extractAttributes() {
        const attributes = {};
        
        // Extract common CPEE attributes
        const idMatch = this.content.match(/\sid\s*=\s*["']([^"']+)["']/);
        if (idMatch) {
            attributes.id = idMatch[1];
        }

        const labelMatch = this.content.match(/<label>([^<]+)<\/label>/);
        if (labelMatch) { 
            attributes.label = labelMatch[1];
        }

        const endpointMatch = this.content.match(/\sendpoint\s*=\s*["']([^"']+)["']/);
        if (endpointMatch) { 
            attributes.endpoint = endpointMatch[1];
        }

        return attributes;
    }

    /**
     * Get preview (first few lines)
     * @param {number} lines - Number of lines to preview
     * @returns {string} Preview of content
     */
    getPreview(lines = 5) {
        return this.content.split('\n').slice(0, lines).join('\n');
    }

    /**
     * Pretty print XML (basic formatting)
     * @returns {string} Formatted XML
     */
    prettyPrint() {
        let formatted = '';
        let indent = 0;
        const regex = /(<[^/>]+>)|(<\/[^>]+>)|([^<>]+)/g;

        let match;
        while ((match = regex.exec(this.content)) !== null) {
            const str = match[0];
            if (str.startsWith('</')) {
                indent--;
                formatted += '\n' + '  '.repeat(indent) + str;
            } else if (str.startsWith('<') && !str.endsWith('/>')) {
                formatted += '\n' + '  '.repeat(indent) + str;
                if (!str.endsWith('</')) { 
                    indent++;
                }
            } else if (str.trim()) {
                formatted += str.trim();
            }
        }

        return formatted.trim();
    }

    /**
     * Clone this CPEE tree raw object
     * @returns {CPEETreeRaw} New CPEETreeRaw instance with same content
     */
    clone() {
        return new CPEETreeRaw(this.content);
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
