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
                wholeWord: false,
                spans: [],              // Stored span refs — avoids querySelectorAll on clear/scroll
                activeSpan: null,       // Currently active span — avoids iterating all spans on navigate
                cachedTextContent: null,// Cached codeElement.textContent — avoids re-serialising the DOM
                codeElement: null       // Cached code element reference
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

        state.currentMatchIndex = direction === 'next'
            ? (state.currentMatchIndex + 1) % state.matches.length
            : (state.currentMatchIndex <= 0 ? state.matches.length - 1 : state.currentMatchIndex - 1);

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
            state.spans = [];
            state.activeSpan = null;
            state.cachedTextContent = null;
            // codeElement is intentionally kept — the DOM reference stays valid
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
            state.spans = [];
            state.activeSpan = null;
            state.cachedTextContent = null;
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
        let pattern = this.escapeRegex(searchTerm);
        if (wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }

        try {
            return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
        } catch (e) {
            console.warn('SearchService: Invalid regex pattern:', e);
            return null;
        }
    }

    /**
     * Apply search highlighting to a container while preserving syntax highlighting
     * Uses text node manipulation to wrap matches without destroying existing HTML structure
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container with rendered content
     * @param {string} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Array} Array of match objects
     */
    applySearchHighlighting(sectionId, container, searchTerm, options = {}) {
        const state = this.searchStates.get(sectionId);

        // Cache codeElement on first use
        if (state && !state.codeElement) {
            state.codeElement = container.querySelector('code');
        }
        const codeElement = state?.codeElement || container.querySelector('code');

        if (!codeElement) {
            console.warn('SearchService: No code element found');
            return [];
        }

        this.clearSearchHighlighting(container, sectionId);

        const regex = this.buildSearchRegex(searchTerm, options);
        if (!regex) {
            return [];
        }

        // Use cached textContent — avoids re-serialising the DOM on every keystroke
        if (state && !state.cachedTextContent) {
            state.cachedTextContent = codeElement.textContent;
        }
        const plainText = state?.cachedTextContent || codeElement.textContent;

        // Collect match ranges
        const matchRanges = [];
        let match;
        while ((match = regex.exec(plainText)) !== null) {
            matchRanges.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
            // Guard against zero-length matches causing an infinite loop
            if (match[0].length === 0) {
                regex.lastIndex++;
            }
        }

        if (matchRanges.length === 0) {
            return [];
        }

        // FIX: Collect text nodes ONCE. Processing right-to-left means positions
        // to the left of the current match are never modified, so the array
        // never needs to be rebuilt — even stale `end` values beyond each
        // processed match are never queried again.
        const textNodes = this._collectTextNodes(codeElement);

        // Store span refs by match index for O(1) lookup during clear/scroll
        const spans = [];
        for (let i = matchRanges.length - 1; i >= 0; i--) {
            const { start, end } = matchRanges[i];
            spans[i] = this.highlightRange(textNodes, start, end, i);
        }
        if (state) {
            state.spans = spans;
        }

        return matchRanges.map((r, idx) => ({ index: idx, ...r }));
    }

    /**
     * Collect all non-empty text nodes with their global positions.
     * Extracted as a helper for clarity and to make the single-pass explicit.
     */
    _collectTextNodes(root) {
        const nodes = [];
        let pos = 0;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue.length > 0) {
                nodes.push({ node, start: pos, end: pos + node.nodeValue.length });
                pos += node.nodeValue.length;
            }
        }
        return nodes;
    }

    /**
     * Find the DOM position (node + offset) for a global text position
     * @param {Array} textNodes - Array of text node info objects
     * @param {number} globalPos - Global position in plain text
     * @returns {Object|null} {node, offset} or null if not found
     */
    findDOMPosition(textNodes, globalPos) {
        let lo = 0, hi = textNodes.length - 1;

        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            const info = textNodes[mid];
        
            if (globalPos < info.start) {
                hi = mid - 1;
            } else if (globalPos >= info.end) {
                lo = mid + 1;
            } else {
                return {
                    node: info.node,
                    offset: globalPos - info.start
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
     * @returns {HTMLElement|null} The created wrapper span, or null if fallback was used
     */
    highlightRange(textNodes, start, end, matchIndex) {
        const startPos = this.findDOMPosition(textNodes, start);
        const endPos = this.findDOMPosition(textNodes, end);
        
        if (!startPos || !endPos) {
            return null;
        }

        try {
            const range = document.createRange();
            range.setStart(startPos.node, startPos.offset);
            range.setEnd(endPos.node, endPos.offset);

            const contents = range.extractContents();
            const wrapper  = document.createElement('span');
            wrapper.className        = 'search-match';
            wrapper.dataset.matchIndex = matchIndex;
            // Flatten to plain text for uniform styling
            wrapper.textContent = contents.textContent;
            range.insertNode(wrapper);
            return wrapper; // Return ref for span storage
        } catch (e) {
            console.warn('SearchService: Range extraction failed, using fallback:', e.message);
            this.highlightRangeFallback(textNodes, start, end, matchIndex);
            return null; // Fallback creates multiple spans; no single ref available
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
        const affected = textNodes.filter(n => n.end > start && n.start < end);
        if (affected.length === 0) {
            return;
        }

        for (let i = affected.length - 1; i >= 0; i--) {
            const nodeInfo = affected[i];
            const node = nodeInfo.node;
            const localStart = i === 0 ? start - nodeInfo.start : 0;
            const localEnd   = i === affected.length - 1 ? end - nodeInfo.start : node.nodeValue.length;
            const matchText  = node.nodeValue.substring(localStart, localEnd);
            if (!matchText) {
                continue;
            }

            const span = document.createElement('span');
            span.className         = 'search-match';
            span.dataset.matchIndex = matchIndex;
            span.textContent = matchText;

            const parent    = node.parentNode;
            const afterText = node.nodeValue.substring(localEnd);
            if (afterText) {
                parent.insertBefore(document.createTextNode(afterText), node.nextSibling);
            }
            parent.insertBefore(span, node.nextSibling);

            const beforeText = node.nodeValue.substring(0, localStart);
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
     * @param {string} [sectionId] - Section identifier (enables stored-span fast path)
     */
    clearSearchHighlighting(container, sectionId) {
        const state = sectionId ? this.searchStates.get(sectionId) : null;

        // Fast path: use stored span refs if all matches used the primary path (no fallback spans)
        if (state?.spans?.length && state.spans.every(s => s !== null)) {
            state.spans.forEach(span => span.replaceWith(new Text(span.textContent)));
            state.spans = [];
            state.activeSpan = null;
            state.codeElement?.normalize();
            return;
        }

        // Fallback: query the DOM (used on first clear or when fallback spans are present)
        const codeElement = state?.codeElement || container.querySelector('code');
        if (!codeElement) {
            return;
        }

        codeElement.querySelectorAll('span.search-match').forEach(span => {
            span.replaceWith(new Text(span.textContent));
        });
        codeElement.normalize();
    }

    /**
     * Scroll to a specific match in the content
     * Uses data-match-index to handle matches that span multiple spans
     * @param {HTMLElement} container - Container with rendered content
     * @param {number} matchIndex - Index of logical match to scroll to
     * @param {string} [sectionId] - Section identifier (enables stored-span fast path)
     * @returns {boolean} True if scrolled successfully
     */
    scrollToMatch(container, matchIndex, sectionId) {
        if (!container || matchIndex < 0) {
            return false;
        }

        const state = sectionId ? this.searchStates.get(sectionId) : null;

        // Use stored span ref — avoids a DOM query on every navigation keystroke
        const targetSpan = state?.spans?.[matchIndex]
            || container.querySelector(`.search-match[data-match-index="${matchIndex}"]`);
        if (!targetSpan) { 
            return false;
        }

        const rawContainer = container.closest('[data-content-type="raw"]');
        if (rawContainer) {
            const containerRect = rawContainer.getBoundingClientRect();
            const matchRect     = targetSpan.getBoundingClientRect();
            rawContainer.scrollTo({
                top: rawContainer.scrollTop + (matchRect.top - containerRect.top)
                     - containerRect.height / 2 + matchRect.height / 2,
                behavior: 'smooth'
            });
        } else {
            targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Update only the previously active and newly active span — O(1) instead of O(n)
        if (state) {
            state.activeSpan?.classList.remove('search-match-active');
            targetSpan.classList.add('search-match-active');
            state.activeSpan = targetSpan;
        } else {
            container.querySelectorAll('.search-match').forEach(span => {
                span.classList.toggle('search-match-active',
                    parseInt(span.dataset.matchIndex, 10) === matchIndex);
            });
        }
        return true;
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

        // Don't search until at least 2 characters are entered
        if (searchTerm.length < 2) {
            this.clearSearch(sectionId, container);
            return [];
        }
        
        // Apply highlighting and get matches
        const matches = this.applySearchHighlighting(sectionId, container, searchTerm, options);
        
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
        this.clearSearchHighlighting(container, sectionId);
        
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
        const idx = this.navigateToMatch(sectionId, 'next');
        return idx >= 0 ? this.scrollToMatch(container, idx, sectionId) : false;
    }

    /**
     * Combined workflow: Navigate to previous match
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container element
     * @returns {boolean} True if navigation was successful
     */
    navigateToPreviousMatch(sectionId, container) {
        const idx = this.navigateToMatch(sectionId, 'prev');
        return idx >= 0 ? this.scrollToMatch(container, idx, sectionId) : false;
    }

    /**
     * Invalidate cached text content for a section
     * Call this whenever the code content is re-rendered
     * @param {string} sectionId - Section identifier
     */
    clearCachedText(sectionId) {
        const state = this.searchStates.get(sectionId);
        if (state) {   
            state.cachedTextContent = null;
        }
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