/**
 * ConfigManager Test Suite
 * Tests the centralized configuration management system
 */

import { configManager } from '../../src/config/ConfigManager.js';

describe('ConfigManager', () => {
    
    test('should load all configuration sections', () => {
        const config = configManager.getAll();
        
        expect(config).toHaveProperty('api');
        expect(config).toHaveProperty('ui');
        expect(config).toHaveProperty('rendering');
        expect(config).toHaveProperty('network');
        expect(config).toHaveProperty('mermaid');
        expect(config).toHaveProperty('cpee');
        expect(config).toHaveProperty('dom');
        expect(config).toHaveProperty('timing');
        expect(config).toHaveProperty('styling');
    });

    test('should get configuration values by path', () => {
        const cpeeBase = configManager.get('api.endpoints.cpeeBase');
        expect(cpeeBase).toBe('https://cpee.org/flow/engine');
        
        const timeout = configManager.get('network.timeouts.default');
        expect(timeout).toBe(15000);
        
        const successColor = configManager.get('styling.colors.success');
        expect(successColor).toBe('#28a745');
    });

    test('should return default value for non-existent path', () => {
        const nonExistent = configManager.get('non.existent.path', 'default');
        expect(nonExistent).toBe('default');
    });

    test('should set configuration values', () => {
        const originalValue = configManager.get('ui.notifications.successDuration');
        
        configManager.set('ui.notifications.successDuration', 3000);
        expect(configManager.get('ui.notifications.successDuration')).toBe(3000);
        
        // Restore original value
        configManager.set('ui.notifications.successDuration', originalValue);
    });

    test('should validate configuration', () => {
        const validation = configManager.validate();
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
    });

    test('should merge configuration objects', () => {
        const original = { a: 1, b: { c: 2 } };
        const toMerge = { b: { d: 3 }, e: 4 };
        
        const merged = configManager.deepMerge(original, toMerge);
        expect(merged).toEqual({
            a: 1,
            b: { c: 2, d: 3 },
            e: 4
        });
    });

    test('should subscribe to configuration changes', () => {
        let changeNotified = false;
        let notifiedValue = null;
        
        const unsubscribe = configManager.subscribe('ui.notifications.successDuration', (newValue) => {
            changeNotified = true;
            notifiedValue = newValue;
        });
        
        configManager.set('ui.notifications.successDuration', 5000);
        
        expect(changeNotified).toBe(true);
        expect(notifiedValue).toBe(5000);
        
        unsubscribe();
    });

    test('should get configuration summary', () => {
        const summary = configManager.getSummary();
        
        expect(summary).toHaveProperty('sections');
        expect(summary).toHaveProperty('totalKeys');
        expect(summary).toHaveProperty('observers');
        expect(summary).toHaveProperty('validation');
        
        expect(Array.isArray(summary.sections)).toBe(true);
        expect(typeof summary.totalKeys).toBe('number');
        expect(summary.totalKeys).toBeGreaterThan(0);
    });

    test('should export and import configuration', () => {
        const exported = configManager.export();
        expect(typeof exported).toBe('string');
        
        const parsed = JSON.parse(exported);
        expect(parsed).toHaveProperty('api');
        expect(parsed).toHaveProperty('ui');
        
        // Test import
        const importSuccess = configManager.import(exported);
        expect(importSuccess).toBe(true);
    });

    test('should handle section-specific configuration', () => {
        const apiConfig = configManager.getSection('api');
        expect(apiConfig).toHaveProperty('endpoints');
        expect(apiConfig).toHaveProperty('cors');
        expect(apiConfig).toHaveProperty('headers');
        
        const uiConfig = configManager.getSection('ui');
        expect(uiConfig).toHaveProperty('layout');
        expect(uiConfig).toHaveProperty('forms');
        expect(uiConfig).toHaveProperty('navigation');
    });

    test('should check if configuration path exists', () => {
        expect(configManager.has('api.endpoints.cpeeBase')).toBe(true);
        expect(configManager.has('non.existent.path')).toBe(false);
    });

    test('should reset configuration to defaults', () => {
        const originalValue = configManager.get('ui.notifications.successDuration');
        
        configManager.set('ui.notifications.successDuration', 9999);
        expect(configManager.get('ui.notifications.successDuration')).toBe(9999);
        
        configManager.reset();
        expect(configManager.get('ui.notifications.successDuration')).toBe(originalValue);
    });
});
