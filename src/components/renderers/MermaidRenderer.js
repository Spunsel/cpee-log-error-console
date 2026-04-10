/**
 * MermaidRenderer - Renders Mermaid diagrams to SVG
 * 
 * Uses Mermaid.js to convert raw Mermaid syntax into SVG graphs
 * Similar interface to CPEEWfAdaptorRenderer for consistency
 */

import { LibraryLoader } from '../../utils/system/LibraryLoader.js';
import { DOMRegistry } from '../../core/DOMRegistry.js';
import { MermaidErrorHandler } from '../../utils/content/MermaidErrorHandler.js';
import { MermaidWarningHandler } from '../../utils/content/MermaidWarningHandler.js';
import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { SVGScaleUtility } from '../../utils/dom/SVGScaleUtility.js';
import { serviceFactory } from '../../core/ServiceFactory.js';

let globalRenderCount = 0;

// Mermaid.js uses a single global instance (window.mermaid) that is not
// re-entrant. Concurrent initialize+render calls corrupt internal state
// and produce spurious "Cannot read properties of null" errors.
// This queue serializes all render calls across all MermaidRenderer instances.
let renderQueue = Promise.resolve();

export class MermaidRenderer {
    constructor(eventBus = null, stateManager = null, domRegistry = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.container = null;
        this.isRendered = false;
        this.mermaidLoaded = false;
        this.postRenderCallback = null;
        this.contentProcessingService = contentProcessingService || serviceFactory.get('ContentProcessingService');
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.defaultScale = configManager.get('rendering.scaling.default') || 1.0;
        this.currentScale = this.defaultScale;
        this.currentSvgElement = null;
        
        this.eventBus.on('scaleDisplay:scaleChanged', (data) => {
            const newScale = data.scale;
            if (typeof newScale === 'number' && newScale !== this.currentScale) {
                this.currentScale = newScale;
                if (this.container && this.currentSvgElement) {
                    SVGScaleUtility.applyScale(this.currentSvgElement, this.currentScale, 'mermaid');
                }
            }
        });
    }

    /**
     * Initialize the renderer with a container element.
     * @param {string} containerId - ID of the container element
     */
    async initialize(containerId) {
        if (this.domRegistry) {
            this.container = this.domRegistry.getElementSafe(containerId) || document.getElementById(containerId);
        } else {
            this.container = document.getElementById(containerId);
        }
        if (!this.container) {
            throw new Error(`MermaidRenderer: Container element with ID '${containerId}' not found`);
        }

        const storedScale = this.stateManager.getState('ui.scale');
        if (storedScale && SVGScaleUtility.isValidScale(storedScale)) {
            this.currentScale = storedScale;
        }

        this.setupContainer();
        await this.loadMermaid();
    }

    /**
     * Setup the container with proper structure.
     */
    setupContainer() {
        if (!this.container) { return; }

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
     * Load Mermaid.js library and initialize it.
     */
    async loadMermaid() {
        if (this.mermaidLoaded && window.mermaid) { return; }

        await LibraryLoader.ensureLibrary(
            'Mermaid',
            'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
            () => typeof window.mermaid !== 'undefined'
        );

        this.mermaidLoaded = true;

        if (window.mermaid) {
            const mermaidConfig = configManager.getSection('mermaid');
            window.mermaid.initialize({
                ...mermaidConfig.default,
                themeVariables: mermaidConfig.themeVariables,
                flowchart: mermaidConfig.flowchart,
                sequence: mermaidConfig.sequence,
                gantt: mermaidConfig.gantt
            });
        }
    }

    /**
     * Build Mermaid configuration with proportional scaling and dark mode support.
     */
    _buildMermaidConfig() {
        const mermaidConfig = configManager.getSection('mermaid');
        const baseFontSize = 14;
        const fontSize = mermaidConfig.default.fontSize || baseFontSize;
        const scaleFactor = fontSize / baseFontSize;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const flowchart = {
            ...mermaidConfig.flowchart,
            padding: Math.round(mermaidConfig.flowchart.padding * scaleFactor),
            nodeSpacing: Math.round(mermaidConfig.flowchart.nodeSpacing * scaleFactor),
            rankSpacing: Math.round(mermaidConfig.flowchart.rankSpacing * scaleFactor)
        };

        let themeVariables = {
            ...mermaidConfig.themeVariables,
            fontSize: `${fontSize}px`
        };

        if (isDark) {
            const rootStyles = getComputedStyle(document.documentElement);
            const getVar = (varName, fallback) => rootStyles.getPropertyValue(varName).trim() || fallback;
            
            const surfaceColor = getVar('--surface-color', '#1f2937');
            const backgroundColor = getVar('--background-color', '#2a3441');
            const textPrimary = getVar('--text-primary', '#e2e8f0');
            const textSecondary = getVar('--text-secondary', '#a8b8d0');
            
            themeVariables = {
                ...themeVariables,
                primaryColor: backgroundColor,
                primaryBorderColor: textPrimary,
                primaryTextColor: textSecondary,
                mainBkg: backgroundColor,
                secondBkg: backgroundColor,
                tertiaryColor: backgroundColor,
                altBackground: backgroundColor,
                nodeBorder: textPrimary,
                secondaryBorderColor: textPrimary,
                tertiaryBorderColor: textPrimary,
                secondaryTextColor: textSecondary,
                tertiaryTextColor: textSecondary,
                clusterBkg: 'none',
                clusterBorder: textPrimary,
                lineColor: textPrimary,
                edgeLabelBackground: surfaceColor,
                edgeLabelColor: textSecondary
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
     * Remove any leftover Mermaid error elements from the DOM.
     */
    _cleanupMermaidErrors() {
        document.querySelectorAll('[id^="dgraph-"], .mermaidTooltip').forEach(el => el.remove());
    }

    /**
     * Render Mermaid graph from raw mermaid syntax.
     * @param {string} mermaidCode - Raw Mermaid diagram code
     */
    async renderGraph(mermaidCode) {
        // Enqueue this render so that only one mermaid.render() runs at a time.
        const job = renderQueue.then(() => this._doRenderGraph(mermaidCode));
        renderQueue = job.catch(() => {});
        return job;
    }

    /**
     * Internal render implementation, called exclusively through the serial queue.
     * @param {string} mermaidCode - Raw Mermaid diagram code
     */
    async _doRenderGraph(mermaidCode) {
        try {
            const cleanResult = this.contentProcessingService.processAndValidateMermaid(mermaidCode);
            const cleanedCode = cleanResult.code;
            const appliedSteps = cleanResult.appliedSteps || [];
            
            if (appliedSteps.length > 0) {
                MermaidWarningHandler.displayWarningIndicator(this.container, appliedSteps);
            } else {
                MermaidWarningHandler.removeWarningIndicator(this.container);
            }
            
            await this.loadMermaid();

            const mermaidConfig = this._buildMermaidConfig();
            const fontSize = mermaidConfig.fontSize;
            
            window.mermaid.initialize(mermaidConfig);
            
            const root = document.documentElement;
            const backgroundColor = getComputedStyle(root).getPropertyValue('--surface-color').trim() || '#ffffff';
            
            const uniqueRenderId = ++globalRenderCount;
            
            const graphDiv = document.createElement('div');
            graphDiv.id = `mermaid-graph-${uniqueRenderId}-${Date.now()}`;
            graphDiv.style.cssText = `width: 100%; height: auto; text-align: center; padding: 20px; box-sizing: border-box; overflow: visible; background-color: ${backgroundColor};`;
            
            const existingWarning = this.container.querySelector('.mermaid-warning-indicator');
            this.container.innerHTML = '';
            if (existingWarning) {
                this.container.appendChild(existingWarning);
            }
            graphDiv.style.opacity = '0';
            this.container.appendChild(graphDiv);
            
            let svg, bindFunctions;
            try {
                const result = await window.mermaid.render(`graph-${uniqueRenderId}`, cleanedCode);
                svg = result.svg;
                bindFunctions = result.bindFunctions;
            } catch (renderError) {
                if (graphDiv.parentNode) { graphDiv.remove(); }
                this._cleanupMermaidErrors();
                
                const categorizedError = MermaidErrorHandler.categorizeError(renderError, cleanedCode);
                MermaidWarningHandler.removeWarningIndicator(this.container);
                MermaidErrorHandler.displayErrorIndicator(this.container, categorizedError);
                
                if (categorizedError.errorType === 'syntax') {
                    throw new MermaidErrorHandler.MermaidSyntaxError(
                        categorizedError.message, categorizedError.originalError, categorizedError.code
                    );
                }
                
                const wrappedError = new Error(categorizedError.message);
                wrappedError.categorizedError = categorizedError;
                throw wrappedError;
            }
            
            graphDiv.innerHTML = svg;
            if (bindFunctions) { bindFunctions(graphDiv); }

            const svgElement = graphDiv.querySelector('svg');
            if (!svgElement) {
                this.container.innerHTML = '';
                this.showFallbackContent(cleanedCode);
                return;
            }
            
            const svgText = svgElement.textContent || '';
            const errorMessages = ['Maximum text size in diagram exceeded', 'text size exceeded', 'text size in diagram'];
            const foundError = errorMessages.find(msg => svgText.includes(msg));
            if (foundError) {
                if (graphDiv.parentNode) { graphDiv.remove(); }
                const categorizedError = MermaidErrorHandler.categorizeError(new Error(foundError), cleanedCode);
                MermaidWarningHandler.removeWarningIndicator(this.container);
                MermaidErrorHandler.displayErrorIndicator(this.container, categorizedError);
                return;
            }
            
            MermaidErrorHandler.removeErrorIndicator(this.container);
            this.currentSvgElement = svgElement;

            const fontSizeStr = `${fontSize}px`;
            for (const el of svgElement.querySelectorAll('text, tspan')) {
                el.style.setProperty('font-size', fontSizeStr, 'important');
            }
            
            Object.assign(svgElement.style, {
                background: backgroundColor,
                backgroundColor: backgroundColor,
                display: 'block'
            });
            SVGScaleUtility.applyScale(svgElement, this.currentScale, 'mermaid');
            
            void svgElement.offsetHeight;
            graphDiv.style.opacity = '1';

            this.isRendered = true;
            if (this.postRenderCallback) {
                this.postRenderCallback(this.container.id, svgElement);
            }

        } catch (error) {
            if (this.container) {
                this.container.querySelectorAll('[id^="mermaid-graph-"]').forEach(el => el.remove());
            }
            
            if (error instanceof MermaidErrorHandler.MermaidSyntaxError || error.categorizedError) {
                return;
            }
            
            MermaidErrorHandler.handleError(error, this.container, mermaidCode);
        }
    }

    /**
     * Show fallback content when rendering fails.
     */
    showFallbackContent(originalCode) {
        if (!this.container) { return; }

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
     * Set post-render callback.
     * @param {Function} callback - Callback function (sectionId, svgElement) => void
     */
    setPostRenderCallback(callback) {
        this.postRenderCallback = callback;
    }
}
