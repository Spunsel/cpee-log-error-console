/**
 * State Management System
 * Centralized application state with event-driven updates
 */

export class StateManager {
    constructor() {
        this.state = {
            app: {
                isLoading: false,
                currentView: 'default', // 'default', 'instance', 'rawlog'
                error: null
            },
            instances: {
                loaded: new Map(),
                current: null,
                currentStep: 0
            },
            ui: {
                sidebarVisible: true,
                rawLogVisible: false,
                theme: 'default'
            }
        };

        this.listeners = new Map();
        this.history = [];
        this.maxHistory = 50;
    }

    /**
     * Get current state or specific part
     */
    getState(path = null) {
        if (!path) return { ...this.state };
        
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    /**
     * Update state and notify listeners
     */
    setState(path, value) {
        const previousState = { ...this.state };
        
        // Update state
        this.setNestedProperty(this.state, path, value);
        
        // Add to history
        this.addToHistory(path, value, previousState);
        
        // Notify listeners
        this.notifyListeners(path, value, previousState);
        
        // Update URL if needed
        this.updateURLIfNeeded(path, value);
    }

    /**
     * Subscribe to state changes
     */
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, []);
        }
        
        this.listeners.get(path).push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(path);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Batch multiple state updates
     */
    batchUpdate(updates) {
        const previousState = { ...this.state };
        
        updates.forEach(({ path, value }) => {
            this.setNestedProperty(this.state, path, value);
        });
        
        // Notify all affected listeners
        updates.forEach(({ path, value }) => {
            this.notifyListeners(path, value, previousState);
        });
    }

    /**
     * Reset to default state
     */
    reset() {
        const defaultState = {
            app: { isLoading: false, currentView: 'default', error: null },
            instances: { loaded: new Map(), current: null, currentStep: 0 },
            ui: { sidebarVisible: true, rawLogVisible: false, theme: 'default' }
        };
        
        this.state = defaultState;
        this.notifyListeners('*', this.state, {});
    }

    /**
     * Get state history for debugging
     */
    getHistory() {
        return [...this.history];
    }

    // Private methods
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }

    notifyListeners(path, value, previousState) {
        // Notify exact path listeners
        const exactListeners = this.listeners.get(path) || [];
        exactListeners.forEach(callback => {
            callback(value, previousState, path);
        });

        // Notify wildcard listeners
        const wildcardListeners = this.listeners.get('*') || [];
        wildcardListeners.forEach(callback => {
            callback(this.state, previousState, path);
        });

        // Notify parent path listeners
        const pathParts = path.split('.');
        for (let i = 1; i < pathParts.length; i++) {
            const parentPath = pathParts.slice(0, -i).join('.');
            const parentListeners = this.listeners.get(parentPath) || [];
            parentListeners.forEach(callback => {
                callback(this.getState(parentPath), previousState, path);
            });
        }
    }

    addToHistory(path, value, previousState) {
        this.history.push({
            timestamp: new Date(),
            path,
            value,
            previousValue: this.getNestedProperty(previousState, path)
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    updateURLIfNeeded(path, value) {
        // Update URL for certain state changes
        if (path === 'instances.current' || path === 'instances.currentStep') {
            const current = this.getState('instances.current');
            const step = this.getState('instances.currentStep');
            
            if (current && step) {
                const url = new URL(window.location);
                url.searchParams.set('uuid', current);
                url.searchParams.set('step', step + 1);
                window.history.pushState(null, '', url);
            }
        }
    }
}
