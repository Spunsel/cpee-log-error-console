/**
 * Global Test Setup File
 * This file runs before all tests and sets up the testing environment
 */

import { afterEach, vi } from 'vitest';

// Mock global fetch API
global.fetch = vi.fn();

// Mock window.location
delete window.location;
window.location = {
    href: 'http://localhost:8000',
    origin: 'http://localhost:8000',
    protocol: 'http:',
    host: 'localhost:8000',
    hostname: 'localhost',
    port: '8000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
};

// Mock window.history
window.history = {
    pushState: vi.fn(),
    replaceState: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    length: 1,
    state: null,
};

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
};
global.sessionStorage = sessionStorageMock;

// Mock navigator.clipboard
global.navigator.clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
};

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn().mockReturnValue([]),
}));

// Setup DOM environment
document.body.innerHTML = '';
document.head.innerHTML = '';

// Cleanup after each test
afterEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // Reset localStorage mocks
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    
    // Reset sessionStorage mocks
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    sessionStorageMock.clear.mockClear();
    
    // Reset fetch mock
    global.fetch.mockClear();
});

// Global test utilities
global.createMockElement = (tagName = 'div', attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    return element;
};

global.createMockEvent = (type, options = {}) => new Event(type, {
    bubbles: options.bubbles !== false,
    cancelable: options.cancelable !== false,
    ...options,
});

