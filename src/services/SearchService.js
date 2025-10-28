/**
 * Search Service
 * Unified search functionality combining state management and highlighting
 * Responsibilities:
 * - Search state management per section
 * - Search term matching in content
 * - Applying highlighting to DOM elements
 * - Clearing highlighting from DOM elements
 * - Scrolling to search matches
 * - Search navigation coordination
 */

export class SearchService {
    constructor() {
        // Search state per section: { currentSearchTerm, matches, currentMatchIndex, caseSensitive, wholeWord }
        this.searchStates = new Map();
        // Store original content for each section to restore highlighting
        this.originalContent = new Map();
    }

    /**
     * Initialize search state for a section
     * @param {string} sectionId - Section identifier
     */
    initializeSearchState(sectionId) {
        if (!this.searchStates.has(sectionId)) {
            this.searchStates.set(sectionId, {
                currentSearchTerm: '',
                matches: [],
                currentMatchIndex: -1,
                caseSensitive: false,
                wholeWord: false
            });
        }
    }

    /**
     * Get search state for a section
     * @param {string} sectionId - Section identifier
     * @returns {Object|null} Search state or null if not found
     */
    getSearchState(sectionId) {
        return this.searchStates.get(sectionId) || null;
    }

    /**
     * Update search state with search results
     * @param {string} sectionId - Section identifier
     * @param {string} searchTerm - Search term
     * @param {Array} matches - Array of matches
     */
    updateSearchResults(sectionId, searchTerm, matches) {
        const state = this.searchStates.get(sectionId);
        if (state) {
            state.currentSearchTerm = searchTerm;
            state.matches = matches;
            state.currentMatchIndex = matches.length > 0 ? 0 : -1;
        }
    }

    /**
     * Navigate to next or previous match
     * @param {string} sectionId - Section identifier
     * @param {string} direction - 'next' or 'prev'
     */
    navigateToMatch(sectionId, direction) {
        const state = this.searchStates.get(sectionId);
        if (!state || state.matches.length === 0) {
            return -1;
        }

        if (direction === 'next') {
            state.currentMatchIndex = (state.currentMatchIndex + 1) % state.matches.length;
        } else if (direction === 'prev') {
            state.currentMatchIndex = state.currentMatchIndex <= 0 ? state.matches.length - 1 : state.currentMatchIndex - 1;
        }

        return state.currentMatchIndex;
    }

    /**
     * Clear search state for a section
     * @param {string} sectionId - Section identifier
     */
    clearSearchState(sectionId) {
        const state = this.searchStates.get(sectionId);
        if (state) {
            state.currentSearchTerm = '';
            state.matches = [];
            state.currentMatchIndex = -1;
        }
    }

    /**
     * Clear all search states
     */
    clearAllSearchStates() {
        this.searchStates.forEach((state) => {
            state.currentSearchTerm = '';
            state.matches = [];
            state.currentMatchIndex = -1;
        });
    }

    /**
     * Set search option (e.g., caseSensitive, wholeWord)
     * @param {string} sectionId - Section identifier
     * @param {string} option - Option name
     * @param {boolean} value - Option value
     */
    setSearchOption(sectionId, option, value) {
        const state = this.searchStates.get(sectionId);
        if (state && Object.prototype.hasOwnProperty.call(state, option)) {
            state[option] = value;
        }
    }

    /**
     * Store original content for a section
     * @param {HTMLElement} container - Container element
     * @param {string} sectionId - Section identifier
     */
    storeOriginalContent(container, sectionId) {
        const codeElement = container.querySelector('code');
        if (codeElement && !this.originalContent.has(sectionId)) {
            this.originalContent.set(sectionId, codeElement.textContent);
        }
    }

    /**
     * Search for term in content and apply highlighting
     * @param {string} content - Content to search in
     * @param {string} searchTerm - Search term
     * @param {Object} options - Search options (caseSensitive, wholeWord)
     * @returns {Object} Search results with matches and highlighted HTML
     */
    searchInContent(content, searchTerm, options = {}) {
        if (!content || !searchTerm) {
            return {
                matchCount: 0,
                matches: [],
                highlightedHTML: ''
            };
        }

        const { caseSensitive = false, wholeWord = false } = options;
        const flags = caseSensitive ? 'g' : 'gi';
        
        let pattern = searchTerm;
        
        // Escape special regex characters
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Add word boundary if whole word matching is enabled
        if (wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }

        const matchText = caseSensitive ? content : content;

        const matches = [];
        let match;
        const tempRegex = new RegExp(pattern, flags);
        
        while ((match = tempRegex.exec(matchText)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                text: match[0]
            });
        }

        if (matches.length === 0) {
            return {
                matchCount: 0,
                matches: [],
                highlightedHTML: ''
            };
        }

        // Build highlighted HTML
        let highlightedHTML = '';
        let lastIndex = 0;

        matches.forEach((match) => {
            const beforeMatch = content.substring(lastIndex, match.index);
            highlightedHTML += this.escapeHtml(beforeMatch);
            highlightedHTML += `<span class="search-match">${this.escapeHtml(match.text)}</span>`;
            lastIndex = match.index + match.length;
        });

        const remainingText = content.substring(lastIndex);
        highlightedHTML += this.escapeHtml(remainingText);

        return {
            matchCount: matches.length,
            matches: matches,
            highlightedHTML: highlightedHTML
        };
    }

    /**
     * Apply search highlighting to a container
     * @param {HTMLElement} container - Container with rendered content
     * @param {string} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Array} Array of match objects
     */
    applySearchHighlighting(container, searchTerm, options = {}) {
        const codeElement = container.querySelector('code');
        if (!codeElement) {
            console.warn('SearchService: No code element found');
            return [];
        }

        // Store original text if not already stored
        if (!codeElement.dataset.originalText) {
            codeElement.dataset.originalText = codeElement.textContent;
        }

        const originalText = codeElement.textContent;
        const results = this.searchInContent(originalText, searchTerm, options);

        // Update innerHTML based on whether there are matches
        if (results.matchCount > 0) {
            codeElement.innerHTML = results.highlightedHTML;
        } else {
            // No matches - restore original text to clear any previous highlights
            codeElement.textContent = codeElement.dataset.originalText;
        }

        console.log(`SearchService: Applied ${results.matchCount} highlights`);
        return results.matches;
    }

    /**
     * Clear search highlighting from a container
     * @param {HTMLElement} container - Container with highlighted content
     */
    clearSearchHighlighting(container) {
        const codeElement = container.querySelector('code');
        if (!codeElement) {
            console.warn('SearchService: No code element found');
            return;
        }

        // Restore original text if it was stored
        if (codeElement.dataset.originalText) {
            codeElement.textContent = codeElement.dataset.originalText;
            delete codeElement.dataset.originalText;
        }

        console.log('SearchService: Cleared search highlighting');
    }

    /**
     * Scroll to a specific match in the content
     * @param {HTMLElement} container - Container with rendered content
     * @param {number} matchIndex - Index of match to scroll to
     * @returns {boolean} True if scrolled successfully
     */
    scrollToMatch(container, matchIndex) {
        if (!container || matchIndex < 0) {
            return false;
        }

        const matches = container.querySelectorAll('.search-match');
        if (!matches || matches.length === 0) {
            console.warn('SearchService: No matches found in container');
            return false;
        }

        const targetMatch = matches[matchIndex];
        if (targetMatch) {
            // Find the scrollable raw container (parent with [data-content-type="raw"])
            const rawContainer = container.closest('[data-content-type="raw"]');
            if (rawContainer) {
                // Calculate position to scroll to within the raw container
                const containerRect = rawContainer.getBoundingClientRect();
                const matchRect = targetMatch.getBoundingClientRect();
                
                // Calculate the scroll position needed to center the match
                const scrollTop = rawContainer.scrollTop + (matchRect.top - containerRect.top) - (containerRect.height / 2) + (matchRect.height / 2);
                
                // Smooth scroll within the raw container
                rawContainer.scrollTo({
                    top: scrollTop,
                    behavior: 'smooth'
                });
            } else {
                // Fallback to scrollIntoView if raw container not found
                targetMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // Add active class to highlight the current match
            matches.forEach((match, idx) => {
                match.classList.toggle('search-match-active', idx === matchIndex);
            });

            console.log(`SearchService: Scrolled to match ${matchIndex + 1}`);
            return true;
        }

        return false;
    }

    /**
     * Escape HTML characters in text
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Combined workflow: Perform search and apply highlighting
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container element
     * @param {string} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Array} Array of match objects
     */
    performSearch(sectionId, container, searchTerm, options = {}) {
        // Initialize search state if needed
        this.initializeSearchState(sectionId);
        
        // Store original content
        this.storeOriginalContent(container, sectionId);
        
        // Apply highlighting and get matches
        const matches = this.applySearchHighlighting(container, searchTerm, options);
        
        // Update search state
        this.updateSearchResults(sectionId, searchTerm, matches);
        
        return matches;
    }

    /**
     * Combined workflow: Clear search and highlighting
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container element
     */
    clearSearch(sectionId, container) {
        // Clear highlighting
        this.clearSearchHighlighting(container);
        
        // Clear search state
        this.clearSearchState(sectionId);
    }

    /**
     * Combined workflow: Navigate to next match
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container element
     * @returns {boolean} True if navigation was successful
     */
    navigateToNextMatch(sectionId, container) {
        const matchIndex = this.navigateToMatch(sectionId, 'next');
        if (matchIndex >= 0) {
            return this.scrollToMatch(container, matchIndex);
        }
        return false;
    }

    /**
     * Combined workflow: Navigate to previous match
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container element
     * @returns {boolean} True if navigation was successful
     */
    navigateToPreviousMatch(sectionId, container) {
        const matchIndex = this.navigateToMatch(sectionId, 'prev');
        if (matchIndex >= 0) {
            return this.scrollToMatch(container, matchIndex);
        }
        return false;
    }

    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getStats() {
        return {
            searchStatesCount: this.searchStates.size,
            originalContentCount: this.originalContent.size,
            totalSections: Math.max(this.searchStates.size, this.originalContent.size)
        };
    }

    /**
     * Destroy the service
     */
    destroy() {
        this.searchStates.clear();
        this.originalContent.clear();
        console.log('SearchService: Destroyed');
    }
}

