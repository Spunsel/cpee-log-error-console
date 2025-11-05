/**
 * Action Bar Component
 * Combines copy button and search bar in a sticky container
 * Provides unified interface for raw content actions
 */

import { CopyButton } from './CopyButton.js';
import { SearchBar } from './SearchBar.js';
import { ICONS } from '../../assets/icons.js';

export class ActionBar {
    constructor(domRegistry = null, searchService = null, sectionId = null, options = {}) {
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
        
        // Create top row container
        const topRow = document.createElement('div');
        topRow.className = 'action-bar-top-row';
        
        // Create counter container (top left) - will be populated after search bar is created
        const counterContainer = document.createElement('div');
        counterContainer.className = 'action-bar-counter-container';
        // Counter will be moved here from search bar after it's created
        
        // Create navigation buttons container
        const navButtonsContainer = document.createElement('div');
        navButtonsContainer.className = 'action-bar-nav-buttons';
        
        // Create previous button (<)
        const prevBtn = document.createElement('button');
        prevBtn.className = 'action-bar-nav-btn action-bar-nav-prev';
        prevBtn.setAttribute('aria-label', 'Previous match');
        prevBtn.setAttribute('title', 'Previous match');
        prevBtn.innerHTML = ICONS.LT;
        prevBtn.style.display = 'none'; // Hidden until matches found
        
        // Create next button (>)
        const nextBtn = document.createElement('button');
        nextBtn.className = 'action-bar-nav-btn action-bar-nav-next';
        nextBtn.setAttribute('aria-label', 'Next match');
        nextBtn.setAttribute('title', 'Next match');
        nextBtn.innerHTML = ICONS.GT;
        nextBtn.style.display = 'none'; // Hidden until matches found
        
        // Store references to navigation buttons
        this.prevBtn = prevBtn;
        this.nextBtn = nextBtn;
        
        // Add click handlers for navigation
        prevBtn.addEventListener('click', () => {
            if (this.onNavigate) {
                this.onNavigate('prev');
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (this.onNavigate) {
                this.onNavigate('next');
            }
        });
        
        // Store references to navigation buttons and counter container
        this.prevBtn = prevBtn;
        this.nextBtn = nextBtn;
        this.counterContainer = counterContainer;
        this.navButtonsContainer = navButtonsContainer;
        
        // Don't add counter to top row - it will go under search bar
        
        // Create bottom row for search bar
        const bottomRow = document.createElement('div');
        bottomRow.className = 'action-bar-bottom-row';
        
        // Append search bar to bottom row
        this.searchBar.attachToContainer(bottomRow);
        
        // Create counter row below search bar
        const counterRow = document.createElement('div');
        counterRow.className = 'action-bar-counter-row';
        
        // Assemble navigation buttons and counter container
        navButtonsContainer.appendChild(prevBtn);
        navButtonsContainer.appendChild(nextBtn);
        counterContainer.appendChild(navButtonsContainer);
        counterRow.appendChild(counterContainer);
        
        // After search bar is attached, extract the counter to counter row
        // Use requestAnimationFrame to ensure DOM is fully ready
        requestAnimationFrame(() => {
            this.extractCounterBelowSearchBar();
        });
        
        // Add counter row after bottom row
        bottomRow.appendChild(counterRow);
        
        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'action-bar-content';
        contentWrapper.appendChild(topRow);
        contentWrapper.appendChild(bottomRow);
        
        // Create copy button container (outside action-bar-content, underneath it)
        const copyButtonContainer = document.createElement('div');
        copyButtonContainer.className = 'action-bar-copy-container';
        
        // Store reference to copy button container
        this.copyButtonContainer = copyButtonContainer;
        
        // Create wrapper to stack content and copy button vertically
        const wrapper = document.createElement('div');
        wrapper.className = 'action-bar-wrapper';
        wrapper.appendChild(contentWrapper);
        wrapper.appendChild(copyButtonContainer);
        
        // Assemble action bar (no collapser - always visible)
        actionBar.appendChild(wrapper);
        
        return actionBar;
    }


    /**
     * Extract counter from search bar and move it below search bar
     */
    extractCounterBelowSearchBar() {
        if (!this.searchBar.element || !this.counterContainer) {
            return;
        }
        
        // Find the navigation element which contains the counter
        const navigation = this.searchBar.element.querySelector('.search-navigation');
        if (navigation && this.counterContainer && this.navButtonsContainer) {
            // Find the counter element
            const counter = navigation.querySelector('.search-counter');
            if (counter) {
                // The SearchBar's counter reference already points to this element
                // So updates will continue to work
                
                // Insert counter between prev and next buttons
                const nextBtn = this.navButtonsContainer.querySelector('.action-bar-nav-next');
                if (nextBtn) {
                    this.navButtonsContainer.insertBefore(counter, nextBtn);
                } else {
                    this.navButtonsContainer.appendChild(counter);
                }
                
                // Hook into SearchBar's updateNavigationDisplay to sync visibility
                const originalUpdateNavigationDisplay = this.searchBar.updateNavigationDisplay.bind(this.searchBar);
                this.searchBar.updateNavigationDisplay = (matches, currentIndex) => {
                    // Call original method first
                    originalUpdateNavigationDisplay(matches, currentIndex);
                    
                    // Then sync counter and navigation buttons visibility based on matches
                    const hasMatches = matches && matches.length > 0;
                    
                    if (this.searchBar.counter) {
                        // Show counter only when there are matches
                        this.searchBar.counter.style.display = hasMatches ? 'inline-block' : 'none';
                    }
                    
                    // Show/hide navigation buttons based on matches
                    if (this.prevBtn) {
                        this.prevBtn.style.display = hasMatches ? 'inline-flex' : 'none';
                    }
                    if (this.nextBtn) {
                        this.nextBtn.style.display = hasMatches ? 'inline-flex' : 'none';
                    }
                };
                
                // Initialize counter and buttons as hidden (no matches yet)
                if (this.searchBar.counter) {
                    this.searchBar.counter.style.display = 'none';
                }
                if (this.prevBtn) {
                    this.prevBtn.style.display = 'none';
                }
                if (this.nextBtn) {
                    this.nextBtn.style.display = 'none';
                }
            }
        }
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
        
        // Create copy button with icon only (no text label)
        // Pass options to CopyButton to disable text
        const copyButtonInstance = new CopyButton(this.domRegistry, { showText: false });
        const button = copyButtonInstance.createButton(content, '');
        this.copyButtonContainer.appendChild(button);
        
        // Update the copyButton reference
        this.copyButton = copyButtonInstance;
        
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
        // Prepend to ensure it appears first and anchors correctly during scrolling
        container.insertBefore(actionBar, container.firstChild);
        
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
