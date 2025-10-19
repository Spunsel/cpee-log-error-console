/**
 * DOM Registry
 * Centralized DOM element management to reduce coupling between components and hardcoded IDs
 * Provides dependency injection for DOM elements using semantic keys instead of hardcoded IDs
 */

export class DOMRegistry {
    constructor() {
        this.elements = new Map();
        this.elementCache = new Map();
        this.warningsEnabled = true;
    }

    /**
     * Register a DOM element with a semantic key
     * @param {string} key - Semantic key for the element
     * @param {string} elementId - Actual DOM element ID
     */
    register(key, elementId) {
        if (!key || !elementId) {
            throw new Error('DOMRegistry: Both key and elementId are required');
        }
        
        this.elements.set(key, elementId);
        // Clear cache when element is re-registered
        this.elementCache.delete(key);
        
        if (this.warningsEnabled) {
            // Validate element exists at registration time
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`DOMRegistry: Element with ID '${elementId}' not found during registration of key '${key}'`);
            }
        }
    }

    /**
     * Get DOM element by semantic key
     * @param {string} key - Semantic key for the element
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (!key) {
            console.error('DOMRegistry: getElement called with empty key');
            return null;
        }

        // Check cache first for performance
        if (this.elementCache.has(key)) {
            const cached = this.elementCache.get(key);
            // Verify cached element is still in DOM
            if (document.contains(cached)) {
                return cached;
            }
            // Remove stale cache entry
            this.elementCache.delete(key);
        }

        const elementId = this.elements.get(key);
        if (!elementId) {
            if (this.warningsEnabled) {
                console.warn(`DOMRegistry: No element registered for key '${key}'`);
            }
            return null;
        }

        const element = document.getElementById(elementId);
        if (!element) {
            if (this.warningsEnabled) {
                console.warn(`DOMRegistry: Element with ID '${elementId}' not found for key '${key}'`);
            }
            return null;
        }

        // Cache the element for future use
        this.elementCache.set(key, element);
        return element;
    }

    /**
     * Check if a key is registered
     * @param {string} key - Semantic key to check
     * @returns {boolean} True if key is registered
     */
    hasKey(key) {
        return this.elements.has(key);
    }

    /**
     * Get all registered keys
     * @returns {Array<string>} Array of registered keys
     */
    getKeys() {
        return Array.from(this.elements.keys());
    }

    /**
     * Clear all cached elements
     * Useful when DOM structure changes significantly
     */
    clearCache() {
        this.elementCache.clear();
    }

    /**
     * Enable or disable warning messages
     * @param {boolean} enabled - Whether to show warnings
     */
    setWarningsEnabled(enabled) {
        this.warningsEnabled = enabled;
    }

    /**
     * Batch register multiple elements
     * @param {Object} mappings - Object with key-elementId pairs
     */
    registerBatch(mappings) {
        if (!mappings || typeof mappings !== 'object') {
            throw new Error('DOMRegistry: registerBatch expects an object with key-elementId pairs');
        }

        Object.entries(mappings).forEach(([key, elementId]) => {
            this.register(key, elementId);
        });
    }

    /**
     * Get element with fallback to DOMUtils for backward compatibility
     * @param {string} key - Semantic key for the element
     * @returns {Element|null} DOM element or null if not found
     */
    getElementSafe(key) {
        const element = this.getElement(key);
        if (element) {
            return element;
        }

        // Fallback: try to use key as direct ID for backward compatibility
        if (this.warningsEnabled) {
            console.warn(`DOMRegistry: Falling back to direct ID lookup for '${key}'`);
        }
        return document.getElementById(key);
    }

    /**
     * Validate all registered elements exist in DOM
     * Useful for debugging and ensuring DOM structure matches registry
     * @returns {Object} Validation results with missing elements
     */
    validateRegistry() {
        const results = {
            valid: [],
            missing: [],
            total: this.elements.size
        };

        this.elements.forEach((elementId, key) => {
            const element = document.getElementById(elementId);
            if (element) {
                results.valid.push({ key, elementId });
            } else {
                results.missing.push({ key, elementId });
            }
        });

        return results;
    }
}

/**
 * Default DOM element mappings for the CPEE Debug Console
 * Maps semantic keys to actual DOM element IDs
 */
export const DEFAULT_DOM_MAPPINGS = {
    // Navigation elements (may be created dynamically)
    stepNavigation: 'step-navigation',
    prevStep: 'prev-step',
    nextStep: 'next-step',
    stepCounter: 'step-counter',
    
    // Content sections
    processAnalysis: 'process-analysis',
    stepDetails: 'step-details',
    inputCpeeContent: 'input-cpee-content',
    outputCpeeContent: 'output-cpee-content',
    inputIntermediateContent: 'input-intermediate-content',
    outputIntermediateContent: 'output-intermediate-content',
    userInputContent: 'user-input-content',
    
    // Log display
    rawLogSection: 'raw-log-section',
    rawLogContent: 'raw-log-content',
    hideLog: 'hide-log',
    viewLog: 'view-log',
    
    // Dynamic log elements (created at runtime)
    loadPastedLog: 'load-pasted-log',
    manualLogInput: 'manual-log-input',
    
    // Form elements
    uuidInput: 'uuid-input',
    processNumberInput: 'process-number-input',
    fetchUuid: 'fetch-uuid',
    loadInstance: 'load-instance',
    
    // Instance management
    instanceTabs: 'instance-tabs',
    
    // Main app structure
    app: 'app',
    appTitle: 'app-title'
};
