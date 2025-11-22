/**
 * State Manager
 * Centralized state management for the application
 * Provides single source of truth for application state
 */

export class StateManager {
    constructor() {
        this.state = this.getInitialState();
        this.listeners = new Map();
        this.debugMode = false;
        this.history = [];
        this.maxHistorySize = 50;
        this.persistedPaths = new Set(); // Paths that should persist to localStorage
        this.storagePrefix = 'cpee-debug-console-state-';
        
        // Load persisted state from localStorage
        this.loadPersistedState();
    }

    /**
     * Get initial state configuration
     * @returns {Object} Initial state object
     */
    getInitialState() {
        return {
            currentInstance: null,
            currentStep: null,
            currentStepIndex: 0,
            viewMode: 'visual',
            instances: new Map(),
            ui: {
                sidebarVisible: true,
                sidebarCollapsed: true,
                loading: false,
                activeView: 'home', // 'home', 'instance', 'log'
                darkMode: false, // Dark mode preference (persisted)
                theme: 'presetid', // CPEE theme preference (persisted)
                scale: 1.0, // Graph scale preference (persisted)
                graphScale: 1.0 // Default graph scale: 1x (100%) - legacy, use ui.scale
            },
            search: {
                active: false,
                term: '',
                caseSensitive: false,
                wholeWord: false
            },
            viewModes: {
                // View modes for each section: 'visual', 'raw', 'log', 'traces', or 'analysis' (persisted)
                'input-cpee': 'visual',
                'input-intermediate': 'visual',
                'output-intermediate': 'visual',
                'output-cpee': 'visual'
            },
            // Optional: Cache trace calculation results per section 
            traceCache: {}, // Structure: { 'sectionId-stepNumber': Trace[] }
            graphScale: 1.0 // Default graph scale: 1x (100%) - legacy, use ui.scale
        };
    }

    /**
     * Normalize path to string format
     * @param {string|Array} path - Path to normalize
     * @returns {string} Normalized path string
     */
    normalizePath(path) {
        return Array.isArray(path) ? path.join('.') : path;
    }

    /**
     * Debug logging helper
     * @param {...*} args - Arguments to log
     */
    logDebug(...args) {
        if (this.debugMode) {
            console.log('[StateManager]', ...args);
        }
    }

    /**
     * Remove listeners from a specific path
     * @param {string} pathKey - Path key
     * @param {Array} listenersToRemove - Listeners to remove
     */
    removeListeners(pathKey, listenersToRemove) {
        listenersToRemove.forEach(listener => {
            const pathListeners = this.listeners.get(pathKey) || [];
            const index = pathListeners.indexOf(listener);
            if (index > -1) {
                pathListeners.splice(index, 1);
            }
        });
    }

    /**
     * Limit history size to maxHistorySize
     */
    limitHistorySize() {
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
    }

    /**
     * Get state value by path
     * @param {string|Array} path - Dot notation path or array of keys
     * @returns {*} State value
     */
    getState(path) {
        this.logDebug(`Getting state: ${path}`);
        return this.getNestedValue(this.state, path);
    }

    /**
     * Set state value by path
     * @param {string|Array} path - Dot notation path or array of keys
     * @param {*} value - Value to set
     * @param {Object} options - Additional options
     * @param {boolean} options.silent - Don't add to history or notify listeners
     * @param {boolean} options.persist - Persist to localStorage (default: auto-detect based on persistedPaths)
     */
    setState(path, value, options = {}) {
        this.logDebug(`Setting state: ${path} =`, value);

        const oldValue = this.getNestedValue(this.state, path);
        
        // Add to history if not silent
        if (!options.silent) {
            this.addToHistory(path, oldValue, value);
        }

        this.setNestedValue(this.state, path, value);
        
        // Persist to localStorage if this path is marked for persistence
        const pathKey = this.normalizePath(path);
        const shouldPersist = options.persist !== undefined 
            ? options.persist 
            : this.persistedPaths.has(pathKey) || this.isPersistedPath(pathKey);
        
        if (shouldPersist) {
            this.persistToStorage(pathKey, value);
        }
        
        this.notifyListeners(path, value, oldValue);
    }

    /**
     * Subscribe to state changes
     * @param {string|Array} path - Dot notation path or array of keys
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback, options = {}) {
        const pathKey = this.normalizePath(path);
        
        if (!this.listeners.has(pathKey)) {
            this.listeners.set(pathKey, []);
        }

        const listener = {
            callback,
            immediate: options.immediate || false,
            once: options.once || false
        };

        this.listeners.get(pathKey).push(listener);

        // Call immediately if requested
        if (listener.immediate) {
            const currentValue = this.getNestedValue(this.state, path);
            callback(currentValue, undefined, path);
        }

        this.logDebug(`Subscribed to: ${pathKey}`);

        // Return unsubscribe function
        return () => this.unsubscribe(pathKey, listener);
    }

    /**
     * Unsubscribe from state changes
     * @param {string} pathKey - Path key
     * @param {Object} listener - Listener object
     */
    unsubscribe(pathKey, listener) {
        if (this.listeners.has(pathKey)) {
            const listeners = this.listeners.get(pathKey);
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
                this.logDebug(`Unsubscribed from: ${pathKey}`);
            }
        }
    }

    /**
     * Get nested value from object using path
     * @param {Object} obj - Object to traverse
     * @param {string|Array} path - Dot notation path or array of keys
     * @returns {*} Value at path
     */
    getNestedValue(obj, path) {
        const keys = this.normalizePath(path).split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, key)) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Set nested value in object using path
     * @param {Object} obj - Object to modify
     * @param {string|Array} path - Dot notation path or array of keys
     * @param {*} value - Value to set
     */
    setNestedValue(obj, path, value) {
        const keys = this.normalizePath(path).split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(current, key) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }

    /**
     * Notify listeners of state changes
     * @param {string|Array} path - Path that changed
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    notifyListeners(path, newValue, oldValue) {
        const pathKey = this.normalizePath(path);
        const listeners = this.listeners.get(pathKey) || [];
        
        // Also notify listeners for parent paths
        const parentPaths = this.getParentPaths(pathKey);
        for (const parentPath of parentPaths) {
            const parentListeners = this.listeners.get(parentPath) || [];
            listeners.push(...parentListeners);
        }

        const toRemove = [];
        listeners.forEach((listener) => {
            try {
                listener.callback(newValue, oldValue, path);
                
                // Remove one-time listeners
                if (listener.once) {
                    toRemove.push(listener);
                }
            } catch (error) {
                console.error(`[StateManager] Error in listener for path "${pathKey}":`, error);
            }
        });

        // Remove one-time listeners
        this.removeListeners(pathKey, toRemove);
    }

    /**
     * Get parent paths for a given path
     * @param {string} path - Dot notation path
     * @returns {Array} Array of parent paths
     */
    getParentPaths(path) {
        const parts = path.split('.');
        const parentPaths = [];
        
        for (let i = 1; i < parts.length; i++) {
            parentPaths.push(parts.slice(0, i).join('.'));
        }
        
        return parentPaths;
    }

    /**
     * Add state change to history
     * @param {string|Array} path - Path that changed
     * @param {*} oldValue - Old value
     * @param {*} newValue - New value
     */
    addToHistory(path, oldValue, newValue) {
        const historyEntry = {
            timestamp: Date.now(),
            path: this.normalizePath(path),
            oldValue,
            newValue
        };

        this.history.unshift(historyEntry);
        this.limitHistorySize();
    }

    /**
     * Get state history
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} State history
     */
    getHistory(limit = 10) {
        return this.history.slice(0, limit);
    }

    /**
     * Clear state history
     */
    clearHistory() {
        this.history = [];
        this.logDebug('Cleared state history');
    }

    /**
     * Reset state to initial values
     * @param {Object} options - Reset options
     */
    reset(options = {}) {
        const initialState = this.getInitialState();

        if (options.preserveInstances) {
            initialState.instances = this.state.instances;
        }

        this.state = initialState;
        
        if (!options.silent) {
            this.notifyListeners('*', this.state, null); // Notify all listeners
        }

        this.logDebug('State reset');
    }

    /**
     * Get all state as a plain object
     * @returns {Object} State object
     */
    getStateSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Restore state from snapshot
     * @param {Object} snapshot - State snapshot
     * @param {Object} options - Restore options
     */
    restoreState(snapshot, _options = {}) {
        if (!_options.silent) {
            this.addToHistory('*', this.state, snapshot);
        }

        this.state = JSON.parse(JSON.stringify(snapshot));
        
        if (!_options.silent) {
            this.notifyListeners('*', this.state, null);
        }

        this.logDebug('State restored from snapshot');
    }

    /**
     * Get state statistics
     * @returns {Object} State statistics
     */
    getStats() {
        return {
            totalListeners: Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0),
            listenerPaths: Array.from(this.listeners.keys()),
            historySize: this.history.length,
            stateSize: JSON.stringify(this.state).length,
            instancesCount: this.state.instances.size
        };
    }

    /**
     * Enable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (this.debugMode) {
            console.log('[StateManager] Debug mode enabled');
        }
    }

    /**
     * Batch multiple state updates
     * @param {Array} updates - Array of {path, value} objects
     * @param {Object} options - Batch options
     */
    batchUpdate(updates, _options = {}) {
        this.logDebug(`Batch updating ${updates.length} state changes`);

        const oldValues = {};
        
        // Collect old values
        updates.forEach(update => {
            oldValues[update.path] = this.getNestedValue(this.state, update.path);
        });

        // Apply all updates
        updates.forEach(update => {
            this.setNestedValue(this.state, update.path, update.value);
        });

        // Notify listeners for all changes
        updates.forEach(update => {
            this.notifyListeners(update.path, update.value, oldValues[update.path]);
        });

        this.logDebug('Batch update completed');
    }

    /**
     * Validate view mode value
     * @param {string} mode - View mode to validate
     * @returns {boolean} True if mode is valid
     */
    isValidViewMode(mode) {
        return mode === 'visual' || mode === 'raw' || mode === 'log' || mode === 'traces' || mode === 'analysis';
    }

    /**
     * Get all valid view modes
     * @returns {Array<string>} Array of valid view mode values
     */
    getValidViewModes() {
        return ['visual', 'raw', 'log', 'traces', 'analysis'];
    }

    /**
     * Get trace cache for a section 
     * @param {string} sectionId - Section identifier
     * @param {number} stepNumber - Step number
     * @returns {Array|null} Cached traces or null
     */
    getTraceCache(sectionId, stepNumber) {
        const cacheKey = `${sectionId}-${stepNumber}`;
        return this.state.traceCache?.[cacheKey] || null;
    }

    /**
     * Set trace cache for a section 
     * @param {string} sectionId - Section identifier
     * @param {number} stepNumber - Step number
     * @param {Array} traces - Traces to cache
     */
    setTraceCache(sectionId, stepNumber, traces) {
        if (!this.state.traceCache) {
            this.state.traceCache = {};
        }
        const cacheKey = `${sectionId}-${stepNumber}`;
        this.state.traceCache[cacheKey] = traces;
        this.logDebug(`Cached traces for ${cacheKey}: ${traces?.length || 0} traces`);
    }

    /**
     * Clear trace cache for a section 
     * @param {string} sectionId - Section identifier (optional, clears all if not provided)
     * @param {number} stepNumber - Step number (optional)
     */
    clearTraceCache(sectionId = null, stepNumber = null) {
        if (!this.state.traceCache) {
            return;
        }

        if (sectionId && stepNumber !== null) {
            // Clear specific section-step cache
            const cacheKey = `${sectionId}-${stepNumber}`;
            delete this.state.traceCache[cacheKey];
            this.logDebug(`Cleared trace cache for ${cacheKey}`);
        } else if (sectionId) {
            // Clear all caches for a section
            Object.keys(this.state.traceCache).forEach(key => {
                if (key.startsWith(`${sectionId}-`)) {
                    delete this.state.traceCache[key];
                }
            });
            this.logDebug(`Cleared trace cache for section ${sectionId}`);
        } else {
            // Clear all trace caches
            this.state.traceCache = {};
            this.logDebug('Cleared all trace caches');
        }
    }

    /**
     * Register a path for localStorage persistence
     * @param {string|Array} path - Path to persist
     */
    registerPersistedPath(path) {
        const pathKey = this.normalizePath(path);
        this.persistedPaths.add(pathKey);
        this.logDebug(`Registered persisted path: ${pathKey}`);
    }

    /**
     * Unregister a path from localStorage persistence
     * @param {string|Array} path - Path to stop persisting
     */
    unregisterPersistedPath(path) {
        const pathKey = this.normalizePath(path);
        this.persistedPaths.delete(pathKey);
        this.logDebug(`Unregistered persisted path: ${pathKey}`);
    }

    /**
     * Check if a path should be persisted
     * @param {string} pathKey - Normalized path key
     * @returns {boolean} True if path should be persisted
     */
    isPersistedPath(pathKey) {
        // Check exact match
        if (this.persistedPaths.has(pathKey)) {
            return true;
        }
        
        // Check if any parent path is persisted
        const parentPaths = this.getParentPaths(pathKey);
        return parentPaths.some(parentPath => this.persistedPaths.has(parentPath));
    }

    /**
     * Get storage key for a path
     * @param {string} pathKey - Normalized path key
     * @returns {string} Storage key
     */
    getStorageKey(pathKey) {
        return `${this.storagePrefix}${pathKey.replace(/\./g, '-')}`;
    }

    /**
     * Persist state value to localStorage
     * @param {string} pathKey - Normalized path key
     * @param {*} value - Value to persist
     */
    persistToStorage(pathKey, value) {
        try {
            const storageKey = this.getStorageKey(pathKey);
            // Only persist primitive values and simple objects
            if (value === null || value === undefined) {
                localStorage.removeItem(storageKey);
            } else if (typeof value === 'object' && !(value instanceof Map)) {
                localStorage.setItem(storageKey, JSON.stringify(value));
            } else if (typeof value !== 'object') {
                localStorage.setItem(storageKey, String(value));
            }
            this.logDebug(`Persisted ${pathKey} to localStorage`);
        } catch (error) {
            console.warn(`[StateManager] Failed to persist ${pathKey} to localStorage:`, error);
        }
    }

    /**
     * Load persisted state from localStorage
     */
    loadPersistedState() {
        // Register paths that should be persisted
        this.registerPersistedPath('ui.darkMode');
        this.registerPersistedPath('ui.theme');
        this.registerPersistedPath('ui.scale');
        this.registerPersistedPath('viewModes');
        
        // Load each persisted path
        this.persistedPaths.forEach(pathKey => {
            try {
                const storageKey = this.getStorageKey(pathKey);
                const stored = localStorage.getItem(storageKey);
                
                if (stored !== null) {
                    let value;
                    // Try to parse as JSON first
                    try {
                        value = JSON.parse(stored);
                    } catch {
                        // If not JSON, try to parse as number or boolean
                        if (stored === 'true') {
                            value = true;
                        } else if (stored === 'false') {
                            value = false;
                        } else if (!isNaN(stored) && stored !== '') {
                            value = parseFloat(stored);
                        } else {
                            value = stored;
                        }
                    }
                    
                    // Set the value in state (silently to avoid triggering persistence again)
                    this.setNestedValue(this.state, pathKey, value);
                    this.logDebug(`Loaded persisted state: ${pathKey} =`, value);
                }
            } catch (error) {
                console.warn(`[StateManager] Failed to load persisted state for ${pathKey}:`, error);
            }
        });
    }

    /**
     * Clear persisted state from localStorage
     * @param {string|Array} path - Path to clear (optional, clears all if not provided)
     */
    clearPersistedState(path = null) {
        if (path) {
            const pathKey = this.normalizePath(path);
            const storageKey = this.getStorageKey(pathKey);
            try {
                localStorage.removeItem(storageKey);
                this.logDebug(`Cleared persisted state: ${pathKey}`);
            } catch (error) {
                console.warn(`[StateManager] Failed to clear persisted state for ${pathKey}:`, error);
            }
        } else {
            // Clear all persisted state
            this.persistedPaths.forEach(pathKey => {
                const storageKey = this.getStorageKey(pathKey);
                try {
                    localStorage.removeItem(storageKey);
                } catch (error) {
                    console.warn(`[StateManager] Failed to clear persisted state for ${pathKey}:`, error);
                }
            });
            this.logDebug('Cleared all persisted state');
        }
    }

    /**
     * Destroy the state manager
     */
    destroy() {
        this.listeners.clear();
        this.history = [];
        this.state = {};
        this.persistedPaths.clear();
        
        this.logDebug('Destroyed');
    }
}

// Export singleton instance
export const stateManager = new StateManager();
