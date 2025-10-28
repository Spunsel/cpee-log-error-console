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
import { ActionBar } from '../ui/ActionBar.js';
import { RawContentRenderer } from '../renderers/RawContentRenderer.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class RawContentCoordinator {
    constructor(instanceService, domRegistry = null, contentSectionCoordinator = null, eventBus = null, stateManager = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.contentSectionCoordinator = contentSectionCoordinator;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;

        // Content View Components
        this.viewModeToggle = new ViewModeToggle(domRegistry, this.eventBus);
        this.rawContentRenderer = new RawContentRenderer(domRegistry);
        
        // Search services
        this.searchService = serviceFactory.get('SearchService');
        this.searchHighlightingService = serviceFactory.get('SearchHighlightingService');
        
        // Action bars per section
        this.actionBars = new Map();
        
        // Store original content per section (for copy functionality)
        this.originalContent = new Map();

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
    }

    /**
     * Get view mode for a section
     * @param {string} sectionId - Section identifier
     * @returns {string} View mode ('visual' or 'raw')
     */
    getViewMode(sectionId) {
        const viewModes = this.stateManager.getState('viewModes');
        return viewModes[sectionId] || 'visual';
    }

    /**
     * Set view mode for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode ('visual' or 'raw')
     * @returns {boolean} True if mode was set successfully
     */
    setViewMode(sectionId, mode) {
        if (!(mode === 'visual' || mode === 'raw')) {
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
     * @param {string} mode - View mode (visual or raw)
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

        if (mode === 'raw') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            this.displayRawContent(sectionId, contentContainer);
        } else {
            // Visual mode - ContentSectionManager handles this
            // Just ensure raw content is hidden
            this.hideRawContent(contentContainer);
            
            // Restore original content when switching to visual mode (only if we have it stored)
            if (this.originalContent.has(sectionId)) {
                this.restoreOriginalContent(sectionId);
            }
        }
    }

    /**
     * Display raw content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     */
    displayRawContent(sectionId, container) {
        if (!this.currentStep || !container) {
            return;
        }

        let rawContent = null;
        let renderer = null;

        // Get raw content based on section
        switch (sectionId) {
            case 'input-cpee':
                rawContent = this.currentStep.getInputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawCPEETree(rawContent.getContent());
                }
                break;
            case 'input-intermediate':
                rawContent = this.currentStep.getInputMermaidRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-intermediate':
                rawContent = this.currentStep.getOutputMermaidRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-cpee':
                rawContent = this.currentStep.getOutputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawCPEETree(rawContent.getContent());
                }
                break;
        }

        if (!rawContent || !renderer) {
            container.innerHTML = '<pre><code class="no-content">No raw content available</code></pre>';
            return;
        }

        try {
            // Check if raw content container already exists
            let rawContainer = container.querySelector('[data-content-type="raw"]');
            if (!rawContainer) {
                rawContainer = document.createElement('div');
                rawContainer.setAttribute('data-content-type', 'raw');
                // Position raw container to overlay visual content
                rawContainer.style.position = 'absolute';
                rawContainer.style.top = '0';
                rawContainer.style.left = '0';
                rawContainer.style.width = '100%';
                rawContainer.style.height = '100%';
                rawContainer.style.overflow = 'auto';
                container.style.position = 'relative';
                container.appendChild(rawContainer);
            }

            // Hide the original visual content
            const visualElements = container.querySelectorAll('[data-content-type="visual"]');
            visualElements.forEach(el => {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            });

            // Hide parent container's scrollbar (raw container will handle scrolling)
            container.style.overflow = 'hidden';

            // Ensure raw container is visible and interactive
            rawContainer.style.display = 'block';
            rawContainer.style.visibility = 'visible';
            rawContainer.style.pointerEvents = 'auto';
            rawContainer.style.zIndex = '10';
            rawContainer.style.backgroundColor = '#ffffff';

            // ALWAYS add/ensure action bar exists BEFORE clearing content
            if (rawContent.getLength && rawContent.getLength() > 0) {
                if (!this.actionBars.has(sectionId)) {
                    // Create new action bar and attach to container
                    this.addActionBar(rawContainer, sectionId, rawContent);
                } else {
                    // Action bar instance exists - check if it's in the DOM
                    const actionBar = this.actionBars.get(sectionId);
                    const existingActionBarInDOM = rawContainer.querySelector('.raw-content-actions-bar');
                    
                    if (actionBar && !existingActionBarInDOM) {
                        // Action bar instance exists but not in DOM - re-attach it
                        if (actionBar.element && actionBar.element.parentNode) {
                            actionBar.element.parentNode.removeChild(actionBar.element);
                        }
                        rawContainer.appendChild(actionBar.element);
                        console.log(`ActionBar re-attached for ${sectionId}`);
                    }
                    
                    // Show the action bar
                    if (actionBar) {
                        actionBar.show();
                    }
                }
            }
            
            // Now clear ONLY the content area (preserve action bar)
            const existingActionBar = rawContainer.querySelector('.raw-content-actions-bar');
            
            if (existingActionBar) {
                // Clear all children EXCEPT the action bar
                const allChildren = Array.from(rawContainer.children);
                allChildren.forEach(child => {
                    if (child !== existingActionBar) {
                        child.remove();
                    }
                });
            } else {
                // No action bar exists, clear everything (shouldn't happen, but handle it)
            rawContainer.innerHTML = '';
            }
            
            // Render new content and add it
            const rawElement = renderer();
            rawContainer.appendChild(rawElement);
        } catch (error) {
            console.error(`Error rendering raw content for ${sectionId}:`, error);
            container.innerHTML = '<pre><code class="error">Error rendering raw content</code></pre>';
        }
    }

    /**
     * Hide raw content when switching to visual mode
     * @param {HTMLElement} container - Content container
     */
    hideRawContent(container) {
        if (!container) {
            return;
        }

        // Hide raw content elements
        const rawElements = container.querySelectorAll('[data-content-type="raw"]');
        rawElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '0';
        });

        // Hide action bar for this section and clear search
        const sectionId = container.closest('[id]')?.id;
        if (sectionId && this.actionBars.has(sectionId)) {
            const actionBar = this.actionBars.get(sectionId);
            if (actionBar) {
                // Clear search before hiding
                actionBar.clearSearch();
                actionBar.hide();
            }
        }

        // Delegate visual content restoration to ContentVisualizationCoordinator
        if (this.contentSectionCoordinator) {
            if (sectionId) {
                this.contentSectionCoordinator.restoreVisualContent(sectionId);
            }
        }
    }

    /**
     * Add action bar (copy button + search bar) to raw content container
     * @param {HTMLElement} container - Container element
     * @param {string} sectionId - Section identifier
     * @param {Object} rawContent - Raw content object
     */
    addActionBar(container, sectionId, rawContent) {
        // Get content to copy
        const contentToCopy = rawContent.getContent ? rawContent.getContent() : rawContent.getText();

        // Store original content for this section
        this.originalContent.set(sectionId, contentToCopy);
        
        // Initialize search state for this section using SearchService
        this.searchService.initializeSearchState(sectionId);

        // Create action bar
        const actionBar = new ActionBar(this.domRegistry);
        
        // Store action bar for this section
        this.actionBars.set(sectionId, actionBar);
        
        // Set up copy functionality
        actionBar.setOnCopy((content) => {
                console.log(`✓ Copied ${sectionId}:`, content.substring(0, 50) + '...');
        });
        
        // Set up search functionality
        actionBar.setOnSearch((searchTerm) => {
            console.log(`Searching in ${sectionId} for:`, searchTerm);
            this.performSearch(sectionId, searchTerm, contentToCopy);
        });
        
        // Set up search clear
        actionBar.setOnClear(() => {
            console.log(`Cleared search in ${sectionId}`);
            this.clearSearch(sectionId);
        });
        
        // Set up search navigation
        actionBar.setOnNavigate((direction, matchIndex) => {
            console.log(`Navigate ${direction} to match ${matchIndex} in ${sectionId}`);
            this.navigateToMatch(sectionId, direction, matchIndex);
        });

        // Attach to container first
        actionBar.attachToContainer(container);
        
        // Set copy content after attaching
        actionBar.setCopyContent(contentToCopy);
        
        // Show the action bar
        actionBar.show();
        
        console.log(`ActionBar added to ${sectionId}`);
    }

    /**
     * Perform search in raw content
     * @param {string} sectionId - Section identifier
     * @param {string} searchTerm - Search term
     * @param {string} content - Content to search in
     */
    performSearch(sectionId, searchTerm, content) {
        if (!searchTerm || !content) {
            return;
        }

        // Initialize search state if not exists
        this.searchService.initializeSearchState(sectionId);

        // Find the raw content container for this section
        const container = document.querySelector(`#${sectionId} .raw-content-container`);
        if (!container) {
            console.warn(`RawContentCoordinator: No raw content container found for ${sectionId}`);
            return;
        }

        // Get search state and options
        const searchState = this.searchService.getSearchState(sectionId);
        const options = {
            caseSensitive: searchState.caseSensitive,
            wholeWord: searchState.wholeWord
        };

        // Apply search highlighting using SearchHighlightingService
        const matches = this.searchHighlightingService.applySearchHighlighting(container, searchTerm, options);

        // Update search state with matches
        this.searchService.updateSearchResults(sectionId, searchTerm, matches);

        console.log(`RawContentCoordinator: Found ${matches.length} matches for "${searchTerm}" in ${sectionId}`);
        
        // Update search results in action bar for this section
        const actionBar = this.actionBars.get(sectionId);
        if (actionBar) {
            actionBar.updateSearchResults(matches);
        }

        // Scroll to first match if any matches found
        if (matches.length > 0) {
            this.searchHighlightingService.scrollToMatch(container, 0);
        }
    }

    /**
     * Clear search highlighting
     * @param {string} sectionId - Section identifier
     */
    clearSearch(sectionId) {
        console.log(`RawContentCoordinator: Clearing search in ${sectionId}`);
        
        // Find the raw content container for this section
        const container = document.querySelector(`#${sectionId} .raw-content-container`);
        if (!container) {
            console.warn(`RawContentCoordinator: No raw content container found for ${sectionId}`);
            return;
        }

        // Clear highlighting using SearchHighlightingService
        this.searchHighlightingService.clearSearchHighlighting(container);

        // Clear search state
        this.searchService.clearSearchState(sectionId);

        // Update action bar
        const actionBar = this.actionBars.get(sectionId);
        if (actionBar) {
            actionBar.updateSearchResults([]);
        }
    }

    /**
     * Navigate to specific match
     * @param {string} sectionId - Section identifier
     * @param {string} direction - 'next' or 'prev'
     * @param {number} matchIndex - Index of match to navigate to
     */
    navigateToMatch(sectionId, direction, matchIndex) {
        console.log(`RawContentCoordinator: Navigating to match ${matchIndex} in ${sectionId}`);
        
        // Get search state for this section
        const searchState = this.searchService.getSearchState(sectionId);
        if (!searchState || searchState.matches.length === 0) {
            console.warn(`RawContentCoordinator: No matches found for ${sectionId}`);
            return;
        }

        // Navigate to next/prev match and get new index
        const newMatchIndex = this.searchService.navigateToMatch(sectionId, direction);

        // Find the raw content container for this section
        const container = document.querySelector(`#${sectionId} .raw-content-container`);
        if (!container) {
            console.warn(`RawContentCoordinator: No raw content container found for ${sectionId}`);
            return;
        }

        // Scroll to the match using SearchHighlightingService
        const scrolled = this.searchHighlightingService.scrollToMatch(container, newMatchIndex);
        
        if (scrolled) {
            console.log(`RawContentCoordinator: Successfully scrolled to match ${newMatchIndex + 1} of ${searchState.matches.length}`);
        } else {
            console.warn(`RawContentCoordinator: Failed to scroll to match ${newMatchIndex}`);
        }
    }

    /**
     * Clear all search states (called when navigating to a different step)
     */
    clearAllSearchStates() {
        // Clear all search states using SearchService
        this.searchService.clearAllSearchStates();
        
        // Clear highlighting from all containers using SearchHighlightingService
        this.sectionIds.forEach(sectionId => {
            const container = document.querySelector(`#${sectionId} .raw-content-container`);
            if (container) {
                this.searchHighlightingService.clearSearchHighlighting(container);
            }
        });
        
        console.log('RawContentCoordinator: Cleared all search states');
    }

    /**
     * Restore original content when switching modes
     * @param {string} sectionId - Section identifier
     */
    restoreOriginalContent(sectionId) {
        const originalContent = this.originalContent.get(sectionId);
        if (!originalContent) {
            console.warn(`RawContentCoordinator: No original content found for ${sectionId}`);
            return;
        }

        // Find the raw content container for this section
        const container = document.querySelector(`#${sectionId} .raw-content-container`);
        if (!container) {
            console.warn(`RawContentCoordinator: No raw content container found for ${sectionId}`);
            return;
        }

        // Clear any search highlighting using SearchHighlightingService
        this.searchHighlightingService.clearSearchHighlighting(container);

        // Reset search state using SearchService
        this.searchService.clearSearchState(sectionId);

        console.log(`RawContentCoordinator: Restored original content for ${sectionId}`);
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
        this.clearAllSearchStates();

        // Reset all view modes to visual for this step
        // (View mode does not persist across steps)
        this.resetAllViewModes();

        // Attach toggles to all sections (only once)
        if (!this.togglesAttached) {
            this.viewModeToggle.attachToSections();
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
    }
}
