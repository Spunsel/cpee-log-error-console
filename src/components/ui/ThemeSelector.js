/**
 * Theme Selector
 * Handles dropdown menu for CPEE theme selection
 * Allows switching between preset, presetid, and presetaltid themes
 */

import { ICONS } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { configManager } from '../../config/ConfigManager.js';

export class ThemeSelector {
    constructor(domRegistry, eventBus = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.isOpen = false;
        
        // Available themes
        this.themes = [
            { id: 'preset', label: 'Preset' },
            { id: 'presetid', label: 'Preset ID' },
            { id: 'presetaltid', label: 'Preset Alt ID' }
        ];
        
        this.container = null;
        this.storageKey = 'cpee-debug-console-theme';
        this.currentTheme = this.loadThemeFromStorage();
    }

    /**
     * Create and return the theme selector container element
     * @returns {HTMLElement} Theme selector container element
     */
    createContainer() {
        if (this.container) {
            return this.container;
        }

        // Load theme from localStorage or use default
        this.currentTheme = this.loadThemeFromStorage();

        this.container = this.domRegistry.createElement('div', {
            id: 'theme-selector',
            className: 'theme-selector',
            innerHTML: `
                <div class="theme-dropdown-container">
                    <button id="theme-dropdown-trigger" class="theme-dropdown-trigger" aria-label="Select theme" aria-haspopup="listbox" aria-expanded="false" title="${this.getTooltipText()}">
                        ${ICONS.THEME}
                    </button>
                    <div id="theme-dropdown-menu" class="theme-dropdown-menu" role="listbox" aria-labelledby="theme-dropdown-trigger" style="display: none;"></div>
                </div>
            `
        });
        
        return this.container;
    }

    /**
     * Initialize theme selector (creates container and sets up listeners)
     * @param {HTMLElement} parentContainer - Parent container to append to
     */
    initialize(parentContainer) {
        const container = this.createContainer();
        if (parentContainer && !parentContainer.contains(container)) {
            parentContainer.appendChild(container);
        }

        // Register elements after they're in the DOM
        if (this.domRegistry) {
            this.domRegistry.register('themeSelector', 'theme-selector');
            this.domRegistry.register('themeDropdownTrigger', 'theme-dropdown-trigger');
            this.domRegistry.register('themeDropdownMenu', 'theme-dropdown-menu');
        }
        
        // Render dropdown items
        this.renderDropdownOptions();
        
        // Update tooltip with current theme (after container is in DOM)
        setTimeout(() => {
            this.updateTooltip();
        }, 0);
        
        // Attach trigger listener after container is in the DOM
        this.attachTriggerListener();
    }

    /**
     * Get tooltip text showing current theme
     * @returns {string} Tooltip text (e.g., "theme: preset")
     */
    getTooltipText() {
        const currentThemeObj = this.themes.find(t => t.id === this.currentTheme);
        return `theme: ${currentThemeObj ? currentThemeObj.label : this.currentTheme}`;
    }
    
    /**
     * Update tooltip on the trigger button
     */
    updateTooltip() {
        const trigger = document.getElementById('theme-dropdown-trigger');
        if (trigger) {
            trigger.setAttribute('title', this.getTooltipText());
        }
    }

    /**
     * Load theme from localStorage
     * @returns {string} Theme ID (default: 'presetid')
     */
    loadThemeFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const themeExists = this.themes.some(t => t.id === stored);
                if (themeExists) {
                    // Update config to match stored theme
                    configManager.set('cpee.wfadaptor.themePath', `src/libs/cpee-layout/themes/${stored}/theme.js`);
                    return stored;
                }
            }
        } catch (error) {
            console.warn('Failed to load theme from storage:', error);
        }
        // Default theme is presetid - initialize if nothing stored
        const defaultTheme = 'presetid';
        this.saveThemeToStorage(defaultTheme);
        configManager.set('cpee.wfadaptor.themePath', `src/libs/cpee-layout/themes/${defaultTheme}/theme.js`);
        return defaultTheme;
    }

    /**
     * Save theme to localStorage
     * @param {string} theme - Theme ID to save
     */
    saveThemeToStorage(theme) {
        try {
            localStorage.setItem(this.storageKey, theme);
        } catch (error) {
            console.warn('Failed to save theme to storage:', error);
        }
    }

    /**
     * Render dropdown theme options
     */
    renderDropdownOptions() {
        if (!this.domRegistry) {
            return;
        }

        const menu = this.domRegistry.getElementSafe('themeDropdownMenu') || document.getElementById('theme-dropdown-menu');
        if (!menu) {
            return;
        }

        // Clear existing items
        menu.innerHTML = '';

        // Create theme option items
        this.themes.forEach((theme) => {
            const item = document.createElement('div');
            item.className = 'theme-dropdown-item';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', theme.id === this.currentTheme);
            item.textContent = theme.label;
            
            // Mark current theme as active
            if (theme.id === this.currentTheme) {
                item.classList.add('active');
            } else {
                // Add click listener for non-active themes
                item.addEventListener('click', () => {
                    this.selectTheme(theme.id);
                });
            }

            menu.appendChild(item);
        });
    }

    /**
     * Toggle dropdown open/closed state
     */
    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    /**
     * Open dropdown
     */
    openDropdown() {
        const menu = this.domRegistry.getElementSafe('themeDropdownMenu') || document.getElementById('theme-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('themeDropdownTrigger') || document.getElementById('theme-dropdown-trigger');

        if (!menu || !trigger) {
            return;
        }

        menu.style.display = 'block';
        trigger.setAttribute('aria-expanded', 'true');
        this.isOpen = true;

        // Add click-outside listener with capture phase
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside, true);
        }, 0);
    }

    /**
     * Close dropdown
     */
    closeDropdown() {
        const menu = this.domRegistry.getElementSafe('themeDropdownMenu') || document.getElementById('theme-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('themeDropdownTrigger') || document.getElementById('theme-dropdown-trigger');

        if (!menu || !trigger) {
            return;
        }

        menu.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        this.isOpen = false;

        // Remove click-outside listener
        document.removeEventListener('click', this.handleClickOutside, true);
    }

    /**
     * Handle click outside dropdown
     * @param {MouseEvent} event - Click event
     */
    handleClickOutside = (event) => {
        const menu = this.domRegistry.getElementSafe('themeDropdownMenu') || document.getElementById('theme-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('themeDropdownTrigger') || document.getElementById('theme-dropdown-trigger');
        const container = document.getElementById('theme-dropdown-container');

        if (!menu || !trigger) {
            return;
        }

        // Check if click is inside container (which includes both trigger and menu)
        const clickedInsideContainer = container && container.contains(event.target);
        const clickedInsideMenu = menu && menu.contains(event.target);
        const clickedInsideTrigger = trigger && trigger.contains(event.target);

        // Close if click is outside container, menu, and trigger
        if (!clickedInsideContainer && !clickedInsideMenu && !clickedInsideTrigger) {
            this.closeDropdown();
        }
    };

    /**
     * Select a theme
     * @param {string} themeId - Theme ID to apply
     */
    selectTheme(themeId) {
        // Prevent selecting current theme
        if (themeId === this.currentTheme) {
            return;
        }

        // Validate theme option
        if (!this.themes.some(t => t.id === themeId)) {
            return;
        }

        // Close dropdown
        this.closeDropdown();

        // Update current theme
        this.currentTheme = themeId;

        // Save to localStorage
        this.saveThemeToStorage(themeId);

        // Update config manager
        configManager.set('cpee.wfadaptor.themePath', `src/libs/cpee-layout/themes/${themeId}/theme.js`);

        // Re-render dropdown to show new active state
        this.renderDropdownOptions();

        // Update tooltip to show new theme
        this.updateTooltip();

        // Emit theme change event
        this.eventBus.emit('themeSelector:themeChanged', { theme: themeId });
    }

    /**
     * Get current theme value
     * @returns {string} Current theme ID
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Attach event listener to dropdown trigger
     */
    attachTriggerListener() {
        let trigger = null;
        
        if (this.container) {
            trigger = this.container.querySelector('#theme-dropdown-trigger');
        }
        
        if (!trigger) {
            trigger = this.domRegistry?.getElementSafe('themeDropdownTrigger');
        }
        
        if (!trigger) {
            trigger = document.getElementById('theme-dropdown-trigger');
        }

        if (!trigger) {
            console.warn('ThemeSelector: Could not find trigger element');
            return;
        }

        // Remove existing listener if any
        trigger.onclick = (event) => {
            event.stopPropagation();
            this.toggleDropdown();
        };
    }

    /**
     * Clean up event listeners
     */
    cleanup() {
        document.removeEventListener('click', this.handleClickOutside, true);
    }
}

