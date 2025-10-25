/**
 * DOM Utilities
 * Pure utility functions for DOM manipulation
 * Note: For element access and manipulation, use DOMRegistry instead
 */

export class DOMUtils {
    /**
     * Escape HTML for safe display
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Safely get element by ID (fallback for components without DOMRegistry)
     * @param {string} id - Element ID
     * @returns {Element|null} Element or null if not found
     */
    static getElementById(id) {
        return document.getElementById(id);
    }

    /**
     * Safely query selector (fallback for components without DOMRegistry)
     * @param {string} selector - CSS selector
     * @returns {Element|null} Element or null if not found
     */
    static querySelector(selector) {
        return document.querySelector(selector);
    }

    /**
     * Add CSS class to element by ID
     * @param {string} elementId - Element ID
     * @param {string} className - CSS class name
     */
    static addClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (element) {
            element.classList.add(className);
        }
    }

    /**
     * Remove CSS class from element by ID
     * @param {string} elementId - Element ID
     * @param {string} className - CSS class name
     */
    static removeClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (element) {
            element.classList.remove(className);
        }
    }
}
