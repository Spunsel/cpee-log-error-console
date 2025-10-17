/**
 * Step Viewer Component
 * Handles display of step content and navigation
 */

import { DOMUtils } from '../utils/DOMUtils.js';

export class StepViewer {
    constructor(instanceService) {
        this.instanceService = instanceService;
        this.onStepChange = null;
    }

    /**
     * Set callback for when step changes
     * @param {Function} callback - Callback function
     */
    setOnStepChange(callback) {
        this.onStepChange = callback;
    }

    /**
     * Display step content
     * @param {Object} step - Step data
     * @param {Object} navInfo - Navigation info
     */
    displayStep(step, navInfo) {
        if (!step) return;

        console.log(`Displaying step ${step.stepNumber}`);

        // Show process analysis section
        DOMUtils.addClass('step-details', 'hidden');
        DOMUtils.removeClass('process-analysis', 'hidden');

        // Update step header
        const stepHeader = DOMUtils.querySelector('#process-analysis h2');
        if (stepHeader) {
            stepHeader.textContent = `Step ${step.stepNumber} of ${navInfo.totalSteps}`;
        }

        // Update content sections
        this.updateSectionContent('input-cpee-content', step.content.inputCpeeTree);
        this.updateSectionContent('input-intermediate-content', step.content.inputIntermediate);
        this.updateSectionContent('user-input-content', step.content.userInput);
        this.updateSectionContent('output-intermediate-content', step.content.outputIntermediate);
        this.updateSectionContent('output-cpee-content', step.content.outputCpeeTree);

        // Setup/update navigation
        this.setupStepNavigation();
        this.updateStepNavigation(navInfo);
    }

    /**
     * Show default state (no instance selected)
     */
    showDefaultState() {
        DOMUtils.removeClass('step-details', 'hidden');
        DOMUtils.addClass('process-analysis', 'hidden');
        
        // Remove navigation if exists
        const navContainer = DOMUtils.getElementById('step-navigation');
        if (navContainer) {
            navContainer.remove();
        }
    }

    /**
     * Setup step navigation UI
     */
    setupStepNavigation() {
        let navContainer = DOMUtils.getElementById('step-navigation');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'step-navigation';
            navContainer.className = 'step-navigation';
            navContainer.innerHTML = `
                <button id="prev-step" class="nav-btn">← Previous</button>
                <span id="step-counter">Step 1 of 1</span>
                <button id="next-step" class="nav-btn">Next →</button>
            `;
            
            // Insert before process analysis
            const processAnalysis = DOMUtils.getElementById('process-analysis');
            if (processAnalysis) {
                processAnalysis.parentNode.insertBefore(navContainer, processAnalysis);
            }
        }

        // Add event listeners
        const prevBtn = DOMUtils.getElementById('prev-step');
        const nextBtn = DOMUtils.getElementById('next-step');

        if (prevBtn) {
            prevBtn.onclick = () => this.previousStep();
        }
        if (nextBtn) {
            nextBtn.onclick = () => this.nextStep();
        }
    }

    /**
     * Update step navigation state
     * @param {Object} navInfo - Navigation info
     */
    updateStepNavigation(navInfo) {
        const prevBtn = DOMUtils.getElementById('prev-step');
        const nextBtn = DOMUtils.getElementById('next-step');
        const counter = DOMUtils.getElementById('step-counter');

        if (prevBtn) {
            prevBtn.disabled = !navInfo.canGoPrevious;
        }
        if (nextBtn) {
            nextBtn.disabled = !navInfo.canGoNext;
        }
        if (counter) {
            counter.textContent = `Step ${navInfo.currentStep} of ${navInfo.totalSteps}`;
        }
    }

    /**
     * Navigate to previous step
     */
    previousStep() {
        if (this.instanceService.previousStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Navigate to next step
     */
    nextStep() {
        if (this.instanceService.nextStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Update content in a section
     * @param {string} elementId - Element ID
     * @param {string} content - Content to display
     */
    updateSectionContent(elementId, content) {
        const element = DOMUtils.getElementById(elementId);
        if (element) {
            const codeElement = element.querySelector('code');
            if (codeElement) {
                codeElement.textContent = content || 'No content available';
            } else {
                element.textContent = content || 'No content available';
            }
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        DOMUtils.removeClass('process-analysis', 'hidden');
        DOMUtils.addClass('step-details', 'hidden');

        // Show loading in all sections
        this.updateSectionContent('input-cpee-content', 'Loading...');
        this.updateSectionContent('input-intermediate-content', 'Loading...');
        this.updateSectionContent('user-input-content', 'Loading...');
        this.updateSectionContent('output-intermediate-content', 'Loading...');
        this.updateSectionContent('output-cpee-content', 'Loading...');
    }

    /**
     * Show error state
     * @param {string} message - Error message
     */
    showError(message) {
        DOMUtils.removeClass('process-analysis', 'hidden');
        DOMUtils.addClass('step-details', 'hidden');

        this.updateSectionContent('input-cpee-content', `Error: ${message}`);
        this.updateSectionContent('input-intermediate-content', '');
        this.updateSectionContent('user-input-content', '');
        this.updateSectionContent('output-intermediate-content', '');
        this.updateSectionContent('output-cpee-content', '');
    }
}
