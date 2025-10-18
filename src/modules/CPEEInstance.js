/**
 * CPEE Instance
 * Represents a CPEE process instance with its steps and state
 */

import { CPEEStep } from './CPEEStep.js';

export class CPEEInstance {
    constructor(uuid, steps = [], processNumber = null) {
        this.uuid = uuid;
        this.processNumber = processNumber;
        this.loadedAt = new Date();
        this.currentStepIndex = 0;
        
        // Convert plain objects to CPEEStep instances if needed
        this.steps = steps.map(step => 
            step instanceof CPEEStep ? step : CPEEStep.fromObject(step)
        );
    }

    /**
     * Get instance display name
     * @returns {string} Display name for the instance
     */
    getDisplayName() {
        return this.processNumber 
            ? `${this.uuid} (${this.processNumber})` 
            : this.uuid;
    }

    /**
     * Get shortened UUID for display
     * @param {number} length - Length of shortened UUID (default: 8)
     * @returns {string} Shortened UUID
     */
    getShortUUID(length = 8) {
        return this.uuid.substring(0, length);
    }

    /**
     * Get current step
     * @returns {CPEEStep|null} Current step or null
     */
    getCurrentStep() {
        if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
            return this.steps[this.currentStepIndex];
        }
        return null;
    }

    /**
     * Get step by index
     * @param {number} index - Step index
     * @returns {CPEEStep|null} Step or null if index is invalid
     */
    getStep(index) {
        if (index >= 0 && index < this.steps.length) {
            return this.steps[index];
        }
        return null;
    }

    /**
     * Get all steps
     * @returns {CPEEStep[]} Array of all steps
     */
    getAllSteps() {
        return [...this.steps];
    }

    /**
     * Get total number of steps
     * @returns {number} Total step count
     */
    getStepCount() {
        return this.steps.length;
    }

    /**
     * Navigate to next step
     * @returns {boolean} True if navigation was successful
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
     * @returns {boolean} True if navigation was successful
     */
    previousStep() {
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            return true;
        }
        return false;
    }

    /**
     * Navigate to specific step
     * @param {number} stepIndex - Step index
     * @returns {boolean} True if navigation was successful
     */
    goToStep(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.steps.length) {
            this.currentStepIndex = stepIndex;
            return true;
        }
        return false;
    }

    /**
     * Navigate to first step
     * @returns {boolean} True if navigation was successful
     */
    goToFirstStep() {
        if (this.steps.length > 0) {
            this.currentStepIndex = 0;
            return true;
        }
        return false;
    }

    /**
     * Navigate to last step
     * @returns {boolean} True if navigation was successful
     */
    goToLastStep() {
        if (this.steps.length > 0) {
            this.currentStepIndex = this.steps.length - 1;
            return true;
        }
        return false;
    }

    /**
     * Get navigation info for current state
     * @returns {Object} Navigation info
     */
    getNavigationInfo() {
        return {
            canGoNext: this.currentStepIndex < this.steps.length - 1,
            canGoPrevious: this.currentStepIndex > 0,
            currentStep: this.currentStepIndex + 1,
            totalSteps: this.steps.length,
            currentStepIndex: this.currentStepIndex
        };
    }

    /**
     * Check if instance has steps
     * @returns {boolean} True if instance has steps
     */
    hasSteps() {
        return this.steps.length > 0;
    }

    /**
     * Get instance summary information
     * @returns {Object} Summary information
     */
    getSummary() {
        return {
            uuid: this.uuid,
            shortUUID: this.getShortUUID(),
            processNumber: this.processNumber,
            stepCount: this.getStepCount(),
            currentStep: this.currentStepIndex + 1,
            loadedAt: this.loadedAt.toLocaleString(),
            hasSteps: this.hasSteps()
        };
    }

    /**
     * Get formatted load time
     * @returns {string} Formatted load time
     */
    getFormattedLoadTime() {
        return this.loadedAt.toLocaleString();
    }

    /**
     * Convert instance to plain object (for serialization)
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            uuid: this.uuid,
            processNumber: this.processNumber,
            loadedAt: this.loadedAt,
            currentStepIndex: this.currentStepIndex,
            steps: this.steps.map(step => step.toObject())
        };
    }

    /**
     * Create CPEEInstance from plain object
     * @param {Object} obj - Plain object with instance data
     * @returns {CPEEInstance} New CPEEInstance instance
     */
    static fromObject(obj) {
        const instance = new CPEEInstance(
            obj.uuid,
            obj.steps || [],
            obj.processNumber
        );
        
        if (obj.loadedAt) {
            instance.loadedAt = new Date(obj.loadedAt);
        }
        
        if (typeof obj.currentStepIndex === 'number') {
            instance.currentStepIndex = obj.currentStepIndex;
        }
        
        return instance;
    }

    /**
     * Find step by change UUID
     * @param {string} changeUuid - Change UUID to search for
     * @returns {CPEEStep|null} Step with matching change UUID or null
     */
    findStepByChangeUuid(changeUuid) {
        return this.steps.find(step => step.changeUuid === changeUuid) || null;
    }

    /**
     * Get steps within a time range
     * @param {Date} startTime - Start time
     * @param {Date} endTime - End time
     * @returns {CPEEStep[]} Steps within the time range
     */
    getStepsInTimeRange(startTime, endTime) {
        return this.steps.filter(step => {
            const stepTime = new Date(step.timestamp);
            return stepTime >= startTime && stepTime <= endTime;
        });
    }
}
