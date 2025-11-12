/**
 * Hide Title Button
 * Button that scrolls the page up to hide the header section
 * Only visible in the stepviewer screen
 */

import { ICONS } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class HideTitleButton {
    constructor(domRegistry, eventBus = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        
        this.button = null;
        this.container = null;
    }

    /**
     * Create and return the hide title button element
     * @returns {HTMLElement} Hide title button element
     */
    createContainer() {
        if (this.container) {
            return this.container;
        }

        this.container = this.domRegistry.createElement('div', {
            id: 'hide-title-button',
            className: 'hide-title-button'
        });

        this.button = this.domRegistry.createElement('button', {
            id: 'hide-title-btn',
            className: 'hide-title-btn',
            type: 'button',
            'aria-label': 'Hide title',
            title: 'Hide title'
        });

        // Create text span
        const textSpan = this.domRegistry.createElement('span', {
            textContent: 'hide title'
        });

        // Create icon span and add icon
        const iconSpan = this.domRegistry.createElement('span', {
            className: 'hide-title-icon',
            innerHTML: ICONS.COLLAPSE_TITLE
        });

        // Append text and icon to button
        this.button.appendChild(textSpan);
        this.button.appendChild(iconSpan);

        this.container.appendChild(this.button);
        
        return this.container;
    }

    /**
     * Initialize hide title button (creates container and sets up listeners)
     * @param {HTMLElement} parentContainer - Parent container to append to
     */
    initialize(parentContainer) {
        const container = this.createContainer();
        if (parentContainer && !parentContainer.contains(container)) {
            parentContainer.appendChild(container);
        }

        // Register elements after they're in the DOM
        if (this.domRegistry) {
            this.domRegistry.register('hideTitleButton', 'hide-title-button');
            this.domRegistry.register('hideTitleBtn', 'hide-title-btn');
        }
        
        // Attach click listener
        this.attachClickListener();
    }

    /**
     * Scroll the page up until the top of the browser reaches the bottom edge of the header section
     */
    hideHeader() {
        // Find the header element with class "header"
        const headerElement = document.querySelector('header.header');
        
        if (!headerElement) {
            return;
        }

        // Get the position of the header element relative to the document
        const headerRect = headerElement.getBoundingClientRect();
        // Calculate the bottom edge of the header in document coordinates
        const headerBottom = headerRect.bottom + window.scrollY;
        
        // Scroll so that the top of the viewport aligns with the bottom of the header
        // This means scrolling to the header's bottom position
        const scrollPosition = headerBottom;
        
        // Smooth scroll to the calculated position
        window.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
        });
    }

    /**
     * Attach click event listener to button
     */
    attachClickListener() {
        if (!this.button) {
            this.button = this.domRegistry?.getElementSafe('hideTitleBtn') || document.getElementById('hide-title-btn');
        }
        
        if (this.button) {
            // Remove existing listener if any
            this.button.onclick = (event) => {
                event.stopPropagation();
                this.hideHeader();
            };
        }
    }

    /**
     * Show the hide title button container
     */
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    /**
     * Hide the hide title button container
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Clean up event listeners
     */
    cleanup() {
        // Cleanup is handled by removing the button listener
        if (this.button) {
            this.button.onclick = null;
        }
    }
}

