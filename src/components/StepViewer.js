/**
 * Step Viewer Component
 * Handles display of step content and navigation
 */

import { DOMUtils } from '../utils/DOMUtils.js';
import { CPEEWfAdaptorRenderer } from './CPEEWfAdaptorRenderer.js';

export class StepViewer {
    constructor(instanceService) {
        this.instanceService = instanceService;
        this.onStepChange = null;
        this.graphRenderer = null;
        this.currentGraphContainer = null;
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
     * @param {CPEEStep} step - Step data
     * @param {Object} navInfo - Navigation info
     */
    async displayStep(step, navInfo) {
        if (!step) return;

        console.log(`Displaying ${step.getDisplayName()}`);

        // Show process analysis section
        DOMUtils.addClass('step-details', 'hidden');
        DOMUtils.removeClass('process-analysis', 'hidden');

        // Update step header
        const stepHeader = DOMUtils.querySelector('#process-analysis h2');
        if (stepHeader) {
            stepHeader.textContent = `${step.getDisplayName()} of ${navInfo.totalSteps}`;
        }

        // Update content sections using CPEEStep methods
        // For input CPEE tree, render as graph instead of raw XML
        await this.updateInputCpeeSection(step.getContent('inputCpeeTree'));
        this.updateSectionContent('input-intermediate-content', step.getContent('inputIntermediate'));
        this.updateSectionContent('user-input-content', step.getContent('userInput'));
        this.updateSectionContent('output-intermediate-content', step.getContent('outputIntermediate'));
        this.updateSectionContent('output-cpee-content', step.getContent('outputCpeeTree'));

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
    async previousStep() {
        if (this.instanceService.previousStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Navigate to next step
     */
    async nextStep() {
        if (this.instanceService.nextStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Update the Input CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     */
    async updateInputCpeeSection(cpeeXml) {
        const inputCpeeElement = DOMUtils.getElementById('input-cpee-content');
        if (!inputCpeeElement) return;

        // Check if we have valid CPEE XML
        if (!cpeeXml || cpeeXml === 'Not found' || cpeeXml === 'No content available') {
            // Store current height to prevent flickering
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            
            inputCpeeElement.innerHTML = '<div class="no-content">No CPEE tree available for this step</div>';
            
            // Reset height after content is set
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 50);
            return;
        }

        try {
            // Store current height to prevent flickering during transition
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            
            // Clear the existing content and create graph container
            inputCpeeElement.innerHTML = '';
            
            // Create unique IDs to avoid conflicts with main form
            const uniqueId = `step-${Date.now()}`;
            
            // Create a container for the graph
            const graphContainer = document.createElement('div');
            graphContainer.id = `${uniqueId}-graph-container`;
            graphContainer.style.cssText = `
                width: 100%;
                min-height: 100px;
                height: auto;
                border: none;
                border-radius: 0;
                background: white;
                position: relative;
                margin: 0;
                padding: 0;
            `;
            
            // Create elements that CPEE WfAdaptor expects for hover functionality
            
            const inputElement = document.createElement('textarea');
            inputElement.id = `${uniqueId}-input`;
            inputElement.style.cssText = 'display: none; pointer-events: none; position: absolute; left: -9999px;';
            inputElement.value = cpeeXml; // Provide the XML content
            inputElement.setAttribute('readonly', true); // Make it readonly to prevent interference
            
            // Create modelling container structure that WfAdaptor expects
            const modellingDiv = document.createElement('div');
            modellingDiv.id = `${uniqueId}-modelling`;
            modellingDiv.style.cssText = 'display: none;';
            
            inputCpeeElement.appendChild(inputElement);
            inputCpeeElement.appendChild(modellingDiv);
            inputCpeeElement.appendChild(graphContainer);
            
            // Initialize or reuse graph renderer
            if (!this.graphRenderer) {
                this.graphRenderer = new CPEEWfAdaptorRenderer();
            }
            
            // Initialize the renderer with the container and required elements
            await this.graphRenderer.initialize(`${uniqueId}-graph-container`, null, `${uniqueId}-input`);
            
            // Render the graph
            await this.graphRenderer.renderGraph(cpeeXml);
            
            console.log('✅ CPEE graph rendered in step viewer');
            
            // Reset height to auto after graph is rendered to allow natural sizing
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 100);
            
        } catch (error) {
            console.error('❌ Failed to render CPEE graph in step viewer:', error);
            
            // Fallback to text display with error message
            inputCpeeElement.innerHTML = `
                <div class="graph-error">
                    <p><strong>Failed to render graph:</strong> ${error.message}</p>
                    <details>
                        <summary>Show raw XML content</summary>
                        <pre><code>${cpeeXml}</code></pre>
                    </details>
                </div>
            `;
            
            // Reset height after error content is set
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 50);
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
        const inputCpeeElement = DOMUtils.getElementById('input-cpee-content');
        if (inputCpeeElement) {
            // Store current height to prevent flickering during loading
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            inputCpeeElement.innerHTML = '<div class="loading-graph">Loading graph...</div>';
        }
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

        const inputCpeeElement = DOMUtils.getElementById('input-cpee-content');
        if (inputCpeeElement) {
            // Store current height to prevent flickering during error display
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            inputCpeeElement.innerHTML = `<div class="error-message">Error: ${message}</div>`;
            
            // Reset height after error content is set
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 50);
        }
        this.updateSectionContent('input-intermediate-content', '');
        this.updateSectionContent('user-input-content', '');
        this.updateSectionContent('output-intermediate-content', '');
        this.updateSectionContent('output-cpee-content', '');
    }
}
