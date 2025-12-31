/**
 * Action Bar Component
 * Combines copy button, download button and search bar in a sticky container
 * Provides unified interface for raw content actions
 */

import { CopyButton } from './CopyButton.js';
import { DownloadButton } from './DownloadButton.js';
import { SearchBar } from './SearchBar.js';
import { ICONS } from '../../assets/icons.js';

export class ActionBar {
    constructor(domRegistry = null, searchService = null, sectionId = null, options = {}) {
        this.domRegistry = domRegistry;
        this.copyButton = new CopyButton(domRegistry);
        this.downloadButton = new DownloadButton(domRegistry, { showText: false });
        this.searchBar = new SearchBar(domRegistry, searchService, sectionId);
        this.sectionId = sectionId;
        this.isVisible = false;
        this.onCopy = null;
        this.onDownload = null;
        this.onSearch = null;
        this.onClear = null;
        this.onNavigate = null;
        this.element = null; // Store reference to the action bar DOM element
        
        // Options
        this.showSearch = options.showSearch !== false; // Default to true
        this.showViewLog = options.showViewLog === true; // Default to false
        
        // Download metadata
        this.instanceNumber = null;
        this.stepNumber = null;
        
        // View log URL
        this.viewLogUrl = null;
        this.viewLogButtonContainer = null;
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
     * Horizontal layout for section header:
     * LEFT: search input | search count with nav (if showSearch is true)
     * RIGHT: download button | copy button
     * @param {Object} options - Options for action bar creation
     * @param {boolean} options.showSearch - Whether to show search (default: true)
     * @returns {HTMLElement} Action bar container
     */
    createActionBar(options = {}) {
        const { showSearch = true } = options;
        
        const actionBar = document.createElement('div');
        actionBar.className = 'raw-content-actions-bar';
        if (!showSearch) {
            actionBar.classList.add('no-search');
        }
        actionBar.style.display = 'none'; // Hidden by default
        
        // Store reference to this element
        this.element = actionBar;
        
        // === LEFT SIDE: Search (input, then counter + nav) ===
        const leftSide = document.createElement('div');
        leftSide.className = 'action-bar-left';
        
        if (showSearch) {
            // Create search input container
            const searchContainer = document.createElement('div');
            searchContainer.className = 'action-bar-search-container';
            
            // Append search bar to search container
            this.searchBar.attachToContainer(searchContainer);
            
            // Create navigation container (prev | counter | next)
            const navContainer = document.createElement('div');
            navContainer.className = 'action-bar-nav-container';
            
            // Create previous button (<)
            const prevBtn = document.createElement('button');
            prevBtn.className = 'action-bar-nav-btn action-bar-nav-prev';
            prevBtn.setAttribute('aria-label', 'Previous match');
            prevBtn.setAttribute('title', 'Previous match');
            prevBtn.innerHTML = ICONS.LT;
            prevBtn.style.display = 'none'; // Hidden until matches found
            
            // Create counter container
            const counterContainer = document.createElement('div');
            counterContainer.className = 'action-bar-counter-container';
            
            // Create next button (>)
            const nextBtn = document.createElement('button');
            nextBtn.className = 'action-bar-nav-btn action-bar-nav-next';
            nextBtn.setAttribute('aria-label', 'Next match');
            nextBtn.setAttribute('title', 'Next match');
            nextBtn.innerHTML = ICONS.GT;
            nextBtn.style.display = 'none'; // Hidden until matches found
            
            // Store references
            this.prevBtn = prevBtn;
            this.nextBtn = nextBtn;
            this.counterContainer = counterContainer;
            
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
            
            // Assemble navigation: prev | counter | next
            navContainer.appendChild(prevBtn);
            navContainer.appendChild(counterContainer);
            navContainer.appendChild(nextBtn);
            
            // After search bar is attached, extract the counter
            requestAnimationFrame(() => {
                this.extractCounterToNavContainer();
            });
            
            // Assemble left side: search input | nav container
            leftSide.appendChild(searchContainer);
            leftSide.appendChild(navContainer);
        }
        
        // === RIGHT SIDE: Buttons (download, copy, view log) ===
        const rightSide = document.createElement('div');
        rightSide.className = 'action-bar-right';
        
        // Create download button container
        const downloadButtonContainer = document.createElement('div');
        downloadButtonContainer.className = 'action-bar-download-container';
        
        // Create copy button container
        const copyButtonContainer = document.createElement('div');
        copyButtonContainer.className = 'action-bar-copy-container';
        
        // Create view log button container (only if showViewLog is true)
        const viewLogButtonContainer = document.createElement('div');
        viewLogButtonContainer.className = 'action-bar-viewlog-container';
        if (!this.showViewLog) {
            viewLogButtonContainer.style.display = 'none';
        }
        
        // Store references to button containers
        this.downloadButtonContainer = downloadButtonContainer;
        this.copyButtonContainer = copyButtonContainer;
        this.viewLogButtonContainer = viewLogButtonContainer;
        
        // Assemble right side (download, copy, then view log)
        rightSide.appendChild(downloadButtonContainer);
        rightSide.appendChild(copyButtonContainer);
        rightSide.appendChild(viewLogButtonContainer);
        
        // === Assemble action bar ===
        actionBar.appendChild(leftSide);
        actionBar.appendChild(rightSide);
        
        return actionBar;
    }


    /**
     * Extract counter from search bar and move it to the navigation container
     */
    extractCounterToNavContainer() {
        if (!this.searchBar.element || !this.counterContainer) {
            return;
        }
        
        // Find the navigation element which contains the counter
        const navigation = this.searchBar.element.querySelector('.search-navigation');
        if (navigation && this.counterContainer) {
            // Find the counter element
            const counter = navigation.querySelector('.search-counter');
            if (counter) {
                // Move counter to our counter container
                this.counterContainer.appendChild(counter);
                
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
     * Set download metadata for filename generation
     * @param {number} instanceNumber - CPEE instance/process number
     * @param {number} stepNumber - Step number
     */
    setDownloadMetadata(instanceNumber, stepNumber) {
        this.instanceNumber = instanceNumber;
        this.stepNumber = stepNumber;
    }

    /**
     * Set download content and create button
     * @param {string} content - Content to download
     */
    setDownloadContent(content) {
        if (!content || !this.downloadButtonContainer || !this.instanceNumber || !this.stepNumber || !this.sectionId) {
            return;
        }
        
        // Clear existing download button
        this.downloadButtonContainer.innerHTML = '';
        
        // Generate filename based on metadata
        const filename = DownloadButton.generateFilename(this.instanceNumber, this.stepNumber, this.sectionId);
        
        // Create download button with icon only (no text label)
        const downloadButtonInstance = new DownloadButton(this.domRegistry, { showText: false });
        const button = downloadButtonInstance.createButton(content, filename, '');
        this.downloadButtonContainer.appendChild(button);
        
        // Update the downloadButton reference
        this.downloadButton = downloadButtonInstance;
        
        // Set up download button callback for button click
        if (this.downloadButton.element) {
            this.downloadButton.element.addEventListener('click', () => {
                if (this.onDownload) {
                    this.onDownload(filename, this.downloadButton.content);
                }
            });
        }
    }

    /**
     * Set callback for download functionality
     * @param {Function} callback - Callback function to call with filename and content
     */
    setOnDownload(callback) {
        this.onDownload = callback;
    }

    /**
     * Set view log URL and create the view log button
     * Opens the CPEE log page in a new tab when clicked
     * @param {string} url - URL to the CPEE log page
     */
    setViewLogUrl(url) {
        if (!url || !this.viewLogButtonContainer) {
            return;
        }
        
        this.viewLogUrl = url;
        
        // Clear existing button
        this.viewLogButtonContainer.innerHTML = '';
        
        // Create view log button
        const button = document.createElement('button');
        button.className = 'viewlog-btn';
        button.setAttribute('aria-label', 'View log on CPEE');
        button.setAttribute('title', 'View log on CPEE');
        button.innerHTML = ICONS.VIEW_LOG;
        
        // Open URL in new tab on click
        button.addEventListener('click', () => {
            window.open(url, '_blank', 'noopener,noreferrer');
        });
        
        this.viewLogButtonContainer.appendChild(button);
        
        // Make sure container is visible
        this.viewLogButtonContainer.style.display = 'flex';
    }

    /**
     * Attach action bar to a container
     * @param {HTMLElement} container - Container to attach action bar to
     * @param {string} position - 'prepend' to insert at start, 'append' to insert at end (default: 'prepend')
     */
    attachToContainer(container, position = 'prepend') {
        if (!container) {
            console.warn('ActionBar: No container provided for attachment');
            return;
        }

        const actionBar = this.createActionBar({ showSearch: this.showSearch });
        
        if (position === 'prepend') {
            // Insert at the beginning of the container
            container.insertBefore(actionBar, container.firstChild);
        } else {
            // Append to the end of the container
            container.appendChild(actionBar);
        }
    }

    /**
     * Show action bar
     */
    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.isVisible = true;
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
