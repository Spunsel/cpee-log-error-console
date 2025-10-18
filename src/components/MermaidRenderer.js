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

        // Configure mermaid for SVG output with dynamic sizing and custom colors
        window.mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
                // Event (circle) styling - white background, black border
                primaryColor: '#ffffff',
                primaryBorderColor: '#000000',
                primaryTextColor: '#000000',
                // Start/End event styling
                cScale0: '#ffffff',
                cScale1: '#ffffff',
                cScale2: '#ffffff',
                // Task (rectangle) styling - white background, black border
                mainBkg: '#ffffff',
                secondBkg: '#ffffff',
                tertiaryColor: '#ffffff',
                // Gateway/decision styling - white background, black border
                altBackground: '#ffffff',
                // Border colors - all black
                nodeBorder: '#000000',
                primaryBorderColor: '#000000',
                secondaryBorderColor: '#000000',
                tertiaryBorderColor: '#000000',
                // Text colors
                primaryTextColor: '#000000',
                secondaryTextColor: '#000000',
                tertiaryTextColor: '#000000',
                // Cluster styling
                clusterBkg: 'none',
                clusterBorder: '#000000'
            },
            securityLevel: 'loose',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 11,
            flowchart: {
                htmlLabels: true,
                curve: 'basis',
                padding: 15,
                nodeSpacing: 25,
                rankSpacing: 35,
                useMaxWidth: false
            },
            sequence: {
                diagramMarginX: 25,
                diagramMarginY: 6,
                actorMargin: 25,
                width: 100,
                height: 40,
                boxMargin: 6,
                boxTextMargin: 3,
                noteMargin: 6,
                messageMargin: 20,
                useMaxWidth: false
            },
            gantt: {
                titleTopMargin: 15,
                barHeight: 12,
                fontSize: 8,
                fontFamily: '"Open Sans", sans-serif',
                numberSectionStyles: 4,
                axisFormat: '%Y-%m-%d',
                useMaxWidth: false
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
            
            // Check if this is an intermediate graph and adjust padding accordingly
            const isIntermediateGraph = this.container.id.includes('intermediate');
            const padding = isIntermediateGraph ? '15px' : '20px';
            
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
            console.error('📋 Original code length:', mermaidCode.length);
            console.error('🔍 Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            this.showStatus(`❌ Failed to render graph: ${error.message}`, 'error');
            this.showFallbackContent(mermaidCode);
        }
    }

    /**
     * Clean and validate Mermaid code
     * @param {string} code - Raw mermaid code (can be markdown-wrapped or plain)
     * @returns {string} Cleaned and validated code
     */
    cleanAndValidateMermaid(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid Mermaid code input');
        }

        // Remove HTML comments and extra whitespace
        let cleanedCode = code.replace(/<!--[\s\S]*?-->/g, '').trim();

        // Remove CPEE-style comments (e.g., "%% Output Intermediate", "%% Input Intermediate")
        cleanedCode = cleanedCode.replace(/^\s*%%.*$/gm, '').trim();

        // Extract Mermaid code from markdown code blocks
        const mermaidBlockMatch = cleanedCode.match(/```mermaid\s*\n([\s\S]*?)\n\s*```/);
        if (mermaidBlockMatch) {
            cleanedCode = mermaidBlockMatch[1].trim();
        }

        // Remove any remaining markdown code block syntax that might be incomplete
        cleanedCode = cleanedCode.replace(/^```.*$/gm, '').trim();
        cleanedCode = cleanedCode.replace(/```\s*$/gm, '').trim();

        // Remove any leading/trailing whitespace and normalize line endings
        cleanedCode = cleanedCode.replace(/^\s+|\s+$/g, '');
        cleanedCode = cleanedCode.replace(/\r\n/g, '\n');

        // Fix common CPEE-to-Mermaid conversion issues
        cleanedCode = this.preprocessMermaidSyntax(cleanedCode);

        if (cleanedCode.length === 0) {
            throw new Error('Empty Mermaid code provided after cleaning');
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
            console.warn('⚠️ Cleaned Mermaid code:', JSON.stringify(cleanedCode));
            throw new Error(`Mermaid code does not contain a recognized diagram type. Cleaned content: "${cleanedCode.substring(0, 100)}..."`);
        }

        console.log('✅ Mermaid code validation successful');
        console.log('🔍 Cleaned Mermaid code:', cleanedCode);
        return cleanedCode;
    }

    /**
     * Preprocess Mermaid syntax to fix common CPEE-to-Mermaid conversion issues
     * @param {string} code - Raw mermaid code
     * @returns {string} Preprocessed code
     */
    preprocessMermaidSyntax(code) {
        let processedCode = code;

        // Fix 1: Remove empty edge labels that cause parse errors
        // Pattern: -->|""| becomes -->
        processedCode = processedCode.replace(/-->\|\"\"\|/g, '-->');
        
        // Also handle variations with single quotes or no quotes
        processedCode = processedCode.replace(/-->\|''\|/g, '-->');
        processedCode = processedCode.replace(/-->\|\|\|/g, '-->');
        
        // Fix 2: Handle problematic node IDs starting with numbers or special chars
        // Pattern: -1:escalate becomes N1_escalate (prefix with N, replace special chars)
        processedCode = processedCode.replace(/(\W|^)(-\d+)(:\w+)/g, function(match, prefix, number, suffix) {
            return prefix + 'N' + number.replace('-', '') + suffix.replace(':', '_');
        });
        
        // Fix 3: Remove spaces after node IDs that cause parsing issues
        // Pattern: "a9:task: (Task b)" becomes "a9:task:(Task b)"
        processedCode = processedCode.replace(/(\w+:\w+:)\s+(\([^)]+\))/g, '$1$2');
        
        // Fix 4: Handle triple parentheses in node shapes
        // Pattern: (((text))) becomes ((text))
        processedCode = processedCode.replace(/\(\(\(([^)]+)\)\)\)/g, '(($1))');
        
        // Fix 5: Handle malformed node references in edge labels
        // Ensure node IDs in edge targets don't have extra spaces
        processedCode = processedCode.replace(/(\|\s*[^|]*\s*\|\s*)(\w+:\w+:)\s+(\([^)]+\))/g, '$1$2$3');
        
        console.log('🔧 Mermaid preprocessing applied');
        if (code !== processedCode) {
            console.log('📝 Preprocessing changes detected');
            console.log('Original length:', code.length, 'Processed length:', processedCode.length);
            
            // Show specific changes for debugging
            const changes = [];
            if (code.includes('|""|') && !processedCode.includes('|""|')) {
                changes.push('✅ Removed empty edge labels |""|');
            }
            if (code.includes(': (') && !processedCode.includes(': (')) {
                changes.push('✅ Fixed spaces after node IDs');
            }
            if (code.includes('(((') && !processedCode.includes('(((')) {
                changes.push('✅ Fixed triple parentheses');
            }
            if (code.includes('-1:escalate') && !processedCode.includes('-1:escalate')) {
                changes.push('✅ Fixed problematic node IDs');
            }
            
            if (changes.length > 0) {
                console.log('🔧 Applied fixes:', changes);
            }
        }
        
        return processedCode;
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
