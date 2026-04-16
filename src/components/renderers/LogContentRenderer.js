/**
 * LogContentRenderer
 * Renders raw/untouched content for CPEE and Mermaid (Raw View)
 * Handles Raw View rendering, search functionality, and action bar management
 * 
 * This is the "Raw View" - shows original, un-preprocessed content from the log
 */

import { ActionBar } from '../ui/ActionBar.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { configManager } from '../../config/ConfigManager.js';
import { buildCpeeLogXesYamlUrl } from '../../utils/url/CpeeLogUrl.js';

export class LogContentRenderer {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        this.contentProcessingService = serviceFactory.get('ContentProcessingService');
        this.searchService = serviceFactory.get('SearchService');
        this.actionBars = new Map();
    }

    /**
     * Hide elements matching a selector within a container
     */
    hideContentType(container, selector) {
        for (const el of container.querySelectorAll(selector)) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        }
    }

    /**
     * Find or create the raw content container, hiding visual and traces elements.
     * @returns {HTMLElement} The log container
     */
    ensureLogContainer(container) {
        this.hideContentType(container, '[data-content-type="visual"]');
        this.hideContentType(container, '[data-content-type="traces"]');

        let logContainer = container.querySelector('[data-content-type="raw"]');
        if (!logContainer) {
            logContainer = document.createElement('div');
            logContainer.setAttribute('data-content-type', 'raw');
            container.style.position = 'relative';
            container.appendChild(logContainer);
        }

        logContainer.style.display = 'block';
        logContainer.style.visibility = 'visible';
        logContainer.style.pointerEvents = 'auto';

        return logContainer;
    }

    /**
     * Extract copyable content from a raw content object.
     */
    extractContent(rawContent) {
        if (rawContent.getRawExposition) { return rawContent.getRawExposition(); }
        if (rawContent.getContent) { return rawContent.getContent(); }
        if (rawContent.getText) { return rawContent.getText(); }
        return null;
    }

    /**
     * Detect preprocessing line numbers by running the preprocessor
     * and collecting which lines would be affected.
     * @param {Function} preprocessFn - Function that returns { appliedSteps }
     * @returns {number[]} Sorted, deduplicated line numbers
     */
    detectPreprocessingLines(preprocessFn) {
        try {
            const result = preprocessFn();
            if (!result.appliedSteps || result.appliedSteps.length === 0) { return []; }

            const lines = new Set();
            for (const step of result.appliedSteps) {
                if (step.lineNumbers && Array.isArray(step.lineNumbers)) {
                    for (const n of step.lineNumbers) { lines.add(n); }
                }
            }
            return Array.from(lines).sort((a, b) => a - b);
        } catch (error) {
            console.warn('Failed to detect preprocessing steps for Raw View:', error);
            return [];
        }
    }

    /**
     * Display log content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     */
    async display(sectionId, container, step) {
        if (!step || !container) { return; }

        let rawContent = null;
        let renderer = null;

        switch (sectionId) {
            case 'input-cpee':
                rawContent = step.getInputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.renderLogCPEETree(rawContent.getContent());
                }
                break;
            case 'input-intermediate':
                rawContent = step.getInputMermaidRaw();
                if (rawContent) {
                    renderer = () => this.renderLogMermaid(
                        rawContent.getRawExposition ? rawContent.getRawExposition() : rawContent.getContent(),
                        { type: 'input' }
                    );
                }
                break;
            case 'output-intermediate':
                rawContent = step.getOutputMermaidRaw();
                if (rawContent) {
                    renderer = () => this.renderLogMermaid(
                        rawContent.getRawExposition ? rawContent.getRawExposition() : rawContent.getContent(),
                        { type: 'output' }
                    );
                }
                break;
            case 'output-cpee':
                rawContent = step.getOutputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.renderLogCPEETree(rawContent.getContent());
                }
                break;
        }

        if (!rawContent || !renderer) {
            const logContainer = this.ensureLogContainer(container);
            logContainer.innerHTML = '<pre><code class="no-content">No log content available</code></pre>';
            return;
        }

        try {
            const logContainer = this.ensureLogContainer(container);
            container.style.overflow = 'hidden';

            // Ensure action bar exists
            if (rawContent.getLength && rawContent.getLength() > 0) {
                const sectionElement = document.getElementById(sectionId);
                const actionBarRow = sectionElement?.querySelector('.action-bar-row');
                if (actionBarRow) { actionBarRow.innerHTML = ''; }

                if (!this.actionBars.has(sectionId)) {
                    this.addActionBar(logContainer, sectionId, rawContent);
                } else {
                    this.reattachActionBar(sectionId, sectionElement, actionBarRow, logContainer);
                }
            }

            this.updateDownloadMetadata(sectionId, step);

            logContainer.innerHTML = '';
            logContainer.appendChild(renderer());

            // Await highlighting so that .preprocessing-line-number elements are
            // in the DOM before setupMinimap reads them for the marker positions.
            await this.applySyntaxHighlighting(sectionId, logContainer);
            this.setupMinimap(sectionId, container, logContainer);
            this.updateCopyDownloadContent(sectionId, logContainer, rawContent);

        } catch (error) {
            console.error(`Error rendering log content for ${sectionId}:`, error);
            const logContainer = this.ensureLogContainer(container);
            logContainer.innerHTML = '<pre><code class="error">Error rendering log content</code></pre>';
        }
    }

    /**
     * Re-attach an existing action bar to its section.
     */
    reattachActionBar(sectionId, sectionElement, actionBarRow, logContainer) {
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
            actionBar.appendToContainer(logContainer);
        }

        try {
            const instanceService = serviceFactory.get('InstanceService');
            const currentInstance = instanceService.getCurrentInstance();
            if (currentInstance && currentInstance.uuid) {
                const logUrl = buildCpeeLogXesYamlUrl(
                    configManager.get('api.endpoints.cpeeLogs'),
                    currentInstance.uuid
                );
                actionBar.setViewLogUrl(logUrl);
            }
        } catch (error) {
            console.warn('LogContentRenderer: Could not update view log URL', error);
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
            console.warn('LogContentRenderer: Could not get instance number for download filename', error);
        }
    }

    /**
     * Apply syntax highlighting and mark preprocessing lines.
     */
    async applySyntaxHighlighting(sectionId, logContainer) {
        if (sectionId === 'user-input') { return; }

        try {
            const syntaxService = serviceFactory.get('SyntaxHighlightingService');
            await syntaxService.highlightCodeBlocks(logContainer);
        } catch (_) {
            try {
                const sh = configManager.get('syntaxHighlighting', { enabled: true, highlightOnRender: true });
                if (sh.enabled && sh.highlightOnRender && window.Prism) {
                    for (const block of logContainer.querySelectorAll('pre code')) {
                        window.Prism.highlightElement(block);
                    }
                }
            } catch (__) { /* no-op */ }
        }

        this.waitForLineNumbersAndMark(logContainer, 0, 10);
    }

    /**
     * Setup minimap after rendering.
     */
    setupMinimap(sectionId, container, logContainer) {
        const actionBar = this.actionBars.get(sectionId);
        if (!actionBar) { return; }

        const contentBox = container.closest('.content-box') || container;
        // Attach synchronously so the minimap appears at the same time as the
        // content when switching views (no rAF lag, no CSS fade-in lag).
        actionBar.setMinimapCodeContainer(logContainer, contentBox);
        actionBar.refreshMinimap();
    }

    /**
     * Update copy and download content on the action bar.
     */
    updateCopyDownloadContent(sectionId, logContainer, rawContent) {
        const actionBar = this.actionBars.get(sectionId);
        if (!actionBar) { return; }

        const codeElement = logContainer.querySelector('pre code');
        const displayedText = codeElement ? (codeElement.textContent || codeElement.innerText || '') : null;

        const content = displayedText || this.extractContent(rawContent);
        if (content) {
            actionBar.setCopyContent(content);
            actionBar.setDownloadContent(content);
        }
    }

    /**
     * Render log Mermaid content with minimal processing.
     * Only removes comments, markdown markers, and fixes indentation.
     */
    renderLogMermaid(mermaidText, options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container mermaid-log'
        });

        const type = options.type || 'output';
        let processedText = mermaidText || '';

        try {
            processedText = this.contentProcessingService.processMermaidForLogView(processedText, type);
        } catch (error) {
            console.warn('Failed to clean log Mermaid content, using raw text:', error);
            processedText = mermaidText || '';
        }

        const affectedLines = this.detectPreprocessingLines(
            () => this.contentProcessingService.processAndValidateMermaid(processedText, true)
        );

        if (affectedLines.length > 0) {
            container.setAttribute('data-preprocessing-lines', affectedLines.join(','));
        }

        const pre = this.domRegistry.createElement('pre', { className: 'raw-code-block' });
        pre.appendChild(this.domRegistry.createElement('code', {
            className: 'language-mermaid',
            textContent: processedText
        }));
        container.appendChild(pre);

        return container;
    }

    /**
     * Wait for line numbers to be added by Prism, then mark preprocessing lines.
     */
    waitForLineNumbersAndMark(container, attempt = 0, maxAttempts = 10) {
        if (!container || attempt >= maxAttempts) { return; }

        const logContainer = container.querySelector('.mermaid-log') || container.querySelector('.cpee-log') || container;
        if (logContainer.querySelectorAll('.raw-code-line-number').length > 0) {
            this.markPreprocessingLines(container);
        } else {
            setTimeout(() => this.waitForLineNumbersAndMark(container, attempt + 1, maxAttempts), 50);
        }
    }

    /**
     * Mark line numbers with background highlight for lines with preprocessing fixes.
     */
    markPreprocessingLines(container) {
        if (!container) { return; }

        const logContainer = container.querySelector('.mermaid-log') || container.querySelector('.cpee-log') || container;
        const preprocessingLinesAttr = logContainer.getAttribute('data-preprocessing-lines');
        if (!preprocessingLinesAttr) { return; }

        const affectedLineNumbers = preprocessingLinesAttr.split(',').map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0);
        if (affectedLineNumbers.length === 0) { return; }

        const lineSet = new Set(affectedLineNumbers);
        for (const lineNumberEl of logContainer.querySelectorAll('.raw-code-line-number')) {
            const lineNumber = parseInt(lineNumberEl.getAttribute('data-line'), 10);
            if (!isNaN(lineNumber) && lineSet.has(lineNumber)) {
                lineNumberEl.classList.add('preprocessing-line-number');
            }
        }
    }

    /**
     * Render log CPEE XML content as plain text with preprocessing line markers.
     */
    renderLogCPEETree(xmlText) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container cpee-log'
        });

        const originalText = xmlText || '';

        const affectedLines = this.detectPreprocessingLines(
            () => this.contentProcessingService.preprocessCPEEOnly(originalText)
        );

        if (affectedLines.length > 0) {
            container.setAttribute('data-preprocessing-lines', affectedLines.join(','));
        }

        const pre = this.domRegistry.createElement('pre', { className: 'raw-code-block' });
        pre.appendChild(this.domRegistry.createElement('code', {
            className: 'language-xml',
            textContent: originalText
        }));
        container.appendChild(pre);

        return container;
    }

    /**
     * Hide log content when switching to visual mode
     */
    hideLogContent(container) {
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
     * Add action bar (copy, search, minimap, download, view log) to log content container.
     */
    addActionBar(container, sectionId, rawContent) {
        const contentToCopy = this.extractContent(rawContent);

        this.searchService.initializeSearchState(sectionId);

        const isCPEE = sectionId.includes('cpee');
        const actionBar = new ActionBar(this.domRegistry, this.searchService, sectionId, {
            collapsedByDefault: false,
            showViewLog: true,
            showMinimap: true,
            minimapContentType: isCPEE ? 'cpee' : 'mermaid',
            showPreprocessingInMinimap: true
        });

        this.actionBars.set(sectionId, actionBar);

        let currentInstance = null;
        try {
            const instanceService = serviceFactory.get('InstanceService');
            currentInstance = instanceService.getCurrentInstance();
        } catch (error) {
            console.warn('LogContentRenderer: Could not get instance info', error);
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
            const logUrl = buildCpeeLogXesYamlUrl(
                configManager.get('api.endpoints.cpeeLogs'),
                currentInstance.uuid
            );
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
     * Perform search in log content.
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
