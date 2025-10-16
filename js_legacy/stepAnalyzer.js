/**
 * CPEE Step Analyzer
 * Analyzes log events and extracts LLM processing steps with error detection
 */

class StepAnalyzer {
    /**
     * Extract processing steps from parsed log events
     * @param {Array} events - Array of parsed log events
     * @returns {Array} Array of processing steps with analysis
     */
    static extractSteps(events) {
        console.log('Extracting steps from events...');
        
        // Get exposition events grouped by change UUID
        const expositionGroups = LogParser.getExpositionEventsByChangeUUID(events);
        const steps = [];
        
        // Sort groups by timestamp of first event
        const sortedGroups = Object.entries(expositionGroups).sort((a, b) => {
            const timeA = new Date(a[1][0]['time:timestamp'] || 0);
            const timeB = new Date(b[1][0]['time:timestamp'] || 0);
            return timeA - timeB;
        });

        for (let i = 0; i < sortedGroups.length; i++) {
            const [changeUUID, groupEvents] = sortedGroups[i];
            
            try {
                const step = StepAnalyzer.analyzeStepEvents(changeUUID, groupEvents, i + 1);
                steps.push(step);
            } catch (error) {
                console.error(`Failed to analyze step ${i + 1}:`, error);
                // Create a fallback step with error information
                steps.push(StepAnalyzer.createErrorStep(changeUUID, groupEvents, i + 1, error));
            }
        }

        console.log(`Extracted ${steps.length} steps`);
        return steps;
    }

    /**
     * Analyze events for a single step
     * @param {string} changeUUID - Change UUID for this step
     * @param {Array} events - Events for this step
     * @param {number} stepNumber - Step number (1-based)
     * @returns {Object} Analyzed step data
     */
    static analyzeStepEvents(changeUUID, events, stepNumber) {
        const step = {
            stepNumber,
            changeUUID,
            timestamp: events[0]['time:timestamp'],
            events: events,
            exposition: {},
            errors: [],
            warnings: [],
            status: 'success'
        };

        // Parse exposition events in expected order
        const expectedTypes = [
            'input_cpee_tree',   // <!-- Input CPEE-Tree -->
            'llm_model',         // # Used LLM:
            'user_input',        // # User Input:
            'input_intermediate', // %% Input Intermediate
            'output_intermediate', // %% Output Intermediate
            'output_cpee_tree'   // <!-- Output CPEE-Tree -->
        ];

        // Map events to their types
        events.forEach((event, index) => {
            const exposition = event['cpee:exposition'];
            if (!exposition) {
                step.warnings.push(`Event ${index + 1}: Missing exposition content`);
                return;
            }

            const type = StepAnalyzer.identifyExpositionType(exposition);
            if (type) {
                step.exposition[type] = {
                    content: exposition,
                    timestamp: event['time:timestamp'],
                    eventIndex: index
                };
            } else {
                step.warnings.push(`Event ${index + 1}: Unrecognized exposition type`);
            }
        });

        // Validate step completeness
        StepAnalyzer.validateStep(step, expectedTypes);

        // Extract key information
        StepAnalyzer.extractStepInfo(step);

        return step;
    }

    /**
     * Identify the type of exposition event based on content
     * @param {string} exposition - Exposition content
     * @returns {string|null} Event type identifier
     */
    static identifyExpositionType(exposition) {
        const content = exposition.trim();

        if (content.includes('<!-- Input CPEE-Tree -->')) {
            return 'input_cpee_tree';
        } else if (content.startsWith('# Used LLM:')) {
            return 'llm_model';
        } else if (content.startsWith('# User Input:')) {
            return 'user_input';
        } else if (content.includes('%% Input Intermediate')) {
            return 'input_intermediate';
        } else if (content.includes('%% Output Intermediate')) {
            return 'output_intermediate';
        } else if (content.includes('<!-- Output CPEE-Tree -->')) {
            return 'output_cpee_tree';
        }

        return null;
    }

    /**
     * Validate step completeness and detect errors
     * @param {Object} step - Step object to validate
     * @param {Array} expectedTypes - Expected exposition types
     */
    static validateStep(step, expectedTypes) {
        // Check for missing exposition types
        expectedTypes.forEach(type => {
            if (!step.exposition[type]) {
                step.errors.push(`Missing ${type.replace('_', ' ')} exposition`);
            }
        });

        // Check for unexpected number of events
        if (step.events.length !== 6) {
            step.warnings.push(`Expected 6 exposition events, found ${step.events.length}`);
        }

        // Validate Mermaid syntax
        StepAnalyzer.validateMermaidSyntax(step);

        // Validate XML content
        StepAnalyzer.validateXMLContent(step);

        // Set status based on errors
        if (step.errors.length > 0) {
            step.status = 'error';
        } else if (step.warnings.length > 0) {
            step.status = 'warning';
        }
    }

    /**
     * Extract key information from step exposition
     * @param {Object} step - Step object to extract info from
     */
    static extractStepInfo(step) {
        // Extract LLM model
        if (step.exposition.llm_model) {
            const content = step.exposition.llm_model.content;
            const match = content.match(/# Used LLM:\s*(.+)/);
            step.llmModel = match ? match[1].trim() : 'Unknown';
        }

        // Extract user input
        if (step.exposition.user_input) {
            const content = step.exposition.user_input.content;
            const match = content.match(/# User Input:\s*(.+)/);
            step.userInput = match ? match[1].trim() : 'Unknown';
        }

        // Extract Mermaid diagrams
        step.mermaidInput = StepAnalyzer.extractMermaidDiagram(step.exposition.input_intermediate?.content);
        step.mermaidOutput = StepAnalyzer.extractMermaidDiagram(step.exposition.output_intermediate?.content);

        // Extract CPEE trees (XML)
        step.cpeeInput = StepAnalyzer.extractCPEETree(step.exposition.input_cpee_tree?.content);
        step.cpeeOutput = StepAnalyzer.extractCPEETree(step.exposition.output_cpee_tree?.content);
    }

    /**
     * Extract Mermaid diagram from exposition content
     * @param {string} content - Exposition content
     * @returns {string|null} Mermaid diagram code
     */
    static extractMermaidDiagram(content) {
        if (!content) return null;

        const mermaidMatch = content.match(/```mermaid\s*([\s\S]*?)\s*```/);
        if (mermaidMatch) {
            return mermaidMatch[1].trim();
        }

        // Handle cases without code blocks
        const lines = content.split('\n');
        const mermaidLines = [];
        let inMermaid = false;

        for (const line of lines) {
            if (line.includes('%% Input Intermediate') || line.includes('%% Output Intermediate')) {
                inMermaid = true;
                continue;
            }
            if (inMermaid && line.trim()) {
                mermaidLines.push(line);
            }
        }

        return mermaidLines.length > 0 ? mermaidLines.join('\n') : null;
    }

    /**
     * Extract CPEE tree XML from exposition content
     * @param {string} content - Exposition content
     * @returns {string|null} CPEE tree XML
     */
    static extractCPEETree(content) {
        if (!content) return null;

        // Look for XML content
        const xmlMatch = content.match(/<\?xml[\s\S]*<\/description>/);
        if (xmlMatch) {
            return xmlMatch[0];
        }

        // Handle case where XML is not wrapped
        if (content.includes('<description')) {
            const lines = content.split('\n');
            const xmlLines = [];
            let inXML = false;

            for (const line of lines) {
                if (line.includes('<description') || line.includes('<?xml')) {
                    inXML = true;
                }
                if (inXML) {
                    xmlLines.push(line);
                }
                if (line.includes('</description>')) {
                    break;
                }
            }

            return xmlLines.length > 0 ? xmlLines.join('\n') : null;
        }

        return null;
    }

    /**
     * Validate Mermaid diagram syntax
     * @param {Object} step - Step object
     */
    static validateMermaidSyntax(step) {
        const validateDiagram = (content, type) => {
            if (!content) return;

            // Basic syntax checks
            const lines = content.split('\n').filter(line => line.trim());
            
            // Check for required elements
            const hasFlowchartOrGraph = lines.some(line => 
                line.includes('flowchart') || line.includes('graph')
            );

            if (!hasFlowchartOrGraph && lines.length > 0) {
                step.warnings.push(`${type}: Missing flowchart/graph declaration`);
            }

            // Check for syntax errors
            lines.forEach((line, index) => {
                if (line.includes('-->') && !line.match(/\w+:\w+.*-->.*\w+:\w+/)) {
                    if (!line.match(/\w+.*-->.*\w+/)) {
                        step.warnings.push(`${type} line ${index + 1}: Invalid arrow syntax`);
                    }
                }
            });
        };

        if (step.mermaidInput) {
            validateDiagram(step.mermaidInput, 'Input Mermaid');
        }

        if (step.mermaidOutput) {
            validateDiagram(step.mermaidOutput, 'Output Mermaid');
        }
    }

    /**
     * Validate XML content
     * @param {Object} step - Step object
     */
    static validateXMLContent(step) {
        const validateXML = (content, type) => {
            if (!content) return;

            try {
                // Basic XML validation
                if (!content.includes('<?xml')) {
                    step.warnings.push(`${type}: Missing XML declaration`);
                }

                if (!content.includes('<description')) {
                    step.errors.push(`${type}: Missing description element`);
                }

                // Check for unclosed tags (basic)
                const openTags = (content.match(/<[^\/][^>]*>/g) || []).length;
                const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
                const selfClosing = (content.match(/<[^>]*\/>/g) || []).length;

                if (openTags - selfClosing !== closeTags) {
                    step.warnings.push(`${type}: Possible unclosed XML tags`);
                }

            } catch (error) {
                step.errors.push(`${type}: XML parsing error - ${error.message}`);
            }
        };

        if (step.cpeeInput) {
            validateXML(step.cpeeInput, 'Input CPEE Tree');
        }

        if (step.cpeeOutput) {
            validateXML(step.cpeeOutput, 'Output CPEE Tree');
        }
    }

    /**
     * Create an error step when parsing fails
     * @param {string} changeUUID - Change UUID
     * @param {Array} events - Events that failed to parse
     * @param {number} stepNumber - Step number
     * @param {Error} error - Error that occurred
     * @returns {Object} Error step object
     */
    static createErrorStep(changeUUID, events, stepNumber, error) {
        return {
            stepNumber,
            changeUUID,
            timestamp: events.length > 0 ? events[0]['time:timestamp'] : null,
            events: events,
            exposition: {},
            errors: [`Failed to parse step: ${error.message}`],
            warnings: [],
            status: 'error',
            llmModel: 'Unknown',
            userInput: 'Parse Error',
            mermaidInput: null,
            mermaidOutput: null,
            cpeeInput: null,
            cpeeOutput: null
        };
    }

    /**
     * Get step statistics
     * @param {Array} steps - Array of steps
     * @returns {Object} Step statistics
     */
    static getStepStatistics(steps) {
        const stats = {
            total: steps.length,
            successful: 0,
            warnings: 0,
            errors: 0,
            totalErrors: 0,
            totalWarnings: 0,
            llmModels: new Set(),
            avgProcessingTime: 0
        };

        steps.forEach(step => {
            if (step.status === 'success') stats.successful++;
            else if (step.status === 'warning') stats.warnings++;
            else if (step.status === 'error') stats.errors++;

            stats.totalErrors += step.errors.length;
            stats.totalWarnings += step.warnings.length;

            if (step.llmModel) {
                stats.llmModels.add(step.llmModel);
            }
        });

        stats.llmModels = Array.from(stats.llmModels);

        return stats;
    }
}
