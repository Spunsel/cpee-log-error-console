/**
 * Step Navigator
 * Handles step navigation UI creation, management, and interactions
 * Extracted from StepViewer to follow Single Responsibility Principle
 */

import { ICONS } from '../../assets/icons.js';
import { StepDropdown } from './StepDropdown.js';
import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class StepNavigator {
    constructor(instanceService, domRegistry = null, eventBus = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        
        // Navigation state
        this.isSetup = false;
        this.navigationContainer = null;

        // Initialize dropdown (pass instanceService so it can handle navigation directly)
        this.dropdown = new StepDropdown(domRegistry, this.eventBus, instanceService);
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
        }

        // Initialize dropdown elements (now inside navigation container)
        // The dropdown elements are already in the nav-right section via createNavigationContainer
        this.dropdown.initialize(navContainer);

        // Create graph scaler
        this.createGraphScaler(wrapperContainer);

        // Create metadata display
        this.createMetadataDisplay(wrapperContainer);

        // Register navigation elements
        this.registerNavigationElements();

        this.navigationContainer = navContainer;
        this.attachEventListeners();
        
        // Dropdown trigger listener is already attached during initialization
        
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
                <div class="step-navigation-left">
                    <button id="go-to-start" class="nav-btn nav-btn-start" aria-label="Go to first step">${ICONS.NAV_START}</button>
                    <div class="nav-center-group">
                        <button id="prev-step" class="nav-btn nav-btn-prev" aria-label="Previous step">${ICONS.NAV_BACKWARD}</button>
                        <span id="step-counter">Step 1 of 1</span>
                        <button id="next-step" class="nav-btn nav-btn-next" aria-label="Next step">${ICONS.NAV_FORWARD}</button>
                    </div>
                    <button id="go-to-end" class="nav-btn nav-btn-end" aria-label="Go to last step">${ICONS.NAV_END}</button>
                </div>
                <div class="step-navigation-right">
                    <div class="nav-separator"></div>
                    <div class="step-dropdown-container">
                        <button id="step-dropdown-trigger" class="step-dropdown-trigger" aria-label="Skip to step" aria-haspopup="listbox" aria-expanded="false">
                            ${ICONS.NAV_SKIP}
                        </button>
                        <div id="step-dropdown-menu" class="step-dropdown-menu" role="listbox" aria-labelledby="step-dropdown-trigger" style="display: none;"></div>
                    </div>
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
                'stepDropdownTrigger': 'step-dropdown-trigger',
                'stepDropdownMenu': 'step-dropdown-menu',
                // Alternative keys for navigation buttons
                'prevStep': 'prev-step',
                'nextStep': 'next-step'
            };

            // Only register elements that currently exist in the DOM
            Object.entries(registrations).forEach(([key, id]) => {
                const element = document.getElementById(id);
                if (element) {
                    this.domRegistry.register(key, id);
                }
            });

            // Register metadataDisplay if it exists (created dynamically)
            const metadataDisplay = document.getElementById('metadata-display');
            if (metadataDisplay) {
                this.domRegistry.register('metadataDisplay', 'metadata-display');
            }

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
     * Create graph scaler element
     * @param {HTMLElement} wrapperContainer - Wrapper container to append to
     */
    createGraphScaler(wrapperContainer) {
        // Check if already exists
        let graphScaler = document.getElementById('graph-scaler');
        if (graphScaler) {
            return;
        }

        graphScaler = this.domRegistry.createElement('div', {
            id: 'graph-scaler',
            className: 'graph-scaler',
            innerHTML: `
                <button id="graph-scaler-btn" class="graph-scaler-btn" aria-label="Scale graph">
                    ${ICONS.GRAPH_SCALE}
                </button>
            `
        });

        // Insert after step navigation, before metadata display
        const metadataDisplay = document.getElementById('metadata-display');
        
        if (wrapperContainer) {
            if (metadataDisplay) {
                wrapperContainer.insertBefore(graphScaler, metadataDisplay);
            } else {
                wrapperContainer.appendChild(graphScaler);
            }
        } else {
            // If no wrapper container, try to find or create navigation wrapper
            const navigationWrapper = document.getElementById('navigation-wrapper');
            if (navigationWrapper) {
                if (metadataDisplay) {
                    navigationWrapper.insertBefore(graphScaler, metadataDisplay);
                } else {
                    navigationWrapper.appendChild(graphScaler);
                }
            }
        }

        // Register with DOM registry if not already registered and element exists in DOM
        if (this.domRegistry && !this.domRegistry.hasKey('graphScaler') && document.getElementById('graph-scaler')) {
            this.domRegistry.register('graphScaler', 'graph-scaler');
        }
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
                    <span class="uuid-wrapper">
                        <span id="uuid-value">-</span>
                        <button id="uuid-copy-btn" class="uuid-copy-btn" title="Copy full UUID" style="display: none;">${ICONS.COPY}</button>
                    </span>
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
        } else {
            // If no wrapper container, try to find or create navigation wrapper
            const navigationWrapper = document.getElementById('navigation-wrapper');
            if (navigationWrapper) {
                navigationWrapper.appendChild(metadataDisplay);
            }
        }

        // Register with DOM registry if not already registered and element exists in DOM
        if (this.domRegistry && !this.domRegistry.hasKey('metadataDisplay') && document.getElementById('metadata-display')) {
            this.domRegistry.register('metadataDisplay', 'metadata-display');
        }

        // Attach copy button event listener
        this.attachCopyButtonListener();
    }

    /**
     * Format UUID to show only first 2 and last 2 characters
     * @param {string} uuid - Full UUID string
     * @returns {string} Formatted UUID (e.g., "b7...4d")
     */
    formatUUID(uuid) {
        if (!uuid || uuid === '-') {
            return '-';
        }
        if (uuid.length <= 4) {
            return uuid;
        }
        return `${uuid.substring(0, 3)}...${uuid.substring(uuid.length - 3)}`;
    }

    /**
     * Attach event listener to UUID copy button
     */
    attachCopyButtonListener() {
        const copyBtn = document.getElementById('uuid-copy-btn');
        if (!copyBtn) {
            return;
        }

        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const uuidValue = document.getElementById('uuid-value');
            if (!uuidValue) {
                return;
            }

            const fullUuid = uuidValue.getAttribute('data-full-uuid');
            if (!fullUuid || fullUuid === '-') {
                return;
            }

            try {
                await navigator.clipboard.writeText(fullUuid);
                
                // Show success feedback
                const checkIcon = ICONS.CHECK;
                copyBtn.innerHTML = checkIcon;
                copyBtn.classList.add('copied');
                
                // Reset to copy icon after configured duration
                const successDuration = configManager.get('ui.notifications.successDuration');
                setTimeout(() => {
                    copyBtn.innerHTML = ICONS.COPY;
                    copyBtn.classList.remove('copied');
                }, successDuration);
            } catch (err) {
                console.error('Failed to copy UUID:', err);
            }
        });
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
            // Find the wrapper container to append to
            const wrapperContainer = document.getElementById('navigation-wrapper');
            this.createMetadataDisplay(wrapperContainer);
            const retryElement = this.domRegistry.getElementSafe('metadataDisplay') || document.getElementById('metadata-display');
            if (retryElement) {
                const uuidValue = retryElement.querySelector('#uuid-value');
                const uuidCopyBtn = retryElement.querySelector('#uuid-copy-btn');
                const fullUuid = step.changeUuid || '-';
                
                if (uuidValue) {
                    uuidValue.textContent = this.formatUUID(fullUuid);
                    uuidValue.setAttribute('data-full-uuid', fullUuid);
                }
                if (uuidCopyBtn) {
                    uuidCopyBtn.style.display = fullUuid !== '-' ? 'inline-flex' : 'none';
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
        const uuidCopyBtn = metadataElement.querySelector('#uuid-copy-btn');
        const fullUuid = step.changeUuid || '-';
        
        if (uuidValue) {
            uuidValue.textContent = this.formatUUID(fullUuid);
            uuidValue.setAttribute('data-full-uuid', fullUuid);
        }
        if (uuidCopyBtn) {
            uuidCopyBtn.style.display = fullUuid !== '-' ? 'inline-flex' : 'none';
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

        // Get steps array from current instance for dropdown display
        const currentInstance = this.instanceService.getCurrentInstance();
        const stepsArray = currentInstance ? currentInstance.steps : null;
        
        // Update dropdown with steps array for user input display
        this.dropdown.updateDropdown({
            ...navInfo,
            steps: stepsArray
        });
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
        const step = this.instanceService.getCurrentStep();
        const navInfo = this.instanceService.getNavigationInfo();
        
        // Emit step change event
        this.eventBus.emit('stepNavigator:stepChanged', { step, navInfo });
    }


    /**
     * Remove navigation from DOM
     */
    removeNavigation() {
        // Clean up dropdown
        if (this.dropdown) {
            this.dropdown.cleanup();
        }

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
