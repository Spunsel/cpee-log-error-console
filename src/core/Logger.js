/**
 * Centralized Logging System
 * Provides structured logging with levels, formatting, and transport options
 */

export class Logger {
    static LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        CRITICAL: 4
    };

    static LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    static LEVEL_COLORS = {
        DEBUG: '#6c757d',
        INFO: '#007bff',
        WARN: '#ffc107',
        ERROR: '#dc3545',
        CRITICAL: '#6f42c1'
    };

    constructor(name, options = {}) {
        this.name = name;
        this.level = options.level || Logger.LEVELS.INFO;
        this.transports = options.transports || [new ConsoleTransport()];
        this.context = options.context || {};
        this.enableTimestamp = options.enableTimestamp !== false;
        this.enableStackTrace = options.enableStackTrace || false;
    }

    /**
     * Create a child logger with additional context
     * @param {string} name - Child logger name
     * @param {Object} context - Additional context
     * @returns {Logger} Child logger
     */
    child(name, context = {}) {
        return new Logger(`${this.name}.${name}`, {
            level: this.level,
            transports: this.transports,
            context: { ...this.context, ...context },
            enableTimestamp: this.enableTimestamp,
            enableStackTrace: this.enableStackTrace
        });
    }

    /**
     * Log a debug message
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    debug(message, ...args) {
        this.log(Logger.LEVELS.DEBUG, message, ...args);
    }

    /**
     * Log an info message
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    info(message, ...args) {
        this.log(Logger.LEVELS.INFO, message, ...args);
    }

    /**
     * Log a warning message
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    warn(message, ...args) {
        this.log(Logger.LEVELS.WARN, message, ...args);
    }

    /**
     * Log an error message
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    error(message, ...args) {
        this.log(Logger.LEVELS.ERROR, message, ...args);
    }

    /**
     * Log a critical message
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    critical(message, ...args) {
        this.log(Logger.LEVELS.CRITICAL, message, ...args);
    }

    /**
     * Main logging method
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    log(level, message, ...args) {
        if (level < this.level) return;

        const logEntry = this.createLogEntry(level, message, args);
        
        // Send to all transports
        this.transports.forEach(transport => {
            try {
                transport.log(logEntry);
            } catch (error) {
                console.error('Transport error:', error);
            }
        });
    }

    /**
     * Create a structured log entry
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {Array} args - Additional arguments
     * @returns {Object} Log entry
     */
    createLogEntry(level, message, args) {
        const entry = {
            timestamp: new Date(),
            level: level,
            levelName: Logger.LEVEL_NAMES[level],
            logger: this.name,
            message: message,
            args: args,
            context: this.context
        };

        // Add stack trace for errors
        if (this.enableStackTrace || level >= Logger.LEVELS.ERROR) {
            entry.stack = this.captureStackTrace();
        }

        // Add performance timing if available
        if (typeof performance !== 'undefined') {
            entry.performanceNow = performance.now();
        }

        return entry;
    }

    /**
     * Capture stack trace
     * @returns {string} Stack trace
     */
    captureStackTrace() {
        try {
            throw new Error();
        } catch (error) {
            return error.stack;
        }
    }

    /**
     * Set log level
     * @param {number} level - New log level
     */
    setLevel(level) {
        this.level = level;
    }

    /**
     * Add transport
     * @param {Object} transport - Log transport
     */
    addTransport(transport) {
        this.transports.push(transport);
    }

    /**
     * Remove transport
     * @param {Object} transport - Log transport
     */
    removeTransport(transport) {
        const index = this.transports.indexOf(transport);
        if (index > -1) {
            this.transports.splice(index, 1);
        }
    }

    /**
     * Time a function execution
     * @param {string} label - Timer label
     * @param {Function} fn - Function to time
     * @returns {*} Function result
     */
    async time(label, fn) {
        const start = performance.now();
        this.debug(`Timer started: ${label}`);
        
        try {
            const result = await fn();
            const duration = performance.now() - start;
            this.info(`Timer completed: ${label} (${duration.toFixed(2)}ms)`);
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.error(`Timer failed: ${label} (${duration.toFixed(2)}ms)`, error);
            throw error;
        }
    }

    /**
     * Create a logger instance for a specific module
     * @param {string} moduleName - Module name
     * @returns {Logger} Module logger
     */
    static createLogger(moduleName) {
        return new Logger(moduleName);
    }
}

/**
 * Console Transport
 * Outputs logs to browser console with formatting
 */
export class ConsoleTransport {
    constructor(options = {}) {
        this.enableColors = options.enableColors !== false;
        this.enableGrouping = options.enableGrouping || false;
    }

    log(entry) {
        const formatted = this.format(entry);
        
        switch (entry.level) {
            case Logger.LEVELS.DEBUG:
                console.debug(...formatted);
                break;
            case Logger.LEVELS.INFO:
                console.info(...formatted);
                break;
            case Logger.LEVELS.WARN:
                console.warn(...formatted);
                break;
            case Logger.LEVELS.ERROR:
            case Logger.LEVELS.CRITICAL:
                console.error(...formatted);
                if (entry.stack) {
                    console.error('Stack trace:', entry.stack);
                }
                break;
        }
    }

    format(entry) {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.levelName;
        const logger = entry.logger;
        const message = entry.message;
        
        if (this.enableColors) {
            const color = Logger.LEVEL_COLORS[level];
            return [
                `%c[${timestamp}] ${level} ${logger}: ${message}`,
                `color: ${color}`,
                ...entry.args
            ];
        } else {
            return [
                `[${timestamp}] ${level} ${logger}: ${message}`,
                ...entry.args
            ];
        }
    }
}

/**
 * Storage Transport
 * Stores logs in browser storage for debugging
 */
export class StorageTransport {
    constructor(options = {}) {
        this.storage = options.storage || localStorage;
        this.key = options.key || 'cpee-debug-logs';
        this.maxEntries = options.maxEntries || 1000;
    }

    log(entry) {
        try {
            const logs = this.getLogs();
            logs.push(this.serialize(entry));
            
            // Keep only last N entries
            if (logs.length > this.maxEntries) {
                logs.splice(0, logs.length - this.maxEntries);
            }
            
            this.storage.setItem(this.key, JSON.stringify(logs));
        } catch (error) {
            console.error('Failed to store log entry:', error);
        }
    }

    serialize(entry) {
        return {
            timestamp: entry.timestamp.toISOString(),
            level: entry.levelName,
            logger: entry.logger,
            message: entry.message,
            args: entry.args.map(arg => {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }),
            context: entry.context
        };
    }

    getLogs() {
        try {
            const stored = this.storage.getItem(this.key);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    clearLogs() {
        this.storage.removeItem(this.key);
    }
}

// Global logger instances
export const logger = new Logger('CPEE', {
    level: Logger.LEVELS.INFO,
    transports: [
        new ConsoleTransport({ enableColors: true }),
        new StorageTransport({ maxEntries: 500 })
    ]
});

// Convenience function to get a module-specific logger
export function getLogger(moduleName) {
    return logger.child(moduleName);
}
