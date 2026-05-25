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
     * Load UUID mapping from local JSON file.
     * Supports both the legacy flat format and the current generation-nested format:
     *   { "generation1": { "193": "uuid", ... }, "generation2": { "4": "uuid", ... } }
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

            const data = await response.json();

            this.processToUuid = {};
            this.generationMap = {};  // processNumber -> generationName
            this.generations    = {}; // generationName -> { processNumber: uuid }

            // Detect nested format by checking for generation keys
            const keys = Object.keys(data);
            const isNested = keys.length > 0 && keys.every(k => typeof data[k] === 'object' && !Array.isArray(data[k]));

            if (isNested) {
                for (const [genName, entries] of Object.entries(data)) {
                    this.generations[genName] = {};
                    for (const [processNumber, uuid] of Object.entries(entries)) {
                        this.processToUuid[processNumber] = uuid;
                        this.generationMap[processNumber] = genName;
                        this.generations[genName][processNumber] = uuid;
                    }
                }
            } else {
                // Legacy flat format fallback
                for (const [processNumber, uuid] of Object.entries(data)) {
                    this.processToUuid[processNumber] = uuid;
                    this.generationMap[processNumber] = 'default';
                }
                this.generations['default'] = { ...data };
            }

            // Build reverse lookup
            this.uuidToProcess = {};
            for (const [processNumber, uuid] of Object.entries(this.processToUuid)) {
                this.uuidToProcess[uuid] = processNumber;
            }

            this.mappingLoaded = true;
            this.logDebug(`UUID mapping loaded: ${Object.keys(this.processToUuid).length} entries across ${Object.keys(this.generations).length} generation(s)`);
            return true;
        } catch (error) {
            this.logDebug('Failed to load UUID mapping:', error.message);
            this.processToUuid = null;
            this.uuidToProcess = null;
            this.generationMap = null;
            this.generations   = null;
            this.mappingLoaded = false;
            return false;
        }
    }

    /**
     * Get all process numbers belonging to a specific generation.
     * @param {string} generation - Generation name (e.g. 'generation1')
     * @returns {Promise<string[]>} Array of process number strings, sorted numerically
     */
    async getProcessNumbersByGeneration(generation) {
        await this.loadUUIDMapping();
        if (!this.generations || !this.generations[generation]) return [];
        return Object.keys(this.generations[generation]).sort((a, b) => parseInt(a) - parseInt(b));
    }

    /**
     * Get all generation names present in the mapping.
     * @returns {Promise<string[]>} Array of generation names in definition order
     */
    async getGenerationNames() {
        await this.loadUUIDMapping();
        return this.generations ? Object.keys(this.generations) : [];
    }

    /**
     * Get UUID for a process number from local fallback.
     * @param {number|string} processNumber - CPEE process instance number
     * @returns {Promise<{uuid: string, fromFallback: boolean}|null>} UUID and source, or null if not found
     */
    async getUUIDForProcess(processNumber) {
        await this.loadUUIDMapping();
        
        if (!this.processToUuid) {
            return null;
        }

        const processKey = String(processNumber);
        const rawUuid = this.processToUuid[processKey];
        
        if (rawUuid) {
            this.logWarning(`Using FALLBACK UUID for process ${processNumber}: ${rawUuid}`);
            return { uuid: rawUuid, fromFallback: true };
        }
        
        return null;
    }

    /**
     * Get log content from local fallback.
     * @param {string} uuid - CPEE instance UUID
     * @returns {Promise<{content: string, fromFallback: boolean}|null>} Log content and source, or null if not found
     */
    async getLogContent(uuid) {
        const filePath = `${this.basePath}/logs/${uuid}.xes.yaml`;

        try {
            const response = await fetch(filePath);

            if (!response.ok) {
                this.logDebug(`Local log not found at ${filePath} (${response.status})`);
                return null;
            }

            const buffer = await response.arrayBuffer();
            const content = new TextDecoder('utf-8').decode(buffer);

            if (!content || content.length < 10) {
                this.logDebug(`Local log at ${filePath} is empty or invalid`);
                return null;
            }

            this.logWarning(`Using FALLBACK log for UUID ${uuid} (${content.length} bytes)`);
            return { content, fromFallback: true };
        } catch (error) {
            this.logDebug(`Failed to fetch local log at ${filePath}:`, error.message);
            return null;
        }
    }

    /**
     * Get statistics about the fallback data
     * @returns {Promise<Object>} Statistics object
     */
    async getStats() {
        await this.loadUUIDMapping();

        const generationStats = {};
        if (this.generations) {
            for (const [gen, entries] of Object.entries(this.generations)) {
                generationStats[gen] = Object.keys(entries).length;
            }
        }

        return {
            mappingLoaded: this.mappingLoaded,
            entryCount: this.processToUuid ? Object.keys(this.processToUuid).length : 0,
            generations: generationStats,
            debugMode: this.debugMode
        };
    }

    /**
     * Clear cached mapping (force reload on next access)
     */
    clearCache() {
        this.processToUuid = null;
        this.uuidToProcess = null;
        this.generationMap = null;
        this.generations   = null;
        this.mappingLoaded = false;
        this.logDebug('Cache cleared');
    }
}

// Export singleton instance
export const instanceFallbackService = new InstanceFallbackService();

