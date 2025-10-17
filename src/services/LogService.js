/**
 * Log Service
 * Handles fetching and processing of CPEE logs
 */

import { YAMLParser } from '../parsers/YAMLParser.js';

export class LogService {
    // Use a single, reliable CORS proxy
    static CORS_PROXY = 'https://corsproxy.io/?';

    /**
     * Fetch and parse log for given UUID
     * @param {string} uuid - CPEE instance UUID
     * @returns {Promise<Array>} Parsed log events
     */
    static async fetchAndParseLog(uuid) {
        console.log('Fetching log for parsing...');
        
        const logUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
        
        try {
            console.log('Fetching log via CORS proxy...');
            
            // Create timeout controller for fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(this.CORS_PROXY + encodeURIComponent(logUrl), {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, application/x-yaml, text/yaml'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            console.log('Log fetched successfully via CORS proxy');
            const yamlContent = await response.text();
            
            console.log(`Log content size: ${yamlContent.length} characters`);
            
            const events = YAMLParser.parseMultiDocument(yamlContent);
            console.log(`Parsed ${events.length} events from log`);
            
            return events;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. The log file may be large or the server is slow.');
            }
            throw new Error(`Failed to fetch log: ${error.message}. Please try again or check if the UUID is correct.`);
        }
    }

    /**
     * Filter events by lifecycle transition type
     * @param {Array} events - Array of events
     * @param {string} transitionType - Lifecycle transition type to filter
     * @returns {Array} Filtered events
     */
    static filterEventsByTransition(events, transitionType) {
        return events.filter(event => {
            return event.event && event.event['cpee:lifecycle:transition'] === transitionType;
        });
    }

    /**
     * Get exposition events grouped by change UUID
     * @param {Array} events - Array of all events
     * @returns {Object} Events grouped by cpee:change_uuid
     */
    static getExpositionEventsByChangeUUID(events) {
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
     */
    static parseStepsFromLog(logData) {
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
        
        // Extract content from each step
        return steps.map((step, index) => {
            const content = this.extractStepContent(step.events);
            return {
                stepNumber: index + 1,
                changeUuid: step.changeUuid,
                timestamp: step.timestamp,
                content: content
            };
        });
    }

    /**
     * Extract the 5 content types from step events
     * @param {Array} events - Events for a single step
     * @returns {Object} Content object with 5 sections
     */
    static extractStepContent(events) {
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
