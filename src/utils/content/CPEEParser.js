/**
 * CPEE Parser
 * Comprehensive parsing, validation, and processing for XML/CPEE content
 * 
 * Consolidates all XML/CPEE-related functionality:
 * - XML parsing and validation
 * - CPEE tree content cleaning
 * - XML formatting and indentation
 * - CPEE-specific comment removal
 */

export class CPEEParser {
    
    /**
     * Parse XML string to DOM document
     * @param {string} xmlString - XML string to parse
     * @returns {Document} Parsed XML document
     * @throws {Error} If parsing fails
     */
    static parseXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
            throw new Error('CPEEParser: XML string must be a non-empty string');
        }
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('CPEEParser: XML parsing error - ' + parseError.textContent);
            }
            
            return xmlDoc;
        } catch (error) {
            throw new Error('CPEEParser: Failed to parse XML - ' + error.message);
        }
    }

    /**
     * Clean and validate CPEE XML content
     * Comprehensive validation and cleaning for CPEE XML documents
     * 
     * @param {string} xml - Raw XML string
     * @returns {string} Cleaned and validated XML
     * @throws {Error} If XML is invalid
     */
    static cleanAndValidateCPEEXML(xml) {
        if (!xml || typeof xml !== 'string') {
            throw new Error('CPEEParser: Invalid XML input - must be a non-empty string');
        }

        // Remove HTML comments and extra whitespace
        let cleanedXML = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove leading whitespace
        cleanedXML = cleanedXML.replace(/^\s+/, '');

        // If no XML declaration, add one
        if (!cleanedXML.startsWith('<?xml')) {
            cleanedXML = '<?xml version="1.0"?>\n' + cleanedXML;
        }

        // Validate basic XML structure
        if (!cleanedXML.includes('<description')) {
            throw new Error('CPEEParser: Invalid CPEE XML - missing <description> element');
        }

        // Parse and validate the XML structure
        try {
            const xmlDoc = this.parseXML(cleanedXML);
            
            // Check for required CPEE elements
            const descElement = xmlDoc.querySelector('description');
            if (!descElement) {
                throw new Error('CPEEParser: Missing required <description> element');
            }
            
            console.log('✅ XML validation successful');
            return cleanedXML;
        } catch (error) {
            console.error('❌ XML validation failed:', error);
            throw new Error('CPEEParser: Invalid XML structure - ' + error.message);
        }
    }

    /**
     * Clean CPEE tree content from log exposition
     * 
     * @param {string} content - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Cleaned content
     */
    static cleanCPEETreeContent(content, type) {
        if (!content) { 
            return content;
        }
        
        let cleaned = content;
        
        // Remove CPEE tree comments based on type
        if (type === 'input') {
            cleaned = cleaned.replace(/<!-- Input CPEE-Tree -->\s*/g, '');
        } else if (type === 'output') {
            cleaned = cleaned.replace(/<!-- Output CPEE-Tree -->\s*/g, '');
        }
        
        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();
        
        // Format XML with proper indentation
        cleaned = this.formatXML(cleaned);
        
        return cleaned;
    }

    /**
     * Format XML with proper indentation
     * @param {string} xml - XML string to format
     * @returns {string} Formatted XML with proper indentation
     */
    static formatXML(xml) {
        if (!xml || typeof xml !== 'string') {
            return xml;
        }

        try {
            // Parse the XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                // If parsing fails, return original XML
                return xml;
            }
            
            // Format with indentation
            return this.formatXMLWithIndentation(xmlDoc.documentElement);
        } catch (error) {
            // If any error occurs, return original XML
            return xml;
        }
    }

    /**
     * Format XML element with proper indentation
     * @param {Element} element - XML element to format
     * @param {number} indentLevel - Current indentation level
     * @returns {string} Formatted XML string
     */
    static formatXMLWithIndentation(element, indentLevel = 0) {
        const indent = '  '.repeat(indentLevel);
        const nextIndent = '  '.repeat(indentLevel + 1);
        
        let result = '';
        
        // Add opening tag
        result += indent + '<' + element.tagName;
        
        // Add attributes
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            result += ` ${attr.name}="${attr.value}"`;
        }
        
        // Handle content
        const children = element.childNodes;
        const hasTextContent = children.length === 1 && children[0].nodeType === Node.TEXT_NODE;
        
        if (hasTextContent) {
            // Single text node - inline format
            result += `>${children[0].textContent}</${element.tagName}>\n`;
        } else if (children.length === 0) {
            // Self-closing tag
            result += '/>\n';
        } else {
            // Multiple children - block format
            result += '>\n';
            
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === Node.ELEMENT_NODE) {
                    result += this.formatXMLWithIndentation(child, indentLevel + 1);
                } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    result += nextIndent + child.textContent.trim() + '\n';
                }
            }
            
            result += indent + `</${element.tagName}>\n`;
        }
        
        return result;
    }

    /**
     * Clean and validate XML (wrapper for compatibility)
     * 
     * @param {string} xml - Raw XML string
     * @returns {string} Cleaned and validated XML
     * @throws {Error} If XML is invalid
     */
    static cleanAndValidateXML(xml) {
        return this.cleanAndValidateCPEEXML(xml);
    }

    /**
     * Remove CPEE-style comments from content
     * 
     * @param {string} content - Content to clean
     * @returns {string} Content with CPEE comments removed
     */
    static removeCPEEComments(content) {
        if (!content) {
            return content;
        }
        
        // Remove CPEE-style comments (e.g., "%% Output Intermediate", "%% Input Intermediate")
        return content.replace(/^\s*%%.*$/gm, '').trim();
    }

    /**
     * Remove HTML comments from content
     * Common utility used across multiple cleaning methods
     * 
     * @param {string} content - Content to clean
     * @returns {string} Content with HTML comments removed
     */
    static removeHTMLComments(content) {
        if (!content) {
            return content;
        }
        return content.replace(/<!--[\s\S]*?-->/g, '').trim();
    }

    /**
     * Validate XML structure
     * @param {string} xml - XML string to validate
     * @returns {boolean} True if valid XML structure
     */
    static isValidXMLStructure(xml) {
        if (!xml || typeof xml !== 'string') {
            return false;
        }

        try {
            const xmlDoc = this.parseXML(xml);
            return xmlDoc.documentElement !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Extract XML content from markdown code blocks
     * 
     * @param {string} content - Content containing markdown blocks
     * @param {string} language - Language identifier (e.g., 'xml')
     * @returns {string} Extracted content or original if no blocks found
     */
    static extractFromMarkdownBlocks(content, language = 'xml') {
        if (!content) {
            return content;
        }

        const pattern = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\\s*\`\`\``);
        const match = content.match(pattern);
        
        if (match) {
            return match[1].trim();
        }
        
        return content;
    }

    /**
     * Normalize whitespace and line endings
     * Common utility for consistent formatting
     * 
     * @param {string} content - Content to normalize
     * @returns {string} Normalized content
     */
    static normalizeWhitespace(content) {
        if (!content) {
            return content;
        }
        
        // Remove leading/trailing whitespace
        let normalized = content.replace(/^\s+|\s+$/g, '');
        
        // Normalize line endings
        normalized = normalized.replace(/\r\n/g, '\n');
        
        return normalized;
    }
}
