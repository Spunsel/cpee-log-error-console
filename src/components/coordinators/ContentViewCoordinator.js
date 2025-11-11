/**
 * Content View Coordinator
 * Coordinates all content view modes (visual, raw, log, traces)
 * Routes to appropriate renderers based on view mode
 * 
 * Responsibilities:
 * - View mode toggle management
 * - Route to appropriate renderer (RawContentRenderer, LogContentRenderer, TraceContentRenderer, ContentVisualizationCoordinator)
 * - View mode state coordination
 * - Coordinate content hiding/restoration when switching modes
 * 
 * View Mode Routing:
 * - 'raw' → RawContentRenderer (preprocessed content)
 * - 'log' → LogContentRenderer (untouched log content)
 * - 'traces' → TraceContentRenderer (execution traces)
 * - 'visual' → ContentVisualizationCoordinator (SVG graphs)
 */

import { ViewModeToggle } from '../ui/ViewModeToggle.js';
import { RawContentRenderer } from '../renderers/RawContentRenderer.js';
import { LogContentRenderer } from '../renderers/LogContentRenderer.js';
import { TraceContentRenderer } from '../renderers/TraceContentRenderer.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class ContentViewCoordinator {
    constructor(domRegistry = null, contentSectionCoordinator = null, eventBus = null, stateManager = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.contentSectionCoordinator = contentSectionCoordinator;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;

        // Content View Components (pass stateManager so ViewModeToggle can read state)
        this.viewModeToggle = new ViewModeToggle(domRegistry, this.eventBus, this.stateManager);
        
        // Instantiate all three renderers for different view modes
        this.rawContentRenderer = new RawContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        this.logContentRenderer = new LogContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        this.traceContentRenderer = new TraceContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        
        // Action bars per section (moved to RawContentRenderer)
        // this.actionBars = new Map();
        
        // Store original content per section (moved to RawContentRenderer)
        // this.originalContent = new Map();

        // Configuration
        this.sectionIds = [
            'input-cpee',
            'input-intermediate',
            'output-intermediate',
            'output-cpee'
        ];

        // Current step tracking
        this.currentStep = null;
        this.togglesAttached = false;

        // Initialize view mode integration
        this.setupViewModeIntegration();
    }

    /**
     * Setup view mode integration with StateManager
     */
    setupViewModeIntegration() {
        // ViewModes are automatically persisted by StateManager
        // Just ensure we have initial values if needed
        const stateModes = this.stateManager.getState('viewModes');
        if (!stateModes || Object.keys(stateModes).length === 0) {
            // Initialize with defaults if empty
            const defaultModes = {
                'input-cpee': 'visual',
                'input-intermediate': 'visual',
                'output-intermediate': 'visual',
                'output-cpee': 'visual'
            };
            this.stateManager.setState('viewModes', defaultModes);
        }

        // Listen for view mode toggle events (always register listener)
        this.eventBus.on('viewModeToggle:modeChanged', (data) => {
            console.log(`Mode changed: ${data.sectionId} → ${data.mode}`);
            this.setViewMode(data.sectionId, data.mode);
            this.updateSectionDisplay(data.sectionId, data.mode);
        });

        // Listen to StateManager changes to sync toggle button UI
        this.stateManager.subscribe('viewModes', (newModes) => {
            // Update all toggle buttons when state changes externally
            Object.keys(newModes || {}).forEach(sectionId => {
                this.viewModeToggle.updateToggleState(sectionId, newModes[sectionId]);
            });
        });
    }

    /**
     * Get view mode for a section
     * @param {string} sectionId - Section identifier
     * @returns {string} View mode ('visual', 'raw', 'log', or 'traces')
     */
    getViewMode(sectionId) {
        const viewModes = this.stateManager.getState('viewModes');
        return viewModes[sectionId] || 'visual';
    }

    /**
     * Set view mode for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode ('visual', 'raw', 'log', or 'traces')
     * @returns {boolean} True if mode was set successfully
     */
    setViewMode(sectionId, mode) {
        if (!(mode === 'visual' || mode === 'raw' || mode === 'log' || mode === 'traces')) {
            return false;
        }
        
        // Update StateManager
        const currentModes = this.stateManager.getState('viewModes') || {};
        currentModes[sectionId] = mode;
        this.stateManager.setState('viewModes', currentModes);
        
        return true;
    }


    /**
     * Initialize raw content features for a section
     * Adds toggle button and sets up raw content rendering
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} sectionElement - Section container
     */
    initializeSection(sectionId, sectionElement) {
        if (!sectionElement) {
            return;
        }

        // Toggle button is now handled via EventBus in setupViewModeIntegration()
        // No need to set up direct callbacks here
    }

    /**
     * Update section display based on view mode
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode (visual, raw, log, or traces)
     */
    updateSectionDisplay(sectionId, mode) {
        if (!this.currentStep) {
            return;
        }

        // Get the section element using DOMRegistry for consistent DOM access
        // Use getElementSafe to avoid warnings for unregistered dynamic IDs
        const sectionElement = this.domRegistry 
            ? this.domRegistry.getElementSafe(sectionId)
            : null;
        if (!sectionElement) {
            console.warn(`ContentViewCoordinator: Section element '${sectionId}' not found`);
            return;
        }

        // Find the content box (pre element with content)
        const contentContainer = sectionElement.querySelector('.content-box');
        if (!contentContainer) {
            console.warn(`ContentViewCoordinator: Content box not found in section '${sectionId}'`);
            return;
        }

        // Route to appropriate renderer based on view mode
        if (mode === 'raw') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide trace content (including copy button) when switching to raw mode
            this.traceContentRenderer.hideTraceContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.rawContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else if (mode === 'log') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide trace content (including copy button) when switching to log mode
            this.traceContentRenderer.hideTraceContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.logContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else if (mode === 'traces') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide raw/log content (including action bars) when switching to traces mode
            this.rawContentRenderer.hideRawContent(contentContainer);
            this.logContentRenderer.hideLogContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.traceContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else {
            // Visual mode - ContentSectionManager handles this
            // Just ensure raw/log/traces content is hidden
            delete sectionElement.dataset.viewMode;
            this.rawContentRenderer.hideRawContent(contentContainer);
            this.logContentRenderer.hideLogContent(contentContainer);
            this.traceContentRenderer.hideTraceContent(contentContainer);
            
            // Only restore original content if we have it stored (i.e., if we were in raw/log mode)
            if (this.rawContentRenderer.hasOriginalContent(sectionId)) {
                this.rawContentRenderer.restoreOriginalContent(sectionId);
            }
            if (this.logContentRenderer.hasOriginalContent(sectionId)) {
                this.logContentRenderer.restoreOriginalContent(sectionId);
            }
            
            // Delegate visual content restoration to ContentVisualizationCoordinator
            if (this.contentSectionCoordinator) {
                this.contentSectionCoordinator.restoreVisualContent(sectionId);
            }
        }
    }

    /**
     * Setup sections for current step
     * @param {CPEEStep} step - Current step
     */
    setupForStep(step) {
        if (!step) {
            return;
        }

        this.currentStep = step;

        // Clear all search states when switching to a different step
        this.rawContentRenderer.clearAllSearchStates();
        this.logContentRenderer.clearAllSearchStates();

        // Clear trace cache when switching to a different step
        this.traceContentRenderer.clearTraceCache();

        // Reset all view modes to visual for this step
        // (View mode does not persist across steps)
        this.resetAllViewModes();

        // Attach toggles to all sections (only once)
        if (!this.togglesAttached) {
            this.viewModeToggle.attachToSections();
            // Attach expand/collapse buttons after view mode toggles are attached
            // (expand/collapse needs the left-title-side structure created by ViewModeToggle)
            if (this.contentSectionCoordinator && this.contentSectionCoordinator.attachExpandCollapseButtons) {
                this.contentSectionCoordinator.attachExpandCollapseButtons();
            }
            this.togglesAttached = true;
        }

        // Toggle change handler is now managed via EventBus in setupViewModeIntegration()
        // No need to set up direct callbacks here
    }


    /**
     * Reset all view modes to visual
     */
    resetAllViewModes() {
        this.sectionIds.forEach(sectionId => {
            this.setViewMode(sectionId, 'visual');
            // Update the actual DOM display to show visual content
            this.updateSectionDisplay(sectionId, 'visual');
        });
        
        // Update toggle button UI to reflect the reset
        this.updateAllToggleButtons();
    }

    /**
     * Update all toggle button states to reflect current modes
     */
    updateAllToggleButtons() {
        this.sectionIds.forEach(sectionId => {
            const currentMode = this.getViewMode(sectionId);
            this.viewModeToggle.updateToggleState(sectionId, currentMode);
        });
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.currentStep = null;
        this.rawContentRenderer.destroy();
        this.logContentRenderer.destroy();
        this.traceContentRenderer.destroy();
    }
}

