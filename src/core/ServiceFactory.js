/**
 * Service Factory
 * Centralized service creation and dependency injection
 * Provides singleton management and service lifecycle control
 */

import { InstanceService } from '../services/InstanceService.js';
import { SearchService } from '../services/SearchService.js';
import { HighlightingService } from '../services/HighlightingService.js';
import { CPEEService } from '../services/CPEEService.js';
import { SyntaxHighlightingService } from '../services/SyntaxHighlightingService.js';

export class ServiceFactory {
    constructor() {
        this.services = new Map();
        this.singletons = new Set([
            'InstanceService', 
            'SearchService',
            'HighlightingService',
            'CPEEService',
            'SyntaxHighlightingService'
        ]);
        this.serviceConfigs = new Map();
        this.debugMode = false;
    }

    /**
     * Get a service instance
     * @param {string} serviceName - Name of the service
     * @param {...any} args - Constructor arguments
     * @returns {Object} Service instance
     */
    get(serviceName, ...args) {
        if (this.debugMode) {
            console.log(`[ServiceFactory] Getting service: ${serviceName}`, args);
        }

        // Return existing singleton instance
        if (this.singletons.has(serviceName) && this.services.has(serviceName)) {
            if (this.debugMode) {
                console.log(`[ServiceFactory] Returning existing singleton: ${serviceName}`);
            }
            return this.services.get(serviceName);
        }

        // Create new service instance
        const service = this.createService(serviceName, ...args);
        
        // Store singleton instances
        if (this.singletons.has(serviceName)) {
            this.services.set(serviceName, service);
            if (this.debugMode) {
                console.log(`[ServiceFactory] Created and stored singleton: ${serviceName}`);
            }
        }

        return service;
    }

    /**
     * Create a service instance
     * @param {string} serviceName - Name of the service
     * @param {...any} args - Constructor arguments
     * @returns {Object} Service instance
     */
    createService(serviceName, ...args) {
        if (this.debugMode) {
            console.log(`[ServiceFactory] Creating service: ${serviceName}`, args);
        }

        switch (serviceName) {
            case 'InstanceService':
                return new InstanceService(...args);
            
            case 'SearchService':
                return new SearchService(...args);
            
            case 'HighlightingService':
                return new HighlightingService(...args);
            
            case 'CPEEService':
                return new CPEEService(...args);
            
            case 'SyntaxHighlightingService':
                return new SyntaxHighlightingService(...args);
            
            default:
                throw new Error(`ServiceFactory: Unknown service "${serviceName}"`);
        }
    }

    /**
     * Register a custom service configuration
     * @param {string} serviceName - Name of the service
     * @param {Object} config - Service configuration
     */
    registerConfig(serviceName, config) {
        this.serviceConfigs.set(serviceName, config);
        if (this.debugMode) {
            console.log(`[ServiceFactory] Registered config for: ${serviceName}`, config);
        }
    }

    /**
     * Get service configuration
     * @param {string} serviceName - Name of the service
     * @returns {Object|null} Service configuration or null
     */
    getConfig(serviceName) {
        return this.serviceConfigs.get(serviceName) || null;
    }

    /**
     * Check if a service is registered as singleton
     * @param {string} serviceName - Name of the service
     * @returns {boolean} True if singleton
     */
    isSingleton(serviceName) {
        return this.singletons.has(serviceName);
    }

    /**
     * Add a service to singleton list
     * @param {string} serviceName - Name of the service
     */
    addSingleton(serviceName) {
        this.singletons.add(serviceName);
        if (this.debugMode) {
            console.log(`[ServiceFactory] Added singleton: ${serviceName}`);
        }
    }

    /**
     * Remove a service from singleton list
     * @param {string} serviceName - Name of the service
     */
    removeSingleton(serviceName) {
        this.singletons.delete(serviceName);
        if (this.debugMode) {
            console.log(`[ServiceFactory] Removed singleton: ${serviceName}`);
        }
    }

    /**
     * Clear all singleton instances
     */
    clearSingletons() {
        this.services.clear();
        if (this.debugMode) {
            console.log('[ServiceFactory] Cleared all singleton instances');
        }
    }

    /**
     * Get all registered services
     * @returns {Array} Array of service names
     */
    getRegisteredServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getStats() {
        return {
            totalServices: this.services.size,
            singletons: Array.from(this.singletons),
            registeredServices: this.getRegisteredServices(),
            configs: Array.from(this.serviceConfigs.keys())
        };
    }

    /**
     * Enable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (this.debugMode) {
            console.log('[ServiceFactory] Debug mode enabled');
        }
    }

    /**
     * Destroy a specific service
     * @param {string} serviceName - Name of the service
     */
    destroyService(serviceName) {
        if (this.services.has(serviceName)) {
            const service = this.services.get(serviceName);
            
            // Call destroy method if it exists
            if (typeof service.destroy === 'function') {
                service.destroy();
            }
            
            this.services.delete(serviceName);
            if (this.debugMode) {
                console.log(`[ServiceFactory] Destroyed service: ${serviceName}`);
            }
        }
    }

    /**
     * Destroy all services
     */
    destroyAll() {
        for (const [_serviceName, service] of this.services) {
            if (typeof service.destroy === 'function') {
                service.destroy();
            }
        }
        this.services.clear();
        if (this.debugMode) {
            console.log('[ServiceFactory] Destroyed all services');
        }
    }
}

// Export singleton instance
export const serviceFactory = new ServiceFactory();
