/**
 * Step Dropdown
 * Handles dropdown menu for skipping to arbitrary steps
 * Provides functionality to render step list and handle dropdown interactions
 */

import { createStepNumberIcon } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class StepDropdown {
    constructor(domRegistry, eventBus = null, instanceService = null, eventProcessingService = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.instanceService = instanceService;
        this.isOpen = false;
        this.totalSteps = 0;
        this.currentStep = 0;
        this.container = null;
        
        // Service injected via constructor
        this.eventProcessingService = eventProcessingService;
    }

    /**
     * Create and return the dropdown container element (deprecated - elements now in navigation)
     * @returns {HTMLElement} Dropdown container element
     * @deprecated Elements are now created directly in StepNavigator.createNavigationContainer()
     */
    createContainer() {
        // Container elements are now created directly in the navigation container
        // This method is kept for backward compatibility but doesn't need to create anything
        const container = document.getElementById('step-dropdown-container');
        if (container) {
            this.container = container;
        }
        return this.container;
    }

    /**
     * Initialize dropdown (elements are already in DOM, just attach listeners)
     * @param {HTMLElement} _parentContainer - Parent container (navigation container)
     */
    initialize(_parentContainer) {
        // Dropdown elements are now already in the navigation container
        // Just find the container and attach listeners
        const container = document.getElementById('step-dropdown-container');
        if (container) {
            this.container = container;
        }
        
        // Register elements if not already registered
        if (this.domRegistry) {
            this.domRegistry.register('stepDropdownTrigger', 'step-dropdown-trigger');
            this.domRegistry.register('stepDropdownMenu', 'step-dropdown-menu');
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
            const displayUserInput = step ? this.eventProcessingService.getUserInputForStep(step, 40) : null; // Truncated for display
            const fullUserInput = step ? this.eventProcessingService.getUserInputForStep(step) : null; // Full for tooltip (no truncation)
            
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

        // Add click-outside listener with capture phase to catch events early
        // Use setTimeout to avoid immediate closure when opening
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside, true);
        }, 0);
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

        // Remove click-outside listener (use capture phase to match addEventListener)
        document.removeEventListener('click', this.handleClickOutside, true);
    }

    /**
     * Handle click outside dropdown
     * @param {MouseEvent} event - Click event
     */
    handleClickOutside = (event) => {
        const menu = this.domRegistry.getElementSafe('stepDropdownMenu') || document.getElementById('step-dropdown-menu');
        const trigger = this.domRegistry.getElementSafe('stepDropdownTrigger') || document.getElementById('step-dropdown-trigger');
        const container = document.getElementById('step-dropdown-container');

        if (!menu || !trigger) {
            return;
        }

        // Check if click is inside container (which includes both trigger and menu)
        const clickedInsideContainer = container && container.contains(event.target);
        // Also check menu and trigger directly for safety
        const clickedInsideMenu = menu && menu.contains(event.target);
        const clickedInsideTrigger = trigger && trigger.contains(event.target);

        // Close if click is outside container, menu, and trigger
        if (!clickedInsideContainer && !clickedInsideMenu && !clickedInsideTrigger) {
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

