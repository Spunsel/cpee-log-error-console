/**
 * Search Service
 * Handles search business logic and state management
 * Responsibilities:
 * - Search state management per section
 * - Search execution coordination
 * - Search navigation coordination
 * - Search clearing coordination
 */

export class SearchService {
    constructor() {
        // Search state per section: { currentSearchTerm, matches, currentMatchIndex, caseSensitive, wholeWord }
        this.searchStates = new Map();
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
}

