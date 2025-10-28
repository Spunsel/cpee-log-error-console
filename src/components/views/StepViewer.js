/**
 * Step Viewer Component
 * Main coordinator for step content display and navigation
 * Responsibilities:
 * - Orchestrates ContentSectionCoordinator (visual content) and RawContentCoordinator (raw content)
 * - Coordinates step navigation and content updates
 * - Manages step header and navigation state
 * - Delegates specific rendering to specialized coordinators
 */

import { StepNavigator } from '../ui/StepNavigator.js';
import { ContentSectionCoordinator } from '../coordinators/ContentSectionCoordinator.js';

export class StepViewer {
    constructor(instanceService, domRegistry = null, rawContentCoordinator = null, highlightCoordinator = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.rawContentCoordinator = rawContentCoordinator;
        this.highlightCoordinator = highlightCoordinator;
        this.onStepChange = null;
        
        // Initialize extracted components
        this.navigator = new StepNavigator(instanceService, domRegistry);
        this.contentCoordinator = new ContentSectionCoordinator(domRegistry, highlightCoordinator);
        
        // Pass ContentSectionCoordinator to RawContentCoordinator for coordination
        if (this.rawContentCoordinator) {
            this.rawContentCoordinator.contentSectionCoordinator = this.contentCoordinator;
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
        if (this.highlightCoordinator) {
            this.highlightCoordinator.onStepChanged();
        }

        // Show process analysis section
        this.domRegistry.addClass('stepDetails', 'hidden');
        this.domRegistry.removeClass('processAnalysis', 'hidden');

        // Update step header
        this.updateStepHeader(step, navInfo);

        // Set current step mapping for highlighting
        if (this.highlightCoordinator && step.hasTaskMapping()) {
            this.highlightCoordinator.setCurrentStepMapping(step.getTaskMapping());
            console.log(`[StepViewer] Set task mapping for step ${step.stepNumber}`);
        }

        // Update content sections using ContentSectionCoordinator
        const stepContent = {
            inputCpeeTree: step.getContent('inputCpeeTree'),
            inputIntermediate: step.getContent('inputIntermediate'),
            userInput: step.getContent('userInput'),
            outputIntermediate: step.getContent('outputIntermediate'),
            outputCpeeTree: step.getContent('outputCpeeTree')
        };
        

        await this.contentCoordinator.updateAllSections(stepContent);

        // Initialize raw content view features for this step
        if (this.rawContentCoordinator) {
            this.rawContentCoordinator.setupForStep(step);
        }

        // Setup/update navigation using StepNavigator
        this.navigator.setupNavigation();
        this.navigator.updateNavigation(navInfo);

        // Update metadata display AFTER navigation is set up
        if (this.navigator) {
            this.navigator.updateMetadataDisplay(step);
        }
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
        this.contentCoordinator.clearAllSections();
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
        return this.contentCoordinator.getRenderers();
    }
}
