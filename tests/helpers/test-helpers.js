/**
 * Test Helper Utilities
 * Common utilities for writing tests
 */

import { vi } from 'vitest';

/**
 * Create a mock DOM structure for testing
 * @param {string} html - HTML string to create
 * @returns {DocumentFragment} Document fragment with the created elements
 */
export function createMockDOM(html = '') {
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');
    container.innerHTML = html;
    
    while (container.firstChild) {
        fragment.appendChild(container.firstChild);
    }
    
    return fragment;
}

/**
 * Create a mock event
 * @param {string} type - Event type (e.g., 'click', 'input', 'change')
 * @param {Object} options - Event options
 * @returns {Event} Mock event object
 */
export function createMockEvent(type, options = {}) {
    return new Event(type, {
        bubbles: options.bubbles !== false,
        cancelable: options.cancelable !== false,
        ...options,
    });
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns a boolean
 * @param {number} timeout - Maximum time to wait in ms
 * @param {number} interval - Check interval in ms
 * @returns {Promise<void>}
 */
export function waitFor(condition, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime >= timeout) {
                reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
            } else {
                setTimeout(check, interval);
            }
        };
        
        check();
    });
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, timeout = 5000) {
    return waitFor(
        () => document.querySelector(selector) !== null,
        timeout
    ).then(() => document.querySelector(selector));
}

/**
 * Create a mock service instance
 * @param {Object} methods - Methods to mock
 * @returns {Object} Mock service object
 */
export function createMockService(methods = {}) {
    const mockService = {};
    
    Object.entries(methods).forEach(([methodName, implementation]) => {
        if (typeof implementation === 'function') {
            mockService[methodName] = implementation;
        } else {
            mockService[methodName] = vi.fn().mockReturnValue(implementation);
        }
    });
    
    return mockService;
}

/**
 * Create a minimal component instance for testing
 * @param {Function} ComponentClass - Component class constructor
 * @param {Object} dependencies - Dependencies to inject
 * @returns {Object} Component instance
 */
export function createMockComponent(ComponentClass, dependencies = {}) {
    const defaultDeps = {
        domRegistry: createMockDOMRegistry(),
        eventBus: createMockEventBus(),
        stateManager: createMockStateManager(),
        ...dependencies,
    };
    
    return new ComponentClass(...Object.values(defaultDeps));
}

/**
 * Create a mock DOM registry
 * @returns {Object} Mock DOM registry
 */
export function createMockDOMRegistry() {
    const elements = new Map();
    
    return {
        get: vi.fn((id) => elements.get(id) || document.getElementById(id)),
        register: vi.fn((id, element) => {
            elements.set(id, element);
        }),
        has: vi.fn((id) => elements.has(id) || document.getElementById(id) !== null),
        clear: vi.fn(() => elements.clear()),
    };
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
            
            // Return unsubscribe function
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
            callbacks.forEach(callback => callback(data));
        }),
        unsubscribe: vi.fn(),
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
            state.set(key, value);
            const callbacks = subscribers.get(key) || [];
            callbacks.forEach(callback => callback(value));
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
    };
}

