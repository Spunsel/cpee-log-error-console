/**
 * TraceDisplay Component
 * Thin UI component for displaying execution traces in a scrollable container
 * Wraps TraceContentRenderer and provides container management
 * 
 * Responsibilities:
 * - Create trace display container with scrolling
 * - Manage trace list display state
 * - Coordinate with TraceContentRenderer for rendering
 * - Handle trace expansion/collapse state
 */

export class TraceDisplay {
    constructor(domRegistry = null, traceContentRenderer = null) {
        this.domRegistry = domRegistry;
        this.traceContentRenderer = traceContentRenderer;
        this.container = null;
        this.currentTraces = [];
    }

    /**
     * Create trace display container
     * @param {string} containerId - Optional container ID
     * @returns {HTMLElement} Container element
     */
    createContainer(containerId = null) {        
        const container = this.domRegistry.createElement('div', {
            className: 'trace-display-container',
            id: containerId || undefined
        });

        // Create scrollable trace list wrapper
        const traceListWrapper = this.domRegistry.createElement('div', {
            className: 'trace-list-wrapper'
        });

        container.appendChild(traceListWrapper);
        this.container = container;
        
        return container;
    }

    /**
     * Render traces into the container
     * @param {Trace[]|Array} traces - Array of Trace objects or plain trace arrays
     * @param {Object} options - Rendering options
     * @param {boolean} options.showLabels - Show task labels instead of IDs (default: false, shows alt_ids)
     * @param {boolean} options.expandable - Make trace details expandable (default: true)
     * @param {boolean} options.highlightStartEnd - Highlight start and end nodes (default: true)
     */
    renderTraces(traces, options = {}) {
        console.log('[TraceDisplay] Rendering traces:', traces?.length || 0);
        
        if (!this.container) {
            console.warn('[TraceDisplay] Container not created, creating default container');
            this.createContainer();
        }

        // Store current traces
        this.currentTraces = traces || [];

        // Find or create trace list wrapper
        let traceListWrapper = this.container.querySelector('.trace-list-wrapper');
        if (!traceListWrapper) {
            traceListWrapper = this.domRegistry.createElement('div', {
                className: 'trace-list-wrapper'
            });
            this.container.appendChild(traceListWrapper);
        }

        // Clear existing content
        traceListWrapper.innerHTML = '';

        // Render traces using TraceContentRenderer (merged from TraceRenderer)
        if (this.traceContentRenderer && typeof this.traceContentRenderer.renderTracesIntoContainer === 'function') {
            this.traceContentRenderer.renderTracesIntoContainer(traces, traceListWrapper, options);
        } else {
            console.warn('[TraceDisplay] TraceContentRenderer not available, cannot render traces');
        }
    }

    /**
     * Clear all traces from display
     */
    clear() {
        if (this.container) {
            const traceListWrapper = this.container.querySelector('.trace-list-wrapper');
            if (traceListWrapper) {
                traceListWrapper.innerHTML = '';
            }
        }
        
        this.currentTraces = [];
    }

    /**
     * Get the container element
     * @returns {HTMLElement|null} Container element
     */
    getContainer() {
        return this.container;
    }

    /**
     * Update trace display with new traces
     * @param {Trace[]|Array} traces - New traces to display
     * @param {Object} options - Rendering options
     */
    update(traces, options = {}) {
        this.renderTraces(traces, options);
    }

    /**
     * Expand all trace details
     */
    expandAll() {
        if (!this.container) {
            return;
        }
        
        const expandButtons = this.container.querySelectorAll('.trace-expand-btn');
        expandButtons.forEach(btn => {
            const isExpanded = btn.getAttribute('aria-expanded') === 'true';
            if (!isExpanded) {
                btn.click();
            }
        });
    }

    /**
     * Collapse all trace details
     */
    collapseAll() {        
        if (!this.container) {
            return;
        }
        
        const expandButtons = this.container.querySelectorAll('.trace-expand-btn');
        expandButtons.forEach(btn => {
            const isExpanded = btn.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                btn.click();
            }
        });
    }

    /**
     * Get current traces
     * @returns {Array} Current traces
     */
    getTraces() {
        return this.currentTraces;
    }

    /**
     * Get trace count
     * @returns {number} Number of traces
     */
    getTraceCount() {
        return this.currentTraces.length;
    }

    /**
     * Destroy the trace display and clean up
     */
    destroy() {        
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
        }
        
        this.currentTraces = [];
    }
}

