/**
 * Action Bar Component
 * Combines copy button and search bar in a sticky container
 * Provides unified interface for raw content actions
 */

import { CopyButton } from './CopyButton.js';
import { SearchBar } from './SearchBar.js';

export class ActionBar {
    constructor(domRegistry = null, searchService = null, sectionId = null) {
        this.domRegistry = domRegistry;
        this.copyButton = new CopyButton(domRegistry);
        this.searchBar = new SearchBar(domRegistry, searchService, sectionId);
        this.isVisible = false;
        this.onCopy = null;
        this.onSearch = null;
        this.onClear = null;
        this.onNavigate = null;
        this.element = null; // Store reference to the action bar DOM element
    }

    /**
     * Set search service and section ID for search bar
     * @param {Object} searchService - SearchService instance
     * @param {string} sectionId - Section identifier
     */
    setSearchService(searchService, sectionId) {
        this.searchBar.setSearchService(searchService, sectionId);
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
        return document.getElementById(key);
    }

    /**
     * Set callback for copy functionality
     * @param {Function} callback - Callback function to call with content
     */
    setOnCopy(callback) {
        this.onCopy = callback;
        // Note: CopyButton doesn't have setOnCopy, it uses setContent instead
    }

    /**
     * Set callback for search functionality
     * @param {Function} callback - Callback function to call with search term
     */
    setOnSearch(callback) {
        this.onSearch = callback;
        this.searchBar.setOnSearch(callback);
    }

    /**
     * Set callback for search clear
     * @param {Function} callback - Callback function to call
     */
    setOnClear(callback) {
        this.onClear = callback;
        this.searchBar.setOnClear(callback);
    }

    /**
     * Set callback for search navigation
     * @param {Function} callback - Callback function to call with direction and index
     */
    setOnNavigate(callback) {
        this.onNavigate = callback;
        this.searchBar.setOnNavigate(callback);
    }

    /**
     * Create action bar HTML structure
     * @returns {HTMLElement} Action bar container
     */
    createActionBar() {
        const actionBar = document.createElement('div');
        actionBar.className = 'raw-content-actions-bar';
        actionBar.style.display = 'none'; // Hidden by default
        
        // Store reference to this element
        this.element = actionBar;
        
        // Create left side for search bar
        const leftSide = document.createElement('div');
        leftSide.className = 'action-bar-left';
        
        // Create right side for copy button
        const rightSide = document.createElement('div');
        rightSide.className = 'action-bar-right';
        
        // Append search bar to left side
        this.searchBar.attachToContainer(leftSide);
        
        // Create and append copy button to right side
        // CopyButton doesn't have attachToContainer, so we use createButton and append directly
        // For now, we'll just add a placeholder button that will be created when content is set
        const copyButtonContainer = document.createElement('div');
        copyButtonContainer.className = 'action-bar-right';
        rightSide.appendChild(copyButtonContainer);
        
        // Store reference to copy button container
        this.copyButtonContainer = copyButtonContainer;
        
        // Assemble action bar
        actionBar.appendChild(leftSide);
        actionBar.appendChild(rightSide);
        
        return actionBar;
    }

    /**
     * Set copy content and create button
     * @param {string} content - Content to copy
     */
    setCopyContent(content) {
        if (!content || !this.copyButtonContainer) {
            return;
        }
        
        // Clear existing copy button
        this.copyButtonContainer.innerHTML = '';
        
        // Create copy button with the content
        const button = this.copyButton.createButton(content, 'Copy');
        this.copyButtonContainer.appendChild(button);
        
        // Set up copy button callback for button click
        if (this.copyButton.element) {
            this.copyButton.element.addEventListener('click', () => {
                if (this.onCopy) {
                    this.onCopy(this.copyButton.content);
                }
            });
        }
    }

    /**
     * Attach action bar to a container
     * @param {HTMLElement} container - Container to attach action bar to
     */
    attachToContainer(container) {
        if (!container) {
            console.warn('ActionBar: No container provided for attachment');
            return;
        }

        const actionBar = this.createActionBar();
        container.appendChild(actionBar);
        
        console.log('ActionBar: Attached to container');
    }

    /**
     * Show action bar
     */
    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.isVisible = true;
            console.log('ActionBar: Shown');
        } else {
            console.warn('ActionBar: No element reference found');
        }
    }

    /**
     * Hide action bar
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
            this.isVisible = false;
            console.log('ActionBar: Hidden');
        } else {
            console.warn('ActionBar: No element reference found');
        }
    }

    /**
     * Focus search input
     */
    focusSearch() {
        this.searchBar.focus();
    }

    /**
     * Update search results UI from SearchService state
     * @param {Array} matches - Array of match objects (optional, reads from SearchService if not provided)
     */
    updateSearchResults(matches = null) {
        // If SearchService is available, always sync from it
        if (this.searchBar.searchService && this.searchBar.sectionId) {
            this.searchBar.updateUIFromService();
        } else if (matches !== null) {
            // Fallback: update with provided matches if SearchService not available
            this.searchBar.updateSearchResults(matches);
        }
    }

    /**
     * Clear search
     */
    clearSearch() {
        this.searchBar.clearSearch();
    }

    /**
     * Get current search term
     * @returns {string} Current search term
     */
    getSearchTerm() {
        return this.searchBar.getSearchTerm();
    }

    /**
     * Get current match count
     * @returns {number} Number of matches
     */
    getMatchCount() {
        return this.searchBar.getMatchCount();
    }

    /**
     * Get current match index
     * @returns {number} Current match index
     */
    getCurrentMatchIndex() {
        return this.searchBar.getCurrentMatchIndex();
    }

    /**
     * Check if action bar is visible
     * @returns {boolean} True if visible
     */
    isActionBarVisible() {
        return this.isVisible;
    }
}
