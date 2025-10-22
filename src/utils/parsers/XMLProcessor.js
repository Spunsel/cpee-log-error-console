/**
 * XML Processor
 * Handles XML validation, parsing, and processing operations
 * Provides consistent XML handling across components
 */

export class XMLProcessor {
    /**
     * Clean and validate XML string
     * @param {string} xml - Raw XML string
     * @returns {string} Cleaned and validated XML
     * @throws {Error} If XML is invalid
     */
    static cleanAndValidate(xml) {
        if (!xml || typeof xml !== 'string') {
            throw new Error('XMLProcessor: Invalid XML input - must be a non-empty string');
        }

        // Remove HTML comments and extra whitespace
        let cleanedXML = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any leading whitespace and newlines
        cleanedXML = cleanedXML.replace(/^\s+/, '');
        
        // If no XML declaration, add one
        if (!cleanedXML.startsWith('<?xml')) {
            cleanedXML = '<?xml version="1.0"?>\n' + cleanedXML;
        }
        
        // Validate basic XML structure
        if (!cleanedXML.includes('<description')) {
            throw new Error('XMLProcessor: Invalid CPEE XML - missing <description> element');
        }
        
        // Parse and validate the XML structure
        try {
            const xmlDoc = this.parseXML(cleanedXML);
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XMLProcessor: XML parsing error - ' + parseError.textContent);
            }
            
            // Ensure we have a proper description element
            const descElement = xmlDoc.querySelector('description');
            if (!descElement) {
                throw new Error('XMLProcessor: No valid <description> element found');
            }
            
            console.log('✅ XML validation successful');
            return cleanedXML;
            
        } catch (error) {
            console.error('❌ XML validation failed:', error);
            throw new Error('XMLProcessor: Invalid XML structure - ' + error.message);
        }
    }

    /**
     * Parse XML string to DOM document
     * @param {string} xmlString - XML string to parse
     * @returns {Document} Parsed XML document
     * @throws {Error} If parsing fails
     */
    static parseXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
            throw new Error('XMLProcessor: XML string must be a non-empty string');
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
            throw new Error(`XMLProcessor: Failed to parse XML - ${error.message}`);
        }
    }

    /**
     * Convert XML document to jQuery object for WfAdaptor compatibility
     * @param {string} xmlString - XML string
     * @returns {Object} jQuery-wrapped XML document
     * @throws {Error} If jQuery is not available or parsing fails
     */
    static parseForWfAdaptor(xmlString) {
        if (typeof $ === 'undefined') {
            throw new Error('XMLProcessor: jQuery is required for WfAdaptor XML processing');
        }

        const xmlDoc = this.parseXML(xmlString);
        const jqueryXmlDoc = $(xmlDoc);
        
        console.log('📋 jQuery XML object created:', jqueryXmlDoc);
        return jqueryXmlDoc;
    }

    /**
     * Extract description element from XML
     * @param {string} xmlString - XML string
     * @returns {Object} Description element info
     */
    static extractDescription(xmlString) {
        const xmlDoc = this.parseXML(xmlString);
        const jqueryXmlDoc = $(xmlDoc);
        
        // Look for description as child element
        const descElement = jqueryXmlDoc.find('description');
        
        if (descElement.length === 0) {
            // Check if description is the root element
            if (xmlDoc.documentElement && xmlDoc.documentElement.tagName === 'description') {
                console.log('📋 Description is root element');
                return {
                    found: true,
                    isRoot: true,
                    element: $(xmlDoc.documentElement),
                    wrapperDoc: $('<xml></xml>').append($(xmlDoc.documentElement).clone())
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
    static serializeToString(element) {
        return new XMLSerializer().serializeToString(element);
    }

    /**
     * Validate XML against expected structure
     * @param {string} xmlString - XML string to validate
     * @param {Array} requiredElements - Array of required element names
     * @returns {Object} Validation result
     */
    static validateStructure(xmlString, requiredElements = ['description']) {
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

    /**
     * Clean Mermaid code from various formats
     * @param {string} code - Raw mermaid code
     * @returns {string} Cleaned mermaid code
     * @throws {Error} If code is invalid
     */
    static cleanMermaidCode(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('XMLProcessor: Invalid Mermaid code input - must be a non-empty string');
        }

        // Remove HTML comments and extra whitespace
        let cleanedCode = code.replace(/<!--[\s\S]*?-->/g, '').trim();

        // Remove CPEE-style comments
        cleanedCode = cleanedCode.replace(/^\s*%%.*$/gm, '').trim();

        // Extract Mermaid code from markdown code blocks
        const mermaidBlockMatch = cleanedCode.match(/```mermaid\s*\n([\s\S]*?)\n\s*```/);
        if (mermaidBlockMatch) {
            cleanedCode = mermaidBlockMatch[1].trim();
        }

        // Remove any remaining markdown code block syntax
        cleanedCode = cleanedCode.replace(/^```.*$/gm, '').trim();
        cleanedCode = cleanedCode.replace(/```\s*$/gm, '').trim();

        // Normalize line endings
        cleanedCode = cleanedCode.replace(/^\s+|\s+$/g, '');
        cleanedCode = cleanedCode.replace(/\r\n/g, '\n');

        return cleanedCode;
    }
}
