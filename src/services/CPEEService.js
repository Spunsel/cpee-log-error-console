/**
 * CPEE Service
 * Handles communication with CPEE endpoints for process instance data
 */

import { buildGraphUrl, buildInstanceUrl, buildUuidUrl, CORS_CONFIG } from '../config/service-config.js';

export class CPEEService {
    
    /**
     * Fetch UUID for a given process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {Promise<string>} UUID of the process instance
     * @throws {Error} If process number is invalid or fetch fails
     */
    static async fetchUUIDFromProcessNumber(processNumber) {
        if (!processNumber || isNaN(processNumber)) {
            throw new Error('CPEEService: Invalid process number - must be a valid number');
        }
        
        const uuidUrl = buildUuidUrl(processNumber);
        
        try {
            console.log(`Fetching UUID for process number: ${processNumber}`);
            console.log(`URL: ${uuidUrl}`);
            
            // Use CORS proxy to fetch the UUID
            const response = await fetch(CORS_CONFIG.PROXIES[0] + encodeURIComponent(uuidUrl), {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, application/json, */*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`CPEEService: HTTP ${response.status} - ${response.statusText}`);
            }
            
            const uuid = await response.text();
            const cleanUuid = uuid.trim();
            
            // Validate UUID format
            if (!this.isValidUUID(cleanUuid)) {
                throw new Error(`CPEEService: Invalid UUID format received - ${cleanUuid}`);
            }
            
            console.log(`Successfully fetched UUID: ${cleanUuid}`);
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
    static getCPEEGraphURL(processNumber) {
        if (!this.isValidProcessNumber(processNumber)) {
            throw new Error('CPEEService: Invalid process number - must be a positive integer');
        }
        
        return buildGraphUrl(processNumber);
    }
    
    /**
     * Get the CPEE engine URL for a process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {string} CPEE engine URL
     * @throws {Error} If process number is invalid
     */
    static getCPEEEngineURL(processNumber) {
        if (!this.isValidProcessNumber(processNumber)) {
            throw new Error('CPEEService: Invalid process number - must be a positive integer');
        }
        
        return buildInstanceUrl(processNumber);
    }
    
    /**
     * Validate UUID format
     * @param {string} uuid - UUID string to validate
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
     * Extract process number from CPEE engine URL
     * @param {string} url - CPEE engine URL
     * @returns {number|null} Process number or null if not found
     */
    static extractProcessNumberFromURL(url) {
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
    static isValidProcessNumber(processNumber) {
        return typeof processNumber === 'number' && 
               processNumber > 0 && 
               Number.isInteger(processNumber);
    }
}
