/**
 * Event Bus
 * Centralized event system for loose coupling between components
 * Provides publish-subscribe pattern for component communication
 */

export class EventBus {
    constructor() {
        this.events = new Map();
        this.debugMode = false;
        this.maxListeners = 100; // Prevent memory leaks
    }

    /**
     * Emit an event to all registered listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {Object} options - Additional options
     * @param {boolean} options.silent - If true, suppress warning when no listeners (default: false)
     */
    emit(event, data = null, options = {}) {
        const listeners = this.events.get(event) || [];
        
        if (listeners.length === 0) {
            if (this.debugMode && !options.silent) {
                console.warn(`[EventBus] No listeners for event: ${event}`);
            }
            return;
        }

        // Execute listeners with error handling
        const toRemove = [];
        listeners.forEach((listener, index) => {
            try {
                listener.handler(data, options);
                
                // Mark one-time listeners for removal
                if (listener.once) {
                    toRemove.push(listener.handler);
                }
            } catch (error) {
                console.error(`[EventBus] Error in listener for event '${event}' (index ${index}):`, error);
            }
        });
        
        // Remove one-time listeners after iteration
        toRemove.forEach(handler => this.off(event, handler));
    }

    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {Object} options - Listener options
     * @returns {Function} Unsubscribe function
     */
    on(event, handler, options = {}) {
        if (!event || typeof event !== 'string') {
            throw new Error('EventBus: Event name must be a non-empty string');
        }

        if (typeof handler !== 'function') {
            throw new Error('EventBus: Handler must be a function');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);
        
        // Check for listener limit
        if (listeners.length >= this.maxListeners) {
            console.warn(`[EventBus] Maximum listeners (${this.maxListeners}) reached for event: ${event}`);
            return () => {}; // Return empty unsubscribe function
        }

        // Add listener with metadata
        const listener = {
            handler,
            once: options.once || false,
            priority: options.priority || 0,
            id: options.id || null
        };

        listeners.push(listener);
        
        // Sort by priority (higher priority first)
        listeners.sort((a, b) => b.priority - a.priority);

        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    /**
     * Register a one-time event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {Object} options - Listener options
     * @returns {Function} Unsubscribe function
     */
    once(event, handler, options = {}) {
        return this.on(event, handler, { ...options, once: true });
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function to remove
     */
    off(event, handler) {
        if (!this.events.has(event)) {
            return;
        }

        const listeners = this.events.get(event);
        const index = listeners.findIndex(listener => listener.handler === handler);
        
        if (index > -1) {
            listeners.splice(index, 1);

            // Clean up empty event arrays
            if (listeners.length === 0) {
                this.events.delete(event);
            }
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get all registered events
     * @returns {Array<string>} Array of event names
     */
    getEvents() {
        return Array.from(this.events.keys());
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    getListenerCount(event) {
        return this.events.get(event)?.length || 0;
    }

    /**
     * Check if an event has listeners
     * @param {string} event - Event name
     * @returns {boolean} True if event has listeners
     */
    hasListeners(event) {
        return this.getListenerCount(event) > 0;
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Set maximum number of listeners per event
     * @param {number} max - Maximum number of listeners
     */
    setMaxListeners(max) {
        if (typeof max !== 'number' || max < 1) {
            throw new Error('EventBus: Max listeners must be a positive number');
        }
        this.maxListeners = max;
    }

    /**
     * Get event statistics
     * @returns {Object} Event statistics
     */
    getStats() {
        const stats = {
            totalEvents: this.events.size,
            totalListeners: 0,
            events: {}
        };

        this.events.forEach((listeners, event) => {
            stats.totalListeners += listeners.length;
            stats.events[event] = {
                listenerCount: listeners.length,
                priorities: listeners.map(l => l.priority),
                onceListeners: listeners.filter(l => l.once).length
            };
        });

        return stats;
    }

    /**
     * Emit event asynchronously
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {Object} options - Additional options
     * @returns {Promise} Promise that resolves when all listeners complete
     */
    async emitAsync(event, data = null, options = {}) {
        const listeners = this.events.get(event) || [];
        
        if (listeners.length === 0) {
            if (this.debugMode) {
                console.warn(`[EventBus] No listeners for async event: ${event}`);
            }
            return;
        }

        // Execute listeners asynchronously
        const toRemove = [];
        const promises = listeners.map(async (listener, index) => {
            try {
                const result = await listener.handler(data, options);
                
                // Mark one-time listeners for removal
                if (listener.once) {
                    toRemove.push(listener.handler);
                }
                
                return { success: true, result, index };
            } catch (error) {
                console.error(`[EventBus] Error in async listener for event '${event}' (index ${index}):`, error);
                return { success: false, error, index };
            }
        });

        const results = await Promise.allSettled(promises);
        
        // Remove one-time listeners after execution
        toRemove.forEach(handler => this.off(event, handler));

        return results;
    }

    /**
     * Create a scoped event bus for a specific component
     * @param {string} scope - Scope identifier
     * @returns {Object} Scoped event bus methods
     */
    createScope(scope) {
        const scopedEvent = (event) => `${scope}:${event}`;
        
        return {
            emit: (event, data, options) => this.emit(scopedEvent(event), data, options),
            on: (event, handler, options) => this.on(scopedEvent(event), handler, options),
            once: (event, handler, options) => this.once(scopedEvent(event), handler, options),
            off: (event, handler) => this.off(scopedEvent(event), handler),
            removeAllListeners: (event) => this.removeAllListeners(scopedEvent(event)),
            hasListeners: (event) => this.hasListeners(scopedEvent(event)),
            getListenerCount: (event) => this.getListenerCount(scopedEvent(event))
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.events.clear();
    }
}

// Create singleton instance
export const eventBus = new EventBus();

// Enable debug mode in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    eventBus.setDebugMode(true);
}

// Export for backward compatibility
export default eventBus;
