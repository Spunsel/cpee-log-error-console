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
                theme: 'presetaltid', // CPEE theme preference (persisted) - shows alt_id in labels
                scale: 1.0 // Graph scale preference (persisted)
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
            traceCache: {} // Structure: { 'sectionId-stepNumber': Trace[] }
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
     * @param {boolean} options.silent - Don't notify listeners
     * @param {boolean} options.persist - Persist to localStorage (default: auto-detect based on persistedPaths)
     */
    setState(path, value, options = {}) {
        this.logDebug(`Setting state: ${path} =`, value);

        const oldValue = this.getNestedValue(this.state, path);

        this.setNestedValue(this.state, path, value);
        
        // Persist to localStorage if this path is marked for persistence
        const pathKey = this.normalizePath(path);
        const shouldPersist = options.persist !== undefined 
            ? options.persist 
            : this.persistedPaths.has(pathKey) || this.isPersistedPath(pathKey);
        
        if (shouldPersist) {
            this.persistToStorage(pathKey, value);
        }
        
        if (!options.silent) {
            this.notifyListeners(path, value, oldValue);
        }
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
     * Register a path for localStorage persistence
     * @param {string|Array} path - Path to persist
     */
    registerPersistedPath(path) {
        const pathKey = this.normalizePath(path);
        this.persistedPaths.add(pathKey);
        this.logDebug(`Registered persisted path: ${pathKey}`);
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

}

// Export singleton instance
export const stateManager = new StateManager();
