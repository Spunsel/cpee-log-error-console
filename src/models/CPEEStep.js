/**
 * CPEE Step
 * Represents a single step in a CPEE process instance
 * stores raw content alongside rendered content
 * stores task mappings across formats (for laster cross sectional highlighting)
 */

import { MermaidRaw } from './MermaidRaw.js';
import { CPEETreeRaw } from './CPEETreeRaw.js';
import { UserInput } from './UserInputRaw.js';

export class CPEEStep {
    constructor(stepNumber, changeUuid, timestamp, content) {
        this.stepNumber = stepNumber;
        this.changeUuid = changeUuid;
        this.timestamp = timestamp;
        this.content = content || {
            inputCpeeTree: 'Not found',
            inputIntermediate: 'Not found',
            userInput: 'Not found',
            outputIntermediate: 'Not found',
            outputCpeeTree: 'Not found'
        };
        
        // Metadata
        this.usedLLM = null; // LLM model used for this step
        
        // Raw content storage
        this.rawContent = {
            inputMermaidRaw: MermaidRaw.empty(),
            inputCpeeTreeRaw: CPEETreeRaw.empty(),
            userInputRaw: UserInput.empty(),
            outputMermaidRaw: MermaidRaw.empty(),
            outputCpeeTreeRaw: CPEETreeRaw.empty()
        };
        
        // Task mapping storage
        this.taskMapping = null; // Will be NodeMapping instance from NodeMappingService
        
        // Trace calculation storage 
        // Structure: { 'input-cpee': Trace[], 'input-intermediate': Trace[], 'output-intermediate': Trace[], 'output-cpee': Trace[] }
        this.traces = {
            'input-cpee': null,
            'input-intermediate': null,
            'output-intermediate': null,
            'output-cpee': null
        };
        
        // Trace comparison results storage 
        // Structure: { input: ComparisonResult|null, output: ComparisonResult|null }
        this.comparisonResults = {
            input: null,
            output: null
        };
        
        // Soundness and boundedness verification results storage
        // Structure: { 'input-cpee': VerificationResult|null, 'input-intermediate': VerificationResult|null, 'output-intermediate': VerificationResult|null, 'output-cpee': VerificationResult|null }
        this.verificationResults = {
            'input-cpee': null,
            'input-intermediate': null,
            'output-intermediate': null,
            'output-cpee': null
        };
        
        // Reachability analysis results storage 
        // Structure: { 'input-cpee': ReachabilityResult|null, 'input-intermediate': ReachabilityResult|null, 'output-intermediate': ReachabilityResult|null, 'output-cpee': ReachabilityResult|null }
        this.reachabilityResults = {
            'input-cpee': null,
            'input-intermediate': null,
            'output-intermediate': null,
            'output-cpee': null
        };
    }

    /**
     * Get step display name
     * @returns {string} Step display name
     */
    getDisplayName() {
        return `Step ${this.stepNumber}`;
    }

    /**
     * Get formatted timestamp
     * @returns {string} Formatted timestamp
     */
    getFormattedTimestamp() {
        if (!this.timestamp) {
            return 'Unknown time';
        }
        
        try {
            const date = new Date(this.timestamp);
            return date.toLocaleString();
        } catch (error) {
            return this.timestamp;
        }
    }

    /**
     * Check if step has content for a specific section
     * @param {string} sectionName - Name of the content section
     * @returns {boolean} True if section has content
     */
    hasContent(sectionName) {
        return this.content[sectionName] && 
               this.content[sectionName] !== 'Not found' && 
               this.content[sectionName].trim() !== '';
    }

    /**
     * Get content for a specific section
     * @param {string} sectionName - Name of the content section
     * @returns {string} Content or default message
     */
    getContent(sectionName) {
        const content = this.content[sectionName] || 'No content available';
        return content;
    }

    /**
     * Convert step to plain object (for serialization)
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            stepNumber: this.stepNumber,
            changeUuid: this.changeUuid,
            timestamp: this.timestamp,
            content: { ...this.content },
            //  Include raw content in serialization
            rawContent: {
                inputMermaidRaw: this.rawContent.inputMermaidRaw.toObject(),
                inputCpeeTreeRaw: this.rawContent.inputCpeeTreeRaw.toObject(),
                userInputRaw: this.rawContent.userInputRaw.toObject(),
                outputMermaidRaw: this.rawContent.outputMermaidRaw.toObject(),
                outputCpeeTreeRaw: this.rawContent.outputCpeeTreeRaw.toObject()
            },
            //  Include task mapping in serialization
            taskMapping: this.taskMapping ? this.taskMapping.toObject() : null,
            //  Include traces in serialization (store as null for now, traces are calculated on-demand)
            traces: null,
            //  Include comparison results in serialization (store as null for now, results are calculated on-demand)
            comparisonResults: null
        };
    }

    /**
     * Create CPEEStep from plain object
     * @param {Object} obj - Plain object with step data
     * @returns {Promise<CPEEStep>} New CPEEStep instance
     */
    static async fromObject(obj) {
        const step = new CPEEStep(
            obj.stepNumber,
            obj.changeUuid,
            obj.timestamp,
            obj.content
        );
        
        //  Restore raw content from serialization
        if (obj.rawContent) {
            if (obj.rawContent.inputMermaidRaw) {
                step.rawContent.inputMermaidRaw = MermaidRaw.fromObject(obj.rawContent.inputMermaidRaw);
            }
            if (obj.rawContent.inputCpeeTreeRaw) {
                step.rawContent.inputCpeeTreeRaw = CPEETreeRaw.fromObject(obj.rawContent.inputCpeeTreeRaw);
            }
            if (obj.rawContent.userInputRaw) {
                step.rawContent.userInputRaw = UserInput.fromObject(obj.rawContent.userInputRaw);
            }
            if (obj.rawContent.outputMermaidRaw) {
                step.rawContent.outputMermaidRaw = MermaidRaw.fromObject(obj.rawContent.outputMermaidRaw);
            }
            if (obj.rawContent.outputCpeeTreeRaw) {
                step.rawContent.outputCpeeTreeRaw = CPEETreeRaw.fromObject(obj.rawContent.outputCpeeTreeRaw);
            }
        }
        
        //  Restore task mapping from serialization
        if (obj.taskMapping) {
            // Import NodeMapping class dynamically to avoid circular dependencies
            const module = await import('../services/NodeMappingService.js');
            step.taskMapping = module.NodeMapping.fromObject(obj.taskMapping);
        }
        
        return step;
    }

    /**
     * Set raw Mermaid input content
     * @param {string|MermaidRaw} mermaidText - Raw Mermaid diagram text or MermaidRaw object
     */
    setInputMermaidRaw(mermaidText) {
        if (mermaidText instanceof MermaidRaw) {
            this.rawContent.inputMermaidRaw = mermaidText;
        } else {
            this.rawContent.inputMermaidRaw = new MermaidRaw(mermaidText);
        }
    }

    /**
     * Get raw Mermaid input content
     * @returns {MermaidRaw} Raw Mermaid input object
     */
    getInputMermaidRaw() {
        return this.rawContent.inputMermaidRaw;
    }

    /**
     * Set raw Mermaid output content
     * @param {string|MermaidRaw} mermaidText - Raw Mermaid diagram text or MermaidRaw object
     */
    setOutputMermaidRaw(mermaidText) {
        if (mermaidText instanceof MermaidRaw) {
            this.rawContent.outputMermaidRaw = mermaidText;
        } else {
            this.rawContent.outputMermaidRaw = new MermaidRaw(mermaidText);
        }
    }

    /**
     * Get raw Mermaid output content
     * @returns {MermaidRaw} Raw Mermaid output object
     */
    getOutputMermaidRaw() {
        return this.rawContent.outputMermaidRaw;
    }

    /**
     * Set raw CPEE tree input content
     * @param {string} xmlText - Raw CPEE tree XML
     */
    setInputCpeeTreeRaw(xmlText) {
        this.rawContent.inputCpeeTreeRaw = new CPEETreeRaw(xmlText);
    }

    /**
     * Get raw CPEE tree input content
     * @returns {CPEETreeRaw} Raw CPEE tree input object
     */
    getInputCpeeTreeRaw() {
        return this.rawContent.inputCpeeTreeRaw;
    }

    /**
     * Set raw CPEE tree output content
     * @param {string} xmlText - Raw CPEE tree XML
     */
    setOutputCpeeTreeRaw(xmlText) {
        this.rawContent.outputCpeeTreeRaw = new CPEETreeRaw(xmlText);
    }

    /**
     * Get raw CPEE tree output content
     * @returns {CPEETreeRaw} Raw CPEE tree output object
     */
    getOutputCpeeTreeRaw() {
        return this.rawContent.outputCpeeTreeRaw;
    }

    /**
     * Set raw user input content
     * @param {string} userInputText - User input text
     */
    setUserInputRaw(userInputText) {
        this.rawContent.userInputRaw = new UserInput(userInputText);
    }

    /**
     * Get raw user input content
     * @returns {UserInput} Raw user input object
     */
    getUserInputRaw() {
        return this.rawContent.userInputRaw;
    }

    // ===================================================================
    // Task Mapping Methods
    // ===================================================================

    /**
     * Set task mapping for this step
     * @param {NodeMapping} mapping - NodeMapping instance from NodeMappingService
     */
    setTaskMapping(mapping) {
        this.taskMapping = mapping;
        console.log(`[CPEEStep] Task mapping stored for Step ${this.stepNumber}`);
    }

    /**
     * Get task mapping for this step
     * @returns {NodeMapping|null} NodeMapping instance or null
     */
    getTaskMapping() {
        return this.taskMapping;
    }

    /**
     * Check if this step has a task mapping
     * @returns {boolean} True if task mapping exists
     */
    hasTaskMapping() {
        return this.taskMapping !== null;
    }

    /**
     * Find equivalent tasks in other formats
     * @param {string} taskId - Task ID to find equivalents for
     * @param {string} sourceFormat - Source format ('input-cpee', 'input-intermediate', etc.)
     * @returns {Object|null} Object with equivalent tasks by format, or null if no mapping
     */
    findEquivalentTasks(taskId, sourceFormat) {
        if (!this.taskMapping) {
            console.warn(`[CPEEStep] No task mapping available for Step ${this.stepNumber}`);
            return null;
        }

        console.log(`[CPEEStep] Finding equivalent tasks for "${taskId}" from ${sourceFormat}`);
        const equivalents = this.taskMapping.findEquivalentTasks(taskId, sourceFormat);
        
        // Log results
        Object.entries(equivalents).forEach(([format, tasks]) => {
            if (tasks.length > 0) {
                console.log(`[CPEEStep]   → ${format}: ${tasks.length} equivalent(s)`);
                tasks.forEach(t => {
                    console.log(`[CPEEStep]      - "${t.task.label}"${t.isTransitive ? ' (transitive)' : ''}`);
                });
            }
        });
        
        return equivalents;
    }

    /**
     * Get task by ID and format
     * @param {string} taskId - Task ID
     * @param {string} format - Format key
     * @returns {TaskIdentifier|null} Task or null
     */
    getTask(taskId, format) {
        if (!this.taskMapping) {
            return null;
        }
        
        return this.taskMapping.getTask(taskId, format);
    }

    // ===================================================================
    // Trace Calculation Methods 
    // ===================================================================

    /**
     * Set traces for a specific section
     * @param {string} sectionId - Section identifier ('input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee')
     * @param {Array<Trace>} traceArray - Array of Trace objects
     */
    setTraces(sectionId, traceArray) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            console.warn(`[CPEEStep] Invalid section ID for traces: ${sectionId}`);
            return;
        }
        
        this.traces[sectionId] = traceArray;
    }

    /**
     * Get traces for a specific section
     * @param {string} sectionId - Section identifier ('input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee')
     * @returns {Array<Trace>|null} Array of Trace objects or null if not calculated
     */
    getTraces(sectionId) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            console.warn(`[CPEEStep] Invalid section ID for traces: ${sectionId}`);
            return null;
        }
        
        return this.traces[sectionId];
    }

    /**
     * Check if traces have been calculated for a specific section
     * @param {string} sectionId - Section identifier
     * @returns {boolean} True if traces exist for this section
     */
    hasTraces(sectionId) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            return false;
        }
        
        return this.traces[sectionId] !== null && Array.isArray(this.traces[sectionId]);
    }

    // ===================================================================
    // Soundness and Boundedness Verification Methods
    // ===================================================================

    /**
     * Set verification result for a specific section
     * @param {string} sectionId - Section identifier ('input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee')
     * @param {Object} verificationResult - Verification result object
     */
    setVerificationResult(sectionId, verificationResult) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            console.warn(`[CPEEStep] Invalid section ID for verification result: ${sectionId}`);
            return;
        }
        
        this.verificationResults[sectionId] = verificationResult;
    }

    /**
     * Get verification result for a specific section
     * @param {string} sectionId - Section identifier ('input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee')
     * @returns {Object|null} Verification result object or null if not verified
     */
    getVerificationResult(sectionId) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            console.warn(`[CPEEStep] Invalid section ID for verification result: ${sectionId}`);
            return null;
        }
        
        return this.verificationResults[sectionId];
    }

    /**
     * Check if verification has been performed for a specific section
     * @param {string} sectionId - Section identifier
     * @returns {boolean} True if verification result exists for this section
     */
    hasVerificationResult(sectionId) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            return false;
        }
        
        return this.verificationResults[sectionId] !== null;
    }

    // ===================================================================
    // Reachability Analysis Methods 
    // ===================================================================

    /**
     * Set reachability analysis result for a specific section
     * @param {string} sectionId - Section identifier ('input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee')
     * @param {Object} reachabilityResult - Reachability analysis result from analyzeReachability()
     */
    setReachabilityResult(sectionId, reachabilityResult) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            console.warn(`[CPEEStep] Invalid section ID for reachability result: ${sectionId}`);
            return;
        }
        
        this.reachabilityResults[sectionId] = reachabilityResult;
    }

    /**
     * Get reachability analysis result for a specific section
     * @param {string} sectionId - Section identifier
     * @returns {Object|null} Reachability analysis result or null if not available
     */
    getReachabilityResult(sectionId) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            console.warn(`[CPEEStep] Invalid section ID for reachability result: ${sectionId}`);
            return null;
        }
        
        return this.reachabilityResults[sectionId];
    }

    /**
     * Check if reachability analysis has been performed for a specific section
     * @param {string} sectionId - Section identifier
     * @returns {boolean} True if reachability result exists for this section
     */
    hasReachabilityResult(sectionId) {
        if (!['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'].includes(sectionId)) {
            return false;
        }
        
        return this.reachabilityResults[sectionId] !== null;
    }

    clearAllReachabilityResults() {
        for (const key of Object.keys(this.reachabilityResults)) {
            this.reachabilityResults[key] = null;
        }
    }

    // ===================================================================
    // Trace Comparison Methods 
    // ===================================================================

    /**
     * Get comparison results for a section pair
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @returns {Object|null} Comparison result object or null if not available
     */
    getComparisonResults(sectionPair) {
        if (sectionPair !== 'input' && sectionPair !== 'output') {
            console.warn(`[CPEEStep] Invalid section pair for comparison results: ${sectionPair}`);
            return null;
        }
        
        return this.comparisonResults[sectionPair] || null;
    }

    /**
     * Set comparison results for a section pair
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {Object} comparisonResult - Comparison result object from TraceComparison.compareTraces()
     */
    setComparisonResults(sectionPair, comparisonResult) {
        if (sectionPair !== 'input' && sectionPair !== 'output') {
            console.warn(`[CPEEStep] Invalid section pair for comparison results: ${sectionPair}`);
            return;
        }
        
        this.comparisonResults[sectionPair] = comparisonResult;
    }

}
