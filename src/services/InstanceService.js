/**
 * Instance Service
 * Manages CPEE instance data and state
 */

import { CPEEInstance } from '../modules/CPEEInstance.js';

export class InstanceService {
    constructor() {
        this.instances = new Map();
        this.currentUUID = null;
        this.currentStepIndex = 0;
    }

    /**
     * Add or update instance data
     * @param {string} uuid - Instance UUID
     * @param {Array} steps - Parsed steps data (CPEEStep objects)
     * @param {number} processNumber - CPEE process number (optional)
     */
    addInstance(uuid, steps, processNumber = null) {
        const instance = new CPEEInstance(uuid, steps, processNumber);
        this.instances.set(uuid, instance);
    }

    /**
     * Get instance data by UUID
     * @param {string} uuid - Instance UUID
     * @returns {CPEEInstance|null} CPEEInstance object or null
     */
    getInstance(uuid) {
        return this.instances.get(uuid) || null;
    }

    /**
     * Get all loaded instances
     * @returns {Array} Array of instance UUIDs
     */
    getAllInstances() {
        return Array.from(this.instances.keys());
    }

    /**
     * Check if instance exists
     * @param {string} uuid - Instance UUID
     * @returns {boolean} True if instance exists
     */
    hasInstance(uuid) {
        return this.instances.has(uuid);
    }

    /**
     * Remove instance
     * @param {string} uuid - Instance UUID
     */
    removeInstance(uuid) {
        this.instances.delete(uuid);
        
        if (this.currentUUID === uuid) {
            this.currentUUID = null;
            this.currentStepIndex = 0;
        }
    }

    /**
     * Set current active instance
     * @param {string|null} uuid - Instance UUID or null to clear
     * @param {number} stepIndex - Step index (optional)
     */
    setCurrentInstance(uuid, stepIndex = 0) {
        if (uuid === null) {
            this.currentUUID = null;
            this.currentStepIndex = 0;
            return true;
        }
        
        const instance = this.getInstance(uuid);
        if (instance) {
            this.currentUUID = uuid;
            this.currentStepIndex = stepIndex;
            
            // Update the instance's current step index
            instance.goToStep(stepIndex);
            return true;
        }
        return false;
    }

    /**
     * Get current instance data
     * @returns {CPEEInstance|null} Current CPEEInstance or null
     */
    getCurrentInstance() {
        return this.currentUUID ? this.getInstance(this.currentUUID) : null;
    }

    /**
     * Get current step data
     * @returns {CPEEStep|null} Current step data
     */
    getCurrentStep() {
        const instance = this.getCurrentInstance();
        if (instance) {
            return instance.getCurrentStep();
        }
        return null;
    }

    /**
     * Navigate to next step
     * @returns {boolean} True if navigation was successful
     */
    nextStep() {
        const instance = this.getCurrentInstance();
        if (instance && instance.nextStep()) {
            this.currentStepIndex = instance.currentStepIndex;
            return true;
        }
        return false;
    }

    /**
     * Navigate to previous step
     * @returns {boolean} True if navigation was successful
     */
    previousStep() {
        const instance = this.getCurrentInstance();
        if (instance && instance.previousStep()) {
            this.currentStepIndex = instance.currentStepIndex;
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
        const instance = this.getCurrentInstance();
        if (instance && instance.goToStep(stepIndex)) {
            this.currentStepIndex = instance.currentStepIndex;
            return true;
        }
        return false;
    }

    /**
     * Get navigation info for current instance
     * @returns {Object} Navigation info
     */
    getNavigationInfo() {
        const instance = this.getCurrentInstance();
        if (!instance) {
            return {
                canGoNext: false,
                canGoPrevious: false,
                currentStep: 0,
                totalSteps: 0
            };
        }

        return instance.getNavigationInfo();
    }

    /**
     * Clear all instances
     */
    clear() {
        this.instances.clear();
        this.currentUUID = null;
        this.currentStepIndex = 0;
    }
}
