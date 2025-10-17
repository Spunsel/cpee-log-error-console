/**
 * CPEE Instance Model
 * Represents a CPEE process instance with validation and methods
 */

export class CPEEInstance {
    constructor(data = {}) {
        this.uuid = data.uuid || null;
        this.processNumber = data.processNumber || null;
        this.steps = data.steps || [];
        this.loadedAt = data.loadedAt || new Date();
        this.status = data.status || 'loaded';
        this.metadata = data.metadata || {};
        this.currentStepIndex = 0;
        
        this.validate();
    }

    /**
     * Validate instance data
     */
    validate() {
        if (!this.uuid || typeof this.uuid !== 'string') {
            throw new Error('Invalid UUID provided');
        }

        if (!this.isValidUUID(this.uuid)) {
            throw new Error('UUID format is invalid');
        }

        if (this.processNumber && (!Number.isInteger(this.processNumber) || this.processNumber <= 0)) {
            throw new Error('Process number must be a positive integer');
        }
    }

    /**
     * Check if UUID format is valid
     */
    isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Get step by index
     * @param {number} index - Step index
     * @returns {CPEEStep|null} Step or null
     */
    getStep(index) {
        return this.steps[index] || null;
    }

    /**
     * Get current step
     * @returns {CPEEStep|null} Current step or null
     */
    getCurrentStep() {
        return this.getStep(this.currentStepIndex);
    }

    /**
     * Get total number of steps
     * @returns {number} Total steps
     */
    getTotalSteps() {
        return this.steps.length;
    }

    /**
     * Navigate to next step
     * @returns {boolean} True if navigation successful
     */
    nextStep() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            return true;
        }
        return false;
    }

    /**
     * Navigate to previous step
     * @returns {boolean} True if navigation successful
     */
    previousStep() {
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            return true;
        }
        return false;
    }

    /**
     * Go to specific step
     * @param {number} index - Step index
     * @returns {boolean} True if navigation successful
     */
    goToStep(index) {
        if (index >= 0 && index < this.steps.length) {
            this.currentStepIndex = index;
            return true;
        }
        return false;
    }

    /**
     * Get navigation information
     * @returns {Object} Navigation info
     */
    getNavigationInfo() {
        return {
            currentStep: this.currentStepIndex + 1,
            totalSteps: this.steps.length,
            canGoNext: this.currentStepIndex < this.steps.length - 1,
            canGoPrevious: this.currentStepIndex > 0,
            hasSteps: this.steps.length > 0
        };
    }

    /**
     * Get display name for UI
     * @returns {string} Display name
     */
    getDisplayName() {
        if (this.processNumber) {
            return `Process ${this.processNumber}`;
        }
        return this.uuid.substring(0, 8) + '...';
    }

    /**
     * Get short UUID for display
     * @returns {string} Short UUID
     */
    getShortUUID() {
        return this.uuid.substring(0, 8);
    }

    /**
     * Add metadata
     * @param {string} key - Metadata key
     * @param {*} value - Metadata value
     */
    addMetadata(key, value) {
        this.metadata[key] = value;
    }

    /**
     * Get metadata
     * @param {string} key - Metadata key
     * @returns {*} Metadata value
     */
    getMetadata(key) {
        return this.metadata[key];
    }

    /**
     * Export to plain object
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            uuid: this.uuid,
            processNumber: this.processNumber,
            steps: this.steps.map(step => step.toJSON ? step.toJSON() : step),
            loadedAt: this.loadedAt,
            status: this.status,
            metadata: this.metadata,
            currentStepIndex: this.currentStepIndex
        };
    }

    /**
     * Create instance from plain object
     * @param {Object} data - Plain object data
     * @returns {CPEEInstance} New instance
     */
    static fromJSON(data) {
        return new CPEEInstance({
            ...data,
            loadedAt: new Date(data.loadedAt)
        });
    }
}
