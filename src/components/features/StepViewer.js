/**
 * Step Viewer Component
 * Coordinates step content display and navigation using extracted components
 */

import { DOMUtils } from '../../utils/dom/DOMUtils.js';
import { StepNavigator } from '../ui/StepNavigator.js';
import { ContentSectionManager } from '../managers/ContentSectionManager.js';

export class StepViewer {
    constructor(instanceService, domRegistry = null, rawContentViewManager = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.rawContentViewManager = rawContentViewManager;
        this.onStepChange = null;
        
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
    }

    /**
     * Get DOM element by key with fallback to direct ID access
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (this.domRegistry) {
            return this.domRegistry.getElementSafe(key);
        }
        return DOMUtils.getElementById(key);
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
        if (!step) {
            return;
        }

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
        DOMUtils.removeClass('step-details', 'hidden');
        DOMUtils.addClass('process-analysis', 'hidden');
        
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
