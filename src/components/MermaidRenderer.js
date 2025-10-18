/**
 * MermaidRenderer - Renders Mermaid diagrams to SVG
 * 
 * Uses Mermaid.js to convert raw Mermaid syntax into SVG graphs
 * Similar interface to CPEEWfAdaptorRenderer for consistency
 */

export class MermaidRenderer {
    constructor() {
        this.container = null;
        this.statusElement = null;
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
                throw new Error(`Container element with ID '${containerId}' not found`);
            }

            if (statusId) {
                this.statusElement = document.getElementById(statusId);
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
        if (!this.container) return;

        this.container.style.cssText = `
            width: 100%;
            height: auto;
            min-height: 300px;
            position: relative;
            overflow: auto;
            background: white;
            border-radius: 8px;
        `;
    }

    /**
     * Load Mermaid.js library
     */
    async loadMermaid() {
        if (this.mermaidLoaded && window.mermaid) {
            return;
        }

        return new Promise((resolve, reject) => {
            // Check if mermaid is already loaded
            if (window.mermaid) {
                this.mermaidLoaded = true;
                this.initializeMermaid();
                resolve();
                return;
            }

            // Load mermaid from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js';
            script.onload = () => {
                console.log('✅ Mermaid.js loaded successfully');
                this.mermaidLoaded = true;
                this.initializeMermaid();
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load Mermaid.js from CDN'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize Mermaid with configuration
     */
    initializeMermaid() {
        if (!window.mermaid) return;

        // Configure mermaid for SVG output
        window.mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 14,
            flowchart: {
                htmlLabels: true,
                curve: 'basis',
                padding: 20
            },
            sequence: {
                diagramMarginX: 50,
                diagramMarginY: 10,
                actorMargin: 50,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35
            },
            gantt: {
                titleTopMargin: 25,
                barHeight: 20,
                fontSize: 11,
                fontFamily: '"Open Sans", sans-serif',
                numberSectionStyles: 4,
                axisFormat: '%Y-%m-%d'
            }
        });

        console.log('✅ Mermaid initialized with configuration');
    }

    /**
     * Render Mermaid graph from raw mermaid syntax
     * @param {string} mermaidCode - Raw Mermaid diagram code
     */
    async renderGraph(mermaidCode) {
        try {
            this.showStatus('🎨 Rendering Mermaid graph...', 'loading');

            // Validate mermaid code
            const cleanedCode = this.cleanAndValidateMermaid(mermaidCode);

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
            graphDiv.style.cssText = `
                width: 100%;
                height: auto;
                text-align: center;
                padding: 20px;
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
                svgElement.style.cssText = `
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 0 auto;
                    background: white;
                `;
            }

            console.log('✅ Mermaid graph rendered successfully');
            this.showStatus('✅ Mermaid graph rendered successfully', 'success');
            this.isRendered = true;

            // Auto-hide success message after a short delay
            setTimeout(() => {
                if (this.statusElement) {
                    this.statusElement.style.display = 'none';
                }
            }, 2000);

        } catch (error) {
            console.error('❌ Error rendering Mermaid graph:', error);
            this.showStatus(`❌ Failed to render graph: ${error.message}`, 'error');
            this.showFallbackContent(mermaidCode);
        }
    }

    /**
     * Clean and validate Mermaid code
     * @param {string} code - Raw mermaid code
     * @returns {string} Cleaned and validated code
     */
    cleanAndValidateMermaid(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid Mermaid code input');
        }

        // Remove HTML comments and extra whitespace
        let cleanedCode = code.replace(/<!--[\s\S]*?-->/g, '').trim();

        // Remove any leading/trailing whitespace
        cleanedCode = cleanedCode.replace(/^\s+|\s+$/g, '');

        if (cleanedCode.length === 0) {
            throw new Error('Empty Mermaid code provided');
        }

        // Basic validation - check for common mermaid diagram types
        const mermaidTypes = [
            'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
            'stateDiagram', 'erDiagram', 'gantt', 'pie', 'journey',
            'gitgraph', 'mindmap', 'timeline'
        ];

        const hasValidType = mermaidTypes.some(type => 
            cleanedCode.toLowerCase().includes(type.toLowerCase())
        );

        if (!hasValidType) {
            throw new Error('Mermaid code does not contain a recognized diagram type');
        }

        console.log('✅ Mermaid code validation successful');
        return cleanedCode;
    }

    /**
     * Show fallback content when rendering fails
     * @param {string} originalCode - Original mermaid code
     */
    showFallbackContent(originalCode) {
        if (!this.container) return;

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
            <pre style="white-space: pre-wrap; margin-top: 10px; background: #f8f9fa; padding: 10px; border-radius: 4px;">${this.escapeHtml(originalCode)}</pre>
        `;

        this.container.appendChild(fallbackDiv);
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show status message
     * @param {string} message - Status message
     * @param {string} type - Message type (loading, success, error)
     */
    showStatus(message, type = 'info') {
        if (!this.statusElement) return;

        this.statusElement.textContent = message;
        this.statusElement.className = `alert alert-${type === 'loading' ? 'info' : type === 'success' ? 'success' : 'danger'}`;
        this.statusElement.style.display = 'block';
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
        return [
            'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
            'stateDiagram', 'erDiagram', 'gantt', 'pie', 'journey',
            'gitgraph', 'mindmap', 'timeline'
        ];
    }

    /**
     * Check if the renderer is ready
     * @returns {boolean} True if ready to render
     */
    isReady() {
        return this.mermaidLoaded && this.container && window.mermaid;
    }
}
