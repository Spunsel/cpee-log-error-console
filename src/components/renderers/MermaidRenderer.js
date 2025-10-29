/**
 * MermaidRenderer - Renders Mermaid diagrams to SVG
 * 
 * Uses Mermaid.js to convert raw Mermaid syntax into SVG graphs
 * Similar interface to CPEEWfAdaptorRenderer for consistency
 */

import { DOMStatusManager } from '../../utils/dom/DOMStatusManager.js';
import { LibraryLoader } from '../../utils/system/LibraryLoader.js';
import { DOMRegistry } from '../../core/DOMRegistry.js';
import { MermaidParser } from '../../utils/content/MermaidParser.js';
import { configManager } from '../../config/ConfigManager.js';

export class MermaidRenderer {
    constructor() {
        this.container = null;
        this.statusManager = null;
        this.inputElement = null;
        this.isRendered = false;
        this.mermaidLoaded = false;
        this.renderCount = 0; // To generate unique IDs
        
        // Post-render callback for highlighting integration
        this.postRenderCallback = null;
    }

    /**
     * Initialize the renderer with container and status elements
     * @param {string} containerId - ID of the container element
     * @param {string} statusId - ID of the status message element (optional)
     * @param {string} inputId - ID of the input element (optional)
     */
    async initialize(containerId, statusId = null, inputId = null) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`MermaidRenderer: Container element with ID '${containerId}' not found`);
        }

        // Initialize status manager
        if (statusId) {
            const statusElement = document.getElementById(statusId);
            this.statusManager = new DOMStatusManager(statusElement);
        }

        if (inputId) {
            this.inputElement = document.getElementById(inputId);
        }

        this.setupContainer();
        await this.loadMermaid();
    }

    /**
     * Setup the container with proper structure
     */
    setupContainer() {
        if (!this.container) {
            return;
        }

        // Container should not have overflow - parent mermaid-section handles scrolling
        this.container.style.cssText = `
            width: ${configManager.get('rendering.containers.graphContainer.width')};
            height: auto;
            min-height: ${configManager.get('rendering.containers.graphContainer.minHeight')};
            position: relative;
            overflow: visible;
            background: white;
            border-radius: 8px;
            box-sizing: border-box;
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
        const mermaidConfig = configManager.getSection('mermaid');
        // Mermaid.initialize expects a flat config object, so merge default with other settings
        const config = {
            ...mermaidConfig.default,
            themeVariables: mermaidConfig.themeVariables,
            flowchart: mermaidConfig.flowchart,
            sequence: mermaidConfig.sequence,
            gantt: mermaidConfig.gantt
        };
        window.mermaid.initialize(config);
    }

    /**
     * Get font size configuration
     * @returns {Object} Font size configuration
     */
    _getFontSizeConfig() {
        const mermaidConfig = configManager.getSection('mermaid');
        // Fixed baseline font size for scaling calculations
        const baseFontSize = 14;
        // Current font size from config
        const fontSize = mermaidConfig.default.fontSize || baseFontSize;
        
        return { fontSize, baseFontSize };
    }

    /**
     * Build Mermaid configuration with proportional scaling
     * @returns {Object} Mermaid configuration object
     */
    _buildMermaidConfig() {
        const mermaidConfig = configManager.getSection('mermaid');
        const { fontSize, baseFontSize } = this._getFontSizeConfig();
        const scaleFactor = fontSize / baseFontSize;

        const flowchart = {
            ...mermaidConfig.flowchart,
            padding: Math.round(mermaidConfig.flowchart.padding * scaleFactor),
            nodeSpacing: Math.round(mermaidConfig.flowchart.nodeSpacing * scaleFactor),
            rankSpacing: Math.round(mermaidConfig.flowchart.rankSpacing * scaleFactor)
        };

        return {
            ...mermaidConfig.default,
            fontSize,
            flowchart,
            themeVariables: mermaidConfig.themeVariables,
            sequence: mermaidConfig.sequence,
            gantt: mermaidConfig.gantt
        };
    }

    /**
     * Apply font sizes to all text elements in SVG
     * @param {SVGElement} svgElement - SVG element to style
     * @param {string} fontSize - Font size value
     */
    _applyFontSizes(svgElement, fontSize) {
        if (!svgElement) {
            return;
        }
        
        const svgNS = 'http://www.w3.org/2000/svg';
        
        // Apply to all text and tspan elements
        const textElements = svgElement.getElementsByTagNameNS(svgNS, 'text');
        const tspanElements = svgElement.getElementsByTagNameNS(svgNS, 'tspan');
        
        [...textElements, ...tspanElements].forEach(el => {
            // Remove any existing font-size attributes that might interfere
            el.removeAttribute('font-size');
            // Set via style with !important to override Mermaid's internal styles
            el.style.setProperty('font-size', fontSize, 'important');
            // Also set as attribute as fallback
            el.setAttribute('font-size', fontSize);
        });
    }

    /**
     * Apply SVG styling (scaling is handled via Mermaid internal spacing)
     * @param {SVGElement} svgElement - SVG element to style
     */
    _applySVGScaling(svgElement) {
        // No CSS transform needed - scaling is handled via Mermaid's internal spacing
        // Setting display and background for consistent appearance
        Object.assign(svgElement.style, {
            background: 'white',
            display: 'block'
        });
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

            const cleanedCode = MermaidParser.cleanAndValidate(mermaidCode);
            await this.loadMermaid();

            const mermaidConfig = this._buildMermaidConfig();
            const { fontSize } = this._getFontSizeConfig();
            
            window.mermaid.initialize(mermaidConfig);
            
            // Create graph container
            const graphDiv = document.createElement('div');
            graphDiv.id = `mermaid-graph-${++this.renderCount}-${Date.now()}`;
            graphDiv.style.cssText = `width: 100%; height: auto; text-align: center; padding: 20px; box-sizing: border-box; overflow: visible;`;
            
            // Pre-append to container but keep invisible to allow layout calculation
            this.container.innerHTML = '';
            graphDiv.style.opacity = '0';
            this.container.appendChild(graphDiv);
            
            // Render SVG
            const { svg, bindFunctions } = await window.mermaid.render(`graph-${this.renderCount}`, cleanedCode);
            graphDiv.innerHTML = svg;
            if (bindFunctions) {
                bindFunctions(graphDiv);
            }

            const svgElement = graphDiv.querySelector('svg');
            if (!svgElement) {
                this.container.innerHTML = '';
                this.showFallbackContent(cleanedCode);
                if (this.statusManager) {
                    this.statusManager.showError('SVG element not found after render');
                }
                return;
            }

            // Apply all styling immediately and synchronously
            const fontSizeStr = `${fontSize}px`;
            this._applyFontSizes(svgElement, fontSizeStr);
            this._applySVGScaling(svgElement);
            
            // Apply to all text elements immediately
            const allText = svgElement.querySelectorAll('text, tspan, .nodeLabel text, .nodeLabel tspan');
            for (let i = 0; i < allText.length; i++) {
                const el = allText[i];
                el.style.setProperty('font-size', fontSizeStr, 'important');
                el.setAttribute('font-size', fontSizeStr);
            }
            
            // Force immediate synchronous layout recalculation
            void graphDiv.offsetHeight;
            void this.container.offsetHeight;
            void svgElement.offsetHeight;
            
            // Make visible in same frame (no repaint delay)
            graphDiv.style.opacity = '1';

            if (this.statusManager) {
                this.statusManager.showSuccess('✅ Mermaid graph rendered successfully');
            }
            
            this.isRendered = true;
            if (this.postRenderCallback) {
                this.postRenderCallback(this.container.id, svgElement);
            }

        } catch (error) {
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
            <pre style="white-space: pre-wrap; margin-top: 10px; background: #f8f9fa; padding: 10px; border-radius: 4px;">${DOMRegistry.escapeHtml(originalCode)}</pre>
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
    
    /**
     * Set post-render callback
     * @param {Function} callback - Callback function (sectionId, svgElement) => void
     */
    setPostRenderCallback(callback) {
        this.postRenderCallback = callback;
    }
}
