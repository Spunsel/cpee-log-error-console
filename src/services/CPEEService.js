/**
 * CPEE Service
 * Handles communication with CPEE endpoints for process instance data
 */

export class CPEEService {
    static BASE_URL = 'https://cpee.org/flow/engine';
    static CORS_PROXY = 'https://corsproxy.io/?';
    
    /**
     * Fetch UUID for a given process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {Promise<string>} UUID of the process instance
     */
    static async fetchUUIDFromProcessNumber(processNumber) {
        if (!processNumber || isNaN(processNumber)) {
            throw new Error('Invalid process number provided');
        }
        
        const uuidUrl = `${this.BASE_URL}/${processNumber}/properties/attributes/uuid/`;
        
        try {
            console.log(`Fetching UUID for process number: ${processNumber}`);
            console.log(`URL: ${uuidUrl}`);
            
            // Use CORS proxy to fetch the UUID
            const response = await fetch(this.CORS_PROXY + encodeURIComponent(uuidUrl), {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, application/json, */*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const uuid = await response.text();
            const cleanUuid = uuid.trim();
            
            // Validate UUID format
            if (!this.isValidUUID(cleanUuid)) {
                throw new Error(`Invalid UUID format received: ${cleanUuid}`);
            }
            
            console.log(`Successfully fetched UUID: ${cleanUuid}`);
            return cleanUuid;
            
        } catch (error) {
            console.error('Error fetching UUID from process number:', error);
            throw new Error(`Failed to fetch UUID for process ${processNumber}: ${error.message}`);
        }
    }
    
    /**
     * Get the CPEE graph URL for a process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {string} CPEE graph URL
     */
    static getCPEEGraphURL(processNumber) {
        return `https://cpee.org/flow/graph.html?monitor=${this.BASE_URL}/${processNumber}/`;
    }
    
    /**
     * Get the CPEE engine URL for a process instance number
     * @param {number} processNumber - CPEE process instance number
     * @returns {string} CPEE engine URL
     */
    static getCPEEEngineURL(processNumber) {
        return `${this.BASE_URL}/${processNumber}/`;
    }
    
    /**
     * Validate UUID format
     * @param {string} uuid - UUID string to validate
     * @returns {boolean} True if valid UUID format
     */
    static isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
    
    /**
     * Extract process number from CPEE engine URL
     * @param {string} url - CPEE engine URL
     * @returns {number|null} Process number or null if not found
     */
    static extractProcessNumberFromURL(url) {
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
