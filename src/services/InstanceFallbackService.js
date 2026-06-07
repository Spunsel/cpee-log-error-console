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

            const rawText = await response.text();
            const jsonText = rawText.charCodeAt(0) === 0xFEFF ? rawText.slice(1) : rawText;
            const data = JSON.parse(jsonText);

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

            // Build reverse lookup from all generations (not the flat map, which
            // loses duplicates when the same process number appears in multiple gens)
            this.uuidToProcess = {};
            for (const entries of Object.values(this.generations)) {
                for (const [processNumber, uuid] of Object.entries(entries)) {
                    this.uuidToProcess[uuid] = processNumber;
                }
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
        if (!this.generations || !this.generations[generation]) {
            return [];
        }
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
     * @param {string|null} [generation=null] - Generation bucket (e.g. 'generation1').
     *   Required when the same process number exists in multiple generations.
     * @returns {Promise<{uuid: string, fromFallback: boolean}|null>} UUID and source, or null if not found
     */
    async getUUIDForProcess(processNumber, generation = null) {
        await this.loadUUIDMapping();
        
        if (!this.processToUuid) {
            return null;
        }

        const processKey = String(processNumber);

        if (generation) {
            const scopedUuid = this.generations?.[generation]?.[processKey];
            if (scopedUuid) {
                return { uuid: scopedUuid, fromFallback: true };
            }
            // Do not fall back to the flat map when a generation was requested —
            // duplicates would always resolve to whichever generation was parsed last.
            this.logDebug(`No fallback UUID for process ${processNumber} in ${generation}`);
            return null;
        }

        const rawUuid = this.processToUuid[processKey];
        
        if (rawUuid) {
            return { uuid: rawUuid, fromFallback: true };
        }
        
        return null;
    }

    /**
     * Decode log bytes — plain UTF-8 or gzip-compressed UTF-8.
     * @param {ArrayBuffer} buffer - Raw file bytes
     * @param {boolean} isGzip - Whether the buffer is gzip-compressed
     * @returns {Promise<string|null>} Decoded YAML text, or null on failure
     */
    async decodeLogBuffer(buffer, isGzip) {
        try {
            let decodedBuffer = buffer;

            if (isGzip) {
                if (typeof DecompressionStream === 'undefined') {
                    this.logWarning('DecompressionStream not supported — cannot read .gz fallback logs');
                    return null;
                }
                decodedBuffer = await new Response(
                    new Response(buffer).body.pipeThrough(new DecompressionStream('gzip'))
                ).arrayBuffer();
            }

            const content = new TextDecoder('utf-8').decode(decodedBuffer);
            return content && content.length >= 10 ? content : null;
        } catch (error) {
            this.logDebug('Failed to decode log buffer:', error.message);
            return null;
        }
    }

    /**
     * Fetch and decode a single fallback log file.
     * @param {string} filePath - Path relative to site root
     * @param {boolean} isGzip - Whether the file is gzip-compressed
     * @returns {Promise<{content: string, fromFallback: boolean}|null>}
     */
    async fetchLogFile(filePath, isGzip) {
        try {
            const response = await fetch(filePath);

            if (!response.ok) {
                this.logDebug(`Local log not found at ${filePath} (${response.status})`);
                return null;
            }

            const buffer = await response.arrayBuffer();
            const content = await this.decodeLogBuffer(buffer, isGzip);

            if (!content) {
                this.logDebug(`Local log at ${filePath} is empty or invalid`);
                return null;
            }

            return { content, fromFallback: true };
        } catch (error) {
            this.logDebug(`Failed to fetch local log at ${filePath}:`, error.message);
            return null;
        }
    }

    /**
     * Get log content from local fallback.
     * Prefers gzip-compressed `.xes.yaml.gz`; falls back to legacy `.xes.yaml`.
     * @param {string} uuid - CPEE instance UUID
     * @returns {Promise<{content: string, fromFallback: boolean}|null>} Log content and source, or null if not found
     */
    async getLogContent(uuid) {
        const gzPath = `${this.basePath}/logs/${uuid}.xes.yaml.gz`;
        const gzResult = await this.fetchLogFile(gzPath, true);
        if (gzResult) {
            this.logWarning(`Using FALLBACK log for UUID ${uuid} (${gzResult.content.length} bytes, gzip)`);
            return gzResult;
        }

        const yamlPath = `${this.basePath}/logs/${uuid}.xes.yaml`;
        const yamlResult = await this.fetchLogFile(yamlPath, false);
        if (yamlResult) {
            this.logWarning(`Using FALLBACK log for UUID ${uuid} (${yamlResult.content.length} bytes)`);
            return yamlResult;
        }

        return null;
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

