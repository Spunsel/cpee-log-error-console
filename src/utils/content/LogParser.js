/**
 * Log Parser
 * Unified parser for XML and YAML content from log files
 * Provides consistent parsing, validation, and processing operations
 * 
 * Consolidates XMLParser and YAMLParser functionality
 */

export class LogParser {
    
    // YAML-specific constants
    static BLOCK_SCALARS = ['|', '|-', '|+'];
    static NULL_VALUES = ['null', '__NOTSPECIFIED__'];

    // ============================================
    // XML PARSING METHODS
    // ============================================

    /**
     * Parse XML string to DOM document
     * @param {string} xmlString - XML string to parse
     * @returns {Document} Parsed XML document
     * @throws {Error} If parsing fails
     */
    static parseXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
            throw new Error('LogParser: XML string must be a non-empty string');
        }
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error(parseError.textContent);
            }
            
            return xmlDoc;
        } catch (error) {
            throw new Error(`LogParser: Failed to parse XML - ${error.message}`);
        }
    }

    /**
     * Convert XML document to jQuery object for WfAdaptor compatibility
     * @param {string} xmlString - XML string
     * @returns {Object} jQuery-wrapped XML document
     * @throws {Error} If jQuery is not available or parsing fails
     */
    static parseXMLForWfAdaptor(xmlString) {
        if (typeof $ === 'undefined') {
            throw new Error('LogParser: jQuery is required for WfAdaptor XML processing');
        }

        const xmlDoc = this.parseXML(xmlString);
        const jqueryXmlDoc = window.$(xmlDoc);
        
        console.log('📋 jQuery XML object created:', jqueryXmlDoc);
        return jqueryXmlDoc;
    }

    /**
     * Extract description element from XML
     * @param {string} xmlString - XML string
     * @returns {Object} Description element info
     */
    static extractDescriptionFromXML(xmlString) {
        const xmlDoc = this.parseXML(xmlString);
        const jqueryXmlDoc = window.$(xmlDoc);
        
        // Look for description as child element
        const descElement = jqueryXmlDoc.find('description');
        
        if (descElement.length === 0) {
            // Check if description is the root element
            if (xmlDoc.documentElement && xmlDoc.documentElement.tagName === 'description') {
                console.log('📋 Description is root element');
                return {
                    found: true,
                    isRoot: true,
                    element: window.$(xmlDoc.documentElement),
                    wrapperDoc: window.$('<xml></xml>').append(window.$(xmlDoc.documentElement).clone())
                };
            } else {
                return {
                    found: false,
                    isRoot: false,
                    element: null,
                    wrapperDoc: null
                };
            }
        } else {
            console.log('📋 Found description as child element');
            return {
                found: true,
                isRoot: false,
                element: descElement,
                wrapperDoc: jqueryXmlDoc
            };
        }
    }

    /**
     * Serialize XML element to string
     * @param {Element} element - XML element
     * @returns {string} Serialized XML string
     */
    static serializeXMLToString(element) {
        return new XMLSerializer().serializeToString(element);
    }

    /**
     * Validate XML against expected structure
     * @param {string} xmlString - XML string to validate
     * @param {Array} requiredElements - Array of required element names
     * @returns {Object} Validation result
     */
    static validateXMLStructure(xmlString, requiredElements = ['description']) {
        try {
            const xmlDoc = this.parseXML(xmlString);
            const missing = [];
            const found = [];

            requiredElements.forEach(elementName => {
                const element = xmlDoc.querySelector(elementName);
                if (element) {
                    found.push(elementName);
                } else {
                    missing.push(elementName);
                }
            });

            return {
                valid: missing.length === 0,
                found: found,
                missing: missing,
                document: xmlDoc
            };
        } catch (error) {
            return {
                valid: false,
                found: [],
                missing: requiredElements,
                error: error.message,
                document: null
            };
        }
    }

    // ============================================
    // YAML PARSING METHODS
    // ============================================

    /**
     * Parse multi-document YAML content
     * @param {string} yamlContent - Full YAML content
     * @returns {Array} Array of parsed events
     * @throws {Error} If YAML content is invalid
     */
    static parseYAMLMultiDocument(yamlContent) {
        if (!yamlContent || typeof yamlContent !== 'string') {
            throw new Error('LogParser: Invalid YAML content - must be a non-empty string');
        }

        return yamlContent
            .split(/^---$/m)
            .map(doc => doc.trim())
            .filter(doc => doc.length > 0)
            .map((docContent, index) => {
                try {
                    const parsed = this.parseYAMLSingleDocument(docContent);
                    if (parsed && typeof parsed === 'object') {
                        parsed._documentIndex = index + 1;
                        return parsed;
                    }
                } catch (error) {
                    console.warn(`Failed to parse document ${index + 1}:`, error.message);
                }
                return null;
            })
            .filter(Boolean);
    }

    /**
     * Parse single YAML document
     * @param {string} yamlDoc - Single YAML document content
     * @returns {Object} Parsed object
     */
    static parseYAMLSingleDocument(yamlDoc) {
        const lines = yamlDoc.split('\n');
        const result = {};
        let currentSection = null;
        let multiLineState = null; // { key, content, inProgress }
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (!trimmed) {
                continue;
            }
            
            // Handle multi-line strings
            if (multiLineState?.inProgress) {
                if (this.isNewKeyLine(line, trimmed) || i === lines.length - 1) {
                    this.finalizeMultiLineString(result, currentSection, multiLineState);
                    multiLineState = null;
                    
                    if (i === lines.length - 1) {
                        break;
                    }
                } else {
                    this.addToMultiLineContent(multiLineState, line, trimmed);
                    continue;
                }
            }
            
            const { key, value } = this.parseKeyValue(trimmed);
            if (!key) {
                continue;
            }
            
            // Handle top-level sections
            if (!line.startsWith('  ') && (!value || value === '')) {
                currentSection = {};
                result[key] = currentSection;
                continue;
            }
            
            const target = currentSection || result;
            
            // Handle block scalars
            if (this.BLOCK_SCALARS.includes(value)) {
                multiLineState = { key, content: '', inProgress: true };
                continue;
            }
            
            // Handle array items
            if (trimmed.startsWith('- ')) {
                this.handleArrayItem(target, trimmed.substring(2).trim());
                continue;
            }
            
            // Handle regular key-value pairs
            target[key] = this.parseValue(value);
        }
        
        // Finalize any remaining multi-line string
        if (multiLineState?.inProgress) {
            this.finalizeMultiLineString(result, currentSection, multiLineState);
        }
        
        return result;
    }

    // ============================================
    // YAML HELPER METHODS
    // ============================================

    /**
     * Check if line represents a new key (not part of multi-line content)
     */
    static isNewKeyLine(line, trimmed) {
        return !line.startsWith('  ') && trimmed.includes(':') && !trimmed.startsWith('#');
    }
    
    /**
     * Add content to multi-line string, filtering timestamps
     */
    static addToMultiLineContent(multiLineState, line, trimmed) {
        if (!trimmed.startsWith('time:timestamp:')) {
            multiLineState.content += line + '\n';
        }
    }
    
    /**
     * Finalize multi-line string and add to target object
     */
    static finalizeMultiLineString(result, currentSection, multiLineState) {
        const target = currentSection || result;
        target[multiLineState.key] = multiLineState.content.trim();
    }
    
    /**
     * Parse key:value from trimmed line
     */
    static parseKeyValue(trimmed) {
        let colonIndex = trimmed.indexOf(': ');
        if (colonIndex === -1) {
            colonIndex = trimmed.lastIndexOf(':');
            if (colonIndex === -1) {
                return { key: null, value: null };
            }
        }
        
        return {
            key: trimmed.substring(0, colonIndex).trim(),
            value: trimmed.substring(colonIndex + 1).trim()
        };
    }
    
    /**
     * Handle array item parsing
     */
    static handleArrayItem(target, arrayValue) {
        // Ensure target.data is an array - if it exists but isn't an array, convert/overwrite it
        if (!target.data || !Array.isArray(target.data)) {
            target.data = [];
        }
        
        const colonIndex = arrayValue.indexOf(': ') !== -1 
            ? arrayValue.indexOf(': ') 
            : arrayValue.lastIndexOf(':');
        
        if (colonIndex > 0) {
            const itemKey = arrayValue.substring(0, colonIndex).trim();
            const itemValue = arrayValue.substring(colonIndex + 1).trim();
            target.data.push({ [itemKey]: this.parseValue(itemValue) });
        } else {
            target.data.push(this.parseValue(arrayValue));
        }
    }

    /**
     * Parse individual values with type conversion
     * @param {string} value - String value to parse
     * @returns {any} Parsed value with appropriate type
     */
    static parseValue(value) {
        if (!value || this.NULL_VALUES.includes(value)) {
            return null;
        }
        
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
        
        // Remove quotes
        if ((value.startsWith("'") && value.endsWith("'")) || 
            (value.startsWith('"') && value.endsWith('"'))) {
            return value.slice(1, -1);
        }
        
        // Try to parse as number
        const num = Number(value);
        if (!isNaN(num) && isFinite(num)) {
            return num;
        }
        
        return value;
    }
}
