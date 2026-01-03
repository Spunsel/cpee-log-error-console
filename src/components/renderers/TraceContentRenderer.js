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
import { ActionBar } from '../ui/ActionBar.js';
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
        
        // Action bars for traces per section (copy-only, no search)
        this.traceActionBars = new Map();
        
        // Copy buttons for traces per section (legacy, for backwards compatibility)
        this.traceCopyButtons = new Map();
        
        // Store comparison results per section pair for trace coloring
        this.comparisonResults = {
            input: null,
            output: null
        };
        
        // Track currently highlighted task for cross-graph highlighting
        this.highlightedTaskKey = null; // Format: "sectionId:alt_id" to uniquely identify highlighted row
        this.highlightedRows = new Set(); // Track all highlighted row elements
        
        // Auto-play trace state
        this.autoPlayState = {
            isPlaying: false,
            currentTraceKey: null, // Format: "sectionId:traceNumber"
            currentTaskIndex: 0,
            intervalId: null,
            trace: null,
            sectionId: null,
            playButton: null,
            traceElement: null // Reference to the trace item element for finding specific rows
        };
        
        // Listen for comparison events to update trace colors
        this.setupComparisonListeners();
        
        // Listen for highlight clear events
        this.setupHighlightListeners();
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
        
        // Show action bar if it exists
        if (this.traceActionBars.has(sectionId)) {
            const actionBar = this.traceActionBars.get(sectionId);
            if (actionBar) {
                actionBar.show();
                const sectionElement = document.getElementById(sectionId);
                const actionBarRow = sectionElement?.querySelector('.action-bar-row');
                if (actionBarRow) {
                    actionBarRow.style.display = 'flex';
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
        if (!step || !container) {
            console.warn('[TraceContentRenderer] Missing step or container for traces rendering');
            return null;
        }

        // Check cache first
        const cacheKey = `${sectionId}-${step.stepNumber || 'unknown'}`;
        if (this.traceCache.has(cacheKey)) {
            const cachedTraces = this.traceCache.get(cacheKey);
            return this.renderCachedTraces(sectionId, container, cachedTraces);
        }

        // Check if step has pre-calculated traces (e.g., after reconciliation)
        // These traces may have isReconciled flags that would be lost if we recalculate
        const stepTraces = step.getTraces(sectionId);
        if (stepTraces && Array.isArray(stepTraces) && stepTraces.length > 0) {
            // Use step's stored traces - they may have reconciled traces added
            this.traceCache.set(cacheKey, stepTraces);
            return this.renderCachedTraces(sectionId, container, stepTraces);
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

            // Preprocess content before calculating traces
            if (isCPEE && this.contentProcessingService) {
                try {
                    const preprocessedResult = this.contentProcessingService.processAndValidateCPEE(contentString, true);
                    contentString = preprocessedResult.xml;
                } catch (error) {
                    console.warn(`[TraceContentRenderer] Failed to preprocess CPEE XML for ${sectionId}, using original:`, error);
                    // Continue with original content if preprocessing fails
                }
            } else if (isMermaid && this.contentProcessingService) {
                try {
                    const preprocessedResult = this.contentProcessingService.processAndValidateMermaid(contentString, true);
                    contentString = preprocessedResult.code;
                } catch (error) {
                    console.warn(`[TraceContentRenderer] Failed to preprocess Mermaid code for ${sectionId}, using original:`, error);
                    // Continue with original content if preprocessing fails
                }
            }

            // Calculate traces using appropriate calculator
            let traces = [];
            const options = {
                maxLoopIterations: 1,
                maxPathLength: 50
            };

            if (isCPEE) {
                traces = CPEETraceCalculator.calculateAllTraces(contentString, options);
            } else if (isMermaid) {
                traces = MermaidTraceCalculator.calculateAllTraces(contentString, options);
            }

            // Cache the results
            this.traceCache.set(cacheKey, traces);

            // Emit traces:calculated event  - silent if no listeners (informational event)
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
            
            // Emit traces:error event 
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
        // Emit traces:calculated event for cached traces  - silent if no listeners (informational event)
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

        // Determine section pair for comparison results
        // Note: sectionId is not directly available here, so we'll apply colors after rendering
        // via updateTraceColorsForSectionPair when comparison results are available

        // Find sectionId from container for trace highlighting
        const sectionElement = containerElement.closest('[id^="input-"], [id^="output-"]');
        const sectionId = sectionElement ? sectionElement.id : null;

        // Render each trace
        traceObjects.forEach((trace, index) => {
            const traceItem = this.createTraceItem(trace, index + 1, {
                showLabels,
                expandable,
                highlightStartEnd,
                sectionId
            });
            traceList.appendChild(traceItem);
        });

        containerElement.appendChild(traceList);
        
        // Try to apply trace colors if comparison results are available
        if (sectionElement) {
            const sectionPair = this.getSectionPair(sectionId);
            if (sectionPair) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    this.updateTraceColorsForSectionPair(sectionPair);
                }, 0);
            }
        }
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
            highlightStartEnd: _highlightStartEnd = true,
            sectionId = null
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

        // Add reconciled class if trace is marked as reconciled
        if (trace.isReconciled) {
            traceNumberEl.classList.add('trace-number--reconciled');
        }

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

        // Auto-play button
        const playBtn = this.domRegistry.createElement('button', {
            className: 'trace-play-btn',
            'aria-label': 'Auto-play trace',
            title: 'Auto-play trace (1 second per task)'
        });
        playBtn.innerHTML = ICONS.PLAY_TRACE;
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAutoPlay(sectionId, traceNumber, trace, playBtn, traceItem);
        });
        traceHeader.appendChild(playBtn);

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

        // Trace details (expandable) - show full trace as table
        const traceDetails = this.domRegistry.createElement('div', {
            className: 'trace-details'
        });

        // Create table container
        const tableContainer = this.domRegistry.createElement('div', {
            className: 'traces-table-container'
        });

        // Create table
        const table = this.domRegistry.createElement('table', {
            className: 'traces-table'
        });

        // Create table header
        const thead = this.domRegistry.createElement('thead');
        const headerRow = this.domRegistry.createElement('tr');
        
        const headers = ['ID', 'Alt ID', 'Task'];
        headers.forEach(headerText => {
            const th = this.domRegistry.createElement('th', {
                textContent: headerText
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = this.domRegistry.createElement('tbody');
        trace.path.forEach(task => {
            const row = this.domRegistry.createElement('tr', {
                className: 'trace-row-clickable',
                title: 'Click to highlight this task across all graphs'
            });
            
            // Store task alt_id on row for matching highlights
            row.setAttribute('data-task-alt-id', task.alt_id || task.id || '');
            
            // Add click handler to entire row for highlighting
            row.addEventListener('click', () => {
                this.handleTraceHighlightClick(sectionId, task, row);
            });
            
            // ID column - show id if available, otherwise fall back to alt_id
            const idCell = this.domRegistry.createElement('td', {
                className: 'traces-table-id',
                textContent: task.id || task.alt_id || ''
            });
            row.appendChild(idCell);
            
            // Alt ID column
            const altIdCell = this.domRegistry.createElement('td', {
                className: 'traces-table-alt-id',
                textContent: task.alt_id || ''
            });
            row.appendChild(altIdCell);
            
            // Label column
            const labelCell = this.domRegistry.createElement('td', {
                className: 'traces-table-label',
                textContent: task.task || ''
            });
            row.appendChild(labelCell);
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.appendChild(table);
        traceDetails.appendChild(tableContainer);

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
     * @returns {boolean} True if tokens were found and marked, false otherwise
     */
    markTaskStringTokens(codeElement) {
        if (!codeElement) {
            return false;
        }

        const propertyTokens = codeElement.querySelectorAll('.token.property');
        let markedCount = 0;
        
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
                                markedCount++;
                                break;
                            }
                        }
                        current = current.nextSibling;
                    }
                }
            }
        });
        
        return markedCount > 0;
    }

    /**
     * Mark task string tokens with retry mechanism to handle timing issues
     * @param {HTMLElement} codeElement - Code element with Prism tokens
     * @param {number} maxRetries - Maximum number of retries (default: 3)
     * @param {number} delay - Delay between retries in milliseconds (default: 100)
     */
    markTaskStringTokensWithRetry(codeElement, maxRetries = 3, delay = 100) {
        if (!codeElement) {
            return;
        }

        let retries = 0;
        const tryMark = () => {
            const success = this.markTaskStringTokens(codeElement);
            if (!success && retries < maxRetries) {
                retries++;
                setTimeout(tryMark, delay);
            }
        };
        
        // Start with a small delay to allow Prism to finish highlighting
        setTimeout(tryMark, 50);
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
     * Add action bar for traces to a container (copy-only, no search)
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Container element (traces container)
     * @param {Array} traces - Traces to copy
     */
    addTraceCopyButton(sectionId, container, traces) {
        if (!traces || traces.length === 0) {
            // Remove action bar if no traces
            if (this.traceActionBars.has(sectionId)) {
                const actionBar = this.traceActionBars.get(sectionId);
                if (actionBar) {
                    actionBar.removeFromDOM();
                }
                this.traceActionBars.delete(sectionId);
            }
            // Also hide action bar row if it exists
            const sectionElement = document.getElementById(sectionId);
            const actionBarRow = sectionElement?.querySelector('.action-bar-row');
            if (actionBarRow) {
                actionBarRow.style.display = 'none';
            }
            return;
        }

        // Format traces for copying
        const contentToCopy = this.formatTracesForCopy(traces);

        // Get or create action bar (copy-only, no search)
        let actionBar = this.traceActionBars.get(sectionId);
        
        // Get section element and header
        const sectionElement = document.getElementById(sectionId);
        const sectionHeader = sectionElement?.querySelector('h3');
        
        if (!actionBar) {
            // Create new action bar with showSearch: false
            actionBar = new ActionBar(this.domRegistry, null, sectionId, { showSearch: false });
            this.traceActionBars.set(sectionId, actionBar);
        }
        
        // Always ensure action bar is attached to the DOM
        if (sectionHeader) {
            // Create or find the action bar row container
            let actionBarRow = sectionElement.querySelector('.action-bar-row');
            if (!actionBarRow) {
                actionBarRow = document.createElement('div');
                actionBarRow.className = 'action-bar-row';
                // Insert after the h3 header, before the content-box
                sectionHeader.insertAdjacentElement('afterend', actionBarRow);
            } else {
                // Clear existing action bars from other renderers
                actionBarRow.innerHTML = '';
            }
            
            // Remove action bar from old parent if attached elsewhere
            actionBar.removeFromDOM();
            
            actionBar.attachToContainer(actionBarRow);
            // Ensure action bar row is visible
            actionBarRow.style.display = 'flex';
        }
        
        // Set copy content
        actionBar.setCopyContent(contentToCopy);
        
        // Show the action bar
        actionBar.show();
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
     * Setup event listeners for comparison results
     */
    setupComparisonListeners() {
        // Listen for comparison events to store results for trace coloring
        this.eventBus.on('traceComparison:compared', (data) => {
            const { sectionPair, comparisonResult } = data;
            if (sectionPair && comparisonResult) {
                this.comparisonResults[sectionPair] = comparisonResult;
                // Re-render traces if they're currently displayed to apply colors
                this.updateTraceColorsForSectionPair(sectionPair);
            }
        });

        // Listen for trace reconciliation events to re-render traces
        this.eventBus.on('traceReconciliation:tracesAdded', (data) => {
            const { sectionPair, targetGraph } = data;
            if (sectionPair) {
                // Clear trace cache for affected sections to force re-render
                this.clearTraceCacheForSectionPair(sectionPair);
                
                // Re-render traces for affected sections
                this.reRenderTracesForSectionPair(sectionPair);
                
                console.log(`[TraceContentRenderer] Re-rendering traces after reconciliation for ${sectionPair} (target: ${targetGraph})`);
            }
        });

        // Listen for comparison update events to update trace colors
        this.eventBus.on('traceComparison:updated', (data) => {
            const { sectionPair, comparisonResult } = data;
            if (sectionPair && comparisonResult) {
                // Update stored comparison results
                this.comparisonResults[sectionPair] = comparisonResult;
                
                // Update trace colors to reflect new comparison state
                this.updateTraceColorsForSectionPair(sectionPair);
            }
        });
    }

    /**
     * Setup event listeners for highlight coordination
     * Listens for external highlight clear events
     */
    setupHighlightListeners() {
        // Listen for highlight clear events from CrossGraphHighlightCoordinator
        this.eventBus.on('crossGraph:highlightsCleared', () => {
            this.clearAllTraceHighlights();
        });
        
        // Listen for step changes to clear highlights and stop auto-play
        this.eventBus.on('stepViewer:stepChanged', () => {
            this.stopAutoPlay();
            this.clearAllTraceHighlights();
        });
        
        // Also listen for step navigation from dropdown
        this.eventBus.on('stepNavigator:stepChanged', () => {
            this.stopAutoPlay();
            this.clearAllTraceHighlights();
        });
    }

    /**
     * Clear all trace row highlights
     */
    clearAllTraceHighlights() {
        this.highlightedTaskKey = null;
        this.highlightedRows.forEach(row => {
            row.classList.remove('trace-row-highlighted');
        });
        this.highlightedRows.clear();
    }

    /**
     * Handle click on trace row for highlighting
     * Uses the pre-existing task mapping for cross-graph highlighting
     * @param {string} sectionId - Section identifier
     * @param {Object} task - Task object with id, alt_id, task properties
     * @param {HTMLElement} row - The table row element
     */
    handleTraceHighlightClick(sectionId, task, row) {
        // Use alt_id for visual row matching, id for task mapping lookup
        const visualKey = task.alt_id || task.id;
        const taskKey = `${sectionId}:${visualKey}`;
        
        // If clicking the same task, toggle off
        if (this.highlightedTaskKey === taskKey) {
            // Clear highlight
            this.clearAllTraceHighlights();
            // Emit event to clear cross-graph highlights
            this.eventBus.emit('trace:highlight:clear');
            return;
        }
        
        // Clear previous highlights
        this.clearAllTraceHighlights();
        
        // Set new highlight
        this.highlightedTaskKey = taskKey;
        row.classList.add('trace-row-highlighted');
        this.highlightedRows.add(row);
        
        // Find and highlight all matching rows (same task in other traces)
        this.highlightMatchingRows(sectionId, visualKey, row);
        
        // Emit event for cross-graph highlighting
        // Use task.id for task mapping lookup (mapping uses id as primary key)
        // For CPEE sections, the task mapping keys are the CPEE internal IDs (a1, a3, etc.)
        const sourceFormat = this.getSectionFormat(sectionId);
        this.eventBus.emit('trace:highlight:task', {
            taskId: task.id,  // Use task.id for mapping lookup
            altId: task.alt_id,  // Also pass altId for fallback matching
            taskLabel: task.task,
            sourceFormat: sourceFormat,
            sectionId: sectionId
        });
    }

    /**
     * Highlight all matching rows with the same alt_id across all traces in a section
     * @param {string} sectionId - Section identifier
     * @param {string} altId - The alt_id to match
     * @param {HTMLElement} clickedRow - The originally clicked row (already highlighted)
     */
    highlightMatchingRows(sectionId, altId, clickedRow) {
        // Find the section container
        const sectionContainer = document.getElementById(sectionId);
        if (!sectionContainer) {
            return;
        }
        
        // Find all trace table rows with matching alt_id
        const allRows = sectionContainer.querySelectorAll('.traces-table tbody tr');
        allRows.forEach(row => {
            if (row === clickedRow) {
                return; // Skip the clicked row, already highlighted
            }
            
            // Check if this row has the same alt_id
            const rowAltId = row.getAttribute('data-task-alt-id');
            if (rowAltId === altId) {
                row.classList.add('trace-row-highlighted');
                this.highlightedRows.add(row);
            }
        });
    }

    /**
     * Get the format identifier for a section
     * @param {string} sectionId - Section identifier
     * @returns {string} Format identifier for cross-graph highlighting
     */
    getSectionFormat(sectionId) {
        // Map section IDs to format identifiers used by CrossGraphHighlightCoordinator
        const formatMap = {
            'input-cpee': 'input-cpee',
            'input-intermediate': 'input-intermediate',
            'output-cpee': 'output-cpee',
            'output-intermediate': 'output-intermediate'
        };
        return formatMap[sectionId] || sectionId;
    }

    /**
     * Toggle auto-play for a trace
     * @param {string} sectionId - Section identifier
     * @param {number} traceNumber - Trace number (1-based)
     * @param {Object} trace - Trace object with path array
     * @param {HTMLElement} playBtn - Play button element
     * @param {HTMLElement} traceElement - The trace item element containing the table
     */
    toggleAutoPlay(sectionId, traceNumber, trace, playBtn, traceElement) {
        const traceKey = `${sectionId}:${traceNumber}`;
        
        // If this trace is already playing, stop it
        if (this.autoPlayState.isPlaying && this.autoPlayState.currentTraceKey === traceKey) {
            this.stopAutoPlay();
            return;
        }
        
        // If a different trace is playing, stop it first
        if (this.autoPlayState.isPlaying) {
            this.stopAutoPlay();
        }
        
        // Start auto-play for this trace
        this.startAutoPlay(sectionId, traceNumber, trace, playBtn, traceElement);
    }

    /**
     * Start auto-play for a trace
     * @param {string} sectionId - Section identifier
     * @param {number} traceNumber - Trace number (1-based)
     * @param {Object} trace - Trace object with path array
     * @param {HTMLElement} playBtn - Play button element
     * @param {HTMLElement} traceElement - The trace item element containing the table
     */
    startAutoPlay(sectionId, traceNumber, trace, playBtn, traceElement) {
        if (!trace.path || trace.path.length === 0) {
            return;
        }
        
        const traceKey = `${sectionId}:${traceNumber}`;
        
        // Update state
        this.autoPlayState = {
            isPlaying: true,
            currentTraceKey: traceKey,
            currentTaskIndex: 0,
            intervalId: null,
            trace: trace,
            sectionId: sectionId,
            playButton: playBtn,
            traceElement: traceElement
        };
        
        // Update button to show pause icon
        playBtn.innerHTML = ICONS.PAUSE_TRACE;
        playBtn.setAttribute('aria-label', 'Pause auto-play');
        playBtn.title = 'Pause auto-play';
        playBtn.classList.add('playing');
        
        // Highlight the first task immediately
        this.playCurrentTask();
        
        // Start interval for subsequent tasks (1 second)
        this.autoPlayState.intervalId = setInterval(() => {
            this.playNextTask();
        }, 1000);
    }

    /**
     * Stop auto-play
     */
    stopAutoPlay() {
        if (this.autoPlayState.intervalId) {
            clearInterval(this.autoPlayState.intervalId);
        }
        
        // Reset button to play icon
        if (this.autoPlayState.playButton) {
            this.autoPlayState.playButton.innerHTML = ICONS.PLAY_TRACE;
            this.autoPlayState.playButton.setAttribute('aria-label', 'Auto-play trace');
            this.autoPlayState.playButton.title = 'Auto-play trace (1 second per task)';
            this.autoPlayState.playButton.classList.remove('playing');
        }
        
        // Reset state
        this.autoPlayState = {
            isPlaying: false,
            currentTraceKey: null,
            currentTaskIndex: 0,
            intervalId: null,
            trace: null,
            sectionId: null,
            playButton: null,
            traceElement: null
        };
    }

    /**
     * Highlight the current task in auto-play
     */
    playCurrentTask() {
        const { trace, sectionId, currentTaskIndex, traceElement } = this.autoPlayState;
        
        if (!trace || !trace.path || currentTaskIndex >= trace.path.length) {
            return;
        }
        
        const task = trace.path[currentTaskIndex];
        
        // Clear previous highlights first
        this.clearAllTraceHighlights();
        this.eventBus.emit('trace:highlight:clear');
        
        // Emit highlight event for cross-graph highlighting
        const sourceFormat = this.getSectionFormat(sectionId);
        this.eventBus.emit('trace:highlight:task', {
            taskId: task.id,
            altId: task.alt_id,
            taskLabel: task.task,
            sourceFormat: sourceFormat,
            sectionId: sectionId
        });
        
        // Highlight only the specific row at the current index in this trace's table
        this.highlightAutoPlayRow(traceElement, currentTaskIndex);
    }

    /**
     * Move to the next task in auto-play
     */
    playNextTask() {
        const { trace } = this.autoPlayState;
        
        if (!trace || !trace.path) {
            this.stopAutoPlay();
            return;
        }
        
        // Increment task index
        this.autoPlayState.currentTaskIndex++;
        
        // Check if we've reached the end
        if (this.autoPlayState.currentTaskIndex >= trace.path.length) {
            this.stopAutoPlay();
            return;
        }
        
        // Highlight the current task
        this.playCurrentTask();
    }

    /**
     * Highlight only the specific row at the given index in the trace's table
     * @param {HTMLElement} traceElement - The trace item element containing the table
     * @param {number} rowIndex - The index of the row to highlight (0-based)
     */
    highlightAutoPlayRow(traceElement, rowIndex) {
        if (!traceElement) {
            return;
        }
        
        // Find all rows in this specific trace's table
        const rows = traceElement.querySelectorAll('.traces-table tbody tr');
        
        if (rowIndex >= 0 && rowIndex < rows.length) {
            const row = rows[rowIndex];
            row.classList.add('trace-row-highlighted');
            this.highlightedRows.add(row);
            
            // Update highlightedTaskKey for consistency
            const altId = row.getAttribute('data-task-alt-id');
            this.highlightedTaskKey = `autoplay:${rowIndex}:${altId}`;
        }
    }

    /**
     * Clear trace cache for a section pair
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     */
    clearTraceCacheForSectionPair(sectionPair) {
        const sectionIds = sectionPair === 'input' 
            ? ['input-cpee', 'input-intermediate']
            : ['output-cpee', 'output-intermediate'];

        // Clear cache entries for these sections
        for (const key of this.traceCache.keys()) {
            for (const sectionId of sectionIds) {
                if (key.startsWith(sectionId)) {
                    this.traceCache.delete(key);
                }
            }
        }
    }

    /**
     * Re-render traces for a section pair after reconciliation
     * Gets updated traces from step and re-renders them
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     */
    reRenderTracesForSectionPair(sectionPair) {
        const sectionIds = sectionPair === 'input' 
            ? ['input-cpee', 'input-intermediate']
            : ['output-cpee', 'output-intermediate'];

        for (const sectionId of sectionIds) {
            const container = document.getElementById(sectionId);
            if (!container) {
                continue;
            }

            const tracesContainer = container.querySelector('[data-content-type="traces"]');
            if (!tracesContainer) {
                continue;
            }

            // Check if traces view is currently active
            if (tracesContainer.style.display === 'none') {
                continue;
            }

            // Get the current step from the event to access updated traces
            // We emit an event to request re-render from the coordinator
            this.eventBus.emit('traceContentRenderer:requestReRender', {
                sectionId,
                sectionPair,
                timestamp: new Date().toISOString()
            }, { silent: true });
        }
    }

    /**
     * Update trace colors for a section pair after comparison results are available
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     */
    updateTraceColorsForSectionPair(sectionPair) {
        const comparisonResult = this.comparisonResults[sectionPair];

        // Determine which sections belong to this pair
        const sectionIds = sectionPair === 'input' 
            ? ['input-cpee', 'input-intermediate']
            : ['output-cpee', 'output-intermediate'];

        sectionIds.forEach(sectionId => {
            const container = document.getElementById(sectionId);
            if (!container) {
                return;
            }

            const tracesContainer = container.querySelector('[data-content-type="traces"]');
            if (!tracesContainer) {
                return;
            }

            const traceItems = tracesContainer.querySelectorAll('.trace-item');
            traceItems.forEach((traceItem, index) => {
                const traceNumberEl = traceItem.querySelector('.trace-number');
                if (!traceNumberEl) {
                    return;
                }

                // Determine if this is a CPEE or Mermaid section
                const isCPEE = sectionId.includes('cpee');
                const traceIndex = index; // 0-based

                // Check if this trace is reconciled (from the trace data)
                // We need to get the trace from the cache or step
                const cacheKey = Array.from(this.traceCache.keys()).find(k => k.startsWith(sectionId));
                const cachedTraces = cacheKey ? this.traceCache.get(cacheKey) : null;
                const trace = cachedTraces?.[traceIndex];
                const isReconciled = trace?.isReconciled === true;

                // Determine trace status from comparison result
                let isMatching = false;
                let isProblematic = false;

                if (comparisonResult) {
                    if (isCPEE) {
                        // For CPEE traces, check details array
                        const detail = comparisonResult.details?.[traceIndex];
                        if (detail) {
                            isMatching = detail.match === true;
                            isProblematic = detail.match === false;
                        }
                    } else {
                        // For Mermaid traces, check if it's in uniqueMermaidTraces (problematic)
                        const isUnique = comparisonResult.uniqueMermaidTraces?.some(
                            uniqueTrace => uniqueTrace.traceIndex === traceIndex
                        );
                        if (isUnique) {
                            isProblematic = true;
                        } else {
                            // Mermaid trace is matching if it was matched by a CPEE trace
                            // Check if any detail has this Mermaid trace index as its match
                            isMatching = comparisonResult.details?.some(
                                detail => detail.mermaidTraceIndex === traceIndex && detail.match === true
                            ) || false;
                        }
                    }
                }

                // Apply color classes for matching, problematic, and reconciled traces
                traceNumberEl.classList.remove(
                    'trace-number--matching', 
                    'trace-number--problematic',
                    'trace-number--reconciled'
                );

                // Reconciled traces get special styling (warning colors)
                if (isReconciled) {
                    traceNumberEl.classList.add('trace-number--reconciled');
                } else if (isMatching) {
                    traceNumberEl.classList.add('trace-number--matching');
                } else if (isProblematic) {
                    traceNumberEl.classList.add('trace-number--problematic');
                }
            });
        });
    }

    /**
     * Get section pair identifier for a section
     * @param {string} sectionId - Section identifier
     * @returns {string|null} Section pair identifier ('input' or 'output') or null
     */
    getSectionPair(sectionId) {
        if (sectionId === 'input-cpee' || sectionId === 'input-intermediate') {
            return 'input';
        }
        if (sectionId === 'output-cpee' || sectionId === 'output-intermediate') {
            return 'output';
        }
        return null;
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
        
        // Hide action bar for this section
        const sectionId = container.closest('[id]')?.id;
        if (sectionId && this.traceActionBars.has(sectionId)) {
            const actionBar = this.traceActionBars.get(sectionId);
            if (actionBar) {
                actionBar.hide();
            }
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.clearTraceCache();
        this.traceActionBars.clear();
        this.traceCopyButtons.clear();
    }
}

