/**
 * HighlightingService - Core highlighting system for SVG elements
 * 
 * Provides functionality to highlight, clear highlights, and manage clickable states
 * for SVG elements across CPEE and Mermaid visualizations.
 * 
 * @module services/HighlightingService
 */

export class HighlightingService {
    /**
     * Creates an instance of HighlightingService
     */
    constructor() {
        this.highlightedElements = new Set();
        this.clickableElements = new Set();
        this.originalStyles = new Map();
        this.animationEnabled = true;
        this.animationDuration = 300; // milliseconds
    }

    /**
     * Enable or disable highlighting animations
     * @param {boolean} enabled - Whether to enable animations
     */
    setAnimationEnabled(enabled) {
        this.animationEnabled = enabled;
    }

    /**
     * Set animation duration
     * @param {number} duration - Animation duration in milliseconds
     */
    setAnimationDuration(duration) {
        this.animationDuration = duration;
    }

    /**
     * Highlights a list of elements
     * 
     * @param {Element[]|NodeList|Set} elementList - List of elements to highlight
     * @param {boolean} isActive - Whether this is the active (clicked) task or gateway
     */
    highlightElements(elementList, isActive = false) {
        if (!elementList) {
            return;
        }

        const elements = Array.from(elementList);

        elements.forEach(element => {
            if (!element) {
                return;
            }
            this.applyElementHighlight(element, 'task-highlighted', isActive);
        });
    }

    /**
     * Highlights a CPEE task element
     * 
     * @param {Element} svgElement - SVG element containing the CPEE task
     * @param {boolean} isActive - Whether this is the active (clicked) task or gateway
     */
    highlightCPEETask(svgElement, isActive = false) {
        if (!svgElement) {
            return;
        }
        
        const taskGroup = this.findSVGGroup(svgElement, ['task-group', 'element', 'primitive']);
        if (taskGroup) {
            this.applySVGHighlight(taskGroup, 'cpee-task-highlighted', isActive);
        }
    }

    /**
     * Highlights a Mermaid node element
     * 
     * @param {Element} svgElement - SVG element containing the Mermaid node
     * @param {boolean} isActive - Whether this is the active (clicked) task or gateway
     */
    highlightMermaidNode(svgElement, isActive = false) {
        if (!svgElement) {
            return;
        }
        
        const nodeGroup = this.findSVGGroup(svgElement, ['node']);
        if (nodeGroup) {
            this.applySVGHighlight(nodeGroup, 'mermaid-node-highlighted', isActive);
        }
    }

    /**
     * Highlights a CPEE gateway element
     * Applies highlight directly to the diamond rect element inside .part-start
     * 
     * @param {Element} svgElement - SVG element containing the CPEE gateway
     * @param {boolean} isActive - Whether this is the active (clicked) gateway
     */
    highlightCPEEGateway(svgElement, isActive = false) {
        if (!svgElement) {
            return;
        }
        
        // Gateways might be in different group structures
        const gatewayGroup = this.findSVGGroup(svgElement, [
            'gateway-group', 
            'element', 
            'complex', 
            'choose', 
            'parallel',
            'primitive'
        ]);
        
        if (!gatewayGroup) {
            return;
        }
        
        // Find the diamond rect element inside .part-start
        // This is the rotated rect that forms the diamond shape
        const diamondRect = gatewayGroup.querySelector('.part-start rect.stand') ||
                           gatewayGroup.querySelector('.part-start rect') ||
                           gatewayGroup.querySelector('rect[transform*="rotate"]');
        
        if (diamondRect) {
            // Apply highlight directly to the diamond rect
            this.applyElementHighlight(diamondRect, 'cpee-gateway-highlighted', isActive);
            // Also set inline styles to override CPEE library's colorstyle/markstyle classes
            this.applyInlineHighlightStyle(diamondRect, isActive);
            // Also mark the group so we can find it later for clearing
            gatewayGroup.classList.add('cpee-gateway-group-highlighted');
            if (isActive) {
                gatewayGroup.classList.add('cpee-gateway-group-highlighted-active');
            }
            this.highlightedElements.add(gatewayGroup);
        } else {
            // Fallback: highlight the entire group if diamond rect not found
            this.applySVGHighlight(gatewayGroup, 'cpee-gateway-highlighted', isActive);
        }
    }

    /**
     * Sets elements as clickable with hover effects
     * 
     * @param {Element[]|NodeList|Set} elementList - List of elements to make clickable
     */
    setClickableElements(elementList) {
        if (!elementList) {
            return;
        }

        const elements = Array.from(elementList);

        elements.forEach(element => {
            if (!element) {
                return;
            }

            element.classList.add('task-clickable');
            this.clickableElements.add(element);
        });
    }

    /**
     * Clears all highlights from all tracked elements
     */
    clearAllHighlights() {
        this.highlightedElements.forEach(element => {
            this.clearElementHighlight(element);
        });

        this.highlightedElements.clear();

        // Clear CPEE library's "selected" class from all tasks
        this.clearCPEELibrarySelection();
    }

    /**
     * Clears all clickable states
     */
    clearAllClickable() {
        this.clickableElements.forEach(element => {
            element.classList.remove('task-clickable');
        });

        this.clickableElements.clear();
    }

    /**
     * Resets all highlighting and clickable states
     */
    reset() {
        this.clearAllHighlights();
        this.clearAllClickable();
        this.originalStyles.clear();
    }

    /**
     * Stores original styles for an element to allow restoration
     * 
     * @private
     * @param {Element} element - Element to store styles for
     */
    storeOriginalStyles(element) {
        if (!this.originalStyles.has(element)) {
            const styles = {
                stroke: element.style.stroke,
                strokeWidth: element.style.strokeWidth,
                opacity: element.style.opacity,
                filter: element.style.filter,
            };
            this.originalStyles.set(element, styles);
        }
    }

    /**
     * Restores original styles for an element
     * 
     * @private
     * @param {Element} element - Element to restore styles for
     */
    restoreOriginalStyles(element) {
        const styles = this.originalStyles.get(element);
        if (styles) {
            element.style.stroke = styles.stroke;
            element.style.strokeWidth = styles.strokeWidth;
            element.style.opacity = styles.opacity;
            element.style.filter = styles.filter;
            this.originalStyles.delete(element);
        }
    }

    /**
     * Applies inline highlight styles to override CPEE library styles
     * 
     * @private
     * @param {Element} element - Element to apply inline styles to
     * @param {boolean} isActive - Whether this is the active element
     */
    applyInlineHighlightStyle(element, isActive = false) {
        // Get the highlight color from CSS variable, fallback to orange
        const computedStyle = getComputedStyle(document.documentElement);
        const highlightColor = computedStyle.getPropertyValue('--highlight-stroke').trim() || '#f57900';
        
        // Store original styles first
        this.storeOriginalStyles(element);
        
        // Apply inline styles to override any CPEE library styles
        element.style.stroke = highlightColor;
        element.style.strokeWidth = isActive ? '4px' : '3px';
    }

    /**
     * Applies highlighting to a single element with animation support
     * 
     * @private
     * @param {Element} element - Element to highlight
     * @param {string} baseClass - Base CSS class for highlighting
     * @param {boolean} isActive - Whether this is the active element
     */
    applyElementHighlight(element, baseClass, isActive) {
        // Store original styles for restoration
        this.storeOriginalStyles(element);

        // Apply highlight classes
        const activeClass = `${baseClass}-active`;
        const classesToAdd = isActive ? [baseClass, activeClass] : [baseClass];
        
        classesToAdd.forEach(className => {
            element.classList.add(className);
        });

        // Add animation if enabled
        if (this.animationEnabled) {
            this.addHighlightAnimation(element);
        }

        // Add to tracked elements
        this.highlightedElements.add(element);
    }

    /**
     * Applies SVG-specific highlighting to a group element
     * 
     * @private
     * @param {Element} groupElement - SVG group element
     * @param {string} baseClass - Base CSS class for highlighting
     * @param {boolean} isActive - Whether this is the active element
     */
    applySVGHighlight(groupElement, baseClass, isActive) {
        // Apply highlighting to the group element itself
        this.applyElementHighlight(groupElement, baseClass, isActive);
        
        // Also highlight shape elements for visibility
        const shapeElements = groupElement.querySelectorAll('rect, circle, polygon, ellipse');
        shapeElements.forEach(shape => {
            this.applyElementHighlight(shape, baseClass, isActive);
            // Apply inline styles to override CPEE library styles (colorstyle, markstyle, etc.)
            // Only apply to elements that have these CPEE classes
            if (shape.classList.contains('colorstyle') || 
                shape.classList.contains('markstyle') || 
                shape.classList.contains('stand')) {
                this.applyInlineHighlightStyle(shape, isActive);
            }
        });
    }

    /**
     * Clears highlighting from a single element
     * 
     * @private
     * @param {Element} element - Element to clear highlighting from
     */
    clearElementHighlight(element) {
        // Remove all highlight classes
        const highlightClasses = [
            'task-highlighted', 'task-highlighted-active',
            'cpee-task-highlighted', 'cpee-task-highlighted-active',
            'cpee-gateway-highlighted', 'cpee-gateway-highlighted-active',
            'cpee-gateway-group-highlighted', 'cpee-gateway-group-highlighted-active',
            'mermaid-node-highlighted', 'mermaid-node-highlighted-active'
        ];
        
        highlightClasses.forEach(className => {
            element.classList.remove(className);
        });

        // Remove highlight classes from child shape elements
        const shapeElements = element.querySelectorAll('rect, circle, polygon, ellipse');
        shapeElements.forEach(shape => {
            highlightClasses.forEach(className => {
                shape.classList.remove(className);
            });
        });

        // Restore original styles if stored
        this.restoreOriginalStyles(element);
    }

    /**
     * Clears CPEE library's selection state
     * 
     * @private
     */
    clearCPEELibrarySelection() {
        document.querySelectorAll('.element.primitive.selected, .element.primitive.hover.selected').forEach(el => {
            el.classList.remove('hover');
            el.classList.remove('selected');
        });
    }

    /**
     * Adds highlighting animation to an element
     * 
     * @private
     * @param {Element} element - Element to animate
     */
    addHighlightAnimation(element) {
        // Add CSS transition for smooth highlighting
        element.style.transition = `all ${this.animationDuration}ms ease-in-out`;
        
        // Remove transition after animation completes
        setTimeout(() => {
            element.style.transition = '';
        }, this.animationDuration);
    }

    /**
     * Finds SVG group element by class names
     * 
     * @private
     * @param {Element} element - Starting element
     * @param {string[]} classNames - Array of class names to search for
     * @returns {Element|null} - Found group element or null
     */
    findSVGGroup(element, classNames) {
        let current = element;
        while (current && current.tagName !== 'SVG') {
            if (current.classList) {
                for (const className of classNames) {
                    if (current.classList.contains(className)) {
                        return current;
                    }
                }
            }
            current = current.parentElement;
        }
        return null;
    }

    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getStats() {
        return {
            highlightedElementsCount: this.highlightedElements.size,
            clickableElementsCount: this.clickableElements.size,
            originalStylesCount: this.originalStyles.size,
            animationEnabled: this.animationEnabled,
            animationDuration: this.animationDuration
        };
    }

    /**
     * Destroy the service
     */
    destroy() {
        this.reset();
    }
}