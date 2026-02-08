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
 * 
 * Note: Auto-play and highlighting are delegated to TracePlaybackCoordinator
 */

import { ActionBar } from '../ui/ActionBar.js';
import { Trace } from '../../models/Trace.js';
import { TraceDisplay } from '../ui/TraceDisplay.js';
import { CPEETraceCalculator } from '../../utils/trace/CPEETraceCalculator.js';
import { MermaidTraceCalculator } from '../../utils/trace/MermaidTraceCalculator.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { ICONS } from '../../assets/icons.js';
import { TracePlaybackCoordinator } from '../coordinators/TracePlaybackCoordinator.js';
import { TraceFilter } from '../ui/TraceFilter.js';

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
        
        // Trace filters per section
        this.traceFilters = new Map();
        
        // Copy buttons for traces per section (legacy, for backwards compatibility)
        this.traceCopyButtons = new Map();
        
        // Store comparison results per section pair for trace coloring
        this.comparisonResults = {
            input: null,
            output: null
        };
        
        // Get singleton instance of TracePlaybackCoordinator for auto-play and highlighting
        this.playbackCoordinator = TracePlaybackCoordinator.getInstance(this.eventBus);
        
        // Listen for comparison events to update trace colors
        this.setupComparisonListeners();
        
        // Listen for step/instance changes to clear filters
        this.setupFilterClearListeners();
    }

    /**
     * Setup listeners to clear trace filters on step/instance change
     */
    setupFilterClearListeners() {
        // Clear filters when step changes
        this.eventBus.on('stepViewer:stepChanged', () => {
            this.clearAllTraceFilters();
        });
        
        // Clear filters when instance changes
        this.eventBus.on('sidebar:instanceSelected', () => {
            this.clearAllTraceFilters();
        });
    }

    /**
     * Clear all trace filters across all sections
     */
    clearAllTraceFilters() {
        this.traceFilters.forEach((traceFilter) => {
            traceFilter.clearAllFilters();
        });
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
            this.playbackCoordinator.toggleAutoPlay(sectionId, traceNumber, trace, playBtn, traceItem);
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
        
        // Track occurrence count per alt_id within this trace
        const occurrenceCount = new Map();
        
        trace.path.forEach((task, taskIndex) => {
            const altId = task.alt_id || task.id || '';
            
            // Calculate occurrence index for this alt_id (1-based)
            const currentOccurrence = (occurrenceCount.get(altId) || 0) + 1;
            occurrenceCount.set(altId, currentOccurrence);
            
            const row = this.domRegistry.createElement('tr', {
                className: 'trace-row-clickable',
                title: 'Click to highlight this task across all graphs'
            });
            
            // Store task alt_id and occurrence index on row for matching highlights
            row.setAttribute('data-task-alt-id', altId);
            row.setAttribute('data-task-index', taskIndex);
            row.setAttribute('data-occurrence-index', currentOccurrence);
            
            // Add click handler to entire row for highlighting (delegated to coordinator)
            row.addEventListener('click', () => {
                this.playbackCoordinator.handleRowClick(sectionId, task, row, currentOccurrence);
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
            // Create new action bar with showSearch: false and showSpeedControl: true
            // Get initial speed from playback coordinator (global setting)
            const initialSpeed = this.playbackCoordinator.getPlaybackSpeed();
            actionBar = new ActionBar(this.domRegistry, null, sectionId, { 
                showSearch: false,
                showSpeedControl: true,
                initialSpeed: initialSpeed,
                onSpeedChange: (speedMs) => {
                    this.playbackCoordinator.setPlaybackSpeed(speedMs);
                }
            });
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
            
            // Create or get trace filter
            let traceFilter = this.traceFilters.get(sectionId);
            if (!traceFilter) {
                traceFilter = new TraceFilter(this.domRegistry, sectionId);
                traceFilter.updateAutocompleteData(traces);
                traceFilter.setOnFilterChange((filters) => {
                    this.applyTraceFilters(sectionId, filters);
                });
                this.traceFilters.set(sectionId, traceFilter);
            } else {
                // Update autocomplete data with current traces
                traceFilter.updateAutocompleteData(traces);
            }
            
            // Add filter to action-bar-left in action-bar-row (left of action-bar-right)
            let actionBarLeft = actionBarRow.querySelector('.action-bar-left');
            if (!actionBarLeft) {
                // Create action-bar-left if it doesn't exist
                actionBarLeft = document.createElement('div');
                actionBarLeft.className = 'action-bar-left';
                // Insert before action-bar-right
                const actionBarRight = actionBarRow.querySelector('.action-bar-right');
                if (actionBarRight) {
                    actionBarRow.insertBefore(actionBarLeft, actionBarRight);
                } else {
                    actionBarRow.appendChild(actionBarLeft);
                }
            }
            
            // Show action-bar-left
            actionBarLeft.style.display = 'flex';
            
            // Remove existing filter if present
            const existingFilter = actionBarLeft.querySelector('.trace-filter-container');
            if (existingFilter) {
                existingFilter.remove();
            }
            traceFilter.attachToContainer(actionBarLeft);
            
            // Reapply any existing filters (for when switching back to traces view)
            if (traceFilter.hasActiveFilters()) {
                traceFilter.applyFilters();
            }
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
     * Apply trace filters and show/hide traces based on filter criteria
     * @param {string} sectionId - Section identifier
     * @param {Object} filters - Filter object with altId, id, taskLabel, status
     */
    applyTraceFilters(sectionId, filters) {
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) {
            console.warn('[TraceContentRenderer] Section element not found:', sectionId);
            return;
        }
        
        // Find traces container (data-content-type="traces")
        const tracesContainer = sectionElement.querySelector('[data-content-type="traces"]');
        if (!tracesContainer) {
            console.warn('[TraceContentRenderer] Traces container not found in section:', sectionId);
            return;
        }
        
        // Find trace items - they are in a trace-list container
        const traceList = tracesContainer.querySelector('.trace-list');
        if (!traceList) {
            console.warn('[TraceContentRenderer] Trace list not found in section:', sectionId);
            return;
        }
        
        const traceItems = traceList.querySelectorAll('.trace-item');
        
        if (traceItems.length === 0) {
            console.warn('[TraceContentRenderer] No trace items found in section:', sectionId);
            return;
        }
        
        // Check if any filters are non-empty (after trimming)
        const altIdFilter = filters.altId?.trim() || '';
        const idFilter = filters.id?.trim() || '';
        const taskLabelFilter = filters.taskLabel?.trim() || '';
        const statusFilter = filters.status?.trim() || '';
        const hasFilters = altIdFilter || idFilter || taskLabelFilter || statusFilter;
        
        // Get traces from cache - cache key is `${sectionId}-${stepNumber}`
        // Find the cache key that starts with this sectionId
        let traces = null;
        const cacheKey = Array.from(this.traceCache.keys()).find(key => key.startsWith(`${sectionId}-`));
        if (cacheKey) {
            traces = this.traceCache.get(cacheKey);
        }
        
        if (!traces || traces.length === 0) {
            console.warn('[TraceContentRenderer] No traces in cache for section:', sectionId, 'cacheKey:', cacheKey, 'available keys:', Array.from(this.traceCache.keys()));
            // If no traces in cache, show all items
            traceItems.forEach(item => {
                item.style.display = '';
            });
            return;
        }
        
        console.log('[TraceContentRenderer] Applying filters:', { filters, traceCount: traces.length, itemCount: traceItems.length });
        
        if (!hasFilters) {
            // No filters - show all traces
            traceItems.forEach(item => {
                item.style.display = '';
            });
            return;
        }
        
        traceItems.forEach((item, index) => {
            if (index >= traces.length) {
                // Items without corresponding trace - hide them
                item.style.display = 'none';
                return;
            }
            
            const trace = traces[index];
            const matches = this.traceMatchesFilters(trace, filters, sectionId, index);
            
            if (matches) {
                // Show matching traces
                item.style.display = '';
            } else {
                // Hide non-matching traces
                item.style.display = 'none';
            }
        });
    }

    /**
     * Get trace status based on comparison result
     * @param {string} sectionId - Section identifier
     * @param {number} traceIndex - Trace index
     * @param {Object} trace - Trace object (optional, for reconciled check)
     * @returns {string|null} Trace status: 'MATCHING', 'UNIQUE', 'RECONCILED', or null
     */
    getTraceStatus(sectionId, traceIndex, trace = null) {
        // Determine section pair from sectionId
        let sectionPair = null;
        if (sectionId.includes('input')) {
            sectionPair = 'input';
        } else if (sectionId.includes('output')) {
            sectionPair = 'output';
        }
        
        if (!sectionPair) {
            return null;
        }
        
        const comparisonResult = this.comparisonResults[sectionPair];
        if (!comparisonResult) {
            return null;
        }
        
        // Check if trace is reconciled
        if (trace?.isReconciled === true) {
            return 'RECONCILED';
        }
        
        // Determine if this is a CPEE or Mermaid section
        const isCPEE = sectionId.includes('cpee');
        const isMermaid = sectionId.includes('intermediate');
        
        if (isCPEE) {
            // For CPEE traces, check details array
            const detail = comparisonResult.details?.[traceIndex];
            if (detail) {
                if (detail.match === true) {
                    return 'MATCHING';
                } else if (detail.match === false) {
                    return 'UNIQUE';
                }
            }
        } else if (isMermaid) {
            // For Mermaid traces, check if it's in uniqueMermaidTraces
            const isUnique = comparisonResult.uniqueMermaidTraces?.some(
                uniqueTrace => uniqueTrace.traceIndex === traceIndex
            );
            if (isUnique) {
                return 'UNIQUE';
            } else {
                // Mermaid trace is matching if it was matched by a CPEE trace
                const isMatching = comparisonResult.details?.some(
                    detail => detail.mermaidTraceIndex === traceIndex && detail.match === true
                );
                if (isMatching) {
                    return 'MATCHING';
                }
            }
        }
        
        return null;
    }

    /**
     * Check if a trace matches the filters (AND logic)
     * Empty filters are ignored (treated as always true)
     * @param {Object} trace - Trace object
     * @param {Object} filters - Filter object with altId, id, taskLabel, status
     * @param {string} sectionId - Section identifier (for status check)
     * @param {number} traceIndex - Trace index (for status check)
     * @returns {boolean} True if trace matches all non-empty filters
     */
    traceMatchesFilters(trace, filters, sectionId = null, traceIndex = -1) {
        if (!trace.path || trace.path.length === 0) {
            return false;
        }
        
        const altIdFilter = filters.altId?.trim();
        const idFilter = filters.id?.trim();
        const taskLabelFilter = filters.taskLabel?.trim();
        const statusFilter = filters.status?.trim();
        
        // If no filters, return false (shouldn't happen, but safety check)
        if (!altIdFilter && !idFilter && !taskLabelFilter && !statusFilter) {
            return false;
        }
        
        // AND logic: trace matches if ALL non-empty filters match at least one task in the trace
        // Empty filters are ignored (treated as always true)
        
        let altIdMatches = true; // Default to true (ignored if filter is empty)
        let idMatches = true; // Default to true (ignored if filter is empty)
        let taskLabelMatches = true; // Default to true (ignored if filter is empty)
        let statusMatches = true; // Default to true (ignored if filter is empty)
        
        // Check Alt ID filter (exact match)
        if (altIdFilter) {
            altIdMatches = false; // Must find a match
            for (const task of trace.path) {
                if (task.alt_id && task.alt_id === altIdFilter) {
                    altIdMatches = true;
                    break;
                }
            }
        }
        
        // Check ID filter (exact match)
        if (idFilter) {
            idMatches = false; // Must find a match
            for (const task of trace.path) {
                if (task.id && task.id === idFilter) {
                    idMatches = true;
                    break;
                }
            }
        }
        
        // Check Task Label filter (partial match, case-insensitive)
        if (taskLabelFilter) {
            taskLabelMatches = false; // Must find a match
            const filterLower = taskLabelFilter.toLowerCase();
            for (const task of trace.path) {
                if (task.task) {
                    const taskLabelLower = task.task.toLowerCase();
                    if (taskLabelLower.includes(filterLower)) {
                        taskLabelMatches = true;
                        break;
                    }
                }
            }
        }
        
        // Check Status filter
        if (statusFilter && sectionId !== null && traceIndex >= 0) {
            const traceStatus = this.getTraceStatus(sectionId, traceIndex, trace);
            statusMatches = traceStatus === statusFilter;
        }
        
        // Trace matches if ALL non-empty filters matched
        return altIdMatches && idMatches && taskLabelMatches && statusMatches;
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
        this.traceFilters.clear();
        this.traceCopyButtons.clear();
    }
}

