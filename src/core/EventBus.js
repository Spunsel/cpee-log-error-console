/**
 * Event Bus
 * Centralized event system for loose coupling between components
 * Provides publish-subscribe pattern for component communication
 */

export class EventBus {
    constructor() {
        this.events = new Map();
        this.debugMode = false;
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
        if (listeners.length >= 100) {
            console.warn(`[EventBus] Maximum listeners (100) reached for event: ${event}`);
            return () => {};
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
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
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
