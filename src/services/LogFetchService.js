/**
 * Log Fetch Service
 * Handles fetching and parsing of YAML log files from the CPEE API
 * Single responsibility: Network operations and initial parsing
 */

import { LogParser } from '../utils/content/LogParser.js';
import { configManager } from '../config/ConfigManager.js';
import { instanceFallbackService } from './InstanceFallbackService.js';

export class LogFetchService {
    /**
     * Create a new LogFetchService instance
     * @param {LogParser} logParser - Parser for YAML content (optional, uses static methods if not provided)
     * @param {ConfigManager} configManager - Configuration manager (optional, uses global if not provided)
     */
    constructor(logParser = null, configManagerInstance = null) {
        this.logParser = logParser || LogParser;
        this.configManager = configManagerInstance || configManager;
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
     * Validate UUID format
     * @param {string} uuid - UUID to validate
     * @returns {boolean} True if valid UUID format
     */
    isValidUUID(uuid) {
        if (!uuid || typeof uuid !== 'string') {
            return false;
        }
        
        const trimmed = uuid.trim();
        if (trimmed === '') {
            return false;
        }
        
        // Basic UUID validation (can be enhanced with regex if needed)
        // For now, just check it's not empty and is a string
        return trimmed.length > 0;
    }

    /**
     * Fetch and parse log for given UUID
     * @param {string} uuid - CPEE instance UUID
     * @param {Object} options - Fetch options
     * @param {string} options.source - Data source: 'fallback' (local only), 'server' (remote only), 'auto' (fallback first, then server)
     * @returns {Promise<{events: Array, fromFallback: boolean}>} Parsed log events and source info
     * @throws {Error} If UUID is invalid or fetch fails
     */
    async fetchAndParseLog(uuid, options = {}) {
        const { source = 'auto' } = options;
        
        if (!this.isValidUUID(uuid)) {
            throw new Error('LogFetchService: Invalid UUID provided - must be a non-empty string');
        }
        
        if (this.debugMode) {
            console.log(`[LogFetchService] Fetching log for UUID: ${uuid} (source: ${source})`);
        }
        
        // Fallback only mode
        if (source === 'fallback') {
            const fallbackResult = await this.fallbackService.getLogContent(uuid);
            if (fallbackResult) {
                const events = this.logParser.parseYAMLMultiDocument(fallbackResult.content);
                if (this.debugMode) {
                    console.log(`[LogFetchService] Parsed ${events.length} events from local fallback log`);
                }
                return { events, fromFallback: true };
            }
            throw new Error(`LogFetchService: No fallback log found for UUID ${uuid}`);
        }
        
        // Server only mode
        if (source === 'server') {
            return this._fetchFromServer(uuid);
        }
        
        // Auto mode: try fallback first, then server
        const fallbackResult = await this.fallbackService.getLogContent(uuid);
        
        if (fallbackResult) {
            try {
                const events = this.logParser.parseYAMLMultiDocument(fallbackResult.content);
                if (this.debugMode) {
                    console.log(`[LogFetchService] Parsed ${events.length} events from local fallback log`);
                }
                return { events, fromFallback: true };
            } catch (parseError) {
                if (this.debugMode) {
                    console.log(`[LogFetchService] Failed to parse local fallback: ${parseError.message}, trying server...`);
                }
            }
        } else if (this.debugMode) {
            console.log(`[LogFetchService] No local fallback found, trying server...`);
        }
        
        return this._fetchFromServer(uuid);
    }
    
    /**
     * Internal method to fetch log from server
     * @param {string} uuid - CPEE instance UUID
     * @returns {Promise<{events: Array, fromFallback: boolean}>} Parsed log events
     * @private
     */
    async _fetchFromServer(uuid) {
        const logUrl = `${this.configManager.get('api.endpoints.cpeeLogs')}/${uuid}.xes.yaml`;
        
        if (this.debugMode) {
            console.log(`[LogFetchService] Fetching log from server: ${logUrl}`);
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, this.configManager.get('network.timeouts.default'));
            
            try {
                const proxy = this.configManager.get('api.cors.logProxy');
                const proxyUrl = proxy + encodeURIComponent(logUrl);
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': this.configManager.get('api.headers.yamlAccept')
                    },
                    signal: controller.signal
                });
                
                if (!response.ok) {
                    throw new Error(`LogFetchService: HTTP ${response.status} - ${response.statusText}`);
                }
                
                const yamlContent = await response.text();
                
                clearTimeout(timeoutId);
                
                if (!yamlContent || yamlContent.length < 10) {
                    throw new Error('LogFetchService: Received empty or invalid log response');
                }
                
                if (this.debugMode) {
                    console.log(`[LogFetchService] Parsing YAML content (${yamlContent.length} characters)`);
                }
                
                const events = this.logParser.parseYAMLMultiDocument(yamlContent);
                
                if (this.debugMode) {
                    console.log(`[LogFetchService] Parsed ${events.length} events from server`);
                }
                
                return { events, fromFallback: false };
            } finally {
                clearTimeout(timeoutId);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('LogFetchService: Request timed out - log file may be large or server is slow');
            }
            throw new Error(`LogFetchService: Failed to fetch log - ${error.message}`);
        }
    }
}
