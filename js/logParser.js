/**
 * CPEE Log Parser
 * Handles fetching and parsing of CPEE .xes.yaml log files
 */

class LogParser {
    /**
     * Fetch log from CPEE endpoint and parse it
     * @param {string} uuid - CPEE instance UUID
     * @returns {Promise<Array>} Parsed log events
     */
    static async fetchAndParseLog(uuid) {
        if (!uuid) {
            throw new Error('UUID is required');
        }

        // Validate UUID format (basic check)
        if (!LogParser.isValidUUID(uuid)) {
            throw new Error('Invalid UUID format');
        }

        const originalUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
        const logUrl = `https://cors-anywhere.herokuapp.com/${originalUrl}`;
        
        try {
            console.log(`Fetching log from: ${logUrl}`);
            
            const response = await fetch(logUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, application/x-yaml, text/yaml',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Log not found for UUID: ${uuid}`);
                } else if (response.status === 403) {
                    throw new Error('Access denied to log file');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }

            const yamlContent = await response.text();
            
            if (!yamlContent.trim()) {
                throw new Error('Empty log file');
            }

            console.log(`Log fetched successfully, size: ${yamlContent.length} characters`);
            
            // Parse YAML content
            const events = LogParser.parseYAMLEvents(yamlContent);
            
            console.log(`Parsed ${events.length} events from log`);
            
            return events;

        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                // Network or CORS error
                throw new Error('Network error: Unable to fetch log. This might be due to CORS restrictions.');
            }
            throw error;
        }
    }

    /**
     * Parse YAML content into individual events
     * @param {string} yamlContent - Raw YAML content
     * @returns {Array} Array of parsed events
     */
    static parseYAMLEvents(yamlContent) {
        const events = [];
        
        // Split by document separator (---)
        const documents = yamlContent.split(/^---$/m);
        
        for (let i = 0; i < documents.length; i++) {
            const docContent = documents[i].trim();
            
            if (!docContent) continue;
            
            try {
                // Parse each YAML document
                const parsed = LogParser.parseYAMLDocument(docContent);
                
                if (parsed && typeof parsed === 'object') {
                    // Add document index for debugging
                    parsed._documentIndex = i;
                    events.push(parsed);
                }
            } catch (error) {
                console.warn(`Failed to parse document ${i}:`, error.message);
                // Continue with other documents even if one fails
            }
        }

        return events;
    }

    /**
     * Simple YAML parser for our specific log format
     * @param {string} yamlDoc - Single YAML document content
     * @returns {Object} Parsed object
     */
    static parseYAMLDocument(yamlDoc) {
        const result = {};
        const lines = yamlDoc.split('\n');
        let currentKey = null;
        let currentValue = '';
        let inMultiLineString = false;
        let multiLineDelimiter = null;
        let indentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Handle multi-line strings
            if (inMultiLineString) {
                if (line.trim() === multiLineDelimiter || (line.trim() === '' && i === lines.length - 1)) {
                    // End of multi-line string
                    result[currentKey] = currentValue.trim();
                    inMultiLineString = false;
                    currentKey = null;
                    currentValue = '';
                    multiLineDelimiter = null;
                } else {
                    // Continue multi-line string
                    currentValue += line.substring(indentLevel) + '\n';
                }
                continue;
            }

            // Skip empty lines and comments
            if (!line.trim() || line.trim().startsWith('#')) {
                continue;
            }

            // Parse key-value pairs
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();

                if (value === '|-' || value === '|') {
                    // Start of multi-line string
                    currentKey = key;
                    inMultiLineString = true;
                    multiLineDelimiter = null;
                    indentLevel = line.length - line.trimStart().length + 2; // Preserve indentation
                    currentValue = '';
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    // Single quoted string
                    result[key] = value.slice(1, -1);
                } else if (value.startsWith('"') && value.endsWith('"')) {
                    // Double quoted string
                    result[key] = value.slice(1, -1);
                } else if (value === '') {
                    // Empty value or start of nested object
                    result[key] = null;
                } else {
                    // Regular value
                    result[key] = LogParser.parseValue(value);
                }
            } else if (line.trim().startsWith('- ')) {
                // Array item (simplified handling for our use case)
                const value = line.trim().substring(2);
                if (!result.data) result.data = [];
                
                // Try to parse as key-value if it contains ':'
                const itemColonIndex = value.indexOf(':');
                if (itemColonIndex > 0) {
                    const itemKey = value.substring(0, itemColonIndex).trim();
                    const itemValue = value.substring(itemColonIndex + 1).trim();
                    const item = {};
                    item[itemKey] = LogParser.parseValue(itemValue);
                    result.data.push(item);
                } else {
                    result.data.push(LogParser.parseValue(value));
                }
            }
        }

        return result;
    }

    /**
     * Parse individual values with type conversion
     * @param {string} value - String value to parse
     * @returns {any} Parsed value with appropriate type
     */
    static parseValue(value) {
        if (!value || value === 'null') return null;
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === '__NOTSPECIFIED__') return null;
        
        // Try to parse as number
        const num = Number(value);
        if (!isNaN(num) && isFinite(num)) {
            return num;
        }

        // Return as string
        return value;
    }

    /**
     * Validate UUID format
     * @param {string} uuid - UUID to validate
     * @returns {boolean} True if valid UUID format
     */
    static isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Filter events by type
     * @param {Array} events - Array of events
     * @param {string} transitionType - Lifecycle transition type to filter
     * @returns {Array} Filtered events
     */
    static filterEventsByTransition(events, transitionType) {
        return events.filter(event => 
            event && 
            event['cpee:lifecycle:transition'] === transitionType
        );
    }

    /**
     * Get exposition events grouped by change UUID
     * @param {Array} events - Array of all events
     * @returns {Object} Events grouped by cpee:change_uuid
     */
    static getExpositionEventsByChangeUUID(events) {
        const expositionEvents = LogParser.filterEventsByTransition(events, 'description/exposition');
        const grouped = {};

        expositionEvents.forEach(event => {
            const changeUUID = event['cpee:change_uuid'];
            if (changeUUID) {
                if (!grouped[changeUUID]) {
                    grouped[changeUUID] = [];
                }
                grouped[changeUUID].push(event);
            }
        });

        // Sort events within each group by timestamp
        Object.keys(grouped).forEach(uuid => {
            grouped[uuid].sort((a, b) => {
                const timeA = new Date(a['time:timestamp'] || 0);
                const timeB = new Date(b['time:timestamp'] || 0);
                return timeA - timeB;
            });
        });

        return grouped;
    }
}
