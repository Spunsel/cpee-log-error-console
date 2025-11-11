/**
 * Test Helper Utilities
 * Common utilities for writing tests
 */

import { vi } from 'vitest';
import { createMockEvent } from '../setup.js';
import {
    createMockDOMRegistry,
    createMockEventBus,
    createMockStateManager,
} from './mock-factory.js';

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

// Re-export createMockEvent from setup.js
export { createMockEvent };

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
 * @param {Object} dependencies - Dependencies to inject (overrides defaults)
 * @param {Array} additionalArgs - Additional constructor arguments in the correct order
 * @returns {Object} Component instance
 */
export function createMockComponent(ComponentClass, dependencies = {}, additionalArgs = []) {
    // Create default dependencies with explicit property access
    const domRegistry = dependencies.domRegistry ?? createMockDOMRegistry();
    const eventBus = dependencies.eventBus ?? createMockEventBus();
    const stateManager = dependencies.stateManager ?? createMockStateManager();
    
    // Pass dependencies explicitly in the correct order
    // This avoids relying on object key order which is fragile
    return new ComponentClass(
        domRegistry,
        eventBus,
        stateManager,
        ...additionalArgs
    );
}

// Re-export mock factory functions
export {
    createMockDOMRegistry,
    createMockEventBus,
    createMockStateManager,
};

