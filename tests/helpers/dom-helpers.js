/**
 * DOM Helper Utilities
 * Utilities for DOM manipulation in tests
 */

/**
 * Create a DOM element
 * @param {string} tagName - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {string} textContent - Element text content
 * @returns {HTMLElement} Created element
 */
export function createElement(tagName = 'div', attributes = {}, textContent = '') {
    const element = document.createElement(tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        } else {
            element[key] = value;
        }
    });
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
}

/**
 * Create an SVG element
 * @param {string} tagName - SVG tag name
 * @param {Object} attributes - Element attributes
 * @returns {SVGElement} Created SVG element
 */
export function createSVG(tagName = 'svg', attributes = {}) {
    const namespace = 'http://www.w3.org/2000/svg';
    const element = document.createElementNS(namespace, tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    
    return element;
}

/**
 * Simulate a click event
 * @param {HTMLElement} element - Element to click
 * @param {Object} options - Click options
 * @returns {boolean} Whether default was prevented
 */
export function simulateClick(element, options = {}) {
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ...options,
    });
    
    return element.dispatchEvent(event);
}

/**
 * Simulate an input event
 * @param {HTMLInputElement} element - Input element
 * @param {string} value - Value to set
 * @returns {void}
 */
export function simulateInput(element, value) {
    element.value = value;
    const event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });
    element.dispatchEvent(event);
}

/**
 * Query selector with optional container
 * @param {string} selector - CSS selector
 * @param {HTMLElement} container - Container element (default: document)
 * @returns {HTMLElement|null} Found element
 */
export function querySelector(selector, container = document) {
    return container.querySelector(selector);
}

/**
 * Query all elements matching selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} container - Container element (default: document)
 * @returns {NodeList} Found elements
 */
export function querySelectorAll(selector, container = document) {
    return container.querySelectorAll(selector);
}

/**
 * Clean up DOM after tests
 * @param {HTMLElement} element - Element to remove (optional, removes all if not provided)
 * @returns {void}
 */
export function cleanupDOM(element = null) {
    if (element) {
        element.remove();
    } else {
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    }
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {Object} options - Options
 * @param {number} options.timeout - Maximum wait time (default: 5000ms)
 * @param {number} options.interval - Check interval (default: 50ms)
 * @returns {Promise<HTMLElement>} Found element
 */
export async function waitForElement(selector, options = {}) {
    const { timeout = 5000, interval = 50 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    
    throw new Error(`Element "${selector}" not found within ${timeout}ms`);
}

/**
 * Wait for element to be removed from DOM
 * @param {string} selector - CSS selector
 * @param {Object} options - Options
 * @param {number} options.timeout - Maximum wait time (default: 5000ms)
 * @param {number} options.interval - Check interval (default: 50ms)
 * @returns {Promise<void>}
 */
export async function waitForElementRemoval(selector, options = {}) {
    const { timeout = 5000, interval = 50 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (!element) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    
    throw new Error(`Element "${selector}" still present after ${timeout}ms`);
}

/**
 * Get computed styles for an element
 * @param {HTMLElement} element - Element
 * @returns {CSSStyleDeclaration} Computed styles
 */
export function getComputedStyles(element) {
    return window.getComputedStyle(element);
}

/**
 * Check if element is visible
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} Whether element is visible
 */
export function isVisible(element) {
    if (!element) {
        return false;
    }
    
    const styles = getComputedStyles(element);
    return (
        styles.display !== 'none' &&
        styles.visibility !== 'hidden' &&
        styles.opacity !== '0'
    );
}

/**
 * Create a test container in the DOM
 * @param {string} id - Container ID
 * @returns {HTMLElement} Container element
 */
export function createTestContainer(id = 'test-container') {
    let container = document.getElementById(id);
    if (!container) {
        container = createElement('div', { id });
        document.body.appendChild(container);
    }
    return container;
}

