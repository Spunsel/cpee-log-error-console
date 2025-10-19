/**
 * YAML Parser for CPEE Logs
 * Handles parsing of CPEE .xes.yaml log files
 */

export class YAMLParser {
    /**
     * Parse multi-document YAML content
     * @param {string} yamlContent - Full YAML content
     * @returns {Array} Array of parsed events
     */
    static parseMultiDocument(yamlContent) {
        if (!yamlContent || typeof yamlContent !== 'string') {
            throw new Error('Invalid YAML content provided');
        }

        // Split by document separator and filter empty documents
        const documents = yamlContent.split(/^---$/m)
            .map(doc => doc.trim())
            .filter(doc => doc.length > 0);

        const events = [];

        for (let i = 0; i < documents.length; i++) {
            const docContent = documents[i].trim();
            
            if (!docContent) continue;
            
            try {
                const parsed = this.parseSingleDocument(docContent);
                
                if (parsed && typeof parsed === 'object') {
                    parsed._documentIndex = i + 1;
                    events.push(parsed);
                }
            } catch (error) {
                console.warn(`Failed to parse document ${i + 1}:`, error.message);
            }
        }

        return events;
    }

    /**
     * Parse single YAML document
     * @param {string} yamlDoc - Single YAML document content
     * @returns {Object} Parsed object
     */
    static parseSingleDocument(yamlDoc) {
        const lines = yamlDoc.split('\n');
        const result = {};
        let currentSection = null;
        let inMultiLineString = false;
        let multiLineKey = null;
        let multiLineContent = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Skip empty lines
            if (!trimmed) continue;
            
            // Handle multi-line strings
            if (inMultiLineString) {
                const isNewKey = !line.startsWith('  ') && trimmed.includes(':') && !trimmed.startsWith('#');
                const isEndOfDoc = i === lines.length - 1;
                
                if (isNewKey || isEndOfDoc) {
                    const target = currentSection || result;
                    target[multiLineKey] = multiLineContent.trim();
                    inMultiLineString = false;
                    multiLineKey = null;
                    multiLineContent = '';
                    
                    if (isEndOfDoc) break;
                } else {
                    multiLineContent += line + '\n';
                    continue;
                }
            }
            
            // Parse key:value pairs with proper colon handling
            let colonIndex = trimmed.indexOf(': ');
            if (colonIndex === -1) {
                colonIndex = trimmed.lastIndexOf(':');
                if (colonIndex === -1) continue;
            }
            
            const key = trimmed.substring(0, colonIndex).trim();
            const value = trimmed.substring(colonIndex + 1).trim();
            
            // Handle top-level sections like "event:" or "log:"
            if (!line.startsWith('  ') && (value === '' || value === null)) {
                currentSection = {};
                result[key] = currentSection;
                continue;
            }
            
            const target = currentSection || result;
            
            // Handle multi-line strings (|, |-)
            if (value === '|' || value === '|-') {
                inMultiLineString = true;
                multiLineKey = key;
                multiLineContent = '';
                continue;
            }
            
            // Handle array items
            if (trimmed.startsWith('- ')) {
                const arrayValue = trimmed.substring(2).trim();
                if (!target.data) target.data = [];
                
                let arrayColonIndex = arrayValue.indexOf(': ');
                if (arrayColonIndex === -1) {
                    arrayColonIndex = arrayValue.lastIndexOf(':');
                }
                
                if (arrayColonIndex > 0) {
                    const itemKey = arrayValue.substring(0, arrayColonIndex).trim();
                    const itemValue = arrayValue.substring(arrayColonIndex + 1).trim();
                    const item = {};
                    item[itemKey] = this.parseValue(itemValue);
                    target.data.push(item);
                } else {
                    target.data.push(this.parseValue(arrayValue));
                }
                continue;
            }
            
            // Handle regular key-value pairs
            target[key] = this.parseValue(value);
        }
        
        // Handle remaining multi-line string
        if (inMultiLineString && multiLineKey) {
            const target = currentSection || result;
            target[multiLineKey] = multiLineContent.trim();
        }
        
        return result;
    }

    /**
     * Parse individual values with type conversion
     * @param {string} value - String value to parse
     * @returns {any} Parsed value with appropriate type
     */
    static parseValue(value) {
        if (!value || value === 'null' || value === '__NOTSPECIFIED__') {
            return null;
        }
        
        if (value === 'true') return true;
        if (value === 'false') return false;
        
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
