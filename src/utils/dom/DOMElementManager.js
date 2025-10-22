/**
 * DOM Element Manager
 * Handles DOM element access with DOMRegistry integration
 * Provides consistent element access pattern across components
 */

import { DOMUtils } from './DOMUtils.js';

export class DOMElementManager {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
    }

    /**
     * Get DOM element by key with fallback to direct ID access
     * Uses registry if available, otherwise performs direct DOM lookup
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (this.domRegistry) {
            return this.domRegistry.getElementSafe(key);
        }
        // No registry available, use direct DOM access
        return DOMUtils.getElementById(key);
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
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else {
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
        const element = this.getElement(key);
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
        const element = this.getElement(key);
        if (element) {
            if (visible) {
                DOMUtils.removeClass(element.id || key, 'hidden');
            } else {
                DOMUtils.addClass(element.id || key, 'hidden');
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
        const element = this.getElement(key);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    /**
     * Remove element if it exists
     * @param {string} key - Element key or ID
     */
    removeElement(key) {
        const element = this.getElement(key);
        if (element) {
            element.remove();
        }
    }
}
