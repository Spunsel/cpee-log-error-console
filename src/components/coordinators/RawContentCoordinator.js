/**
 * Raw Content Coordinator
 * Handles raw content viewing functionality only
 * Responsibilities:
 * - View mode toggle management
 * - Raw content display and rendering
 * - Copy functionality
 * - Raw content DOM updates
 * - View mode state coordination
 */

import { ViewModeToggle } from '../ui/ViewModeToggle.js';
import { RawContentRenderer } from '../renderers/RawContentRenderer.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class RawContentCoordinator {
    constructor(instanceService, domRegistry = null, contentSectionCoordinator = null, eventBus = null, stateManager = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.contentSectionCoordinator = contentSectionCoordinator;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;

        // Content View Components (pass stateManager so ViewModeToggle can read state)
        this.viewModeToggle = new ViewModeToggle(domRegistry, this.eventBus, this.stateManager);
        this.rawContentRenderer = new RawContentRenderer(domRegistry);
        
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

        // Storage key for localStorage persistence
        this.storageKey = 'cpee-debug-console-view-modes';

        // Initialize view mode integration
        this.setupViewModeIntegration();
    }

    /**
     * Setup view mode integration with StateManager
     */
    setupViewModeIntegration() {
        // Subscribe to view mode changes from StateManager
        this.stateManager.subscribe('viewModes', (newModes) => {
            // Sync with localStorage for persistence
            this.saveToStorage(newModes);
        });
        
        // Initialize from StateManager or localStorage
        const stateModes = this.stateManager.getState('viewModes');
        if (stateModes && Object.keys(stateModes).length > 0) {
            // StateManager has data, use it
        } else {
            // Load from localStorage and sync to StateManager
            const storedModes = this.loadFromStorage();
            if (storedModes) {
                this.stateManager.setState('viewModes', storedModes, { silent: true });
            }
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
     * Load view modes from localStorage
     * @returns {Object|null} Loaded modes or null if failed
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load view modes from storage:', error);
        }
        return null;
    }

    /**
     * Save view modes to localStorage
     * @param {Object} modes - Modes to save (optional, uses StateManager if not provided)
     */
    saveToStorage(modes = null) {
        try {
            const modesToSave = modes || this.stateManager.getState('viewModes') || {};
            localStorage.setItem(this.storageKey, JSON.stringify(modesToSave));
        } catch (error) {
            console.warn('Failed to save view modes to storage:', error);
        }
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

        // Get the section element directly from DOM
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) {
            console.warn(`RawContentCoordinator: Section element with ID '${sectionId}' not found`);
            return;
        }

        // Find the content box (pre element with content)
        const contentContainer = sectionElement.querySelector('.content-box');
        if (!contentContainer) {
            console.warn(`RawContentCoordinator: Content box not found in section '${sectionId}'`);
            return;
        }

        if (mode === 'raw' || mode === 'log') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.rawContentRenderer.displayRawContent(sectionId, contentContainer, this.currentStep, mode);
        } else if (mode === 'traces') {
            // Traces mode - use RawContentRenderer to display traces
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.rawContentRenderer.displayRawContent(sectionId, contentContainer, this.currentStep, mode);
        } else {
            // Visual mode - ContentSectionManager handles this
            // Just ensure raw/log/traces content is hidden
            delete sectionElement.dataset.viewMode;
            this.rawContentRenderer.hideRawContent(contentContainer);
            
            // Only restore original content if we have it stored (i.e., if we were in raw/log mode)
            if (this.rawContentRenderer.hasOriginalContent(sectionId)) {
                this.rawContentRenderer.restoreOriginalContent(sectionId);
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

        // Clear trace cache when switching to a different step
        this.rawContentRenderer.clearTraceCache();

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

        // Toggle change handler is now managed via EventBus in setupViewModeCoordinator()
        // No need to set up direct callbacks here
    }


    /**
     * Get all view modes
     * @returns {Object} View modes for all sections
     */
    getAllViewModes() {
        const instance = this.instanceService.getCurrentInstance();
        if (instance && instance.getAllViewModes) {
            return instance.getAllViewModes();
        }
        return {};
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
     * Check if any section is in raw mode
     * @returns {boolean}
     */
    hasRawModes() {
        const instance = this.instanceService.getCurrentInstance();
        if (instance && instance.hasRawModes) {
            return instance.hasRawModes();
        }
        return false;
    }

    /**
     * Get statistics about raw content usage
     * @returns {Object} Statistics
     */
    getRawModeStats() {
        const instance = this.instanceService.getCurrentInstance();
        if (instance) {
            return {
                totalSections: this.sectionIds.length,
                modes: instance.getAllViewModes()
            };
        }
        return { totalSections: this.sectionIds.length, modes: {} };
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.currentStep = null;
        this.rawContentRenderer.destroy();
    }
}
