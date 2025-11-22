/**
 * Service Factory
 * Centralized service creation and dependency injection
 * Provides singleton management and service lifecycle control
 * Uses registry pattern with lazy loading for better extensibility
 */

import { configManager } from '../config/ConfigManager.js';

export class ServiceFactory {
    constructor() {
        this.services = new Map();
        this.singletons = new Set([
            'InstanceService', 
            'SearchService',
            'HighlightingService',
            'CPEEService',
            'SyntaxHighlightingService',
            'LogFetchService',
            'EventProcessingService',
            'StepAssemblyService',
            'NodeMappingService',
            'TraceCalculationService',
            'EmailService',
            'ContentProcessingService'
        ]);
        this.serviceConfigs = new Map();
        this.debugMode = false;
        
        // Service registry: maps service names to factory functions
        // Factory functions use lazy loading (dynamic imports) to load service classes only when needed
        this.serviceRegistry = new Map();
        
        // Cache for service classes (after first import, they're available synchronously)
        this.serviceClasses = new Map();
        
        // Cache for import promises to avoid duplicate imports
        this.importPromises = new Map();
        
        // Track loading promises to avoid duplicate loads
        this.loadingPromises = new Map();
        
        this.initializeServiceRegistry();
        
        // Start loading all services asynchronously in the background
        // This ensures they're ready when needed, but doesn't block construction
        this.initialize().catch(error => {
            console.error('[ServiceFactory] Failed to initialize services:', error);
        });
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

        // Get factory function from registry (should be cached after first load)
        const factory = this.serviceClasses.get(serviceName);
        
        // If service not yet loaded, provide helpful error
        if (!factory) {
            // Check if service is currently loading
            if (this.loadingPromises.has(serviceName)) {
                throw new Error(
                    `ServiceFactory: Service "${serviceName}" is currently loading. ` +
                    `Please wait for initialization to complete or ensure services are pre-loaded.`
                );
            }
            
            // Service not loaded - this means initialization hasn't completed yet
            // In a properly initialized app, this shouldn't happen
            // But for robustness, we provide a helpful error message
            throw new Error(
                `ServiceFactory: Service "${serviceName}" not yet loaded. ` +
                `Services are being loaded asynchronously. ` +
                `Please ensure ServiceFactory.initialize() completes before accessing services, ` +
                `or wait a moment for background initialization to finish.`
            );
        }

        // Create service instance using cached factory
        const service = factory(...args);
        
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
     * Initialize service classes (lazy loading with caching)
     * This should be called during application initialization
     * Services are loaded asynchronously but cached for synchronous access
     * @returns {Promise<void>}
     */
    async initialize() {
        // Load all services in parallel for better performance
        const loadPromises = Array.from(this.serviceRegistry.keys()).map(serviceName => 
            this.loadServiceClass(serviceName)
        );
        
        await Promise.all(loadPromises);
        
        if (this.debugMode) {
            console.log('[ServiceFactory] All services loaded and cached');
        }
    }

    /**
     * Load a service class and cache it for synchronous access
     * @param {string} serviceName - Name of the service to load
     * @returns {Promise<void>}
     * @private
     */
    async loadServiceClass(serviceName) {
        if (this.serviceClasses.has(serviceName)) {
            return; // Already loaded
        }

        const factory = this.serviceRegistry.get(serviceName);
        if (!factory) {
            throw new Error(`ServiceFactory: Unknown service "${serviceName}"`);
        }

        // Execute async factory to get service instance and extract class
        const service = await factory();
        const ServiceClass = service.constructor;

        // Create synchronous factory function based on service type
        let syncFactory;
        
        if (serviceName === 'StepAssemblyService') {
            syncFactory = () => {
                const eventProcessingService = this.get('EventProcessingService');
                const contentProcessingService = this.get('ContentProcessingService');
                const taskMappingService = this.get('TaskMappingService');
                const traceCalculationService = this.get('TraceCalculationService');
                return new ServiceClass(
                    eventProcessingService, 
                    contentProcessingService,
                    taskMappingService, 
                    traceCalculationService
                );
            };
        } else if (serviceName === 'NodeMappingService') {
            // Cache extractors for reuse
            const extractorsPromise = (async () => {
                if (!this.importPromises.has('CPEENodeExtractor')) {
                    this.importPromises.set('CPEENodeExtractor', import('../utils/extraction/CPEETNodeExtractor.js'));
                }
                if (!this.importPromises.has('MermaidNodeExtractor')) {
                    this.importPromises.set('MermaidNodeExtractor', import('../utils/extraction/MermaidNodeExtractor.js'));
                }
                const [{ CPEENodeExtractor }, { MermaidNodeExtractor }] = await Promise.all([
                    this.importPromises.get('CPEENodeExtractor'),
                    this.importPromises.get('MermaidNodeExtractor')
                ]);
                return { CPEENodeExtractor, MermaidNodeExtractor };
            })();
            
            const { CPEENodeExtractor, MermaidNodeExtractor } = await extractorsPromise;
            syncFactory = () => {
                const cpeeNodeExtractor = new CPEENodeExtractor();
                const mermaidNodeExtractor = new MermaidNodeExtractor();
                return new ServiceClass(cpeeNodeExtractor, mermaidNodeExtractor);
            };
        } else if (serviceName === 'TraceCalculationService') {
            // Cache calculators for reuse
            const calculatorsPromise = (async () => {
                if (!this.importPromises.has('CPEETraceCalculator')) {
                    this.importPromises.set('CPEETraceCalculator', import('../utils/trace/CPEETraceCalculator.js'));
                }
                if (!this.importPromises.has('MermaidTraceCalculator')) {
                    this.importPromises.set('MermaidTraceCalculator', import('../utils/trace/MermaidTraceCalculator.js'));
                }
                const [{ CPEETraceCalculator }, { MermaidTraceCalculator }] = await Promise.all([
                    this.importPromises.get('CPEETraceCalculator'),
                    this.importPromises.get('MermaidTraceCalculator')
                ]);
                return { CPEETraceCalculator, MermaidTraceCalculator };
            })();
            
            const { CPEETraceCalculator, MermaidTraceCalculator } = await calculatorsPromise;
            syncFactory = () => {
                const cpeeTraceCalculator = new CPEETraceCalculator();
                const mermaidTraceCalculator = new MermaidTraceCalculator();
                return new ServiceClass(cpeeTraceCalculator, mermaidTraceCalculator);
            };
        } else if (serviceName === 'LogFetchService') {
            syncFactory = () => new ServiceClass(null, configManager);
        } else if (serviceName === 'EventProcessingService' || serviceName === 'ContentProcessingService') {
            syncFactory = () => new ServiceClass();
        } else {
            syncFactory = (...args) => new ServiceClass(...args);
        }

        this.serviceClasses.set(serviceName, syncFactory);
        
        // Handle TaskMappingService backward compatibility
        if (serviceName === 'NodeMappingService') {
            this.serviceClasses.set('TaskMappingService', () => this.get('NodeMappingService'));
        }
    }

    /**
     * Initialize the service registry with factory functions
     * Each factory function uses lazy loading to import service classes only when needed
     * @private
     */
    initializeServiceRegistry() {
        // Simple services with no dependencies
        this.serviceRegistry.set('InstanceService', async (...args) => {
            if (!this.importPromises.has('InstanceService')) {
                this.importPromises.set('InstanceService', import('../services/InstanceService.js'));
            }
            const { InstanceService } = await this.importPromises.get('InstanceService');
            return new InstanceService(...args);
        });

        this.serviceRegistry.set('SearchService', async (...args) => {
            if (!this.importPromises.has('SearchService')) {
                this.importPromises.set('SearchService', import('../services/SearchService.js'));
            }
            const { SearchService } = await this.importPromises.get('SearchService');
            return new SearchService(...args);
        });

        this.serviceRegistry.set('HighlightingService', async (...args) => {
            if (!this.importPromises.has('HighlightingService')) {
                this.importPromises.set('HighlightingService', import('../services/HighlightingService.js'));
            }
            const { HighlightingService } = await this.importPromises.get('HighlightingService');
            return new HighlightingService(...args);
        });

        this.serviceRegistry.set('CPEEService', async (...args) => {
            if (!this.importPromises.has('CPEEService')) {
                this.importPromises.set('CPEEService', import('../services/CPEEService.js'));
            }
            const { CPEEService } = await this.importPromises.get('CPEEService');
            return new CPEEService(...args);
        });

        this.serviceRegistry.set('SyntaxHighlightingService', async (...args) => {
            if (!this.importPromises.has('SyntaxHighlightingService')) {
                this.importPromises.set('SyntaxHighlightingService', import('../services/SyntaxHighlightingService.js'));
            }
            const { SyntaxHighlightingService } = await this.importPromises.get('SyntaxHighlightingService');
            return new SyntaxHighlightingService(...args);
        });

        this.serviceRegistry.set('LogFetchService', async () => {
            if (!this.importPromises.has('LogFetchService')) {
                this.importPromises.set('LogFetchService', import('../services/LogFetchService.js'));
            }
            const { LogFetchService } = await this.importPromises.get('LogFetchService');
            // LogFetchService requires configManager as second argument
            return new LogFetchService(null, configManager);
        });

        this.serviceRegistry.set('EventProcessingService', async () => {
            if (!this.importPromises.has('EventProcessingService')) {
                this.importPromises.set('EventProcessingService', import('../services/EventProcessingService.js'));
            }
            const { EventProcessingService } = await this.importPromises.get('EventProcessingService');
            return new EventProcessingService();
        });

        this.serviceRegistry.set('EmailService', async (...args) => {
            if (!this.importPromises.has('EmailService')) {
                this.importPromises.set('EmailService', import('../services/EmailService.js'));
            }
            const { EmailService } = await this.importPromises.get('EmailService');
            return new EmailService(...args);
        });

        this.serviceRegistry.set('ContentProcessingService', async () => {
            if (!this.importPromises.has('ContentProcessingService')) {
                this.importPromises.set('ContentProcessingService', import('../services/ContentProcessingService.js'));
            }
            const { ContentProcessingService } = await this.importPromises.get('ContentProcessingService');
            return new ContentProcessingService();
        });

        // Services with dependencies that need other services
        this.serviceRegistry.set('StepAssemblyService', async () => {
            if (!this.importPromises.has('StepAssemblyService')) {
                this.importPromises.set('StepAssemblyService', import('../services/StepAssemblyService.js'));
            }
            const { StepAssemblyService } = await this.importPromises.get('StepAssemblyService');
            // Note: Dependencies will be resolved via preloadService or get() calls
            // For async factory, we need to await get() calls, but get() is now sync
            // So we'll handle this in the sync factory after preloading
            const eventProcessingService = this.get('EventProcessingService');
            const contentProcessingService = this.get('ContentProcessingService');
            const taskMappingService = this.get('TaskMappingService');
            const traceCalculationService = this.get('TraceCalculationService');
            return new StepAssemblyService(
                eventProcessingService, 
                contentProcessingService,
                taskMappingService, 
                traceCalculationService
            );
        });

        // NodeMappingService with extractor dependencies
        this.serviceRegistry.set('NodeMappingService', async () => {
            const importKey = 'NodeMappingService';
            if (!this.importPromises.has(importKey)) {
                this.importPromises.set(importKey, import('../services/NodeMappingService.js'));
            }
            if (!this.importPromises.has('CPEENodeExtractor')) {
                this.importPromises.set('CPEENodeExtractor', import('../utils/extraction/CPEETNodeExtractor.js'));
            }
            if (!this.importPromises.has('MermaidNodeExtractor')) {
                this.importPromises.set('MermaidNodeExtractor', import('../utils/extraction/MermaidNodeExtractor.js'));
            }
            const [{ NodeMappingService }, { CPEENodeExtractor }, { MermaidNodeExtractor }] = await Promise.all([
                this.importPromises.get(importKey),
                this.importPromises.get('CPEENodeExtractor'),
                this.importPromises.get('MermaidNodeExtractor')
            ]);
            const cpeeNodeExtractor = new CPEENodeExtractor();
            const mermaidNodeExtractor = new MermaidNodeExtractor();
            return new NodeMappingService(cpeeNodeExtractor, mermaidNodeExtractor);
        });

        // Backward compatibility: TaskMappingService maps to NodeMappingService
        this.serviceRegistry.set('TaskMappingService', () => {
            const nodeMappingFactory = this.serviceRegistry.get('NodeMappingService');
            return nodeMappingFactory();
        });

        // TraceCalculationService with calculator dependencies
        this.serviceRegistry.set('TraceCalculationService', async () => {
            const importKey = 'TraceCalculationService';
            if (!this.importPromises.has(importKey)) {
                this.importPromises.set(importKey, import('../services/TraceCalculationService.js'));
            }
            if (!this.importPromises.has('CPEETraceCalculator')) {
                this.importPromises.set('CPEETraceCalculator', import('../utils/trace/CPEETraceCalculator.js'));
            }
            if (!this.importPromises.has('MermaidTraceCalculator')) {
                this.importPromises.set('MermaidTraceCalculator', import('../utils/trace/MermaidTraceCalculator.js'));
            }
            const [{ TraceCalculationService }, { CPEETraceCalculator }, { MermaidTraceCalculator }] = await Promise.all([
                this.importPromises.get(importKey),
                this.importPromises.get('CPEETraceCalculator'),
                this.importPromises.get('MermaidTraceCalculator')
            ]);
            const cpeeTraceCalculator = new CPEETraceCalculator();
            const mermaidTraceCalculator = new MermaidTraceCalculator();
            return new TraceCalculationService(cpeeTraceCalculator, mermaidTraceCalculator);
        });
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
