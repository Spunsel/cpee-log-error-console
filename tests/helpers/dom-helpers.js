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
        } else if (key === 'id') {
            element.id = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
}

/**
 * Create an SVG element
 * @param {string} tagName - SVG tag name (e.g., 'svg', 'circle', 'path')
 * @param {Object} attributes - SVG attributes
 * @param {string} innerHTML - Inner SVG content
 * @returns {SVGElement} Created SVG element
 */
export function createSVG(tagName = 'svg', attributes = {}, innerHTML = '') {
    const namespace = 'http://www.w3.org/2000/svg';
    const element = document.createElementNS(namespace, tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    
    if (innerHTML) {
        element.innerHTML = innerHTML;
    }
    
    return element;
}

/**
 * Simulate a click event
 * @param {HTMLElement} element - Element to click
 * @param {Object} options - Click options
 * @returns {Event} The click event
 */
export function simulateClick(element, options = {}) {
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        ...options,
    });
    
    element.dispatchEvent(event);
    return event;
}

/**
 * Simulate an input event
 * @param {HTMLElement} element - Input element
 * @param {string} value - Input value
 * @returns {Event} The input event
 */
export function simulateInput(element, value) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value;
    } else {
        element.textContent = value;
    }
    
    const event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });
    
    element.dispatchEvent(event);
    return event;
}

/**
 * Simulate a change event
 * @param {HTMLElement} element - Element to change
 * @param {string} value - New value
 * @returns {Event} The change event
 */
export function simulateChange(element, value) {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
        element.value = value;
    } else {
        element.textContent = value;
    }
    
    const event = new Event('change', {
        bubbles: true,
        cancelable: true,
    });
    
    element.dispatchEvent(event);
    return event;
}

/**
 * Simulate a keyboard event
 * @param {HTMLElement} element - Target element
 * @param {string} key - Key to press
 * @param {Object} options - Keyboard event options
 * @returns {KeyboardEvent} The keyboard event
 */
export function simulateKeyPress(element, key, options = {}) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...options,
    });
    
    element.dispatchEvent(event);
    return event;
}

/**
 * Query selector with optional container
 * @param {string} selector - CSS selector
 * @param {HTMLElement} container - Container element (defaults to document)
 * @returns {HTMLElement|null} Found element or null
 */
export function querySelector(selector, container = document) {
    return container.querySelector(selector);
}

/**
 * Query all elements matching selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} container - Container element (defaults to document)
 * @returns {NodeList} Found elements
 */
export function querySelectorAll(selector, container = document) {
    return container.querySelectorAll(selector);
}

/**
 * Clean up DOM after tests
 * @param {HTMLElement} container - Container to clean (defaults to document.body)
 */
export function cleanupDOM(container = document.body) {
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Append element to container
 * @param {HTMLElement} element - Element to append
 * @param {HTMLElement} container - Container element (defaults to document.body)
 * @returns {HTMLElement} The appended element
 */
export function appendElement(element, container = document.body) {
    container.appendChild(element);
    return element;
}

/**
 * Remove element from DOM
 * @param {HTMLElement} element - Element to remove
 */
export function removeElement(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Get computed style for an element
 * @param {HTMLElement} element - Element to get style for
 * @param {string} property - CSS property name
 * @returns {string} Computed style value
 */
export function getComputedStyle(element, property) {
    const styles = window.getComputedStyle(element);
    return styles.getPropertyValue(property);
}

/**
 * Check if element has class
 * @param {HTMLElement} element - Element to check
 * @param {string} className - Class name
 * @returns {boolean} True if element has class
 */
export function hasClass(element, className) {
    return element.classList.contains(className);
}

/**
 * Add class to element
 * @param {HTMLElement} element - Element
 * @param {string} className - Class name to add
 */
export function addClass(element, className) {
    element.classList.add(className);
}

/**
 * Remove class from element
 * @param {HTMLElement} element - Element
 * @param {string} className - Class name to remove
 */
export function removeClass(element, className) {
    element.classList.remove(className);
}

/**
 * Toggle class on element
 * @param {HTMLElement} element - Element
 * @param {string} className - Class name to toggle
 */
export function toggleClass(element, className) {
    element.classList.toggle(className);
}

