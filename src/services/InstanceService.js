/**
 * Instance Service
 * Manages CPEE instance data and state
 */

export class InstanceService {
    constructor() {
        this.instances = new Map();
        this.currentUUID = null;
        this.currentStepIndex = 0;
    }

    /**
     * Add or update instance data
     * @param {string} uuid - Instance UUID
     * @param {Array} steps - Parsed steps data
     */
    addInstance(uuid, steps) {
        this.instances.set(uuid, {
            uuid: uuid,
            steps: steps,
            loadedAt: new Date()
        });
    }

    /**
     * Get instance data by UUID
     * @param {string} uuid - Instance UUID
     * @returns {Object|null} Instance data or null
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
        
        if (this.hasInstance(uuid)) {
            this.currentUUID = uuid;
            this.currentStepIndex = stepIndex;
            return true;
        }
        return false;
    }

    /**
     * Get current instance data
     * @returns {Object|null} Current instance data
     */
    getCurrentInstance() {
        return this.currentUUID ? this.getInstance(this.currentUUID) : null;
    }

    /**
     * Get current step data
     * @returns {Object|null} Current step data
     */
    getCurrentStep() {
        const instance = this.getCurrentInstance();
        if (instance && instance.steps[this.currentStepIndex]) {
            return instance.steps[this.currentStepIndex];
        }
        return null;
    }

    /**
     * Navigate to next step
     * @returns {boolean} True if navigation was successful
     */
    nextStep() {
        const instance = this.getCurrentInstance();
        if (instance && this.currentStepIndex < instance.steps.length - 1) {
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
        const instance = this.getCurrentInstance();
        if (instance && stepIndex >= 0 && stepIndex < instance.steps.length) {
            this.currentStepIndex = stepIndex;
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

        return {
            canGoNext: this.currentStepIndex < instance.steps.length - 1,
            canGoPrevious: this.currentStepIndex > 0,
            currentStep: this.currentStepIndex + 1,
            totalSteps: instance.steps.length
        };
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
