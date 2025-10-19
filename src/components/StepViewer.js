/**
 * Step Viewer Component (Refactored)
 * Coordinates step content display and navigation using extracted components
 * Refactored to follow Single Responsibility Principle
 */

import { DOMUtils } from '../utils/DOMUtils.js';
import { DOMElementManager } from '../utils/DOMElementManager.js';
import { StepNavigator } from './StepNavigator.js';
import { ContentSectionManager } from './ContentSectionManager.js';

export class StepViewer {
    constructor(instanceService, domRegistry = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.onStepChange = null;
        
        // Initialize utility managers
        this.domManager = new DOMElementManager(domRegistry);
        
        // Initialize extracted components
        this.navigator = new StepNavigator(instanceService, domRegistry);
        this.contentManager = new ContentSectionManager(domRegistry);
        
        // Setup navigation callback to handle step changes
        this.navigator.setOnStepChange(async (step, navInfo) => {
            await this.displayStep(step, navInfo);
            
            // Call external callback if set
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        });
        
        // Legacy properties for backward compatibility (deprecated but maintained)
        this.inputGraphRenderer = null;
        this.outputGraphRenderer = null;
        this.inputMermaidRenderer = null;
        this.outputMermaidRenderer = null;
        this.currentGraphContainer = null;
    }

    /**
     * Get DOM element by key with fallback to direct ID access for backward compatibility
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        return this.domManager.getElement(key);
    }

    /**
     * Set callback for when step changes
     * @param {Function} callback - Callback function
     */
    setOnStepChange(callback) {
        this.onStepChange = callback;
    }

    /**
     * Display step content (Main coordination method)
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
        this.updateStepHeader(step, navInfo);

        // Update content sections using ContentSectionManager
        const stepContent = {
            inputCpeeTree: step.getContent('inputCpeeTree'),
            inputIntermediate: step.getContent('inputIntermediate'),
            userInput: step.getContent('userInput'),
            outputIntermediate: step.getContent('outputIntermediate'),
            outputCpeeTree: step.getContent('outputCpeeTree')
        };

        await this.contentManager.updateAllSections(stepContent);

        // Setup/update navigation using StepNavigator
        this.navigator.setupNavigation();
        this.navigator.updateNavigation(navInfo);

        // Update legacy renderer references for backward compatibility
        this.updateLegacyRendererReferences();
    }

    /**
     * Update step header with current step information
     * @param {CPEEStep} step - Step data
     * @param {Object} navInfo - Navigation info
     */
    updateStepHeader(step, navInfo) {
        const processAnalysis = this.getElement('processAnalysis');
        if (processAnalysis) {
            const stepHeader = processAnalysis.querySelector('h2');
            if (stepHeader) {
                stepHeader.textContent = `${step.getDisplayName()} of ${navInfo.totalSteps}`;
            }
        }
    }

    /**
     * Update legacy renderer references for backward compatibility
     */
    updateLegacyRendererReferences() {
        const renderers = this.contentManager.getRenderers();
        this.inputGraphRenderer = renderers.inputGraphRenderer;
        this.outputGraphRenderer = renderers.outputGraphRenderer;
        this.inputMermaidRenderer = renderers.inputMermaidRenderer;
        this.outputMermaidRenderer = renderers.outputMermaidRenderer;
    }

    /**
     * Show default state (no instance selected)
     */
    showDefaultState() {
        DOMUtils.removeClass('step-details', 'hidden');
        DOMUtils.addClass('process-analysis', 'hidden');
        
        // Remove navigation using StepNavigator
        this.navigator.removeNavigation();
        
        // Clear all content sections
        this.contentManager.clearAllSections();
    }

    // ========================================
    // LEGACY DELEGATION METHODS
    // These methods maintain backward compatibility by delegating to extracted components
    // ========================================

    /**
     * Setup step navigation UI (Legacy method - now delegates to StepNavigator)
     * @deprecated Use this.navigator.setupNavigation() directly
     */
    setupStepNavigation() {
        return this.navigator.setupNavigation();
    }

    /**
     * Update step navigation state (Legacy method - now delegates to StepNavigator)
     * @param {Object} navInfo - Navigation info
     * @deprecated Use this.navigator.updateNavigation() directly
     */
    updateStepNavigation(navInfo) {
        return this.navigator.updateNavigation(navInfo);
    }

    /**
     * Apply disabled styling to navigation buttons (Legacy method - now handled by StepNavigator)
     * @param {HTMLElement} button - Button element
     * @param {boolean} isDisabled - Whether button should appear disabled
     * @deprecated This is now handled internally by StepNavigator
     */
    applyDisabledStyling(button, isDisabled) {
        return this.navigator.applyDisabledStyling(button, isDisabled);
    }

    /**
     * Navigate to previous step (Legacy method - now delegates to StepNavigator)
     * @deprecated Use this.navigator.previousStep() directly
     */
    async previousStep() {
        return await this.navigator.previousStep();
    }

    /**
     * Navigate to next step (Legacy method - now delegates to StepNavigator)
     * @deprecated Use this.navigator.nextStep() directly
     */
    async nextStep() {
        return await this.navigator.nextStep();
    }

    /**
     * Navigate to first step (Legacy method - now delegates to StepNavigator)
     * @deprecated Use this.navigator.goToStart() directly
     */
    async goToStart() {
        return await this.navigator.goToStart();
    }

    /**
     * Navigate to last step (Legacy method - now delegates to StepNavigator)
     * @deprecated Use this.navigator.goToEnd() directly
     */
    async goToEnd() {
        return await this.navigator.goToEnd();
    }

    /**
     * Preserve container height and hide overflow during transitions
     * @param {HTMLElement} element - The container element
     * @returns {function} - Cleanup function to restore normal state
     * @deprecated This method is now handled by ContentSectionManager
     */
    preserveHeightDuringTransition(element) {
        return this.contentManager.preserveHeightDuringTransition(element);
    }

    /**
     * Update the Input CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     * @deprecated Use this.contentManager.updateInputCpeeSection() directly
     */
    async updateInputCpeeSection(cpeeXml) {
        return await this.contentManager.updateInputCpeeSection(cpeeXml);
    }

    /**
     * Update the Output CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     * @deprecated Use this.contentManager.updateOutputCpeeSection() directly
     */
    async updateOutputCpeeSection(cpeeXml) {
        return await this.contentManager.updateOutputCpeeSection(cpeeXml);
    }

    /**
     * Update the Input Intermediate section with Mermaid diagram
     * @param {string} content - Mermaid diagram content
     * @deprecated Use this.contentManager.updateInputIntermediateSection() directly
     */
    async updateInputIntermediateSection(content) {
        return await this.contentManager.updateInputIntermediateSection(content);
    }

    /**
     * Update the Output Intermediate section with Mermaid diagram
     * @param {string} content - Mermaid diagram content
     * @deprecated Use this.contentManager.updateOutputIntermediateSection() directly
     */
    async updateOutputIntermediateSection(content) {
        return await this.contentManager.updateOutputIntermediateSection(content);
    }

    /**
     * Update the User Input section with text content
     * @param {string} content - User input content
     * @deprecated Use this.contentManager.updateUserInputSection() directly
     */
    updateUserInputSection(content) {
        return this.contentManager.updateUserInputSection(content);
    }

    // ========================================
    // ACCESSOR METHODS FOR EXTRACTED COMPONENTS
    // ========================================

    /**
     * Get navigation component
     * @returns {StepNavigator} Navigation component instance
     */
    getNavigator() {
        return this.navigator;
    }

    /**
     * Get content manager component
     * @returns {ContentSectionManager} Content manager instance
     */
    getContentManager() {
        return this.contentManager;
    }

    /**
     * Get all renderer instances (for debugging or external access)
     * @returns {Object} Object containing all renderer instances
     */
    getRenderers() {
        return this.contentManager.getRenderers();
    }
}
