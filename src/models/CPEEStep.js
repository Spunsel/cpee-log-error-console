/**
 * CPEE Step Model
 * Represents a single step in the CPEE process with content and metadata
 */

export class CPEEStep {
    constructor(data = {}) {
        this.stepNumber = data.stepNumber || 0;
        this.changeUuid = data.changeUuid || null;
        this.timestamp = data.timestamp || new Date();
        this.content = new StepContent(data.content || {});
        this.metadata = data.metadata || {};
        this.errors = data.errors || [];
        this.warnings = data.warnings || [];
        
        this.validate();
    }

    /**
     * Validate step data
     */
    validate() {
        if (this.stepNumber <= 0) {
            throw new Error('Step number must be greater than 0');
        }

        if (!this.changeUuid) {
            throw new Error('Change UUID is required');
        }

        if (!(this.timestamp instanceof Date)) {
            this.timestamp = new Date(this.timestamp);
        }
    }

    /**
     * Check if step has errors
     * @returns {boolean} True if step has errors
     */
    hasErrors() {
        return this.errors.length > 0;
    }

    /**
     * Check if step has warnings
     * @returns {boolean} True if step has warnings
     */
    hasWarnings() {
        return this.warnings.length > 0;
    }

    /**
     * Get step status
     * @returns {string} Step status: 'success', 'warning', 'error'
     */
    getStatus() {
        if (this.hasErrors()) return 'error';
        if (this.hasWarnings()) return 'warning';
        return 'success';
    }

    /**
     * Add error to step
     * @param {string} message - Error message
     * @param {string} type - Error type
     */
    addError(message, type = 'general') {
        this.errors.push({
            message,
            type,
            timestamp: new Date()
        });
    }

    /**
     * Add warning to step
     * @param {string} message - Warning message
     * @param {string} type - Warning type
     */
    addWarning(message, type = 'general') {
        this.warnings.push({
            message,
            type,
            timestamp: new Date()
        });
    }

    /**
     * Get duration since previous step
     * @param {CPEEStep} previousStep - Previous step
     * @returns {number} Duration in milliseconds
     */
    getDurationSince(previousStep) {
        if (!previousStep) return 0;
        return this.timestamp.getTime() - previousStep.timestamp.getTime();
    }

    /**
     * Export to plain object
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            stepNumber: this.stepNumber,
            changeUuid: this.changeUuid,
            timestamp: this.timestamp.toISOString(),
            content: this.content.toJSON(),
            metadata: this.metadata,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    /**
     * Create step from plain object
     * @param {Object} data - Plain object data
     * @returns {CPEEStep} New step
     */
    static fromJSON(data) {
        return new CPEEStep({
            ...data,
            timestamp: new Date(data.timestamp)
        });
    }
}

/**
 * Step Content Model
 * Represents the 5 content types in a CPEE step
 */
export class StepContent {
    constructor(data = {}) {
        this.inputCpeeTree = data.inputCpeeTree || '';
        this.inputIntermediate = data.inputIntermediate || '';
        this.userInput = data.userInput || '';
        this.outputIntermediate = data.outputIntermediate || '';
        this.outputCpeeTree = data.outputCpeeTree || '';
    }

    /**
     * Get all content types
     * @returns {Object} Content types with metadata
     */
    getContentTypes() {
        return {
            inputCpeeTree: {
                name: 'Input CPEE-Tree',
                type: 'xml',
                content: this.inputCpeeTree,
                isEmpty: !this.inputCpeeTree || this.inputCpeeTree.trim() === ''
            },
            inputIntermediate: {
                name: 'Input Intermediate',
                type: 'mermaid',
                content: this.inputIntermediate,
                isEmpty: !this.inputIntermediate || this.inputIntermediate.trim() === ''
            },
            userInput: {
                name: 'User Input',
                type: 'text',
                content: this.userInput,
                isEmpty: !this.userInput || this.userInput.trim() === ''
            },
            outputIntermediate: {
                name: 'Output Intermediate',
                type: 'mermaid',
                content: this.outputIntermediate,
                isEmpty: !this.outputIntermediate || this.outputIntermediate.trim() === ''
            },
            outputCpeeTree: {
                name: 'Output CPEE-Tree',
                type: 'xml',
                content: this.outputCpeeTree,
                isEmpty: !this.outputCpeeTree || this.outputCpeeTree.trim() === ''
            }
        };
    }

    /**
     * Get content by type
     * @param {string} type - Content type
     * @returns {string} Content
     */
    getContent(type) {
        const validTypes = ['inputCpeeTree', 'inputIntermediate', 'userInput', 'outputIntermediate', 'outputCpeeTree'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid content type: ${type}`);
        }
        return this[type] || '';
    }

    /**
     * Set content by type
     * @param {string} type - Content type
     * @param {string} content - Content
     */
    setContent(type, content) {
        const validTypes = ['inputCpeeTree', 'inputIntermediate', 'userInput', 'outputIntermediate', 'outputCpeeTree'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid content type: ${type}`);
        }
        this[type] = content || '';
    }

    /**
     * Check if all content is empty
     * @returns {boolean} True if all content is empty
     */
    isEmpty() {
        const types = this.getContentTypes();
        return Object.values(types).every(type => type.isEmpty);
    }

    /**
     * Get content statistics
     * @returns {Object} Content statistics
     */
    getStatistics() {
        const types = this.getContentTypes();
        return {
            totalSections: Object.keys(types).length,
            emptySections: Object.values(types).filter(type => type.isEmpty).length,
            totalCharacters: Object.values(types).reduce((sum, type) => sum + type.content.length, 0),
            hasXML: this.inputCpeeTree.length > 0 || this.outputCpeeTree.length > 0,
            hasMermaid: this.inputIntermediate.length > 0 || this.outputIntermediate.length > 0,
            hasUserInput: this.userInput.length > 0
        };
    }

    /**
     * Export to plain object
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            inputCpeeTree: this.inputCpeeTree,
            inputIntermediate: this.inputIntermediate,
            userInput: this.userInput,
            outputIntermediate: this.outputIntermediate,
            outputCpeeTree: this.outputCpeeTree
        };
    }
}
