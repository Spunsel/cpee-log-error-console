/**
 * CPEE Service
 * Handles communication with CPEE endpoints for process instance data
 */

import { configManager } from '../config/ConfigManager.js';

export class CPEEService {
    constructor() {
        this.configManager = configManager;
        this.debugMode = false;
    }

    /**
     * Enable debug mode for logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Debug logging helper
     * @param {...*} args - Arguments to log
     */
    logDebug(...args) {
        if (this.debugMode) {
            console.log('[CPEEService]', ...args);
        }
    }
    
    /**
     * Fetch UUID for a given process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {Promise<string>} UUID of the process instance
     * @throws {Error} If process number is invalid or fetch fails
     */
    async fetchUUIDFromProcessNumber(processNumber) {
        if (!processNumber || isNaN(processNumber)) {
            throw new Error('CPEEService: Invalid process number - must be a valid number');
        }
        
        const uuidUrl = `${this.configManager.get('api.endpoints.cpeeBase')}/${processNumber}/properties/attributes/uuid/`;
        
        try {
            this.logDebug(`Fetching UUID for process number: ${processNumber}`);
            this.logDebug(`URL: ${uuidUrl}`);
            
            // Use CORS proxy to fetch the UUID
            const proxies = this.configManager.get('api.cors.proxies');
            const response = await fetch(proxies[0] + encodeURIComponent(uuidUrl), {
                method: 'GET',
                headers: {
                    'Accept': this.configManager.get('api.headers.jsonAccept')
                }
            });
            
            if (!response.ok) {
                // Create error with status code attached for better error handling
                const error = new Error(`CPEEService: HTTP ${response.status} - ${response.statusText}`);
                error.status = response.status;
                error.isNotFound = response.status === 404;
                throw error;
            }
            
            const uuid = await response.text();
            const cleanUuid = uuid.trim();
            
            // Validate UUID format
            if (!this.isValidUUID(cleanUuid)) {
                throw new Error(`CPEEService: Invalid UUID format received - ${cleanUuid}`);
            }
            
            this.logDebug(`Successfully fetched UUID: ${cleanUuid}`);
            return cleanUuid;
            
        } catch (error) {
            console.error('Error fetching UUID from process number:', error);
            throw new Error(`CPEEService: Failed to fetch UUID for process ${processNumber} - ${error.message}`);
        }
    }
    
    /**
     * Get the CPEE graph URL for a process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {string} CPEE graph URL
     * @throws {Error} If process number is invalid
     */
    getCPEEGraphURL(processNumber) {
        if (!this.isValidProcessNumber(processNumber)) {
            throw new Error('CPEEService: Invalid process number - must be a positive integer');
        }
        
        return `${this.configManager.get('api.endpoints.cpeeGraph')}?monitor=${this.configManager.get('api.endpoints.cpeeBase')}/${processNumber}/`;
    }
    
    /**
     * Get the CPEE engine URL for a process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {string} CPEE engine URL
     * @throws {Error} If process number is invalid
     */
    getCPEEEngineURL(processNumber) {
        if (!this.isValidProcessNumber(processNumber)) {
            throw new Error('CPEEService: Invalid process number - must be a positive integer');
        }
        
        return `${this.configManager.get('api.endpoints.cpeeBase')}/${processNumber}/`;
    }
    
    /**
     * Validate UUID format
     * @param {string} uuid - UUID string to validate
     * @returns {boolean} True if valid UUID format
     */
    isValidUUID(uuid) {
        if (!uuid || typeof uuid !== 'string') {
            return false;
        }
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
    
    /**
     * Extract process number from CPEE engine URL
     * @param {string} url - CPEE engine URL
     * @returns {number|null} Process number or null if not found
     */
    extractProcessNumberFromURL(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }
        
        const match = url.match(/\/flow\/engine\/(\d+)\//);
        return match ? parseInt(match[1], 10) : null;
    }
    
    /**
     * Validate process number
     * @param {number} processNumber - Process number to validate
     * @returns {boolean} True if valid process number
     */
    isValidProcessNumber(processNumber) {
        return typeof processNumber === 'number' && 
               processNumber > 0 && 
               Number.isInteger(processNumber);
    }

    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getStats() {
        return {
            debugMode: this.debugMode,
            configManager: this.configManager ? 'available' : 'not available'
        };
    }

    /**
     * Destroy the service
     */
    destroy() {
        this.configManager = null;
        this.logDebug('CPEEService destroyed');
    }
}
