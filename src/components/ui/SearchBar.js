/**
 * Search Bar Component
 * Handles search functionality for raw content views
 * Provides search input, navigation controls, and match highlighting
 */

import { ICONS } from '../../assets/icons.js';

export class SearchBar {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        this.searchTerm = '';
        this.matches = [];
        this.currentMatchIndex = -1;
        this.onSearch = null;
        this.onClear = null;
        this.onNavigate = null;
        
        // Store references to DOM elements
        this.element = null;
        this.searchInput = null;
        this.clearBtn = null;
        this.navigation = null;
        this.counter = null;
        this.prevBtn = null;
        this.nextBtn = null;
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
     * Set callback for when search is performed
     * @param {Function} callback - Callback function to call with search term
     */
    setOnSearch(callback) {
        this.onSearch = callback;
    }

    /**
     * Set callback for when search is cleared
     * @param {Function} callback - Callback function to call
     */
    setOnClear(callback) {
        this.onClear = callback;
    }

    /**
     * Set callback for when navigation occurs
     * @param {Function} callback - Callback function to call with direction ('next' or 'prev')
     */
    setOnNavigate(callback) {
        this.onNavigate = callback;
    }

    /**
     * Create search bar HTML structure
     * @returns {HTMLElement} Search bar container
     */
    createSearchBar() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'raw-content-search-bar';
        searchContainer.innerHTML = `
            <div class="search-input-group">
                <div class="search-icon">${ICONS.SEARCH}</div>
                <input 
                    type="text" 
                    class="search-input" 
                    placeholder="Search..." 
                    aria-label="Search in raw content"
                />
                <button class="search-clear-btn" aria-label="Clear search" style="display: none;">
                    ${ICONS.CLEAR_SEARCH}
                </button>
            </div>
            <div class="search-navigation" style="display: none;" role="group" aria-label="Search navigation">
                <button class="search-prev-btn" aria-label="Previous match" title="Previous match">
                    ${ICONS.SEARCH_PREV}
                </button>
                <span class="search-counter" role="status" aria-live="polite">0 of 0</span>
                <button class="search-next-btn" aria-label="Next match" title="Next match">
                    ${ICONS.SEARCH_NEXT}
                </button>
            </div>
        `;

        return searchContainer;
    }

    /**
     * Attach search bar to a container
     * @param {HTMLElement} container - Container to attach search bar to
     */
    attachToContainer(container) {
        if (!container) {
            console.warn('SearchBar: No container provided for attachment');
            return;
        }

        const searchBar = this.createSearchBar();
        container.appendChild(searchBar);
        
        // Store references to DOM elements
        this.element = searchBar;
        this.searchInput = searchBar.querySelector('.search-input');
        this.clearBtn = searchBar.querySelector('.search-clear-btn');
        this.navigation = searchBar.querySelector('.search-navigation');
        this.counter = searchBar.querySelector('.search-counter');
        this.prevBtn = searchBar.querySelector('.search-prev-btn');
        this.nextBtn = searchBar.querySelector('.search-next-btn');
        
        this.setupEventListeners(searchBar);
        console.log('SearchBar: Attached to container and event listeners set up');
    }

    /**
     * Setup event listeners for search functionality
     * @param {HTMLElement} searchBar - Search bar element
     */
    setupEventListeners(searchBar) {
        const searchInput = searchBar.querySelector('.search-input');
        const clearBtn = searchBar.querySelector('.search-clear-btn');
        const prevBtn = searchBar.querySelector('.search-prev-btn');
        const nextBtn = searchBar.querySelector('.search-next-btn');

        // Search input events
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.searchTerm && this.matches.length > 0) {
                        // If there are matches, navigate to next match
                        this.navigateToMatch('next');
                    } else if (this.searchTerm) {
                        // If no matches yet, perform search
                        this.performSearch();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.clearSearch();
                }
            });
        }

        // Clear button
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Navigation buttons
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.navigateToMatch('prev');
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.navigateToMatch('next');
            });
        }

        // Keyboard shortcuts for search navigation
        document.addEventListener('keydown', (e) => {
            const isSearchFocused = document.activeElement === searchInput;
            
            // F3 for next match, Shift+F3 for previous
            if (!isSearchFocused && e.key === 'F3' && !e.shiftKey) {
                e.preventDefault();
                if (this.matches.length > 0) {
                    this.navigateToMatch('next');
                }
            } else if (!isSearchFocused && e.key === 'F3' && e.shiftKey) {
                e.preventDefault();
                if (this.matches.length > 0) {
                    this.navigateToMatch('prev');
                }
            }
            
            // Ctrl+F to focus search (when in a content area)
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                const target = e.target;
                if (target && (target.tagName === 'PRE' || target.tagName === 'CODE' || target.closest('.raw-content-section'))) {
                    e.preventDefault();
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                }
            }
        });

        console.log('SearchBar: Event listeners attached');
    }

    /**
     * Handle search input changes
     * @param {string} value - Input value
     */
    handleSearchInput(value) {
        this.searchTerm = value.trim();
        
        if (this.clearBtn) {
            this.clearBtn.style.display = this.searchTerm ? 'inline-flex' : 'none';
        }

        // Perform search if term is not empty
        if (this.searchTerm) {
            this.performSearch();
        } else {
            this.clearSearch();
        }
    }

    /**
     * Perform search operation
     */
    performSearch() {
        if (!this.searchTerm) {
            return;
        }

        console.log(`SearchBar: Performing search for "${this.searchTerm}"`);
        
        if (this.onSearch) {
            this.onSearch(this.searchTerm);
        }
    }

    /**
     * Clear search and reset state
     */
    clearSearch() {
        this.searchTerm = '';
        this.matches = [];
        this.currentMatchIndex = -1;

        if (this.searchInput) {
            this.searchInput.value = '';
        }
        if (this.clearBtn) {
            this.clearBtn.style.display = 'none';
        }
        if (this.navigation) {
            this.navigation.style.display = 'none';
        }

        console.log('SearchBar: Search cleared');

        if (this.onClear) {
            this.onClear();
        }
    }

    /**
     * Navigate to next or previous match
     * @param {string} direction - 'next' or 'prev'
     */
    navigateToMatch(direction) {
        if (this.matches.length === 0) {
            return;
        }

        if (direction === 'next') {
            this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
        } else if (direction === 'prev') {
            this.currentMatchIndex = this.currentMatchIndex <= 0 ? this.matches.length - 1 : this.currentMatchIndex - 1;
        }

        this.updateNavigationDisplay();

        console.log(`SearchBar: Navigated to match ${this.currentMatchIndex + 1} of ${this.matches.length}`);

        if (this.onNavigate) {
            this.onNavigate(direction, this.currentMatchIndex);
        }
    }

    /**
     * Update search results
     * @param {Array} matches - Array of match objects
     */
    updateSearchResults(matches) {
        this.matches = matches || [];
        this.currentMatchIndex = this.matches.length > 0 ? 0 : -1;

        this.updateNavigationDisplay();

        console.log(`SearchBar: Updated with ${this.matches.length} matches`);
    }

    /**
     * Get search results for external access
     * @returns {Array} Current matches
     */
    getSearchResults() {
        return this.matches;
    }

    /**
     * Update navigation display
     */
    updateNavigationDisplay() {
        if (this.navigation) {
            this.navigation.style.display = this.matches.length > 0 ? 'flex' : 'none';
        }

        if (this.counter) {
            if (this.matches.length > 0) {
                this.counter.textContent = `${this.currentMatchIndex + 1} of ${this.matches.length}`;
            } else {
                this.counter.textContent = '0 of 0';
            }
        }

        // Enable/disable navigation buttons
        if (this.prevBtn && this.nextBtn) {
            const hasMatches = this.matches.length > 0;
            this.prevBtn.disabled = !hasMatches;
            this.nextBtn.disabled = !hasMatches;
        }
    }

    /**
     * Show search bar
     */
    show() {
        if (this.element) {
            this.element.style.display = 'flex';
        }
    }

    /**
     * Hide search bar
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    /**
     * Focus search input
     */
    focus() {
        if (this.searchInput) {
            this.searchInput.focus();
        }
    }

    /**
     * Get current search term
     * @returns {string} Current search term
     */
    getSearchTerm() {
        return this.searchTerm;
    }

    /**
     * Get current match count
     * @returns {number} Number of matches
     */
    getMatchCount() {
        return this.matches.length;
    }

    /**
     * Get current match index
     * @returns {number} Current match index
     */
    getCurrentMatchIndex() {
        return this.currentMatchIndex;
    }
}
