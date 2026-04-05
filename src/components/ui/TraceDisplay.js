/**
 * TraceDisplay Component
 * Thin UI component for displaying execution traces in a scrollable container
 * 
 * Responsibilities:
 * - Create trace display container with scrolling
 * - Manage trace list display state
 */

export class TraceDisplay {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        this.container = null;
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
     * Clear all traces from display
     */
    clear() {
        if (this.container) {
            const traceListWrapper = this.container.querySelector('.trace-list-wrapper');
            if (traceListWrapper) {
                traceListWrapper.innerHTML = '';
            }
        }
    }

    /**
     * Get the container element
     * @returns {HTMLElement|null} Container element
     */
    getContainer() {
        return this.container;
    }

    /**
     * Destroy the trace display and clean up
     */
    destroy() {        
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
        }
    }
}

