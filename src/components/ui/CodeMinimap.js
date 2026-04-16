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
        this._onMinimapScroll = this._onMinimapScroll.bind(this);
        this._onMinimapClick = this._onMinimapClick.bind(this);
        this._onViewportDragStart = this._onViewportDragStart.bind(this);
        this._onViewportDrag = this._onViewportDrag.bind(this);
        this._onViewportDragEnd = this._onViewportDragEnd.bind(this);
        
        // Flag to prevent scroll loops
        this._isScrollingFromMinimap = false;
        this._isScrollingFromCode = false;

        // Cached layout metrics — invalidated by updateContent() and attach()
        // Avoids getBoundingClientRect / getComputedStyle on every scroll event
        this._cachedMetrics = null;
        this._lastContentHTML = null;
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

        // Invalidate cached metrics — offset may change in a new parent
        this._cachedMetrics = null;

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
        
        // Add scroll listener to minimap content for bidirectional sync
        this.minimapContent.addEventListener('scroll', this._onMinimapScroll);
        
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
        
        // Apply stored visibility preference (default: visible).
        // Pass instant=true so the minimap appears synchronously with the content
        // when switching views, with no CSS fade-in lag.
        if (this.isVisible) {
            this.show(false, true);
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
        
        if (this.minimapContent) {
            this.minimapContent.removeEventListener('scroll', this._onMinimapScroll);
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Remove global event listeners
        document.removeEventListener('mousemove', this._onViewportDrag);
        document.removeEventListener('mouseup', this._onViewportDragEnd);
    }

    /**
     * Show the minimap.
     * @param {boolean} savePreference - Whether to save this preference (default: false)
     * @param {boolean} instant - Skip the CSS fade-in transition (default: false).
     *   Pass true when showing as a side-effect of a view switch so the minimap
     *   appears at the same time as the content, with no visible lag.
     */
    show(savePreference = false, instant = false) {
        if (this.element) {
            if (instant) {
                // Suppress the opacity/visibility transition for this one paint,
                // then re-enable it so manual toggle still fades smoothly.
                this.element.classList.add('no-transition');
                this.element.classList.add('visible');
                // One rAF is enough for the browser to paint the visible state
                // before re-enabling transitions; the class removal is invisible.
                requestAnimationFrame(() => {
                    if (this.element) this.element.classList.remove('no-transition');
                });
            } else {
                this.element.classList.add('visible');
            }
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
     * Update minimap content from code container.
     * Skips the expensive innerHTML clone when the source hasn't changed.
     */
    updateContent() {
        if (!this.codeContainer || !this.codeElement) {
            return;
        }

        const sourceCode = this.codeContainer.querySelector('code');
        if (!sourceCode) {
            return;
        }

        const newHTML = sourceCode.innerHTML;

        // Skip full re-render when content is identical
        if (newHTML === this._lastContentHTML) {
            return;
        }
        this._lastContentHTML = newHTML;

        // Clone the highlighted HTML content
        this.codeElement.innerHTML = newHTML;
        this.codeElement.className = sourceCode.className + ' minimap-code-content';

        // Count lines
        const text = sourceCode.textContent || '';
        const lines = text.split('\n');
        this.totalLines = lines.length;
        if (this.totalLines > 0 && lines[this.totalLines - 1] === '') {
            this.totalLines--;
        }

        // Invalidate cached layout metrics — content height / offsets may have changed
        this._cachedMetrics = null;

        this._updatePreprocessingMarkers();
        this._updateSearchMarkers();
    }

    /**
     * Return cached layout metrics, computing them on first call after invalidation.
     *
     * Separates stable values (lineHeight, paddingTop, marginTop, codeBaseOffset)
     * from the scroll-dependent part. codeBaseOffset is the offset of the code
     * element from the top of the minimap container *before* any scroll, i.e.:
     *   minimapContent.offsetTop + minimapCode.offsetTop
     *
     * At call sites, the actual visual codeOffsetTop is:
     *   metrics.codeBaseOffset - this.minimapContent.scrollTop
     *
     * This avoids getBoundingClientRect() (which forces a full layout reflow)
     * during every scroll event while still being accurate.
     *
     * @returns {{ lineHeight: number, paddingTop: number, marginTop: number, codeBaseOffset: number }|null}
     * @private
     */
    _getMetrics() {
        if (this._cachedMetrics) {
            return this._cachedMetrics;
        }

        const minimapCodeElement = this.codeElement;
        if (!minimapCodeElement || !this.element || !this.minimapContent || !this.minimapCode) {
            return null;
        }

        const codeStyle = window.getComputedStyle(minimapCodeElement);
        const rawLineHeight = parseFloat(codeStyle.lineHeight);
        const lineHeight = !isNaN(rawLineHeight) ? rawLineHeight : 3.5;

        const preStyle = window.getComputedStyle(this.minimapCode);
        const paddingTop = parseFloat(preStyle.paddingTop) || 0;
        const marginTop  = parseFloat(preStyle.marginTop)  || 0;

        // Stable part of the code-element offset (does not change with scroll)
        const codeBaseOffset = this.minimapContent.offsetTop + this.minimapCode.offsetTop;

        this._cachedMetrics = { lineHeight, paddingTop, marginTop, codeBaseOffset };
        return this._cachedMetrics;
    }

    /**
     * Update preprocessing line markers using cached metrics.
     * @private
     */
    _updatePreprocessingMarkers() {
        if (!this.showPreprocessing || !this.markersContainer || !this.codeContainer) {
            return;
        }

        this.markersContainer.querySelectorAll('.minimap-marker-preprocessing').forEach(m => m.remove());

        const preprocessingLineElements = this.codeContainer.querySelectorAll('.preprocessing-line-number');
        if (preprocessingLineElements.length === 0) {
            return;
        }

        const lines = [];
        preprocessingLineElements.forEach(el => {
            const n = parseInt(el.getAttribute('data-line'), 10);
            if (!isNaN(n) && n >= 1) lines.push(n);
        });
        if (lines.length === 0) return;

        const m = this._getMetrics();
        if (!m) return;

        const frag = document.createDocumentFragment();
        lines.forEach(lineNum => {
            const markerTop = m.paddingTop + (lineNum - 1) * m.lineHeight + m.marginTop;
            const marker = document.createElement('div');
            marker.className = 'minimap-marker minimap-marker-preprocessing';
            marker.style.top = `${markerTop}px`;
            marker.style.height = `${Math.max(m.lineHeight, 2)}px`;
            frag.appendChild(marker);
        });
        this.markersContainer.appendChild(frag);
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
     * Update search markers using a single TreeWalker pass for all matches.
     * Replaces the previous O(n·m) approach (one walker per match) with O(n+m).
     * @private
     */
    _updateSearchMarkers() {
        if (!this.markersContainer || !this.codeContainer) {
            return;
        }

        this.markersContainer.querySelectorAll('.minimap-marker-search').forEach(m => m.remove());

        const searchMatches = this.codeContainer.querySelectorAll('.search-match');
        if (searchMatches.length === 0) return;

        const sourceCodeElement = this.codeContainer.querySelector('code');
        if (!sourceCodeElement) return;

        const m = this._getMetrics();
        if (!m) return;

        // Single TreeWalker pass: accumulate line numbers for all match elements at once
        const matchSet = new Set(searchMatches);
        const lineNumbers = new Map(); // element → line number
        let lineNum = 1;

        const walker = document.createTreeWalker(
            sourceCodeElement,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            null
        );

        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (matchSet.has(node)) {
                    lineNumbers.set(node, lineNum);
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const nl = (node.textContent.match(/\n/g) || []).length;
                lineNum += nl;
            }
        }

        const markedLines = new Set();
        const frag = document.createDocumentFragment();

        searchMatches.forEach(matchEl => {
            const ln = lineNumbers.get(matchEl);
            if (!ln || markedLines.has(ln)) return;
            markedLines.add(ln);

            const markerTop = m.paddingTop + (ln - 1) * m.lineHeight + m.marginTop;
            const marker = document.createElement('div');
            marker.className = 'minimap-marker minimap-marker-search';
            marker.style.top = `${markerTop}px`;
            marker.style.height = `${Math.max(m.lineHeight, 2)}px`;
            frag.appendChild(marker);
        });

        this.markersContainer.appendChild(frag);
    }

    /**
     * Update viewport indicator position and size.
     * Uses cached codeBaseOffset (stable) minus live minimapContent.scrollTop to avoid
     * getBoundingClientRect on every scroll event while keeping the indicator accurate.
     */
    updateViewport() {
        if (!this.codeContainer || !this.viewportIndicator || !this.element || !this.minimapCode) {
            return;
        }

        const containerHeight = this.codeContainer.clientHeight;
        const scrollHeight    = this.codeContainer.scrollHeight;
        const scrollTop       = this.codeContainer.scrollTop;

        if (scrollHeight <= containerHeight) {
            this.viewportIndicator.style.display = 'none';
            return;
        }

        this.viewportIndicator.style.display = 'block';

        const minimapCodeElement = this.codeElement || this.minimapCode.querySelector('code');
        if (!minimapCodeElement) return;

        const codeContentHeight = minimapCodeElement.offsetHeight;
        if (codeContentHeight <= 0) return;

        // codeBaseOffset is the stable (non-scroll-dependent) distance from the
        // top of the minimap container to the top of the code element.
        // We subtract minimapContent.scrollTop to get the current *visual* offset,
        // because the viewport indicator is positioned relative to the outer container.
        const metrics = this._getMetrics();
        const codeBaseOffset = metrics ? metrics.codeBaseOffset : 0;
        const minimapScrollTop = this.minimapContent ? this.minimapContent.scrollTop : 0;
        const codeOffsetTop = codeBaseOffset - minimapScrollTop;

        const visibleRatio   = containerHeight / scrollHeight;
        const viewportHeight = Math.max(codeContentHeight * visibleRatio, 20);
        const maxScrollTop   = scrollHeight - containerHeight;
        const scrollProgress = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
        const maxViewportTop = codeContentHeight - viewportHeight;
        const viewportTop    = codeOffsetTop + (scrollProgress * Math.max(maxViewportTop, 0));

        this.viewportIndicator.style.height    = `${viewportHeight}px`;
        // translateY instead of `top` keeps the move on the compositor thread
        // (no layout reflow) and pairs with will-change: transform in the CSS.
        this.viewportIndicator.style.transform = `translateY(${viewportTop}px)`;
    }

    /**
     * Handle code container scroll
     * @private
     */
    _onCodeScroll() {
        // Skip if this scroll was triggered by minimap scroll (prevent loops)
        if (this._isScrollingFromMinimap) {
            return;
        }

        if (!this.isDragging) {
            // Sync the minimap content scroll FIRST so that minimapContent.scrollTop
            // is already up-to-date when updateViewport() reads it to compute codeOffsetTop.
            // Both calls are cheap (no getBoundingClientRect), so no RAF batching needed —
            // doing it synchronously eliminates the one-frame visual lag.
            this._syncMinimapScroll();
            this.updateViewport();
        }
    }

    /**
     * Handle minimap scroll (user scrolling the minimap)
     * Syncs main code scroll position with minimap
     * @private
     */
    _onMinimapScroll() {
        // Skip if this scroll was triggered by code scroll (prevent loops)
        if (this._isScrollingFromCode) {
            return;
        }
        
        if (!this.codeContainer || !this.minimapContent) {
            return;
        }
        
        // Use requestAnimationFrame for smoother updates
        if (this._minimapScrollRAF) {
            cancelAnimationFrame(this._minimapScrollRAF);
        }
        
        this._minimapScrollRAF = requestAnimationFrame(() => {
            this._syncCodeScroll();
            this.updateViewport();
        });
    }

    /**
     * Sync main code scroll position with minimap scroll
     * When minimap scrolls, main code should follow
     * @private
     */
    _syncCodeScroll() {
        if (!this.codeContainer || !this.minimapContent) {
            return;
        }
        
        const minimapScrollTop = this.minimapContent.scrollTop;
        const minimapScrollHeight = this.minimapContent.scrollHeight;
        const minimapClientHeight = this.minimapContent.clientHeight;
        const minimapMaxScroll = minimapScrollHeight - minimapClientHeight;
        
        const codeScrollHeight = this.codeContainer.scrollHeight;
        const codeClientHeight = this.codeContainer.clientHeight;
        const codeMaxScroll = codeScrollHeight - codeClientHeight;
        
        // Calculate scroll progress (0 to 1)
        const scrollProgress = minimapMaxScroll > 0 ? minimapScrollTop / minimapMaxScroll : 0;
        
        // Set flag to prevent scroll loops
        this._isScrollingFromMinimap = true;
        
        // Apply same progress to code container
        this.codeContainer.scrollTop = scrollProgress * codeMaxScroll;
        
        // Clear flag after a short delay
        requestAnimationFrame(() => {
            this._isScrollingFromMinimap = false;
        });
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
        
        // Set flag to prevent scroll loops
        this._isScrollingFromCode = true;
        
        // Apply same progress to minimap
        this.minimapContent.scrollTop = scrollProgress * minimapMaxScroll;
        
        // Clear flag after a short delay
        requestAnimationFrame(() => {
            this._isScrollingFromCode = false;
        });
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

