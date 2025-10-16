/**
 * URL Utilities
 * Handles URL parameter parsing and updates
 */

export class URLUtils {
    /**
     * Parse URL parameters
     * @returns {Object} Parsed parameters
     */
    static parseParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        return {
            uuid: urlParams.get('uuid'),
            step: parseInt(urlParams.get('step'), 10) || 1
        };
    }

    /**
     * Update URL with current state
     * @param {string} uuid - Current UUID
     * @param {number} step - Current step number
     */
    static updateURL(uuid, step) {
        if (!uuid) return;
        
        const url = new URL(window.location);
        url.searchParams.set('uuid', uuid);
        url.searchParams.set('step', step);
        
        window.history.replaceState({}, '', url);
    }

    /**
     * Clear URL parameters
     */
    static clearParameters() {
        const url = new URL(window.location);
        url.search = '';
        window.history.replaceState({}, '', url);
    }
}
