/**
 * Test Helper Utilities for Node.js Test Runner
 * Common utilities for writing tests
 */

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function waitFor(ms = 0) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Wait for a condition to become true
 * @param {Function} condition - Function that returns true when condition is met
 * @param {Object} options - Options
 * @param {number} options.timeout - Maximum time to wait (default: 5000ms)
 * @param {number} options.interval - Check interval (default: 50ms)
 * @returns {Promise<void>}
 */
export async function waitForCondition(condition, options = {}) {
    const { timeout = 5000, interval = 50 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (condition()) {
            return;
        }
        await waitFor(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a mock service instance
 * @param {Object} methods - Methods to mock
 * @returns {Object} Mock service
 */
export function createMockService(methods = {}) {
    const mockService = {};
    
    Object.entries(methods).forEach(([key, value]) => {
        if (typeof value === 'function') {
            mockService[key] = value;
        } else {
            mockService[key] = value;
        }
    });
    
    return mockService;
}

/**
 * Create a minimal component instance for testing
 * @param {Object} props - Component properties
 * @returns {Object} Mock component
 */
export function createMockComponent(props = {}) {
    return {
        init: () => {},
        destroy: () => {},
        update: () => {},
        render: () => {},
        ...props,
    };
}

/**
 * Create a promise that can be resolved/rejected externally
 * @returns {Object} Promise with resolve/reject methods
 */
export function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    
    return { promise, resolve, reject };
}

/**
 * Create a mock event with custom properties
 * @param {string} type - Event type
 * @param {Object} options - Event options
 * @returns {Event} Mock event
 */
export function createMockEvent(type, options = {}) {
    return new Event(type, {
        bubbles: options.bubbles !== false,
        cancelable: options.cancelable !== false,
        ...options,
    });
}

/**
 * Flush all pending promises
 * Useful for testing async code
 * @returns {Promise<void>}
 */
export function flushPromises() {
    return new Promise((resolve) => {
        setImmediate(resolve);
    });
}

/**
 * Create a spy that tracks all calls
 * @param {Function} fn - Function to spy on (optional)
 * @returns {Function} Spy function
 */
export function createSpy(fn = null) {
    const calls = [];
    const spy = function(...args) {
        calls.push(args);
        if (fn) {
            return fn(...args);
        }
    };
    
    spy.calls = calls;
    spy.callCount = calls.length;
    spy.called = calls.length > 0;
    spy.calledWith = (...args) => {
        return calls.some(call => {
            return args.every((arg, i) => call[i] === arg);
        });
    };
    spy.reset = () => {
        calls.length = 0;
    };
    
    return spy;
}

/**
 * Mock console methods to prevent test output pollution
 * @returns {Object} Object with restore function
 */
export function mockConsole() {
    const originalConsole = { ...console };
    const calls = {
        log: [],
        warn: [],
        error: [],
        info: [],
        debug: [],
    };
    
    const mocks = {
        log: (...args) => { calls.log.push(args); },
        warn: (...args) => { calls.warn.push(args); },
        error: (...args) => { calls.error.push(args); },
        info: (...args) => { calls.info.push(args); },
        debug: (...args) => { calls.debug.push(args); },
    };
    
    Object.assign(console, mocks);
    
    return {
        ...mocks,
        calls,
        restore: () => {
            Object.assign(console, originalConsole);
        },
    };
}

/**
 * Create a timer mock for testing time-dependent code
 * @returns {Object} Timer mock with control methods
 */
export function createTimerMock() {
    let now = 0;
    const timers = new Map();
    let timerId = 0;
    
    const mock = {
        now: () => now,
        advance: (ms) => {
            now += ms;
            // Trigger any timers that should fire
            timers.forEach((timer, id) => {
                if (timer.scheduled <= now && !timer.fired) {
                    timer.fired = true;
                    timer.callback();
                    timers.delete(id);
                }
            });
        },
        setTimeout: (callback, delay) => {
            const id = timerId++;
            timers.set(id, {
                callback,
                scheduled: now + delay,
                fired: false,
            });
            return id;
        },
        clearTimeout: (id) => {
            timers.delete(id);
        },
        setInterval: (callback, delay) => {
            const id = timerId++;
            timers.set(id, {
                callback,
                scheduled: now + delay,
                fired: false,
                interval: delay,
            });
            return id;
        },
        clearInterval: (id) => {
            timers.delete(id);
        },
    };
    
    return mock;
}

