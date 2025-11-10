/**
 * TraceContentRenderer
 * Renders execution traces for CPEE and Mermaid sections
 * Handles trace calculation, rendering, and copy functionality
 * 
 * Responsibilities:
 * - Calculate traces for CPEE and Mermaid content
 * - Render trace displays using TraceDisplay component
 * - Manage trace cache
 * - Handle trace copy functionality
 * - Emit trace events
 */

import { CopyButton } from '../ui/CopyButton.js';
import { Trace } from '../../models/Trace.js';
import { TraceDisplay } from '../ui/TraceDisplay.js';
import { CPEETraceCalculator } from '../../utils/trace/CPEETraceCalculator.js';
import { MermaidTraceCalculator } from '../../utils/trace/MermaidTraceCalculator.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { ICONS } from '../../assets/icons.js';
import { serviceFactory } from '../../core/ServiceFactory.js';

export class TraceContentRenderer {
    constructor(domRegistry = null, eventBus = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.contentProcessingService = contentProcessingService;
        
        // Trace displays per section
        this.traceDisplays = new Map();
        
        // Cache calculated traces per section (to avoid recalculation)
        this.traceCache = new Map();
        
        // Copy buttons for traces per section
        this.traceCopyButtons = new Map();
    }

    /**
     * Display traces for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     * @param {Object} options - Rendering options
     */
    display(sectionId, container, step, _options = {}) {
        if (!step || !container) {
            return;
        }

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
        
        // Show trace copy button if it exists
        if (this.traceCopyButtons.has(sectionId)) {
            const copyButton = this.traceCopyButtons.get(sectionId);
            if (copyButton && copyButton.element) {
                const buttonContainer = copyButton.element.closest('.trace-copy-button-container');
                if (buttonContainer) {
                    buttonContainer.style.display = 'block';
                }
            }
        }
    }

    /**
     * Render traces content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     * @returns {HTMLElement|null} Trace display container or null
     */
    renderTracesContent(sectionId, container, step) {
        console.log(`[TraceContentRenderer] Rendering traces content for ${sectionId}`);
        
        if (!step || !container) {
            console.warn('[TraceContentRenderer] Missing step or container for traces rendering');
            return null;
        }

        // Check cache first
        const cacheKey = `${sectionId}-${step.stepNumber || 'unknown'}`;
        if (this.traceCache.has(cacheKey)) {
            console.log(`[TraceContentRenderer] Using cached traces for ${sectionId}`);
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
                console.warn(`[TraceContentRenderer] No valid content found for ${sectionId}`);
                return this.renderNoTracesMessage(container);
            }

            // Calculate traces using appropriate calculator
            let traces = [];
            const options = {
                maxLoopIterations: 1,
                maxPathLength: 50
            };

            if (isCPEE) {
                console.log(`[TraceContentRenderer] Calculating CPEE traces for ${sectionId}`);
                traces = CPEETraceCalculator.calculateAllTraces(contentString, options);
            } else if (isMermaid) {
                console.log(`[TraceContentRenderer] Calculating Mermaid traces for ${sectionId}`);
                traces = MermaidTraceCalculator.calculateAllTraces(contentString, options);
            }

            // Cache the results
            this.traceCache.set(cacheKey, traces);

            // Emit traces:calculated event (Phase 31.15) - silent if no listeners (informational event)
            this.eventBus.emit('traces:calculated', {
                sectionId,
                stepNumber: step.stepNumber || 'unknown',
                traceCount: traces.length,
                traces
            }, { silent: true });

            // Render traces
            return this.renderTraces(sectionId, container, traces);

        } catch (error) {
            console.error(`[TraceContentRenderer] Error calculating traces for ${sectionId}:`, error);
            
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
        // Emit traces:calculated event for cached traces (Phase 31.15) - silent if no listeners (informational event)
        this.eventBus.emit('traces:calculated', {
            sectionId,
            traceCount: traces.length,
            traces,
            cached: true
        }, { silent: true });
        
        return this.renderTraces(sectionId, container, traces);
    }

    /**
     * Render traces using merged TraceRenderer functionality
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container (traces container)
     * @param {Array} traces - Traces to render
     * @returns {HTMLElement} Trace display container
     */
    renderTraces(sectionId, container, traces) {
        // Get or create trace display for this section (thin UI wrapper)
        let traceDisplay = this.traceDisplays.get(sectionId);
        if (!traceDisplay) {
            traceDisplay = new TraceDisplay(this.domRegistry, this);
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

        // Get trace list wrapper from TraceDisplay
        const traceListWrapper = traceDisplay.getContainer().querySelector('.trace-list-wrapper');
        if (!traceListWrapper) {
            console.warn('[TraceContentRenderer] Trace list wrapper not found');
            return container;
        }

        // Render traces using merged methods
        if (traces && traces.length > 0) {
            this.renderTracesIntoContainer(traces, traceListWrapper, {
                showLabels: false, // Show alt_ids in preview
                expandable: true,
                highlightStartEnd: true
            });
            
            // Add copy button for traces
            this.addTraceCopyButton(sectionId, container, traces);
        } else {
            traceDisplay.clear();
            this.renderNoTracesMessage(container);
            // Remove copy button if no traces
            this.addTraceCopyButton(sectionId, container, []);
        }

        return container;
    }

    /**
     * Render traces into a container element (merged from TraceRenderer)
     * @param {Trace[]|Array} traces - Array of Trace objects or plain trace arrays
     * @param {HTMLElement} containerElement - Container to render into
     * @param {Object} options - Rendering options
     * @param {boolean} options.showLabels - Show task labels instead of IDs (default: true)
     * @param {boolean} options.expandable - Make trace details expandable (default: true)
     * @param {boolean} options.highlightStartEnd - Highlight start and end nodes (default: true)
     */
    renderTracesIntoContainer(traces, containerElement, options = {}) {
        console.log('[TraceContentRenderer] Rendering traces:', traces?.length || 0);
        
        const {
            showLabels = true,
            expandable = true,
            highlightStartEnd = true
        } = options;

        // Clear container
        containerElement.innerHTML = '';

        if (!traces || traces.length === 0) {
            const emptyMessage = this.domRegistry.createElement('div', {
                className: 'trace-empty-message',
                textContent: 'No traces found'
            });
            containerElement.appendChild(emptyMessage);
            console.log('[TraceContentRenderer] No traces to render');
            return;
        }

        // Convert plain arrays to Trace objects if needed
        const traceObjects = traces.map((trace, index) => {
            if (trace instanceof Trace) {
                return trace;
            }
            // Assume it's a plain array of task objects
            if (Array.isArray(trace)) {
                return new Trace(`trace-${index + 1}`, trace, 'sequential');
            }
            // Assume it's a plain object with path property
            if (trace && trace.path) {
                return Trace.fromObject(trace);
            }
            return null;
        }).filter(t => t !== null);

        // Create trace list container
        const traceList = this.domRegistry.createElement('div', {
            className: 'trace-list'
        });

        // Render each trace
        traceObjects.forEach((trace, index) => {
            const traceItem = this.createTraceItem(trace, index + 1, {
                showLabels,
                expandable,
                highlightStartEnd
            });
            traceList.appendChild(traceItem);
        });

        containerElement.appendChild(traceList);
        console.log(`[TraceContentRenderer] Rendered ${traceObjects.length} traces`);
    }

    /**
     * Create a single trace item element (merged from TraceRenderer)
     * @param {Trace} trace - Trace object
     * @param {number} traceNumber - Trace number (1-based)
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Trace item element
     */
    createTraceItem(trace, traceNumber, options = {}) {
        const {
            showLabels: _showLabels = true,
            expandable = true,
            highlightStartEnd: _highlightStartEnd = true
        } = options;

        const traceItem = this.domRegistry.createElement('div', {
            className: 'trace-item'
        });

        // Trace header (always visible)
        const traceHeader = this.domRegistry.createElement('div', {
            className: 'trace-header'
        });

        // Trace number and type indicator
        const traceNumberEl = this.domRegistry.createElement('span', {
            className: 'trace-number',
            textContent: `Trace ${traceNumber}`
        });

        // Trace type badge
        const typeBadge = this.domRegistry.createElement('span', {
            className: `trace-type-badge trace-type-${trace.type || 'sequential'}`,
            textContent: this.getTypeLabel(trace.type || 'sequential')
        });

        // Expand/collapse button (if expandable)
        if (expandable) {
            const expandBtn = this.domRegistry.createElement('button', {
                className: 'trace-expand-btn',
                'aria-label': 'Toggle trace details',
                'aria-expanded': 'false'
            });
            expandBtn.innerHTML = ICONS.EXPAND_TRACE;
            expandBtn.addEventListener('click', () => {
                const isExpanded = expandBtn.getAttribute('aria-expanded') === 'true';
                expandBtn.setAttribute('aria-expanded', !isExpanded);
                expandBtn.innerHTML = isExpanded ? ICONS.EXPAND_TRACE : ICONS.COLLAPSE_TRACE;
                traceDetails.classList.toggle('expanded', !isExpanded);
            });
            traceHeader.appendChild(expandBtn);
        }

        traceHeader.appendChild(traceNumberEl);
        traceHeader.appendChild(typeBadge);

        // Trace path preview (always visible) - show alt_ids sequence
        const pathPreview = this.domRegistry.createElement('div', {
            className: 'trace-path-preview'
        });
        const previewText = this.formatTracePathAltIds(trace);
        pathPreview.textContent = previewText;
        traceHeader.appendChild(pathPreview);

        // Trace length on the right (in parentheses)
        const traceLengthEl = this.domRegistry.createElement('span', {
            className: 'trace-length-display',
            textContent: `(${trace.length})`
        });
        traceHeader.appendChild(traceLengthEl);

        traceItem.appendChild(traceHeader);

        // Trace details (expandable) - show full trace as JSON-like format
        const traceDetails = this.domRegistry.createElement('div', {
            className: 'trace-details'
        });

        // Full trace details as JSON-like format
        const traceDetailsContent = this.domRegistry.createElement('pre', {
            className: 'trace-details-json'
        });
        const traceDetailsCode = this.domRegistry.createElement('code', {
            className: 'language-json',
            textContent: this.formatTraceAsJSON(trace)
        });
        traceDetailsContent.appendChild(traceDetailsCode);
        traceDetails.appendChild(traceDetailsContent);

        // Apply syntax highlighting to trace JSON using SyntaxHighlightingService for consistency
        try {
            const syntaxService = serviceFactory.get('SyntaxHighlightingService');
            if (syntaxService && typeof syntaxService.highlightCodeBlocks === 'function') {
                syntaxService.highlightCodeBlocks(traceDetailsContent);
                setTimeout(() => {
                    this.markTaskStringTokens(traceDetailsCode);
                }, 0);
            } else if (window.Prism && typeof window.Prism.highlightElement === 'function') {
                window.Prism.highlightElement(traceDetailsCode);
                setTimeout(() => {
                    this.markTaskStringTokens(traceDetailsCode);
                }, 0);
            }
        } catch (error) {
            if (window.Prism && typeof window.Prism.highlightElement === 'function') {
                try {
                    window.Prism.highlightElement(traceDetailsCode);
                    setTimeout(() => {
                        this.markTaskStringTokens(traceDetailsCode);
                    }, 0);
                } catch (prismError) {
                    console.warn('[TraceContentRenderer] Failed to highlight trace JSON:', prismError);
                }
            } else {
                console.warn('[TraceContentRenderer] Syntax highlighting not available:', error);
            }
        }

        // Trace metadata (if available)
        if (trace.metadata && Object.keys(trace.metadata).length > 0) {
            const metadataEl = this.createMetadataElement(trace.metadata);
            traceDetails.appendChild(metadataEl);
        }

        traceItem.appendChild(traceDetails);

        return traceItem;
    }

    /**
     * Format trace path as readable string using alt_ids (merged from TraceRenderer)
     * @param {Trace} trace - Trace object
     * @param {Object} options - Formatting options
     * @param {number} options.maxLength - Maximum length for preview
     * @returns {string} Formatted path string with alt_ids
     */
    formatTracePathAltIds(trace, options = {}) {
        const { maxLength = null } = options;
        
        if (trace.path.length === 0) {
            return '(empty trace)';
        }

        const parts = trace.path.map(task => task.alt_id || task.id || '?');

        let pathStr = parts.join(' → ');
        
        if (maxLength && pathStr.length > maxLength) {
            pathStr = pathStr.substring(0, maxLength - 3) + '...';
        }

        return pathStr;
    }

    /**
     * Format trace as JSON-like string for details view (merged from TraceRenderer)
     * @param {Trace} trace - Trace object
     * @returns {string} JSON-formatted string
     */
    formatTraceAsJSON(trace) {
        if (trace.path.length === 0) {
            return '[]';
        }

        const jsonLines = trace.path.map(task => {
            const taskObj = {
                id: task.id,
                alt_id: task.alt_id,
                task: task.task
            };
            return '    ' + JSON.stringify(taskObj, null, 0);
        });

        return '[\n' + jsonLines.join(',\n') + '\n]';
    }

    /**
     * Mark task string tokens in JSON for CSS styling (merged from TraceRenderer)
     * @param {HTMLElement} codeElement - Code element with Prism tokens
     */
    markTaskStringTokens(codeElement) {
        if (!codeElement) {
            return;
        }

        const propertyTokens = codeElement.querySelectorAll('.token.property');
        
        propertyTokens.forEach(propertyToken => {
            if (propertyToken.textContent.trim() === '"task"') {
                let current = propertyToken.nextSibling;
                let foundOperator = false;
                
                while (current) {
                    if (current.nodeType === Node.ELEMENT_NODE) {
                        if (current.classList.contains('token') && current.classList.contains('operator')) {
                            foundOperator = true;
                            current = current.nextSibling;
                            break;
                        }
                    }
                    current = current.nextSibling;
                }
                
                if (foundOperator) {
                    while (current) {
                        if (current.nodeType === Node.ELEMENT_NODE) {
                            if (current.classList.contains('token') && current.classList.contains('string')) {
                                current.classList.add('token-task-string');
                                break;
                            }
                        }
                        current = current.nextSibling;
                    }
                }
            }
        });
    }

    /**
     * Create metadata display element (merged from TraceRenderer)
     * @param {Object} metadata - Trace metadata
     * @returns {HTMLElement} Metadata element
     */
    createMetadataElement(metadata) {
        const metadataEl = this.domRegistry.createElement('div', {
            className: 'trace-metadata'
        });

        const metadataTitle = this.domRegistry.createElement('div', {
            className: 'trace-metadata-title',
            textContent: 'Metadata:'
        });
        metadataEl.appendChild(metadataTitle);

        const metadataList = this.domRegistry.createElement('dl', {
            className: 'trace-metadata-list'
        });

        Object.entries(metadata).forEach(([key, value]) => {
            const dt = this.domRegistry.createElement('dt', {
                textContent: key + ':'
            });
            const dd = this.domRegistry.createElement('dd', {
                textContent: String(value)
            });
            metadataList.appendChild(dt);
            metadataList.appendChild(dd);
        });

        metadataEl.appendChild(metadataList);
        return metadataEl;
    }

    /**
     * Get human-readable label for trace type (merged from TraceRenderer)
     * @param {string} type - Trace type
     * @returns {string} Human-readable label
     */
    getTypeLabel(type) {
        const typeLabels = {
            'sequential': 'Sequential',
            'parallel': 'Parallel',
            'loop': 'Loop',
            'conditional': 'Conditional'
        };
        return typeLabels[type] || type;
    }

    /**
     * Format traces as JSON arrays separated by commas for copying
     * @param {Array} traces - Array of Trace objects or plain trace arrays
     * @returns {string} Formatted string with JSON arrays
     */
    formatTracesForCopy(traces) {
        if (!traces || traces.length === 0) {
            return '';
        }
        
        // Convert traces to JSON arrays
        const traceArrays = traces.map(trace => {
            // Handle Trace objects
            if (trace instanceof Trace || (trace && trace.path)) {
                const path = trace.path || trace;
                return path.map(task => ({
                    id: task.id || '',
                    alt_id: task.alt_id || '',
                    task: task.task || ''
                }));
            }
            // Handle plain arrays
            if (Array.isArray(trace)) {
                return trace.map(task => ({
                    id: task.id || '',
                    alt_id: task.alt_id || '',
                    task: task.task || ''
                }));
            }
            return [];
        }).filter(arr => arr.length > 0);

        // Format each trace as a JSON array with proper indentation
        const formattedTraces = traceArrays.map(traceArray => {
            const jsonLines = traceArray.map(task => '    ' + JSON.stringify(task, null, 0));
            return '[\n' + jsonLines.join(',\n') + '\n]';
        });

        // Join traces with comma and newline (no trailing comma after last trace)
        return formattedTraces.join(',\n\n');
    }

    /**
     * Add copy button for traces to a container
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container element (traces container)
     * @param {Array} traces - Traces to copy
     */
    addTraceCopyButton(sectionId, container, traces) {
        if (!traces || traces.length === 0) {
            // Remove copy button if no traces
            if (this.traceCopyButtons.has(sectionId)) {
                const copyButton = this.traceCopyButtons.get(sectionId);
                if (copyButton && copyButton.element && copyButton.element.parentNode) {
                    copyButton.element.parentNode.removeChild(copyButton.element);
                }
                this.traceCopyButtons.delete(sectionId);
            }
            return;
        }

        // Format traces for copying
        const contentToCopy = this.formatTracesForCopy(traces);

        // Get or create copy button
        let copyButton = this.traceCopyButtons.get(sectionId);
        
        if (!copyButton) {
            // Create new copy button
            copyButton = new CopyButton(this.domRegistry, { showText: false });
            this.traceCopyButtons.set(sectionId, copyButton);
        }

        // Update content
        copyButton.setContent(contentToCopy);

        // Create button element if it doesn't exist
        if (!copyButton.element) {
            const button = copyButton.createButton(contentToCopy, '');
            
            // Attach to parent container (non-scrolling) similar to action bar
            const parentContainer = container.closest('.content-box') || container.parentElement;
            if (parentContainer) {
                // Check if button already exists in DOM
                const existingButton = parentContainer.querySelector('.trace-copy-button-container');
                if (existingButton) {
                    existingButton.remove();
                }
                
                // Create wrapper container for the copy button
                const buttonContainer = this.domRegistry.createElement('div', {
                    className: 'trace-copy-button-container'
                });
                buttonContainer.appendChild(button);
                parentContainer.appendChild(buttonContainer);
            } else {
                // Fallback to traces container
                const buttonContainer = this.domRegistry.createElement('div', {
                    className: 'trace-copy-button-container'
                });
                buttonContainer.appendChild(button);
                container.appendChild(buttonContainer);
            }
        } else {
            // Update existing button content
            copyButton.setContent(contentToCopy);
            
            // Ensure button container is visible
            const buttonContainer = copyButton.element.closest('.trace-copy-button-container');
            if (buttonContainer) {
                buttonContainer.style.display = 'block';
            }
        }
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
     * Clear trace cache (called when navigating to a different step)
     */
    clearTraceCache() {
        console.log('[TraceContentRenderer] Clearing trace cache');
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
     * Hide trace content when switching to other modes
     * @param {HTMLElement} container - Content container
     */
    hideTraceContent(container) {
        if (!container) {
            return;
        }

        // Hide traces content elements
        const tracesElements = container.querySelectorAll('[data-content-type="traces"]');
        tracesElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        });
        
        // Hide trace copy button for this section
        const sectionId = container.closest('[id]')?.id;
        if (sectionId && this.traceCopyButtons.has(sectionId)) {
            const copyButton = this.traceCopyButtons.get(sectionId);
            if (copyButton && copyButton.element) {
                const buttonContainer = copyButton.element.closest('.trace-copy-button-container');
                if (buttonContainer) {
                    buttonContainer.style.display = 'none';
                }
            }
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.clearTraceCache();
        this.traceCopyButtons.clear();
    }
}

