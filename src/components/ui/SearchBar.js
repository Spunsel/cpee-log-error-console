/**
 * Search Bar Component
 * Handles search UI for raw content views (stateless - reads state from SearchService)
 * Provides search input, navigation controls, and match display
 */

import { ICONS } from '../../assets/icons.js';

export class SearchBar {
    constructor(domRegistry = null, searchService = null, sectionId = null) {
        this.domRegistry = domRegistry;
        this.searchService = searchService;
        this.sectionId = sectionId;
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
     * Set search service and section ID for this search bar
     * @param {Object} searchService - SearchService instance
     * @param {string} sectionId - Section identifier
     */
    setSearchService(searchService, sectionId) {
        this.searchService = searchService;
        this.sectionId = sectionId;
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
                // Use the actual input value (don't trim) to preserve spaces
                const value = e.target.value;
                this.handleSearchInput(value);
            });

            searchInput.addEventListener('keydown', (e) => {
                // Allow spacebar and other normal input characters to work normally
                // Only intercept special keys
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const term = searchInput.value.trim();
                    if (term) {
                        // Get current state from SearchService
                        const state = this.getSearchState();
                        if (state && state.matches.length > 0) {
                            // If there are matches, navigate to next match
                            this.navigateToMatch('next');
                        } else {
                            // If no matches yet, perform search
                            this.performSearch(term);
                        }
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.clearSearch();
                }
                // Don't prevent default for spacebar or other normal input keys
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
                const state = this.getSearchState();
                if (state && state.matches.length > 0) {
                    this.navigateToMatch('next');
                }
            } else if (!isSearchFocused && e.key === 'F3' && e.shiftKey) {
                e.preventDefault();
                const state = this.getSearchState();
                if (state && state.matches.length > 0) {
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
    }

    /**
     * Handle search input changes
     * @param {string} value - Input value (may contain leading/trailing spaces for display)
     */
    handleSearchInput(value) {
        // Use trimmed value for search logic but preserve original for display
        const searchTerm = value.trim();
        
        if (this.clearBtn) {
            this.clearBtn.style.display = searchTerm ? 'inline-flex' : 'none';
        }

        // Perform search if term is not empty (after trimming)
        // This allows spaces within the search term, only trims edges
        if (searchTerm) {
            this.performSearch(searchTerm);
        } else {
            // Only clear if completely empty (no non-whitespace characters)
            if (!value || value.trim().length === 0) {
                this.clearSearch();
            }
        }
    }

    /**
     * Perform search operation
     * @param {string} searchTerm - Search term (optional, reads from input if not provided)
     */
    performSearch(searchTerm = null) {
        const term = searchTerm || (this.searchInput ? this.searchInput.value.trim() : '');
        if (!term) {
            return;
        }
        
        if (this.onSearch) {
            this.onSearch(term);
        }
    }

    /**
     * Clear search and reset UI (stateless - actual clearing done by SearchService)
     */
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        if (this.clearBtn) {
            this.clearBtn.style.display = 'none';
        }
        if (this.navigation) {
            this.navigation.style.display = 'none';
        }

        if (this.onClear) {
            this.onClear();
        }

        // Update UI from SearchService state (should be empty after clear)
        this.updateUIFromService();
    }

    /**
     * Navigate to next or previous match (stateless - delegates to SearchService)
     * @param {string} direction - 'next' or 'prev'
     */
    navigateToMatch(direction) {
        if (!this.searchService || !this.sectionId) {
            console.warn('SearchBar: Cannot navigate - SearchService or sectionId not set');
            return;
        }

        const state = this.getSearchState();
        if (!state || state.matches.length === 0) {
            return;
        }

        // Delegate navigation to coordinator via callback
        // Coordinator will call SearchService.navigateToMatch() and then update UI
        if (this.onNavigate) {
            this.onNavigate(direction);
        }
    }

    /**
     * Get search state from SearchService
     * @returns {Object|null} Search state or null if not available
     */
    getSearchState() {
        if (!this.searchService || !this.sectionId) {
            return null;
        }
        return this.searchService.getSearchState(this.sectionId);
    }

    /**
     * Update search results UI from SearchService state
     * @param {Array} matches - Array of match objects (optional, reads from SearchService if not provided)
     */
    updateSearchResults(matches = null) {
        // If matches provided, use them; otherwise read from SearchService
        let stateMatches = matches;
        let currentIndex = -1;
        
        if (this.searchService && this.sectionId) {
            const state = this.getSearchState();
            if (state) {
                if (matches === null) {
                    stateMatches = state.matches || [];
                }
                currentIndex = state.currentMatchIndex !== undefined ? state.currentMatchIndex : -1;
            }
        } else if (matches !== null) {
            // Fallback: if SearchService not available but matches provided
            stateMatches = matches;
        } else {
            stateMatches = [];
        }

        this.updateNavigationDisplay(stateMatches, currentIndex);
    }

    /**
     * Update UI from SearchService state (called after SearchService operations)
     */
    updateUIFromService() {
        if (!this.searchService || !this.sectionId) {
            return;
        }

        const state = this.getSearchState();
        if (!state) {
            // No state means no search - hide navigation
            if (this.navigation) {
                this.navigation.style.display = 'none';
            }
            if (this.clearBtn) {
                this.clearBtn.style.display = 'none';
            }
            return;
        }

        // Update input value if needed
        // Only sync if the user isn't currently typing (to avoid overwriting spacebar input)
        if (this.searchInput && document.activeElement !== this.searchInput) {
            if (this.searchInput.value !== (state.currentSearchTerm || '')) {
                this.searchInput.value = state.currentSearchTerm || '';
            }
        }

        // Update clear button visibility
        if (this.clearBtn) {
            this.clearBtn.style.display = state.currentSearchTerm ? 'inline-flex' : 'none';
        }

        // Update navigation display
        this.updateNavigationDisplay(state.matches || [], state.currentMatchIndex);
    }

    /**
     * Get search results for external access (reads from SearchService)
     * @returns {Array} Current matches
     */
    getSearchResults() {
        const state = this.getSearchState();
        return state ? (state.matches || []) : [];
    }

    /**
     * Update navigation display
     * @param {Array} matches - Array of matches (optional, reads from SearchService if not provided)
     * @param {number} currentIndex - Current match index (optional, reads from SearchService if not provided)
     */
    updateNavigationDisplay(matches = null, currentIndex = null) {
        // Get state from SearchService if not provided
        if (matches === null || currentIndex === null) {
            const state = this.getSearchState();
            if (state) {
                matches = matches || state.matches || [];
                currentIndex = currentIndex !== null ? currentIndex : (state.currentMatchIndex !== undefined ? state.currentMatchIndex : -1);
            } else {
                matches = matches || [];
                currentIndex = currentIndex !== null ? currentIndex : -1;
            }
        }

        if (this.navigation) {
            this.navigation.style.display = matches.length > 0 ? 'flex' : 'none';
        }

        if (this.counter) {
            if (matches.length > 0) {
                const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
                this.counter.textContent = `${displayIndex} of ${matches.length}`;
            } else {
                this.counter.textContent = '0 of 0';
            }
        }

        // Enable/disable navigation buttons
        if (this.prevBtn && this.nextBtn) {
            const hasMatches = matches.length > 0;
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
     * Get current search term (reads from SearchService or input)
     * @returns {string} Current search term
     */
    getSearchTerm() {
        if (this.searchService && this.sectionId) {
            const state = this.getSearchState();
            if (state && state.currentSearchTerm) {
                return state.currentSearchTerm;
            }
        }
        // Fallback to input value
        return this.searchInput ? this.searchInput.value.trim() : '';
    }

    /**
     * Get current match count (reads from SearchService)
     * @returns {number} Number of matches
     */
    getMatchCount() {
        const state = this.getSearchState();
        return state ? (state.matches?.length || 0) : 0;
    }

    /**
     * Get current match index (reads from SearchService)
     * @returns {number} Current match index
     */
    getCurrentMatchIndex() {
        const state = this.getSearchState();
        return state && state.currentMatchIndex !== undefined ? state.currentMatchIndex : -1;
    }
}
