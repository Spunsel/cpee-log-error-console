/**
 * Dependency Injection Container
 * Manages service registration and resolution with lifecycle management
 */

export class DIContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
    }

    /**
     * Register a singleton service
     * @param {string} name - Service name
     * @param {Function|Object} service - Service constructor or instance
     * @param {Array} dependencies - Array of dependency names
     */
    registerSingleton(name, service, dependencies = []) {
        this.services.set(name, {
            type: 'singleton',
            service,
            dependencies,
            lifecycle: 'singleton'
        });
    }

    /**
     * Register a transient service (new instance each time)
     * @param {string} name - Service name
     * @param {Function} service - Service constructor
     * @param {Array} dependencies - Array of dependency names
     */
    registerTransient(name, service, dependencies = []) {
        this.services.set(name, {
            type: 'transient',
            service,
            dependencies,
            lifecycle: 'transient'
        });
    }

    /**
     * Register a factory function
     * @param {string} name - Service name
     * @param {Function} factory - Factory function
     * @param {Array} dependencies - Array of dependency names
     */
    registerFactory(name, factory, dependencies = []) {
        this.services.set(name, {
            type: 'factory',
            service: factory,
            dependencies,
            lifecycle: 'factory'
        });
    }

    /**
     * Resolve a service and its dependencies
     * @param {string} name - Service name
     * @returns {*} Resolved service instance
     */
    resolve(name) {
        // Check if already resolved as singleton
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        const serviceConfig = this.services.get(name);
        if (!serviceConfig) {
            throw new Error(`Service '${name}' not registered`);
        }

        // Resolve dependencies first
        const resolvedDependencies = serviceConfig.dependencies.map(dep => {
            return this.resolve(dep);
        });

        let instance;

        switch (serviceConfig.type) {
            case 'singleton':
                if (typeof serviceConfig.service === 'function') {
                    instance = new serviceConfig.service(...resolvedDependencies);
                } else {
                    instance = serviceConfig.service;
                }
                this.singletons.set(name, instance);
                break;

            case 'transient':
                instance = new serviceConfig.service(...resolvedDependencies);
                break;

            case 'factory':
                instance = serviceConfig.service(...resolvedDependencies);
                break;

            default:
                throw new Error(`Unknown service type: ${serviceConfig.type}`);
        }

        return instance;
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean} True if registered
     */
    isRegistered(name) {
        return this.services.has(name);
    }

    /**
     * Clear all services and singletons
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
    }

    /**
     * Get all registered service names
     * @returns {Array<string>} Array of service names
     */
    getRegisteredServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Create a scoped container (for testing)
     * @returns {DIContainer} New scoped container
     */
    createScope() {
        const scope = new DIContainer();
        // Copy all service registrations to the new scope
        this.services.forEach((config, name) => {
            scope.services.set(name, { ...config });
        });
        return scope;
    }
}

// Global container instance
export const container = new DIContainer();
