/**
 * Log Service
 * Handles fetching and processing of CPEE logs
 */

import { ContentCleaner } from '../utils/content/ContentCleaner.js';
import { CPEETaskExtractor } from '../utils/extraction/CPEETaskExtractor.js';
import { MermaidTaskExtractor } from '../utils/extraction/MermaidTaskExtractor.js';
import { TaskMapper } from '../utils/mapping/TaskMapper.js';
import { CPEEStep } from '../models/CPEEStep.js';
import { YAMLParser } from '../utils/content/YAMLParser.js';
import { configManager } from '../config/ConfigManager.js';

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
        
        const logUrl = `${configManager.get('api.endpoints.cpeeLogs')}/${uuid}.xes.yaml`;
        
        // Try each proxy in sequence
        const proxies = configManager.get('api.cors.proxies');
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            
            try {
                console.log(`Trying proxy ${i + 1}/${proxies.length}: ${proxy}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), configManager.get('network.timeouts.default'));
                
                const response = await fetch(proxy + encodeURIComponent(logUrl), {
                    method: 'GET',
                    headers: {
                        'Accept': configManager.get('api.headers.yamlAccept')
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
                if (i === proxies.length - 1) {
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
        
        return events.filter(event => 
            event.event && event.event['cpee:lifecycle:transition'] === transitionType
        );
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
        const expositionEvents = logData.filter(event => 
            event.event && event.event['cpee:lifecycle:transition'] === 'description/exposition'
        );
        
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
        const steps = Object.values(stepGroups).sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // Extract content from each step and create CPEEStep objects
        return steps.map((step, index) => {
            step.events.forEach(() => {
                // Events are processed in extractStepContent
            });
            
            const content = this.extractStepContent(step.events);
            const cpeeStep = new CPEEStep(
                index + 1,
                step.changeUuid,
                step.timestamp,
                content
            );
            
            // Populate raw content for each section from exposition events
            step.events.forEach(event => {
                const exposition = event['cpee:exposition'] || '';
                
                    if (exposition.includes('<!-- Input CPEE-Tree -->')) {
                        const cleanedContent = ContentCleaner.cleanCPEETreeContent(exposition, 'input');
                        cpeeStep.setInputCpeeTreeRaw(cleanedContent);
                    } else if (exposition.includes('%% Input Intermediate')) {
                        const cleanedContent = ContentCleaner.cleanMermaidContent(exposition, 'input');
                        cpeeStep.setInputMermaidRaw(cleanedContent);
                    } else if (exposition.includes('# User Input:') || exposition.includes('User Input:')) {
                        cpeeStep.setUserInputRaw(exposition);
                    } else if (exposition.includes('# Used LLM:')) {
                        // Extract LLM model name from "# Used LLM: <model-name>" pattern
                        const llmMatch = exposition.match(/#\s*Used\s*LLM:\s*([^\n]+)/i);
                        if (llmMatch && llmMatch[1]) {
                            cpeeStep.usedLLM = llmMatch[1].trim();
                        }
                    } else if (exposition.includes('%% Output Intermediate')) {
                        const cleanedContent = ContentCleaner.cleanMermaidContent(exposition, 'output');
                        cpeeStep.setOutputMermaidRaw(cleanedContent);
                    } else if (exposition.includes('<!-- Output CPEE-Tree -->')) {
                        const cleanedContent = ContentCleaner.cleanCPEETreeContent(exposition, 'output');
                        cpeeStep.setOutputCpeeTreeRaw(cleanedContent);
                    }
            });
            
            // Phase 22.8: Extract tasks and generate task mapping
            const inputCpeeTasks = CPEETaskExtractor.extractTasksFromXML(
                cpeeStep.getInputCpeeTreeRaw().getContent()
            );
            const inputMermaidTasks = MermaidTaskExtractor.extractTasksFromMermaid(
                cpeeStep.getInputMermaidRaw().getContent()
            );
            const outputMermaidTasks = MermaidTaskExtractor.extractTasksFromMermaid(
                cpeeStep.getOutputMermaidRaw().getContent()
            );
            const outputCpeeTasks = CPEETaskExtractor.extractTasksFromXML(
                cpeeStep.getOutputCpeeTreeRaw().getContent()
            );
            
            // Generate task mapping if we have tasks
            if (inputCpeeTasks.length > 0 || inputMermaidTasks.length > 0 || 
                outputMermaidTasks.length > 0 || outputCpeeTasks.length > 0) {
                try {
                    const taskMapper = new TaskMapper();
                    const taskMapping = taskMapper.buildMapping(
                        inputCpeeTasks,
                        inputMermaidTasks,
                        outputMermaidTasks,
                        outputCpeeTasks
                    );
                    cpeeStep.setTaskMapping(taskMapping);
                    console.log(`[LogService] Task mapping generated for Step ${cpeeStep.stepNumber}`);
                } catch (error) {
                    console.warn(`[LogService] Failed to generate task mapping for Step ${cpeeStep.stepNumber}:`, error);
                }
            }
            
            return cpeeStep;
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
            }
            if (exposition.includes('%% Input Intermediate')) {
                content.inputIntermediate = exposition;
            }
            // Check for user input - handle both direct content and YAML block scalars
            // Note: YAML block scalars (|, |+, |-) are already parsed, so we just check for the content
            if (exposition.includes('# User Input:') || exposition.includes('User Input:')) {
                content.userInput = exposition;
            }
            if (exposition.includes('%% Output Intermediate')) {
                content.outputIntermediate = exposition;
            }
            if (exposition.includes('<!-- Output CPEE-Tree -->')) {
                content.outputCpeeTree = exposition;
            }
        });
        
        return content;
    }
}
