/**
 * Mock Factory for Node.js Test Runner
 * Factory functions for creating common mocks
 */

/**
 * Create a mock fetch response
 * @param {Object} options - Response options
 * @param {*} options.body - Response body
 * @param {number} options.status - HTTP status code
 * @param {Object} options.headers - Response headers
 * @returns {Response} Mock response
 */
export function createMockFetchResponse(options = {}) {
    const {
        body = {},
        status = 200,
        headers = {},
        ok = status >= 200 && status < 300,
    } = options;
    
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        headers: new Headers(headers),
        json: async () => body,
        text: async () => typeof body === 'string' ? body : JSON.stringify(body),
        blob: async () => new Blob([JSON.stringify(body)]),
        arrayBuffer: async () => new ArrayBuffer(0),
        clone: function() { return this; },
    };
}

/**
 * Create a mock fetch function
 * @param {Object} options - Mock options
 * @param {Function} options.handler - Custom handler function
 * @returns {Function} Mock fetch function
 */
export function createMockFetch(options = {}) {
    const { handler } = options;
    
    if (handler) {
        return handler;
    }
    
    return async () => createMockFetchResponse();
}

/**
 * Create a mock localStorage with actual storage
 * @returns {Object} Mock localStorage
 */
export function createMockLocalStorage() {
    const store = new Map();
    
    return {
        store,
    getItem: (key) => {
        const value = store.get(String(key));
        return value !== undefined ? value : null;
    },
    setItem: (key, value) => {
        store.set(String(key), String(value));
    },
    removeItem: (key) => {
        store.delete(String(key));
    },
    clear: () => {
        store.clear();
    },
    key: (index) => {
        const keys = Array.from(store.keys());
        return keys[index] || null;
    },
        get length() {
            return store.size;
        },
        reset: () => {
            store.clear();
        },
    };
}

/**
 * Create a mock EventBus
 * @returns {Object} Mock EventBus
 */
export function createMockEventBus() {
    const listeners = new Map();
    
    return {
        listeners,
        subscribe: (event, callback) => {
            if (!listeners.has(event)) {
                listeners.set(event, []);
            }
            listeners.get(event).push(callback);
            
            // Return unsubscribe function
            return () => {
                const callbacks = listeners.get(event);
                if (callbacks) {
                    const index = callbacks.indexOf(callback);
                    if (index > -1) {
                        callbacks.splice(index, 1);
                    }
                }
            };
        },
        publish: (event, data) => {
            const callbacks = listeners.get(event) || [];
            callbacks.forEach((callback) => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        },
        unsubscribe: (event, callback) => {
            const callbacks = listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        },
        clear: () => {
            listeners.clear();
        },
    };
}

/**
 * Create a mock StateManager
 * @returns {Object} Mock StateManager
 */
export function createMockStateManager() {
    const state = {};
    const listeners = new Map();
    
    return {
        state,
        listeners,
        getState: (path) => {
            const keys = path.split('.');
            let current = state;
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return undefined;
                }
            }
            return current;
        },
        setState: (path, value) => {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let current = state;
            
            for (const key of keys) {
                if (!(key in current) || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            
            current[lastKey] = value;
            
            // Notify listeners
            const pathKey = path;
            const callbacks = listeners.get(pathKey) || [];
            callbacks.forEach((callback) => {
                try {
                    callback(value);
                } catch (error) {
                    console.error(`Error in state listener for ${pathKey}:`, error);
                }
            });
        },
        subscribe: (path, callback) => {
            if (!listeners.has(path)) {
                listeners.set(path, []);
            }
            listeners.get(path).push(callback);
            
            return () => {
                const callbacks = listeners.get(path);
                if (callbacks) {
                    const index = callbacks.indexOf(callback);
                    if (index > -1) {
                        callbacks.splice(index, 1);
                    }
                }
            };
        },
        reset: () => {
            Object.keys(state).forEach((key) => {
                delete state[key];
            });
        },
    };
}

/**
 * Create a mock DOMRegistry
 * @returns {Object} Mock DOMRegistry
 */
export function createMockDOMRegistry() {
    const registry = new Map();
    
    return {
        registry,
        register: (key, element) => {
            registry.set(key, element);
        },
        get: (key) => {
            return registry.get(key) || null;
        },
        has: (key) => {
            return registry.has(key);
        },
        clear: () => {
            registry.clear();
        },
    };
}

/**
 * Create a mock ServiceFactory
 * @param {Object} services - Pre-registered services
 * @returns {Object} Mock ServiceFactory
 */
export function createMockServiceFactory(services = {}) {
    const serviceCache = new Map(Object.entries(services));
    
    return {
        serviceCache,
        create: (serviceName, ...args) => {
            if (serviceCache.has(serviceName)) {
                return serviceCache.get(serviceName);
            }
            
            // Create a mock service if not found
            const mockService = {
                name: serviceName,
                init: () => {},
                destroy: () => {},
            };
            
            serviceCache.set(serviceName, mockService);
            return mockService;
        },
        register: (serviceName, service) => {
            serviceCache.set(serviceName, service);
        },
        get: (serviceName) => {
            return serviceCache.get(serviceName) || null;
        },
        clear: () => {
            serviceCache.clear();
        },
    };
}

