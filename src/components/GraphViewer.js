/**
 * Graph Viewer Component
 * Renders CPEE process graphs using the cpee-layout library
 */

import { DOMUtils } from '../utils/DOMUtils.js';
import { GraphService } from '../services/GraphService.js';

export class GraphViewer {
    constructor() {
        this.layoutEngine = null;
        this.currentGraph = null;
        this.containers = new Map();
        
        // Load CSS if not already loaded
        this.loadCSS();
    }
    
    /**
     * Load cpee-layout CSS
     */
    loadCSS() {
        const existingLink = document.querySelector('link[href*="wfadaptor.css"]');
        if (!existingLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'src/libs/cpee-layout/wfadaptor.css';
            document.head.appendChild(link);
        }
    }
    
    /**
     * Render CPEE XML as a graph in the specified container
     * @param {string} containerId - ID of the container element
     * @param {string} cpeeXML - CPEE XML string to visualize
     * @param {string} title - Title for the graph
     * @param {Object} options - Rendering options
     */
    async renderCPEEGraph(containerId, cpeeXML, title = 'CPEE Process', options = {}) {
        const container = DOMUtils.getElement(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }
        
        try {
            // Convert CPEE XML to graph format
            const graph = GraphService.convertCPEEToGraph(cpeeXML);
            
            // Create graph container structure
            this.createGraphContainer(container, title, options);
            
            // Get the actual SVG container
            const svgContainer = container.querySelector('.cpee-svg-container');
            if (!svgContainer) {
                throw new Error('SVG container not created');
            }
            
            // Load and initialize the layout engine
            await this.loadLayoutEngine();
            
            // Create new layout engine instance for this container
            const layoutEngine = new window.CPEELayoutEngine(svgContainer, {
                theme: options.theme || 'default',
                autoLayout: options.autoLayout !== false,
                interactive: options.interactive !== false,
                nodeSpacing: options.nodeSpacing || 120,
                levelSpacing: options.levelSpacing || 100
            });
            
            // Render the graph
            layoutEngine.render(graph);
            
            // Store references
            this.containers.set(containerId, {
                container,
                layoutEngine,
                graph,
                title
            });
            
            // Set up event listeners
            this.setupEventListeners(containerId, svgContainer);
            
            console.log(`Graph rendered in ${containerId}:`, graph);
            
        } catch (error) {
            console.error(`Error rendering graph in ${containerId}:`, error);
            this.renderError(container, `Failed to render graph: ${error.message}`, title);
        }
    }
    
    /**
     * Create the graph container structure
     * @param {Element} container - Parent container
     * @param {string} title - Graph title
     * @param {Object} options - Rendering options
     */
    createGraphContainer(container, title, options) {
        // Clear existing content
        container.innerHTML = '';
        
        // Create container structure
        const graphContainer = document.createElement('div');
        graphContainer.className = 'cpee-graph-container';
        
        // Add header with title and controls
        const header = document.createElement('div');
        header.className = 'cpee-graph-header';
        
        const titleElement = document.createElement('h4');
        titleElement.className = 'cpee-graph-title';
        titleElement.textContent = title;
        
        const controls = document.createElement('div');
        controls.className = 'cpee-graph-controls';
        
        // Add control buttons
        if (options.showControls !== false) {
            const buttons = [
                { id: 'zoom-in', text: '🔍+', title: 'Zoom In' },
                { id: 'zoom-out', text: '🔍−', title: 'Zoom Out' },
                { id: 'reset-zoom', text: '⌂', title: 'Reset View' },
                { id: 'export-svg', text: '💾', title: 'Export SVG' }
            ];
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = 'cpee-graph-btn';
                button.textContent = btn.text;
                button.title = btn.title;
                button.dataset.action = btn.id;
                controls.appendChild(button);
            });
        }
        
        header.appendChild(titleElement);
        header.appendChild(controls);
        
        // Create SVG container
        const svgContainer = document.createElement('div');
        svgContainer.className = 'cpee-svg-container';
        svgContainer.style.minHeight = '300px';
        
        // Assemble structure
        graphContainer.appendChild(header);
        graphContainer.appendChild(svgContainer);
        container.appendChild(graphContainer);
    }
    
    /**
     * Load the cpee-layout engine
     */
    async loadLayoutEngine() {
        if (window.CPEELayoutEngine) {
            return; // Already loaded
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'src/libs/cpee-layout/wfadaptor.js';
            script.onload = () => {
                if (window.CPEELayoutEngine) {
                    resolve();
                } else {
                    reject(new Error('CPEELayoutEngine not available after loading script'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load cpee-layout library'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Set up event listeners for graph interactions
     * @param {string} containerId - Container ID
     * @param {Element} svgContainer - SVG container element
     */
    setupEventListeners(containerId, svgContainer) {
        const containerData = this.containers.get(containerId);
        if (!containerData) return;
        
        const container = containerData.container;
        const layoutEngine = containerData.layoutEngine;
        
        // Control button handlers
        container.addEventListener('click', (event) => {
            const button = event.target.closest('.cpee-graph-btn');
            if (!button) return;
            
            const action = button.dataset.action;
            switch (action) {
                case 'zoom-in':
                    layoutEngine.zoomIn();
                    break;
                case 'zoom-out':
                    layoutEngine.zoomOut();
                    break;
                case 'reset-zoom':
                    layoutEngine.resetZoom();
                    break;
                case 'export-svg':
                    this.exportSVG(containerId);
                    break;
            }
        });
        
        // Node click handler
        svgContainer.addEventListener('nodeClick', (event) => {
            console.log('Node clicked in graph:', event.detail.node);
            
            // Emit custom event for external listeners
            container.dispatchEvent(new CustomEvent('graphNodeClick', {
                detail: {
                    containerId,
                    node: event.detail.node,
                    graph: containerData.graph
                }
            }));
        });
    }
    
    /**
     * Render error message in container
     * @param {Element} container - Container element
     * @param {string} errorMessage - Error message
     * @param {string} title - Graph title
     */
    renderError(container, errorMessage, title) {
        container.innerHTML = `
            <div class="cpee-graph-container">
                <div class="cpee-graph-header">
                    <h4 class="cpee-graph-title">${DOMUtils.escapeHtml(title)}</h4>
                </div>
                <div class="cpee-svg-container" style="padding: 2rem; text-align: center;">
                    <div style="color: var(--error-color, #f44336); font-size: 1.1rem;">
                        ⚠️ ${DOMUtils.escapeHtml(errorMessage)}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Update graph content
     * @param {string} containerId - Container ID
     * @param {string} cpeeXML - New CPEE XML content
     */
    async updateGraph(containerId, cpeeXML) {
        const containerData = this.containers.get(containerId);
        if (!containerData) {
            console.error(`Container ${containerId} not found for update`);
            return;
        }
        
        try {
            // Convert new XML to graph
            const graph = GraphService.convertCPEEToGraph(cpeeXML);
            
            // Update with new graph
            containerData.layoutEngine.render(graph);
            containerData.graph = graph;
            
            console.log(`Graph updated in ${containerId}`);
            
        } catch (error) {
            console.error(`Error updating graph in ${containerId}:`, error);
            this.renderError(containerData.container, 
                `Failed to update graph: ${error.message}`, 
                containerData.title);
        }
    }
    
    /**
     * Clear graph from container
     * @param {string} containerId - Container ID
     */
    clearGraph(containerId) {
        const containerData = this.containers.get(containerId);
        if (containerData) {
            containerData.container.innerHTML = '';
            this.containers.delete(containerId);
        }
    }
    
    /**
     * Export SVG for a specific graph
     * @param {string} containerId - Container ID
     */
    exportSVG(containerId) {
        const containerData = this.containers.get(containerId);
        if (!containerData) return;
        
        try {
            const svgContent = containerData.layoutEngine.exportSVG();
            
            // Create download link
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `cpee-graph-${containerId}-${Date.now()}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            console.log(`SVG exported for ${containerId}`);
            
        } catch (error) {
            console.error(`Error exporting SVG for ${containerId}:`, error);
            alert('Failed to export SVG. Please try again.');
        }
    }
    
    /**
     * Get graph data for a container
     * @param {string} containerId - Container ID
     * @returns {Object|null} Graph data or null
     */
    getGraphData(containerId) {
        const containerData = this.containers.get(containerId);
        return containerData ? containerData.graph : null;
    }
    
    /**
     * Get all active containers
     * @returns {Array} Array of container IDs
     */
    getActiveContainers() {
        return Array.from(this.containers.keys());
    }
    
    /**
     * Set theme for a specific graph
     * @param {string} containerId - Container ID
     * @param {string} theme - Theme name
     */
    setTheme(containerId, theme) {
        const containerData = this.containers.get(containerId);
        if (containerData) {
            const graphContainer = containerData.container.querySelector('.cpee-graph-container');
            if (graphContainer) {
                // Remove existing theme classes
                graphContainer.classList.remove('cpee-theme-dark', 'cpee-theme-minimal');
                
                // Add new theme class
                if (theme !== 'default') {
                    graphContainer.classList.add(`cpee-theme-${theme}`);
                }
            }
        }
    }
}
