/**
 * Step Dropdown
 * Handles dropdown menu for skipping to arbitrary steps
 * Provides functionality to render step list and handle dropdown interactions
 */

import { LogService } from '../../services/LogService.js';
import { createStepNumberIcon, ICONS } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class StepDropdown {
    constructor(domRegistry, eventBus = null, instanceService = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.instanceService = instanceService;
        this.isOpen = false;
        this.totalSteps = 0;
        this.currentStep = 0;
        this.container = null;
    }

    /**
     * Create and return the dropdown container element
     * @returns {HTMLElement} Dropdown container element
     */
    createContainer() {
        if (this.container) {
            return this.container;
        }

        this.container = this.domRegistry.createElement('div', {
            id: 'step-navigation-skip',
            className: 'step-navigation-skip',
            innerHTML: `
                <div class="step-dropdown-container">
                    <button id="step-dropdown-trigger" class="step-dropdown-trigger" aria-label="Skip to step" aria-haspopup="listbox" aria-expanded="false">
                        ${ICONS.NAV_SKIP}
                    </button>
                    <div id="step-dropdown-menu" class="step-dropdown-menu" role="listbox" aria-labelledby="step-dropdown-trigger" style="display: none;"></div>
                </div>
            `
        });

        // Register elements after creation
        if (this.domRegistry) {
            this.domRegistry.register('stepNavigationSkip', 'step-navigation-skip');
            this.domRegistry.register('stepDropdownTrigger', 'step-dropdown-trigger');
            this.domRegistry.register('stepDropdownMenu', 'step-dropdown-menu');
        }
        
        return this.container;
    }

    /**
     * Initialize dropdown (creates container and sets up listeners)
     * @param {HTMLElement} parentContainer - Parent container to append to
     */
    initialize(parentContainer) {
        const container = this.createContainer();
        if (parentContainer && !parentContainer.contains(container)) {
            parentContainer.appendChild(container);
        }
        // Attach trigger listener after container is in the DOM
        this.attachTriggerListener();
    }

    /**
     * Set callback for when a step is selected (deprecated - use EventBus)
     * @param {Function} callback - Callback function(stepNumber)
     * @deprecated Use EventBus 'stepDropdown:stepSelected' event instead
     */
    setOnStepSelect(callback) {
        console.warn('StepDropdown.setOnStepSelect() is deprecated - use EventBus "stepDropdown:stepSelected" event instead');
        // Keep for backward compatibility but emit event instead
        this.eventBus.on('stepDropdown:stepSelected', callback);
    }

    /**
     * Render dropdown steps
     * @param {number} stepCount - Total number of steps
     * @param {number} currentStep - Current step number (1-indexed)
     * @param {Array} steps - Array of CPEEStep objects (optional, for user input display)
     */
    renderDropdownSteps(stepCount, currentStep, steps = null) {
        if (!this.domRegistry) {
            return;
        }

        this.totalSteps = stepCount;
        this.currentStep = currentStep;
        this.steps = steps;

        const menu = this.domRegistry.getElementSafe('stepDropdownMenu') || document.getElementById('step-dropdown-menu');
        if (!menu) {
            return;
        }

        // Clear existing items
        menu.innerHTML = '';

        // Don't render if only one step
        if (stepCount <= 1) {
            this.closeDropdown();
            return;
        }

        // Create step items
        for (let i = 1; i <= stepCount; i++) {
            const item = document.createElement('div');
            item.className = 'step-dropdown-item';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', i === currentStep);
            
            // Create step number icon (SVG with blue circle)
            const stepIcon = createStepNumberIcon(i);
            
            // Get user input for this step
            const step = this.steps && this.steps[i - 1] ? this.steps[i - 1] : null;
            const displayUserInput = step ? LogService.getUserInputForStep(step, 40) : null; // Truncated for display
            const fullUserInput = step ? LogService.getUserInputForStep(step) : null; // Full for tooltip (no truncation)
            
            // Add title attribute to icon with full user input
            stepIcon.setAttribute('title', fullUserInput || `Step ${i}`);
            
            item.appendChild(stepIcon);
            
            // Add user input text if available
            if (displayUserInput) {
                const textSpan = document.createElement('span');
                textSpan.className = 'step-dropdown-text';
                textSpan.textContent = displayUserInput;
                textSpan.title = fullUserInput || displayUserInput; // Full text on hover
                item.appendChild(textSpan);
            }
            
            // Add title attribute for accessibility (shows full user input)
            item.title = fullUserInput ? `Step ${i} - ${fullUserInput}` : `Step ${i}`;

            // Disable current step
            if (i === currentStep) {
                item.classList.add('active');
                item.setAttribute('aria-disabled', 'true');
            } else {
                // Add click listener for non-current steps
                item.addEventListener('click', () => {
                    this.selectStep(i);
                });
            }

            menu.appendChild(item);
        }
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
        const menu = this.domRegistry.getElementSafe('stepDropdownMenu') || document.getElementById('step-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('stepDropdownTrigger') || document.getElementById('step-dropdown-trigger');

        if (!menu || !trigger) {
            return;
        }

        // Only open if more than one step
        if (this.totalSteps <= 1) {
            return;
        }

        menu.style.display = 'block';
        trigger.setAttribute('aria-expanded', 'true');
        this.isOpen = true;

        // Add click-outside listener
        document.addEventListener('click', this.handleClickOutside);
    }

    /**
     * Close dropdown
     */
    closeDropdown() {
        const menu = this.domRegistry.getElementSafe('stepDropdownMenu') || document.getElementById('step-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('stepDropdownTrigger') || document.getElementById('step-dropdown-trigger');

        if (!menu || !trigger) {
            return;
        }

        menu.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        this.isOpen = false;

        // Remove click-outside listener
        document.removeEventListener('click', this.handleClickOutside);
    }

    /**
     * Handle click outside dropdown
     * @param {MouseEvent} event - Click event
     */
    handleClickOutside = (event) => {
        const menu = this.domRegistry.getElementSafe('stepDropdownMenu') || document.getElementById('step-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('stepDropdownTrigger') || document.getElementById('step-dropdown-trigger');
        const container = this.domRegistry.getElementSafe('stepNavigationSkip') || document.getElementById('step-navigation-skip');

        if (!menu || !trigger || !container) {
            return;
        }

        // Close if click is outside both menu and trigger
        if (!menu.contains(event.target) && !trigger.contains(event.target)) {
            this.closeDropdown();
        }
    };

    /**
     * Select a step
     * @param {number} stepNumber - Step number to navigate to (1-indexed)
     */
    selectStep(stepNumber) {
        // Prevent selecting current step
        if (stepNumber === this.currentStep) {
            return;
        }

        // Prevent selecting invalid step
        if (stepNumber < 1 || stepNumber > this.totalSteps) {
            return;
        }

        // Close dropdown
        this.closeDropdown();

        // If instanceService is available, navigate directly
        if (this.instanceService) {
            const index = stepNumber - 1;
            if (this.instanceService.goToStep(index)) {
                // Emit step change event after navigation
                const step = this.instanceService.getCurrentStep();
                const navInfo = this.instanceService.getNavigationInfo();
                this.eventBus.emit('stepNavigator:stepChanged', { step, navInfo });
            }
        } else {
            // Fallback: emit event for step selection (backward compatibility)
            this.eventBus.emit('stepDropdown:stepSelected', { stepNumber });
        }
        
        // Call callback for backward compatibility
        if (this.onStepSelect) {
            this.onStepSelect(stepNumber);
        }
    }

    /**
     * Attach event listener to dropdown trigger
     */
    attachTriggerListener() {
        // Try multiple ways to find the trigger element
        let trigger = null;
        
        if (this.container) {
            trigger = this.container.querySelector('#step-dropdown-trigger');
        }
        
        if (!trigger) {
            trigger = this.domRegistry?.getElementSafe('stepDropdownTrigger');
        }
        
        if (!trigger) {
            trigger = document.getElementById('step-dropdown-trigger');
        }

        if (!trigger) {
            console.warn('StepDropdown: Could not find trigger element');
            return;
        }

        // Remove existing listener if any
        trigger.onclick = (event) => {
            event.stopPropagation();
            this.toggleDropdown();
        };
    }

    /**
     * Update dropdown based on navigation info
     * @param {Object} navInfo - Navigation info with currentStep, totalSteps, and steps (optional)
     */
    updateDropdown(navInfo) {
        this.renderDropdownSteps(navInfo.totalSteps, navInfo.currentStep, navInfo.steps || null);
    }

    /**
     * Clean up event listeners
     */
    cleanup() {
        document.removeEventListener('click', this.handleClickOutside);
    }
}

