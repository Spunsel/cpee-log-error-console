/**
 * Application Configuration
 * Centralized configuration management
 */

export class AppConfig {
    static ENDPOINTS = {
        CPEE_BASE: 'https://cpee.org',
        CPEE_LOGS: 'https://cpee.org/logs',
        CPEE_API: 'https://cpee.org/flow/start/url/'
    };

    static CORS = {
        PRIMARY_PROXY: 'https://corsproxy.io/?',
        FALLBACK_PROXIES: [
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/'
        ],
        REQUEST_TIMEOUT: 15000
    };

    static UI = {
        MAX_INSTANCES: 10,
        DEFAULT_STEP: 1,
        AUTO_SAVE_DELAY: 500,
        LOADING_TIMEOUT: 30000
    };

    static PARSING = {
        MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
        CHUNK_SIZE: 1000,
        RETRY_ATTEMPTS: 3
    };

    static DEVELOPMENT = {
        DEBUG_MODE: false,
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        ENABLE_PERFORMANCE_MONITORING: false
    };
}
