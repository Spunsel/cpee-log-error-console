/**
 * Application Constants
 * Centralized configuration values for the CPEE Debug Console
 */

export const API_CONFIG = {
    // CPEE API endpoints
    CPEE_BASE_URL: 'https://cpee.org/flow/engine',
    CPEE_LOGS_BASE_URL: 'https://cpee.org/logs',
    CPEE_GRAPH_BASE_URL: 'https://cpee.org/flow/graph.html',
    
    // CORS proxy services (with fallback)
    CORS_PROXIES: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'
    ]
};

export const UI_CONFIG = {
    // Timeouts
    REQUEST_TIMEOUT: 15000,
    
    // Display limits
    UUID_DISPLAY_LENGTH: 8,
    
    // Auto-hide timeouts
    SUCCESS_MESSAGE_TIMEOUT: 3000,
    ERROR_MESSAGE_TIMEOUT: 5000
};

export const FILE_EXTENSIONS = {
    YAML: '.xes.yaml',
    XML: '.xml',
    JSON: '.json'
};
