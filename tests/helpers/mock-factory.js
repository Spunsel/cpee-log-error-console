/**
 * Mock Factory
 * Factory functions for creating common mocks
 */

import { vi } from 'vitest';

/**
 * Create a mock fetch function
 * @param {Object} responses - Map of URLs to responses
 * @returns {Function} Mock fetch function
 */
export function createMockFetch(responses = {}) {
    return vi.fn((url) => {
        const response = responses[url] || responses['*'] || {
            ok: true,
            status: 200,
            text: () => Promise.resolve(''),
            json: () => Promise.resolve({}),
        };
        
        return Promise.resolve({
            ok: response.ok !== false,
            status: response.status || 200,
            statusText: response.statusText || 'OK',
            headers: new Headers(response.headers || {}),
            text: () => Promise.resolve(
                typeof response.text === 'function' 
                    ? response.text() 
                    : (response.text || '')
            ),
            json: () => Promise.resolve(
                typeof response.json === 'function'
                    ? response.json()
                    : (response.json || {})
            ),
            blob: () => Promise.resolve(response.blob || new Blob()),
            arrayBuffer: () => Promise.resolve(response.arrayBuffer || new ArrayBuffer()),
        });
    });
}

/**
 * Create a mock localStorage
 * @returns {Object} Mock localStorage object
 */
export function createMockLocalStorage() {
    const store = {};
    
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => {
            store[key] = String(value);
        }),
        removeItem: vi.fn((key) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            Object.keys(store).forEach(key => delete store[key]);
        }),
        key: vi.fn((index) => Object.keys(store)[index] || null),
        get length() {
            return Object.keys(store).length;
        },
        _store: store, // Expose for testing
    };
}

/**
 * Create a mock sessionStorage
 * @returns {Object} Mock sessionStorage object
 */
export function createMockSessionStorage() {
    return createMockLocalStorage(); // Same implementation
}

/**
 * Create a mock event bus
 * @returns {Object} Mock event bus
 */
export function createMockEventBus() {
    const subscribers = new Map();
    
    return {
        subscribe: vi.fn((event, callback) => {
            if (!subscribers.has(event)) {
                subscribers.set(event, []);
            }
            subscribers.get(event).push(callback);
            
            return () => {
                const callbacks = subscribers.get(event);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            };
        }),
        publish: vi.fn((event, data) => {
            const callbacks = subscribers.get(event) || [];
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event subscriber for ${event}:`, error);
                }
            });
        }),
        unsubscribe: vi.fn(),
        _subscribers: subscribers, // Expose for testing
    };
}

/**
 * Create a mock state manager
 * @returns {Object} Mock state manager
 */
export function createMockStateManager() {
    const state = new Map();
    const subscribers = new Map();
    
    return {
        get: vi.fn((key, defaultValue) => {
            return state.has(key) ? state.get(key) : defaultValue;
        }),
        set: vi.fn((key, value) => {
            const oldValue = state.get(key);
            state.set(key, value);
            
            const callbacks = subscribers.get(key) || [];
            callbacks.forEach(callback => {
                try {
                    callback(value, oldValue);
                } catch (error) {
                    console.error(`Error in state subscriber for ${key}:`, error);
                }
            });
        }),
        subscribe: vi.fn((key, callback) => {
            if (!subscribers.has(key)) {
                subscribers.set(key, []);
            }
            subscribers.get(key).push(callback);
            
            return () => {
                const callbacks = subscribers.get(key);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            };
        }),
        clear: vi.fn(() => {
            state.clear();
            subscribers.clear();
        }),
        _state: state, // Expose for testing
        _subscribers: subscribers, // Expose for testing
    };
}

/**
 * Create a mock DOM registry
 * @returns {Object} Mock DOM registry
 */
export function createMockDOMRegistry() {
    const elements = new Map();
    
    return {
        get: vi.fn((id) => {
            return elements.get(id) || document.getElementById(id);
        }),
        register: vi.fn((id, element) => {
            elements.set(id, element);
            if (element && !element.id) {
                element.id = id;
            }
        }),
        has: vi.fn((id) => {
            return elements.has(id) || document.getElementById(id) !== null;
        }),
        clear: vi.fn(() => {
            elements.clear();
        }),
        _elements: elements, // Expose for testing
    };
}

/**
 * Create a mock service factory
 * @param {Object} services - Map of service names to service instances
 * @returns {Object} Mock service factory
 */
export function createMockServiceFactory(services = {}) {
    const serviceCache = new Map();
    
    return {
        get: vi.fn((serviceName) => {
            if (serviceCache.has(serviceName)) {
                return serviceCache.get(serviceName);
            }
            
            const service = services[serviceName];
            if (service) {
                serviceCache.set(serviceName, service);
                return service;
            }
            
            throw new Error(`Service ${serviceName} not found`);
        }),
        register: vi.fn((serviceName, service) => {
            serviceCache.set(serviceName, service);
        }),
        clear: vi.fn(() => {
            serviceCache.clear();
        }),
        _cache: serviceCache, // Expose for testing
    };
}

/**
 * Create a mock clipboard API
 * @returns {Object} Mock clipboard object
 */
export function createMockClipboard() {
    // Mock ClipboardItems if not available
    // eslint-disable-next-line no-undef
    const ClipboardItemsClass = typeof globalThis.ClipboardItems !== 'undefined' 
        ? globalThis.ClipboardItems 
        : class MockClipboardItems {
            constructor(items) {
                this.items = items || [];
            }
        };
    
    return {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
        write: vi.fn().mockResolvedValue(undefined),
        read: vi.fn().mockResolvedValue(new ClipboardItemsClass([])),
    };
}

