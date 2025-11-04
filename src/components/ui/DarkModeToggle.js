/**
 * Dark Mode Toggle
 * Handles dark/light mode switching for the application
 * Manages theme state and applies dark mode styles
 */

import { ICONS } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class DarkModeToggle {
    constructor(domRegistry, eventBus = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        
        this.storageKey = 'cpee-debug-console-dark-mode';
        this.isDarkMode = this.loadDarkModeFromStorage();
        
        this.button = null;
        this.container = null;
    }

    /**
     * Create and return the dark mode toggle button element
     * @returns {HTMLElement} Dark mode toggle button element
     */
    createContainer() {
        if (this.container) {
            return this.container;
        }

        this.container = this.domRegistry.createElement('div', {
            id: 'dark-mode-toggle',
            className: 'dark-mode-toggle'
        });

        this.button = this.domRegistry.createElement('button', {
            id: 'dark-mode-toggle-btn',
            className: 'dark-mode-toggle-btn',
            type: 'button',
            'aria-label': this.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode',
            title: this.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode',
            innerHTML: this.isDarkMode ? ICONS.SUN : ICONS.MOON
        });

        this.container.appendChild(this.button);
        
        return this.container;
    }

    /**
     * Initialize dark mode toggle (creates container and sets up listeners)
     * @param {HTMLElement} parentContainer - Parent container to append to
     */
    initialize(parentContainer) {
        const container = this.createContainer();
        if (parentContainer && !parentContainer.contains(container)) {
            parentContainer.appendChild(container);
        }

        // Register elements after they're in the DOM
        if (this.domRegistry) {
            this.domRegistry.register('darkModeToggle', 'dark-mode-toggle');
            this.domRegistry.register('darkModeToggleBtn', 'dark-mode-toggle-btn');
        }
        
        // Apply initial dark mode state
        this.applyDarkMode(this.isDarkMode);
        
        // Attach click listener
        this.attachToggleListener();
    }

    /**
     * Load dark mode preference from localStorage
     * @returns {boolean} Dark mode state (default: false)
     */
    loadDarkModeFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored !== null) {
                return stored === 'true';
            }
        } catch (error) {
            console.warn('Failed to load dark mode from storage:', error);
        }
        // Default to light mode
        return false;
    }

    /**
     * Save dark mode preference to localStorage
     * @param {boolean} isDark - Dark mode state
     */
    saveDarkModeToStorage(isDark) {
        try {
            localStorage.setItem(this.storageKey, isDark.toString());
        } catch (error) {
            console.warn('Failed to save dark mode to storage:', error);
        }
    }

    /**
     * Apply dark mode to the document
     * @param {boolean} isDark - Whether to enable dark mode
     */
    applyDarkMode(isDark) {
        const root = document.documentElement;
        
        if (isDark) {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }
        
        // Update Prism.js theme if available
        this.updatePrismTheme(isDark);
    }

    /**
     * Update Prism.js syntax highlighting theme
     * @param {boolean} isDark - Whether dark mode is enabled
     */
    updatePrismTheme(isDark) {
        const prismThemeLink = document.getElementById('prism-theme');
        if (prismThemeLink) {
            if (isDark) {
                prismThemeLink.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
            } else {
                prismThemeLink.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css';
            }
        }
    }

    /**
     * Toggle dark mode on/off
     */
    toggle() {
        this.isDarkMode = !this.isDarkMode;
        this.applyDarkMode(this.isDarkMode);
        this.saveDarkModeToStorage(this.isDarkMode);
        this.updateButton();
        
        // Emit dark mode change event
        this.eventBus.emit('darkMode:toggled', { isDark: this.isDarkMode });
    }

    /**
     * Update button appearance based on current mode
     */
    updateButton() {
        if (!this.button) {
            this.button = document.getElementById('dark-mode-toggle-btn');
        }
        
        if (this.button) {
            this.button.innerHTML = this.isDarkMode ? ICONS.SUN : ICONS.MOON;
            this.button.setAttribute('aria-label', this.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode');
            this.button.setAttribute('title', this.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode');
        }
    }

    /**
     * Attach click event listener to toggle button
     */
    attachToggleListener() {
        if (!this.button) {
            this.button = document.getElementById('dark-mode-toggle-btn');
        }
        
        if (this.button) {
            // Remove existing listener if any
            this.button.onclick = (event) => {
                event.stopPropagation();
                this.toggle();
            };
        }
    }

    /**
     * Get current dark mode state
     * @returns {boolean} Current dark mode state
     */
    getDarkMode() {
        return this.isDarkMode;
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

