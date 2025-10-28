/**
 * URL Manager
 * Centralized URL parameter management for the CPEE Debug Console
 * Handles URL parsing, updating, and clearing operations
 */

export class URLManager {
    /**
     * Parse URL parameters from the current page URL
     * @returns {Object} Parsed parameters with uuid and step
     */
    static parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        return {
            uuid: urlParams.get('uuid'),
            step: parseInt(urlParams.get('step'), 10) || 1
        };
    }

    /**
     * Update URL with current state parameters
     * @param {string} uuid - Current UUID
     * @param {number} step - Current step number
     */
    static updateURL(uuid, step) {
        if (!uuid) {
            return;
        }
        
        const url = new URL(window.location);
        url.searchParams.set('uuid', uuid);
        url.searchParams.set('step', step);
        
        window.history.replaceState({}, '', url);
    }

    /**
     * Clear all URL parameters
     */
    static clearURLParameters() {
        const url = new URL(window.location);
        url.search = '';
        window.history.replaceState({}, '', url);
    }

    /**
     * Get a specific URL parameter
     * @param {string} paramName - Parameter name to retrieve
     * @returns {string|null} Parameter value or null if not found
     */
    static getURLParameter(paramName) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(paramName);
    }

    /**
     * Set a specific URL parameter
     * @param {string} paramName - Parameter name
     * @param {string} paramValue - Parameter value
     */
    static setURLParameter(paramName, paramValue) {
        const url = new URL(window.location);
        url.searchParams.set(paramName, paramValue);
        window.history.replaceState({}, '', url);
    }

    /**
     * Remove a specific URL parameter
     * @param {string} paramName - Parameter name to remove
     */
    static removeURLParameter(paramName) {
        const url = new URL(window.location);
        url.searchParams.delete(paramName);
        window.history.replaceState({}, '', url);
    }

    /**
     * Check if URL has any parameters
     * @returns {boolean} True if URL has parameters
     */
    static hasURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.toString().length > 0;
    }

    /**
     * Get all URL parameters as an object
     * @returns {Object} Object with all URL parameters
     */
    static getAllURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const params = {};
        
        for (const [key, value] of urlParams) {
            params[key] = value;
        }
        
        return params;
    }

    /**
     * Build URL with parameters
     * @param {Object} params - Parameters to include in URL
     * @param {string} baseUrl - Base URL (optional, defaults to current location)
     * @returns {string} Built URL with parameters
     */
    static buildURL(params = {}, baseUrl = null) {
        const url = new URL(baseUrl || window.location.href);
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        });
        
        return url.toString();
    }

    /**
     * Navigate to a new URL with parameters
     * @param {Object} params - Parameters to include
     * @param {string} baseUrl - Base URL (optional)
     * @param {boolean} replace - Whether to replace current history entry
     */
    static navigateToURL(params = {}, baseUrl = null, replace = false) {
        const url = this.buildURL(params, baseUrl);
        
        if (replace) {
            window.history.replaceState({}, '', url);
        } else {
            window.location.href = url;
        }
    }

    /**
     * Validate UUID parameter format
     * @param {string} uuid - UUID to validate
     * @returns {boolean} True if valid UUID format
     */
    static isValidUUID(uuid) {
        if (!uuid || typeof uuid !== 'string') {
            return false;
        }
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Validate step parameter
     * @param {number} step - Step number to validate
     * @returns {boolean} True if valid step number
     */
    static isValidStep(step) {
        return typeof step === 'number' && step > 0 && Number.isInteger(step);
    }

    /**
     * Parse and validate URL parameters
     * @returns {Object} Parsed and validated parameters
     */
    static parseAndValidateURLParameters() {
        const params = this.parseURLParameters();
        
        return {
            uuid: params.uuid,
            step: params.step,
            isValidUUID: this.isValidUUID(params.uuid),
            isValidStep: this.isValidStep(params.step),
            hasValidParams: this.isValidUUID(params.uuid) && this.isValidStep(params.step)
        };
    }
}
