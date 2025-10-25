/**
 * YAML Parser for CPEE Logs
 * Handles parsing of CPEE .xes.yaml log files
 */

export class YAMLParser {
    // Block scalar indicators
    static BLOCK_SCALARS = ['|', '|-', '|+'];
    
    // Special values that should be parsed as null
    static NULL_VALUES = ['null', '__NOTSPECIFIED__'];

    /**
     * Parse multi-document YAML content
     * @param {string} yamlContent - Full YAML content
     * @returns {Array} Array of parsed events
     * @throws {Error} If YAML content is invalid
     */
    static parseMultiDocument(yamlContent) {
        if (!yamlContent || typeof yamlContent !== 'string') {
            throw new Error('YAMLParser: Invalid YAML content - must be a non-empty string');
        }

        return yamlContent
            .split(/^---$/m)
            .map(doc => doc.trim())
            .filter(doc => doc.length > 0)
            .map((docContent, index) => {
                try {
                    const parsed = this.parseSingleDocument(docContent);
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
    static parseSingleDocument(yamlDoc) {
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
        if (!target.data) {
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
