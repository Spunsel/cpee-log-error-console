/**
 * Mock Helpers for Node.js Test Runner
 * Provides utilities for creating mocks and spies
 */

/**
 * Create a spy function that tracks calls
 * @param {Function} fn - Optional function to wrap
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
 * Create a mock function
 * @param {*} returnValue - Value to return
 * @returns {Function} Mock function
 */
export function createMockFn(returnValue = undefined) {
    return createSpy(() => returnValue);
}

/**
 * Create a deferred promise (for async testing)
 * @returns {Object} Object with promise, resolve, and reject
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
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for a specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function waitFor(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

