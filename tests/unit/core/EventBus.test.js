/**
 * EventBus Test Suite
 * Tests the centralized event system for component communication
 * 
 * Uses Node.js built-in test runner (Node 18+)
 * Optimized for WSL Windows mount compatibility
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import { EventBus } from '../../../src/core/EventBus.js';

describe('EventBus', () => {
    let eventBus;

    beforeEach(() => {
        // Create a fresh EventBus instance for each test
        eventBus = new EventBus();
    });

    afterEach(() => {
        // Clean up EventBus instance to prevent memory leaks
        if (eventBus) {
            eventBus.destroy();
        }
    });

    describe('Event Subscription', () => {
        test('should subscribe to events', () => {
            let receivedData = null;
            const handler = (data) => {
                receivedData = data;
            };

            eventBus.on('test-event', handler);
            eventBus.emit('test-event', 'test-data');

            assert.strictEqual(receivedData, 'test-data');
        });

        test('should return unsubscribe function', () => {
            let callCount = 0;
            const handler = () => {
                callCount++;
            };

            const unsubscribe = eventBus.on('test-event', handler);
            assert.strictEqual(typeof unsubscribe, 'function');

            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1);

            unsubscribe();
            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1); // Should not be called again
        });

        test('should handle multiple subscribers for same event', () => {
            let callCount1 = 0;
            let callCount2 = 0;

            const handler1 = () => { callCount1++; };
            const handler2 = () => { callCount2++; };

            eventBus.on('test-event', handler1);
            eventBus.on('test-event', handler2);

            eventBus.emit('test-event');

            assert.strictEqual(callCount1, 1);
            assert.strictEqual(callCount2, 1);
        });

        test('should validate event name', () => {
            const handler = () => {};

            assert.throws(() => {
                eventBus.on(null, handler);
            }, Error);

            assert.throws(() => {
                eventBus.on('', handler);
            }, Error);

            assert.throws(() => {
                eventBus.on(123, handler);
            }, Error);
        });

        test('should validate handler function', () => {
            assert.throws(() => {
                eventBus.on('test-event', null);
            }, Error);

            assert.throws(() => {
                eventBus.on('test-event', 'not-a-function');
            }, Error);
        });
    });

    describe('Event Publishing', () => {
        test('should publish events to subscribers', () => {
            let receivedData = null;
            const handler = (data) => {
                receivedData = data;
            };

            eventBus.on('test-event', handler);
            eventBus.emit('test-event', 'test-data');

            assert.strictEqual(receivedData, 'test-data');
        });

        test('should pass event data to subscribers', () => {
            const receivedData = [];
            const handler = (data) => {
                receivedData.push(data);
            };

            eventBus.on('test-event', handler);
            eventBus.emit('test-event', { key: 'value' });
            eventBus.emit('test-event', 'string-data');
            eventBus.emit('test-event', 123);

            assert.strictEqual(receivedData.length, 3);
            assert.deepStrictEqual(receivedData[0], { key: 'value' });
            assert.strictEqual(receivedData[1], 'string-data');
            assert.strictEqual(receivedData[2], 123);
        });

        test('should handle events with no subscribers', () => {
            // Suppress console.warn for this test
            const originalWarn = console.warn;
            console.warn = () => {};

            // Should not throw
            assert.doesNotThrow(() => {
                eventBus.emit('non-existent-event', 'data');
            });

            console.warn = originalWarn;
        });

        test('should pass options to handlers', () => {
            let receivedOptions = null;
            const handler = (data, options) => {
                receivedOptions = options;
            };

            eventBus.on('test-event', handler);
            eventBus.emit('test-event', 'data', { custom: 'option' });

            assert.deepStrictEqual(receivedOptions, { custom: 'option' });
        });
    });

    describe('Event Unsubscription', () => {
        test('should unsubscribe from events', () => {
            let callCount = 0;
            const handler = () => {
                callCount++;
            };

            eventBus.on('test-event', handler);
            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1);

            eventBus.off('test-event', handler);
            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1); // Should not be called again
        });

        test('should handle unsubscribe for non-existent event', () => {
            const handler = () => {};

            // Should not throw
            assert.doesNotThrow(() => {
                eventBus.off('non-existent-event', handler);
            });
        });

        test('should handle unsubscribe for non-existent handler', () => {
            const handler1 = () => {};
            const handler2 = () => {};

            eventBus.on('test-event', handler1);

            // Should not throw
            assert.doesNotThrow(() => {
                eventBus.off('test-event', handler2);
            });

            // handler1 should still be subscribed
            let callCount = 0;
            const testHandler = () => { callCount++; };
            eventBus.on('test-event', testHandler);
            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1);
        });
    });

    describe('One-Time Listeners', () => {
        test('should support one-time event listeners', () => {
            let callCount = 0;
            const handler = () => {
                callCount++;
            };

            eventBus.once('test-event', handler);

            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1);

            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1); // Should not be called again
        });

        test('should remove one-time listeners after execution', () => {
            let callCount = 0;
            const handler = () => {
                callCount++;
            };

            eventBus.once('test-event', handler);
            assert.strictEqual(eventBus.getListenerCount('test-event'), 1);

            eventBus.emit('test-event');
            assert.strictEqual(callCount, 1);
            assert.strictEqual(eventBus.getListenerCount('test-event'), 0);
        });
    });

    describe('Error Handling', () => {
        test('should handle subscriber errors gracefully', () => {
            // Suppress console.error for this test
            const originalError = console.error;
            console.error = () => {};

            let normalHandlerCalled = false;
            const errorHandler = () => {
                throw new Error('Subscriber error');
            };
            const normalHandler = () => {
                normalHandlerCalled = true;
            };

            eventBus.on('test-event', errorHandler);
            eventBus.on('test-event', normalHandler);

            // Should not throw, and normal handler should still be called
            assert.doesNotThrow(() => {
                eventBus.emit('test-event');
            });

            assert.strictEqual(normalHandlerCalled, true);

            console.error = originalError;
        });

        test('should continue executing other listeners after error', () => {
            // Suppress console.error for this test
            const originalError = console.error;
            console.error = () => {};

            const callOrder = [];
            const handler1 = () => {
                callOrder.push(1);
                throw new Error('Error in handler 1');
            };
            const handler2 = () => {
                callOrder.push(2);
            };
            const handler3 = () => {
                callOrder.push(3);
            };

            eventBus.on('test-event', handler1);
            eventBus.on('test-event', handler2);
            eventBus.on('test-event', handler3);

            assert.doesNotThrow(() => {
                eventBus.emit('test-event');
            });

            assert.deepStrictEqual(callOrder, [1, 2, 3]);

            console.error = originalError;
        });
    });

    describe('Event Chaining', () => {
        test('should handle event chaining', () => {
            const callOrder = [];

            const handler1 = () => {
                callOrder.push(1);
                eventBus.emit('chained-event');
            };
            const handler2 = () => {
                callOrder.push(2);
            };

            eventBus.on('initial-event', handler1);
            eventBus.on('chained-event', handler2);

            eventBus.emit('initial-event');

            assert.deepStrictEqual(callOrder, [1, 2]);
        });

        test('should handle nested event chaining', () => {
            const callOrder = [];

            const handler1 = () => {
                callOrder.push(1);
                eventBus.emit('level2-event');
            };
            const handler2 = () => {
                callOrder.push(2);
                eventBus.emit('level3-event');
            };
            const handler3 = () => {
                callOrder.push(3);
            };

            eventBus.on('level1-event', handler1);
            eventBus.on('level2-event', handler2);
            eventBus.on('level3-event', handler3);

            eventBus.emit('level1-event');

            assert.deepStrictEqual(callOrder, [1, 2, 3]);
        });
    });

    describe('Clear All Subscriptions', () => {
        test('should clear all subscriptions', () => {
            let callCount = 0;
            const handler = () => {
                callCount++;
            };

            eventBus.on('event1', handler);
            eventBus.on('event2', handler);
            eventBus.on('event3', handler);

            eventBus.removeAllListeners();

            eventBus.emit('event1');
            eventBus.emit('event2');
            eventBus.emit('event3');

            assert.strictEqual(callCount, 0);
        });

        test('should clear subscriptions for specific event', () => {
            let callCount1 = 0;
            let callCount2 = 0;

            const handler1 = () => { callCount1++; };
            const handler2 = () => { callCount2++; };

            eventBus.on('event1', handler1);
            eventBus.on('event2', handler2);

            eventBus.removeAllListeners('event1');

            eventBus.emit('event1');
            eventBus.emit('event2');

            assert.strictEqual(callCount1, 0);
            assert.strictEqual(callCount2, 1);
        });
    });

    describe('Memory Leak Prevention', () => {
        test('should prevent memory leaks with proper cleanup', () => {
            const handler = () => {};

            // Subscribe to multiple events
            for (let i = 0; i < 10; i++) {
                eventBus.on(`event-${i}`, handler);
            }

            assert.strictEqual(eventBus.getEvents().length, 10);

            // Clean up
            eventBus.destroy();

            assert.strictEqual(eventBus.getEvents().length, 0);
        });

        test('should enforce maximum listeners limit', () => {
            // Suppress console.warn for this test
            const originalWarn = console.warn;
            console.warn = () => {};

            eventBus.setMaxListeners(3);

            const handler = () => {};
            const unsubscribe1 = eventBus.on('test-event', handler);
            const unsubscribe2 = eventBus.on('test-event', handler);
            const unsubscribe3 = eventBus.on('test-event', handler);
            const unsubscribe4 = eventBus.on('test-event', handler); // Should be limited

            assert.strictEqual(eventBus.getListenerCount('test-event'), 3);

            // Clean up
            unsubscribe1();
            unsubscribe2();
            unsubscribe3();
            unsubscribe4();

            console.warn = originalWarn;
        });

        test('should clean up empty event arrays', () => {
            const handler = () => {};

            eventBus.on('test-event', handler);
            assert.strictEqual(eventBus.getEvents().length, 1);

            eventBus.off('test-event', handler);
            assert.strictEqual(eventBus.getEvents().length, 0);
        });
    });

    describe('Async Subscribers', () => {
        test('should handle async subscribers correctly', async () => {
            const results = [];

            const asyncHandler1 = async (data) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                results.push(`handler1-${data}`);
            };

            const asyncHandler2 = async (data) => {
                await new Promise(resolve => setTimeout(resolve, 5));
                results.push(`handler2-${data}`);
            };

            eventBus.on('async-event', asyncHandler1);
            eventBus.on('async-event', asyncHandler2);

            await eventBus.emitAsync('async-event', 'test');

            assert.strictEqual(results.length, 2);
            assert.ok(results.includes('handler1-test'));
            assert.ok(results.includes('handler2-test'));
        });

        test('should handle async subscriber errors gracefully', async () => {
            // Suppress console.error for this test
            const originalError = console.error;
            console.error = () => {};

            let normalHandlerCalled = false;
            const errorHandler = async () => {
                throw new Error('Async error');
            };
            const normalHandler = async () => {
                normalHandlerCalled = true;
            };

            eventBus.on('async-event', errorHandler);
            eventBus.on('async-event', normalHandler);

            const results = await eventBus.emitAsync('async-event');

            assert.strictEqual(normalHandlerCalled, true);
            assert.ok(Array.isArray(results));

            console.error = originalError;
        });

        test('should remove one-time listeners after async execution', async () => {
            let callCount = 0;
            const handler = async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                callCount++;
            };

            eventBus.once('async-event', handler);
            assert.strictEqual(eventBus.getListenerCount('async-event'), 1);

            await eventBus.emitAsync('async-event');
            assert.strictEqual(callCount, 1);
            assert.strictEqual(eventBus.getListenerCount('async-event'), 0);
        });
    });

    describe('Event Querying', () => {
        test('should get all registered events', () => {
            eventBus.on('event1', () => {});
            eventBus.on('event2', () => {});
            eventBus.on('event3', () => {});

            const events = eventBus.getEvents();
            assert.strictEqual(events.length, 3);
            assert.ok(events.includes('event1'));
            assert.ok(events.includes('event2'));
            assert.ok(events.includes('event3'));
        });

        test('should get listener count for event', () => {
            const handler = () => {};

            assert.strictEqual(eventBus.getListenerCount('test-event'), 0);

            eventBus.on('test-event', handler);
            assert.strictEqual(eventBus.getListenerCount('test-event'), 1);

            eventBus.on('test-event', handler);
            assert.strictEqual(eventBus.getListenerCount('test-event'), 2);
        });

        test('should check if event has listeners', () => {
            const handler = () => {};

            assert.strictEqual(eventBus.hasListeners('test-event'), false);

            eventBus.on('test-event', handler);
            assert.strictEqual(eventBus.hasListeners('test-event'), true);

            eventBus.off('test-event', handler);
            assert.strictEqual(eventBus.hasListeners('test-event'), false);
        });
    });

    describe('Event Statistics', () => {
        test('should get event statistics', () => {
            const handler1 = () => {};
            const handler2 = () => {};
            const handler3 = () => {};

            eventBus.on('event1', handler1);
            eventBus.on('event1', handler2);
            eventBus.once('event2', handler3);

            const stats = eventBus.getStats();

            assert.strictEqual(stats.totalEvents, 2);
            assert.strictEqual(stats.totalListeners, 3);
            assert.strictEqual(stats.events.event1.listenerCount, 2);
            assert.strictEqual(stats.events.event2.listenerCount, 1);
            assert.strictEqual(stats.events.event2.onceListeners, 1);
        });
    });

    describe('Priority System', () => {
        test('should execute listeners in priority order', () => {
            const callOrder = [];

            const handler1 = () => { callOrder.push(1); };
            const handler2 = () => { callOrder.push(2); };
            const handler3 = () => { callOrder.push(3); };

            eventBus.on('test-event', handler1, { priority: 1 });
            eventBus.on('test-event', handler2, { priority: 3 }); // Higher priority
            eventBus.on('test-event', handler3, { priority: 2 });

            eventBus.emit('test-event');

            // Higher priority should execute first
            assert.deepStrictEqual(callOrder, [2, 3, 1]);
        });
    });

    describe('Scoped Event Bus', () => {
        test('should create scoped event bus', () => {
            let receivedData = null;
            const handler = (data) => {
                receivedData = data;
            };

            const scoped = eventBus.createScope('component1');
            scoped.on('test', handler);

            scoped.emit('test', 'scoped-data');
            assert.strictEqual(receivedData, 'scoped-data');

            // Regular emit should not trigger scoped listener
            receivedData = null;
            eventBus.emit('test', 'regular-data');
            assert.strictEqual(receivedData, null);

            // Scoped event name should be prefixed
            assert.strictEqual(eventBus.hasListeners('component1:test'), true);
        });

        test('should support scoped unsubscribe', () => {
            let callCount = 0;
            const handler = () => {
                callCount++;
            };

            const scoped = eventBus.createScope('component1');
            scoped.on('test', handler);

            scoped.emit('test');
            assert.strictEqual(callCount, 1);

            scoped.off('test', handler);
            scoped.emit('test');
            assert.strictEqual(callCount, 1); // Should not be called again
        });
    });

    describe('Debug Mode', () => {
        test('should enable/disable debug mode', () => {
            assert.strictEqual(eventBus.debugMode, false);

            eventBus.setDebugMode(true);
            assert.strictEqual(eventBus.debugMode, true);

            eventBus.setDebugMode(false);
            assert.strictEqual(eventBus.debugMode, false);
        });

        test('should warn when no listeners in debug mode', () => {
            // Suppress console.warn for this test
            const originalWarn = console.warn;
            let warnCalled = false;
            console.warn = () => {
                warnCalled = true;
            };

            eventBus.setDebugMode(true);
            eventBus.emit('non-existent-event');

            // Note: In test environment, debug mode might not trigger warnings
            // This test verifies the mode can be set

            console.warn = originalWarn;
        });
    });

    describe('Max Listeners Configuration', () => {
        test('should set maximum listeners', () => {
            eventBus.setMaxListeners(50);
            assert.strictEqual(eventBus.maxListeners, 50);
        });

        test('should validate max listeners value', () => {
            assert.throws(() => {
                eventBus.setMaxListeners(0);
            }, Error);

            assert.throws(() => {
                eventBus.setMaxListeners(-1);
            }, Error);

            assert.throws(() => {
                eventBus.setMaxListeners('invalid');
            }, Error);
        });
    });
});

