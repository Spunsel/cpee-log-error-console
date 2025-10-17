/**
 * Step Viewer Component
 * Handles display of step content and navigation
 */

import { DOMUtils } from '../utils/DOMUtils.js';
import { ProgressiveGraphService } from '../services/ProgressiveGraphService.js';

export class StepViewer {
    constructor(instanceService) {
        this.instanceService = instanceService;
        this.onStepChange = null;
        this.progressiveStates = [];
        this.currentProgressiveIndex = 0;
    }

    /**
     * Set callback for when step changes
     * @param {Function} callback - Callback function
     */
    setOnStepChange(callback) {
        this.onStepChange = callback;
    }

    /**
     * Display step content with progressive graph visualization
     * @param {Object} step - Step data
     * @param {Object} navInfo - Navigation info
     */
    displayStep(step, navInfo) {
        if (!step) return;

        console.log(`Displaying step ${step.stepNumber}`);

        // Generate progressive states when displaying first step or when instance changes
        const instance = this.instanceService.getCurrentInstance();
        if (instance && (!this.progressiveStates.length || this.currentInstanceUUID !== instance.uuid)) {
            this.progressiveStates = ProgressiveGraphService.generateProgressiveStates(instance.steps);
            this.currentInstanceUUID = instance.uuid;
        }

        // Show process analysis section
        DOMUtils.removeClass('step-details', 'hidden');
        DOMUtils.addClass('step-details', 'hidden');
        DOMUtils.removeClass('process-analysis', 'hidden');

        // Update step header with progressive info
        const stepHeader = DOMUtils.querySelector('#process-analysis h2');
        if (stepHeader) {
            const progressInfo = this.progressiveStates.length > 0 
                ? this.progressiveStates[step.stepNumber - 1]?.title || `Step ${step.stepNumber}`
                : `Step ${step.stepNumber}`;
            stepHeader.textContent = `${progressInfo} (${step.stepNumber} of ${navInfo.totalSteps})`;
        }

        // Update content sections with enhanced graph visualization
        this.updateSectionContent('input-cpee-content', step.content.inputCpeeTree);
        this.updateSectionContent('input-intermediate-content', step.content.inputIntermediate);
        this.updateSectionContent('user-input-content', step.content.userInput);
        this.updateSectionContent('output-intermediate-content', step.content.outputIntermediate);
        
        // Replace output CPEE content with progressive graph viewer
        this.updateProgressiveGraphSection(step);

        // Setup/update navigation
        this.setupStepNavigation();
        this.updateStepNavigation(navInfo);
        
        // Add progressive graph navigation
        this.setupProgressiveNavigation(step.stepNumber - 1);
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
        
        // Clear progressive states on error
        this.progressiveStates = [];
    }

    /**
     * Update progressive graph section with iframe visualization
     * @param {Object} step - Current step data
     */
    updateProgressiveGraphSection(step) {
        const outputSection = DOMUtils.getElementById('output-cpee-content');
        if (!outputSection) return;

        const stepIndex = step.stepNumber - 1;
        
        if (this.progressiveStates.length > stepIndex) {
            const progressiveState = this.progressiveStates[stepIndex];
            const iframeUrl = ProgressiveGraphService.generateVisualizationURL(
                progressiveState.cpeeXml, 
                progressiveState.stepNumber
            );
            
            // Create iframe container
            outputSection.innerHTML = `
                <div class="progressive-graph-container">
                    <div class="progressive-header">
                        <span class="progressive-title">📊 Process Evolution - Step ${progressiveState.stepNumber}</span>
                        <div class="progressive-controls">
                            <button id="prev-evolution" class="evolution-btn" ${stepIndex === 0 ? 'disabled' : ''}>← Prev</button>
                            <span class="evolution-counter">Evolution ${stepIndex + 1} of ${this.progressiveStates.length}</span>
                            <button id="next-evolution" class="evolution-btn" ${stepIndex === this.progressiveStates.length - 1 ? 'disabled' : ''}>Next →</button>
                        </div>
                    </div>
                    <iframe 
                        class="progressive-iframe" 
                        src="${iframeUrl}"
                        frameborder="0"
                        width="100%" 
                        height="400px">
                    </iframe>
                </div>
            `;
        } else {
            // Fallback to text content
            this.updateSectionContent('output-cpee-content', step.content.outputCpeeTree);
        }
    }

    /**
     * Setup progressive navigation within current step
     * @param {number} currentStepIndex - Current step index
     */
    setupProgressiveNavigation(currentStepIndex) {
        this.currentProgressiveIndex = currentStepIndex;
        
        const prevBtn = DOMUtils.getElementById('prev-evolution');
        const nextBtn = DOMUtils.getElementById('next-evolution');
        
        if (prevBtn) {
            prevBtn.onclick = () => this.showPreviousEvolution();
        }
        if (nextBtn) {
            nextBtn.onclick = () => this.showNextEvolution();
        }
    }

    /**
     * Show previous evolution state
     */
    showPreviousEvolution() {
        if (this.currentProgressiveIndex > 0) {
            this.currentProgressiveIndex--;
            this.updateProgressiveDisplay();
        }
    }

    /**
     * Show next evolution state  
     */
    showNextEvolution() {
        if (this.currentProgressiveIndex < this.progressiveStates.length - 1) {
            this.currentProgressiveIndex++;
            this.updateProgressiveDisplay();
        }
    }

    /**
     * Update progressive display for current evolution
     */
    updateProgressiveDisplay() {
        if (this.progressiveStates.length > this.currentProgressiveIndex) {
            const progressiveState = this.progressiveStates[this.currentProgressiveIndex];
            const iframeUrl = ProgressiveGraphService.generateVisualizationURL(
                progressiveState.cpeeXml,
                progressiveState.stepNumber
            );
            
            // Update iframe
            const iframe = DOMUtils.querySelector('.progressive-iframe');
            if (iframe) {
                iframe.src = iframeUrl;
            }
            
            // Update counter
            const counter = DOMUtils.querySelector('.evolution-counter');
            if (counter) {
                counter.textContent = `Evolution ${this.currentProgressiveIndex + 1} of ${this.progressiveStates.length}`;
            }
            
            // Update buttons
            const prevBtn = DOMUtils.getElementById('prev-evolution');
            const nextBtn = DOMUtils.getElementById('next-evolution');
            if (prevBtn) prevBtn.disabled = this.currentProgressiveIndex === 0;
            if (nextBtn) nextBtn.disabled = this.currentProgressiveIndex === this.progressiveStates.length - 1;
            
            // Update title
            const title = DOMUtils.querySelector('.progressive-title');
            if (title) {
                title.textContent = `📊 ${progressiveState.title}`;
            }
        }
    }
}
