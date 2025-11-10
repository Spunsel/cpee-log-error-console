/**
 * Event Processing Service
 * Handles filtering, grouping, and processing of log events by change UUID
 * Single responsibility: Event processing operations
 */

export class EventProcessingService {
    /**
     * Create a new EventProcessingService instance
     */
    constructor() {
        // No dependencies - pure processing logic
    }

    /**
     * Filter events by lifecycle transition type
     * @param {Array} events - Array of events
     * @param {string} transitionType - Lifecycle transition type to filter
     * @returns {Array} Filtered events
     * @throws {Error} If parameters are invalid
     */
    filterEventsByTransition(events, transitionType) {
        if (!Array.isArray(events)) {
            throw new Error('EventProcessingService: Events must be an array');
        }
        
        if (!transitionType || typeof transitionType !== 'string') {
            throw new Error('EventProcessingService: Transition type must be a non-empty string');
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
    getExpositionEventsByChangeUUID(events) {
        if (!Array.isArray(events)) {
            throw new Error('EventProcessingService: Events must be an array');
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
    hasStepsInLog(logData) {
        if (!Array.isArray(logData)) {
            throw new Error('EventProcessingService: Log data must be an array');
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
     * Extract content object from events for display purposes
     * @param {Array} events - Events for a single step
     * @returns {Object} Content object with 5 sections
     */
    extractContentFromEvents(events) {
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
     * Extract clean user input text from raw log content
     * Removes headers, formatting, and normalizes whitespace
     * @param {string} content - Raw content from logs
     * @returns {string} Clean user input text
     */
    extractCleanUserInput(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // Remove the "# User Input:" header line
        let cleanedText = content.replace(/^#\s*User\s*Input\s*:\s*$/gm, '').trim();
        
        // Remove any leading whitespace from each line (handles indentation)
        cleanedText = cleanedText.split('\n').map(line => line.trimStart()).join('\n');
        
        // Remove any additional comment patterns that might be present
        cleanedText = cleanedText.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any markdown-style formatting if present
        cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '').trim();
        
        // Clean up extra whitespace and normalize line endings
        cleanedText = cleanedText.replace(/\r\n/g, '\n');
        cleanedText = cleanedText.replace(/\n\s*\n/g, '\n');
        cleanedText = cleanedText.trim();
        
        return cleanedText;
    }

    /**
     * Get user input text for a step (for dropdown display)
     * @param {CPEEStep} step - CPEE step object
     * @param {number} [maxLength] - Optional maximum length before truncation
     * @returns {string|null} User input text or null if not available
     */
    getUserInputForStep(step, maxLength) {
        if (!step) {
            return null;
        }

        try {
            // Get user input from raw content
            const userInputRaw = step.getUserInputRaw ? step.getUserInputRaw() : step.rawContent?.userInputRaw;
            if (userInputRaw && userInputRaw.getText) {
                let text = userInputRaw.getText();
                
                // Use comprehensive cleaning from extractCleanUserInput
                text = this.extractCleanUserInput(text);
                
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
            console.warn('EventProcessingService: Error getting user input for step:', error);
        }

        return null;
    }
}

