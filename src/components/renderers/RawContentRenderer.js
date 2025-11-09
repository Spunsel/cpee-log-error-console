/**
 * RawContentRenderer
 * Renders raw content (Mermaid, CPEE XML, user input) as plain text
 * Handles all raw content rendering, search functionality, and action bar management
 * 
 * Responsibilities:
 * - Render raw content into DOM elements
 * - Provide DOM structure for content display
 * - Handle search highlighting and navigation
 * - Manage action bars for raw content
 * - Handle content restoration and hiding
 */

import { ActionBar } from '../ui/ActionBar.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { configManager } from '../../config/ConfigManager.js';
import { MermaidParser } from '../../utils/content/MermaidParser.js';
import { RawUntouchedLogRender } from './RawUntouchedLogRender.js';
import { TraceDisplay } from '../ui/TraceDisplay.js';
import { CPEETraceCalculator } from '../../utils/trace/CPEETraceCalculator.js';
import { MermaidTraceCalculator } from '../../utils/trace/MermaidTraceCalculator.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class RawContentRenderer {
    constructor(domRegistry = null, eventBus = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        
        // Search service
        this.searchService = serviceFactory.get('SearchService');
        
        // Log renderer for untouched log view
        this.logRenderer = new RawUntouchedLogRender(domRegistry);
        
        // Action bars per section
        this.actionBars = new Map();
        
        // Store original content per section (for copy functionality)
        this.originalContent = new Map();
        
        // Trace displays per section
        this.traceDisplays = new Map();
        
        // Cache calculated traces per section (to avoid recalculation)
        this.traceCache = new Map();
    }

    /**
     * Render raw Mermaid content as plain text with preprocessing applied
     * The raw view should show the preprocessed content (same as what would be rendered visually)
     * @param {string} mermaidText - Raw Mermaid diagram text
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with rendered content
     */
    renderRawMermaid(mermaidText, _options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container mermaid-raw'
        });

        // Apply preprocessing to match what visual view shows
        let processedText = mermaidText || '';
        try {
            const cleanResult = MermaidParser.cleanAndValidate(processedText, true);
            processedText = cleanResult.code;
        } catch (error) {
            console.warn('Failed to preprocess raw Mermaid content, using original text:', error);
            // Fallback to original text if preprocessing fails
            processedText = mermaidText || '';
        }

        const codeElement = this.domRegistry.createElement('pre', {
            className: 'raw-code-block'
        });

        const codeContent = this.domRegistry.createElement('code', {
            className: 'language-mermaid',
            textContent: processedText
        });

        codeElement.appendChild(codeContent);
        container.appendChild(codeElement);

        return container;
    }

    /**
     * Render raw CPEE XML content as plain text
     * @param {string} xmlText - Raw CPEE XML text
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with rendered content
     */
    renderRawCPEETree(xmlText, _options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container cpee-raw'
        });

        const codeElement = this.domRegistry.createElement('pre', {
            className: 'raw-code-block'
        });

        const codeContent = this.domRegistry.createElement('code', {
            className: 'language-xml',
            textContent: xmlText
        });

        codeElement.appendChild(codeContent);
        container.appendChild(codeElement);

        return container;
    }

    /**
     * Render raw user input text
     * @param {string} userInputText - User input text
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with rendered content
     */
    renderRawUserInput(userInputText, _options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container user-input-raw'
        });

        const textElement = this.domRegistry.createElement('pre', {
            className: 'raw-text-block'
        });

        const textContent = this.domRegistry.createElement('code', {
            className: 'language-text',
            textContent: userInputText
        });

        textElement.appendChild(textContent);
        container.appendChild(textElement);

        return container;
    }

    /**
     * Render traces content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     * @returns {HTMLElement|null} Trace display container or null
     */
    renderTracesContent(sectionId, container, step) {
        console.log(`[RawContentRenderer] Rendering traces content for ${sectionId}`);
        
        if (!step || !container) {
            console.warn('[RawContentRenderer] Missing step or container for traces rendering');
            return null;
        }

        // Check cache first
        const cacheKey = `${sectionId}-${step.stepNumber || 'unknown'}`;
        if (this.traceCache.has(cacheKey)) {
            console.log(`[RawContentRenderer] Using cached traces for ${sectionId}`);
            const cachedTraces = this.traceCache.get(cacheKey);
            return this.renderCachedTraces(sectionId, container, cachedTraces);
        }

        // Extract raw content based on section type
        let rawContent = null;
        let contentString = null;
        let isCPEE = false;
        let isMermaid = false;

        try {
            switch (sectionId) {
                case 'input-cpee':
                case 'output-cpee':
                    rawContent = sectionId === 'input-cpee' 
                        ? step.getInputCpeeTreeRaw() 
                        : step.getOutputCpeeTreeRaw();
                    if (rawContent && rawContent.getContent) {
                        contentString = rawContent.getContent();
                        isCPEE = true;
                    }
                    break;
                case 'input-intermediate':
                case 'output-intermediate':
                    rawContent = sectionId === 'input-intermediate'
                        ? step.getInputMermaidRaw()
                        : step.getOutputMermaidRaw();
                    if (rawContent && rawContent.getContent) {
                        contentString = rawContent.getContent();
                        isMermaid = true;
                    }
                    break;
            }

            if (!contentString || (!isCPEE && !isMermaid)) {
                console.warn(`[RawContentRenderer] No valid content found for ${sectionId}`);
                return this.renderNoTracesMessage(container);
            }

            // Calculate traces using appropriate calculator
            let traces = [];
            const options = {
                maxLoopIterations: 1,
                maxPathLength: 50
            };

            if (isCPEE) {
                console.log(`[RawContentRenderer] Calculating CPEE traces for ${sectionId}`);
                traces = CPEETraceCalculator.calculateAllTraces(contentString, options);
            } else if (isMermaid) {
                console.log(`[RawContentRenderer] Calculating Mermaid traces for ${sectionId}`);
                traces = MermaidTraceCalculator.calculateAllTraces(contentString, options);
            }

            // Cache the results
            this.traceCache.set(cacheKey, traces);

            // Emit traces:calculated event (Phase 31.15)
            this.eventBus.emit('traces:calculated', {
                sectionId,
                stepNumber: step.stepNumber || 'unknown',
                traceCount: traces.length,
                traces
            });

            // Render traces
            return this.renderTraces(sectionId, container, traces);

        } catch (error) {
            console.error(`[RawContentRenderer] Error calculating traces for ${sectionId}:`, error);
            
            // Emit traces:error event (Phase 31.15)
            this.eventBus.emit('traces:error', {
                sectionId,
                stepNumber: step.stepNumber || 'unknown',
                error: error.message || 'Unknown error occurred',
                errorObject: error
            });
            
            return this.renderErrorMessage(container, error);
        }
    }

    /**
     * Render cached traces
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Array} traces - Cached traces
     * @returns {HTMLElement} Trace display container
     */
    renderCachedTraces(sectionId, container, traces) {
        // Emit traces:calculated event for cached traces (Phase 31.15)
        this.eventBus.emit('traces:calculated', {
            sectionId,
            traceCount: traces.length,
            traces,
            cached: true
        });
        
        return this.renderTraces(sectionId, container, traces);
    }

    /**
     * Render traces using TraceDisplay
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container (traces container)
     * @param {Array} traces - Traces to render
     * @returns {HTMLElement} Trace display container
     */
    renderTraces(sectionId, container, traces) {
        // Get or create trace display for this section
        let traceDisplay = this.traceDisplays.get(sectionId);
        if (!traceDisplay) {
            traceDisplay = new TraceDisplay(this.domRegistry);
            this.traceDisplays.set(sectionId, traceDisplay);
        }

        // Clear container first
        container.innerHTML = '';

        // Create trace display container
        if (!traceDisplay.getContainer()) {
            traceDisplay.createContainer();
        } else {
            // Reuse existing container but clear it
            const existingContainer = traceDisplay.getContainer();
            if (existingContainer.parentNode) {
                existingContainer.parentNode.removeChild(existingContainer);
            }
            traceDisplay.createContainer();
        }

        container.appendChild(traceDisplay.getContainer());

        // Render traces
        if (traces && traces.length > 0) {
            traceDisplay.renderTraces(traces, {
                showLabels: false, // Show alt_ids in preview
                expandable: true,
                highlightStartEnd: true
            });
        } else {
            traceDisplay.clear();
            this.renderNoTracesMessage(container);
        }

        return container;
    }

    /**
     * Render "No traces found" message
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement} Message container
     */
    renderNoTracesMessage(container) {
        const messageContainer = this.domRegistry.createElement('div', {
            className: 'trace-empty-message',
            textContent: 'No traces found'
        });
        container.innerHTML = '';
        container.appendChild(messageContainer);
        return container;
    }

    /**
     * Render error message
     * @param {HTMLElement} container - Container element
     * @param {Error} error - Error object
     * @returns {HTMLElement} Error message container
     */
    renderErrorMessage(container, error) {
        const errorContainer = this.domRegistry.createElement('div', {
            className: 'trace-error-message'
        });
        const errorTitle = this.domRegistry.createElement('div', {
            className: 'trace-error-title',
            textContent: 'Error calculating traces'
        });
        const errorText = this.domRegistry.createElement('div', {
            className: 'trace-error-text',
            textContent: error.message || 'Unknown error occurred'
        });
        errorContainer.appendChild(errorTitle);
        errorContainer.appendChild(errorText);
        container.innerHTML = '';
        container.appendChild(errorContainer);
        return container;
    }

    /**
     * Display raw content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     * @param {string} mode - View mode ('raw', 'log', or 'traces')
     */
    displayRawContent(sectionId, container, step, mode = 'raw') {
        if (!step || !container) {
            return;
        }

        // Handle traces mode
        if (mode === 'traces') {
            this.displayTracesContent(sectionId, container, step);
            return;
        }

        let rawContent = null;
        let renderer = null;
        
        // Determine current view mode (use passed mode, fallback to checking DOM)
        const sectionElement = document.getElementById(sectionId);
        const sectionViewMode = (mode !== undefined && mode !== null) ? mode : (sectionElement?.dataset?.viewMode || 'raw');

        // Get raw content based on section
        switch (sectionId) {
            case 'input-cpee':
                rawContent = step.getInputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    // CPEE sections: log mode behaves same as raw mode
                    renderer = () => this.renderRawCPEETree(rawContent.getContent());
                }
                break;
            case 'input-intermediate':
                rawContent = step.getInputMermaidRaw();
                if (rawContent) {
                    // Mermaid sections: use log renderer with rawExposition for log mode, raw renderer for raw mode
                    renderer = sectionViewMode === 'log' 
                        ? () => this.logRenderer.renderLogMermaid(rawContent.getRawExposition ? rawContent.getRawExposition() : rawContent.getContent(), { type: 'input' })
                        : () => this.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-intermediate':
                rawContent = step.getOutputMermaidRaw();
                if (rawContent) {
                    // Mermaid sections: use log renderer with rawExposition for log mode, raw renderer for raw mode
                    renderer = sectionViewMode === 'log'
                        ? () => this.logRenderer.renderLogMermaid(rawContent.getRawExposition ? rawContent.getRawExposition() : rawContent.getContent(), { type: 'output' })
                        : () => this.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-cpee':
                rawContent = step.getOutputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    // CPEE sections: log mode behaves same as raw mode
                    renderer = () => this.renderRawCPEETree(rawContent.getContent());
                }
                break;
        }

        if (!rawContent || !renderer) {
            container.innerHTML = '<pre><code class="no-content">No raw content available</code></pre>';
            return;
        }

        try {
            // Hide traces content when switching to raw/log
            const tracesElements = container.querySelectorAll('[data-content-type="traces"]');
            tracesElements.forEach(el => {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            });

            // Check if raw content container already exists
            let rawContainer = container.querySelector('[data-content-type="raw"]');
            if (!rawContainer) {
                rawContainer = document.createElement('div');
                rawContainer.setAttribute('data-content-type', 'raw');
                // CSS handles the positioning styles
                container.style.position = 'relative';
                container.appendChild(rawContainer);
            }

            // Hide the original visual content
            const visualElements = container.querySelectorAll('[data-content-type="visual"]');
            visualElements.forEach(el => {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            });

            // Hide parent container's scrollbar (raw container will handle scrolling)
            container.style.overflow = 'hidden';

            // Ensure raw container is visible and interactive
            rawContainer.style.display = 'block';
            rawContainer.style.visibility = 'visible';
            rawContainer.style.pointerEvents = 'auto';

            // ALWAYS add/ensure action bar exists BEFORE clearing content
            if (rawContent.getLength && rawContent.getLength() > 0) {
                if (!this.actionBars.has(sectionId)) {
                    // Create new action bar and attach to container
                    this.addActionBar(rawContainer, sectionId, rawContent);
                } else {
                    // Action bar instance exists - check if it's in the DOM
                    const actionBar = this.actionBars.get(sectionId);
                    const parentContainer = container.closest('.content-box') || container.parentElement;
                    const existingActionBarInDOM = parentContainer?.querySelector('.raw-content-actions-bar');
                    
                    if (actionBar && !existingActionBarInDOM) {
                        // Action bar instance exists but not in DOM - re-attach it
                        if (actionBar.element && actionBar.element.parentNode) {
                            actionBar.element.parentNode.removeChild(actionBar.element);
                        }
                        // Attach to parent container (non-scrolling) instead of raw container
                        if (parentContainer) {
                            parentContainer.appendChild(actionBar.element);
                        } else {
                            // Fallback to raw container
                            rawContainer.appendChild(actionBar.element);
                        }
                    }
                    
                    // Show the action bar
                    if (actionBar) {
                        actionBar.show();
                    }
                }
            }
            
            // Now clear ONLY the content area (preserve action bar)
            // Action bar is in parent container, so we can safely clear raw container
            rawContainer.innerHTML = '';
            
            // Render new content and add it
            const rawElement = renderer();
            rawContainer.appendChild(rawElement);
            
            // Trigger syntax highlighting using SyntaxHighlightingService
            // Exclude user input from syntax highlighting
            if (sectionId !== 'user-input') {
                try {
                    const syntaxService = serviceFactory.get('SyntaxHighlightingService');
                    syntaxService.highlightCodeBlocks(rawContainer);
                    // Mark preprocessing lines after syntax highlighting (for log mode only)
                    if (mode === 'log') {
                        // Wait for line numbers to be added, then mark preprocessing lines
                        // Use multiple attempts with delays to ensure line numbers are added
                        this.logRenderer.waitForLineNumbersAndMark(rawContainer, 0, 10);
                    }
                } catch (_) {
                    // Fallback to direct Prism highlighting if service not available
                    try {
                        const sh = configManager.get('syntaxHighlighting', { enabled: true, highlightOnRender: true });
                        if (sh.enabled && sh.highlightOnRender) {
                            const codeBlocks = rawContainer.querySelectorAll('pre code');
                            if (window.Prism && typeof window.Prism.highlightElement === 'function') {
                                codeBlocks.forEach(block => {
                                    window.Prism.highlightElement(block);
                                });
                            }
                        }
                        // Mark preprocessing lines after Prism highlighting (for log mode only)
                        if (mode === 'log') {
                            // Wait for line numbers to be added, then mark preprocessing lines
                            this.logRenderer.waitForLineNumbersAndMark(rawContainer, 0, 10);
                        }
                    } catch (__) {
                        // No-op if Prism/config not available
                    }
                }
            }
            
            // Update copy content based on currently displayed content
            // Extract text from the rendered DOM to ensure we copy exactly what's shown
            if (this.actionBars.has(sectionId)) {
                const actionBar = this.actionBars.get(sectionId);
                if (actionBar) {
                    // Extract the actual text content from the rendered code element
                    // This ensures we copy exactly what's displayed, including any processing
                    const codeElement = rawContainer.querySelector('pre code');
                    if (codeElement) {
                        // Get the text content (this will be the actual displayed text)
                        const displayedText = codeElement.textContent || codeElement.innerText || '';
                        if (displayedText) {
                            actionBar.setCopyContent(displayedText);
                        }
                    } else {
                        // Fallback: determine content to copy based on current mode
                        if (rawContent) {
                            let contentToCopy = null;
                            if (sectionViewMode === 'log' && rawContent.getRawExposition) {
                                // Log mode: use raw exposition for Mermaid sections
                                contentToCopy = rawContent.getRawExposition();
                            } else if (rawContent.getContent) {
                                // Raw mode or CPEE sections: use regular content
                                contentToCopy = rawContent.getContent();
                            } else if (rawContent.getText) {
                                // Fallback to getText
                                contentToCopy = rawContent.getText();
                            }
                            
                            // Update the copy button with the current content
                            if (contentToCopy) {
                                actionBar.setCopyContent(contentToCopy);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error rendering raw content for ${sectionId}:`, error);
            container.innerHTML = '<pre><code class="error">Error rendering raw content</code></pre>';
        }
    }

    /**
     * Display traces content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     */
    displayTracesContent(sectionId, container, step) {
        console.log(`[RawContentRenderer] Displaying traces content for ${sectionId}`);
        
        // Hide visual content
        const visualElements = container.querySelectorAll('[data-content-type="visual"]');
        visualElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        });

        // Hide raw/log content
        const rawElements = container.querySelectorAll('[data-content-type="raw"]');
        rawElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        });

        // Hide action bars
        const sectionIdForActionBar = sectionId;
        if (this.actionBars.has(sectionIdForActionBar)) {
            const actionBar = this.actionBars.get(sectionIdForActionBar);
            if (actionBar) {
                actionBar.hide();
            }
        }

        // Restore container overflow (traces container handles its own scrolling)
        container.style.overflow = 'visible';

        // Get or create traces container
        let tracesContainer = container.querySelector('[data-content-type="traces"]');
        if (!tracesContainer) {
            tracesContainer = this.domRegistry.createElement('div');
            tracesContainer.setAttribute('data-content-type', 'traces');
            container.style.position = 'relative';
            container.appendChild(tracesContainer);
        }

        // Ensure traces container is visible
        tracesContainer.style.display = 'block';
        tracesContainer.style.visibility = 'visible';
        tracesContainer.style.pointerEvents = 'auto';
        tracesContainer.style.position = 'absolute';
        tracesContainer.style.top = '0';
        tracesContainer.style.left = '0';
        tracesContainer.style.width = '100%';
        tracesContainer.style.height = '100%';
        tracesContainer.style.zIndex = '10';
        tracesContainer.style.background = 'var(--surface-color)';

        // Render traces content
        this.renderTracesContent(sectionId, tracesContainer, step);
    }

    /**
     * Hide raw content when switching to visual mode
     * @param {HTMLElement} container - Content container
     */
    hideRawContent(container) {
        if (!container) {
            return;
        }

        // Hide raw content elements
        const rawElements = container.querySelectorAll('[data-content-type="raw"]');
        rawElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        });

        // Hide traces content elements
        const tracesElements = container.querySelectorAll('[data-content-type="traces"]');
        tracesElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        });

        // Hide action bar for this section and clear search
        const sectionId = container.closest('[id]')?.id;
        if (sectionId && this.actionBars.has(sectionId)) {
            const actionBar = this.actionBars.get(sectionId);
            if (actionBar) {
                // Clear search before hiding
                actionBar.clearSearch();
                actionBar.hide();
            }
        }
    }

    /**
     * Add action bar (copy button + search bar) to raw content container
     * @param {HTMLElement} container - Container element (raw container)
     * @param {string} sectionId - Section identifier
     * @param {Object} rawContent - Raw content object
     */
    addActionBar(container, sectionId, rawContent) {
        // Get content to copy
        const contentToCopy = rawContent.getContent ? rawContent.getContent() : rawContent.getText();

        // Store original content for this section
        this.originalContent.set(sectionId, contentToCopy);
        
        // Initialize search state for this section using SearchService
        this.searchService.initializeSearchState(sectionId);

        // Create action bar with SearchService, always visible for raw/log sections
        const actionBar = new ActionBar(this.domRegistry, this.searchService, sectionId, {
            collapsedByDefault: false
        });
        
        // Store action bar for this section
        this.actionBars.set(sectionId, actionBar);
        
        // Set up copy functionality
        actionBar.setOnCopy((content) => {
            console.log(`✓ Copied ${sectionId}:`, content.substring(0, 50) + '...');
        });
        
        // Set up search functionality
        actionBar.setOnSearch((searchTerm) => {
            console.log(`Searching in ${sectionId} for:`, searchTerm);
            this.performSearch(sectionId, searchTerm, contentToCopy);
        });
        
        // Set up search clear
        actionBar.setOnClear(() => {
            console.log(`Cleared search in ${sectionId}`);
            this.clearSearch(sectionId);
        });
        
        // Set up search navigation (direction only - SearchService handles index)
        actionBar.setOnNavigate((direction) => {
            console.log(`Navigate ${direction} in ${sectionId}`);
            this.navigateToMatch(sectionId, direction);
        });

        // Attach to the parent content-box container (non-scrolling) instead of the scrollable raw container
        // This ensures the action bar stays fixed relative to the viewport
        const parentContainer = container.closest('.content-box') || container.parentElement;
        if (parentContainer) {
            actionBar.attachToContainer(parentContainer);
        } else {
            // Fallback to raw container if parent not found
            actionBar.attachToContainer(container);
        }
        
        // Set copy content after attaching
        actionBar.setCopyContent(contentToCopy);
        
        // Show the action bar
        actionBar.show();
    }

    /**
     * Get container element for a section
     * @param {string} sectionId - Section identifier
     * @returns {HTMLElement|null} Container element or null
     */
    getContainerForSection(sectionId) {
        return document.querySelector(`#${sectionId} .raw-content-container`);
    }

    /**
     * Perform search in raw content (delegates to SearchService combined workflow)
     * @param {string} sectionId - Section identifier
     * @param {string} searchTerm - Search term
     * @param {string} _content - Content to search in (unused, kept for compatibility)
     */
    performSearch(sectionId, searchTerm, _content) {
        if (!searchTerm) {
            return;
        }

        // Find the raw content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`RawContentRenderer: No raw content container found for ${sectionId}`);
            return;
        }

        // Get search options from state
        const searchState = this.searchService.getSearchState(sectionId);
        const options = {
            caseSensitive: searchState?.caseSensitive || false,
            wholeWord: searchState?.wholeWord || false
        };

        // Use SearchService's combined workflow
        const matches = this.searchService.performSearch(sectionId, container, searchTerm, options);
        
        // Update search UI after search completes
        this.updateSearchUI(sectionId);

        // Scroll to first match if any matches found
        if (matches.length > 0) {
            this.searchService.scrollToMatch(container, 0);
        }
    }

    /**
     * Clear search highlighting (delegates to SearchService combined workflow)
     * @param {string} sectionId - Section identifier
     */
    clearSearch(sectionId) {
        // Find the raw content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`RawContentRenderer: No raw content container found for ${sectionId}`);
            return;
        }

        // Use SearchService's combined workflow
        this.searchService.clearSearch(sectionId, container);

        // Update UI after clear
        this.updateSearchUI(sectionId);
    }

    /**
     * Navigate to specific match (delegates to SearchService combined workflow)
     * @param {string} sectionId - Section identifier
     * @param {string} direction - 'next' or 'prev'
     */
    navigateToMatch(sectionId, direction) {
        console.log(`RawContentRenderer: Navigating ${direction} in ${sectionId}`);
        
        // Find the raw content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`RawContentRenderer: No raw content container found for ${sectionId}`);
            return;
        }

        // Use SearchService's combined workflow methods
        const success = direction === 'next' 
            ? this.searchService.navigateToNextMatch(sectionId, container)
            : this.searchService.navigateToPreviousMatch(sectionId, container);
        
        if (success) {
            const searchState = this.searchService.getSearchState(sectionId);
            const currentIndex = searchState?.currentMatchIndex ?? -1;
            console.log(`RawContentRenderer: Successfully navigated to match ${currentIndex + 1}`);
        } else {
            console.warn(`RawContentRenderer: Failed to navigate ${direction}`);
        }

        // Update UI after navigation
        this.updateSearchUI(sectionId);
    }

    /**
     * Update search UI from SearchService state
     * @param {string} sectionId - Section identifier
     */
    updateSearchUI(sectionId) {
        const actionBar = this.actionBars.get(sectionId);
        if (actionBar && actionBar.searchBar) {
            actionBar.searchBar.updateUIFromService();
        }
    }

    /**
     * Check if we have original content stored for a section
     * @param {string} sectionId - Section identifier
     * @returns {boolean} True if original content exists
     */
    hasOriginalContent(sectionId) {
        return this.originalContent.has(sectionId);
    }

    /**
     * Restore original content when switching modes
     * @param {string} sectionId - Section identifier
     */
    restoreOriginalContent(sectionId) {
        const originalContent = this.originalContent.get(sectionId);
        if (!originalContent) {
            // No original content stored - this is normal when switching to a new step
            return;
        }

        // Find the raw content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`RawContentRenderer: No raw content container found for ${sectionId}`);
            return;
        }

        // Use SearchService's combined workflow to clear search
        this.searchService.clearSearch(sectionId, container);
    }

    /**
     * Clear all search states (called when navigating to a different step)
     */
    clearAllSearchStates() {
        // Clear all search states using SearchService
        this.searchService.clearAllSearchStates();
        
        // Clear highlighting from all containers using SearchService combined method
        const sectionIds = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        sectionIds.forEach(sectionId => {
            const container = this.getContainerForSection(sectionId);
            if (container) {
                // Use combined method - it will clear highlighting if state exists
                // But since we already cleared state, just clear highlighting directly
                this.searchService.clearSearchHighlighting(container);
            }
        });
    }

    /**
     * Clear trace cache (called when navigating to a different step)
     */
    clearTraceCache() {
        console.log('[RawContentRenderer] Clearing trace cache');
        this.traceCache.clear();
        
        // Clear trace displays
        this.traceDisplays.forEach(display => {
            if (display && typeof display.destroy === 'function') {
                display.destroy();
            }
        });
        this.traceDisplays.clear();
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.actionBars.clear();
        this.originalContent.clear();
        this.clearTraceCache();
    }
}
