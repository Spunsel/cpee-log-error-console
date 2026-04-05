/**
 * CPEE Service
 * Handles communication with CPEE endpoints for process instance data
 */

import { configManager } from '../config/ConfigManager.js';
import { instanceFallbackService } from './InstanceFallbackService.js';

export class CPEEService {
    constructor() {
        this.configManager = configManager;
        this.fallbackService = instanceFallbackService;
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
     * @param {Object} options - Fetch options
     * @param {string} options.source - Data source: 'fallback' (local only), 'server' (remote only), 'auto' (fallback first, then server)
     * @returns {Promise<{uuid: string, fromFallback: boolean}>} UUID and source info
     * @throws {Error} If process number is invalid or fetch fails
     */
    async fetchUUIDFromProcessNumber(processNumber, options = {}) {
        const { source = 'auto' } = options;
        
        if (!processNumber || isNaN(processNumber)) {
            throw new Error('CPEEService: Invalid process number - must be a valid number');
        }
        
        this.logDebug(`Fetching UUID for process number: ${processNumber} (source: ${source})`);
        
        // Fallback only mode
        if (source === 'fallback') {
            const fallbackResult = await this.fallbackService.getUUIDForProcess(processNumber);
            if (fallbackResult) {
                return fallbackResult;
            }
            throw new Error(`CPEEService: No fallback data found for process ${processNumber}`);
        }
        
        // Server only mode
        if (source === 'server') {
            return await this._fetchUUIDFromServer(processNumber);
        }
        
        // Auto mode: try fallback first, then server
        const fallbackResult = await this.fallbackService.getUUIDForProcess(processNumber);
        if (fallbackResult) {
            return fallbackResult;
        }
        
        this.logDebug(`No local fallback found for process ${processNumber}, trying server...`);
        return await this._fetchUUIDFromServer(processNumber);
    }
    
    /**
     * Internal method to fetch UUID from server
     * @param {number} processNumber - CPEE process instance number
     * @returns {Promise<{uuid: string, fromFallback: boolean}>} UUID and source info
     * @private
     */
    async _fetchUUIDFromServer(processNumber) {
        const uuidUrl = `${this.configManager.get('api.endpoints.cpeeBase')}/${processNumber}/properties/attributes/uuid/`;
        
        try {
            this.logDebug(`Fetching from server URL: ${uuidUrl}`);
            
            const response = await fetch(uuidUrl, {
                method: 'GET',
                headers: {
                    'Accept': this.configManager.get('api.headers.jsonAccept')
                }
            });
            
            if (!response.ok) {
                const error = new Error(`CPEEService: HTTP ${response.status} - ${response.statusText}`);
                error.status = response.status;
                error.isNotFound = response.status === 404;
                throw error;
            }
            
            const uuid = await response.text();
            const cleanUuid = uuid.trim();
            
            if (!this.isValidUUID(cleanUuid)) {
                throw new Error(`CPEEService: Invalid UUID format received - ${cleanUuid}`);
            }
            
            this.logDebug(`Successfully fetched UUID from server: ${cleanUuid}`);
            return { uuid: cleanUuid, fromFallback: false };
            
        } catch (error) {
            if (error.status) {
                throw error;
            }
            throw new Error(`CPEEService: Failed to fetch UUID for process ${processNumber} - ${error.message}`);
        }
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
     * Destroy the service
     */
    destroy() {
        this.configManager = null;
        this.logDebug('CPEEService destroyed');
    }
}
