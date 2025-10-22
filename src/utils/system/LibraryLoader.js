/**
 * Library Loader
 * Handles dynamic loading of external libraries and scripts
 * Provides consistent loading patterns across components
 */

export class LibraryLoader {
    static loadedLibraries = new Map();
    static loadingPromises = new Map();

    /**
     * Load external script
     * @param {string} url - Script URL
     * @param {string} libraryName - Library identifier for caching
     * @returns {Promise} Promise that resolves when script is loaded
     */
    static async loadScript(url, libraryName = null) {
        // Use URL as library name if not provided
        const name = libraryName || url;

        // Return cached result if already loaded
        if (this.loadedLibraries.has(name)) {
            return this.loadedLibraries.get(name);
        }

        // Return existing promise if currently loading
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        // Create loading promise
        const loadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                console.log(`✅ ${name} loaded successfully`);
                this.loadedLibraries.set(name, true);
                this.loadingPromises.delete(name);
                resolve();
            };
            script.onerror = () => {
                const error = new Error(`Failed to load ${name} from ${url}`);
                this.loadingPromises.delete(name);
                reject(error);
            };
            document.head.appendChild(script);
        });

        // Cache the loading promise
        this.loadingPromises.set(name, loadingPromise);
        return loadingPromise;
    }

    /**
     * Load CSS file
     * @param {string} url - CSS URL
     * @param {string} libraryName - Library identifier for caching
     * @returns {Promise} Promise that resolves when CSS is loaded
     */
    static async loadCSS(url, libraryName = null) {
        const name = libraryName || url;

        // Return cached result if already loaded
        if (this.loadedLibraries.has(name)) {
            return this.loadedLibraries.get(name);
        }

        // Check if CSS is already in DOM
        if (document.querySelector(`link[href="${url}"]`)) {
            this.loadedLibraries.set(name, true);
            return;
        }

        // Return existing promise if currently loading
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        // Create loading promise
        const loadingPromise = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => {
                console.log(`✅ ${name} CSS loaded successfully`);
                this.loadedLibraries.set(name, true);
                this.loadingPromises.delete(name);
                resolve();
            };
            link.onerror = () => {
                const error = new Error(`Failed to load CSS ${name} from ${url}`);
                this.loadingPromises.delete(name);
                reject(error);
            };
            document.head.appendChild(link);
        });

        // Cache the loading promise
        this.loadingPromises.set(name, loadingPromise);
        return loadingPromise;
    }

    /**
     * Ensure library is available
     * @param {string} libraryName - Library name
     * @param {string} url - Library URL
     * @param {Function} checkFunction - Function to check if library is available
     * @returns {Promise} Promise that resolves when library is available
     */
    static async ensureLibrary(libraryName, url, checkFunction) {
        // Check if library is already available
        if (checkFunction()) {
            this.loadedLibraries.set(libraryName, true);
            return;
        }

        // Load the library
        await this.loadScript(url, libraryName);
        
        // Verify library is now available
        if (!checkFunction()) {
            throw new Error(`Library ${libraryName} failed to initialize after loading`);
        }
    }

    /**
     * Wait for global variable to be available
     * @param {string} globalName - Global variable name
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Promise that resolves when variable is available
     */
    static waitForGlobal(globalName, timeout = 10000) {
        return new Promise((resolve, reject) => {
            // Check if already available
            if (window[globalName]) {
                resolve(window[globalName]);
                return;
            }

            let attempts = 0;
            const maxAttempts = timeout / 100;

            const checkInterval = setInterval(() => {
                attempts++;
                
                if (window[globalName]) {
                    clearInterval(checkInterval);
                    resolve(window[globalName]);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error(`Timeout waiting for global variable: ${globalName}`));
                }
            }, 100);
        });
    }

    /**
     * Check if library is loaded
     * @param {string} libraryName - Library name
     * @returns {boolean} True if library is loaded
     */
    static isLoaded(libraryName) {
        return this.loadedLibraries.has(libraryName);
    }

    /**
     * Load multiple scripts in parallel
     * @param {Array} scripts - Array of {url, name} objects
     * @returns {Promise} Promise that resolves when all scripts are loaded
     */
    static async loadMultiple(scripts) {
        const promises = scripts.map(script => 
            this.loadScript(script.url, script.name || script.url)
        );
        
        return Promise.all(promises);
    }

    /**
     * Clear cache (useful for testing)
     */
    static clearCache() {
        this.loadedLibraries.clear();
        this.loadingPromises.clear();
    }
}
