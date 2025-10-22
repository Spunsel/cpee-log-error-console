/**
 * CPEE jQuery Extensions
 * Manages jQuery extensions required by the CPEE system
 * Centralizes global extension registration and prevents pollution
 */

export class CPEEJQueryExtensions {
    
    static initialized = false;
    
    /**
     * Initialize all CPEE jQuery extensions
     * Safe to call multiple times - will only initialize once
     */
    static initialize() {
        if (this.initialized) {
            return;
        }
        
        if (typeof $ === 'undefined') {
            throw new Error('CPEEJQueryExtensions: jQuery must be loaded before initializing CPEE extensions');
        }
        
        this.addXMLExtensions();
        this.addSerializationExtensions();
        this.addQueryExtensions();
        
        this.initialized = true;
    }
    
    /**
     * Add XML manipulation extensions
     * Provides $X function for enhanced XML handling
     */
    static addXMLExtensions() {
        // Add $X function for XML manipulation (enhanced version)
        window.$X = function(xmlString) {
            if (typeof xmlString === 'string') {
                if (xmlString.startsWith('<')) {
                    // Parse XML string
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
                    return $(xmlDoc.documentElement);
                } else {
                    // Create element with proper namespace
                    const elem = document.createElementNS('http://www.w3.org/2000/svg', xmlString);
                    return $(elem);
                }
            }
            return $(xmlString);
        };
    }
    
    /**
     * Add XML serialization extensions to jQuery
     * Provides serializeXML and serializePrettyXML methods
     */
    static addSerializationExtensions() {
        // Add serializeXML extension
        $.fn.serializeXML = function() {
            if (this[0]) {
                return new XMLSerializer().serializeToString(this[0]);
            }
            return '';
        };
        
        // Add serializePrettyXML extension (simplified)
        $.fn.serializePrettyXML = function() {
            return this.serializeXML();
        };
    }
    
    /**
     * Add query parsing extensions
     * Provides parseQuerySimple function for URL parameter parsing
     */
    static addQueryExtensions() {
        // Add parseQuerySimple function that CPEE uses
        $.parseQuerySimple = function() {
            const params = {};
            const urlParams = new URLSearchParams(window.location.search);
            for (const [key, value] of urlParams) {
                params[key] = value;
            }
            return params;
        };
    }
    
    /**
     * Check if extensions are initialized
     * @returns {boolean} True if extensions are ready
     */
    static isInitialized() {
        return this.initialized;
    }
    
    /**
     * Verify that all extensions are properly registered
     * @returns {boolean} True if all extensions are available
     */
    static verifyExtensions() {
        const checks = [
            typeof window.$X === 'function',
            typeof $.fn.serializeXML === 'function',
            typeof $.fn.serializePrettyXML === 'function',
            typeof $.parseQuerySimple === 'function'
        ];
        
        return checks.every(check => check === true);
    }
    
    /**
     * Reset initialization state (mainly for testing)
     * Warning: This does not remove the actual extensions from global scope
     */
    static reset() {
        this.initialized = false;
    }
    
    /**
     * Get list of extensions that would be added
     * @returns {Array} List of extension names
     */
    static getExtensionList() {
        return [
            'window.$X',
            '$.fn.serializeXML',
            '$.fn.serializePrettyXML',
            '$.parseQuerySimple'
        ];
    }
}
