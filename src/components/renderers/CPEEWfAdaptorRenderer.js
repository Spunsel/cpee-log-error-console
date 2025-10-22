/**
 * CPEE WfAdaptor Graph Renderer
 * Uses the original CPEE wfadaptor.js functionality directly
 * Leverages the authentic CPEE graph rendering system
 */

import { StatusManager } from '../../utils/dom/StatusManager.js';
import { LibraryLoader } from '../../utils/system/LibraryLoader.js';
import { XMLProcessor } from '../../utils/parsers/XMLProcessor.js';
import { SvgElementProcessor } from '../../utils/integrations/cpee/SvgElementProcessor.js';
import { CPEEJQueryExtensions } from '../../utils/integrations/cpee/CPEEJQueryExtensions.js';

export class CPEEWfAdaptorRenderer {
    
    constructor() {
        this.adaptor = null;
        this.isRendered = false;
        this.container = null;
        this.svgContainer = null;
        
        this.statusManager = null; // Will be initialized in initialize()
        this.svgProcessor = new SvgElementProcessor(); // Handles SVG element processing and caching
    }
    
    /**
     * Initialize the CPEE WfAdaptor renderer
     * @param {string} containerId - ID of the container element
     * @param {string} statusId - ID of the status element  
     * @param {string} xmlInputId - ID of the XML input textarea
     */
    async initialize(containerId, statusId, xmlInputId) {
        this.container = document.getElementById(containerId);
        this.statusElement = statusId ? document.getElementById(statusId) : null;
        this.xmlInput = xmlInputId ? document.getElementById(xmlInputId) : null;
        
        if (!this.container) {
            throw new Error(`CPEEWfAdaptorRenderer: Container with ID ${containerId} not found`);
        }
        
        this.statusManager = new StatusManager(this.statusElement);
        
        // Wait for jQuery to be available
        await this.waitForJQuery();
        
        // Setup container
        this.setupContainer();
        
    }
    
    /**
     * Wait for jQuery to be loaded and add CPEE extensions
     */
    async waitForJQuery() {
        await LibraryLoader.ensureLibrary(
            'jQuery',
            'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js',
            () => typeof $ !== 'undefined'
        );
        
        // Initialize essential jQuery extensions for CPEE
        CPEEJQueryExtensions.initialize();
    }
    
    
    /**
     * Setup container with proper structure for CPEE graph
     */
    setupContainer() {
        this.container.innerHTML = '';
        // Don't override container styling - let parent determine size
        this.container.style.cssText = `
            background: #ffffff;
            position: relative;
            width: 100%;
            height: auto;
        `;
        
        // Create SVG container matching CPEE structure with unique IDs
        const graphDiv = document.createElement('div');
        graphDiv.id = `modelling-${this.container.id}`;
        graphDiv.style.cssText = 'width: 100%; height: auto; position: relative; min-height: 100px;';
        
        const gridDiv = document.createElement('div');
        gridDiv.id = `graphgrid-${this.container.id}`;
        gridDiv.style.cssText = 'width: 100%; height: auto; min-height: 100px;';
        
        // Create SVG element for CPEE rendering with unique ID
        this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgContainer.id = `graphcanvas-${this.container.id}`;
        this.svgContainer.setAttribute('width', '100%');
        this.svgContainer.setAttribute('height', '400');
        this.svgContainer.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        this.svgContainer.setAttribute('version', '1.1');
        this.svgContainer.setAttribute('xmlns:x', 'http://www.w3.org/1999/xlink');
        this.svgContainer.style.cssText = 'display: block; max-width: 100%; height: auto;';
        
        gridDiv.appendChild(this.svgContainer);
        graphDiv.appendChild(gridDiv);
        this.container.appendChild(graphDiv);
    }
    
    /**
     * Parse and set XML description for the graph
     */
    setGraphDescription(graphrealization, cleanedXML) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanedXML, 'text/xml');
        const jqueryXmlDoc = $(xmlDoc);
        
        const descElement = jqueryXmlDoc.find('description');
        if (descElement.length === 0) {
            // Description is root element
            if (xmlDoc.documentElement && xmlDoc.documentElement.tagName === 'description') {
                const rootDesc = $(xmlDoc.documentElement);
                const wrapperDoc = $('<xml></xml>').append(rootDesc.clone());
                graphrealization.set_description(wrapperDoc, true);
            } else {
                throw new Error('CPEEWfAdaptorRenderer: No description element found in XML');
            }
        } else {
            graphrealization.set_description(jqueryXmlDoc, true);
        }
    }
    
    /**
     * Render graph from CPEE XML using original WfAdaptor
     * @param {string} cpeeXML - CPEE XML description
     */
    async renderGraph(cpeeXML) {
        try {
            this.showStatus('Loading CPEE WfAdaptor...', 'loading');
            
            // Validate XML first
            const cleanedXML = this.cleanAndValidateXML(cpeeXML);
            
            // Load the WfAdaptor and theme system
            await this.loadWfAdaptor();
                        
            // Store reference to self for use in callback
            const self = this;
            
            // Create WfAdaptor instance
            this.adaptor = new WfAdaptor('src/libs/cpee/themes/preset/theme.js', (graphrealization) => {
                try {
                    // Get and validate SVG container element
                    const svgElementId = `graphcanvas-${self.container.id}`;
                    const svgElement = document.getElementById(svgElementId);
                    
                    if (!svgElement) {
                        throw new Error(`CPEEWfAdaptorRenderer: SVG container with ID '${svgElementId}' not found`);
                    }
                    
                    const jquerySvgContainer = $(svgElement);
                    if (jquerySvgContainer.length === 0) {
                        throw new Error(`CPEEWfAdaptorRenderer: jQuery could not wrap SVG element with ID '${svgElementId}'`);
                    }
                    
                    // Process SVG elements using dedicated processor (handles caching and validation)
                    const illustratorElements = graphrealization.illustrator.elements;
                    const success = self.svgProcessor.transferAndValidateElements(
                        illustratorElements, 
                        manifestation, 
                        self.svgProcessor.getCache()
                    );
                    
                    if (!success) {
                        throw new Error('CPEEWfAdaptorRenderer: Failed to process SVG elements');
                    }
                    
                    // Final validation to prevent wfadaptor.js split() errors
                    self.svgProcessor.validateClassAttributes(illustratorElements);
                    
                    // Set SVG container
                    graphrealization.set_svg_container(jquerySvgContainer);
                    
                    // Initialize label container for hover functionality
                    const labelContainer = $(`<div id="graph-labels-${self.container.id}" style="display: none;"></div>`);
                    $(`#modelling-${self.container.id}`).append(labelContainer);
                    graphrealization.illustrator.svg.label_container = labelContainer;
            
                    // Parse and set XML description using helper method
                    self.setGraphDescription(graphrealization, cleanedXML);
                    
                    // Mark as rendered and adjust height
                    self.isRendered = true;
                    self.adjustSVGHeight();
                    
                } catch (error) {
                    console.error('Graph rendering error:', error.message);
                    self.showStatus(`Failed to render graph: ${error.message}`, 'error');
                    self.resetContainer();
                }
            });
            
        } catch (error) {
            console.error('CPEE graph error:', error.message);
            this.showStatus(`Failed to render graph: ${error.message}`, 'error');
            this.resetContainer();
        }
    }
    
    /**
     * Load the WfAdaptor and required dependencies (optimized for parallel loading)
     */
    async loadWfAdaptor() {
        const promises = [];
        
        // Load CSS (non-blocking)
        if (!document.querySelector('link[href*="wfadaptor.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'src/libs/cpee/css/wfadaptor.css';
            document.head.appendChild(cssLink);
        }
        
        // Load base theme if needed
        if (typeof WFAdaptorManifestationBase === 'undefined') {
            promises.push(new Promise((resolve, reject) => {
                const baseScript = document.createElement('script');
                baseScript.src = 'src/libs/cpee/themes/base.js';
                baseScript.onload = () => {
                    resolve();
                };
                baseScript.onerror = () => reject(new Error('Failed to load base theme'));
                document.head.appendChild(baseScript);
            }));
        }
        
        // Load WfAdaptor if needed
        if (typeof WfAdaptor === 'undefined') {
            promises.push(new Promise((resolve, reject) => {
                const wfScript = document.createElement('script');
                wfScript.src = 'src/libs/cpee/wfadaptor.js';
                wfScript.onload = () => {
                    resolve();
                };
                wfScript.onerror = () => reject(new Error('Failed to load WfAdaptor'));
                document.head.appendChild(wfScript);
            }));
        }
        
        // Wait for all dependencies to load
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }
    
    /**
     * Clean and validate CPEE XML
     */
    cleanAndValidateXML(xml) {
        return XMLProcessor.cleanAndValidate(xml);
    }
    
    /**
     * Reset container to initial state
     */
    resetContainer() {
        this.isRendered = false;
        this.setupContainer();
    }

    /**
     * Dynamically adjust SVG height based on actual content dimensions
     */
    adjustSVGHeight() {
        if (!this.svgContainer) {
            return;
        }

        try {
            // Get the SVG element
            const svg = this.svgContainer;
            
            // Check if SVG has any content before trying to get bbox
            const svgChildren = svg.children;
            if (!svgChildren || svgChildren.length === 0) {
                svg.setAttribute('height', '400');
                svg.style.height = '400px';
                return;
            }
            
            // Get the bounding box of all SVG content
            const bbox = svg.getBBox();
            
            // Validate bbox
            if (!bbox || isNaN(bbox.height) || bbox.height <= 0) {
                svg.setAttribute('height', '400');
                svg.style.height = '400px';
                return;
            }
            
            // Calculate required height with some padding
            const requiredHeight = Math.max(bbox.height + bbox.y + 20, 100); // 20px padding, min 100px
            
            // Update SVG height attributes
            svg.setAttribute('height', requiredHeight.toString());
            svg.style.height = requiredHeight + 'px';
            
            
        } catch (error) {
            // Fallback to a reasonable default height
            this.svgContainer.setAttribute('height', '400');
            this.svgContainer.style.height = '400px';
        }
    }

    /**
     * Show status message
     * @param {string} message - Status message
     * @param {string} type - Message type (loading, success, error)
     */
    showStatus(message, type = 'info') {
        // Use StatusManager utility if available
        if (this.statusManager) {
            switch (type) {
                case 'loading':
                    this.statusManager.showLoading(message);
                    break;
                case 'success':
                    this.statusManager.showSuccess(message);
                    break;
                case 'error':
                    this.statusManager.showError(message);
                    break;
                default:
                    this.statusManager.showInfo(message);
            }
            return;
        }
        
        // Legacy fallback if StatusManager not initialized
        if (!this.statusElement) return;
        
        this.statusElement.textContent = message;
        this.statusElement.className = `alert alert-${type === 'loading' ? 'info' : type === 'success' ? 'success' : 'danger'}`;
        this.statusElement.style.display = 'block';
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (this.statusElement) {
                    this.statusElement.style.display = 'none';
                }
            }, 3000);
        }
    }
    
    /**
     * Clear the current graph
     */
    clearGraph() {
        this.resetContainer();
        if (this.statusElement) {
            this.statusElement.style.display = 'none';
        }
    }
    
    /**
     * Get current graph state
     */
    getGraphState() {
        if (!this.adaptor || !this.isRendered) return null;
        
        return {
            xml: this.xmlInput ? this.xmlInput.value : null,
            svg: this.svgContainer ? new XMLSerializer().serializeToString(this.svgContainer) : null
        };
    }
}

