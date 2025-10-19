/**
 * Step Navigator
 * Handles step navigation UI creation, management, and interactions
 * Extracted from StepViewer to follow Single Responsibility Principle
 */

import { DOMElementManager } from '../utils/DOMElementManager.js';

export class StepNavigator {
    constructor(instanceService, domRegistry = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.onStepChange = null;
        
        // Initialize DOM utilities
        this.domManager = new DOMElementManager(domRegistry);
        
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
        // Check DOM directly first since element may not be registered yet
        let navContainer = document.getElementById('step-navigation');
        if (!navContainer) {
            navContainer = this.createNavigationContainer();
            this.insertNavigationIntoDOM(navContainer);
            this.registerNavigationElements();
        }

        this.navigationContainer = navContainer;
        this.attachEventListeners();
        this.isSetup = true;
    }

    /**
     * Create navigation container with buttons and styling
     * @returns {HTMLElement} Navigation container element
     */
    createNavigationContainer() {
        const navContainer = this.domManager.createElement('div', {
            id: 'step-navigation',
            className: 'step-navigation',
            innerHTML: `
                <div class="nav-left">
                    <button id="go-to-start" class="nav-btn nav-btn-start">⏮</button>
                </div>
                <div class="nav-center">
                    <button id="prev-step" class="nav-btn nav-btn-prev">←</button>
                    <span id="step-counter">Step 1 of 1</span>
                    <button id="next-step" class="nav-btn nav-btn-next">→</button>
                </div>
                <div class="nav-right">
                    <button id="go-to-end" class="nav-btn nav-btn-end">⏭</button>
                </div>
            `
        });

        // Apply main container styling
        this.domManager.applyStyles(navContainer, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px 20px',
            margin: '10px 0',
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        });

        // Style navigation sections
        this.styleNavigationSections(navContainer);

        return navContainer;
    }

    /**
     * Apply styling to navigation sections
     * @param {HTMLElement} navContainer - Navigation container
     */
    styleNavigationSections(navContainer) {
        const navLeft = navContainer.querySelector('.nav-left');
        const navCenter = navContainer.querySelector('.nav-center');
        const navRight = navContainer.querySelector('.nav-right');

        if (navLeft) {
            this.domManager.applyStyles(navLeft, {
                flex: '1',
                display: 'flex',
                justifyContent: 'flex-start'
            });
        }

        if (navCenter) {
            this.domManager.applyStyles(navCenter, {
                flex: '2',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
            });
        }

        if (navRight) {
            this.domManager.applyStyles(navRight, {
                flex: '1',
                display: 'flex',
                justifyContent: 'flex-end'
            });
        }
    }

    /**
     * Insert navigation container into DOM
     * @param {HTMLElement} navContainer - Navigation container
     */
    insertNavigationIntoDOM(navContainer) {
        // Insert before process analysis
        const processAnalysis = this.domManager.getElement('processAnalysis');
        if (processAnalysis) {
            processAnalysis.parentNode.insertBefore(navContainer, processAnalysis);
        }
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
                // Backward compatibility
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
            const button = this.domManager.getElement(key) || document.getElementById(id);
            if (button) {
                button.onclick = handler;
            }
        });
    }

    /**
     * Update step navigation state
     * @param {Object} navInfo - Navigation info with canGoPrevious, canGoNext, currentStep, totalSteps
     */
    updateNavigation(navInfo) {
        if (!this.isSetup) return;

        const buttons = [
            { key: 'goToStartBtn', id: 'go-to-start', disabled: !navInfo.canGoPrevious },
            { key: 'prevStepBtn', id: 'prev-step', disabled: !navInfo.canGoPrevious },
            { key: 'nextStepBtn', id: 'next-step', disabled: !navInfo.canGoNext },
            { key: 'goToEndBtn', id: 'go-to-end', disabled: !navInfo.canGoNext }
        ];

        // Update button states
        buttons.forEach(({ key, id, disabled }) => {
            const button = this.domManager.getElement(key) || document.getElementById(id);
            if (button) {
                button.disabled = disabled;
                this.applyDisabledStyling(button, disabled);
            }
        });

        // Update step counter
        const counter = this.domManager.getElement('stepCounter') || document.getElementById('step-counter');
        if (counter) {
            counter.textContent = `Step ${navInfo.currentStep} of ${navInfo.totalSteps}`;
        }
    }

    /**
     * Apply disabled styling to navigation buttons
     * @param {HTMLElement} button - Button element
     * @param {boolean} isDisabled - Whether button should appear disabled
     */
    applyDisabledStyling(button, isDisabled) {
        if (!button) return;

        if (isDisabled) {
            this.domManager.applyStyles(button, {
                opacity: '0.5',
                color: '#6c757d',
                backgroundColor: '#e9ecef',
                borderColor: '#d6d9dc',
                cursor: 'not-allowed',
                pointerEvents: 'none'
            });
        } else {
            // Reset to default styling
            this.domManager.applyStyles(button, {
                opacity: '',
                cursor: 'pointer',
                pointerEvents: 'auto'
            });
        }
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
        const navContainer = document.getElementById('step-navigation');
        if (navContainer) {
            navContainer.remove();
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
