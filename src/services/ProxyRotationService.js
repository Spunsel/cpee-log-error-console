/**
 * Proxy Rotation Service
 * Manages CORS proxy rotation with automatic rate limit detection and circular wrapping
 */

import { configManager } from '../config/ConfigManager.js';

export class ProxyRotationService {
    constructor() {
        this.currentProxyIndex = 0;
        this.proxies = configManager.get('api.cors.proxies') || [];
    }

    /**
     * Get the current proxy URL
     * @returns {string} Current proxy URL
     */
    getCurrentProxy() {
        return this.proxies[this.currentProxyIndex];
    }

    /**
     * Get the next proxy URL and rotate
     * @returns {string} Next proxy URL
     */
    getNextProxy() {
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        return this.getCurrentProxy();
    }

    /**
     * Check if response indicates rate limiting
     * @param {Response} response - Fetch response object
     * @returns {boolean} True if rate limited
     */
    isRateLimited(response) {
        return response.status === 429;
    }

    /**
     * Fetch with proxy rotation and rate limit handling
     * @param {string} url - Target URL to fetch
     * @param {Object} options - Fetch options
     * @param {number} maxAttempts - Maximum number of proxy attempts (default: all proxies * 2 for wrap-around)
     * @returns {Promise<Response>} Fetch response
     * @throws {Error} If all proxies fail or rate limited
     */
    async fetchWithRotation(url, options = {}, maxAttempts = null) {
        // Default to trying all proxies twice (full cycle + wrap-around)
        const attempts = maxAttempts || (this.proxies.length * 2);
        const initialProxyIndex = this.currentProxyIndex;
        let attemptsMade = 0;
        let fullCycleCompleted = false;

        while (attemptsMade < attempts) {
            const proxy = this.getCurrentProxy();
            const proxyUrl = proxy + encodeURIComponent(url);

            try {
                console.log(`Trying proxy ${this.currentProxyIndex + 1}/${this.proxies.length}: ${proxy}`);

                const response = await fetch(proxyUrl, options);

                // Check for rate limiting - immediately rotate to next proxy
                if (this.isRateLimited(response)) {
                    console.warn(`Rate limited on proxy ${this.currentProxyIndex + 1}, rotating to next proxy...`);
                    this.getNextProxy();
                    attemptsMade++;
                    
                    // Check if we've completed a full cycle
                    if (this.currentProxyIndex === initialProxyIndex && attemptsMade >= this.proxies.length) {
                        fullCycleCompleted = true;
                        console.log('Completed full proxy cycle, wrapping around...');
                    }
                    
                    // Continue to next iteration
                    continue;
                }

                // If response is OK, return it
                if (response.ok) {
                    console.log(`Fetch successful via proxy ${this.currentProxyIndex + 1}`);
                    return response;
                }

                // For non-rate-limit errors, try next proxy
                console.warn(`Proxy ${this.currentProxyIndex + 1} returned ${response.status}, trying next proxy...`);
                this.getNextProxy();
                attemptsMade++;
                
                // Check if we've completed a full cycle
                if (this.currentProxyIndex === initialProxyIndex && attemptsMade >= this.proxies.length) {
                    fullCycleCompleted = true;
                }

            } catch (error) {
                console.warn(`Proxy ${this.currentProxyIndex + 1} failed:`, error.message);
                this.getNextProxy();
                attemptsMade++;
                
                // Check if we've completed a full cycle
                if (this.currentProxyIndex === initialProxyIndex && attemptsMade >= this.proxies.length) {
                    fullCycleCompleted = true;
                    console.log('Completed full proxy cycle after error, wrapping around...');
                }
            }
        }

        // If we've exhausted attempts after completing at least one full cycle
        if (fullCycleCompleted) {
            throw new Error(`All proxies exhausted after ${attemptsMade} attempts - rate limited or unavailable`);
        } else {
            throw new Error(`All proxy attempts failed after ${attemptsMade} attempts`);
        }
    }

    /**
     * Reset proxy index to first proxy
     */
    reset() {
        this.currentProxyIndex = 0;
    }

    /**
     * Get current proxy index
     * @returns {number} Current proxy index
     */
    getCurrentIndex() {
        return this.currentProxyIndex;
    }

    /**
     * Get total number of proxies
     * @returns {number} Total proxy count
     */
    getProxyCount() {
        return this.proxies.length;
    }
}

// Export singleton instance
export const proxyRotationService = new ProxyRotationService();

