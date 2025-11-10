/**
 * DOM Registry
 * Centralized DOM element management to reduce coupling between components and hardcoded IDs
 * Provides dependency injection for DOM elements using semantic keys instead of hardcoded IDs
 */

import { configManager } from '../config/ConfigManager.js';

export class DOMRegistry {
    constructor() {
        this.elements = new Map();
        this.elementCache = new Map();
        this.warningsEnabled = true;
    }

    /**
     * Register a DOM element with a semantic key
     * @param {string} key - Semantic key for the element
     * @param {string} elementId - Actual DOM element ID
     */
    register(key, elementId) {
        if (!key || !elementId) {
            throw new Error('DOMRegistry: Both key and elementId are required');
        }
        
        this.elements.set(key, elementId);
        // Clear cache when element is re-registered
        this.elementCache.delete(key);
        
        if (this.warningsEnabled) {
            // Validate element exists at registration time
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`DOMRegistry: Element with ID '${elementId}' not found during registration of key '${key}'`);
            }
        }
    }

    /**
     * Get DOM element by semantic key
     * @param {string} key - Semantic key for the element
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (!key) {
            console.error('DOMRegistry: getElement called with empty key');
            return null;
        }

        // Check cache first for performance
        if (this.elementCache.has(key)) {
            const cached = this.elementCache.get(key);
            // Verify cached element is still in DOM
            if (document.contains(cached)) {
                return cached;
            }
            // Remove stale cache entry
            this.elementCache.delete(key);
        }

        const elementId = this.elements.get(key);
        if (!elementId) {
            if (this.warningsEnabled) {
                console.warn(`DOMRegistry: No element registered for key '${key}'`);
            }
            return null;
        }

        const element = document.getElementById(elementId);
        if (!element) {
            if (this.warningsEnabled) {
                console.warn(`DOMRegistry: Element with ID '${elementId}' not found for key '${key}'`);
            }
            return null;
        }

        // Cache the element for future use
        this.elementCache.set(key, element);
        return element;
    }

    /**
     * Check if a key is registered
     * @param {string} key - Semantic key to check
     * @returns {boolean} True if key is registered
     */
    hasKey(key) {
        return this.elements.has(key);
    }

    /**
     * Get all registered keys
     * @returns {Array<string>} Array of registered keys
     */
    getKeys() {
        return Array.from(this.elements.keys());
    }

    /**
     * Clear all cached elements
     * Useful when DOM structure changes significantly
     */
    clearCache() {
        this.elementCache.clear();
    }

    /**
     * Enable or disable warning messages
     * @param {boolean} enabled - Whether to show warnings
     */
    setWarningsEnabled(enabled) {
        this.warningsEnabled = enabled;
    }

    /**
     * Batch register multiple elements
     * @param {Object} mappings - Object with key-elementId pairs
     */
    registerBatch(mappings) {
        if (!mappings || typeof mappings !== 'object') {
            throw new Error('DOMRegistry: registerBatch expects an object with key-elementId pairs');
        }

        Object.entries(mappings).forEach(([key, elementId]) => {
            this.register(key, elementId);
        });
    }

    /**
     * Get element with fallback to direct ID lookup (silent, no warnings)
     * Attempts registry lookup first, then falls back to direct DOM ID access
     * This method is designed for dynamic IDs that may not be registered
     * @param {string} key - Semantic key for the element or direct element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElementSafe(key) {
        if (!key) {
            return null;
        }

        // Check cache first for performance
        if (this.elementCache.has(key)) {
            const cached = this.elementCache.get(key);
            // Verify cached element is still in DOM
            if (document.contains(cached)) {
                return cached;
            }
            // Remove stale cache entry
            this.elementCache.delete(key);
        }

        // Check if key is registered in registry
        const elementId = this.elements.get(key);
        if (elementId) {
            // Key is registered, get element by registered ID
            const element = document.getElementById(elementId);
            if (element) {
                // Cache the element for future use
                this.elementCache.set(key, element);
                return element;
            }
            // Element not found, but key was registered - return null silently
            return null;
        }

        // Key not registered - fallback: try to use key as direct element ID
        // This is expected for dynamic IDs, so no warning
        const directElement = document.getElementById(key);
        if (directElement) {
            // Cache the element for future use
            this.elementCache.set(key, directElement);
        }
        return directElement;
    }

    /**
     * Validate all registered elements exist in DOM
     * Useful for debugging and ensuring DOM structure matches registry
     * @returns {Object} Validation results with missing elements
     */
    validateRegistry() {
        const results = {
            valid: [],
            missing: [],
            total: this.elements.size
        };

        this.elements.forEach((elementId, key) => {
            const element = document.getElementById(elementId);
            const entry = { key, elementId };
            
            if (element) {
                results.valid.push(entry);
            } else {
                results.missing.push(entry);
            }
        });

        return results;
    }

    /**
     * Create element with attributes and styles
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {Object} styles - CSS styles object
     * @returns {HTMLElement} Created element
     */
    createElement(tag, attributes = {}, styles = {}) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            switch (key) {
                case 'className':
                    element.className = value;
                    break;
                case 'textContent':
                    element.textContent = value;
                    break;
                case 'innerHTML':
                    element.innerHTML = value;
                    break;
                default:
                    element.setAttribute(key, value);
            }
        });
        
        // Set styles
        if (Object.keys(styles).length > 0) {
            this.applyStyles(element, styles);
        }
        
        return element;
    }

    /**
     * Apply styles to element
     * @param {HTMLElement} element - Target element
     * @param {Object|string} styles - CSS styles object or string
     */
    applyStyles(element, styles) {
        if (typeof styles === 'string') {
            element.style.cssText = styles;
        } else if (typeof styles === 'object') {
            Object.entries(styles).forEach(([property, value]) => {
                element.style[property] = value;
            });
        }
    }

    /**
     * Create SVG element with proper namespace
     * @param {string} tag - SVG tag name
     * @param {Object} attributes - SVG attributes
     * @returns {SVGElement} Created SVG element
     */
    createSVGElement(tag, attributes = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });

        return element;
    }

    /**
     * Update element content safely
     * @param {string} key - Element key or ID
     * @param {string} content - Content to set
     * @param {boolean} isHTML - Whether content is HTML (default: false)
     */
    updateContent(key, content, isHTML = false) {
        const element = this.getElementSafe(key);
        if (element) {
            if (isHTML) {
                element.innerHTML = content;
            } else {
                element.textContent = content;
            }
        }
    }

    /**
     * Toggle element visibility
     * @param {string} key - Element key or ID
     * @param {boolean} visible - Whether element should be visible
     */
    setVisibility(key, visible) {
        const element = this.getElementSafe(key);
        if (element) {
            if (visible) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }

    /**
     * Add event listener to element
     * @param {string} key - Element key or ID
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    addEventListener(key, event, handler) {
        const element = this.getElementSafe(key);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    /**
     * Toggle CSS class on element
     * @param {string} key - Element key or ID
     * @param {string} className - CSS class name
     * @param {boolean} add - Whether to add (true) or remove (false) the class
     */
    toggleClass(key, className, add = true) {
        const element = this.getElementSafe(key);
        if (!element) {
            return;
        }
        element.classList.toggle(className, add);
    }

    /**
     * Add CSS class to element
     * @param {string} key - Element key or ID
     * @param {string} className - CSS class name to add
     */
    addClass(key, className) {
        this.toggleClass(key, className, true);
    }

    /**
     * Remove CSS class from element
     * @param {string} key - Element key or ID
     * @param {string} className - CSS class name to remove
     */
    removeClass(key, className) {
        this.toggleClass(key, className, false);
    }

    /**
     * Static method to escape HTML (doesn't require registry instance)
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Default DOM element mappings for the CPEE Debug Console
 * Maps semantic keys to actual DOM element IDs
 * Now uses ConfigManager for centralized configuration
 */
export const DEFAULT_DOM_MAPPINGS = configManager.getSection('dom.elementIds');
