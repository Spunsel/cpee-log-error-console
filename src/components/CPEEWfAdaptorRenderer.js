/**
 * CPEE WfAdaptor Graph Renderer
 * Uses the original CPEE wfadaptor.js functionality directly
 * Leverages the authentic CPEE graph rendering system
 */

export class CPEEWfAdaptorRenderer {
    
    constructor() {
        this.adaptor = null;
        this.isRendered = false;
        this.container = null;
        this.svgContainer = null;
    }
    
    /**
     * Initialize the CPEE WfAdaptor renderer
     * @param {string} containerId - ID of the container element
     * @param {string} statusId - ID of the status element  
     * @param {string} xmlInputId - ID of the XML input textarea
     */
    async initialize(containerId, statusId, xmlInputId) {
        this.container = document.getElementById(containerId);
        this.statusElement = document.getElementById(statusId);
        this.xmlInput = document.getElementById(xmlInputId);
        
        if (!this.container) {
            throw new Error(`Container with ID ${containerId} not found`);
        }
        
        // Wait for jQuery to be available
        await this.waitForJQuery();
        
        // Setup container
        this.setupContainer();
        
        console.log('✅ CPEEWfAdaptorRenderer initialized');
    }
    
    /**
     * Wait for jQuery to be loaded
     */
    waitForJQuery() {
        return new Promise((resolve) => {
            if (typeof $ !== 'undefined') {
                resolve();
                return;
            }
            
            // Load jQuery if not available
            const script = document.createElement('script');
            script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js';
            script.onload = () => {
                console.log('✅ jQuery loaded');
                
                // Add essential jQuery extensions for CPEE
                this.addJQueryExtensions();
                resolve();
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * Add essential jQuery extensions needed by CPEE
     */
    addJQueryExtensions() {
        // Add $X function for XML manipulation (enhanced version)
        window.$X = function(xmlString) {
            if (typeof xmlString === 'string') {
                if (xmlString.startsWith('<')) {
                    // Parse XML string
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
                    return $(xmlDoc.documentElement);
                } else {
                    // Create element with proper namespace
                    const elem = document.createElementNS('http://www.w3.org/2000/svg', xmlString);
                    return $(elem);
                }
            }
            return $(xmlString);
        };
        
        // Add serializeXML extension
        $.fn.serializeXML = function() {
            if (this[0]) {
                return new XMLSerializer().serializeToString(this[0]);
            }
            return '';
        };
        
        // Add serializePrettyXML extension (simplified)
        $.fn.serializePrettyXML = function() {
            return this.serializeXML();
        };
        
        // Add parseQuerySimple function that CPEE uses
        $.parseQuerySimple = function() {
            const params = {};
            const urlParams = new URLSearchParams(window.location.search);
            for (const [key, value] of urlParams) {
                params[key] = value;
            }
            return params;
        };
        
        console.log('✅ jQuery extensions added');
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
        
        // Create SVG container matching CPEE structure
        const graphDiv = document.createElement('div');
        graphDiv.id = 'modelling';
        graphDiv.style.cssText = 'width: 100%; height: auto; position: relative; min-height: 100px;';
        
        const gridDiv = document.createElement('div');
        gridDiv.id = 'graphgrid';
        gridDiv.style.cssText = 'width: 100%; height: auto; min-height: 100px;';
        
        // Create SVG element for CPEE rendering - let it size naturally
        this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgContainer.id = 'graphcanvas';
        this.svgContainer.setAttribute('width', 'auto');
        this.svgContainer.setAttribute('height', 'auto');
        this.svgContainer.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        this.svgContainer.setAttribute('version', '1.1');
        this.svgContainer.setAttribute('xmlns:x', 'http://www.w3.org/1999/xlink');
        this.svgContainer.style.cssText = 'display: block; max-width: 100%;';
        
        gridDiv.appendChild(this.svgContainer);
        graphDiv.appendChild(gridDiv);
        this.container.appendChild(graphDiv);
    }
    
    /**
     * Render graph from CPEE XML using original WfAdaptor
     * @param {string} cpeeXML - CPEE XML description
     * 
     * logic:
     *  1. Clean & validate XML
     *  2. Load WfAdaptor library  
     *  3. Parse XML with DOMParser
     *  4. Create WfAdaptor instance
     *  5. Pass XML to adaptor.draw()
     *  6. Render as SVG in container
     */
    async renderGraph(cpeeXML) {
        try {
            this.showStatus('🎨 Loading CPEE WfAdaptor...', 'loading');
            
            // Validate XML first
            const cleanedXML = this.cleanAndValidateXML(cpeeXML);
            
            // Placeholder removed as requested
            
            // Load the WfAdaptor and theme system
            await this.loadWfAdaptor();
            
            this.showStatus('🎨 Rendering graph with CPEE WfAdaptor...', 'loading');
            
            // Create WfAdaptor instance
            this.adaptor = new WfAdaptor('src/libs/cpee/themes/preset/theme.js', (graphrealization) => {
                console.log('🎨 WfAdaptor loaded, rendering graph...');
                
                // Set the SVG container
                graphrealization.set_svg_container($('#graphcanvas'));
                
                // Initialize label container for hover functionality  
                if (!graphrealization.illustrator.svg.label_container) {
                    // Create a hidden container for labels that WfAdaptor expects
                    const labelContainer = $('<div id="graph-labels" style="display: none;"></div>');
                    $('#modelling').append(labelContainer);
                    graphrealization.illustrator.svg.label_container = labelContainer;
                }
                
                // Prevent WfAdaptor from interfering with main form inputs
                // Override any global event handlers that might capture form inputs
                const originalKeydown = $(document).off('keydown.wfadaptor');
                const originalKeyup = $(document).off('keyup.wfadaptor');
                const originalKeypress = $(document).off('keypress.wfadaptor');
                
                // Parse XML properly for WfAdaptor
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(cleanedXML, 'text/xml');
                
                // Debug logging
                console.log('📋 Parsed XML document:', xmlDoc);
                console.log('📋 Document element:', xmlDoc.documentElement);
                console.log('📋 Document children:', xmlDoc.documentElement ? xmlDoc.documentElement.children : 'none');
                
                // Create jQuery object from the parsed document
                const jqueryXmlDoc = $(xmlDoc);
                
                console.log('📋 jQuery XML object:', jqueryXmlDoc);
                console.log('📋 Description children:', jqueryXmlDoc.find('description'));
                console.log('📋 Description element:', jqueryXmlDoc.find('description').get(0));
                
                // Verify the structure before passing to WfAdaptor
                const descElement = jqueryXmlDoc.find('description');
                if (descElement.length === 0) {
                    // If description is not found as a child, it might be the root element
                    if (xmlDoc.documentElement && xmlDoc.documentElement.tagName === 'description') {
                        console.log('📋 Description is root element');
                        const rootDesc = $(xmlDoc.documentElement);
                        const wrapperDoc = $('<xml></xml>').append(rootDesc.clone());
                        graphrealization.set_description(wrapperDoc, true);
                    } else {
                        throw new Error('No description element found in XML');
                    }
                } else {
                    console.log('📋 Found description as child element');
                    graphrealization.set_description(jqueryXmlDoc, true);
                }
                
                console.log('✅ CPEE graph rendered successfully');
                // Success message removed as requested
                this.isRendered = true;
                
                // Add controls
                this.addGraphControls();
            });
            
        } catch (error) {
            console.error('❌ Error rendering CPEE graph:', error);
            this.showStatus(`❌ Failed to render graph: ${error.message}`, 'error');
            this.resetContainer();
        }
    }
    
    /**
     * Load the WfAdaptor and required dependencies
     */
    async loadWfAdaptor() {
        return new Promise((resolve, reject) => {
            // Load CSS first
            if (!document.querySelector('link[href*="wfadaptor.css"]')) {
                const cssLink = document.createElement('link');
                cssLink.rel = 'stylesheet';
                cssLink.href = 'src/libs/cpee/css/wfadaptor.css';
                document.head.appendChild(cssLink);
            }
            
            // Load base theme
            if (typeof WFAdaptorManifestationBase === 'undefined') {
                const baseScript = document.createElement('script');
                baseScript.src = 'src/libs/cpee/themes/base.js';
                baseScript.onload = () => {
                    console.log('✅ Base theme loaded');
                    
                    // Load WfAdaptor
                    if (typeof WfAdaptor === 'undefined') {
                        const wfScript = document.createElement('script');
                        wfScript.src = 'src/libs/cpee/wfadaptor.js';
                        wfScript.onload = () => {
                            console.log('✅ WfAdaptor loaded');
                            resolve();
                        };
                        wfScript.onerror = () => reject(new Error('Failed to load WfAdaptor'));
                        document.head.appendChild(wfScript);
                    } else {
                        resolve();
                    }
                };
                baseScript.onerror = () => reject(new Error('Failed to load base theme'));
                document.head.appendChild(baseScript);
            } else if (typeof WfAdaptor === 'undefined') {
                const wfScript = document.createElement('script');
                wfScript.src = 'src/libs/cpee/wfadaptor.js';
                wfScript.onload = () => {
                    console.log('✅ WfAdaptor loaded');
                    resolve();
                };
                wfScript.onerror = () => reject(new Error('Failed to load WfAdaptor'));
                document.head.appendChild(wfScript);
            } else {
                resolve();
            }
        });
    }
    
    /**
     * Clean and validate CPEE XML
     */
    cleanAndValidateXML(xml) {
        if (!xml || typeof xml !== 'string') {
            throw new Error('Invalid XML input');
        }
        
        // Remove HTML comments and extra whitespace
        let cleanedXML = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any leading whitespace and newlines
        cleanedXML = cleanedXML.replace(/^\s+/, '');
        
        // If no XML declaration, add one
        if (!cleanedXML.startsWith('<?xml')) {
            cleanedXML = '<?xml version="1.0"?>\n' + cleanedXML;
        }
        
        // Validate basic XML structure
        if (!cleanedXML.includes('<description')) {
            throw new Error('Invalid CPEE XML: Missing <description> element');
        }
        
        // Parse and validate the XML structure
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(cleanedXML, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing error: ' + parseError.textContent);
            }
            
            // Ensure we have a proper description element
            const descElement = xmlDoc.querySelector('description');
            if (!descElement) {
                throw new Error('No valid <description> element found');
            }
            
            console.log('✅ XML validation successful');
            return cleanedXML;
            
        } catch (error) {
            console.error('❌ XML validation failed:', error);
            throw new Error('Invalid XML structure: ' + error.message);
        }
    }
    
    /**
     * Add additional controls for the rendered graph
     */
    addGraphControls() {
        // Remove existing controls
        const existingControls = this.container.querySelector('.graph-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        // Graph controls have been removed as requested
        // The graph will display without additional control buttons
    }
    
    /**
     * Reset container to initial state
     */
    resetContainer() {
        this.isRendered = false;
        this.adaptor = null;
        this.setupContainer();
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
