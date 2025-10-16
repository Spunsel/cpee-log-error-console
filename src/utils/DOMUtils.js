/**
 * DOM Utilities
 * Helper functions for DOM manipulation
 */

export class DOMUtils {
    /**
     * Safely get element by ID
     * @param {string} id - Element ID
     * @returns {Element|null} Element or null if not found
     */
    static getElementById(id) {
        return document.getElementById(id);
    }

    /**
     * Safely query selector
     * @param {string} selector - CSS selector
     * @returns {Element|null} Element or null if not found
     */
    static querySelector(selector) {
        return document.querySelector(selector);
    }

    /**
     * Safely query all selectors
     * @param {string} selector - CSS selector
     * @returns {NodeList} NodeList of elements
     */
    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * Update text content of element
     * @param {string} elementId - Element ID
     * @param {string} content - Text content
     */
    static updateTextContent(elementId, content) {
        const element = this.getElementById(elementId);
        if (element) {
            element.textContent = content;
        }
    }

    /**
     * Update HTML content of element
     * @param {string} elementId - Element ID
     * @param {string} content - HTML content
     */
    static updateHTMLContent(elementId, content) {
        const element = this.getElementById(elementId);
        if (element) {
            element.innerHTML = content;
        }
    }

    /**
     * Add CSS class to element
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
     * Remove CSS class from element
     * @param {string} elementId - Element ID
     * @param {string} className - CSS class name
     */
    static removeClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (element) {
            element.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class on element
     * @param {string} elementId - Element ID
     * @param {string} className - CSS class name
     */
    static toggleClass(elementId, className) {
        const element = this.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
        }
    }

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
}
