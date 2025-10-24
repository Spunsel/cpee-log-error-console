/**
 * CPEE Step
 * Represents a single step in a CPEE process instance
 * Phase 21.3: Added support for storing raw content alongside rendered content
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
        
        // Phase 21.3: Raw content storage
        this.rawContent = {
            inputMermaidRaw: MermaidRaw.empty(),
            inputCpeeTreeRaw: CPEETreeRaw.empty(),
            userInputRaw: UserInput.empty(),
            outputMermaidRaw: MermaidRaw.empty(),
            outputCpeeTreeRaw: CPEETreeRaw.empty()
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
        return this.content[sectionName] || 'No content available';
    }

    /**
     * Get all available content sections
     * @returns {string[]} Array of section names that have content
     */
    getAvailableContentSections() {
        return Object.keys(this.content).filter(section => this.hasContent(section));
    }

    /**
     * Get total number of content sections with data
     * @returns {number} Number of sections with content
     */
    getContentSectionCount() {
        return this.getAvailableContentSections().length;
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
            // Phase 21.3: Include raw content in serialization
            rawContent: {
                inputMermaidRaw: this.rawContent.inputMermaidRaw.toObject(),
                inputCpeeTreeRaw: this.rawContent.inputCpeeTreeRaw.toObject(),
                userInputRaw: this.rawContent.userInputRaw.toObject(),
                outputMermaidRaw: this.rawContent.outputMermaidRaw.toObject(),
                outputCpeeTreeRaw: this.rawContent.outputCpeeTreeRaw.toObject()
            }
        };
    }

    /**
     * Create CPEEStep from plain object
     * @param {Object} obj - Plain object with step data
     * @returns {CPEEStep} New CPEEStep instance
     */
    static fromObject(obj) {
        const step = new CPEEStep(
            obj.stepNumber,
            obj.changeUuid,
            obj.timestamp,
            obj.content
        );
        
        // Phase 21.3: Restore raw content from serialization
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
        
        return step;
    }

    /**
     * Get step summary information
     * @returns {Object} Summary information
     */
    getSummary() {
        return {
            stepNumber: this.stepNumber,
            changeUuid: this.changeUuid,
            timestamp: this.getFormattedTimestamp(),
            contentSections: this.getContentSectionCount(),
            availableSections: this.getAvailableContentSections()
        };
    }

    /**
     * Set raw Mermaid input content
     * @param {string} mermaidText - Raw Mermaid diagram text
     */
    setInputMermaidRaw(mermaidText) {
        this.rawContent.inputMermaidRaw = new MermaidRaw(mermaidText);
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
     * @param {string} mermaidText - Raw Mermaid diagram text
     */
    setOutputMermaidRaw(mermaidText) {
        this.rawContent.outputMermaidRaw = new MermaidRaw(mermaidText);
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

    /**
     * Get all raw content
     * @returns {Object} Object containing all raw content objects
     */
    getAllRawContent() {
        return { ...this.rawContent };
    }

    /**
     * Check if step has any raw content stored
     * @returns {boolean} True if any raw content is not empty
     */
    hasRawContent() {
        return !this.rawContent.inputMermaidRaw.isEmpty() ||
               !this.rawContent.inputCpeeTreeRaw.isEmpty() ||
               !this.rawContent.userInputRaw.isEmpty ||
               !this.rawContent.outputMermaidRaw.isEmpty() ||
               !this.rawContent.outputCpeeTreeRaw.isEmpty();
    }

    /**
     * Get statistics about raw content
     * @returns {Object} Statistics object
     */
    getRawContentStats() {
        return {
            hasInputMermaid: !this.rawContent.inputMermaidRaw.isEmpty(),
            hasInputCpeeTree: !this.rawContent.inputCpeeTreeRaw.isEmpty(),
            hasUserInput: !this.rawContent.userInputRaw.isEmpty,
            hasOutputMermaid: !this.rawContent.outputMermaidRaw.isEmpty(),
            hasOutputCpeeTree: !this.rawContent.outputCpeeTreeRaw.isEmpty(),
            totalRawSize: this.calculateRawContentSize()
        };
    }

    /**
     * Calculate total size of raw content
     * @returns {number} Total bytes of raw content
     */
    calculateRawContentSize() {
        let total = 0;
        total += this.rawContent.inputMermaidRaw.getLength();
        total += this.rawContent.inputCpeeTreeRaw.getLength();
        total += this.rawContent.userInputRaw.getLength();
        total += this.rawContent.outputMermaidRaw.getLength();
        total += this.rawContent.outputCpeeTreeRaw.getLength();
        return total;
    }
}
