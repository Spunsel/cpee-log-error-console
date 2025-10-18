/**
 * CPEE Step
 * Represents a single step in a CPEE process instance
 */

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
        if (!this.timestamp) return 'Unknown time';
        
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
            content: { ...this.content }
        };
    }

    /**
     * Create CPEEStep from plain object
     * @param {Object} obj - Plain object with step data
     * @returns {CPEEStep} New CPEEStep instance
     */
    static fromObject(obj) {
        return new CPEEStep(
            obj.stepNumber,
            obj.changeUuid,
            obj.timestamp,
            obj.content
        );
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
}
