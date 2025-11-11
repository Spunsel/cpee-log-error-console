/**
 * ConfigManager Test Suite
 * Tests the centralized configuration management system
 * 
 * Uses Node.js built-in test runner (Node 18+)
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import { configManager } from '../../src/config/ConfigManager.js';

describe('ConfigManager', () => {
    let originalValues = {};

    beforeEach(() => {
        // Store original values for restoration
        originalValues = {};
    });

    afterEach(() => {
        // Restore original values if they were changed
        Object.entries(originalValues).forEach(([path, value]) => {
            configManager.set(path, value);
        });
        originalValues = {};
    });

    test('should load all configuration sections', () => {
        const config = configManager.getAll();
        
        assert.ok('api' in config);
        assert.ok('ui' in config);
        assert.ok('rendering' in config);
        assert.ok('network' in config);
        assert.ok('mermaid' in config);
        assert.ok('cpee' in config);
        assert.ok('dom' in config);
        assert.ok('timing' in config);
        assert.ok('styling' in config);
    });

    test('should get configuration values by path', () => {
        const cpeeBase = configManager.get('api.endpoints.cpeeBase');
        assert.strictEqual(cpeeBase, 'https://cpee.org/flow/engine');
        
        const timeout = configManager.get('network.timeouts.default');
        assert.strictEqual(timeout, 15000);
        
        const successColor = configManager.get('styling.colors.success');
        assert.strictEqual(successColor, '#28a745');
    });

    test('should return default value for non-existent path', () => {
        const nonExistent = configManager.get('non.existent.path', 'default');
        assert.strictEqual(nonExistent, 'default');
    });

    test('should set configuration values', () => {
        const path = 'ui.notifications.successDuration';
        const originalValue = configManager.get(path);
        originalValues[path] = originalValue;
        
        configManager.set(path, 3000);
        assert.strictEqual(configManager.get(path), 3000);
    });

    test('should validate configuration', () => {
        const validation = configManager.validate();
        assert.strictEqual(validation.valid, true);
        assert.strictEqual(validation.errors.length, 0);
    });

    test('should merge configuration objects', () => {
        const original = { a: 1, b: { c: 2 } };
        const toMerge = { b: { d: 3 }, e: 4 };
        
        const merged = configManager.deepMerge(original, toMerge);
        assert.deepStrictEqual(merged, {
            a: 1,
            b: { c: 2, d: 3 },
            e: 4
        });
    });

    test('should subscribe to configuration changes', () => {
        let changeNotified = false;
        let notifiedValue = null;
        
        const path = 'ui.notifications.successDuration';
        const originalValue = configManager.get(path);
        originalValues[path] = originalValue;
        
        const unsubscribe = configManager.subscribe(path, (newValue) => {
            changeNotified = true;
            notifiedValue = newValue;
        });
        
        configManager.set(path, 5000);
        
        assert.strictEqual(changeNotified, true);
        assert.strictEqual(notifiedValue, 5000);
        
        unsubscribe();
    });

    test('should get configuration summary', () => {
        const summary = configManager.getSummary();
        
        assert.ok('sections' in summary);
        assert.ok('totalKeys' in summary);
        assert.ok('observers' in summary);
        assert.ok('validation' in summary);
        
        assert.ok(Array.isArray(summary.sections));
        assert.strictEqual(typeof summary.totalKeys, 'number');
        assert.ok(summary.totalKeys > 0);
    });

    test('should export and import configuration', () => {
        const exported = configManager.export();
        assert.strictEqual(typeof exported, 'string');
        
        const parsed = JSON.parse(exported);
        assert.ok('api' in parsed);
        assert.ok('ui' in parsed);
        
        // Test import
        const importSuccess = configManager.import(exported);
        assert.strictEqual(importSuccess, true);
    });

    test('should handle section-specific configuration', () => {
        const apiConfig = configManager.getSection('api');
        assert.ok('endpoints' in apiConfig);
        assert.ok('cors' in apiConfig);
        assert.ok('headers' in apiConfig);
        
        const uiConfig = configManager.getSection('ui');
        assert.ok('layout' in uiConfig);
        assert.ok('forms' in uiConfig);
        assert.ok('navigation' in uiConfig);
    });

    test('should check if configuration path exists', () => {
        assert.strictEqual(configManager.has('api.endpoints.cpeeBase'), true);
        // Test with a simple non-existent top-level key
        assert.strictEqual(configManager.has('xyz123abc456'), false);
        // Test with a nested path that definitely doesn't exist
        assert.strictEqual(configManager.has('xyz123abc456.nested.path'), false);
    });

    test('should reset configuration to defaults', () => {
        const path = 'ui.notifications.successDuration';
        const originalValue = configManager.get(path);
        
        configManager.set(path, 9999);
        assert.strictEqual(configManager.get(path), 9999);
        
        configManager.reset();
        assert.strictEqual(configManager.get(path), originalValue);
    });
});
