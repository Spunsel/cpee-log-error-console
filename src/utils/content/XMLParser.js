/**
 * XML Parser
 * Handles XML parsing, validation, and processing operations
 * Provides consistent XML handling across components
 */

export class XMLParser {
    /**
     * Parse XML string to DOM document
     * @param {string} xmlString - XML string to parse
     * @returns {Document} Parsed XML document
     * @throws {Error} If parsing fails
     */
    static parseXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
            throw new Error('XMLParser: XML string must be a non-empty string');
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
            throw new Error(`XMLParser: Failed to parse XML - ${error.message}`);
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
            throw new Error('XMLParser: jQuery is required for WfAdaptor XML processing');
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
    static extractDescription(xmlString) {
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
}
