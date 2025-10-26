/**
 * Step Dropdown
 * Handles dropdown menu for skipping to arbitrary steps
 * Provides functionality to render step list and handle dropdown interactions
 */

import { LogService } from '../../services/LogService.js';
import { createStepNumberIcon } from '../../assets/icons.js';

export class StepDropdown {
    constructor(domRegistry, onStepSelect = null) {
        this.domRegistry = domRegistry;
        this.onStepSelect = onStepSelect;
        this.isOpen = false;
        this.totalSteps = 0;
        this.currentStep = 0;
    }

    /**
     * Set callback for when a step is selected
     * @param {Function} callback - Callback function(stepNumber)
     */
    setOnStepSelect(callback) {
        this.onStepSelect = callback;
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

        // Call callback
        if (this.onStepSelect) {
            this.onStepSelect(stepNumber);
        }
    }

    /**
     * Attach event listener to dropdown trigger
     */
    attachTriggerListener() {
        const trigger = this.domRegistry.getElementSafe('stepDropdownTrigger') || document.getElementById('step-dropdown-trigger');

        if (!trigger) {
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

