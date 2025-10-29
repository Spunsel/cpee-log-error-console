/**
 * SVG Processor Utility
 * Handles SVG element validation, jQuery wrapping, and class attribute management
 * Provides utility functions for processing SVG elements with caching and state management
 * 
 * Converted from SVGProcessingService to utility class
 */

export class SVGProcessor {
    
    constructor() {
        this.cache = {}; // Use simple object for compatibility
        this.nonVisualElements = ['group']; // Elements expected to not have SVG properties
    }
    
    /**
     * Process a single SVG element - ensure jQuery wrapping and class attributes
     * @param {Object} svgElement - SVG element to process
     * @param {string} elementName - Name of the element (for logging)
     * @returns {Object} Processed jQuery-wrapped SVG element
     */
    processElement(svgElement, _elementName) {
        // Ensure proper jQuery wrapping
        if (typeof svgElement.clone !== 'function') {
            if (svgElement.length && svgElement[0]) {
                svgElement = window.$(svgElement[0]);
            } else if (svgElement.nodeType) {
                svgElement = window.$(svgElement);
            } else {
                svgElement = window.$(svgElement);
            }
        }
        
        // Ensure class attribute exists
        if (svgElement && typeof svgElement.attr === 'function') {
            const classAttr = svgElement.attr('class');
            if (classAttr === undefined || classAttr === null) {
                svgElement.attr('class', 'cpee-element');
            } else if (typeof classAttr !== 'string') {
                svgElement.attr('class', String(classAttr));
            }
        }
        
        return svgElement;
    }
    
    /**
     * Transfer and validate SVG elements from data sources
     * Prioritizes cache over manifestation to prevent race conditions during step transitions
     * @param {Object} illustratorElements - Target elements object
     * @param {Object} manifestation - Manifestation object (if available)
     * @param {Object} cachedElements - Cached SVG elements from previous renders
     * @returns {boolean} Success status
     */
    transferAndValidateElements(illustratorElements, manifestation, cachedElements) {
        // Priority 1: Use cache if available (elements already processed with proper class attributes)
        if (cachedElements && Object.keys(cachedElements).length > 0) {
            this.transferFromCache(illustratorElements, cachedElements);
        } 
        // Priority 2: Use fresh manifestation as fallback (requires processing)
        else if (typeof manifestation !== 'undefined' && manifestation && manifestation.elements) {
            this.transferFromManifestation(illustratorElements, manifestation.elements);
        } 
        // No data source available
        else {
            console.warn('No SVG data source available');
            return false;
        }
        
        // Validate and process all SVG elements
        for (const elementName in illustratorElements) {
            const element = illustratorElements[elementName];
            
            if (!element || !element.svg) {
                if (!this.nonVisualElements.includes(elementName)) {
                    console.warn(`Element ${elementName} missing SVG property`);
                }
                continue;
            }
            
            // Process SVG element (jQuery wrapping + class attributes)
            element.svg = this.processElement(element.svg, elementName);
        }
        
        // Update cache with processed elements
        this.updateCache(illustratorElements);
        
        return true;
    }
    
    /**
     * Transfer SVG elements from manifestation
     * @param {Object} illustratorElements - Target elements object
     * @param {Object} manifestationElements - Source manifestation elements
     */
    transferFromManifestation(illustratorElements, manifestationElements) {
        for (const elementName in manifestationElements) {
            const manifestElement = manifestationElements[elementName];
            if (manifestElement && manifestElement.illustrator && manifestElement.illustrator.svg) {
                if (!illustratorElements[elementName]) {
                    illustratorElements[elementName] = {};
                }
                illustratorElements[elementName].svg = manifestElement.illustrator.svg;
            }
        }
    }
    
    /**
     * Transfer SVG elements from cache
     * @param {Object} illustratorElements - Target elements object
     * @param {Object} cachedElements - Source cached elements
     */
    transferFromCache(illustratorElements, cachedElements) {
        for (const elementName in cachedElements) {
            if (!illustratorElements[elementName]) {
                illustratorElements[elementName] = {};
            }
            illustratorElements[elementName].svg = cachedElements[elementName];
        }
    }
    
    /**
     * Update internal cache with processed SVG elements
     * @param {Object} illustratorElements - Source elements to cache
     */
    updateCache(illustratorElements) {
        for (const elementName in illustratorElements) {
            if (illustratorElements[elementName] && illustratorElements[elementName].svg) {
                this.cache[elementName] = illustratorElements[elementName].svg;
            }
        }
    }
    
    /**
     * Final validation: ensure all SVG elements have valid class attributes
     * Prevents wfadaptor.js from calling split() on undefined class attributes
     * @param {Object} illustratorElements - Elements to validate
     */
    validateClassAttributes(illustratorElements) {
        for (const elementName in illustratorElements) {
            const element = illustratorElements[elementName];
            
            // Skip non-visual elements that don't need SVG properties
            if (!element || !element.svg || this.nonVisualElements.includes(elementName)) {
                continue;
            }
            
            const svg = element.svg;
            
            // Ensure it's a jQuery object with attr method
            if (svg && typeof svg.attr === 'function') {
                const classAttr = svg.attr('class');
                
                // Fix any undefined, null, or non-string class attributes
                if (classAttr === undefined || classAttr === null || typeof classAttr !== 'string') {
                    svg.attr('class', 'cpee-element');
                }
            } else {
                // If SVG doesn't have attr method, try to wrap it again
                console.warn(`Element ${elementName} SVG missing attr method, attempting to fix`);
                if (element.svg) {
                    element.svg = window.$(element.svg);
                    if (typeof element.svg.attr === 'function') {
                        element.svg.attr('class', 'cpee-element');
                    }
                }
            }
        }
    }
    
    /**
     * Get cached SVG elements
     * @returns {Object} Current cache
     */
    getCache() {
        return this.cache;
    }
    
    /**
     * Clear the cache
     */
    clearCache() {
        this.cache = {};
    }
    
    /**
     * Check if an element is non-visual
     * @param {string} elementName - Name of the element
     * @returns {boolean} True if element is non-visual
     */
    isNonVisualElement(elementName) {
        return this.nonVisualElements.includes(elementName);
    }
}