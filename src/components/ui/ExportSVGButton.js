/**
 * ExportSVGButton Component
 * Provides SVG export/download functionality for graph visualizations
 * Extracts SVG from container and triggers download
 */

import { ICONS } from '../../assets/icons.js';

export class ExportSVGButton {
    constructor(domRegistry = null, options = {}) {
        this.domRegistry = domRegistry;
        
        // Configuration
        this.options = {
            showIcon: options.showIcon !== false,
            showText: options.showText !== false,
            successDuration: options.successDuration || 500,
            onExportSuccess: options.onExportSuccess || null,
            onExportError: options.onExportError || null,
            ...options
        };
        
        this.element = null;
        this.originalContent = null;
        this.isExporting = false;
        this.graphContainer = null;
        this.filename = null;
    }

    /**
     * Create an export SVG button
     * @param {HTMLElement} graphContainer - Container element containing the SVG
     * @param {string} filename - Filename for download (without extension)
     * @param {string} buttonText - Button label
     * @returns {HTMLElement} Button element
     */
    createButton(graphContainer, filename, buttonText = 'Export SVG') {
        this.graphContainer = graphContainer;
        this.filename = filename;
        
        const createElement = this.domRegistry 
            ? this.domRegistry.createElement.bind(this.domRegistry)
            : (tag, props) => {
                const el = document.createElement(tag);
                if (props.className) el.className = props.className;
                if (props.type) el.type = props.type;
                if (props.title) el.title = props.title;
                return el;
            };
        
        const button = createElement('button', {
            className: 'export-svg-btn',
            type: 'button',
            title: 'Export SVG'
        });

        // Store original content
        this.originalContent = buttonText;
        
        // Create button content
        const buttonContainer = createElement('span', {
            className: 'export-svg-btn-content'
        });

        if (this.options.showIcon) {
            // Create a wrapper span for the icon
            const iconWrapper = createElement('span', {
                className: 'export-svg-icon-wrapper'
            });
            iconWrapper.innerHTML = ICONS.DOWNLOAD;
            buttonContainer.appendChild(iconWrapper);
        }

        if (this.options.showText) {
            const text = createElement('span', {
                className: 'export-svg-text'
            });
            text.textContent = buttonText;
            buttonContainer.appendChild(text);
        }

        button.appendChild(buttonContainer);
        button.addEventListener('click', () => this.exportSVG());

        this.element = button;
        return button;
    }

    /**
     * Export SVG from container and trigger download
     * @returns {boolean} Success status
     */
    exportSVG() {
        if (this.isExporting || !this.graphContainer) {
            return false;
        }

        this.isExporting = true;
        
        try {
            // Find the actual graph SVG element in the container
            // Must exclude small icon SVGs (buttons, indicators) and find the real graph
            const svgElement = this.findGraphSVG();
            if (!svgElement) {
                throw new Error('No graph SVG element found in container');
            }
            
            // Clone the SVG
            const svgClone = svgElement.cloneNode(true);
            
            // Only add namespace if not present (required for standalone SVG)
            if (!svgClone.getAttribute('xmlns')) {
                svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
            if (!svgClone.getAttribute('xmlns:xlink')) {
                svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            }
            
            // Check if this is a CPEE graph (has CPEE-specific classes)
            const isCPEEGraph = svgClone.querySelector('.colorstyle, .stand, .execstyle') !== null;
            // Check if this is a Mermaid graph (has Mermaid-specific classes)
            const isMermaidGraph = svgClone.querySelector('.node, .edgePath, .flowchart-link, .nodeLabel') !== null;
            
            if (isCPEEGraph) {
                // Clean up CPEE-specific elements not needed in export
                this.cleanupCPEEElements(svgClone);
                // Embed CPEE styles for standalone viewing
                this.embedCPEEStyles(svgClone);
            } else if (isMermaidGraph) {
                // Embed Mermaid styles for standalone viewing with Adwaita font
                this.embedMermaidStyles(svgClone);
            }
            
            // Serialize SVG to string
            const serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(svgClone);
            
            // Add XML declaration
            svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
            
            // Create blob and download
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `${this.filename}.svg`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            this.showSuccess();
            
            if (this.options.onExportSuccess) {
                this.options.onExportSuccess(this.filename, svgString);
            }
            
            return true;
        } catch (error) {
            console.error('SVG export failed:', error);
            this.showError(error.message);
            
            if (this.options.onExportError) {
                this.options.onExportError(error);
            }
            
            return false;
        } finally {
            this.isExporting = false;
        }
    }

    /**
     * Remove CPEE elements that shouldn't be in the export
     * - .tile rectangles (blue highlight backgrounds)
     * - .super text elements (execution status counters like ▶0,0)
     * - .duration text (timing info)
     * @param {SVGElement} svgClone - Cloned SVG element
     */
    cleanupCPEEElements(svgClone) {
        // Remove tile rectangles (blue background highlights)
        const tiles = svgClone.querySelectorAll('rect.tile, .tile');
        tiles.forEach(el => el.remove());
        
        // Remove super text elements (▶0,0 execution counters)
        const superTexts = svgClone.querySelectorAll('text.super');
        superTexts.forEach(el => el.remove());
        
        // Remove duration text
        const durationTexts = svgClone.querySelectorAll('text.duration');
        durationTexts.forEach(el => el.remove());
        
        // Remove hoverstyle/markstyle groups (already hidden by CSS but remove from DOM)
        const hoverMarks = svgClone.querySelectorAll('.hoverstyle, .markstyle');
        hoverMarks.forEach(el => el.remove());
    }

    /**
     * Embed CPEE styles into SVG for standalone viewing
     * These styles match the rendering styles from graphs.css and wfadaptor
     * @param {SVGElement} svgClone - Cloned SVG element
     */
    embedCPEEStyles(svgClone) {
        // Get computed colors from CSS variables for proper theming
        const computedStyle = getComputedStyle(document.documentElement);
        const surfaceColor = computedStyle.getPropertyValue('--surface-color').trim() || '#ffffff';
        const textColor = computedStyle.getPropertyValue('--text-primary').trim() || '#000000';
        // Use Adwaita Sans as primary font for exported SVG
        const fontSans = "'Adwaita Sans', 'Segoe UI', system-ui, sans-serif";
        
        // Essential CPEE styles for standalone SVG rendering
        // Matches the styling from graphs.css used during rendering
        // Note: .tile, .super, .duration, .hoverstyle, .markstyle are removed by cleanupCPEEElements
        const cpeeStyles = `
            /* CPEE WfAdaptor styles for standalone SVG - matching graphs.css */
            
            /* Base SVG styling */
            svg {
                font-family: ${fontSans};
                background-color: ${surfaceColor};
            }
            
            /* Text styling - same font as rendered */
            text, tspan {
                font-family: ${fontSans};
                fill: ${textColor};
            }
            
            text.label {
                font-family: ${fontSans};
                font-size: 11px;
                fill: ${textColor};
            }
            
            text.label.standalone {
                font-size: 11px;
                stroke: ${surfaceColor};
                fill: ${textColor};
            }
            
            /* CPEE element classes */
            .colorstyle {
                fill: ${surfaceColor};
                stroke: ${textColor};
                stroke-width: 1px;
            }
            
            .stand {
                fill: none;
                stroke: ${textColor};
                stroke-width: 1px;
            }
            
            .standfat {
                fill: none;
                stroke: ${textColor};
                stroke-width: 3px;
            }
            
            .standline {
                stroke: ${textColor};
                stroke-width: 1px;
            }
            
            .standwithout {
                fill: ${surfaceColor};
                stroke: ${surfaceColor};
            }
            
            .execstyle { }
            
            .edge {
                fill: none;
                stroke: ${textColor};
                stroke-width: 1px;
                marker-end: url(#arrow);
            }
            
            .white {
                fill: ${surfaceColor};
                stroke: none;
            }
            
            .normal {
                fill: ${textColor};
            }
            
            .activities title {
                display: none;
            }
            
            /* Shapes */
            path {
                stroke: ${textColor};
                fill: none;
            }
            
            path.edge {
                fill: none;
                stroke: ${textColor};
                stroke-width: 1px;
            }
            
            rect {
                fill: ${surfaceColor};
                stroke: ${textColor};
            }
            
            rect.colorstyle {
                fill: ${surfaceColor};
                stroke: ${textColor};
            }
            
            circle {
                fill: ${surfaceColor};
                stroke: ${textColor};
            }
            
            circle.colorstyle {
                fill: ${surfaceColor};
                stroke: ${textColor};
            }
            
            ellipse {
                fill: ${surfaceColor};
                stroke: ${textColor};
            }
            
            polygon {
                fill: ${surfaceColor};
                stroke: ${textColor};
            }
            
            polyline, line {
                stroke: ${textColor};
                fill: none;
            }
            
            /* Markers/arrows */
            marker * {
                fill: ${textColor};
                stroke: ${textColor};
            }
            
            /* Groups */
            g {
                fill: none;
            }
        `;
        
        // Find or create defs element
        let defs = svgClone.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svgClone.insertBefore(defs, svgClone.firstChild);
        }
        
        // Create and add style element
        const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleElement.setAttribute('type', 'text/css');
        styleElement.textContent = cpeeStyles;
        defs.appendChild(styleElement);
    }

    /**
     * Embed Mermaid styles into SVG for standalone viewing
     * Sets Adwaita font for all text elements
     * @param {SVGElement} svgClone - Cloned SVG element
     */
    embedMermaidStyles(svgClone) {
        // Mermaid styles with Adwaita font
        const mermaidStyles = `
            /* Mermaid styles for standalone SVG with Adwaita font */
            text, tspan, .nodeLabel, .edgeLabel, .label {
                font-family: 'Adwaita', 'Adwaita Sans', 'Segoe UI', sans-serif !important;
            }
            .node text, .node tspan {
                font-family: 'Adwaita', 'Adwaita Sans', 'Segoe UI', sans-serif !important;
            }
            .edgeLabel text, .edgeLabel tspan {
                font-family: 'Adwaita', 'Adwaita Sans', 'Segoe UI', sans-serif !important;
            }
            foreignObject div, foreignObject span {
                font-family: 'Adwaita', 'Adwaita Sans', 'Segoe UI', sans-serif !important;
            }
        `;
        
        // Find or create defs element
        let defs = svgClone.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svgClone.insertBefore(defs, svgClone.firstChild);
        }
        
        // Create and add style element
        const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleElement.setAttribute('type', 'text/css');
        styleElement.textContent = mermaidStyles;
        defs.appendChild(styleElement);
    }

    /**
     * Find the actual graph SVG element in the container
     * Excludes small icon SVGs (buttons, indicators) and finds the real graph
     * @returns {SVGElement|null} The graph SVG element or null if not found
     */
    findGraphSVG() {
        if (!this.graphContainer) {
            return null;
        }

        // Strategy 1: Find SVG with Mermaid-specific classes
        const mermaidSvg = this.graphContainer.querySelector('svg:has(.node), svg:has(.edgePath), svg:has(.flowchart-link)');
        if (mermaidSvg) {
            return mermaidSvg;
        }

        // Strategy 2: Find SVG with CPEE-specific classes
        const cpeeSvg = this.graphContainer.querySelector('svg:has(.colorstyle), svg:has(.stand), svg:has(.execstyle)');
        if (cpeeSvg) {
            return cpeeSvg;
        }

        // Strategy 3: Find the largest SVG (actual graphs are much larger than icons)
        const allSvgs = this.graphContainer.querySelectorAll('svg');
        let largestSvg = null;
        let largestArea = 0;

        for (const svg of allSvgs) {
            // Get dimensions from various sources
            const width = svg.width?.baseVal?.value || 
                         parseFloat(svg.getAttribute('width')) || 
                         svg.viewBox?.baseVal?.width ||
                         svg.getBoundingClientRect().width || 0;
            const height = svg.height?.baseVal?.value || 
                          parseFloat(svg.getAttribute('height')) || 
                          svg.viewBox?.baseVal?.height ||
                          svg.getBoundingClientRect().height || 0;
            
            const area = width * height;
            
            // Skip small icons (typically 16x16, 20x20, 24x24)
            // Graph SVGs are typically much larger (100+ width)
            if (width > 50 && height > 50 && area > largestArea) {
                largestArea = area;
                largestSvg = svg;
            }
        }

        if (largestSvg) {
            return largestSvg;
        }

        // Fallback: return the first SVG (original behavior)
        return this.graphContainer.querySelector('svg');
    }

    /**
     * Show success feedback
     */
    showSuccess() {
        if (!this.element) { 
            return;
        }

        this.element.classList.add('export-svg-success');
        
        // Update button text
        if (this.options.showText) {
            const textSpan = this.element.querySelector('.export-svg-text');
            if (textSpan) {
                textSpan.textContent = 'Exported';
            }
        }

        // Update icon to checkmark
        if (this.options.showIcon) {
            const iconWrapper = this.element.querySelector('.export-svg-icon-wrapper');
            if (iconWrapper) {
                iconWrapper.innerHTML = ICONS.CHECK;
            }
        }

        // Reset after duration
        setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('export-svg-success');
                
                if (this.options.showText) {
                    const textSpan = this.element.querySelector('.export-svg-text');
                    if (textSpan) {
                        textSpan.textContent = this.originalContent;
                    }
                }

                if (this.options.showIcon) {
                    const iconWrapper = this.element.querySelector('.export-svg-icon-wrapper');
                    if (iconWrapper) {
                        iconWrapper.innerHTML = ICONS.DOWNLOAD;
                    }
                }
            }
        }, this.options.successDuration);
    }

    /**
     * Show error feedback
     * @param {string} message - Error message
     */
    showError(message = 'Export failed') {
        if (!this.element) {
             return;
        }

        console.error('SVG export error:', message);
        this.element.classList.add('export-svg-error');

        if (this.options.showText) {
            const textSpan = this.element.querySelector('.export-svg-text');
            if (textSpan) {
                textSpan.textContent = '✗ Failed';
                textSpan.title = message;
            }
        }

        // Reset after duration
        setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('export-svg-error');
                
                if (this.options.showText) {
                    const textSpan = this.element.querySelector('.export-svg-text');
                    if (textSpan) {
                        textSpan.textContent = this.originalContent;
                    }
                }
            }
        }, this.options.successDuration);
    }

    /**
     * Update the graph container reference
     * @param {HTMLElement} container - New graph container
     */
    setGraphContainer(container) {
        this.graphContainer = container;
    }

    /**
     * Set new filename
     * @param {string} filename - New filename (without extension)
     */
    setFilename(filename) {
        this.filename = filename;
        // Title stays as "Export SVG" regardless of filename
    }

    /**
     * Enable/disable button
     * @param {boolean} enabled - Enable state
     */
    setEnabled(enabled) {
        if (this.element) {
            this.element.disabled = !enabled;
            this.element.classList.toggle('disabled', !enabled);
        }
    }

    /**
     * Destroy button and cleanup
     */
    destroy() {
        if (this.element) {
            this.element.removeEventListener('click', () => this.exportSVG());
            this.element = null;
        }
        this.graphContainer = null;
        this.filename = null;
        this.originalContent = null;
    }

    /**
     * Generate filename based on section metadata
     * @param {number} instanceNumber - CPEE instance/process number
     * @param {number} stepNumber - Step number
     * @param {string} sectionId - Section identifier (e.g., 'input-cpee', 'output-intermediate')
     * @returns {string} Generated filename (without extension)
     */
    static generateFilename(instanceNumber, stepNumber, sectionId) {
        // Determine input/output (I/O)
        const isOutput = sectionId.startsWith('output');
        const ioPrefix = isOutput ? 'O' : 'I';
        
        // Determine graph type based on section type
        const isCpee = sectionId.includes('cpee');
        const graphType = isCpee ? 'Cpee' : 'Mermaid';
        
        // Format: <process number>_Step<step number>_<Mermaid|Cpee>_<I/O>
        // Note: .svg will be appended by the export function
        return `${instanceNumber}_Step${stepNumber}_${graphType}_${ioPrefix}`;
    }
}

