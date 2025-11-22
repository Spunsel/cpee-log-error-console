/**
 * LogContentRenderer
 * Renders log/untouched content for CPEE and Mermaid
 * Handles log view rendering, search functionality, and action bar management
 * 
 * Responsibilities:
 * - Render log content into DOM elements
 * - Provide DOM structure for log content display
 * - Handle search highlighting and navigation
 * - Manage action bars for log content
 * - Handle content restoration and hiding
 * - Mark preprocessing lines for Mermaid content
 */

import { ActionBar } from '../ui/ActionBar.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { configManager } from '../../config/ConfigManager.js';

export class LogContentRenderer {
    constructor(domRegistry = null, _eventBus = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.contentProcessingService = contentProcessingService || serviceFactory.get('ContentProcessingService');
        
        // Search service
        this.searchService = serviceFactory.get('SearchService');
        
        // Action bars per section
        this.actionBars = new Map();
        
        // Store original content per section (for copy functionality)
        this.originalContent = new Map();
    }

    /**
     * Display log content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     * @param {Object} options - Rendering options
     */
    display(sectionId, container, step, _options = {}) {
        if (!step || !container) {
            return;
        }

        let rawContent = null;
        let renderer = null;

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
                    // Mermaid sections: use log renderer with rawExposition
                    renderer = () => this.renderLogMermaid(
                        rawContent.getRawExposition ? rawContent.getRawExposition() : rawContent.getContent(),
                        { type: 'input' }
                    );
                }
                break;
            case 'output-intermediate':
                rawContent = step.getOutputMermaidRaw();
                if (rawContent) {
                    // Mermaid sections: use log renderer with rawExposition
                    renderer = () => this.renderLogMermaid(
                        rawContent.getRawExposition ? rawContent.getRawExposition() : rawContent.getContent(),
                        { type: 'output' }
                    );
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
            container.innerHTML = '<pre><code class="no-content">No log content available</code></pre>';
            return;
        }

        try {
            // Hide traces content when switching to log
            const tracesElements = container.querySelectorAll('[data-content-type="traces"]');
            tracesElements.forEach(el => {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            });

            // Check if log content container already exists
            let logContainer = container.querySelector('[data-content-type="raw"]');
            if (!logContainer) {
                logContainer = document.createElement('div');
                logContainer.setAttribute('data-content-type', 'raw');
                container.style.position = 'relative';
                container.appendChild(logContainer);
            }

            // Hide the original visual content
            const visualElements = container.querySelectorAll('[data-content-type="visual"]');
            visualElements.forEach(el => {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            });

            // Hide parent container's scrollbar (log container will handle scrolling)
            container.style.overflow = 'hidden';

            // Ensure log container is visible and interactive
            logContainer.style.display = 'block';
            logContainer.style.visibility = 'visible';
            logContainer.style.pointerEvents = 'auto';

            // ALWAYS add/ensure action bar exists BEFORE clearing content
            if (rawContent.getLength && rawContent.getLength() > 0) {
                if (!this.actionBars.has(sectionId)) {
                    // Create new action bar and attach to container
                    this.addActionBar(logContainer, sectionId, rawContent);
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
                        // Attach to parent container (non-scrolling) instead of log container
                        if (parentContainer) {
                            parentContainer.appendChild(actionBar.element);
                        } else {
                            // Fallback to log container
                            logContainer.appendChild(actionBar.element);
                        }
                    }
                    
                    // Show the action bar
                    if (actionBar) {
                        actionBar.show();
                    }
                }
            }
            
            // Now clear ONLY the content area (preserve action bar)
            logContainer.innerHTML = '';
            
            // Render new content and add it
            const logElement = renderer();
            logContainer.appendChild(logElement);
            
            // Trigger syntax highlighting using SyntaxHighlightingService
            // Exclude user input from syntax highlighting
            if (sectionId !== 'user-input') {
                try {
                    const syntaxService = serviceFactory.get('SyntaxHighlightingService');
                    syntaxService.highlightCodeBlocks(logContainer);
                    // Mark preprocessing lines after syntax highlighting (for log mode)
                    this.waitForLineNumbersAndMark(logContainer, 0, 10);
                } catch (_) {
                    // Fallback to direct Prism highlighting if service not available
                    try {
                        const sh = configManager.get('syntaxHighlighting', { enabled: true, highlightOnRender: true });
                        if (sh.enabled && sh.highlightOnRender) {
                            const codeBlocks = logContainer.querySelectorAll('pre code');
                            if (window.Prism && typeof window.Prism.highlightElement === 'function') {
                                codeBlocks.forEach(block => {
                                    window.Prism.highlightElement(block);
                                });
                            }
                        }
                        // Mark preprocessing lines after Prism highlighting (for log mode)
                        this.waitForLineNumbersAndMark(logContainer, 0, 10);
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
                    const codeElement = logContainer.querySelector('pre code');
                    if (codeElement) {
                        // Get the text content (this will be the actual displayed text)
                        const displayedText = codeElement.textContent || codeElement.innerText || '';
                        if (displayedText) {
                            actionBar.setCopyContent(displayedText);
                        }
                    } else {
                        // Fallback: determine content to copy based on content type
                        if (rawContent) {
                            let contentToCopy = null;
                            if (rawContent.getRawExposition) {
                                // Log mode: use raw exposition for Mermaid sections
                                contentToCopy = rawContent.getRawExposition();
                            } else if (rawContent.getContent) {
                                // CPEE sections: use regular content
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
            console.error(`Error rendering log content for ${sectionId}:`, error);
            container.innerHTML = '<pre><code class="error">Error rendering log content</code></pre>';
        }
    }

    /**
     * Render log Mermaid content with minimal processing
     * Only removes: %% Input/Output Intermediate comment, ```mermaid markers, and fixes indentation
     * Uses ContentProcessingService.processMermaidForLogView() for minimal cleaning
     * @param {string} mermaidText - Raw Mermaid diagram text from logs (rawExposition)
     * @param {Object} options - Rendering options (can include 'type' for input/output)
     * @returns {HTMLElement} Container with rendered content
     */
    renderLogMermaid(mermaidText, options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container mermaid-log'
        });

        // Apply minimal cleaning: remove comments, markdown markers, and fix indentation
        const type = options.type || 'output'; // Default to output, can be set to 'input'
        let processedText = mermaidText || '';
        
        try {
            processedText = this.contentProcessingService.processMermaidForLogView(processedText, type);
        } catch (error) {
            console.warn('Failed to clean log Mermaid content, using raw text:', error);
            // Fallback to raw text if cleaning fails
            processedText = mermaidText || '';
        }

        // Detect which lines would have preprocessing fixes applied
        // Parse with preprocessing to get appliedSteps, but don't use the processed code
        let affectedLineNumbers = [];
        try {
            const cleanResult = this.contentProcessingService.processAndValidateMermaid(processedText, true);
            if (cleanResult.appliedSteps && cleanResult.appliedSteps.length > 0) {
                // Collect all line numbers from all applied steps
                cleanResult.appliedSteps.forEach(step => {
                    if (step.lineNumbers && Array.isArray(step.lineNumbers)) {
                        affectedLineNumbers.push(...step.lineNumbers);
                    }
                });
                // Remove duplicates and sort
                affectedLineNumbers = Array.from(new Set(affectedLineNumbers)).sort((a, b) => a - b);
            }
        } catch (error) {
            // If parsing fails, just continue without marking lines
            console.warn('Failed to detect preprocessing steps for log view:', error);
        }

        // Store affected line numbers in data attribute for later marking
        if (affectedLineNumbers.length > 0) {
            container.setAttribute('data-preprocessing-lines', affectedLineNumbers.join(','));
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
     * Wait for line numbers to be added, then mark preprocessing lines (log mode only)
     * @param {HTMLElement} container - Container with rendered content
     * @param {number} attempt - Current attempt number
     * @param {number} maxAttempts - Maximum number of attempts
     */
    waitForLineNumbersAndMark(container, attempt = 0, maxAttempts = 10) {
        if (!container || attempt >= maxAttempts) {
            return;
        }

        // Check if line numbers have been added
        const logContainer = container.querySelector('.mermaid-log') || container;
        const lineNumberElements = logContainer.querySelectorAll('.raw-code-line-number');
        
        if (lineNumberElements.length > 0) {
            // Line numbers are present, mark preprocessing lines
            this.markPreprocessingLines(container);
        } else {
            // Line numbers not yet added, retry after a short delay
            setTimeout(() => {
                this.waitForLineNumbersAndMark(container, attempt + 1, maxAttempts);
            }, 50); // 50ms delay between attempts
        }
    }

    /**
     * Mark line numbers with background highlight for lines that have preprocessing fixes applied (log mode only)
     * @param {HTMLElement} container - Container with rendered content
     */
    markPreprocessingLines(container) {
        if (!container) {
            return;
        }

        // Find the mermaid-log container (might be nested)
        const logContainer = container.querySelector('.mermaid-log') || container;
        const preprocessingLinesAttr = logContainer.getAttribute('data-preprocessing-lines');
        
        if (!preprocessingLinesAttr) {
            return; // No preprocessing lines to mark
        }

        // Parse line numbers from data attribute
        const affectedLineNumbers = preprocessingLinesAttr.split(',').map(num => parseInt(num, 10)).filter(num => !isNaN(num) && num > 0);
        
        if (affectedLineNumbers.length === 0) {
            return; // No valid line numbers
        }

        // Find all line number elements
        const lineNumberElements = logContainer.querySelectorAll('.raw-code-line-number');
        
        // Mark each affected line number with background highlight
        lineNumberElements.forEach(lineNumberEl => {
            const lineNumber = parseInt(lineNumberEl.getAttribute('data-line'), 10);
            if (!isNaN(lineNumber) && affectedLineNumbers.includes(lineNumber)) {
                lineNumberEl.classList.add('preprocessing-line-number');
            }
        });
    }

    /**
     * Render raw CPEE XML content as plain text (used for CPEE sections in log mode)
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
     * Hide log content when switching to visual mode
     * @param {HTMLElement} container - Content container
     */
    hideLogContent(container) {
        if (!container) {
            return;
        }

        // Hide log content elements
        const logElements = container.querySelectorAll('[data-content-type="raw"]');
        logElements.forEach(el => {
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
     * Add action bar (copy button + search bar) to log content container
     * @param {HTMLElement} container - Container element (log container)
     * @param {string} sectionId - Section identifier
     * @param {Object} rawContent - Raw content object
     */
    addActionBar(container, sectionId, rawContent) {
        // Get content to copy (use rawExposition for Mermaid, regular content for CPEE)
        let contentToCopy = null;
        if (rawContent.getRawExposition) {
            // Mermaid sections: use raw exposition for log mode
            contentToCopy = rawContent.getRawExposition();
        } else if (rawContent.getContent) {
            // CPEE sections: use regular content
            contentToCopy = rawContent.getContent();
        } else if (rawContent.getText) {
            contentToCopy = rawContent.getText();
        }

        // Store original content for this section
        if (contentToCopy) {
            this.originalContent.set(sectionId, contentToCopy);
        }
        
        // Initialize search state for this section using SearchService
        this.searchService.initializeSearchState(sectionId);

        // Create action bar with SearchService, always visible for log sections
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

        // Attach to the parent content-box container (non-scrolling) instead of the scrollable log container
        const parentContainer = container.closest('.content-box') || container.parentElement;
        if (parentContainer) {
            actionBar.attachToContainer(parentContainer);
        } else {
            // Fallback to log container if parent not found
            actionBar.attachToContainer(container);
        }
        
        // Set copy content after attaching
        if (contentToCopy) {
            actionBar.setCopyContent(contentToCopy);
        }
        
        // Show the action bar
        actionBar.show();
    }

    /**
     * Get container element for a section
     * @param {string} sectionId - Section identifier
     * @returns {HTMLElement|null} Container element or null
     */
    getContainerForSection(sectionId) {
        // Try to get section element via DOMRegistry first
        const sectionElement = this.domRegistry 
            ? (this.domRegistry.getElementSafe(sectionId) || document.getElementById(sectionId))
            : document.getElementById(sectionId);
        
        if (sectionElement) {
            return sectionElement.querySelector('.raw-content-container');
        }
        
        // Fallback to querySelector
        return document.querySelector(`#${sectionId} .raw-content-container`);
    }

    /**
     * Perform search in log content (delegates to SearchService combined workflow)
     * @param {string} sectionId - Section identifier
     * @param {string} searchTerm - Search term
     * @param {string} _content - Content to search in (unused, kept for compatibility)
     */
    performSearch(sectionId, searchTerm, _content) {
        if (!searchTerm) {
            return;
        }

        // Find the log content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`LogContentRenderer: No log content container found for ${sectionId}`);
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
        // Find the log content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`LogContentRenderer: No log content container found for ${sectionId}`);
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
        console.log(`LogContentRenderer: Navigating ${direction} in ${sectionId}`);
        
        // Find the log content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`LogContentRenderer: No log content container found for ${sectionId}`);
            return;
        }

        // Use SearchService's combined workflow methods
        const success = direction === 'next' 
            ? this.searchService.navigateToNextMatch(sectionId, container)
            : this.searchService.navigateToPreviousMatch(sectionId, container);
        
        if (success) {
            const searchState = this.searchService.getSearchState(sectionId);
            const currentIndex = searchState?.currentMatchIndex ?? -1;
            console.log(`LogContentRenderer: Successfully navigated to match ${currentIndex + 1}`);
        } else {
            console.warn(`LogContentRenderer: Failed to navigate ${direction}`);
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

        // Find the log content container for this section
        const container = this.getContainerForSection(sectionId);
        if (!container) {
            console.warn(`LogContentRenderer: No log content container found for ${sectionId}`);
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
                this.searchService.clearSearchHighlighting(container);
            }
        });
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.actionBars.clear();
        this.originalContent.clear();
    }
}

