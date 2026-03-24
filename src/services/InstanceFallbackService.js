/**
 * Instance Fallback Service
 * Provides local fallback data for CPEE instance data when remote API is unavailable
 * Handles UUID lookups and log file retrieval from local cache
 */

export class InstanceFallbackService {
    constructor() {
        this.processToUuid = null;  // { processNumber: uuid }
        this.uuidToProcess = null;  // { uuid: processNumber } - built dynamically
        this.mappingLoaded = false;
        this.debugMode = false;
        this.basePath = './fallback';
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
            console.log('[InstanceFallbackService]', ...args);
        }
    }

    /**
     * Log warning (always shown)
     * @param {...*} args - Arguments to log
     */
    logWarning(...args) {
        console.warn('[InstanceFallbackService]', ...args);
    }

    /**
     * Load UUID mapping from local JSON file
     * @returns {Promise<boolean>} True if loaded successfully
     */
    async loadUUIDMapping() {
        if (this.mappingLoaded && this.processToUuid) {
            return true;
        }

        try {
            const response = await fetch(`${this.basePath}/uuid-mapping.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Load flat format: { "processNumber": "uuid", ... }
            this.processToUuid = await response.json();
            
            // Build reverse lookup dynamically
            this.uuidToProcess = {};
            for (const [processNumber, uuid] of Object.entries(this.processToUuid)) {
                this.uuidToProcess[uuid] = processNumber;
            }
            
            this.mappingLoaded = true;
            this.logDebug(`UUID mapping loaded: ${Object.keys(this.processToUuid).length} entries`);
            return true;
        } catch (error) {
            this.logDebug('Failed to load UUID mapping:', error.message);
            this.processToUuid = null;
            this.uuidToProcess = null;
            this.mappingLoaded = false;
            return false;
        }
    }

    /**
     * Get UUID for a process number from local fallback
     * Note: If UUID has _v2 suffix (for fallback log files), it is stripped for server queries.
     * Use getLogContent() which handles _v2 suffix for local fallback files.
     * @param {number|string} processNumber - CPEE process instance number
     * @returns {Promise<{uuid: string, fromFallback: boolean}|null>} UUID (without _v2) and source, or null if not found
     */
    async getUUIDForProcess(processNumber) {
        await this.loadUUIDMapping();
        
        if (!this.processToUuid) {
            return null;
        }

        const processKey = String(processNumber);
        const rawUuid = this.processToUuid[processKey];
        
        if (rawUuid) {
            // Strip _v2 suffix for server queries - _v2 is only for local fallback files
            const uuid = rawUuid.replace(/_v2$/, '');
            this.logWarning(`Using FALLBACK UUID for process ${processNumber}: ${uuid}${rawUuid.endsWith('_v2') ? ' (fallback log has _v2 suffix)' : ''}`);
            return { uuid, fromFallback: true };
        }
        
        return null;
    }

    /**
     * Get process number for a UUID from local fallback
     * @param {string} uuid - CPEE instance UUID
     * @returns {Promise<{processNumber: string, fromFallback: boolean}|null>} Process number and source, or null if not found
     */
    async getProcessForUUID(uuid) {
        await this.loadUUIDMapping();
        
        if (!this.uuidToProcess) {
            return null;
        }

        const processNumber = this.uuidToProcess[uuid];
        
        if (processNumber) {
            this.logWarning(`Using FALLBACK process number for UUID ${uuid}: ${processNumber}`);
            return { processNumber, fromFallback: true };
        }
        
        return null;
    }

    /**
     * Check if a local log file exists for a UUID
     * Checks both _v2 suffixed and regular filenames
     * @param {string} uuid - CPEE instance UUID (without _v2 suffix)
     * @returns {Promise<boolean>} True if local log exists
     */
    async hasLocalLog(uuid) {
        // Check _v2 version first, then regular
        const filesToCheck = [
            `${this.basePath}/logs/${uuid}_v2.xes.yaml`,
            `${this.basePath}/logs/${uuid}.xes.yaml`
        ];
        
        for (const filePath of filesToCheck) {
            try {
                const response = await fetch(filePath, { method: 'HEAD' });
                if (response.ok) {
                    return true;
                }
            } catch {
                // Continue to next file
            }
        }
        
        return false;
    }

    /**
     * Get log content from local fallback
     * Tries _v2 suffixed file first (for 200xxx instances), then falls back to regular filename
     * @param {string} uuid - CPEE instance UUID (without _v2 suffix)
     * @returns {Promise<{content: string, fromFallback: boolean}|null>} Log content and source, or null if not found
     */
    async getLogContent(uuid) {
        // Try _v2 suffixed file first (for 200xxx prefixed instances)
        const filesToTry = [
            `${this.basePath}/logs/${uuid}_v2.xes.yaml`,
            `${this.basePath}/logs/${uuid}.xes.yaml`
        ];
        
        for (const filePath of filesToTry) {
            try {
                const response = await fetch(filePath);
                
                if (!response.ok) {
                    continue;
                }
                
                const content = await response.text();
                
                if (!content || content.length < 10) {
                    this.logDebug(`Local log at ${filePath} is empty or invalid`);
                    continue;
                }
                
                const isV2 = filePath.includes('_v2');
                this.logWarning(`Using FALLBACK log for UUID ${uuid}${isV2 ? ' (_v2 version)' : ''} (${content.length} bytes)`);
                return { content, fromFallback: true };
            } catch (error) {
                this.logDebug(`Failed to fetch local log at ${filePath}:`, error.message);
            }
        }
        
        this.logDebug(`No local log found for UUID ${uuid} (tried both regular and _v2 versions)`);
        return null;
    }

    /**
     * Check if UUID mapping contains a specific process number
     * @param {number|string} processNumber - Process number to check
     * @returns {Promise<boolean>} True if process is in local mapping
     */
    async hasProcessMapping(processNumber) {
        await this.loadUUIDMapping();
        
        if (!this.processToUuid) {
            return false;
        }
        
        return String(processNumber) in this.processToUuid;
    }

    /**
     * Check if UUID mapping contains a specific UUID
     * @param {string} uuid - UUID to check
     * @returns {Promise<boolean>} True if UUID is in local mapping
     */
    async hasUUIDMapping(uuid) {
        await this.loadUUIDMapping();
        
        if (!this.uuidToProcess) {
            return false;
        }
        
        return uuid in this.uuidToProcess;
    }

    /**
     * Get statistics about the fallback data
     * @returns {Promise<Object>} Statistics object
     */
    async getStats() {
        await this.loadUUIDMapping();
        
        return {
            mappingLoaded: this.mappingLoaded,
            entryCount: this.processToUuid ? Object.keys(this.processToUuid).length : 0,
            debugMode: this.debugMode
        };
    }

    /**
     * Clear cached mapping (force reload on next access)
     */
    clearCache() {
        this.processToUuid = null;
        this.uuidToProcess = null;
        this.mappingLoaded = false;
        this.logDebug('Cache cleared');
    }
}

// Export singleton instance
export const instanceFallbackService = new InstanceFallbackService();

