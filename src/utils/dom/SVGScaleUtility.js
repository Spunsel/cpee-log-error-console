/**
 * SVG Scale Utility
 * Provides utility functions for applying scale transforms to SVG elements
 * Handles different SVG structures (CPEE vs Mermaid) and maintains aspect ratio
 * Container size matches scaled SVG size, and SVG is anchored to top-left
 */

import { configManager } from '../../config/ConfigManager.js';

export class SVGScaleUtility {
    // Store original dimensions for each SVG
    static originalDimensions = new WeakMap();
    
    /**
     * Get valid scale levels from configuration
     * @returns {number[]} Array of valid scale values
     */
    static getValidScales() {
        const levels = configManager.get('rendering.scaling.levels') || [1.0];
        return levels.filter(scale => typeof scale === 'number' && scale > 0);
    }
    
    /**
     * Check if a scale value is valid
     * @param {number} scale - Scale value to validate
     * @returns {boolean} True if scale is valid
     */
    static isValidScale(scale) {
        const validScales = this.getValidScales();
        return validScales.includes(scale);
    }

    /**
     * Apply scale transform to an SVG element
     * Resizes container to match scaled SVG size and anchors SVG to top-left
     * @param {SVGElement|HTMLElement} svgElement - SVG element to scale
     * @param {number} scale - Scale value (from configured scale levels)
     * @param {string} scaleType - Type of scaling: 'mermaid' or 'cpee' (default: 'mermaid')
     * @returns {boolean} Success status
     */
    static applyScale(svgElement, scale, scaleType = 'mermaid') {
        if (!svgElement) {
            return false;
        }

        // Validate scale value against configured levels
        if (!this.isValidScale(scale)) {
            console.warn(`[SVGScaleUtility] Invalid scale value: ${scale}. Valid scales: ${this.getValidScales().join(', ')}`);
            return false;
        }

        // Handle different SVG structures
        if (scaleType === 'cpee') {
            return this.applyScaleToCPEE(svgElement, scale);
        } else {
            return this.applyScaleToMermaid(svgElement, scale);
        }
    }

    /**
     * Get original SVG dimensions (width and height)
     * @param {SVGElement} svgElement - SVG element
     * @returns {Object|null} {width, height} or null if not found
     */
    static getOriginalDimensions(svgElement) {
        // Check if we've stored original dimensions
        if (this.originalDimensions.has(svgElement)) {
            return this.originalDimensions.get(svgElement);
        }

        // Try to get from attributes
        let width = parseFloat(svgElement.getAttribute('width')) || 
                   parseFloat(svgElement.style.width) ||
                   svgElement.clientWidth ||
                   svgElement.getBBox?.()?.width;

        let height = parseFloat(svgElement.getAttribute('height')) || 
                    parseFloat(svgElement.style.height) ||
                    svgElement.clientHeight ||
                    svgElement.getBBox?.()?.height;

        // Try getBBox as fallback
        if ((!width || !height) && svgElement.getBBox) {
            try {
                const bbox = svgElement.getBBox();
                width = width || bbox.width;
                height = height || bbox.height;
            } catch (e) {
                // getBBox may fail if SVG is not rendered
            }
        }

        // Try viewBox
        if ((!width || !height) && svgElement.hasAttribute('viewBox')) {
            const viewBox = svgElement.getAttribute('viewBox').split(/\s+/);
            if (viewBox.length >= 4) {
                width = width || parseFloat(viewBox[2]);
                height = height || parseFloat(viewBox[3]);
            }
        }

        if (width && height) {
            const dimensions = { width, height };
            this.originalDimensions.set(svgElement, dimensions);
            return dimensions;
        }

        return null;
    }

    /**
     * Apply scale to Mermaid SVG
     * Resizes container and SVG, anchors to top-left
     * @param {SVGElement} svgElement - SVG element to scale
     * @param {number} scale - Scale value
     * @returns {boolean} Success status
     */
    static applyScaleToMermaid(svgElement, scale) {
        try {
            // Ensure we have an SVG element
            if (svgElement.tagName !== 'svg') {
                svgElement = svgElement.querySelector('svg') || svgElement;
            }

            if (!svgElement || svgElement.tagName !== 'svg') {
                return false;
            }

            // Get original dimensions
            const original = this.getOriginalDimensions(svgElement);
            if (!original) {
                // If we can't get dimensions, try to get them after render
                // Wait a tick for SVG to be fully rendered
                setTimeout(() => {
                    const dims = this.getOriginalDimensions(svgElement);
                    if (dims) {
                        this.applyScaleToMermaid(svgElement, scale);
                    }
                }, 0);
                return false;
            }

            // Calculate new dimensions
            const newWidth = original.width * scale;
            const newHeight = original.height * scale;

            // Remove all transforms
            svgElement.removeAttribute('transform');
            svgElement.style.transform = '';
            svgElement.style.transformOrigin = '';

            // Set SVG size to scaled dimensions
            svgElement.setAttribute('width', newWidth);
            svgElement.setAttribute('height', newHeight);
            svgElement.style.width = `${newWidth}px`;
            svgElement.style.height = `${newHeight}px`;

            // Ensure viewBox is set to maintain aspect ratio
            if (!svgElement.hasAttribute('viewBox')) {
                svgElement.setAttribute('viewBox', `0 0 ${original.width} ${original.height}`);
            }

            // Position SVG at top-left
            svgElement.style.display = 'block';
            svgElement.style.margin = '0';
            svgElement.style.verticalAlign = 'top';
            svgElement.style.float = 'none';

            // Find and resize the container (parent div that wraps the SVG)
            let container = svgElement.parentElement;
            if (container && container.tagName.toLowerCase() === 'div') {
                // Remove padding to ensure container size exactly matches SVG size
                // Store original padding if not already stored
                if (!container.dataset.originalPadding) {
                    container.dataset.originalPadding = container.style.padding || '20px';
                }
                
                // Set padding to 0 to eliminate extra space
                container.style.padding = '0';
                container.style.boxSizing = 'border-box';
                
                // Resize container to exactly match SVG size (no padding)
                container.style.width = `${newWidth}px`;
                container.style.height = `${newHeight}px`;
                container.style.overflow = 'auto'; // Enable scrollbars
                container.style.textAlign = 'left'; // Anchor to left (removes centering)
                container.style.display = 'block';
                container.style.margin = '0';
                container.style.float = 'none';
                
                // Find parent container (the -graph-container) if it exists
                // This is the container that might have overflow settings
                let parentContainer = container.parentElement;
                if (parentContainer && parentContainer.id && parentContainer.id.includes('-graph-container')) {
                    parentContainer.style.width = `${newWidth}px`;
                    parentContainer.style.height = `${newHeight}px`;
                    parentContainer.style.overflow = 'auto';
                    parentContainer.style.textAlign = 'left';
                    parentContainer.style.padding = '0';
                    parentContainer.style.margin = '0';
                    parentContainer.style.boxSizing = 'border-box';
                }
            }

            return true;
        } catch (error) {
            console.error('[SVGScaleUtility] Error applying scale to Mermaid SVG:', error);
            return false;
        }
    }

    /**
     * Apply scale to CPEE SVG
     * Resizes container and SVG, anchors to top-left
     * @param {HTMLElement|SVGElement} svgContainer - SVG container element
     * @param {number} scale - Scale value
     * @returns {boolean} Success status
     */
    static applyScaleToCPEE(svgContainer, scale) {
        try {
            // CPEE uses nested SVG structure - find the main SVG element
            let svgElement = svgContainer;
            
            if (svgContainer.tagName !== 'svg') {
                // Try to find SVG element in container
                svgElement = svgContainer.querySelector('svg');
                if (!svgElement) {
                    // Try common CPEE SVG container IDs
                    const containerId = svgContainer.id || '';
                    if (containerId) {
                        svgElement = document.querySelector(`#graphcanvas-${containerId}`) ||
                                   document.querySelector(`#${containerId} svg`);
                    }
                }
            }

            if (!svgElement || svgElement.tagName !== 'svg') {
                return false;
            }

            // Get original dimensions
            const original = this.getOriginalDimensions(svgElement);
            if (!original) {
                // CPEE SVG might need time to render - try again after a delay
                setTimeout(() => {
                    const dims = this.getOriginalDimensions(svgElement);
                    if (dims) {
                        this.applyScaleToCPEE(svgContainer, scale);
                    }
                }, 100);
                return false;
            }

            // Calculate new dimensions
            const newWidth = original.width * scale;
            const newHeight = original.height * scale;

            // Remove all transforms
            svgElement.removeAttribute('transform');
            svgElement.style.transform = '';
            svgElement.style.transformOrigin = '';

            // Set SVG size to scaled dimensions
            svgElement.setAttribute('width', newWidth);
            svgElement.setAttribute('height', newHeight);
            svgElement.style.width = `${newWidth}px`;
            svgElement.style.height = `${newHeight}px`;
            svgElement.style.display = 'block';
            svgElement.style.margin = '0';
            svgElement.style.verticalAlign = 'top';

            // Ensure viewBox is set
            if (!svgElement.hasAttribute('viewBox')) {
                svgElement.setAttribute('viewBox', `0 0 ${original.width} ${original.height}`);
            }

            // Find the container divs (modelling-X or graphgrid-X)
            // Resize the appropriate container to match SVG size
            let container = svgElement.parentElement; // Usually graphgrid-X
            if (container) {
                container.style.width = `${newWidth}px`;
                container.style.height = `${newHeight}px`;
                container.style.overflow = 'auto';
                container.style.textAlign = 'left';
                
                // Also update the parent modelling-X container
                const modellingContainer = container.parentElement;
                if (modellingContainer && modellingContainer.id?.includes('modelling-')) {
                    modellingContainer.style.width = `${newWidth}px`;
                    modellingContainer.style.height = `${newHeight}px`;
                    modellingContainer.style.overflow = 'auto';
                    modellingContainer.style.textAlign = 'left';
                }
            }

            return true;
        } catch (error) {
            console.error('[SVGScaleUtility] Error applying scale to CPEE SVG:', error);
            return false;
        }
    }

    /**
     * Apply scale to all SVG elements in a container
     * Useful for handling multiple SVG instances
     * @param {HTMLElement} container - Container element with SVG children
     * @param {number} scale - Scale value
     * @param {string} scaleType - Type of scaling: 'mermaid' or 'cpee'
     * @returns {number} Number of SVGs scaled
     */
    static applyScaleToContainer(container, scale, scaleType = 'mermaid') {
        if (!container) {
            return 0;
        }

        let count = 0;
        const svgElements = container.querySelectorAll('svg');

        svgElements.forEach((svgElement) => {
            if (this.applyScale(svgElement, scale, scaleType)) {
                count++;
            }
        });

        return count;
    }

    /**
     * Remove scale transform from SVG element (reset to 1.0 scale)
     * @param {SVGElement|HTMLElement} svgElement - SVG element
     * @param {string} scaleType - Type: 'mermaid' or 'cpee'
     * @returns {boolean} Success status
     */
    static removeScale(svgElement, scaleType = 'mermaid') {
        return this.applyScale(svgElement, 1.0, scaleType);
    }

    /**
     * Get current scale from an SVG element
     * Compares current dimensions to original dimensions
     * @param {SVGElement|HTMLElement} svgElement - SVG element to check
     * @returns {number|null} Current scale value or null if not found
     */
    static getCurrentScale(svgElement) {
        if (!svgElement) {
            return null;
        }

        // Ensure we have an SVG element
        if (svgElement.tagName !== 'svg') {
            svgElement = svgElement.querySelector('svg') || svgElement;
        }

        if (!svgElement || svgElement.tagName !== 'svg') {
            return null;
        }

        // Get original dimensions
        const original = this.getOriginalDimensions(svgElement);
        if (!original || original.width === 0 || original.height === 0) {
            return null;
        }

        // Get current dimensions
        const currentWidth = parseFloat(svgElement.getAttribute('width')) || 
                           parseFloat(svgElement.style.width) ||
                           svgElement.clientWidth;
        const currentHeight = parseFloat(svgElement.getAttribute('height')) || 
                            parseFloat(svgElement.style.height) ||
                            svgElement.clientHeight;

        if (!currentWidth || !currentHeight) {
            return null;
        }

        // Calculate scale from width (should match height)
        const widthScale = currentWidth / original.width;
        const heightScale = currentHeight / original.height;

        // Return scale if both dimensions match (rounded to handle floating point)
        if (Math.abs(widthScale - heightScale) < 0.01) {
            // Round to nearest valid scale value
            const scale = Math.round(widthScale * 100) / 100;
            const validScales = this.getValidScales();
            
            // Check if rounded scale is in valid scales
            if (validScales.includes(scale)) {
                return scale;
            }
            
            // Find closest valid scale
            const closest = validScales.reduce((prev, curr) => {
                return Math.abs(curr - widthScale) < Math.abs(prev - widthScale) ? curr : prev;
            });
            
            // Return closest if within tolerance, otherwise return calculated scale
            if (Math.abs(closest - widthScale) < 0.01) {
                return closest;
            }
            
            return widthScale; // Return calculated scale even if not exact match
        }

        return null;
    }
}

