/**
 * Service Configuration
 * Centralized configuration for all external services, APIs, libraries, and network settings
 */

export const API_ENDPOINTS = {
    CPEE_BASE: 'https://cpee.org/flow/engine',
    CPEE_LOGS: 'https://cpee.org/logs',
    CPEE_GRAPH: 'https://cpee.org/flow/graph.html'
};

export const CORS_CONFIG = {
    PROXIES: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'
    ],
    TIMEOUT: 15000,
    RETRY_COUNT: 3
};

export const NETWORK_CONFIG = {
    DEFAULT_TIMEOUT: 15000,        // Default network request timeout
    LIBRARY_LOAD_TIMEOUT: 10000,   // Timeout for loading external libraries
    UI_AUTO_HIDE_TIMEOUT: 3000     // Timeout for auto-hiding UI messages
};

export const LIBRARY_URLS = {
    JQUERY: 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js',
    MERMAID: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js'
};

export const HTTP_HEADERS = {
    YAML_ACCEPT: 'text/plain, application/x-yaml, text/yaml',
    JSON_ACCEPT: 'text/plain, application/json, */*'
};

/**
 * Build CPEE log URL for a given UUID
 * @param {string} uuid - Process instance UUID
 * @returns {string} Complete log URL
 */
export function buildLogUrl(uuid) {
    return `${API_ENDPOINTS.CPEE_LOGS}/${uuid}.xes.yaml`;
}

/**
 * Build CPEE graph monitoring URL
 * @param {number} processNumber - Process number
 * @returns {string} Complete graph monitoring URL
 */
export function buildGraphUrl(processNumber) {
    return `${API_ENDPOINTS.CPEE_GRAPH}?monitor=${API_ENDPOINTS.CPEE_BASE}/${processNumber}/`;
}

/**
 * Build CPEE instance URL
 * @param {number} processNumber - Process number
 * @returns {string} Complete instance URL
 */
export function buildInstanceUrl(processNumber) {
    return `${API_ENDPOINTS.CPEE_BASE}/${processNumber}/`;
}

/**
 * Build UUID properties URL
 * @param {number} processNumber - Process number
 * @returns {string} Complete UUID properties URL
 */
export function buildUuidUrl(processNumber) {
    return `${API_ENDPOINTS.CPEE_BASE}/${processNumber}/properties/attributes/uuid/`;
}
