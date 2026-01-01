/**
 * CodeMinimap Component
 * VS Code-style minimap for code views showing:
 * - Miniaturized syntax-highlighted code
 * - Viewport position indicator (blue box)
 * - Preprocessing line markers (Raw View only)
 * - Search match markers (green)
 * 
 * Features:
 * - Click to scroll to position
 * - Drag viewport to scroll
 * - Fixed position overlay on code view
 * - Syntax highlighting preserved
 */

import { ICONS } from '../../assets/icons.js';

// Storage key for minimap visibility preferences
const MINIMAP_STORAGE_KEY = 'cpee-minimap-visibility';

export class CodeMinimap {
    /**
     * Create a new CodeMinimap instance
     * @param {Object} options - Configuration options
     * @param {string} options.sectionId - Section identifier
     * @param {string} options.contentType - 'cpee' or 'mermaid' (affects width)
     * @param {boolean} options.showPreprocessing - Whether to show preprocessing markers
     */
    constructor(options = {}) {
        this.sectionId = options.sectionId || '';
        this.contentType = options.contentType || 'mermaid';
        this.showPreprocessing = options.showPreprocessing !== false;
        
        // DOM elements
        this.element = null;
        this.minimapCode = null;
        this.viewportIndicator = null;
        this.markersContainer = null;
        
        // State - default to visible unless user has explicitly hidden this section
        this.isVisible = this._getStoredVisibility();
        this.codeContainer = null;
        this.isDragging = false;
        this.totalLines = 0;
        this.preprocessingLines = [];
        this.searchMatches = [];
        
        // Bound methods for event listeners
        this._onCodeScroll = this._onCodeScroll.bind(this);
        this._onMinimapClick = this._onMinimapClick.bind(this);
        this._onViewportDragStart = this._onViewportDragStart.bind(this);
        this._onViewportDrag = this._onViewportDrag.bind(this);
        this._onViewportDragEnd = this._onViewportDragEnd.bind(this);
    }

    /**
     * Get stored visibility preference for this section
     * @returns {boolean} True if minimap should be visible (default: true)
     * @private
     */
    _getStoredVisibility() {
        try {
            const stored = localStorage.getItem(MINIMAP_STORAGE_KEY);
            if (stored) {
                const prefs = JSON.parse(stored);
                // If section has a stored preference, use it; otherwise default to true
                if (this.sectionId && Object.prototype.hasOwnProperty.call(prefs, this.sectionId)) {
                    return prefs[this.sectionId];
                }
            }
        } catch (e) {
            console.warn('CodeMinimap: Could not read stored visibility', e);
        }
        // Default: visible
        return true;
    }

    /**
     * Store visibility preference for this section
     * @param {boolean} visible - Whether minimap should be visible
     * @private
     */
    _storeVisibility(visible) {
        if (!this.sectionId) {
            return;
        }
        
        try {
            let prefs = {};
            const stored = localStorage.getItem(MINIMAP_STORAGE_KEY);
            if (stored) {
                prefs = JSON.parse(stored);
            }
            prefs[this.sectionId] = visible;
            localStorage.setItem(MINIMAP_STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.warn('CodeMinimap: Could not store visibility', e);
        }
    }

    /**
     * Create the minimap DOM element
     * @returns {HTMLElement} The minimap container element
     */
    createElement() {
        // Main container
        this.element = document.createElement('div');
        this.element.className = `code-minimap code-minimap-${this.contentType}`;
        this.element.setAttribute('data-section-id', this.sectionId);
        
        // Minimap code container (scrollable content)
        this.minimapContent = document.createElement('div');
        this.minimapContent.className = 'minimap-content';
        
        // Pre element for code
        this.minimapCode = document.createElement('pre');
        this.minimapCode.className = 'minimap-code';
        
        // Code element (will be populated later)
        this.codeElement = document.createElement('code');
        this.codeElement.className = 'minimap-code-content';
        this.minimapCode.appendChild(this.codeElement);
        
        // Markers container (for preprocessing and search markers) - inside content so it scrolls
        this.markersContainer = document.createElement('div');
        this.markersContainer.className = 'minimap-markers';
        
        this.minimapContent.appendChild(this.minimapCode);
        this.minimapContent.appendChild(this.markersContainer);
        
        // Viewport indicator (blue box showing visible area) - outside content, stays fixed
        this.viewportIndicator = document.createElement('div');
        this.viewportIndicator.className = 'minimap-viewport';
        
        // Assemble
        this.element.appendChild(this.minimapContent);
        this.element.appendChild(this.viewportIndicator);
        
        // Add event listeners
        this.element.addEventListener('click', this._onMinimapClick);
        this.viewportIndicator.addEventListener('mousedown', this._onViewportDragStart);
        
        return this.element;
    }

    /**
     * Create toggle button for action bar
     * @returns {HTMLElement} Toggle button element
     */
    createToggleButton() {
        const button = document.createElement('button');
        button.className = 'minimap-toggle-btn';
        button.setAttribute('aria-label', 'Toggle minimap');
        button.setAttribute('title', 'Toggle minimap');
        button.innerHTML = ICONS.MINIMAP;
        
        // Set initial active state based on stored visibility preference
        if (this.isVisible) {
            button.classList.add('active');
        }
        
        button.addEventListener('click', () => {
            this.toggle();
        });
        
        this.toggleButton = button;
        return button;
    }

    /**
     * Attach minimap to a code container
     * @param {HTMLElement} codeContainer - The scrollable code container ([data-content-type="raw"])
     * @param {HTMLElement} parentContainer - The parent container to append minimap to
     */
    attach(codeContainer, parentContainer) {
        if (!codeContainer || !parentContainer) {
            console.warn('CodeMinimap: Cannot attach - missing container');
            return;
        }
        
        this.codeContainer = codeContainer;
        
        // Create element if not exists
        if (!this.element) {
            this.createElement();
        }
        
        // Remove any existing minimaps from this parent container (from other views)
        const existingMinimaps = parentContainer.querySelectorAll('.code-minimap');
        existingMinimaps.forEach(minimap => {
            if (minimap !== this.element) {
                minimap.remove();
            }
        });
        
        // Remove from previous parent if any
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Append to parent container
        parentContainer.appendChild(this.element);
        
        // Add scroll listener to code container
        codeContainer.addEventListener('scroll', this._onCodeScroll);
        
        // Initial update
        this.updateContent();
        this.updateViewport();
        this._syncMinimapScroll();
        
        // Re-read stored visibility (in case it changed from another view's minimap)
        const storedVisibility = this._getStoredVisibility();
        this.isVisible = storedVisibility;
        
        // Update toggle button state to match stored visibility
        if (this.toggleButton) {
            if (storedVisibility) {
                this.toggleButton.classList.add('active');
            } else {
                this.toggleButton.classList.remove('active');
            }
        }
        
        // Apply stored visibility preference (default: visible)
        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
    }

    /**
     * Detach minimap from container
     */
    detach() {
        if (this.codeContainer) {
            this.codeContainer.removeEventListener('scroll', this._onCodeScroll);
            this.codeContainer = null;
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Remove global event listeners
        document.removeEventListener('mousemove', this._onViewportDrag);
        document.removeEventListener('mouseup', this._onViewportDragEnd);
    }

    /**
     * Show the minimap
     * @param {boolean} savePreference - Whether to save this preference (default: false)
     */
    show(savePreference = false) {
        if (this.element) {
            this.element.classList.add('visible');
            this.isVisible = true;
            this.updateViewport();
        }
        if (this.toggleButton) {
            this.toggleButton.classList.add('active');
        }
        if (savePreference) {
            this._storeVisibility(true);
        }
    }

    /**
     * Hide the minimap
     * @param {boolean} savePreference - Whether to save this preference (default: false)
     */
    hide(savePreference = false) {
        this.isVisible = false;
        if (this.element) {
            this.element.classList.remove('visible');
        }
        if (this.toggleButton) {
            this.toggleButton.classList.remove('active');
        }
        if (savePreference) {
            this._storeVisibility(false);
        }
    }

    /**
     * Toggle minimap visibility (saves preference)
     */
    toggle() {
        if (this.isVisible) {
            this.hide(true); // Save preference when user toggles
        } else {
            this.show(true); // Save preference when user toggles
        }
    }

    /**
     * Update minimap content from code container
     */
    updateContent() {
        if (!this.codeContainer || !this.codeElement) {
            return;
        }
        
        // Find the code element in the container
        const sourceCode = this.codeContainer.querySelector('code');
        if (!sourceCode) {
            return;
        }
        
        // Clone the highlighted HTML content
        this.codeElement.innerHTML = sourceCode.innerHTML;
        this.codeElement.className = sourceCode.className + ' minimap-code-content';
        
        // Count lines
        const text = sourceCode.textContent || '';
        const lines = text.split('\n');
        this.totalLines = lines.length;
        if (this.totalLines > 0 && lines[this.totalLines - 1] === '') {
            this.totalLines--;
        }
        
        // Get preprocessing lines from data attribute
        this._updatePreprocessingMarkers();
        
        // Update search markers
        this._updateSearchMarkers();
    }

    /**
     * Update preprocessing line markers
     * Uses the minimap's own line height to position markers directly
     * @private
     */
    _updatePreprocessingMarkers() {
        if (!this.showPreprocessing || !this.markersContainer || !this.codeContainer) {
            return;
        }
        
        // Clear existing preprocessing markers
        const existingMarkers = this.markersContainer.querySelectorAll('.minimap-marker-preprocessing');
        existingMarkers.forEach(m => m.remove());
        
        // Get preprocessing line numbers from source code
        const preprocessingLineElements = this.codeContainer.querySelectorAll('.preprocessing-line-number');
        if (preprocessingLineElements.length === 0) {
            return;
        }
        
        // Collect all preprocessing line numbers
        const preprocessingLines = [];
        preprocessingLineElements.forEach(el => {
            const lineNum = parseInt(el.getAttribute('data-line'), 10);
            if (!isNaN(lineNum) && lineNum >= 1) {
                preprocessingLines.push(lineNum);
            }
        });
        
        if (preprocessingLines.length === 0) {
            return;
        }
        
        // Get the minimap code element
        const minimapCodeElement = this.codeElement;
        if (!minimapCodeElement) {
            return;
        }
        
        // Get the minimap's computed line height directly from CSS
        const computedStyle = window.getComputedStyle(minimapCodeElement);
        const minimapLineHeight = parseFloat(computedStyle.lineHeight);
        
        // Fallback if line-height is not a number (e.g., "normal")
        const lineHeight = !isNaN(minimapLineHeight) ? minimapLineHeight : 3.5;
        
        // Get padding from minimap-code (parent pre element)
        const minimapCodePadding = this.minimapCode ? 
            parseFloat(window.getComputedStyle(this.minimapCode).paddingTop) || 0 : 4;
        
        // Create markers at the minimap's line positions
        preprocessingLines.forEach(lineNum => {
            // Calculate position in minimap: padding + (lineNumber - 1) * lineHeight + offset
            const markerTop = minimapCodePadding + (lineNum - 1) * lineHeight + 7;
            
            const marker = document.createElement('div');
            marker.className = 'minimap-marker minimap-marker-preprocessing';
            marker.style.top = `${markerTop}px`;
            marker.style.height = `${Math.max(lineHeight, 2)}px`;
            this.markersContainer.appendChild(marker);
        });
    }

    /**
     * Update search match markers
     * @param {Array} matches - Array of match objects with lineNumber property
     */
    updateSearchMarkers(matches = []) {
        this.searchMatches = matches;
        this._updateSearchMarkers();
    }

    /**
     * Update search markers in minimap
     * Gets line numbers from search matches and positions markers accordingly
     * @private
     */
    _updateSearchMarkers() {
        if (!this.markersContainer || !this.codeContainer) {
            return;
        }
        
        // Clear existing search markers
        const existingMarkers = this.markersContainer.querySelectorAll('.minimap-marker-search');
        existingMarkers.forEach(m => m.remove());
        
        // Find search match elements in the code container (class is .search-match)
        const searchMatches = this.codeContainer.querySelectorAll('.search-match');
        if (searchMatches.length === 0) {
            return;
        }
        
        // Get the source code element
        const sourceCodeElement = this.codeContainer.querySelector('code');
        if (!sourceCodeElement) {
            return;
        }
        
        // Get the minimap code element
        const minimapCodeElement = this.codeElement;
        if (!minimapCodeElement) {
            return;
        }
        
        // Get the minimap's computed line height directly from CSS
        const computedStyle = window.getComputedStyle(minimapCodeElement);
        const minimapLineHeight = parseFloat(computedStyle.lineHeight);
        const lineHeight = !isNaN(minimapLineHeight) ? minimapLineHeight : 3.5;
        
        // Get padding from minimap-code (parent pre element)
        const minimapCodePadding = this.minimapCode ? 
            parseFloat(window.getComputedStyle(this.minimapCode).paddingTop) || 0 : 4;
        
        // Track unique lines to avoid duplicate markers
        const markedLines = new Set();
        
        // For each search match, count newlines before it to get line number
        searchMatches.forEach(matchElement => {
            // Get line number by counting newlines in text before this element
            const lineNum = this._getLineNumberByCountingNewlines(sourceCodeElement, matchElement);
            
            if (lineNum < 1) {
                return;
            }
            
            // Skip if we already marked this line
            if (markedLines.has(lineNum)) {
                return;
            }
            markedLines.add(lineNum);
            
            // Calculate position in minimap using minimap's line height + offset
            const markerTop = minimapCodePadding + (lineNum - 1) * lineHeight + 7;
            
            const marker = document.createElement('div');
            marker.className = 'minimap-marker minimap-marker-search';
            marker.style.top = `${markerTop}px`;
            marker.style.height = `${Math.max(lineHeight, 2)}px`;
            this.markersContainer.appendChild(marker);
        });
    }
    
    /**
     * Get the line number for an element by counting newlines in text before it
     * @param {HTMLElement} codeElement - The code container
     * @param {HTMLElement} targetElement - The element to find
     * @returns {number} Line number (1-indexed) or 0 if error
     * @private
     */
    _getLineNumberByCountingNewlines(codeElement, targetElement) {
        try {
            // Get all text before this element by walking text nodes
            let textBefore = '';
            
            const walker = document.createTreeWalker(
                codeElement,
                NodeFilter.SHOW_TEXT,
                null
            );
            
            let textNode;
            while ((textNode = walker.nextNode())) {
                // Check if target element comes after this text node
                const position = textNode.compareDocumentPosition(targetElement);
                
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                    // Text node is before target - include its content
                    textBefore += textNode.textContent;
                } else {
                    // We've reached or passed the target
                    break;
                }
            }
            
            // Count newlines to get line number (1-indexed)
            const newlineCount = (textBefore.match(/\n/g) || []).length;
            return newlineCount + 1;
        } catch (e) {
            console.warn('CodeMinimap: Error counting newlines', e);
            return 0;
        }
    }

    /**
     * Create line markers in the minimap
     * @param {Array<number>} lineNumbers - Array of line numbers to mark
     * @param {string} type - Marker type ('preprocessing' or 'search')
     * @private
     */
    _createLineMarkers(lineNumbers, type) {
        if (!this.markersContainer || !this.totalLines || lineNumbers.length === 0) {
            return;
        }
        
        // Get the code element to calculate positions relative to actual code content
        const minimapCodeElement = this.codeElement || this.minimapCode?.querySelector('code');
        if (!minimapCodeElement) {
            return;
        }
        
        // Get the offset from the top of the minimap to where the code content starts
        const minimapRect = this.element.getBoundingClientRect();
        const codeRect = minimapCodeElement.getBoundingClientRect();
        const codeOffsetTop = codeRect.top - minimapRect.top;
        const codeContentHeight = minimapCodeElement.offsetHeight;
        
        // Calculate line height based on actual code content height
        const lineHeight = codeContentHeight / Math.max(this.totalLines, 1);
        
        lineNumbers.forEach(lineNum => {
            const marker = document.createElement('div');
            marker.className = `minimap-marker minimap-marker-${type}`;
            // Position relative to where the code content actually starts
            marker.style.top = `${codeOffsetTop + (lineNum - 1) * lineHeight}px`;
            marker.style.height = `${Math.max(lineHeight, 2)}px`;
            this.markersContainer.appendChild(marker);
        });
    }

    /**
     * Update viewport indicator position and size
     */
    updateViewport() {
        if (!this.codeContainer || !this.viewportIndicator || !this.element || !this.minimapCode) {
            return;
        }
        
        const containerHeight = this.codeContainer.clientHeight;
        const scrollHeight = this.codeContainer.scrollHeight;
        const scrollTop = this.codeContainer.scrollTop;
        
        if (scrollHeight <= containerHeight) {
            // Content fits, hide viewport indicator
            this.viewportIndicator.style.display = 'none';
            return;
        }
        
        this.viewportIndicator.style.display = 'block';
        
        // Get the code element and its actual position relative to the minimap container
        const minimapCodeElement = this.codeElement || this.minimapCode.querySelector('code');
        if (!minimapCodeElement) {
            return;
        }
        
        // Get the actual rendered height of the code content
        const codeContentHeight = minimapCodeElement.offsetHeight;
        
        // Get the offset from the top of the minimap container to where the code content starts
        const minimapRect = this.element.getBoundingClientRect();
        const codeRect = minimapCodeElement.getBoundingClientRect();
        const codeOffsetTop = codeRect.top - minimapRect.top;
        
        // If code content is too small, skip
        if (codeContentHeight <= 0) {
            return;
        }
        
        // Calculate the ratio of visible content to total content
        const visibleRatio = containerHeight / scrollHeight;
        
        // Viewport height proportional to visible content, but constrained to code height
        const viewportHeight = Math.max(codeContentHeight * visibleRatio, 20); // Minimum 20px
        
        // Calculate scroll progress (0 = top, 1 = bottom)
        const maxScrollTop = scrollHeight - containerHeight;
        const scrollProgress = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
        
        // Calculate viewport position within the code content bounds
        const maxViewportTop = codeContentHeight - viewportHeight;
        const viewportTop = codeOffsetTop + (scrollProgress * Math.max(maxViewportTop, 0));
        
        this.viewportIndicator.style.height = `${viewportHeight}px`;
        this.viewportIndicator.style.top = `${viewportTop}px`;
    }

    /**
     * Handle code container scroll
     * @private
     */
    _onCodeScroll() {
        if (!this.isDragging) {
            // Use requestAnimationFrame for smoother updates
            if (this._scrollRAF) {
                cancelAnimationFrame(this._scrollRAF);
            }
            this._scrollRAF = requestAnimationFrame(() => {
                this.updateViewport();
                this._syncMinimapScroll();
            });
        }
    }

    /**
     * Sync minimap scroll position with main code scroll
     * When main code reaches bottom, minimap should also reach bottom
     * @private
     */
    _syncMinimapScroll() {
        if (!this.codeContainer || !this.minimapContent) {
            return;
        }
        
        const codeScrollTop = this.codeContainer.scrollTop;
        const codeScrollHeight = this.codeContainer.scrollHeight;
        const codeClientHeight = this.codeContainer.clientHeight;
        const codeMaxScroll = codeScrollHeight - codeClientHeight;
        
        const minimapScrollHeight = this.minimapContent.scrollHeight;
        const minimapClientHeight = this.minimapContent.clientHeight;
        const minimapMaxScroll = minimapScrollHeight - minimapClientHeight;
        
        // Calculate scroll progress (0 to 1)
        const scrollProgress = codeMaxScroll > 0 ? codeScrollTop / codeMaxScroll : 0;
        
        // Apply same progress to minimap
        this.minimapContent.scrollTop = scrollProgress * minimapMaxScroll;
    }

    /**
     * Handle click on minimap to scroll
     * @param {MouseEvent} event
     * @private
     */
    _onMinimapClick(event) {
        if (!this.codeContainer || !this.element || !this.minimapCode) {
            return;
        }
        
        // Don't scroll if clicking on viewport indicator
        if (event.target === this.viewportIndicator || event.target.closest('.minimap-viewport')) {
            return;
        }
        
        const scrollHeight = this.codeContainer.scrollHeight;
        const containerHeight = this.codeContainer.clientHeight;
        
        // Get the code element and its bounds
        const minimapCodeElement = this.codeElement || this.minimapCode.querySelector('code');
        if (!minimapCodeElement) {
            return;
        }
        
        const codeRect = minimapCodeElement.getBoundingClientRect();
        const codeContentHeight = minimapCodeElement.offsetHeight;
        
        if (codeContentHeight <= 0) {
            return;
        }
        
        // Calculate click position relative to the code content (not the container)
        const clickY = event.clientY - codeRect.top;
        
        // Calculate target scroll position based on click position within code bounds
        const progress = Math.max(0, Math.min(1, clickY / codeContentHeight));
        const maxScroll = scrollHeight - containerHeight;
        const targetScroll = progress * maxScroll;
        
        // Smooth scroll to position
        this.codeContainer.scrollTo({
            top: Math.max(0, Math.min(targetScroll, maxScroll)),
            behavior: 'smooth'
        });
    }

    /**
     * Handle viewport drag start
     * @param {MouseEvent} event
     * @private
     */
    _onViewportDragStart(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.isDragging = true;
        this.dragStartY = event.clientY;
        this.dragStartScrollTop = this.codeContainer?.scrollTop || 0;
        
        this.viewportIndicator.classList.add('dragging');
        
        document.addEventListener('mousemove', this._onViewportDrag);
        document.addEventListener('mouseup', this._onViewportDragEnd);
    }

    /**
     * Handle viewport drag
     * @param {MouseEvent} event
     * @private
     */
    _onViewportDrag(event) {
        if (!this.isDragging || !this.codeContainer || !this.element || !this.minimapCode) {
            return;
        }
        
        const deltaY = event.clientY - this.dragStartY;
        const scrollHeight = this.codeContainer.scrollHeight;
        const containerHeight = this.codeContainer.clientHeight;
        const maxScroll = scrollHeight - containerHeight;
        
        // Get the code element height
        const minimapCodeElement = this.codeElement || this.minimapCode.querySelector('code');
        if (!minimapCodeElement) {
            return;
        }
        
        const codeContentHeight = minimapCodeElement.offsetHeight;
        
        if (codeContentHeight <= 0) {
            return;
        }
        
        // Calculate the viewport height ratio
        const viewportRatio = containerHeight / scrollHeight;
        const viewportHeight = Math.max(codeContentHeight * viewportRatio, 20);
        const maxViewportTravel = codeContentHeight - viewportHeight;
        
        // Convert minimap delta to scroll delta proportionally
        const scrollDelta = maxViewportTravel > 0 ? (deltaY / maxViewportTravel) * maxScroll : 0;
        const newScrollTop = this.dragStartScrollTop + scrollDelta;
        
        this.codeContainer.scrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));
        this.updateViewport();
    }

    /**
     * Handle viewport drag end
     * @param {MouseEvent} _event
     * @private
     */
    _onViewportDragEnd(_event) {
        this.isDragging = false;
        this.viewportIndicator.classList.remove('dragging');
        
        document.removeEventListener('mousemove', this._onViewportDrag);
        document.removeEventListener('mouseup', this._onViewportDragEnd);
    }

    /**
     * Get line height from code element
     * @param {HTMLElement} codeElement
     * @returns {number} Line height in pixels
     * @private
     */
    _getLineHeight(codeElement) {
        const style = window.getComputedStyle(codeElement);
        const lineHeight = parseFloat(style.lineHeight);
        if (!isNaN(lineHeight)) {
            return lineHeight;
        }
        // Fallback: estimate from font size
        const fontSize = parseFloat(style.fontSize);
        return fontSize * 1.5;
    }

    /**
     * Refresh minimap (call after content changes)
     */
    refresh() {
        this.updateContent();
        this.updateViewport();
    }

    /**
     * Destroy the minimap and clean up
     */
    destroy() {
        this.detach();
        
        if (this.element) {
            this.element.removeEventListener('click', this._onMinimapClick);
            this.element = null;
        }
        
        if (this.toggleButton) {
            this.toggleButton = null;
        }
        
        this.minimapCode = null;
        this.codeElement = null;
        this.viewportIndicator = null;
        this.markersContainer = null;
    }
}

