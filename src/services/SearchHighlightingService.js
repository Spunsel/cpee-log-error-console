/**
 * Search Highlighting Service
 * Handles search highlighting and DOM manipulation
 * Responsibilities:
 * - Search term matching in content
 * - Applying highlighting to DOM elements
 * - Clearing highlighting from DOM elements
 * - Scrolling to search matches
 */

export class SearchHighlightingService {
    constructor() {
        // Store original content for each section to restore highlighting
        this.originalContent = new Map();
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
            console.warn('SearchHighlightingService: No code element found');
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

        console.log(`SearchHighlightingService: Applied ${results.matchCount} highlights`);
        return results.matches;
    }

    /**
     * Clear search highlighting from a container
     * @param {HTMLElement} container - Container with highlighted content
     */
    clearSearchHighlighting(container) {
        const codeElement = container.querySelector('code');
        if (!codeElement) {
            console.warn('SearchHighlightingService: No code element found');
            return;
        }

        // Restore original text if it was stored
        if (codeElement.dataset.originalText) {
            codeElement.textContent = codeElement.dataset.originalText;
            delete codeElement.dataset.originalText;
        }

        console.log('SearchHighlightingService: Cleared search highlighting');
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
            console.warn('SearchHighlightingService: No matches found in container');
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

            console.log(`SearchHighlightingService: Scrolled to match ${matchIndex + 1}`);
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
}

