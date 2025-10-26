/**
 * Step Viewer Component
 * Main coordinator for step content display and navigation
 * Responsibilities:
 * - Orchestrates ContentSectionManager (visual content) and RawContentViewManager (raw content)
 * - Coordinates step navigation and content updates
 * - Manages step header and navigation state
 * - Delegates specific rendering to specialized managers
 */

import { StepNavigator } from '../ui/StepNavigator.js';
import { ContentSectionManager } from '../coordinators/ContentSectionManager.js';
import { CrossViewHighlightManager } from '../coordinators/CrossViewHighlightManager.js';

export class StepViewer {
    constructor(instanceService, domRegistry = null, rawContentViewManager = null, crossViewHighlightManager = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.rawContentViewManager = rawContentViewManager;
        this.crossViewHighlightManager = crossViewHighlightManager;
        this.onStepChange = null;
        
        // Initialize extracted components
        this.navigator = new StepNavigator(instanceService, domRegistry);
        this.contentManager = new ContentSectionManager(domRegistry, crossViewHighlightManager);
        
        // Pass ContentSectionManager to RawContentViewManager for coordination
        if (this.rawContentViewManager) {
            this.rawContentViewManager.contentSectionManager = this.contentManager;
        }
        
        // Setup navigation callback to handle step changes
        this.navigator.setOnStepChange(async (step, navInfo) => {
            await this.displayStep(step, navInfo);
            
            // Call external callback if set
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        });
    }


    /**
     * Get DOM element by key with fallback to direct ID access
     * Delegates to DOMRegistry for centralized DOM management
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (this.domRegistry) {
            return this.domRegistry.getElementSafe(key);
        }
        // Fallback to direct DOM access
        return document.getElementById(key);
    }

    /**
     * Set callback for when step changes
     * @param {Function} callback - Callback function
     */
    setOnStepChange(callback) {
        this.onStepChange = callback;
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        console.error('StepViewer Error:', message);
        // Could be enhanced to show UI error message
    }

    /**
     * Display step content (Main coordination method)
     * @param {CPEEStep} step - Step data
     * @param {Object} navInfo - Navigation info
     */
    async displayStep(step, navInfo) {
        if (!step) {
            return;
        }

        console.log(`Displaying ${step.getDisplayName()}`);

        // Clear highlights from previous step
        if (this.crossViewHighlightManager) {
            this.crossViewHighlightManager.onStepChanged();
        }

        // Show process analysis section
        this.domRegistry.addClass('stepDetails', 'hidden');
        this.domRegistry.removeClass('processAnalysis', 'hidden');

        // Update step header
        this.updateStepHeader(step, navInfo);

        // Update metadata display
        if (this.navigator) {
            this.navigator.updateMetadataDisplay(step);
        }

        // Set current step mapping for highlighting
        if (this.crossViewHighlightManager && step.hasTaskMapping()) {
            this.crossViewHighlightManager.setCurrentStepMapping(step.getTaskMapping());
            console.log(`[StepViewer] Set task mapping for step ${step.stepNumber}`);
        }

        // Update content sections using ContentSectionManager
        const stepContent = {
            inputCpeeTree: step.getContent('inputCpeeTree'),
            inputIntermediate: step.getContent('inputIntermediate'),
            userInput: step.getContent('userInput'),
            outputIntermediate: step.getContent('outputIntermediate'),
            outputCpeeTree: step.getContent('outputCpeeTree')
        };
        

        await this.contentManager.updateAllSections(stepContent);

        // Initialize raw content view features for this step
        if (this.rawContentViewManager) {
            this.rawContentViewManager.setupForStep(step);
        }

        // Setup/update navigation using StepNavigator
        this.navigator.setupNavigation();
        this.navigator.updateNavigation(navInfo);
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
     * Show default state (no instance selected)
     */
    showDefaultState() {
        this.domRegistry.removeClass('stepDetails', 'hidden');
        this.domRegistry.addClass('processAnalysis', 'hidden');
        
        // Remove navigation using StepNavigator
        this.navigator.removeNavigation();
        
        // Clear all content sections
        this.contentManager.clearAllSections();
    }

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
