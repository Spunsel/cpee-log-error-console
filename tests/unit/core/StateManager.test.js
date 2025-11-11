/**
 * StateManager Test Suite
 * Tests the centralized state management system
 * 
 * Uses Node.js built-in test runner (Node 18+)
 * Optimized for WSL Windows mount compatibility
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import { StateManager } from '../../../src/core/StateManager.js';

describe('StateManager', () => {
    let stateManager;

    beforeEach(() => {
        // Create a fresh StateManager instance for each test
        // The setup.js file already provides a working localStorage mock
        stateManager = new StateManager();
    });

    afterEach(() => {
        // Clean up StateManager instance to prevent memory leaks
        if (stateManager) {
            stateManager.destroy();
        }
        // Reset localStorage between tests
        localStorage.reset();
    });

    describe('Initialization', () => {
        test('should initialize with empty state', () => {
            const initialState = stateManager.getStateSnapshot();
            
            assert.strictEqual(initialState.currentInstance, null);
            assert.strictEqual(initialState.currentStep, null);
            assert.strictEqual(initialState.currentStepIndex, 0);
            assert.strictEqual(initialState.viewMode, 'visual');
            // Note: getStateSnapshot() uses JSON.parse(JSON.stringify()) which converts Maps to objects
            // So instances will be a plain object in the snapshot, not a Map
            assert.ok(typeof initialState.instances === 'object');
            assert.ok(typeof initialState.ui === 'object');
            assert.ok(typeof initialState.search === 'object');
            assert.ok(typeof initialState.viewModes === 'object');
        });
    });

    describe('State Storage and Retrieval', () => {
        test('should store and retrieve state values', () => {
            stateManager.setState('currentStepIndex', 5);
            const value = stateManager.getState('currentStepIndex');
            
            assert.strictEqual(value, 5);
        });

        test('should update existing state values', () => {
            stateManager.setState('currentStepIndex', 3);
            assert.strictEqual(stateManager.getState('currentStepIndex'), 3);
            
            stateManager.setState('currentStepIndex', 7);
            assert.strictEqual(stateManager.getState('currentStepIndex'), 7);
        });

        test('should handle nested paths', () => {
            stateManager.setState('ui.darkMode', true);
            const value = stateManager.getState('ui.darkMode');
            
            assert.strictEqual(value, true);
        });

        test('should handle array paths', () => {
            stateManager.setState(['ui', 'darkMode'], false);
            const value = stateManager.getState(['ui', 'darkMode']);
            
            assert.strictEqual(value, false);
        });
    });

    describe('localStorage Persistence', () => {
        test('should persist state to localStorage', () => {
            // Register a path for persistence
            stateManager.registerPersistedPath('ui.darkMode');
            
            stateManager.setState('ui.darkMode', true);
            
            const storageKey = stateManager.getStorageKey('ui.darkMode');
            const stored = localStorage.getItem(storageKey);
            assert.strictEqual(stored, 'true');
        });

        test('should restore state from localStorage on initialization', () => {
            // Set up localStorage with persisted value
            const storageKey = 'cpee-debug-console-state-ui-darkMode';
            localStorage.setItem(storageKey, 'true');
            
            // Create a new StateManager instance (simulating page reload)
            const newStateManager = new StateManager();
            
            // The persisted path should be registered and loaded
            // Since loadPersistedState is called in constructor
            const value = newStateManager.getState('ui.darkMode');
            // Value should be loaded (true as string, but parsed)
            assert.ok(value !== undefined);
            
            // Clean up
            newStateManager.destroy();
        });

        test('should handle localStorage errors gracefully', () => {
            // Suppress console.warn for this test (expected error)
            const originalWarn = console.warn;
            console.warn = () => {}; // Suppress warning output
            
            // Temporarily break localStorage
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = () => {
                throw new Error('Storage quota exceeded');
            };
            
            stateManager.registerPersistedPath('ui.darkMode');
            
            // Should not throw, but log a warning
            assert.doesNotThrow(() => {
                stateManager.setState('ui.darkMode', true);
            });
            
            // Restore
            localStorage.setItem = originalSetItem;
            console.warn = originalWarn;
        });

        test('should serialize complex objects correctly', () => {
            stateManager.registerPersistedPath('viewModes');
            
            const viewModes = {
                'input-cpee': 'visual',
                'output-cpee': 'raw'
            };
            
            stateManager.setState('viewModes', viewModes);
            
            const storageKey = stateManager.getStorageKey('viewModes');
            const stored = localStorage.getItem(storageKey);
            assert.strictEqual(stored, JSON.stringify(viewModes));
        });
    });

    describe('Subscriber Notifications', () => {
        test('should notify subscribers when state changes', () => {
            let notifiedValue = null;
            const callback = (newValue) => {
                notifiedValue = newValue;
            };
            
            stateManager.subscribe('currentStepIndex', callback);
            stateManager.setState('currentStepIndex', 10);
            
            assert.strictEqual(notifiedValue, 10);
        });

        test('should allow multiple subscribers', () => {
            let value1 = null;
            let value2 = null;
            
            stateManager.subscribe('currentStepIndex', (v) => { value1 = v; });
            stateManager.subscribe('currentStepIndex', (v) => { value2 = v; });
            
            stateManager.setState('currentStepIndex', 5);
            
            assert.strictEqual(value1, 5);
            assert.strictEqual(value2, 5);
        });

        test('should handle unsubscribe correctly', () => {
            let callCount = 0;
            const callback = () => { callCount++; };
            
            const unsubscribe = stateManager.subscribe('currentStepIndex', callback);
            stateManager.setState('currentStepIndex', 1);
            
            assert.strictEqual(callCount, 1);
            
            unsubscribe();
            stateManager.setState('currentStepIndex', 2);
            
            // Callback should not be called again after unsubscribe
            assert.strictEqual(callCount, 1);
        });

        test('should handle subscriber errors gracefully', () => {
            // Suppress console.error for this test (expected error)
            const originalError = console.error;
            console.error = () => {}; // Suppress error output
            
            let normalCallbackCalled = false;
            const errorCallback = () => {
                throw new Error('Subscriber error');
            };
            const normalCallback = () => {
                normalCallbackCalled = true;
            };
            
            stateManager.subscribe('currentStepIndex', errorCallback);
            stateManager.subscribe('currentStepIndex', normalCallback);
            
            // Should not throw, and normal callback should still be called
            assert.doesNotThrow(() => {
                stateManager.setState('currentStepIndex', 5);
            });
            
            assert.strictEqual(normalCallbackCalled, true);
            
            // Restore
            console.error = originalError;
        });
    });

    describe('State Clearing', () => {
        test('should clear all state', () => {
            stateManager.setState('currentStepIndex', 5);
            stateManager.setState('viewMode', 'raw');
            
            stateManager.reset();
            
            const state = stateManager.getStateSnapshot();
            assert.strictEqual(state.currentStepIndex, 0);
            assert.strictEqual(state.viewMode, 'visual');
        });

        test('should preserve instances when clearing with option', () => {
            const instances = new Map();
            instances.set('test', { id: 'test' });
            
            stateManager.setState('instances', instances);
            stateManager.reset({ preserveInstances: true });
            
            // Check the actual state, not snapshot (snapshot converts Map to object)
            const preservedInstances = stateManager.getState('instances');
            assert.strictEqual(preservedInstances, instances);
            assert.ok(preservedInstances instanceof Map);
            assert.strictEqual(preservedInstances.get('test').id, 'test');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid state keys', () => {
            // Setting state with invalid path should not throw
            assert.doesNotThrow(() => {
                stateManager.setState('', 'value');
            });
            
            // Getting state with invalid path should return undefined
            const value = stateManager.getState('nonexistent.path');
            assert.strictEqual(value, undefined);
        });

        test('should handle null/undefined values', () => {
            stateManager.setState('currentInstance', null);
            assert.strictEqual(stateManager.getState('currentInstance'), null);
            
            stateManager.setState('currentStep', undefined);
            // Note: undefined values might be converted to null in some cases
            const value = stateManager.getState('currentStep');
            assert.ok(value === null || value === undefined);
        });
    });

    describe('State History', () => {
        test('should track state changes in history', () => {
            stateManager.setState('currentStepIndex', 1);
            stateManager.setState('currentStepIndex', 2);
            
            const history = stateManager.getHistory(2);
            assert.ok(history.length > 0);
            assert.strictEqual(history[0].path, 'currentStepIndex');
            assert.strictEqual(history[0].newValue, 2);
        });

        test('should clear history', () => {
            stateManager.setState('currentStepIndex', 1);
            stateManager.clearHistory();
            
            const history = stateManager.getHistory();
            assert.strictEqual(history.length, 0);
        });
    });

    describe('State Snapshot and Restore', () => {
        test('should create state snapshot', () => {
            stateManager.setState('currentStepIndex', 5);
            
            const snapshot = stateManager.getStateSnapshot();
            
            assert.strictEqual(snapshot.currentStepIndex, 5);
            assert.ok(typeof snapshot.ui === 'object');
            // Snapshot should be a deep copy
            assert.notStrictEqual(snapshot, stateManager.state);
        });

        test('should restore state from snapshot', () => {
            stateManager.setState('currentStepIndex', 5);
            const snapshot = stateManager.getStateSnapshot();
            
            stateManager.setState('currentStepIndex', 10);
            stateManager.restoreState(snapshot);
            
            assert.strictEqual(stateManager.getState('currentStepIndex'), 5);
        });
    });
});
