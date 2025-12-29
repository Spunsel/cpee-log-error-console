/**
 * Step Assembly Service
 * Orchestrates the assembly of CPEEStep objects from log events
 * Single responsibility: Step creation orchestration
 */

import { CPEEStep } from '../models/CPEEStep.js';

export class StepAssemblyService {
    /**
     * Create a new StepAssemblyService instance
     * @param {EventProcessingService} eventProcessingService - Service for event processing
     * @param {ContentProcessingService} contentProcessingService - Service for content processing
     * @param {TaskMappingService} taskMappingService - Service for task mapping
     * @param {TraceCalculationService} traceCalculationService - Service for trace calculation
     */
    constructor(eventProcessingService, contentProcessingService, taskMappingService, traceCalculationService) {
        if (eventProcessingService === null || eventProcessingService === undefined) {
            throw new TypeError('eventProcessingService is required');
        }
        if (contentProcessingService === null || contentProcessingService === undefined) {
            throw new TypeError('contentProcessingService is required');
        }
        if (taskMappingService === null || taskMappingService === undefined) {
            throw new TypeError('taskMappingService is required');
        }
        if (traceCalculationService === null || traceCalculationService === undefined) {
            throw new TypeError('traceCalculationService is required');
        }
        
        this.eventProcessingService = eventProcessingService;
        this.contentProcessingService = contentProcessingService;
        this.taskMappingService = taskMappingService;
        this.traceCalculationService = traceCalculationService;
    }

    /**
     * Parse steps from log data
     * @param {Array} logData - Log data array
     * @param {Object} options - Optional configuration
     * @param {boolean} options.calculateTraces - Calculate traces (default: false)
     * @param {Object} options.traceOptions - Trace calculation options
     * @returns {Promise<Array<CPEEStep>>} Array of CPEEStep instances
     */
    async parseStepsFromLog(logData, options = {}) {
        if (!Array.isArray(logData)) {
            throw new Error('StepAssemblyService: Log data must be an array');
        }
        
        const { calculateTraces = false, traceOptions = {} } = options;
        const defaultTraceOptions = {
            maxLoopIterations: 1,
            maxPathLength: 50,
            ...traceOptions
        };
        
        console.log(`[StepAssemblyService] Parsing steps from log (calculateTraces: ${calculateTraces})`);
        
        // Find all exposition events using EventProcessingService
        const expositionEvents = this.eventProcessingService.filterEventsByTransition(logData, 'description/exposition');
        
        console.log(`[StepAssemblyService] Found ${expositionEvents.length} exposition events`);
        
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
            // Extract content object for display using EventProcessingService
            const content = this.eventProcessingService.extractContentFromEvents(step.events);
            
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
            
            // Extract tasks and generate task mapping using TaskMappingService
            this.taskMappingService.generateTaskMapping(cpeeStep);
            
            return cpeeStep;
        });
        
        // Calculate traces for all steps in parallel if requested
        if (calculateTraces) {
            console.log(`[StepAssemblyService] Calculating traces for ${cpeeSteps.length} steps in parallel`);
            const tracePromises = cpeeSteps.map(cpeeStep => 
                this.traceCalculationService.calculateTracesForStep(cpeeStep, defaultTraceOptions)
            );
            await Promise.all(tracePromises);
            console.log(`[StepAssemblyService] Trace calculation completed for ${cpeeSteps.length} steps`);
        }
        
        return cpeeSteps;
    }

    /**
     * Process a single exposition event and populate step with raw content
     * @param {Object} event - Exposition event
     * @param {CPEEStep} cpeeStep - Step to populate
     * @private
     */
    processExpositionEvent(event, cpeeStep) {
        const exposition = event['cpee:exposition'] || '';
        
        if (exposition.includes('<!-- Input CPEE-Tree -->')) {
            const cleanedContent = this.contentProcessingService.processCPEETreeContent(exposition, 'input');
            cpeeStep.setInputCpeeTreeRaw(cleanedContent);
        } else if (exposition.includes('%% Input Intermediate')) {
            const cleanedContent = this.contentProcessingService.processMermaidContent(exposition, 'input');
            const mermaidRaw = cpeeStep.getInputMermaidRaw();
            mermaidRaw.setContent(cleanedContent);
            mermaidRaw.setRawExposition(exposition); // Store completely unprocessed content for Raw View
            cpeeStep.setInputMermaidRaw(mermaidRaw);
        } else if (exposition.includes('# User Input:') || exposition.includes('User Input:')) {
            const processedContent = this.contentProcessingService.processUserInput(exposition);
            cpeeStep.setUserInputRaw(processedContent);
        } else if (exposition.includes('# Used LLM:')) {
            const llmMatch = exposition.match(/#\s*Used\s*LLM:\s*([^\n]+)/i);
            if (llmMatch && llmMatch[1]) {
                cpeeStep.usedLLM = llmMatch[1].trim();
            }
        } else if (exposition.includes('%% Output Intermediate')) {
            const cleanedContent = this.contentProcessingService.processMermaidContent(exposition, 'output');
            const mermaidRaw = cpeeStep.getOutputMermaidRaw();
            mermaidRaw.setContent(cleanedContent);
            mermaidRaw.setRawExposition(exposition); // Store completely unprocessed content for Raw View
            cpeeStep.setOutputMermaidRaw(mermaidRaw);
        } else if (exposition.includes('<!-- Output CPEE-Tree -->')) {
            const cleanedContent = this.contentProcessingService.processCPEETreeContent(exposition, 'output');
            cpeeStep.setOutputCpeeTreeRaw(cleanedContent);
        }
    }
}

