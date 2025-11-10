/**
 * Step Viewer Component
 * Main coordinator for step content display and navigation
 * Responsibilities:
 * - Orchestrates ContentVisualizationCoordinator (visual content) and RawContentCoordinator (raw content)
 * - Coordinates step navigation and content updates
 * - Manages step header and navigation state
 * - Delegates specific rendering to specialized coordinators
 */

import { StepNavigator } from '../ui/StepNavigator.js';
import { ContentVisualizationCoordinator } from '../coordinators/ContentVisualizationCoordinator.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class StepViewer {
    constructor(instanceService, domRegistry = null, rawContentCoordinator = null, highlightCoordinator = null, eventBus = null, stateManager = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.rawContentCoordinator = rawContentCoordinator;
        this.highlightCoordinator = highlightCoordinator;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        
        // Initialize extracted components
        this.navigator = new StepNavigator(instanceService, domRegistry, this.eventBus, this.stateManager);
        this.contentCoordinator = new ContentVisualizationCoordinator(domRegistry, highlightCoordinator, this.eventBus, this.stateManager);
        
        // Pass ContentVisualizationCoordinator to RawContentCoordinator for coordination
        if (this.rawContentCoordinator) {
            this.rawContentCoordinator.contentSectionCoordinator = this.contentCoordinator;
        }
        
        // Setup event bus listeners
        this.setupEventBusListeners();
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
     * Setup event bus listeners
     */
    setupEventBusListeners() {
        // Listen for step navigation events
        this.eventBus.on('stepNavigator:stepChanged', async (data) => {
            await this.displayStep(data.step, data.navInfo);
            
            // Emit step change event
            this.eventBus.emit('stepViewer:stepChanged', {
                stepIndex: this.instanceService.currentStepIndex,
                step: data.step,
                navInfo: data.navInfo
            });
        });

        // Listen for step navigation requests
        this.eventBus.on('stepNavigator:previousStep', () => {
            this.navigator.previousStep();
        });

        this.eventBus.on('stepNavigator:nextStep', () => {
            this.navigator.nextStep();
        });

        // Listen for step display requests
        this.eventBus.on('stepViewer:displayStep', async (data) => {
            await this.displayStep(data.step, data.navInfo);
        });
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

        // Keep process analysis section hidden until all DOM elements are ready
        const loadSection = document.querySelector('.load-single-instance-section');
        if (loadSection) {
            loadSection.classList.add('hidden');
        }
        // DO NOT show processAnalysis yet - will be shown after all setup is complete

        // Update step header (can be done while hidden)
        this.updateStepHeader(step, navInfo);

        // Set current step mapping for highlighting
        if (this.highlightCoordinator && step.hasTaskMapping()) {
            this.highlightCoordinator.setCurrentStepMapping(step.getTaskMapping());
            console.log(`[StepViewer] Set task mapping for step ${step.stepNumber}`);
        }

        // Update content sections using ContentVisualizationCoordinator
        const stepContent = {
            inputCpeeTree: step.getContent('inputCpeeTree'),
            inputIntermediate: step.getContent('inputIntermediate'),
            userInput: step.getContent('userInput'),
            outputIntermediate: step.getContent('outputIntermediate'),
            outputCpeeTree: step.getContent('outputCpeeTree')
        };
        

        // Wait for all content sections to be rendered (graphs, Mermaid diagrams, etc.)
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

        // Wait for all DOM elements to be finished setting up and formatted correctly
        // Use multiple requestAnimationFrame calls to ensure DOM updates are complete
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });
        });

        // Now that all DOM elements are ready and formatted correctly, show the step viewer
        this.domRegistry.removeClass('processAnalysis', 'hidden');
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
        const loadSection = document.querySelector('.load-single-instance-section');
        if (loadSection) {
            loadSection.classList.remove('hidden');
        }
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
