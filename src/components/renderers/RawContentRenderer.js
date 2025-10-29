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

export class RawContentRenderer {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        
        // Search service
        this.searchService = serviceFactory.get('SearchService');
        
        // Action bars per section
        this.actionBars = new Map();
        
        // Store original content per section (for copy functionality)
        this.originalContent = new Map();
    }

    /**
     * Render raw Mermaid content as plain text
     * @param {string} mermaidText - Raw Mermaid diagram text
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with rendered content
     */
    renderRawMermaid(mermaidText, _options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container mermaid-raw'
        });

        const codeElement = this.domRegistry.createElement('pre', {
            className: 'raw-code-block'
        });

        const codeContent = this.domRegistry.createElement('code', {
            className: 'language-mermaid',
            textContent: mermaidText
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
     * Display raw content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     */
    displayRawContent(sectionId, container, step) {
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
                    renderer = () => this.renderRawCPEETree(rawContent.getContent());
                }
                break;
            case 'input-intermediate':
                rawContent = step.getInputMermaidRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-intermediate':
                rawContent = step.getOutputMermaidRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-cpee':
                rawContent = step.getOutputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.renderRawCPEETree(rawContent.getContent());
                }
                break;
        }

        if (!rawContent || !renderer) {
            container.innerHTML = '<pre><code class="no-content">No raw content available</code></pre>';
            return;
        }

        try {
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
                    const existingActionBarInDOM = rawContainer.querySelector('.raw-content-actions-bar');
                    
                    if (actionBar && !existingActionBarInDOM) {
                        // Action bar instance exists but not in DOM - re-attach it
                        if (actionBar.element && actionBar.element.parentNode) {
                            actionBar.element.parentNode.removeChild(actionBar.element);
                        }
                        rawContainer.appendChild(actionBar.element);
                    }
                    
                    // Show the action bar
                    if (actionBar) {
                        actionBar.show();
                    }
                }
            }
            
            // Now clear ONLY the content area (preserve action bar)
            const existingActionBar = rawContainer.querySelector('.raw-content-actions-bar');
            
            if (existingActionBar) {
                // Clear all children EXCEPT the action bar
                const allChildren = Array.from(rawContainer.children);
                allChildren.forEach(child => {
                    if (child !== existingActionBar) {
                        child.remove();
                    }
                });
            } else {
                // No action bar exists, clear everything (shouldn't happen, but handle it)
                rawContainer.innerHTML = '';
            }
            
            // Render new content and add it
            const rawElement = renderer();
            rawContainer.appendChild(rawElement);
        } catch (error) {
            console.error(`Error rendering raw content for ${sectionId}:`, error);
            container.innerHTML = '<pre><code class="error">Error rendering raw content</code></pre>';
        }
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
     * @param {HTMLElement} container - Container element
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

        // Create action bar with SearchService
        const actionBar = new ActionBar(this.domRegistry, this.searchService, sectionId);
        
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

        // Attach to container first
        actionBar.attachToContainer(container);
        
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
     * Clean up resources
     */
    destroy() {
        this.actionBars.clear();
        this.originalContent.clear();
    }
}
