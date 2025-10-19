/**
 * API Configuration
 * Centralized configuration for all API endpoints, CORS handling, and network settings
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
