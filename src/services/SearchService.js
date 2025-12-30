/**
 * Search Service
 * Unified search functionality combining state management and highlighting
 * 
 * Approach:
 * - Uses plain text search with proper regex escaping
 * - Wraps matches in spans using DOM manipulation (preserves syntax highlighting)
 * - Unwraps spans to clear highlighting
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

    /**
     * Escape special regex characters in a search term
     * @param {string} str - String to escape
     * @returns {string} Escaped string safe for use in RegExp
     */
    escapeRegex(str) {
        // Escape all special regex characters: \ ^ $ . * + ? ( ) [ ] { } |
        return str.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} HTML-escaped text
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
    }

    /**
     * Build regex from search term with proper escaping
     * @param {string} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {RegExp|null} Compiled regex or null if invalid
     */
    buildSearchRegex(searchTerm, options = {}) {
        if (!searchTerm) {
            return null;
        }
        
        const { caseSensitive = false, wholeWord = false } = options;
        const flags = caseSensitive ? 'g' : 'gi';
        
        // Escape all special regex characters
        let pattern = this.escapeRegex(searchTerm);
        
        if (wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        
        try {
            return new RegExp(pattern, flags);
        } catch (e) {
            console.warn('SearchService: Invalid regex pattern:', e);
            return null;
        }
    }

    /**
     * Apply search highlighting to a container while preserving syntax highlighting
     * Uses text node manipulation to wrap matches without destroying existing HTML structure
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

        // Clear any existing search highlights first
        this.clearSearchHighlighting(container);

        // Build regex for finding matches
        const regex = this.buildSearchRegex(searchTerm, options);
        if (!regex) {
            return [];
        }

        // Get plain text content for finding match positions
        const plainText = codeElement.textContent;
        
        // Find all match ranges in plain text
        const matchRanges = [];
        let match;
        while ((match = regex.exec(plainText)) !== null) {
            matchRanges.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0]
            });
        }

        if (matchRanges.length === 0) {
            return [];
        }

        // Build index of text nodes with their global positions
        const textNodes = [];
        let globalPos = 0;
        const walker = document.createTreeWalker(codeElement, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.length > 0) {
                textNodes.push({
                    node: node,
                    start: globalPos,
                    end: globalPos + node.nodeValue.length
                });
                globalPos += node.nodeValue.length;
            }
        }

        // Process matches from last to first to preserve positions
        for (let i = matchRanges.length - 1; i >= 0; i--) {
            const range = matchRanges[i];
            // Use i as the match index (matchRanges[0] is match 0, matchRanges[1] is match 1, etc.)
            this.highlightRange(textNodes, range.start, range.end, i);
            
            // Rebuild text node index after each modification
            textNodes.length = 0;
            globalPos = 0;
            const newWalker = document.createTreeWalker(codeElement, NodeFilter.SHOW_TEXT, null);
            while ((node = newWalker.nextNode())) {
                if (node.nodeValue && node.nodeValue.length > 0) {
                    textNodes.push({
                        node: node,
                        start: globalPos,
                        end: globalPos + node.nodeValue.length
                    });
                    globalPos += node.nodeValue.length;
                }
            }
        }

        return matchRanges.map((r, idx) => ({
            index: idx,
            start: r.start,
            end: r.end,
            text: r.text
        }));
    }

    /**
     * Find the DOM position (node + offset) for a global text position
     * @param {Array} textNodes - Array of text node info objects
     * @param {number} globalPos - Global position in plain text
     * @returns {Object|null} {node, offset} or null if not found
     */
    findDOMPosition(textNodes, globalPos) {
        for (const nodeInfo of textNodes) {
            if (globalPos >= nodeInfo.start && globalPos < nodeInfo.end) {
                return {
                    node: nodeInfo.node,
                    offset: globalPos - nodeInfo.start
                };
            }
        }
        // Handle position at the very end
        if (textNodes.length > 0) {
            const lastNode = textNodes[textNodes.length - 1];
            if (globalPos === lastNode.end) {
                return {
                    node: lastNode.node,
                    offset: lastNode.node.nodeValue.length
                };
            }
        }
        return null;
    }

    /**
     * Highlight a specific range in the text by wrapping it in a single span
     * Uses Range API to extract and wrap content, preserving syntax highlighting inside
     * @param {Array} textNodes - Array of text node info objects
     * @param {number} start - Start position in plain text
     * @param {number} end - End position in plain text
     * @param {number} matchIndex - Index of the logical match
     */
    highlightRange(textNodes, start, end, matchIndex) {
        const startPos = this.findDOMPosition(textNodes, start);
        const endPos = this.findDOMPosition(textNodes, end);
        
        if (!startPos || !endPos) {
            return;
        }

        try {
            // Create a range spanning the entire match
            const range = document.createRange();
            range.setStart(startPos.node, startPos.offset);
            range.setEnd(endPos.node, endPos.offset);
            
            // Extract all contents in the range (includes any nested syntax spans)
            const contents = range.extractContents();
            
            // Create a single wrapper span for the entire match
            const wrapper = document.createElement('span');
            wrapper.className = 'search-match';
            wrapper.dataset.matchIndex = matchIndex;
            wrapper.appendChild(contents);
            
            // Flatten to plain text for uniform styling (removes nested syntax spans)
            const plainText = wrapper.textContent;
            wrapper.textContent = plainText;
            
            // Insert the wrapper at the range position
            range.insertNode(wrapper);
        } catch (e) {
            // Fallback: if Range API fails, use the split approach
            console.warn('SearchService: Range extraction failed, using fallback:', e.message);
            this.highlightRangeFallback(textNodes, start, end, matchIndex);
        }
    }

    /**
     * Fallback method for highlighting when Range API fails
     * Wraps each text node portion separately (used when extractContents fails)
     * @param {Array} textNodes - Array of text node info objects
     * @param {number} start - Start position in plain text
     * @param {number} end - End position in plain text
     * @param {number} matchIndex - Index of the logical match
     */
    highlightRangeFallback(textNodes, start, end, matchIndex) {
        // Find which text nodes contain this range
        const affectedNodes = [];
        for (const nodeInfo of textNodes) {
            if (nodeInfo.end > start && nodeInfo.start < end) {
                affectedNodes.push(nodeInfo);
            }
        }

        if (affectedNodes.length === 0) {
            return;
        }

        // Process from last to first to preserve positions
        for (let i = affectedNodes.length - 1; i >= 0; i--) {
            const nodeInfo = affectedNodes[i];
            const node = nodeInfo.node;
            
            let localStart = 0;
            let localEnd = node.nodeValue.length;
            
            if (i === 0) {
                localStart = start - nodeInfo.start;
            }
            if (i === affectedNodes.length - 1) {
                localEnd = end - nodeInfo.start;
            }
            
            const beforeText = node.nodeValue.substring(0, localStart);
            const matchText = node.nodeValue.substring(localStart, localEnd);
            const afterText = node.nodeValue.substring(localEnd);
            
            if (!matchText) {
                continue;
            }
            
            const span = document.createElement('span');
            span.className = 'search-match';
            span.dataset.matchIndex = matchIndex;
            span.textContent = matchText;
            
            const parent = node.parentNode;
            if (afterText) {
                parent.insertBefore(document.createTextNode(afterText), node.nextSibling);
            }
            parent.insertBefore(span, node.nextSibling);
            if (beforeText) {
                node.nodeValue = beforeText;
            } else {
                parent.removeChild(node);
            }
        }
    }

    /**
     * Clear search highlighting from a container
     * Unwraps search-match spans while preserving syntax highlighting
     * @param {HTMLElement} container - Container with highlighted content
     */
    clearSearchHighlighting(container) {
        const codeElement = container.querySelector('code');
        if (!codeElement) {
            return;
        }

        // Find and unwrap all search-match spans
        const searchSpans = codeElement.querySelectorAll('span.search-match');
        searchSpans.forEach(span => {
            const parent = span.parentNode;
            // Replace the span with its text content
            const textNode = document.createTextNode(span.textContent);
            parent.replaceChild(textNode, span);
        });

        // Normalize the element to merge adjacent text nodes
        codeElement.normalize();
    }

    /**
     * Scroll to a specific match in the content
     * Uses data-match-index to handle matches that span multiple spans
     * @param {HTMLElement} container - Container with rendered content
     * @param {number} matchIndex - Index of logical match to scroll to
     * @returns {boolean} True if scrolled successfully
     */
    scrollToMatch(container, matchIndex) {
        if (!container || matchIndex < 0) {
            return false;
        }

        const allSpans = container.querySelectorAll('.search-match');
        if (!allSpans || allSpans.length === 0) {
            return false;
        }

        // Find the first span with the target match index
        const targetSpan = container.querySelector(`.search-match[data-match-index="${matchIndex}"]`);
        if (targetSpan) {
            // Find the scrollable raw container (parent with [data-content-type="raw"])
            const rawContainer = container.closest('[data-content-type="raw"]');
            if (rawContainer) {
                // Calculate position to scroll to within the raw container
                const containerRect = rawContainer.getBoundingClientRect();
                const matchRect = targetSpan.getBoundingClientRect();
                
                // Calculate the scroll position needed to center the match
                const scrollTop = rawContainer.scrollTop + (matchRect.top - containerRect.top) - (containerRect.height / 2) + (matchRect.height / 2);
                
                // Smooth scroll within the raw container
                rawContainer.scrollTo({
                    top: scrollTop,
                    behavior: 'smooth'
                });
            } else {
                // Fallback to scrollIntoView if raw container not found
                targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // Add active class to all spans of the current match, remove from others
            allSpans.forEach(span => {
                const spanMatchIndex = parseInt(span.dataset.matchIndex, 10);
                span.classList.toggle('search-match-active', spanMatchIndex === matchIndex);
            });
            return true;
        }

        return false;
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
     * Clear stored original text for a section (no-op, kept for API compatibility)
     * @param {string} _sectionId - Section identifier (unused)
     */
    clearOriginalText(_sectionId) {
        // No-op: DOM-based highlighting doesn't need stored original text
    }

    /**
     * Clear all stored original text (no-op, kept for API compatibility)
     */
    clearAllOriginalText() {
        // No-op: DOM-based highlighting doesn't need stored original text
    }

    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getStats() {
        return {
            searchStatesCount: this.searchStates.size,
            totalSections: this.searchStates.size
        };
    }

    /**
     * Destroy the service
     */
    destroy() {
        this.searchStates.clear();
    }
}

