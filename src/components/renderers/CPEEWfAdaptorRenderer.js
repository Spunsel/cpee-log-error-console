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
import { serviceFactory } from '../../core/ServiceFactory.js';
import { CPEEWarningHandler } from '../../utils/content/CPEEWarningHandler.js';

export class CPEEWfAdaptorRenderer {
    
    static _wfAdaptorCache = new Map();
    
    constructor(eventBus = null, stateManager = null, domRegistry = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.adaptor = null;
        this.isRendered = false;
        this.container = null;
        this.svgContainer = null;
        this.statusManager = null;
        this.svgProcessor = new SVGProcessor();
        this._renderGeneration = 0;
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
                    SVGScaleUtility.applyScale(this.currentSvgElement, this.currentScale, 'cpee');
                }
            }
        });
    }
    
    /**
     * Initialize the CPEE WfAdaptor renderer
     * @param {string} containerId - ID of the container element
     */
    async initialize(containerId) {
        // Load scale from StateManager (persisted in localStorage)
        const storedScale = this.stateManager.getState('ui.scale');
        if (storedScale && SVGScaleUtility.isValidScale(storedScale)) {
            this.currentScale = storedScale;
        }
        
        if (this.domRegistry) {
            this.container = this.domRegistry.getElementSafe(containerId) || document.getElementById(containerId);
        } else {
            this.container = document.getElementById(containerId);
        }
        
        if (!this.container) {
            throw new Error(`CPEEWfAdaptorRenderer: Container with ID ${containerId} not found`);
        }
        
        this.statusManager = new DOMStatusManager(null);
        
        await this.waitForJQuery();
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
        JQueryExtensions.initialize();
    }
    
    /**
     * Setup container with proper structure for CPEE graph
     */
    setupContainer() {
        this.container.innerHTML = '';
        
        const root = document.documentElement;
        const backgroundColor = getComputedStyle(root).getPropertyValue('--surface-color').trim() || (configManager.get('rendering.containers.graphContainer.background') || '#ffffff');
        
        this.container.style.cssText = `
            background: ${backgroundColor};
            position: relative;
            width: ${configManager.get('rendering.containers.graphContainer.width')};
            height: auto;
        `;
        
        const graphDiv = document.createElement('div');
        graphDiv.id = `modelling-${this.container.id}`;
        const minHeight = configManager.get('rendering.containers.graphContainer.minHeight');
        graphDiv.style.cssText = `width: 100%; height: auto; position: relative; min-height: ${minHeight}; background: ${backgroundColor};`;
        
        const gridDiv = document.createElement('div');
        gridDiv.id = `graphgrid-${this.container.id}`;
        gridDiv.style.cssText = `width: 100%; height: auto; min-height: ${minHeight}; background: ${backgroundColor};`;
        
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
        const renderGen = ++this._renderGeneration;
        
        try {
            this.showStatus('Loading CPEE WfAdaptor...', 'loading');
            
            const cleanResult = this.contentProcessingService.processAndValidateCPEE(cpeeXML, true);
            const cleanedXML = cleanResult.xml;
            const appliedSteps = cleanResult.appliedSteps || [];
            
            if (appliedSteps.length > 0) {
                CPEEWarningHandler.displayWarningIndicator(this.container, appliedSteps);
            } else {
                CPEEWarningHandler.removeWarningIndicator(this.container);
            }
            
            await this.loadWfAdaptor();
            
            if (renderGen !== this._renderGeneration) { return; }
            
            const themePath = configManager.get('cpee.wfadaptor.themePath');
            const cached = CPEEWfAdaptorRenderer._wfAdaptorCache.get(themePath);
            
            if (cached) {
                this._renderWithCachedAdaptor(cached, cleanedXML, renderGen);
            } else {
                this._renderWithNewAdaptor(themePath, cleanedXML, renderGen);
            }
            
        } catch (error) {
            console.error('CPEE graph error:', error.message);
            this.showStatus(`Failed to render graph: ${error.message}`, 'error');
            this.isRendered = false;
            this.setupContainer();
        }
    }
    
    /**
     * Render using a cached WfAdaptor graphrealization (skip theme loading)
     * @param {Object} cached - Cached entry { graphrealization, adaptor }
     * @param {string} cleanedXML - Pre-processed CPEE XML
     * @param {number} renderGen - Render generation for stale check
     */
    _renderWithCachedAdaptor(cached, cleanedXML, renderGen) {
        if (renderGen !== this._renderGeneration) { return; }
        
        try {
            const { graphrealization } = cached;
            this.adaptor = cached.adaptor;
            
            const svgElementId = `graphcanvas-${this.container.id}`;
            const svgElement = document.getElementById(svgElementId);
            
            if (!svgElement) {
                throw new Error(`CPEEWfAdaptorRenderer: SVG container with ID '${svgElementId}' not found`);
            }
            
            this.currentSvgElement = svgElement;
            
            const jquerySvgContainer = window.$(svgElement);
            if (jquerySvgContainer.length === 0) {
                throw new Error(`CPEEWfAdaptorRenderer: jQuery could not wrap SVG element with ID '${svgElementId}'`);
            }
            
            const illustratorElements = graphrealization.illustrator.elements;
            const success = this.svgProcessor.transferAndValidateElements(
                illustratorElements, null, this.svgProcessor.getCache()
            );
            
            if (!success) {
                throw new Error('CPEEWfAdaptorRenderer: Failed to process SVG elements');
            }
            
            this.svgProcessor.validateClassAttributes(illustratorElements);
            graphrealization.set_svg_container(jquerySvgContainer);
            
            const labelContainer = window.$(`<div id="graph-labels-${this.container.id}" style="display: none;"></div>`);
            window.$(`#modelling-${this.container.id}`).append(labelContainer);
            graphrealization.illustrator.svg.label_container = labelContainer;
            
            this.setGraphDescription(graphrealization, cleanedXML);
            this.namespaceSVGIds(svgElement);
            
            this.isRendered = true;
            this.adjustSVGHeight();
            SVGScaleUtility.applyScale(svgElement, this.currentScale, 'cpee');
            
            if (this.postRenderCallback) {
                this.postRenderCallback(this.container.id, svgElement);
            }
            
        } catch (error) {
            console.error('Graph rendering error (cached):', error.message);
            this.showStatus(`Failed to render graph: ${error.message}`, 'error');
            this.isRendered = false;
            this.setupContainer();
        }
    }
    
    /**
     * Render by creating a new WfAdaptor instance (first render for this theme)
     * Caches the result for subsequent renders with the same theme.
     * @param {string} themePath - Theme URL/path
     * @param {string} cleanedXML - Pre-processed CPEE XML
     * @param {number} renderGen - Render generation for stale check
     */
    _renderWithNewAdaptor(themePath, cleanedXML, renderGen) {
        const self = this;
        
        this.adaptor = new window.WfAdaptor(themePath, (graphrealization) => {
            if (renderGen !== self._renderGeneration) { return; }
            
            try {
                CPEEWfAdaptorRenderer._wfAdaptorCache.set(themePath, {
                    graphrealization: graphrealization,
                    adaptor: self.adaptor
                });
                
                const svgElementId = `graphcanvas-${self.container.id}`;
                const svgElement = document.getElementById(svgElementId);
                
                if (!svgElement) {
                    throw new Error(`CPEEWfAdaptorRenderer: SVG container with ID '${svgElementId}' not found`);
                }
                
                self.currentSvgElement = svgElement;
                
                const jquerySvgContainer = window.$(svgElement);
                if (jquerySvgContainer.length === 0) {
                    throw new Error(`CPEEWfAdaptorRenderer: jQuery could not wrap SVG element with ID '${svgElementId}'`);
                }
                
                const illustratorElements = graphrealization.illustrator.elements;
                const manifestation = window.manifestation || null;
                const success = self.svgProcessor.transferAndValidateElements(
                    illustratorElements, manifestation, self.svgProcessor.getCache()
                );
                
                if (!success) {
                    throw new Error('CPEEWfAdaptorRenderer: Failed to process SVG elements');
                }
                
                self.svgProcessor.validateClassAttributes(illustratorElements);
                graphrealization.set_svg_container(jquerySvgContainer);
                
                const labelContainer = window.$(`<div id="graph-labels-${self.container.id}" style="display: none;"></div>`);
                window.$(`#modelling-${self.container.id}`).append(labelContainer);
                graphrealization.illustrator.svg.label_container = labelContainer;
                
                self.setGraphDescription(graphrealization, cleanedXML);
                self.namespaceSVGIds(svgElement);
                
                self.isRendered = true;
                self.adjustSVGHeight();
                SVGScaleUtility.applyScale(svgElement, self.currentScale, 'cpee');
                
                if (self.postRenderCallback) {
                    self.postRenderCallback(self.container.id, svgElement);
                }
                
            } catch (error) {
                console.error('Graph rendering error:', error.message);
                self.showStatus(`Failed to render graph: ${error.message}`, 'error');
                self.isRendered = false;
                self.setupContainer();
            }
        });
    }
    
    /**
     * Load the WfAdaptor and required dependencies (optimized for parallel loading)
     */
    async loadWfAdaptor() {
        const promises = [];
        
        const cssPath = configManager.get('cpee.wfadaptor.cssPath');
        const baseThemePath = configManager.get('cpee.wfadaptor.baseThemePath');
        const wfadaptorPath = configManager.get('cpee.wfadaptor.wfadaptorPath');
        
        if (!document.querySelector('link[href*="wfadaptor.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = cssPath;
            document.head.appendChild(cssLink);
        }
        
        if (typeof WFAdaptorManifestationBase === 'undefined') {
            promises.push(new Promise((resolve, reject) => {
                const baseScript = document.createElement('script');
                baseScript.src = baseThemePath;
                baseScript.onload = () => resolve();
                baseScript.onerror = () => reject(new Error('Failed to load base theme'));
                document.head.appendChild(baseScript);
            }));
        }
        
        if (typeof WfAdaptor === 'undefined') {
            promises.push(new Promise((resolve, reject) => {
                const wfScript = document.createElement('script');
                wfScript.src = wfadaptorPath;
                wfScript.onload = () => resolve();
                wfScript.onerror = () => reject(new Error('Failed to load WfAdaptor'));
                document.head.appendChild(wfScript);
            }));
        }
        
        if (promises.length > 0) {
            await Promise.all(promises);
        }
        
        this.installCorsProxyInterceptor();
    }
    
    /**
     * Install jQuery AJAX interceptor to route cpee.org theme requests through
     * CORS proxy with local fallback when proxy fails.
     */
    installCorsProxyInterceptor() {
        if (window._cpeeProxyInterceptorInstalled) { return; }
        
        const corsProxy = configManager.get('api.cors.proxy');
        const fallbackBasePath = './fallback/cpee-themes';
        const useFallbackDirectly = configManager.get('cpee.rendering.useFallbackDirectly', false);
        
        const fallbackTracker = {
            successFiles: [],
            failedFiles: [],
            reportTimeout: null,
            
            addSuccess(file) {
                this.successFiles.push(file);
                this.scheduleReport();
            },
            addFailure(file) {
                this.failedFiles.push(file);
                this.scheduleReport();
            },
            scheduleReport() {
                if (this.reportTimeout) { clearTimeout(this.reportTimeout); }
                this.reportTimeout = setTimeout(() => this.report(), 500);
            },
            report() {
                if (this.successFiles.length > 0) {
                    console.warn(`[CPEEWfAdaptorRenderer] Using FALLBACK theme`);
                    this.successFiles = [];
                }
                if (this.failedFiles.length > 0) {
                    console.error(
                        `[CPEEWfAdaptorRenderer] Failed to load ${this.failedFiles.length} theme file(s) (proxy and fallback both failed): ` +
                        this.failedFiles.join(', ')
                    );
                    this.failedFiles = [];
                }
                this.reportTimeout = null;
            }
        };
        
        const getLocalFallbackUrl = (url) => {
            const themePathMatch = url.match(/\/flow\/themes\/(.+)$/);
            return themePathMatch ? `${fallbackBasePath}/${themePathMatch[1]}` : null;
        };
        
        const getFilename = (url) => {
            const match = url.match(/\/([^/]+)$/);
            return match ? match[1] : url;
        };
        
        const isCpeeThemeResource = (url) => {
            if (!url) { return false; }
            const isCpeeUrl = url.startsWith('https://cpee.org/') || url.startsWith('http://cpee.org/');
            const isThemeFile = url.endsWith('.rng') || url.endsWith('.svg') || url.endsWith('.js');
            return isCpeeUrl && isThemeFile;
        };
        
        /**
         * Intercept a jQuery request: try proxy (or fallback directly), then local fallback.
         * @param {Function} originalFn - Original $.ajax or $.get
         * @param {string} requestUrl - The cpee.org URL to intercept
         * @param {Function} makeOriginalCall - Callback to make the original request with a given URL
         * @returns {Object} jQuery promise
         */
        const interceptCpeeRequest = (requestUrl, makeOriginalCall) => {
            const localFallbackUrl = getLocalFallbackUrl(requestUrl);
            const filename = getFilename(requestUrl);
            const deferred = window.$.Deferred();
            
            const tryFallback = () => {
                if (localFallbackUrl) {
                    makeOriginalCall(localFallbackUrl)
                        .done((data, textStatus, jqXHR) => {
                            fallbackTracker.addSuccess(filename);
                            deferred.resolve(data, textStatus, jqXHR);
                        })
                        .fail((jqXHR, textStatus, errorThrown) => {
                            fallbackTracker.addFailure(filename);
                            deferred.reject(jqXHR, textStatus, errorThrown);
                        });
                } else {
                    fallbackTracker.addFailure(filename);
                    deferred.reject();
                }
            };
            
            if (useFallbackDirectly) {
                tryFallback();
            } else {
                const proxyUrl = corsProxy ? corsProxy + encodeURIComponent(requestUrl) : requestUrl;
                makeOriginalCall(proxyUrl)
                    .done((data, textStatus, jqXHR) => deferred.resolve(data, textStatus, jqXHR))
                    .fail(() => tryFallback());
            }
            
            return deferred.promise();
        };
        
        const originalAjax = window.$.ajax;
        window.$.ajax = function(url, options) {
            if (typeof url === 'object') {
                options = url;
                url = options.url;
            }
            options = options || {};
            if (typeof url === 'string') { options.url = url; }
            
            const requestUrl = options.url || '';
            
            if (isCpeeThemeResource(requestUrl)) {
                return interceptCpeeRequest(requestUrl, (targetUrl) => 
                    originalAjax.call(this, { ...options, url: targetUrl })
                );
            }
            return originalAjax.call(this, options);
        };
        
        const originalGet = window.$.get;
        window.$.get = function(url, ...args) {
            if (typeof url === 'string' && isCpeeThemeResource(url)) {
                return interceptCpeeRequest(url, (targetUrl) => 
                    originalGet.call(this, targetUrl, ...args)
                );
            }
            return originalGet.call(this, url, ...args);
        };
        
        window._cpeeProxyInterceptorInstalled = true;
    }
    
    /**
     * Set post-render callback
     * @param {Function} callback - Callback function (sectionId, svgElement) => void
     */
    setPostRenderCallback(callback) {
        this.postRenderCallback = callback;
    }

    /**
     * Namespace all IDs and references within an SVG to prevent collisions
     * between input and output graphs.
     * @param {SVGElement} svgElement - The SVG element to namespace
     */
    namespaceSVGIds(svgElement) {
        if (!svgElement) { return; }

        try {
            const prefix = `${this.container.id}-`;
            
            const elementsWithIds = svgElement.hasAttribute('id') ? [svgElement] : [];
            elementsWithIds.push(...svgElement.querySelectorAll('*[id]'));
            
            const idMap = new Map();
            
            for (const element of elementsWithIds) {
                const oldId = element.getAttribute('id');
                if (oldId && !oldId.startsWith(prefix)) {
                    const newId = prefix + oldId;
                    idMap.set(oldId, newId);
                    element.setAttribute('id', newId);
                }
            }
            
            if (idMap.size === 0) { return; }
            
            const referenceAttributes = [
                'clip-path', 'mask', 'filter', 'fill', 'stroke',
                'marker-start', 'marker-end', 'marker-mid'
            ];
            
            const allElements = [svgElement, ...svgElement.querySelectorAll('*')];
            
            for (const element of allElements) {
                for (const attr of referenceAttributes) {
                    const value = element.getAttribute(attr);
                    if (value && typeof value === 'string' && value.includes('url(#')) {
                        const newValue = value.replace(
                            /url\s*\(\s*#([^)]+)\s*\)/,
                            (match, id) => idMap.has(id) ? `url(#${idMap.get(id)})` : match
                        );
                        if (newValue !== value) { element.setAttribute(attr, newValue); }
                    }
                }
                
                const xlinkHref = element.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                if (xlinkHref && xlinkHref.startsWith('#')) {
                    const idRef = xlinkHref.substring(1);
                    if (idMap.has(idRef)) {
                        element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${idMap.get(idRef)}`);
                    }
                }
                
                const href = element.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const idRef = href.substring(1);
                    if (idMap.has(idRef)) {
                        element.setAttribute('href', `#${idMap.get(idRef)}`);
                    }
                }
            }
                        
        } catch (error) {
            console.error('[CPEEWfAdaptorRenderer] Error namespacing SVG IDs:', error);
        }
    }

    /**
     * Dynamically adjust SVG height based on actual content dimensions.
     * Handles negative bbox.y values correctly.
     */
    adjustSVGHeight() {
        if (!this.svgContainer) { return; }

        try {
            const svg = this.svgContainer;
            
            if (!svg.children || svg.children.length === 0) {
                svg.setAttribute('height', '400');
                svg.style.height = '400px';
                return;
            }
            
            const bbox = svg.getBBox();
            
            if (!bbox || isNaN(bbox.height) || bbox.height <= 0) {
                const viewBox = svg.getAttribute('viewBox');
                if (viewBox) {
                    const vbValues = viewBox.split(/\s+/);
                    if (vbValues.length >= 4) {
                        const vbHeight = parseFloat(vbValues[3]);
                        if (!isNaN(vbHeight) && vbHeight > 0) {
                            svg.setAttribute('height', vbHeight.toString());
                            svg.style.height = vbHeight + 'px';
                            return;
                        }
                    }
                }
                svg.setAttribute('height', '400');
                svg.style.height = '400px';
                return;
            }
            
            const requiredHeight = Math.max(0, bbox.y) + bbox.height + 20;
            const finalHeight = Math.max(requiredHeight, 100);
            
            svg.setAttribute('height', finalHeight.toString());
            svg.style.height = finalHeight + 'px';
            
        } catch (error) {
            this.svgContainer.setAttribute('height', '400');
            this.svgContainer.style.height = '400px';
        }
    }

    /**
     * Show status message via StatusManager
     */
    showStatus(message, type = 'info') {
        if (!this.statusManager) { return; }
        
        switch (type) {
            case 'loading': this.statusManager.showLoading(message); break;
            case 'success': this.statusManager.showSuccess(message); break;
            case 'error': this.statusManager.showError(message); break;
            default: this.statusManager.showInfo(message);
        }
    }
    
    /**
     * Invalidate the shared WfAdaptor cache.
     * Must be called when the theme changes so the next render creates a fresh
     * WfAdaptor with the new theme.  Dark-mode toggles that only affect CSS
     * variables (not the theme path) do NOT need to invalidate this cache.
     */
    static invalidateCache() {
        CPEEWfAdaptorRenderer._wfAdaptorCache.clear();
    }
}
