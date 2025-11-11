/**
 * Global Test Setup File for Node.js Test Runner
 * This file runs before all tests and sets up the testing environment
 * 
 * Optimized for WSL Windows Mount compatibility
 * Uses Node.js built-in test runner (Node 18+)
 */

import { JSDOM } from 'jsdom';

// Create JSDOM instance for DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'http://localhost:8000',
    pretendToBeVisual: true,
    resources: 'usable',
    runScripts: 'dangerously',
});

// Set up global window and document
global.window = dom.window;
global.document = dom.window.document;

// Navigator is read-only in Node.js, so we need to use Object.defineProperty
Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    writable: true,
    configurable: true,
});

global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;

// Mock global fetch API
global.fetch = async (url, options) => {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
        text: async () => '',
        blob: async () => new Blob(),
        arrayBuffer: async () => new ArrayBuffer(0),
        headers: new Headers(),
    };
};

// Note: window.location is provided by JSDOM and works fine
// We don't need to mock it unless specific tests require it
// Attempting to override it causes navigation errors in JSDOM

// Mock window.history
window.history = {
    pushState: () => {},
    replaceState: () => {},
    go: () => {},
    back: () => {},
    forward: () => {},
    length: 1,
    state: null,
};

// Enhanced localStorage mock with actual storage simulation
const localStorageStore = new Map();
global.localStorage = {
    store: localStorageStore,
    getItem: (key) => {
        const value = localStorageStore.get(String(key));
        return value !== undefined ? value : null;
    },
    setItem: (key, value) => {
        localStorageStore.set(String(key), String(value));
    },
    removeItem: (key) => {
        localStorageStore.delete(String(key));
    },
    clear: () => {
        localStorageStore.clear();
    },
    get length() {
        return localStorageStore.size;
    },
    key: (index) => {
        const keys = Array.from(localStorageStore.keys());
        return keys[index] || null;
    },
    reset: () => {
        localStorageStore.clear();
    },
};

// Enhanced sessionStorage mock
const sessionStorageStore = new Map();
global.sessionStorage = {
    store: sessionStorageStore,
    getItem: (key) => {
        const value = sessionStorageStore.get(String(key));
        return value !== undefined ? value : null;
    },
    setItem: (key, value) => {
        sessionStorageStore.set(String(key), String(value));
    },
    removeItem: (key) => {
        sessionStorageStore.delete(String(key));
    },
    clear: () => {
        sessionStorageStore.clear();
    },
    get length() {
        return sessionStorageStore.size;
    },
    key: (index) => {
        const keys = Array.from(sessionStorageStore.keys());
        return keys[index] || null;
    },
    reset: () => {
        sessionStorageStore.clear();
    },
};

// Mock navigator.clipboard (navigator is already set above)
if (global.navigator) {
    global.navigator.clipboard = {
        writeText: async () => {},
        readText: async () => '',
    };
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock MutationObserver
global.MutationObserver = class MutationObserver {
    constructor() {}
    observe() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
};

// Setup DOM environment
document.body.innerHTML = '';
document.head.innerHTML = '';

// Note: Node.js test runner doesn't have global afterEach
// Each test file should handle cleanup in its own afterEach hooks

// Global test utilities
global.createMockElement = (tagName = 'div', attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, value);
        }
    });
    return element;
};

global.createMockEvent = (type, options = {}) => {
    return new Event(type, {
        bubbles: options.bubbles !== false,
        cancelable: options.cancelable !== false,
        ...options,
    });
};

