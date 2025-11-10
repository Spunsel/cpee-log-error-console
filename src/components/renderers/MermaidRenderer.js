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
import { MermaidErrorHandler } from '../../utils/content/MermaidErrorHandler.js';
import { MermaidWarningHandler } from '../../utils/content/MermaidWarningHandler.js';
import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { SVGScaleUtility } from '../../utils/dom/SVGScaleUtility.js';

export class MermaidRenderer {
    constructor(eventBus = null, stateManager = null) {
        this.container = null;
        this.statusManager = null;
        this.inputElement = null;
        this.isRendered = false;
        this.mermaidLoaded = false;
        this.renderCount = 0; // To generate unique IDs
        
        // Post-render callback for highlighting integration
        this.postRenderCallback = null;
        
        // Scale management
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.defaultScale = configManager.get('rendering.scaling.default') || 1.0;
        
        // Load scale from StateManager (which loads from localStorage)
        const storedScale = this.stateManager.getState('ui.scale');
        this.currentScale = storedScale && SVGScaleUtility.isValidScale(storedScale) 
            ? storedScale 
            : this.defaultScale;
        this.currentSvgElement = null; // Track current SVG for scale updates
        
        // Listen for scale change events
        this.setupScaleListener();
    }
    
    /**
     * Setup event listener for scale changes
     */
    setupScaleListener() {
        this.eventBus.on('scaleDisplay:scaleChanged', (data) => {
            const newScale = data.scale;
            if (typeof newScale === 'number' && newScale !== this.currentScale) {
                this.currentScale = newScale;
                this.applyScaleToCurrentGraph();
            }
        });
    }
    
    /**
     * Apply scale to the current SVG graph if it exists
     */
    applyScaleToCurrentGraph() {
        if (!this.container || !this.currentSvgElement) {
            return;
        }
        
        this.applyScaleTransform(this.currentSvgElement);
    }
    
    /**
     * Apply scale transform to an SVG element
     * Uses SVGScaleUtility for consistent scaling
     * @param {SVGElement} svgElement - SVG element to scale
     */
    applyScaleTransform(svgElement) {
        if (!svgElement) {
            return;
        }
        
        // Use utility function for consistent scaling
        SVGScaleUtility.applyScale(svgElement, this.currentScale, 'mermaid');
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

        // Load current scale from localStorage
        this.loadCurrentScale();

        this.setupContainer();
        await this.loadMermaid();
    }
    
    /**
     * Load current scale from StateManager
     */
    loadCurrentScale() {
        const storedScale = this.stateManager.getState('ui.scale');
        if (storedScale && SVGScaleUtility.isValidScale(storedScale)) {
            this.currentScale = storedScale;
        }
    }

    /**
     * Setup the container with proper structure
     */
    setupContainer() {
        if (!this.container) {
            return;
        }

        // Container should not have overflow - parent mermaid-section handles scrolling
        // Get background color from CSS variable (adapts to dark mode automatically)
        const root = document.documentElement;
        const backgroundColor = getComputedStyle(root).getPropertyValue('--surface-color').trim() || '#ffffff';
        
        this.container.style.cssText = `
            width: ${configManager.get('rendering.containers.graphContainer.width')};
            height: auto;
            min-height: ${configManager.get('rendering.containers.graphContainer.minHeight')};
            position: relative;
            overflow: visible;
            background: ${backgroundColor};
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
     * Check if dark mode is enabled
     * @returns {boolean} True if dark mode is active
     */
    _isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    /**
     * Build Mermaid configuration with proportional scaling and dark mode support
     * @returns {Object} Mermaid configuration object
     */
    _buildMermaidConfig() {
        const mermaidConfig = configManager.getSection('mermaid');
        const { fontSize, baseFontSize } = this._getFontSizeConfig();
        const scaleFactor = fontSize / baseFontSize;
        const isDark = this._isDarkMode();

        const flowchart = {
            ...mermaidConfig.flowchart,
            padding: Math.round(mermaidConfig.flowchart.padding * scaleFactor),
            nodeSpacing: Math.round(mermaidConfig.flowchart.nodeSpacing * scaleFactor),
            rankSpacing: Math.round(mermaidConfig.flowchart.rankSpacing * scaleFactor)
        };

        // Build theme variables based on dark mode
        let themeVariables = {
            ...mermaidConfig.themeVariables,
            fontSize: `${fontSize}px`  // Mermaid expects fontSize in themeVariables
        };

        // Override theme variables for dark mode using CSS variables
        if (isDark) {
            // Get CSS variables from root element
            const root = document.documentElement;
            const rootStyles = getComputedStyle(root);
            
            // Helper function to get CSS variable with fallback
            const getVar = (varName, fallback) => 
                rootStyles.getPropertyValue(varName).trim() || fallback;
            
            // Get dark mode colors from CSS variables
            const surfaceColor = getVar('--surface-color', '#1f2937');
            const backgroundColor = getVar('--background-color', '#2a3441'); // Slightly lighter for shape fills
            const textPrimary = getVar('--text-primary', '#e2e8f0'); // Primary text color for lines and borders
            const textSecondary = getVar('--text-secondary', '#a8b8d0');
            
            themeVariables = {
                ...themeVariables,
                primaryColor: backgroundColor,           // Slightly lighter background for shape fills
                primaryBorderColor: textPrimary,      // Lighter borders/edges from CSS variable (same as lines)
                primaryTextColor: textSecondary,        // Light gray text from CSS variable
                mainBkg: backgroundColor,                 // Slightly lighter background for shape fills
                secondBkg: backgroundColor,               // Slightly lighter background for shape fills
                tertiaryColor: backgroundColor,           // Slightly lighter background for shape fills
                altBackground: backgroundColor,            // Slightly lighter background for shape fills
                nodeBorder: textPrimary,              // Lighter borders from CSS variable (same as lines)
                secondaryBorderColor: textPrimary,    // Lighter borders/edges from CSS variable (same as lines)
                tertiaryBorderColor: textPrimary,     // Lighter borders/edges from CSS variable (same as lines)
                secondaryTextColor: textSecondary,      // Light gray text from CSS variable
                tertiaryTextColor: textSecondary,       // Light gray text from CSS variable
                clusterBkg: 'none',
                clusterBorder: textPrimary,            // Lighter borders from CSS variable (same as lines)
                lineColor: textPrimary,               // Lighter for edges/lines from CSS variable (same as borders)
                edgeLabelBackground: surfaceColor,     // Dark background from CSS variable for edge labels
                edgeLabelColor: textSecondary            // Light gray for edge label text from CSS variable
            };
        }

        return {
            ...mermaidConfig.default,
            fontSize,
            flowchart,
            themeVariables,
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
        // Set display and background for consistent appearance
        // Get background color from CSS variable
        const root = document.documentElement;
        const backgroundColor = getComputedStyle(root).getPropertyValue('--surface-color').trim() || '#ffffff';
        
        Object.assign(svgElement.style, {
            background: backgroundColor,
            backgroundColor: backgroundColor,
            display: 'block'
        });
        
        // Apply current scale transform
        this.applyScaleTransform(svgElement);
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

            const cleanResult = MermaidParser.cleanAndValidate(mermaidCode);
            const cleanedCode = cleanResult.code;
            const appliedSteps = cleanResult.appliedSteps || [];
            
            // Display warning panel if preprocessing steps were applied
            if (appliedSteps.length > 0) {
                MermaidWarningHandler.displayWarningIndicator(this.container, appliedSteps);
            } else {
                MermaidWarningHandler.removeWarningIndicator(this.container);
            }
            
            await this.loadMermaid();

            const mermaidConfig = this._buildMermaidConfig();
            const { fontSize } = this._getFontSizeConfig();
            
            window.mermaid.initialize(mermaidConfig);
            
            // Create graph container with background from CSS variable
            const root = document.documentElement;
            const backgroundColor = getComputedStyle(root).getPropertyValue('--surface-color').trim() || '#ffffff';
            
            const graphDiv = document.createElement('div');
            graphDiv.id = `mermaid-graph-${++this.renderCount}-${Date.now()}`;
            graphDiv.style.cssText = `width: 100%; height: auto; text-align: center; padding: 20px; box-sizing: border-box; overflow: visible; background-color: ${backgroundColor};`;
            
            // Pre-append to container but keep invisible to allow layout calculation
            // Keep warning panel if it exists
            const existingWarning = this.container.querySelector('.mermaid-warning-indicator');
            this.container.innerHTML = '';
            if (existingWarning && this.container) {
                this.container.appendChild(existingWarning);
            }
            graphDiv.style.opacity = '0';
            this.container.appendChild(graphDiv);
            
            // Render SVG with error handling
            let svg, bindFunctions;
            try {
                const result = await window.mermaid.render(`graph-${this.renderCount}`, cleanedCode);
                svg = result.svg;
                bindFunctions = result.bindFunctions;
            } catch (renderError) {
                // Remove the empty graph container since rendering failed
                if (graphDiv && graphDiv.parentNode) {
                    graphDiv.remove();
                }
                
                // Clean up any error SVGs that Mermaid may have inserted into the DOM
                // Mermaid sometimes inserts error elements with IDs like "dgraph-X" even with suppressErrorRendering
                // These error containers have IDs starting with "dgraph-" and contain SVGs with IDs starting with "graph-"
                const errorDivs = document.querySelectorAll('[id^="dgraph-"]');
                errorDivs.forEach(div => {
                    // Check if this div contains an error SVG
                    const svg = div.querySelector('svg[id^="graph-"]');
                    if (svg) {
                        const hasErrorIcon = svg.querySelector('.error-icon');
                        const hasErrorText = svg.querySelector('text.error-text');
                        const hasErrorContent = svg.textContent?.includes('Syntax error') || 
                                                svg.textContent?.includes('mermaid version');
                        
                        if (hasErrorIcon || hasErrorText || hasErrorContent) {
                            // This is an error SVG, remove the entire container div
                            if (div.parentNode) {
                                div.parentNode.removeChild(div);
                            } else {
                                div.remove();
                            }
                        }
                    }
                });
                
                // Also remove any standalone error SVGs (in case Mermaid inserts them directly)
                const errorSvgs = document.querySelectorAll('svg[id^="graph-"][role="graphics-document document"][aria-roledescription="error"]');
                errorSvgs.forEach(svg => {
                    const hasErrorIcon = svg.querySelector('.error-icon');
                    const hasErrorText = svg.querySelector('text.error-text');
                    if ((hasErrorIcon || hasErrorText) && svg.parentNode) {
                        // Remove the parent container if it exists (like a div with id="dgraph-X")
                        if (svg.parentNode.id?.startsWith('dgraph-')) {
                            svg.parentNode.remove();
                        } else {
                            svg.remove();
                        }
                    }
                });
                
                // Also remove any mermaidTooltip elements that might be left behind
                const tooltips = document.querySelectorAll('.mermaidTooltip');
                tooltips.forEach(tooltip => {
                    if (tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    } else {
                        tooltip.remove();
                    }
                });
                
                // Categorize and handle the error
                const categorizedError = MermaidErrorHandler.categorizeError(renderError, cleanedCode);
                
                // Remove warning panel if error occurred (error takes precedence)
                MermaidWarningHandler.removeWarningIndicator(this.container);
                
                // Display error indicator in the container
                MermaidErrorHandler.displayErrorIndicator(this.container, categorizedError);
                
                // Re-throw with categorization for outer catch block
                if (categorizedError.errorType === 'syntax') {
                    throw new MermaidErrorHandler.MermaidSyntaxError(
                        categorizedError.message,
                        categorizedError.originalError,
                        categorizedError.code
                    );
                }
                
                // Wrap other errors with categorization info
                const wrappedError = new Error(categorizedError.message);
                wrappedError.categorizedError = categorizedError;
                throw wrappedError;
            }
            
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
            
            // Remove any error indicators if rendering succeeded
            MermaidErrorHandler.removeErrorIndicator(this.container);
            
            // Store reference to current SVG for scale updates
            this.currentSvgElement = svgElement;

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
            // Clear container to ensure no leftover graph containers
            if (this.container) {
                // Remove any graph containers that might have been created
                const graphContainers = this.container.querySelectorAll('[id^="mermaid-graph-"]');
                graphContainers.forEach(container => container.remove());
            }
            
            // Check if error was already handled by MermaidErrorHandler
            // (it will have displayed the red box)
            if (error instanceof MermaidErrorHandler.MermaidSyntaxError) {
                // Syntax error - already handled by error handler
                if (this.statusManager) {
                    this.statusManager.showError(`❌ Mermaid syntax error: ${error.message}`);
                }
                // Error indicator already displayed by MermaidErrorHandler
                return;
            } else if (error.categorizedError) {
                // Other categorized error - already handled
                if (this.statusManager) {
                    this.statusManager.showError(`❌ Failed to render graph: ${error.message}`);
                }
                // Error indicator already displayed by MermaidErrorHandler
                return;
            }
            
            // Fallback for other errors not caught by error handler
            if (this.statusManager) {
                this.statusManager.showError(`❌ Failed to render graph: ${error.message}`);
            }
            
            // Try to handle it with error handler
            MermaidErrorHandler.handleError(error, this.container, mermaidCode);
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
