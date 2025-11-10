/**
 * CPEE WfAdaptor Graph Renderer
 * Uses the original CPEE wfadaptor.js functionality directly
 */

import { DOMStatusManager } from '../../utils/dom/DOMStatusManager.js';
import { LibraryLoader } from '../../utils/system/LibraryLoader.js';
import { SVGProcessor } from '../../utils/dom/SVGProcessor.js';
import { SVGScaleUtility } from '../../utils/dom/SVGScaleUtility.js';
import { JQueryExtensions } from '../../utils/system/JQueryExtensions.js';
import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { DOMRegistry } from '../../core/DOMRegistry.js';
import { serviceFactory } from '../../core/ServiceFactory.js';

export class CPEEWfAdaptorRenderer {
    
    constructor(eventBus = null, stateManager = null, domRegistry = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.adaptor = null;
        this.isRendered = false;
        this.container = null;
        this.svgContainer = null;
        
        this.statusManager = null; // Will be initialized in initialize()
        this.svgProcessor = new SVGProcessor(); // Handles SVG element processing and caching
        
        // Post-render callback for highlighting integration
        this.postRenderCallback = null;
        
        // Content processing service
        this.contentProcessingService = contentProcessingService || serviceFactory.get('ContentProcessingService');
        
        // Scale management
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.defaultScale = configManager.get('rendering.scaling.default') || 1.0;
        
        // Load scale from StateManager (which loads from localStorage)
        const storedScale = this.stateManager.getState('ui.scale');
        this.currentScale = storedScale && SVGScaleUtility.isValidScale(storedScale) 
            ? storedScale 
            : this.defaultScale;
        this.currentSvgElement = null; // Track current SVG container for scale updates
        
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
     * Apply scale transform to CPEE SVG container
     * CPEE graphs use nested SVG structure, so we apply transform to the outer SVG
     * Uses SVGScaleUtility for consistent scaling
     * @param {HTMLElement} svgContainer - SVG container element
     */
    applyScaleTransform(svgContainer) {
        if (!svgContainer) {
            return;
        }
        
        // Use utility function for consistent scaling with CPEE structure
        SVGScaleUtility.applyScale(svgContainer, this.currentScale, 'cpee');
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
     * Initialize the CPEE WfAdaptor renderer
     * @param {string} containerId - ID of the container element
     * @param {string} statusId - ID of the status element  
     * @param {string} xmlInputId - ID of the XML input textarea
     */
    async initialize(containerId, statusId, xmlInputId) {
        // Load current scale from StateManager
        this.loadCurrentScale();
        
        // Use DOMRegistry if available, otherwise fallback to getElementById
        // Use getElementSafe for dynamic IDs to avoid warnings
        if (this.domRegistry) {
            this.container = this.domRegistry.getElementSafe(containerId) || document.getElementById(containerId);
            this.statusElement = statusId ? (this.domRegistry.getElementSafe(statusId) || document.getElementById(statusId)) : null;
            this.xmlInput = xmlInputId ? (this.domRegistry.getElementSafe(xmlInputId) || document.getElementById(xmlInputId)) : null;
        } else {
            this.container = document.getElementById(containerId);
            this.statusElement = statusId ? document.getElementById(statusId) : null;
            this.xmlInput = xmlInputId ? document.getElementById(xmlInputId) : null;
        }
        
        if (!this.container) {
            throw new Error(`CPEEWfAdaptorRenderer: Container with ID ${containerId} not found`);
        }
        
        this.statusManager = new DOMStatusManager(this.statusElement);
        
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
            JQueryExtensions.initialize();
    }
    
    
    /**
     * Setup container with proper structure for CPEE graph
     */
    setupContainer() {
        this.container.innerHTML = '';
        
        // Get background color from CSS variable
        const root = document.documentElement;
        const backgroundColor = getComputedStyle(root).getPropertyValue('--surface-color').trim() || (configManager.get('rendering.containers.graphContainer.background') || '#ffffff');
        
        // Don't override container styling - let parent determine size
        this.container.style.cssText = `
            background: ${backgroundColor};
            position: relative;
            width: ${configManager.get('rendering.containers.graphContainer.width')};
            height: auto;
        `;
        
        // Create SVG container matching CPEE structure with unique IDs
        const graphDiv = document.createElement('div');
        graphDiv.id = `modelling-${this.container.id}`;
        const minHeight = configManager.get('rendering.containers.graphContainer.minHeight');
        graphDiv.style.cssText = `width: 100%; height: auto; position: relative; min-height: ${minHeight}; background: ${backgroundColor};`;
        
        const gridDiv = document.createElement('div');
        gridDiv.id = `graphgrid-${this.container.id}`;
        gridDiv.style.cssText = `width: 100%; height: auto; min-height: ${minHeight}; background: ${backgroundColor};`;
        
        // Create SVG element for CPEE rendering with unique ID
        this.svgContainer = document.createElementNS(configManager.get('rendering.svg.namespace'), 'svg');
        this.svgContainer.id = `graphcanvas-${this.container.id}`;
        this.svgContainer.setAttribute('xmlns', configManager.get('rendering.svg.namespace'));
        this.svgContainer.setAttribute('version', configManager.get('rendering.svg.version'));
        this.svgContainer.setAttribute('xmlns:x', configManager.get('rendering.svg.xmlnsX'));
        this.svgContainer.style.cssText = `display: block; width: auto; height: auto; background-color: ${backgroundColor};`;
        
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
        const jqueryXmlDoc = window.$(xmlDoc);
        
        const descElement = jqueryXmlDoc.find('description');
        if (descElement.length === 0) {
            // Description is root element
            if (xmlDoc.documentElement && xmlDoc.documentElement.tagName === 'description') {
                const rootDesc = window.$(xmlDoc.documentElement);
                const wrapperDoc = window.$('<xml></xml>').append(rootDesc.clone());
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
            const cleanedXML = this.contentProcessingService.processAndValidateCPEEXML(cpeeXML);
            
            // Load the WfAdaptor and theme system
            await this.loadWfAdaptor();
                        
            // Store reference to self for use in callback
            const self = this;
            
            // Get theme path from configuration (config is under 'cpee.wfadaptor' key)
            const themePath = configManager.get('cpee.wfadaptor.themePath');
            
            // Create WfAdaptor instance
            this.adaptor = new window.WfAdaptor(themePath, (graphrealization) => {
                try {
                    // Get and validate SVG container element
                    const svgElementId = `graphcanvas-${self.container.id}`;
                    // SVG elements are dynamically created, so use getElementById directly
                    const svgElement = document.getElementById(svgElementId);
                    
                    if (!svgElement) {
                        throw new Error(`CPEEWfAdaptorRenderer: SVG container with ID '${svgElementId}' not found`);
                    }
                    
                    // Store reference to current SVG for scale updates
                    self.currentSvgElement = svgElement;
                    
                    const jquerySvgContainer = window.$(svgElement);
                    if (jquerySvgContainer.length === 0) {
                        throw new Error(`CPEEWfAdaptorRenderer: jQuery could not wrap SVG element with ID '${svgElementId}'`);
                    }
                    
                    // Process SVG elements using dedicated processor (handles caching and validation)
                    const illustratorElements = graphrealization.illustrator.elements;
                    // manifestation is available as a global variable set by wfadaptor.js after theme loading
                    const manifestation = window.manifestation || null;
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
                    const labelContainer = window.$(`<div id="graph-labels-${self.container.id}" style="display: none;"></div>`);
                    window.$(`#modelling-${self.container.id}`).append(labelContainer);
                    graphrealization.illustrator.svg.label_container = labelContainer;
            
                    // Parse and set XML description using helper method
                    self.setGraphDescription(graphrealization, cleanedXML);
                    
                    // Mark as rendered and adjust height
                    self.isRendered = true;
                    self.adjustSVGHeight();
                    
                    // Apply current scale to the rendered graph
                    self.applyScaleTransform(svgElement);
                    
                    // Call post-render callback if set
                    if (self.postRenderCallback) {
                        console.log('[CPEEWfAdaptorRenderer] Calling post-render callback');
                        self.postRenderCallback(self.container.id, svgElement);
                    }
                    
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
        
        // Get paths from configuration (config is under 'cpee.wfadaptor' key)
        const cssPath = configManager.get('cpee.wfadaptor.cssPath');
        const baseThemePath = configManager.get('cpee.wfadaptor.baseThemePath');
        const wfadaptorPath = configManager.get('cpee.wfadaptor.wfadaptorPath');
        
        // Load CSS (non-blocking)
        if (!document.querySelector('link[href*="wfadaptor.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = cssPath;
            document.head.appendChild(cssLink);
        }
        
        // Load base theme if needed
        if (typeof WFAdaptorManifestationBase === 'undefined') {
            promises.push(new Promise((resolve, reject) => {
                const baseScript = document.createElement('script');
                baseScript.src = baseThemePath;
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
                wfScript.src = wfadaptorPath;
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
     * Set post-render callback
     * @param {Function} callback - Callback function (sectionId, svgElement) => void
     */
    setPostRenderCallback(callback) {
        this.postRenderCallback = callback;
        console.log('[CPEEWfAdaptorRenderer] Post-render callback set');
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
        
        // Fallback: Direct DOM manipulation if StatusManager not initialized
        if (!this.statusElement) {
            return;
        }
        
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
        if (!this.adaptor || !this.isRendered) {
            return null;
        }
        
        return {
            xml: this.xmlInput ? this.xmlInput.value : null,
            svg: this.svgContainer ? new XMLSerializer().serializeToString(this.svgContainer) : null
        };
    }
}