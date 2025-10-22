/**
 * Log Service
 * Handles fetching and processing of CPEE logs
 */

import { YAMLParser } from '../utils/parsers/YAMLParser.js';
import { CPEEStep } from '../modules/CPEEStep.js';
import { CORS_CONFIG, buildLogUrl } from '../config/service-config.js';

export class LogService {

    /**
     * Fetch and parse log for given UUID with fallback proxies
     * @param {string} uuid - CPEE instance UUID
     * @returns {Promise<Array>} Parsed log events
     * @throws {Error} If UUID is invalid or fetch fails
     */
    static async fetchAndParseLog(uuid) {
        if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
            throw new Error('LogService: Invalid UUID provided - must be a non-empty string');
        }
        
        console.log('Fetching log for parsing...');
        
        const logUrl = buildLogUrl(uuid);
        
        // Try each proxy in sequence
        for (let i = 0; i < CORS_CONFIG.PROXIES.length; i++) {
            const proxy = CORS_CONFIG.PROXIES[i];
            
            try {
                console.log(`Trying proxy ${i + 1}/${CORS_CONFIG.PROXIES.length}: ${proxy}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(proxy + encodeURIComponent(logUrl), {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/plain, application/x-yaml, text/yaml'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`LogService: HTTP ${response.status} - ${response.statusText}`);
                }
                
                console.log(`Log fetched successfully via proxy ${i + 1}`);
                const yamlContent = await response.text();
                
                if (!yamlContent || yamlContent.length < 10) {
                    throw new Error('LogService: Received empty or invalid log response');
                }
                
                console.log(`Log content size: ${yamlContent.length} characters`);
                
                const events = YAMLParser.parseMultiDocument(yamlContent);
                console.log(`Parsed ${events.length} events from log`);
                
                return events;
                
            } catch (error) {
                console.warn(`Proxy ${i + 1} failed:`, error.message);
                
                // If this is the last proxy, throw the error
                if (i === CORS_CONFIG.PROXIES.length - 1) {
                    if (error.name === 'AbortError') {
                        throw new Error('LogService: All proxies timed out - log file may be large or servers are slow');
                    }
                    throw new Error(`LogService: All proxies failed - ${error.message}`);
                }
            }
        }
    }

    /**
     * Filter events by lifecycle transition type
     * @param {Array} events - Array of events
     * @param {string} transitionType - Lifecycle transition type to filter
     * @returns {Array} Filtered events
     * @throws {Error} If parameters are invalid
     */
    static filterEventsByTransition(events, transitionType) {
        if (!Array.isArray(events)) {
            throw new Error('LogService: Events must be an array');
        }
        
        if (!transitionType || typeof transitionType !== 'string') {
            throw new Error('LogService: Transition type must be a non-empty string');
        }
        
        return events.filter(event => {
            return event.event && event.event['cpee:lifecycle:transition'] === transitionType;
        });
    }

    /**
     * Get exposition events grouped by change UUID
     * @param {Array} events - Array of all events
     * @returns {Object} Events grouped by cpee:change_uuid
     * @throws {Error} If events parameter is invalid
     */
    static getExpositionEventsByChangeUUID(events) {
        if (!Array.isArray(events)) {
            throw new Error('LogService: Events must be an array');
        }
        
        const expositionEvents = this.filterEventsByTransition(events, 'description/exposition');
        const grouped = {};

        expositionEvents.forEach(event => {
            const actualEvent = event.event;
            const changeUUID = actualEvent['cpee:change_uuid'];
            
            if (changeUUID) {
                if (!grouped[changeUUID]) {
                    grouped[changeUUID] = [];
                }
                grouped[changeUUID].push(actualEvent);
            }
        });

        // Sort events within each group by timestamp
        Object.keys(grouped).forEach(uuid => {
            grouped[uuid].sort((a, b) => {
                const timeA = a['time:timestamp'] || '';
                const timeB = b['time:timestamp'] || '';
                return timeA.localeCompare(timeB);
            });
        });

        return grouped;
    }

    /**
     * Parse steps from log data
     * @param {Array} logData - Parsed log events
     * @returns {Array} Array of step objects, sorted chronologically
     * @throws {Error} If logData is invalid
     */
    static parseStepsFromLog(logData) {
        if (!Array.isArray(logData)) {
            throw new Error('LogService: Log data must be an array');
        }
        
        // Find all exposition events
        const expositionEvents = logData.filter(event => {
            return event.event && event.event['cpee:lifecycle:transition'] === 'description/exposition';
        });
        
        console.log(`Found ${expositionEvents.length} exposition events`);
        
        // Group by change_uuid
        const stepGroups = {};
        expositionEvents.forEach(event => {
            const changeUuid = event.event['cpee:change_uuid'];
            const timestamp = event.event['time:timestamp'];
            
            if (changeUuid) {
                if (!stepGroups[changeUuid]) {
                    stepGroups[changeUuid] = {
                        changeUuid: changeUuid,
                        events: [],
                        timestamp: timestamp
                    };
                }
                stepGroups[changeUuid].events.push(event.event);
                
                // Keep earliest timestamp for step ordering
                if (timestamp < stepGroups[changeUuid].timestamp) {
                    stepGroups[changeUuid].timestamp = timestamp;
                }
            }
        });
        
        // Convert to array and sort chronologically
        const steps = Object.values(stepGroups).sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Extract content from each step and create CPEEStep objects
        return steps.map((step, index) => {
            const content = this.extractStepContent(step.events);
            return new CPEEStep(
                index + 1,
                step.changeUuid,
                step.timestamp,
                content
            );
        });
    }

    /**
     * Extract the 5 content types from step events
     * @param {Array} events - Events for a single step
     * @returns {Object} Content object with 5 sections
     * @throws {Error} If events parameter is invalid
     */
    static extractStepContent(events) {
        if (!Array.isArray(events)) {
            throw new Error('LogService: Events must be an array');
        }
        
        const content = {
            inputCpeeTree: 'Not found',
            inputIntermediate: 'Not found', 
            userInput: 'Not found',
            outputIntermediate: 'Not found',
            outputCpeeTree: 'Not found'
        };
        
        events.forEach(event => {
            const exposition = event['cpee:exposition'] || '';
            
            if (exposition.includes('<!-- Input CPEE-Tree -->')) {
                content.inputCpeeTree = exposition;
            } else if (exposition.includes('%% Input Intermediate')) {
                content.inputIntermediate = exposition;
            } else if (exposition.includes('# User Input:')) {
                content.userInput = exposition;
            } else if (exposition.includes('%% Output Intermediate')) {
                content.outputIntermediate = exposition;
            } else if (exposition.includes('<!-- Output CPEE-Tree -->')) {
                content.outputCpeeTree = exposition;
            }
        });
        
        return content;
    }
}
