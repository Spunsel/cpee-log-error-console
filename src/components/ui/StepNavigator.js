/**
 * Step Navigator
 * Handles step navigation UI creation, management, and interactions
 * Extracted from StepViewer to follow Single Responsibility Principle
 */

import { ICONS } from '../../assets/icons.js';

export class StepNavigator {
    constructor(instanceService, domRegistry = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.onStepChange = null;
        
        // Navigation state
        this.isSetup = false;
        this.navigationContainer = null;
    }

    /**
     * Set callback for when step changes
     * @param {Function} callback - Callback function
     */
    setOnStepChange(callback) {
        this.onStepChange = callback;
    }

    /**
     * Setup step navigation UI
     */
    setupNavigation() {
        // Check if wrapper already exists
        let wrapperContainer = document.getElementById('navigation-wrapper');
        if (!wrapperContainer) {
            wrapperContainer = this.createWrapperContainer();
            this.insertWrapperIntoDOM(wrapperContainer);
        }

        // Check DOM directly first since element may not be registered yet
        let navContainer = document.getElementById('step-navigation');
        if (!navContainer) {
            navContainer = this.createNavigationContainer();
            wrapperContainer.appendChild(navContainer);
            this.registerNavigationElements();
        }

        // Create metadata display
        this.createMetadataDisplay(wrapperContainer);

        this.navigationContainer = navContainer;
        this.attachEventListeners();
        this.isSetup = true;
    }

    /**
     * Create wrapper container for navigation and metadata
     * @returns {HTMLElement} Wrapper container element
     */
    createWrapperContainer() {
        const wrapper = this.domRegistry.createElement('div', {
            id: 'navigation-wrapper',
            className: 'navigation-wrapper'
        });
        return wrapper;
    }

    /**
     * Insert wrapper container into DOM
     * @param {HTMLElement} wrapperContainer - Wrapper container
     */
    insertWrapperIntoDOM(wrapperContainer) {
        // Insert before process analysis
        const processAnalysis = this.domRegistry.getElementSafe('processAnalysis');
        if (processAnalysis) {
            processAnalysis.parentNode.insertBefore(wrapperContainer, processAnalysis);
        }
    }

    /**
     * Create navigation container with buttons and styling
     * @returns {HTMLElement} Navigation container element
     */
    createNavigationContainer() {
        const navContainer = this.domRegistry.createElement('div', {
            id: 'step-navigation',
            className: 'step-navigation',
            innerHTML: `
                <div class="nav-left">
                    <button id="go-to-start" class="nav-btn nav-btn-start">${ICONS.NAV_START}</button>
                </div>
                <div class="nav-center">
                    <button id="prev-step" class="nav-btn nav-btn-prev">${ICONS.NAV_BACKWARD}</button>
                    <span id="step-counter">Step 1 of 1</span>
                    <button id="next-step" class="nav-btn nav-btn-next">${ICONS.NAV_FORWARD}</button>
                </div>
                <div class="nav-right">
                    <button id="go-to-end" class="nav-btn nav-btn-end">${ICONS.NAV_END}</button>
                </div>
            `
        });

        // Note: Styling is now handled by CSS classes in style.css
        return navContainer;
    }



    /**
     * Register navigation elements with DOM registry
     */
    registerNavigationElements() {
        if (this.domRegistry) {
            const registrations = {
                'stepNavigation': 'step-navigation',
                'goToStartBtn': 'go-to-start',
                'prevStepBtn': 'prev-step',
                'nextStepBtn': 'next-step',
                'goToEndBtn': 'go-to-end',
                'stepCounter': 'step-counter',
                // Alternative keys for navigation buttons
                'prevStep': 'prev-step',
                'nextStep': 'next-step'
            };

            Object.entries(registrations).forEach(([key, id]) => {
                this.domRegistry.register(key, id);
            });
        }
    }

    /**
     * Attach event listeners to navigation buttons
     */
    attachEventListeners() {
        const buttons = [
            { key: 'goToStartBtn', id: 'go-to-start', handler: () => this.goToStart() },
            { key: 'prevStepBtn', id: 'prev-step', handler: () => this.previousStep() },
            { key: 'nextStepBtn', id: 'next-step', handler: () => this.nextStep() },
            { key: 'goToEndBtn', id: 'go-to-end', handler: () => this.goToEnd() }
        ];

        buttons.forEach(({ key, id, handler }) => {
            const button = this.domRegistry.getElementSafe(key) || document.getElementById(id);
            if (button) {
                button.onclick = handler;
                // Initial state is enabled (CSS handles the styling)
                this.applyDisabledStyling(button, false);
            }
        });
    }

    /**
     * Create metadata display element
     * @param {HTMLElement} wrapperContainer - Wrapper container to append to
     */
    createMetadataDisplay(wrapperContainer) {
        // Check if already exists
        let metadataDisplay = document.getElementById('metadata-display');
        if (metadataDisplay) {
            return;
        }

        // Create the display element with both UUID and LLM fields
        metadataDisplay = this.domRegistry.createElement('div', {
            id: 'metadata-display',
            className: 'metadata-display',
            innerHTML: `
                <div class="metadata-field">
                    <span class="metadata-label">Change UUID:</span>
                    <span id="uuid-value">-</span>
                </div>
                <div class="metadata-field">
                    <span class="metadata-label">Used LLM:</span>
                    <span id="llm-value">-</span>
                </div>
            `
        });

        // Append to wrapper container
        if (wrapperContainer) {
            wrapperContainer.appendChild(metadataDisplay);
        }

        // Register with DOM registry
        if (this.domRegistry) {
            this.domRegistry.register('metadataDisplay', 'metadata-display');
        }
    }

    /**
     * Update metadata display (UUID and LLM)
     * @param {CPEEStep} step - Current step
     */
    updateMetadataDisplay(step) {
        if (!step) {
            return;
        }

        const metadataElement = this.domRegistry.getElementSafe('metadataDisplay') || document.getElementById('metadata-display');
        if (!metadataElement) {
            // Try to create it if it doesn't exist
            this.createMetadataDisplay();
            const retryElement = this.domRegistry.getElementSafe('metadataDisplay') || document.getElementById('metadata-display');
            if (retryElement) {
                const uuidValue = retryElement.querySelector('#uuid-value');
                if (uuidValue) {
                    uuidValue.textContent = step.changeUuid || '-';
                }
                const llmValue = retryElement.querySelector('#llm-value');
                if (llmValue) {
                    llmValue.textContent = step.usedLLM || '-';
                }
            }
            return;
        }

        // Update UUID
        const uuidValue = metadataElement.querySelector('#uuid-value');
        if (uuidValue) {
            uuidValue.textContent = step.changeUuid || '-';
        }

        // Update LLM
        const llmValue = metadataElement.querySelector('#llm-value');
        if (llmValue) {
            llmValue.textContent = step.usedLLM || '-';
        }
    }

    /**
     * Update step navigation state
     * @param {Object} navInfo - Navigation info with canGoPrevious, canGoNext, currentStep, totalSteps
     */
    updateNavigation(navInfo) {
        if (!this.isSetup) {
            return;
        }

        const buttons = [
            { key: 'goToStartBtn', id: 'go-to-start', disabled: !navInfo.canGoPrevious },
            { key: 'prevStepBtn', id: 'prev-step', disabled: !navInfo.canGoPrevious },
            { key: 'nextStepBtn', id: 'next-step', disabled: !navInfo.canGoNext },
            { key: 'goToEndBtn', id: 'go-to-end', disabled: !navInfo.canGoNext }
        ];

        // Update button states
        buttons.forEach(({ key, id, disabled }) => {
            const button = this.domRegistry.getElementSafe(key) || document.getElementById(id);
            if (button) {
                this.applyDisabledStyling(button, disabled);
            }
        });

        // Update step counter
        const counter = this.domRegistry.getElementSafe('stepCounter') || document.getElementById('step-counter');
        if (counter) {
            counter.textContent = `Step ${navInfo.currentStep} of ${navInfo.totalSteps}`;
        }

        // Update metadata display if step is available
        const currentStep = this.instanceService.getCurrentStep();
        if (currentStep) {
            this.updateMetadataDisplay(currentStep);
        }
    }

    /**
     * Apply disabled styling to navigation buttons using CSS classes
     * @param {HTMLElement} button - Button element
     * @param {boolean} isDisabled - Whether button should appear disabled
     */
    applyDisabledStyling(button, isDisabled) {
        if (!button) {
            return;
        }

        // Toggle disabled state - CSS handles all styling and hover effects
        button.disabled = isDisabled;
        button.classList.toggle('disabled', isDisabled);
    }

    /**
     * Navigate to previous step
     */
    async previousStep() {
        if (this.instanceService.previousStep()) {
            await this.handleStepChange();
        }
    }

    /**
     * Navigate to next step
     */
    async nextStep() {
        if (this.instanceService.nextStep()) {
            await this.handleStepChange();
        }
    }

    /**
     * Navigate to first step
     */
    async goToStart() {
        if (this.instanceService.goToFirstStep()) {
            await this.handleStepChange();
        }
    }

    /**
     * Navigate to last step
     */
    async goToEnd() {
        if (this.instanceService.goToLastStep()) {
            await this.handleStepChange();
        }
    }

    /**
     * Handle step change common logic
     */
    async handleStepChange() {
        if (this.onStepChange) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.onStepChange(step, navInfo);
        }
    }

    /**
     * Remove navigation from DOM
     */
    removeNavigation() {
        const wrapperContainer = document.getElementById('navigation-wrapper');
        if (wrapperContainer) {
            wrapperContainer.remove();
        }
        this.isSetup = false;
        this.navigationContainer = null;
    }

    /**
     * Check if navigation is setup
     * @returns {boolean} True if navigation is setup
     */
    isNavigationSetup() {
        return this.isSetup;
    }
}
