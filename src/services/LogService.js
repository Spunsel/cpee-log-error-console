/**
 * Log Service
 * Handles fetching and processing of CPEE logs
 */

import { MermaidParser } from '../utils/content/MermaidParser.js';
import { CPEEParser } from '../utils/content/CPEEParser.js';
import { CPEETaskExtractor } from '../utils/extraction/CPEETaskExtractor.js';
import { MermaidTaskExtractor } from '../utils/extraction/MermaidTaskExtractor.js';
import { TaskMapper } from '../utils/mapping/TaskMapper.js';
import { CPEEStep } from '../models/CPEEStep.js';
import { LogParser } from '../utils/content/LogParser.js';
import { configManager } from '../config/ConfigManager.js';
import { serviceFactory } from '../core/ServiceFactory.js';
import { CPEETraceCalculator } from '../utils/trace/CPEETraceCalculator.js';
import { MermaidTraceCalculator } from '../utils/trace/MermaidTraceCalculator.js';

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
        
        const logUrl = `${configManager.get('api.endpoints.cpeeLogs')}/${uuid}.xes.yaml`;
        
        // Use proxy rotation service with rate limit handling
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), configManager.get('network.timeouts.default'));
            
            const proxyRotationService = serviceFactory.get('ProxyRotationService');
            const response = await proxyRotationService.fetchWithRotation(logUrl, {
                method: 'GET',
                headers: {
                    'Accept': configManager.get('api.headers.yamlAccept')
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const yamlContent = await response.text();
            
            if (!yamlContent || yamlContent.length < 10) {
                throw new Error('LogService: Received empty or invalid log response');
            }
            
            const events = LogParser.parseYAMLMultiDocument(yamlContent);
            
            return events;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('LogService: All proxies timed out - log file may be large or servers are slow');
            }
            throw new Error(`LogService: Failed to fetch log - ${error.message}`);
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
     * Lightweight check to see if log has any steps (for scanning optimization)
     * Stops early after finding first step instead of parsing all content
     * @param {Array} logData - Parsed log events
     * @returns {{hasSteps: boolean, stepCount: number}} Object indicating if steps exist and count
     * @throws {Error} If logData is invalid
     */
    static hasStepsInLog(logData) {
        if (!Array.isArray(logData)) {
            throw new Error('LogService: Log data must be an array');
        }
        
        // Find all exposition events using existing filter method
        const expositionEvents = this.filterEventsByTransition(logData, 'description/exposition');
        
        if (expositionEvents.length === 0) {
            return { hasSteps: false, stepCount: 0 };
        }
        
        // Group by change_uuid to count unique steps (early exit optimization)
        const stepGroups = new Set();
        for (const eventWrapper of expositionEvents) {
            const actualEvent = eventWrapper.event;
            const changeUuid = actualEvent['cpee:change_uuid'];
            
            if (changeUuid) {
                stepGroups.add(changeUuid);
            }
        }
        
        const stepCount = stepGroups.size;
        return { hasSteps: stepCount > 0, stepCount };
    }

    /**
     * Parse steps from log data
     * @param {Array} logData - Parsed log events
     * @returns {Array} Array of step objects, sorted chronologically
     * @throws {Error} If logData is invalid
     */
    /**
     * Parse steps from log data
     * @param {Array} logData - Log data array
     * @param {Object} options - Optional configuration
     * @param {boolean} options.calculateTraces - If true, calculate traces for all graph sections (default: false)
     * @param {Object} options.traceOptions - Options for trace calculation (maxLoopIterations, maxPathLength)
     * @returns {Array<CPEEStep>} Array of CPEEStep instances
     */
    static async parseStepsFromLog(logData, options = {}) {
        if (!Array.isArray(logData)) {
            throw new Error('LogService: Log data must be an array');
        }
        
        const { calculateTraces = false, traceOptions = {} } = options;
        const defaultTraceOptions = {
            maxLoopIterations: 1,
            maxPathLength: 50,
            ...traceOptions
        };
        
        console.log(`[LogService] Parsing steps from log (calculateTraces: ${calculateTraces})`);
        
        // Find all exposition events using existing filter method
        const expositionEvents = this.filterEventsByTransition(logData, 'description/exposition');
        
        console.log(`[LogService] Found ${expositionEvents.length} exposition events`);
        
        // Group by change_uuid
        const stepGroups = {};
        expositionEvents.forEach(eventWrapper => {
            const actualEvent = eventWrapper.event;
            const changeUuid = actualEvent['cpee:change_uuid'];
            const timestamp = actualEvent['time:timestamp'];
            
            if (changeUuid) {
                if (!stepGroups[changeUuid]) {
                    stepGroups[changeUuid] = {
                        changeUuid: changeUuid,
                        events: [],
                        timestamp: timestamp
                    };
                }
                stepGroups[changeUuid].events.push(actualEvent);
                
                // Keep earliest timestamp for step ordering
                if (timestamp && timestamp < stepGroups[changeUuid].timestamp) {
                    stepGroups[changeUuid].timestamp = timestamp;
                }
            }
        });
        
        // Convert to array and sort chronologically
        const steps = Object.values(stepGroups).sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // Extract content from each step and create CPEEStep objects
        const cpeeSteps = steps.map((step, index) => {
            // Extract content object for display
            const content = this.extractContentFromEvents(step.events);
            
            // Create step with extracted content
            const cpeeStep = new CPEEStep(
                index + 1,
                step.changeUuid,
                step.timestamp,
                content
            );
            
            // Process events to populate raw content
            step.events.forEach(event => {
                this.processExpositionEvent(event, cpeeStep);
            });
            
            // Extract tasks and generate task mapping
            this.generateTaskMapping(cpeeStep);
            
            return cpeeStep;
        });
        
        // Phase 31.11: Calculate traces for all steps in parallel
        if (calculateTraces) {
            console.log(`[LogService] Calculating traces for ${cpeeSteps.length} steps in parallel`);
            const tracePromises = cpeeSteps.map(cpeeStep => 
                this.calculateTracesForStep(cpeeStep, defaultTraceOptions)
            );
            await Promise.all(tracePromises);
            console.log(`[LogService] Trace calculation completed for ${cpeeSteps.length} steps`);
        }
        
        return cpeeSteps;
    }

    /**
     * Extract content object from events for display purposes
     * @param {Array} events - Events for a single step
     * @returns {Object} Content object with 5 sections
     * @private
     */
    static extractContentFromEvents(events) {
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

    /**
     * Process a single exposition event and populate step with raw content
     * @param {Object} event - Exposition event
     * @param {CPEEStep} cpeeStep - Step to populate
     * @private
     */
    static processExpositionEvent(event, cpeeStep) {
        const exposition = event['cpee:exposition'] || '';
        
        if (exposition.includes('<!-- Input CPEE-Tree -->')) {
            const cleanedContent = CPEEParser.cleanCPEETreeContent(exposition, 'input');
            cpeeStep.setInputCpeeTreeRaw(cleanedContent);
        } else if (exposition.includes('%% Input Intermediate')) {
            const cleanedContent = MermaidParser.cleanMermaidContent(exposition, 'input');
            const mermaidRaw = cpeeStep.getInputMermaidRaw();
            mermaidRaw.setContent(cleanedContent);
            mermaidRaw.setRawExposition(exposition); // Store completely unprocessed content for log view
            cpeeStep.setInputMermaidRaw(mermaidRaw);
        } else if (exposition.includes('# User Input:') || exposition.includes('User Input:')) {
            cpeeStep.setUserInputRaw(exposition);
        } else if (exposition.includes('# Used LLM:')) {
            const llmMatch = exposition.match(/#\s*Used\s*LLM:\s*([^\n]+)/i);
            if (llmMatch && llmMatch[1]) {
                cpeeStep.usedLLM = llmMatch[1].trim();
            }
        } else if (exposition.includes('%% Output Intermediate')) {
            const cleanedContent = MermaidParser.cleanMermaidContent(exposition, 'output');
            const mermaidRaw = cpeeStep.getOutputMermaidRaw();
            mermaidRaw.setContent(cleanedContent);
            mermaidRaw.setRawExposition(exposition); // Store completely unprocessed content for log view
            cpeeStep.setOutputMermaidRaw(mermaidRaw);
        } else if (exposition.includes('<!-- Output CPEE-Tree -->')) {
            const cleanedContent = CPEEParser.cleanCPEETreeContent(exposition, 'output');
            cpeeStep.setOutputCpeeTreeRaw(cleanedContent);
        }
    }

    /**
     * Extract tasks and generate task mapping for a step
     * @param {CPEEStep} cpeeStep - Step to process
     * @private
     */
    static generateTaskMapping(cpeeStep) {
        const inputCpeeTasks = CPEETaskExtractor.extract(
            cpeeStep.getInputCpeeTreeRaw().getContent()
        );
        const inputMermaidTasks = MermaidTaskExtractor.extract(
            cpeeStep.getInputMermaidRaw().getContent()
        );
        const outputMermaidTasks = MermaidTaskExtractor.extract(
            cpeeStep.getOutputMermaidRaw().getContent()
        );
        const outputCpeeTasks = CPEETaskExtractor.extract(
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
    }

    /**
     * Calculate traces for all graph sections in a step (Phase 31.11)
     * @param {CPEEStep} cpeeStep - Step to calculate traces for
     * @param {Object} options - Trace calculation options
     * @param {number} options.maxLoopIterations - Maximum loop iterations (default: 1)
     * @param {number} options.maxPathLength - Maximum path length (default: 50)
     * @private
     */
    static async calculateTracesForStep(cpeeStep, options = {}) {
        const { maxLoopIterations = 1, maxPathLength = 50 } = options;
        const traceOptions = { maxLoopIterations, maxPathLength };
        
        const sections = [
            { id: 'input-cpee', rawGetter: 'getInputCpeeTreeRaw', isCPEE: true },
            { id: 'input-intermediate', rawGetter: 'getInputMermaidRaw', isCPEE: false },
            { id: 'output-intermediate', rawGetter: 'getOutputMermaidRaw', isCPEE: false },
            { id: 'output-cpee', rawGetter: 'getOutputCpeeTreeRaw', isCPEE: true }
        ];
        
        // Calculate traces in parallel for all sections
        const tracePromises = sections.map(section => Promise.resolve().then(() => {
            try {
                console.log(`[LogService] Calculating traces for ${section.id} in Step ${cpeeStep.stepNumber}`);
                
                // Get raw content
                const rawContent = cpeeStep[section.rawGetter]();
                if (!rawContent || rawContent.isEmpty()) {
                    console.log(`[LogService] No raw content available for ${section.id} in Step ${cpeeStep.stepNumber}`);
                    return { section, traces: null, skipped: true };
                }
                
                const contentString = rawContent.getContent();
                if (!contentString || contentString.trim() === '') {
                    console.log(`[LogService] Empty content for ${section.id} in Step ${cpeeStep.stepNumber}`);
                    return { section, traces: null, skipped: true };
                }
                
                // Calculate traces based on content type
                let traces = [];
                if (section.isCPEE) {
                    traces = CPEETraceCalculator.calculateAllTraces(contentString, traceOptions);
                } else {
                    traces = MermaidTraceCalculator.calculateAllTraces(contentString, traceOptions);
                }
                
                console.log(`[LogService] Calculated ${traces.length} traces for ${section.id} in Step ${cpeeStep.stepNumber}`);
                return { section, traces, skipped: false };
                
            } catch (error) {
                console.error(`[LogService] Failed to calculate traces for ${section.id} in Step ${cpeeStep.stepNumber}:`, error);
                return { section, traces: [], skipped: false, error };
            }
        }));
        
        // Wait for all trace calculations to complete
        const results = await Promise.all(tracePromises);
        
        // Store results in step
        results.forEach(({ section, traces, skipped, error }) => {
            if (skipped) {
                return; // Skip storing if no content
            }
            if (error) {
                // Store empty array to indicate calculation was attempted but failed
                cpeeStep.setTraces(section.id, []);
            } else {
                cpeeStep.setTraces(section.id, traces);
            }
        });
    }

    /**
     * Get user input text for a step (for dropdown display)
     * @param {CPEEStep} step - CPEE step object
     * @param {number} [maxLength] - Optional maximum length before truncation
     * @returns {string|null} User input text or null if not available
     */
    static getUserInputForStep(step, maxLength) {
        if (!step) {
            return null;
        }

        try {
            // Get user input from raw content
            const userInputRaw = step.getUserInputRaw ? step.getUserInputRaw() : step.rawContent?.userInputRaw;
            if (userInputRaw && userInputRaw.getText) {
                let text = userInputRaw.getText();
                
                // Remove "# User Input: " prefix if present
                text = text.replace(/^#\s*User\s*Input:\s*/i, '').trim();
                
                // Return null if empty after cleaning
                if (!text || text.length === 0) {
                    return null;
                }
                
                // Only truncate if maxLength is explicitly provided
                if (maxLength !== undefined) {
                    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
                }
                
                // Return full text if no maxLength provided
                return text;
            }
        } catch (error) {
            console.warn('LogService: Error getting user input for step:', error);
        }

        return null;
    }
}
