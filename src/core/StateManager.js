/**
 * State Manager
 * Centralized state management for the application
 * Provides single source of truth for application state
 */

export class StateManager {
    constructor() {
        this.state = {
            currentInstance: null,
            currentStep: null,
            currentStepIndex: 0,
            viewMode: 'visual',
            instances: new Map(),
            ui: {
                sidebarVisible: true,
                sidebarCollapsed: false,
                loading: false,
                activeView: 'home' // 'home', 'instance', 'log'
            },
            search: {
                active: false,
                term: '',
                caseSensitive: false,
                wholeWord: false
            },
            viewModes: {
                'input-cpee': 'visual',
                'input-intermediate': 'visual',
                'output-intermediate': 'visual',
                'output-cpee': 'visual'
            }
        };
        this.listeners = new Map();
        this.debugMode = false;
        this.history = [];
        this.maxHistorySize = 50;
    }

    /**
     * Get state value by path
     * @param {string|Array} path - Dot notation path or array of keys
     * @returns {*} State value
     */
    getState(path) {
        if (this.debugMode) {
            console.log(`[StateManager] Getting state: ${path}`);
        }
        return this.getNestedValue(this.state, path);
    }

    /**
     * Set state value by path
     * @param {string|Array} path - Dot notation path or array of keys
     * @param {*} value - Value to set
     * @param {Object} options - Additional options
     */
    setState(path, value, options = {}) {
        if (this.debugMode) {
            console.log(`[StateManager] Setting state: ${path} =`, value);
        }

        const oldValue = this.getNestedValue(this.state, path);
        
        // Add to history if not silent
        if (!options.silent) {
            this.addToHistory(path, oldValue, value);
        }

        this.setNestedValue(this.state, path, value);
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
        const pathKey = Array.isArray(path) ? path.join('.') : path;
        
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

        if (this.debugMode) {
            console.log(`[StateManager] Subscribed to: ${pathKey}`);
        }

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
                if (this.debugMode) {
                    console.log(`[StateManager] Unsubscribed from: ${pathKey}`);
                }
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
        const keys = Array.isArray(path) ? path : path.split('.');
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
        const keys = Array.isArray(path) ? path : path.split('.');
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
        const pathKey = Array.isArray(path) ? path.join('.') : path;
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
        toRemove.forEach(listener => {
            const pathListeners = this.listeners.get(pathKey) || [];
            const index = pathListeners.indexOf(listener);
            if (index > -1) {
                pathListeners.splice(index, 1);
            }
        });
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
            path: Array.isArray(path) ? path.join('.') : path,
            oldValue,
            newValue
        };

        this.history.unshift(historyEntry);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
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
        if (this.debugMode) {
            console.log('[StateManager] Cleared state history');
        }
    }

    /**
     * Reset state to initial values
     * @param {Object} options - Reset options
     */
    reset(options = {}) {
        const initialState = {
            currentInstance: null,
            currentStep: null,
            currentStepIndex: 0,
            viewMode: 'visual',
            instances: new Map(),
            ui: {
                sidebarVisible: true,
                sidebarCollapsed: false,
                loading: false,
                activeView: 'home'
            },
            search: {
                active: false,
                term: '',
                caseSensitive: false,
                wholeWord: false
            },
            viewModes: {
                'input-cpee': 'visual',
                'input-intermediate': 'visual',
                'output-intermediate': 'visual',
                'output-cpee': 'visual'
            }
        };

        if (options.preserveInstances) {
            initialState.instances = this.state.instances;
        }

        this.state = initialState;
        
        if (!options.silent) {
            this.notifyListeners('*', this.state, null); // Notify all listeners
        }

        if (this.debugMode) {
            console.log('[StateManager] State reset');
        }
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

        if (this.debugMode) {
            console.log('[StateManager] State restored from snapshot');
        }
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
        if (this.debugMode) {
            console.log(`[StateManager] Batch updating ${updates.length} state changes`);
        }

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

        if (this.debugMode) {
            console.log('[StateManager] Batch update completed');
        }
    }

    /**
     * Destroy the state manager
     */
    destroy() {
        this.listeners.clear();
        this.history = [];
        this.state = {};
        
        if (this.debugMode) {
            console.log('[StateManager] Destroyed');
        }
    }
}

// Export singleton instance
export const stateManager = new StateManager();
