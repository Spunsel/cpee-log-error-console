/**
 * Plugin Manager
 * Extensible plugin system for adding features without modifying core code
 */

export class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.hooks = new Map();
        this.middleware = new Map();
        this.loadOrder = [];
    }

    /**
     * Register a plugin
     * @param {string} name - Plugin name
     * @param {Object} plugin - Plugin definition
     */
    registerPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin '${name}' is already registered`);
        }

        // Validate plugin structure
        this.validatePlugin(plugin);

        // Store plugin
        this.plugins.set(name, {
            name,
            ...plugin,
            enabled: true,
            initialized: false
        });

        this.loadOrder.push(name);
        console.log(`Plugin '${name}' registered`);
    }

    /**
     * Validate plugin structure
     * @param {Object} plugin - Plugin definition
     */
    validatePlugin(plugin) {
        const required = ['version', 'initialize'];
        const optional = ['dependencies', 'hooks', 'middleware', 'destroy'];

        for (const field of required) {
            if (!plugin[field]) {
                throw new Error(`Plugin missing required field: ${field}`);
            }
        }

        if (plugin.initialize && typeof plugin.initialize !== 'function') {
            throw new Error('Plugin initialize must be a function');
        }

        if (plugin.destroy && typeof plugin.destroy !== 'function') {
            throw new Error('Plugin destroy must be a function');
        }
    }

    /**
     * Initialize all plugins
     * @param {Object} context - Application context
     */
    async initializePlugins(context = {}) {
        console.log('Initializing plugins...');

        // Sort plugins by dependencies
        const sortedPlugins = this.resolveDependencies();

        for (const pluginName of sortedPlugins) {
            await this.initializePlugin(pluginName, context);
        }

        console.log('All plugins initialized');
    }

    /**
     * Initialize single plugin
     * @param {string} name - Plugin name
     * @param {Object} context - Application context
     */
    async initializePlugin(name, context = {}) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin '${name}' not found`);
        }

        if (plugin.initialized) {
            return;
        }

        if (!plugin.enabled) {
            console.log(`Plugin '${name}' is disabled, skipping initialization`);
            return;
        }

        try {
            console.log(`Initializing plugin: ${name}`);

            // Initialize plugin
            if (plugin.initialize) {
                await plugin.initialize(context);
            }

            // Register hooks
            if (plugin.hooks) {
                this.registerPluginHooks(name, plugin.hooks);
            }

            // Register middleware
            if (plugin.middleware) {
                this.registerPluginMiddleware(name, plugin.middleware);
            }

            plugin.initialized = true;
            console.log(`Plugin '${name}' initialized successfully`);

        } catch (error) {
            console.error(`Failed to initialize plugin '${name}':`, error);
            plugin.enabled = false;
            throw error;
        }
    }

    /**
     * Resolve plugin dependencies and return load order
     * @returns {Array<string>} Sorted plugin names
     */
    resolveDependencies() {
        const sorted = [];
        const visiting = new Set();
        const visited = new Set();

        const visit = (pluginName) => {
            if (visited.has(pluginName)) return;
            if (visiting.has(pluginName)) {
                throw new Error(`Circular dependency detected involving plugin: ${pluginName}`);
            }

            visiting.add(pluginName);

            const plugin = this.plugins.get(pluginName);
            if (plugin && plugin.dependencies) {
                for (const dep of plugin.dependencies) {
                    if (!this.plugins.has(dep)) {
                        throw new Error(`Plugin '${pluginName}' depends on missing plugin: ${dep}`);
                    }
                    visit(dep);
                }
            }

            visiting.delete(pluginName);
            visited.add(pluginName);
            sorted.push(pluginName);
        };

        for (const pluginName of this.loadOrder) {
            visit(pluginName);
        }

        return sorted;
    }

    /**
     * Register plugin hooks
     * @param {string} pluginName - Plugin name
     * @param {Object} hooks - Hook definitions
     */
    registerPluginHooks(pluginName, hooks) {
        for (const [hookName, handler] of Object.entries(hooks)) {
            this.registerHook(hookName, handler, pluginName);
        }
    }

    /**
     * Register plugin middleware
     * @param {string} pluginName - Plugin name
     * @param {Object} middleware - Middleware definitions
     */
    registerPluginMiddleware(pluginName, middleware) {
        for (const [eventName, handler] of Object.entries(middleware)) {
            this.registerMiddleware(eventName, handler, pluginName);
        }
    }

    /**
     * Register a hook
     * @param {string} hookName - Hook name
     * @param {Function} handler - Hook handler
     * @param {string} pluginName - Plugin name
     */
    registerHook(hookName, handler, pluginName = 'core') {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }

        this.hooks.get(hookName).push({
            handler,
            plugin: pluginName,
            priority: 0
        });
    }

    /**
     * Execute hook
     * @param {string} hookName - Hook name
     * @param {*} data - Data to pass to hooks
     * @returns {*} Modified data
     */
    async executeHook(hookName, data) {
        const hooks = this.hooks.get(hookName) || [];
        
        // Sort by priority
        hooks.sort((a, b) => b.priority - a.priority);

        let result = data;
        for (const hook of hooks) {
            try {
                result = await hook.handler(result);
            } catch (error) {
                console.error(`Hook '${hookName}' error in plugin '${hook.plugin}':`, error);
            }
        }

        return result;
    }

    /**
     * Register middleware
     * @param {string} eventName - Event name
     * @param {Function} handler - Middleware handler
     * @param {string} pluginName - Plugin name
     */
    registerMiddleware(eventName, handler, pluginName = 'core') {
        if (!this.middleware.has(eventName)) {
            this.middleware.set(eventName, []);
        }

        this.middleware.get(eventName).push({
            handler,
            plugin: pluginName
        });
    }

    /**
     * Execute middleware
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     * @param {Function} next - Next function
     */
    async executeMiddleware(eventName, data, next) {
        const middleware = this.middleware.get(eventName) || [];
        let index = 0;

        const executeNext = async () => {
            if (index >= middleware.length) {
                return next ? next(data) : data;
            }

            const current = middleware[index++];
            try {
                return await current.handler(data, executeNext);
            } catch (error) {
                console.error(`Middleware '${eventName}' error in plugin '${current.plugin}':`, error);
                return executeNext();
            }
        };

        return executeNext();
    }

    /**
     * Enable plugin
     * @param {string} name - Plugin name
     */
    enablePlugin(name) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.enabled = true;
            console.log(`Plugin '${name}' enabled`);
        }
    }

    /**
     * Disable plugin
     * @param {string} name - Plugin name
     */
    disablePlugin(name) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.enabled = false;
            console.log(`Plugin '${name}' disabled`);
        }
    }

    /**
     * Unregister plugin
     * @param {string} name - Plugin name
     */
    async unregisterPlugin(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) return;

        // Call destroy if available
        if (plugin.destroy && plugin.initialized) {
            try {
                await plugin.destroy();
            } catch (error) {
                console.error(`Error destroying plugin '${name}':`, error);
            }
        }

        // Remove hooks and middleware
        this.removePluginHooks(name);
        this.removePluginMiddleware(name);

        // Remove from registry
        this.plugins.delete(name);
        const index = this.loadOrder.indexOf(name);
        if (index > -1) {
            this.loadOrder.splice(index, 1);
        }

        console.log(`Plugin '${name}' unregistered`);
    }

    /**
     * Remove plugin hooks
     * @param {string} pluginName - Plugin name
     */
    removePluginHooks(pluginName) {
        for (const [hookName, hooks] of this.hooks.entries()) {
            const filtered = hooks.filter(hook => hook.plugin !== pluginName);
            if (filtered.length === 0) {
                this.hooks.delete(hookName);
            } else {
                this.hooks.set(hookName, filtered);
            }
        }
    }

    /**
     * Remove plugin middleware
     * @param {string} pluginName - Plugin name
     */
    removePluginMiddleware(pluginName) {
        for (const [eventName, middleware] of this.middleware.entries()) {
            const filtered = middleware.filter(m => m.plugin !== pluginName);
            if (filtered.length === 0) {
                this.middleware.delete(eventName);
            } else {
                this.middleware.set(eventName, filtered);
            }
        }
    }

    /**
     * Get plugin info
     * @param {string} name - Plugin name
     * @returns {Object|null} Plugin info
     */
    getPlugin(name) {
        return this.plugins.get(name) || null;
    }

    /**
     * Get all registered plugins
     * @returns {Array<Object>} Plugin list
     */
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    /**
     * Get enabled plugins
     * @returns {Array<Object>} Enabled plugin list
     */
    getEnabledPlugins() {
        return Array.from(this.plugins.values()).filter(p => p.enabled);
    }
}

// Global plugin manager instance
export const pluginManager = new PluginManager();
