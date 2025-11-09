/**
 * TraceRenderer Component
 * Renders execution traces in an organized, interactive list format
 * Displays trace paths, metadata, and supports filtering/search
 * 
 * Responsibilities:
 * - Render traces as expandable list items
 * - Display trace paths as readable sequences
 * - Highlight start and end nodes
 * - Show trace type indicators
 * - Support trace filtering and search
 */

import { Trace } from '../../models/Trace.js';
import { ICONS } from '../../assets/icons.js';
import { serviceFactory } from '../../core/ServiceFactory.js';

export class TraceRenderer {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
    }

    /**
     * Render traces into a container element
     * @param {Trace[]|Array} traces - Array of Trace objects or plain trace arrays
     * @param {HTMLElement} containerElement - Container to render into
     * @param {Object} options - Rendering options
     * @param {boolean} options.showLabels - Show task labels instead of IDs (default: true)
     * @param {boolean} options.expandable - Make trace details expandable (default: true)
     * @param {boolean} options.highlightStartEnd - Highlight start and end nodes (default: true)
     */
    renderTraces(traces, containerElement, options = {}) {
        console.log('[TraceRenderer] Rendering traces:', traces?.length || 0);
        
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
            console.log('[TraceRenderer] No traces to render');
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
        console.log(`[TraceRenderer] Rendered ${traceObjects.length} traces`);
    }

    /**
     * Create a single trace item element
     * @param {Trace} trace - Trace object
     * @param {number} traceNumber - Trace number (1-based)
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Trace item element
     */
    createTraceItem(trace, traceNumber, options = {}) {
        const {
            showLabels = true,
            expandable = true,
            highlightStartEnd = true
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

        // Trace length badge removed - now shown on the right in parentheses

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
        // CSS will handle truncation only when container width is too narrow
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
        // This ensures Prism.js tokenizes the JSON so our CSS can target specific tokens
        try {
            const syntaxService = serviceFactory.get('SyntaxHighlightingService');
            if (syntaxService && typeof syntaxService.highlightCodeBlocks === 'function') {
                // Use the service for consistent highlighting
                syntaxService.highlightCodeBlocks(traceDetailsContent);
                // Mark task string tokens after highlighting (use setTimeout to ensure DOM is updated)
                setTimeout(() => {
                    this.markTaskStringTokens(traceDetailsCode);
                }, 0);
            } else if (window.Prism && typeof window.Prism.highlightElement === 'function') {
                // Fallback to direct Prism highlighting if service not available
                window.Prism.highlightElement(traceDetailsCode);
                // Mark task string tokens after highlighting
                setTimeout(() => {
                    this.markTaskStringTokens(traceDetailsCode);
                }, 0);
            }
        } catch (error) {
            // Fallback to direct Prism highlighting if service fails
            if (window.Prism && typeof window.Prism.highlightElement === 'function') {
                try {
                    window.Prism.highlightElement(traceDetailsCode);
                    // Mark task string tokens after highlighting
                    setTimeout(() => {
                        this.markTaskStringTokens(traceDetailsCode);
                    }, 0);
                } catch (prismError) {
                    console.warn('[TraceRenderer] Failed to highlight trace JSON:', prismError);
                }
            } else {
                console.warn('[TraceRenderer] Syntax highlighting not available:', error);
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
     * Format trace path as readable string using alt_ids
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

        const parts = trace.path.map(task => {
            return task.alt_id || task.id || '?';
        });

        let pathStr = parts.join(' → ');
        
        if (maxLength && pathStr.length > maxLength) {
            pathStr = pathStr.substring(0, maxLength - 3) + '...';
        }

        return pathStr;
    }

    /**
     * Format trace path as readable string (legacy method for compatibility)
     * @param {Trace} trace - Trace object
     * @param {Object} options - Formatting options
     * @param {boolean} options.showLabels - Show task labels
     * @param {number} options.maxLength - Maximum length for preview
     * @returns {string} Formatted path string
     */
    formatTracePath(trace, options = {}) {
        const { showLabels = true, maxLength = null } = options;
        
        if (trace.path.length === 0) {
            return '(empty trace)';
        }

        const parts = trace.path.map(task => {
            if (showLabels && task.task) {
                return task.task;
            }
            return task.id || task.alt_id || '?';
        });

        let pathStr = parts.join(' → ');
        
        if (maxLength && pathStr.length > maxLength) {
            pathStr = pathStr.substring(0, maxLength - 3) + '...';
        }

        return pathStr;
    }

    /**
     * Format trace as JSON-like string for details view
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
     * Mark task string tokens in JSON for CSS styling
     * Finds string tokens that come after a property token with text "task"
     * @param {HTMLElement} codeElement - Code element with Prism tokens
     */
    markTaskStringTokens(codeElement) {
        if (!codeElement) {
            return;
        }

        // Find all property tokens
        const propertyTokens = codeElement.querySelectorAll('.token.property');
        
        propertyTokens.forEach(propertyToken => {
            // Check if this property token contains "task"
            if (propertyToken.textContent.trim() === '"task"') {
                // Find the next string token after this property
                // Look for: property -> operator -> string
                let current = propertyToken.nextSibling;
                let foundOperator = false;
                
                // Skip whitespace and find operator
                while (current) {
                    if (current.nodeType === Node.ELEMENT_NODE) {
                        if (current.classList.contains('token') && current.classList.contains('operator')) {
                            foundOperator = true;
                            // Now find the string token after the operator
                            current = current.nextSibling;
                            break;
                        }
                    }
                    current = current.nextSibling;
                }
                
                // Find string token after operator
                if (foundOperator) {
                    while (current) {
                        if (current.nodeType === Node.ELEMENT_NODE) {
                            if (current.classList.contains('token') && current.classList.contains('string')) {
                                // Mark this string token as a task string
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
     * Create path elements with highlighting
     * @param {Trace} trace - Trace object
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with path elements
     */
    createPathElements(trace, options = {}) {
        const { showLabels = true, highlightStartEnd = true } = options;
        
        const container = this.domRegistry.createElement('div', {
            className: 'trace-path-container'
        });

        trace.path.forEach((task, index) => {
            const isStart = index === 0;
            const isEnd = index === trace.path.length - 1;
            
            const taskEl = this.domRegistry.createElement('span', {
                className: `trace-task ${isStart ? 'trace-task-start' : ''} ${isEnd ? 'trace-task-end' : ''}`
            });

            // Task label or ID
            const taskText = showLabels && task.task ? task.task : (task.id || task.alt_id || '?');
            taskEl.textContent = taskText;

            // Add tooltip with full info
            if (task.id || task.alt_id) {
                taskEl.title = `ID: ${task.id || 'N/A'}, Alt ID: ${task.alt_id || 'N/A'}`;
            }

            container.appendChild(taskEl);

            // Add arrow separator (except after last task)
            if (index < trace.path.length - 1) {
                const arrow = this.domRegistry.createElement('span', {
                    className: 'trace-arrow',
                    textContent: ' → '
                });
                container.appendChild(arrow);
            }
        });

        return container;
    }

    /**
     * Create metadata display element
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
     * Get human-readable label for trace type
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
     * Filter traces by search term
     * @param {Trace[]} traces - Array of traces
     * @param {string} searchTerm - Search term
     * @returns {Trace[]} Filtered traces
     */
    filterTraces(traces, searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return traces;
        }

        const term = searchTerm.toLowerCase().trim();
        
        return traces.filter(trace => {
            // Search in task IDs
            const taskIds = trace.path.map(task => (task.id || '').toLowerCase());
            if (taskIds.some(id => id.includes(term))) {
                return true;
            }

            // Search in task labels
            const taskLabels = trace.path.map(task => (task.task || '').toLowerCase());
            if (taskLabels.some(label => label.includes(term))) {
                return true;
            }

            // Search in trace type
            if ((trace.type || '').toLowerCase().includes(term)) {
                return true;
            }

            return false;
        });
    }

    /**
     * Filter traces by type
     * @param {Trace[]} traces - Array of traces
     * @param {string} type - Trace type to filter by
     * @returns {Trace[]} Filtered traces
     */
    filterByType(traces, type) {
        if (!type || type === 'all') {
            return traces;
        }
        return traces.filter(trace => trace.type === type);
    }

    /**
     * Filter traces by length range
     * @param {Trace[]} traces - Array of traces
     * @param {number} minLength - Minimum length
     * @param {number} maxLength - Maximum length
     * @returns {Trace[]} Filtered traces
     */
    filterByLength(traces, minLength = 0, maxLength = Infinity) {
        return traces.filter(trace => {
            const length = trace.length;
            return length >= minLength && length <= maxLength;
        });
    }
}

