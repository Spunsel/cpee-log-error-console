/**
 * Test Setup File
 * Global test configuration and utilities
 */

// Mock global browser APIs
global.console = {
    ...console,
    // Keep debug/info/warn/error for debugging but suppress in tests
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: console.error // Keep error for debugging
};

// Mock performance API
global.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 10000000
    }
};

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn()
}));

// Mock fetch API
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock URL and URLSearchParams
global.URL = class URL {
    constructor(url, base) {
        this.href = url;
        this.origin = 'http://localhost:8000';
        this.pathname = '/';
        this.search = '';
        this.searchParams = new URLSearchParams();
    }
    
    toString() {
        return this.href;
    }
};

global.URLSearchParams = class URLSearchParams {
    constructor(params = '') {
        this.params = new Map();
        if (typeof params === 'string') {
            this.parseString(params);
        }
    }
    
    parseString(str) {
        if (str.startsWith('?')) str = str.slice(1);
        str.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
        });
    }
    
    get(key) { return this.params.get(key); }
    set(key, value) { this.params.set(key, value); }
    has(key) { return this.params.has(key); }
    delete(key) { this.params.delete(key); }
    toString() {
        return Array.from(this.params.entries())
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
    }
};

// Mock DOM methods
global.document = {
    getElementById: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    createElement: vi.fn(() => ({
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn(),
            contains: vi.fn()
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        remove: vi.fn(),
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        style: {},
        dataset: {}
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
    }
};

// Mock window object
global.window = {
    location: {
        href: 'http://localhost:8000/',
        origin: 'http://localhost:8000',
        pathname: '/',
        search: '',
        hash: ''
    },
    history: {
        pushState: vi.fn(),
        replaceState: vi.fn()
    },
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
};

// Test utilities
export const TestUtils = {
    /**
     * Create a mock DOM element
     */
    createMockElement(id, options = {}) {
        return {
            id: id,
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn(),
                contains: vi.fn(() => false)
            },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            remove: vi.fn(),
            setAttribute: vi.fn(),
            getAttribute: vi.fn(),
            textContent: '',
            innerHTML: '',
            style: {},
            dataset: {},
            ...options
        };
    },

    /**
     * Mock fetch response
     */
    mockFetchResponse(data, options = {}) {
        return Promise.resolve({
            ok: options.ok !== false,
            status: options.status || 200,
            statusText: options.statusText || 'OK',
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
            ...options
        });
    },

    /**
     * Create test YAML content
     */
    createTestYAML() {
        return `---
event:
  cpee:lifecycle:transition: description/exposition
  cpee:change_uuid: test-uuid-1
  time:timestamp: 2024-01-01T10:00:00Z
  cpee:exposition: |
    <!-- Input CPEE-Tree -->
    <test>input</test>
---
event:
  cpee:lifecycle:transition: description/exposition
  cpee:change_uuid: test-uuid-1
  time:timestamp: 2024-01-01T10:00:01Z
  cpee:exposition: |
    %% Input Intermediate
    graph TD;
---`;
    },

    /**
     * Create test instance data
     */
    createTestInstance() {
        return {
            uuid: 'test-uuid-12345678-1234-1234-1234-123456789012',
            processNumber: 123,
            steps: [
                {
                    stepNumber: 1,
                    changeUuid: 'change-uuid-1',
                    timestamp: new Date('2024-01-01T10:00:00Z'),
                    content: {
                        inputCpeeTree: '<test>input</test>',
                        inputIntermediate: 'graph TD;',
                        userInput: 'Add task A',
                        outputIntermediate: 'graph TD; A --> B;',
                        outputCpeeTree: '<test>output</test>'
                    }
                }
            ]
        };
    },

    /**
     * Wait for async operations
     */
    async waitFor(condition, timeout = 1000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (condition()) return;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error('Timeout waiting for condition');
    }
};

// Make TestUtils globally available
global.TestUtils = TestUtils;
