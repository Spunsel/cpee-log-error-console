/**
 * MermaidRenderer - Renders Mermaid diagrams to SVG
 * 
 * Uses Mermaid.js to convert raw Mermaid syntax into SVG graphs
 * Similar interface to CPEEWfAdaptorRenderer for consistency
 */

import { StatusManager } from '../../utils/dom/StatusManager.js';
import { LibraryLoader } from '../../utils/system/LibraryLoader.js';
import { DOMUtils } from '../../utils/dom/DOMUtils.js';
import { ContentCleaner } from '../../utils/content/ContentCleaner.js';
import { configManager } from '../../config/ConfigManager.js';

export class MermaidRenderer {
    constructor() {
        this.container = null;
        this.statusManager = null;
        this.inputElement = null;
        this.isRendered = false;
        this.mermaidLoaded = false;
        this.renderCount = 0; // To generate unique IDs
    }

    /**
     * Initialize the renderer with container and status elements
     * @param {string} containerId - ID of the container element
     * @param {string} statusId - ID of the status message element (optional)
     * @param {string} inputId - ID of the input element (optional)
     */
    async initialize(containerId, statusId = null, inputId = null) {
        try {
            this.container = document.getElementById(containerId);
            if (!this.container) {
                throw new Error(`MermaidRenderer: Container element with ID '${containerId}' not found`);
            }

            // Initialize status manager
            if (statusId) {
                const statusElement = document.getElementById(statusId);
                this.statusManager = new StatusManager(statusElement);
            }

            if (inputId) {
                this.inputElement = document.getElementById(inputId);
            }

            this.setupContainer();
            await this.loadMermaid();
            
            console.log('✅ MermaidRenderer initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize MermaidRenderer:', error);
            throw error;
        }
    }

    /**
     * Setup the container with proper structure
     */
    setupContainer() {
        if (!this.container) {
            return;
        }

        this.container.style.cssText = `
            width: ${configManager.get('rendering.containers.graphContainer.width')};
            height: auto;
            min-height: ${configManager.get('rendering.containers.graphContainer.minHeight')};
            position: relative;
            overflow: auto;
            background: white;
            border-radius: 8px;
        `;
    }

    /**
     * Load Mermaid.js library using LibraryLoader
     */
    async loadMermaid() {
        if (this.mermaidLoaded && window.mermaid) {
            return;
        }

        await LibraryLoader.ensureLibrary(
            'Mermaid',
            'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
            () => typeof window.mermaid !== 'undefined'
        );

        this.mermaidLoaded = true;
        this.initializeMermaid();
    }

    /**
     * Initialize Mermaid with configuration
     */
    initializeMermaid() {
        if (!window.mermaid) {
            return;
        }

        // Use configuration manager for consistent setup
        const config = configManager.getSection('mermaid');
        window.mermaid.initialize(config);

        console.log('✅ Mermaid initialized with configuration');
    }

    /**
     * Render Mermaid graph from raw mermaid syntax
     * @param {string} mermaidCode - Raw Mermaid diagram code
     */
    async renderGraph(mermaidCode) {
        try {
            if (this.statusManager) {
                this.statusManager.showLoading('🎨 Rendering Mermaid graph...');
            }

            // Validate mermaid code using syntax processor
            const cleanedCode = ContentCleaner.cleanAndValidateMermaid(mermaidCode);

            // Ensure mermaid is loaded
            await this.loadMermaid();

            // Clear previous content
            this.container.innerHTML = '';

            // Generate unique ID for this render
            this.renderCount++;
            const graphId = `mermaid-graph-${this.renderCount}-${Date.now()}`;

            // Create container for the graph
            const graphDiv = document.createElement('div');
            graphDiv.id = graphId;
            
            // Check if this is an intermediate graph and adjust configuration accordingly
            const isIntermediateGraph = this.container.id.includes('intermediate');
            const padding = isIntermediateGraph ? '15px' : '20px';
            
            // Use container-specific configuration for intermediate graphs
            if (isIntermediateGraph) {
                const intermediateConfig = configManager.get('rendering.containers.intermediateGraph');
                const mermaidConfig = configManager.getSection('mermaid');
                
                // Apply intermediate-specific settings
                mermaidConfig.flowchart.padding = parseInt(intermediateConfig.padding);
                mermaidConfig.flowchart.nodeSpacing = parseInt(intermediateConfig.nodeSpacing);
                mermaidConfig.flowchart.rankSpacing = parseInt(intermediateConfig.rankSpacing);
                mermaidConfig.fontSize = parseInt(intermediateConfig.fontSize);
                
                window.mermaid.initialize(mermaidConfig);
            }
            
            graphDiv.style.cssText = `
                width: 100%;
                height: auto;
                text-align: center;
                padding: ${padding};
                box-sizing: border-box;
            `;

            this.container.appendChild(graphDiv);

            // Render with mermaid
            const { svg, bindFunctions } = await window.mermaid.render(`graph-${this.renderCount}`, cleanedCode);

            // Insert the SVG into the container
            graphDiv.innerHTML = svg;

            // Execute any binding functions for interactivity
            if (bindFunctions) {
                bindFunctions(graphDiv);
            }

            // Style the SVG for consistent appearance
            const svgElement = graphDiv.querySelector('svg');
            
            if (svgElement) {
                if (isIntermediateGraph) {
                    // Allow natural growth for intermediate graphs
                    svgElement.style.cssText = `
                        width: auto;
                        height: auto;
                        display: inline-block;
                        margin: 0;
                        background: white;
                        vertical-align: top;
                    `;
                    
                    // Adjust container height to match SVG height after rendering
                    setTimeout(() => {
                        const svgHeight = svgElement.getBoundingClientRect().height;
                        if (svgHeight > 0) {
                            const paddingValue = isIntermediateGraph ? 30 : 40; // Account for top + bottom padding
                            this.container.style.minHeight = (svgHeight + paddingValue) + 'px';
                            this.container.style.height = 'auto';
                        }
                    }, 100);
                } else {
                    // Constrain other graphs to container width
                    svgElement.style.cssText = `
                        max-width: 100%;
                        height: auto;
                        display: block;
                        margin: 0 auto;
                        background: white;
                    `;
                }
            }

            console.log('✅ Mermaid graph rendered successfully');
            if (this.statusManager) {
                this.statusManager.showSuccess('✅ Mermaid graph rendered successfully');
            }
            this.isRendered = true;

        } catch (error) {
            console.error('❌ Error rendering Mermaid graph:', error);
            console.error('📋 Original code length:', mermaidCode.length);
            console.error('🔍 Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            if (this.statusManager) {
                this.statusManager.showError(`❌ Failed to render graph: ${error.message}`);
            }
            this.showFallbackContent(mermaidCode);
        }
    }


    /**
     * Show fallback content when rendering fails
     * @param {string} originalCode - Original mermaid code
     */
    showFallbackContent(originalCode) {
        if (!this.container) {
            return;
        }

        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'alert alert-warning';
        fallbackDiv.style.cssText = `
            margin: 20px;
            padding: 15px;
            border: 1px solid #ffc107;
            background-color: #fff3cd;
            color: #856404;
            border-radius: 4px;
        `;

        fallbackDiv.innerHTML = `
            <h6>Graph rendering failed - showing raw code:</h6>
            <pre style="white-space: pre-wrap; margin-top: 10px; background: #f8f9fa; padding: 10px; border-radius: 4px;">${DOMUtils.escapeHtml(originalCode)}</pre>
        `;

        this.container.appendChild(fallbackDiv);
    }


    /**
     * Reset container to initial state
     */
    resetContainer() {
        this.isRendered = false;
        this.setupContainer();
    }

    /**
     * Get supported Mermaid diagram types
     * @returns {string[]} Array of supported diagram types
     */
    getSupportedDiagramTypes() {
        return ['flowchart', 'graph'];
    }

    /**
     * Check if the renderer is ready
     * @returns {boolean} True if ready to render
     */
    isReady() {
        return this.mermaidLoaded && this.container && window.mermaid;
    }
}
