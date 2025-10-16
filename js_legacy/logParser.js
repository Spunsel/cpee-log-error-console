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
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
            `https://cors-anywhere.herokuapp.com/${originalUrl}`,
            `https://thingproxy.freeboard.io/fetch/${originalUrl}`
        ];
        
        try {
            console.log(`Fetching log for parsing...`);
            
            let response = null;
            let lastError = null;
            
            // Try each proxy until one works
            for (let i = 0; i < proxies.length; i++) {
                const proxyUrl = proxies[i];
                console.log(`LogParser attempting proxy ${i + 1}/${proxies.length}`);
                
                try {
                    response = await fetch(proxyUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/plain, application/x-yaml, text/yaml'
                        }
                    });
                    
                    if (response.ok) {
                        console.log(`LogParser success with proxy ${i + 1}`);
                        break;
                    } else {
                        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                } catch (error) {
                    lastError = error;
                    response = null;
                }
            }
            
            if (!response) {
                response = { ok: false };
            }

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
            
            // Debug: Show first few parsed events structure
            console.log('Sample parsed events:');
            events.slice(0, 5).forEach((event, index) => {
                console.log(`Event ${index} full structure:`, event);
                console.log(`Event ${index} keys:`, Object.keys(event));
                
                // Check if it's nested under 'event' key
                if (event.event) {
                    console.log(`Event ${index} nested structure:`, event.event);
                    console.log(`Event ${index} nested keys:`, Object.keys(event.event || {}));
                    console.log(`Event ${index} ALL nested key-value pairs:`);
                    Object.keys(event.event || {}).forEach(key => {
                        console.log(`  "${key}": "${event.event[key]}"`);
                    });
                    console.log(`Event ${index} lifecycle:`, event.event['cpee:lifecycle:transition']);
                    console.log(`Event ${index} change_uuid:`, event.event['cpee:change_uuid']);
                    console.log(`Event ${index} isExposition:`, event.event['cpee:lifecycle:transition'] === 'description/exposition');
                }
            });
            
            // Debug: Look for ANY exposition events in entire log
            console.log('Searching for exposition events...');
            let found = 0;
            events.forEach((event, index) => {
                if (event.event && event.event['cpee:lifecycle:transition'] === 'description/exposition') {
                    found++;
                    console.log(`Found exposition event at index ${index}:`, event.event);
                    console.log(`  - Keys:`, Object.keys(event.event));
                    console.log(`  - change_uuid:`, event.event['cpee:change_uuid']);
                    console.log(`  - exposition:`, event.event['cpee:exposition']);
                }
            });
            console.log(`Total exposition events found: ${found}`);
            
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
     * Simple CPEE YAML parser focused on exposition events
     * @param {string} yamlDoc - Single YAML document content
     * @returns {Object} Parsed object
     */
    static parseYAMLDocument(yamlDoc) {
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
                // Look for next key at same indentation level to end multi-line
                const isNewKey = !line.startsWith('  ') && trimmed.includes(':') && !trimmed.startsWith('#');
                const isEndOfDoc = i === lines.length - 1;
                
                if (isNewKey || isEndOfDoc) {
                    // End multi-line string
                    const target = currentSection || result;
                    target[multiLineKey] = multiLineContent.trim();
                    inMultiLineString = false;
                    multiLineKey = null;
                    multiLineContent = '';
                    
                    if (isEndOfDoc) break;
                    // Continue to process current line as new key
                } else {
                    // Add line to multi-line content (preserve original indentation for content)
                    multiLineContent += line + '\n';
                    continue;
                }
            }
            
            // Parse key:value pairs - handle colon-separated keys correctly
            // Look for ': ' (colon + space) as the key-value separator
            let colonIndex = trimmed.indexOf(': ');
            if (colonIndex === -1) {
                // Fallback to just colon if no space after
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
            
            // Determine target object
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
                
                // Use proper colon detection for array items too
                let arrayColonIndex = arrayValue.indexOf(': ');
                if (arrayColonIndex === -1) {
                    arrayColonIndex = arrayValue.lastIndexOf(':');
                }
                
                if (arrayColonIndex > 0) {
                    const itemKey = arrayValue.substring(0, arrayColonIndex).trim();
                    const itemValue = arrayValue.substring(arrayColonIndex + 1).trim();
                    const item = {};
                    item[itemKey] = LogParser.parseValue(itemValue);
                    target.data.push(item);
                } else {
                    target.data.push(LogParser.parseValue(arrayValue));
                }
                continue;
            }
            
            // Handle regular key-value pairs (preserve colon in key names like cpee:change_uuid)
            target[key] = LogParser.parseValue(value);
        }
        
        // Handle any remaining multi-line string
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
        return events.filter(event => {
            if (!event) return false;
            
            // Check if this is an event document with nested event data
            if (event.event && typeof event.event === 'object') {
                return event.event['cpee:lifecycle:transition'] === transitionType;
            }
            
            // Check direct structure (fallback)
            return event['cpee:lifecycle:transition'] === transitionType;
        });
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
            // Handle both nested and direct structure
            let actualEvent = event;
            if (event.event && typeof event.event === 'object') {
                actualEvent = event.event;
            }
            
            const changeUUID = actualEvent['cpee:change_uuid'];
            if (changeUUID) {
                if (!grouped[changeUUID]) {
                    grouped[changeUUID] = [];
                }
                // Store the actual event data, not the wrapper
                grouped[changeUUID].push(actualEvent);
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
        
        console.log('Grouped exposition events by change_uuid:', grouped);

        return grouped;
    }
}
