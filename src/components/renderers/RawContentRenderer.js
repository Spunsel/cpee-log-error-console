/**
 * RawContentRenderer
 * Renders preprocessed content (Mermaid, CPEE XML) as plain text (Cleaned View)
 */

import { ActionBar } from '../ui/ActionBar.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { configManager } from '../../config/ConfigManager.js';

export class RawContentRenderer {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        this.contentProcessingService = serviceFactory.get('ContentProcessingService');
        this.searchService = serviceFactory.get('SearchService');
        this.actionBars = new Map();
    }

    /**
     * Hide elements matching a selector within a container.
     */
    hideContentType(container, selector) {
        for (const el of container.querySelectorAll(selector)) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        }
    }

    /**
     * Find or create the raw content container, hiding visual elements.
     */
    ensureRawContainer(container) {
        this.hideContentType(container, '[data-content-type="visual"]');

        let rawContainer = container.querySelector('[data-content-type="raw"]');
        if (!rawContainer) {
            rawContainer = document.createElement('div');
            rawContainer.setAttribute('data-content-type', 'raw');
            container.style.position = 'relative';
            container.appendChild(rawContainer);
        }

        rawContainer.style.display = 'block';
        rawContainer.style.visibility = 'visible';
        rawContainer.style.pointerEvents = 'auto';

        return rawContainer;
    }

    /**
     * Extract copyable content from a raw content object.
     */
    extractContent(rawContent) {
        if (rawContent.getContent) { return rawContent.getContent(); }
        if (rawContent.getText) { return rawContent.getText(); }
        return null;
    }

    /**
     * Render Mermaid content as plain text with preprocessing applied.
     */
    renderRawMermaid(mermaidText) {
        const container = this.domRegistry.createElement('div', { className: 'raw-content-container mermaid-raw' });

        let processedText = mermaidText || '';
        try {
            processedText = this.contentProcessingService.processAndValidateMermaid(processedText, true).code;
        } catch (error) {
            console.warn('Failed to preprocess raw Mermaid content, using original text:', error);
            processedText = mermaidText || '';
        }

        const pre = this.domRegistry.createElement('pre', { className: 'raw-code-block' });
        pre.appendChild(this.domRegistry.createElement('code', { className: 'language-mermaid', textContent: processedText }));
        container.appendChild(pre);
        return container;
    }

    /**
     * Render CPEE XML content as plain text with preprocessing applied.
     */
    renderRawCPEETree(xmlText) {
        const container = this.domRegistry.createElement('div', { className: 'raw-content-container cpee-raw' });

        let processedText = xmlText || '';
        try {
            processedText = this.contentProcessingService.preprocessCPEEOnly(processedText).xml;
        } catch (error) {
            console.warn('Failed to preprocess raw CPEE content, using original text:', error);
            processedText = xmlText || '';
        }

        const pre = this.domRegistry.createElement('pre', { className: 'raw-code-block' });
        pre.appendChild(this.domRegistry.createElement('code', { className: 'language-xml', textContent: processedText }));
        container.appendChild(pre);
        return container;
    }

    /**
     * Display cleaned content for a section.
     */
    display(sectionId, container, step) {
        if (!step || !container) { return; }

        let rawContent = null;
        let renderer = null;

        switch (sectionId) {
            case 'input-cpee':
                rawContent = step.getInputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.renderRawCPEETree(rawContent.getContent());
                }
                break;
            case 'input-intermediate':
                rawContent = step.getInputMermaidRaw();
                if (rawContent && rawContent.getContent && rawContent.getContent().trim().length > 0) {
                    renderer = () => this.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-intermediate':
                rawContent = step.getOutputMermaidRaw();
                if (rawContent && rawContent.getContent && rawContent.getContent().trim().length > 0) {
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
            const rawContainer = this.ensureRawContainer(container);
            rawContainer.innerHTML = '<pre><code class="no-content">No raw content available</code></pre>';
            return;
        }

        try {
            const rawContainer = this.ensureRawContainer(container);
            container.style.overflow = 'hidden';

            // Ensure action bar exists
            if (rawContent.getLength && rawContent.getLength() > 0) {
                const sectionElement = document.getElementById(sectionId);
                const actionBarRow = sectionElement?.querySelector('.action-bar-row');
                if (actionBarRow) { actionBarRow.innerHTML = ''; }

                if (!this.actionBars.has(sectionId)) {
                    this.addActionBar(rawContainer, sectionId, rawContent, step);
                } else {
                    this.reattachActionBar(sectionId, sectionElement, actionBarRow, rawContainer);
                }
            }

            this.updateDownloadMetadata(sectionId, step);

            rawContainer.innerHTML = '';
            rawContainer.appendChild(renderer());

            this.applySyntaxHighlighting(sectionId, rawContainer);
            this.setupMinimap(sectionId, container, rawContainer);
            this.updateCopyDownloadContent(sectionId, rawContainer, rawContent);

        } catch (error) {
            console.error(`Error rendering raw content for ${sectionId}:`, error);
            const rawContainer = this.ensureRawContainer(container);
            rawContainer.innerHTML = '<pre><code class="error">Error rendering raw content</code></pre>';
        }
    }

    /**
     * Re-attach an existing action bar to its section.
     */
    reattachActionBar(sectionId, sectionElement, actionBarRow, rawContainer) {
        const actionBar = this.actionBars.get(sectionId);
        if (!actionBar) { return; }

        actionBar.removeFromDOM();

        let row = actionBarRow;
        if (!row && sectionElement) {
            const sectionHeader = sectionElement.querySelector('h3');
            if (sectionHeader) {
                row = document.createElement('div');
                row.className = 'action-bar-row';
                sectionHeader.insertAdjacentElement('afterend', row);
            }
        }

        if (row) {
            actionBar.appendToContainer(row);
            row.style.display = 'flex';
        } else {
            actionBar.appendToContainer(rawContainer);
        }

        try {
            const instanceService = serviceFactory.get('InstanceService');
            const currentInstance = instanceService.getCurrentInstance();
            if (currentInstance && currentInstance.uuid) {
                const logUrl = `${configManager.get('api.endpoints.cpeeLogs')}/${currentInstance.uuid}.xes.yaml`;
                actionBar.setViewLogUrl(logUrl);
            }
        } catch (error) {
            console.warn('RawContentRenderer: Could not update view log URL', error);
        }

        actionBar.show();
    }

    /**
     * Set download metadata on the action bar for current instance/step.
     */
    updateDownloadMetadata(sectionId, step) {
        try {
            const instanceService = serviceFactory.get('InstanceService');
            const currentInstance = instanceService.getCurrentInstance();
            if (currentInstance && currentInstance.processNumber && step) {
                const actionBar = this.actionBars.get(sectionId);
                if (actionBar) {
                    actionBar.setDownloadMetadata(currentInstance.processNumber, step.stepNumber);
                }
            }
        } catch (error) {
            // Silently ignore
        }
    }

    /**
     * Apply syntax highlighting.
     */
    applySyntaxHighlighting(sectionId, rawContainer) {
        if (sectionId === 'user-input') { return; }

        try {
            const syntaxService = serviceFactory.get('SyntaxHighlightingService');
            syntaxService.highlightCodeBlocks(rawContainer);
        } catch (_) {
            try {
                const sh = configManager.get('syntaxHighlighting', { enabled: true, highlightOnRender: true });
                if (sh.enabled && sh.highlightOnRender && window.Prism) {
                    for (const block of rawContainer.querySelectorAll('pre code')) {
                        window.Prism.highlightElement(block);
                    }
                }
            } catch (__) { /* no-op */ }
        }
    }

    /**
     * Setup minimap after rendering.
     */
    setupMinimap(sectionId, container, rawContainer) {
        const actionBar = this.actionBars.get(sectionId);
        if (!actionBar) { return; }

        const contentBox = container.closest('.content-box') || container;
        requestAnimationFrame(() => {
            actionBar.setMinimapCodeContainer(rawContainer, contentBox);
            actionBar.refreshMinimap();
        });
    }

    /**
     * Update copy and download content on the action bar.
     */
    updateCopyDownloadContent(sectionId, rawContainer, rawContent) {
        const actionBar = this.actionBars.get(sectionId);
        if (!actionBar) { return; }

        const codeElement = rawContainer.querySelector('pre code');
        const displayedText = codeElement ? (codeElement.textContent || codeElement.innerText || '') : null;

        const content = displayedText || this.extractContent(rawContent);
        if (content) {
            actionBar.setCopyContent(content);
            actionBar.setDownloadContent(content);
        }
    }

    /**
     * Hide raw content when switching to visual mode.
     */
    hideRawContent(container) {
        if (!container) { return; }

        this.hideContentType(container, '[data-content-type="raw"]');

        const sectionId = container.closest('[id]')?.id;
        if (sectionId && this.actionBars.has(sectionId)) {
            const actionBar = this.actionBars.get(sectionId);
            if (actionBar) {
                actionBar.clearSearch();
                actionBar.hide();
                actionBar.hideMinimap();
            }
            const sectionElement = document.getElementById(sectionId);
            const actionBarRow = sectionElement?.querySelector('.action-bar-row');
            if (actionBarRow) { actionBarRow.style.display = 'none'; }
        }
    }

    /**
     * Add action bar (copy, search, minimap, download, view log) to raw content container.
     */
    addActionBar(container, sectionId, rawContent, step) {
        const contentToCopy = this.extractContent(rawContent);

        this.searchService.initializeSearchState(sectionId);

        const isCPEE = sectionId.includes('cpee');
        const actionBar = new ActionBar(this.domRegistry, this.searchService, sectionId, {
            collapsedByDefault: false,
            showViewLog: true,
            showMinimap: true,
            minimapContentType: isCPEE ? 'cpee' : 'mermaid',
            showPreprocessingInMinimap: false
        });

        this.actionBars.set(sectionId, actionBar);

        let currentInstance = null;
        try {
            const instanceService = serviceFactory.get('InstanceService');
            currentInstance = instanceService.getCurrentInstance();
            if (currentInstance && currentInstance.processNumber && step) {
                actionBar.setDownloadMetadata(currentInstance.processNumber, step.stepNumber);
            }
        } catch (error) {
            console.warn('RawContentRenderer: Could not get instance info for action bar', error);
        }

        actionBar.setOnSearch((searchTerm) => this.performSearch(sectionId, searchTerm));
        actionBar.setOnClear(() => this.clearSearch(sectionId));
        actionBar.setOnNavigate((direction) => this.navigateToMatch(sectionId, direction));

        const sectionElement = document.getElementById(sectionId);
        const sectionHeader = sectionElement?.querySelector('h3');

        if (sectionHeader) {
            let actionBarRow = sectionElement.querySelector('.action-bar-row');
            if (!actionBarRow) {
                actionBarRow = document.createElement('div');
                actionBarRow.className = 'action-bar-row';
                sectionHeader.insertAdjacentElement('afterend', actionBarRow);
            } else {
                actionBarRow.innerHTML = '';
            }
            actionBarRow.style.display = 'flex';
            actionBar.attachToContainer(actionBarRow);
        } else {
            const parentContainer = container.closest('.content-box') || container.parentElement || container;
            actionBar.attachToContainer(parentContainer);
        }

        if (contentToCopy) {
            actionBar.setCopyContent(contentToCopy);
            actionBar.setDownloadContent(contentToCopy);
        }

        if (currentInstance && currentInstance.uuid) {
            const logUrl = `${configManager.get('api.endpoints.cpeeLogs')}/${currentInstance.uuid}.xes.yaml`;
            actionBar.setViewLogUrl(logUrl);
        }

        actionBar.show();
    }

    /**
     * Get raw-content-container element for a section.
     */
    getContainerForSection(sectionId) {
        const sectionElement = this.domRegistry
            ? (this.domRegistry.getElementSafe(sectionId) || document.getElementById(sectionId))
            : document.getElementById(sectionId);

        return sectionElement ? sectionElement.querySelector('.raw-content-container') : null;
    }

    /**
     * Perform search in raw content.
     */
    performSearch(sectionId, searchTerm) {
        if (!searchTerm) { return; }

        const container = this.getContainerForSection(sectionId);
        if (!container) { return; }

        const searchState = this.searchService.getSearchState(sectionId);
        const options = {
            caseSensitive: searchState?.caseSensitive || false,
            wholeWord: searchState?.wholeWord || false
        };

        const matches = this.searchService.performSearch(sectionId, container, searchTerm, options);
        this.updateSearchUI(sectionId);

        if (matches.length > 0) {
            this.searchService.scrollToMatch(container, 0);
        }

        const actionBar = this.actionBars.get(sectionId);
        if (actionBar) { actionBar.updateMinimapSearchMarkers(matches); }
    }

    /**
     * Clear search highlighting.
     */
    clearSearch(sectionId) {
        const container = this.getContainerForSection(sectionId);
        if (!container) { return; }

        this.searchService.clearSearch(sectionId, container);
        this.updateSearchUI(sectionId);

        const actionBar = this.actionBars.get(sectionId);
        if (actionBar) { actionBar.updateMinimapSearchMarkers([]); }
    }

    /**
     * Navigate to next/previous match.
     */
    navigateToMatch(sectionId, direction) {
        const container = this.getContainerForSection(sectionId);
        if (!container) { return; }

        if (direction === 'next') {
            this.searchService.navigateToNextMatch(sectionId, container);
        } else {
            this.searchService.navigateToPreviousMatch(sectionId, container);
        }

        this.updateSearchUI(sectionId);
    }

    /**
     * Update search UI from SearchService state.
     */
    updateSearchUI(sectionId) {
        const actionBar = this.actionBars.get(sectionId);
        if (actionBar && actionBar.searchBar) {
            actionBar.searchBar.updateUIFromService();
        }
    }

    /**
     * Clear search state for a specific section.
     */
    clearSectionSearch(sectionId) {
        const container = this.getContainerForSection(sectionId);
        if (container) {
            this.searchService.clearSearch(sectionId, container);
        }
    }

    /**
     * Clear all search states (called when navigating to a different step).
     */
    clearAllSearchStates() {
        this.searchService.clearAllSearchStates();
        this.searchService.clearAllOriginalText();

        for (const sectionId of this.actionBars.keys()) {
            const container = this.getContainerForSection(sectionId);
            if (container) {
                this.searchService.clearSearchHighlighting(container);
            }
        }
    }

    /**
     * Clean up resources.
     */
    destroy() {
        this.actionBars.clear();
    }
}
