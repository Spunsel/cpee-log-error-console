/**
 * Scale Display
 * Handles dropdown menu for graph scaling
 * Provides functionality to scale CPEE and Mermaid graphs
 */

import { ICONS } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { configManager } from '../../config/ConfigManager.js';

export class ScaleDisplay {
    constructor(domRegistry, eventBus = null, stateManager = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.isOpen = false;
        
        // Load scale options from configuration
        this.scaleOptions = configManager.get('rendering.scaling.levels') || [1.0];
        this.defaultScale = configManager.get('rendering.scaling.default') || 1.0;
        
        // Ensure scale options is sorted and contains valid numbers
        this.scaleOptions = this.scaleOptions
            .filter(scale => typeof scale === 'number' && scale > 0)
            .sort((a, b) => a - b);
        
        if (this.scaleOptions.length === 0) {
            // Fallback if config is invalid
            this.scaleOptions = [1.0];
        }
        
        this.container = null;
        
        // Load scale from StateManager (which loads from localStorage)
        let storedScale = this.stateManager.getState('ui.scale');
        if (!storedScale || !this.scaleOptions.includes(storedScale)) {
            storedScale = this.defaultScale;
            this.stateManager.setState('ui.scale', storedScale);
        }
        this.currentScale = storedScale;
        
        // Subscribe to scale changes
        this.stateManager.subscribe('ui.scale', (scale) => {
            if (this.currentScale !== scale && this.scaleOptions.includes(scale)) {
                this.currentScale = scale;
                this.eventBus.emit('scaleDisplay:scaleChanged', { scale });
            }
        });
    }

    /**
     * Create and return the scale display container element
     * @returns {HTMLElement} Scale display container element
     */
    createContainer() {
        if (this.container) {
            return this.container;
        }

        // Scale is already loaded from StateManager in constructor

        this.container = this.domRegistry.createElement('div', {
            id: 'scale-display',
            className: 'scale-display',
            innerHTML: `
                <div class="scale-dropdown-container">
                    <button id="scale-dropdown-trigger" class="scale-dropdown-trigger" aria-label="Scale graph" aria-haspopup="listbox" aria-expanded="false" title="${this.getTooltipText()}">
                        ${ICONS.GRAPH_SCALE}
                    </button>
                    <div id="scale-dropdown-menu" class="scale-dropdown-menu" role="listbox" aria-labelledby="scale-dropdown-trigger" style="display: none;"></div>
                </div>
            `
        });
        
        return this.container;
    }

    /**
     * Initialize scale display (creates container and sets up listeners)
     * @param {HTMLElement} parentContainer - Parent container to append to
     */
    initialize(parentContainer) {
        const container = this.createContainer();
        if (parentContainer && !parentContainer.contains(container)) {
            parentContainer.appendChild(container);
        }

        // Register elements after they're in the DOM
        if (this.domRegistry) {
            this.domRegistry.register('scaleDisplay', 'scale-display');
            this.domRegistry.register('scaleDropdownTrigger', 'scale-dropdown-trigger');
            this.domRegistry.register('scaleDropdownMenu', 'scale-dropdown-menu');
        }
        // Render dropdown items
        this.renderDropdownOptions();
        // Update tooltip with current scale (after container is in DOM)
        setTimeout(() => {
            this.updateTooltip();
        }, 0);
        // Attach trigger listener after container is in the DOM
        this.attachTriggerListener();
    }

    /**
     * Format scale value for display
     * @param {number} scale - Scale value (e.g., 0.25, 0.5, 0.75, 1.0)
     * @returns {string} Formatted scale string (e.g., "0.25x", "1x")
     */
    formatScale(scale) {
        return scale === 1.0 ? '1x' : `${scale}x`;
    }
    
    /**
     * Get tooltip text showing current scale
     * @returns {string} Tooltip text (e.g., "graph scale: 1x")
     */
    getTooltipText() {
        return `graph scale: ${this.formatScale(this.currentScale)}`;
    }
    
    /**
     * Update tooltip on the trigger button
     */
    updateTooltip() {
        const trigger = document.getElementById('scale-dropdown-trigger');
        if (trigger) {
            trigger.setAttribute('title', this.getTooltipText());
        }
    }


    /**
     * Render dropdown scale options
     */
    renderDropdownOptions() {
        if (!this.domRegistry) {
            return;
        }

        const menu = this.domRegistry.getElementSafe('scaleDropdownMenu') || document.getElementById('scale-dropdown-menu');
        if (!menu) {
            return;
        }

        // Clear existing items
        menu.innerHTML = '';

        // Create scale option items
        this.scaleOptions.forEach((scale) => {
            const item = document.createElement('div');
            item.className = 'scale-dropdown-item';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', scale === this.currentScale);
            item.textContent = this.formatScale(scale);
            
            // Mark current scale as active
            if (scale === this.currentScale) {
                item.classList.add('active');
            } else {
                // Add click listener for non-active scales
                item.addEventListener('click', () => {
                    this.selectScale(scale);
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
        const menu = this.domRegistry.getElementSafe('scaleDropdownMenu') || document.getElementById('scale-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('scaleDropdownTrigger') || document.getElementById('scale-dropdown-trigger');

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
        const menu = this.domRegistry.getElementSafe('scaleDropdownMenu') || document.getElementById('scale-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('scaleDropdownTrigger') || document.getElementById('scale-dropdown-trigger');

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
        const menu = this.domRegistry.getElementSafe('scaleDropdownMenu') || document.getElementById('scale-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('scaleDropdownTrigger') || document.getElementById('scale-dropdown-trigger');
        const container = document.getElementById('scale-dropdown-container');

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
     * Select a scale
     * @param {number} scale - Scale value to apply (0.25, 0.5, 0.75, or 1.0)
     */
    selectScale(scale) {
        // Prevent selecting current scale
        if (scale === this.currentScale) {
            return;
        }

        // Validate scale option
        if (!this.scaleOptions.includes(scale)) {
            return;
        }

        // Close dropdown
        this.closeDropdown();

        // Update current scale
        this.currentScale = scale;

        // Update StateManager (which will persist to localStorage automatically)
        this.stateManager.setState('ui.scale', scale);

        // Re-render dropdown to show new active state
        this.renderDropdownOptions();

        // Update tooltip to show new scale
        this.updateTooltip();

        // Emit scale change event
        this.eventBus.emit('scaleDisplay:scaleChanged', { scale });
    }

    /**
     * Get current scale value
     * @returns {number} Current scale value
     */
    getCurrentScale() {
        return this.currentScale;
    }

    /**
     * Attach event listener to dropdown trigger
     */
    attachTriggerListener() {
        let trigger = null;
        
        if (this.container) {
            trigger = this.container.querySelector('#scale-dropdown-trigger');
        }
        
        if (!trigger) {
            trigger = this.domRegistry?.getElementSafe('scaleDropdownTrigger');
        }
        
        if (!trigger) {
            trigger = document.getElementById('scale-dropdown-trigger');
        }

        if (!trigger) {
            console.warn('ScaleDisplay: Could not find trigger element');
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

