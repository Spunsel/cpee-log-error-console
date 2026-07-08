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
        
        // Find the diamond rect elements in both .part-start and .part-end
        // XOR (choose) and parallel gateways have both opening and closing diamonds
        const startDiamondRect = gatewayGroup.querySelector('.part-start rect.stand') ||
                                gatewayGroup.querySelector('.part-start rect') ||
                                gatewayGroup.querySelector('rect[transform*="rotate"]');
        
        // Try multiple selectors for end diamond - CPEE might use different structures
        let endDiamondRect = gatewayGroup.querySelector('.part-end rect.stand') ||
                           gatewayGroup.querySelector('.part-end rect') ||
                           gatewayGroup.querySelector('g.part-end rect');
        
        // If not found, try finding all rotated rects and pick the second one
        if (!endDiamondRect) {
            const allRotatedRects = gatewayGroup.querySelectorAll('rect[transform*="rotate"]');
            if (allRotatedRects.length > 1) {
                endDiamondRect = allRotatedRects[allRotatedRects.length - 1]; // Last one is the closing
            }
        }
        
        let foundDiamond = false;
        
        // Highlight the start diamond (opening gateway)
        if (startDiamondRect) {
            this.applyElementHighlight(startDiamondRect, 'cpee-gateway-highlighted', isActive);
            this.applyInlineHighlightStyle(startDiamondRect, isActive);
            foundDiamond = true;
        }
        
        // Highlight the end diamond (closing gateway) if present
        if (endDiamondRect && endDiamondRect !== startDiamondRect) {
            this.applyElementHighlight(endDiamondRect, 'cpee-gateway-highlighted', isActive);
            this.applyInlineHighlightStyle(endDiamondRect, isActive);
            foundDiamond = true;
        }
        
        if (foundDiamond) {
            // Mark the group so we can find it later for clearing
            gatewayGroup.classList.add('cpee-gateway-group-highlighted');
            if (isActive) {
                gatewayGroup.classList.add('cpee-gateway-group-highlighted-active');
            }
            this.highlightedElements.add(gatewayGroup);
        } else {
            // Fallback: highlight the entire group if no diamond rects found
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

    // ==================== SVG Element Lookup Methods ====================
    
    /**
     * Find task or gateway element in SVG container
     * @param {HTMLElement} container - SVG container element
     * @param {string} taskId - Task or gateway identifier to find (can be full SVG ID or base ID)
     * @param {Object} options - Optional configuration
     * @param {Function} options.findSvgElementByAltId - Function to find element by alt_id (for CPEE)
     * @param {Function} options.isCPEEGatewayElementId - Function to check if ID is CPEE gateway element-id
     * @param {Function} options.usesGwNamingConvention - Function to check if ID uses gw naming convention
     * @param {Function} options.getPairedGatewayId - Function to get paired gateway ID
     * @returns {HTMLElement|null} Task or gateway element or null
     */
    findTaskInSVG(container, taskId, options = {}) {
        const {
            findSvgElementByAltId = null,
            isCPEEGatewayElementId = null,
            usesGwNamingConvention = null,
            getPairedGatewayId = null
        } = options;
        
        // For CPEE gateway element-ids (choose_N, parallel_N), use specific selector
        if (isCPEEGatewayElementId && isCPEEGatewayElementId(taskId)) {
            const gatewayElement = container.querySelector(`g.element.complex[element-id="${CSS.escape(taskId)}"]`);
            if (gatewayElement) {
                return gatewayElement;
            }
            const gatewayElementAlt = container.querySelector(`g.element[element-id="${CSS.escape(taskId)}"]`);
            if (gatewayElementAlt) {
                return gatewayElementAlt;
            }
        }
        
        // PRIORITY 1: Try CPEE element-id attribute first (most reliable for tasks)
        // This finds elements by their XML id attribute
        const groupElements = container.querySelectorAll('g.element[element-id]');
        for (const el of groupElements) {
            const elementId = el.getAttribute('element-id');
            if (elementId === taskId) {
                return el;
            }
        }
        
        // Try any element with element-id
        const elements = container.querySelectorAll('[element-id]');
        for (const el of elements) {
            const elementId = el.getAttribute('element-id');
            if (elementId === taskId) {
                return el;
            }
        }
        
        // PRIORITY 2: For CPEE sections, try element-alt_id lookup (for gateway alt_ids)
        // This is used when we're looking for a gateway by its alt_id (e.g., "gw1s", "a3")
        // NOTE: Only do this AFTER element-id lookup to avoid collisions
        if (container.id && container.id.includes('cpee') && findSvgElementByAltId) {
            const elementByAltId = findSvgElementByAltId(container, taskId);
            if (elementByAltId) {
                return elementByAltId;
            }
            
            // For gw pattern IDs (gw1s, gw1e), also check the paired gateway
            if (usesGwNamingConvention && getPairedGatewayId && usesGwNamingConvention(taskId)) {
                const pairedId = getPairedGatewayId(taskId);
                if (pairedId) {
                    const pairedGateway = findSvgElementByAltId(container, pairedId);
                    if (pairedGateway) {
                        return pairedGateway;
                    }
                }
            }
        }
        
        // For Mermaid: look for node elements
        const nodes = container.querySelectorAll('g.node');
        
        // Try exact ID match for Mermaid first (most reliable)
        for (const node of nodes) {
            if (node.id === taskId) {
                return node;
            }
        }
        
        // Extract base ID if taskId is a full Mermaid SVG ID
        // Support task (call), script (manipulate/script), subprocess, and gateway patterns
        let baseId = taskId;
        const baseIdMatch = taskId.match(/:([a-z0-9]+):task:/) || 
                           taskId.match(/^([a-z0-9]+):task:/) ||
                           taskId.match(/:([a-z0-9]+):script:/) ||
                           taskId.match(/^([a-z0-9]+):script:/) ||
                           taskId.match(/:([a-z0-9]+):subprocess:/) ||
                           taskId.match(/^([a-z0-9]+):subprocess:/) ||
                           taskId.match(/:([a-z0-9]+):exclusivegateway:/) ||
                           taskId.match(/^([a-z0-9]+):exclusivegateway:/) ||
                           taskId.match(/:([a-z0-9]+):parallelgateway:/) ||
                           taskId.match(/^([a-z0-9]+):parallelgateway:/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-task-|:task:|-)/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-script-|:script:|-)/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-subprocess-|:subprocess:|-)/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-exclusivegateway-|:exclusivegateway:|-)/) ||
                           taskId.match(/flowchart-([a-z0-9]+)(?:-parallelgateway-|:parallelgateway:|-)/);
        if (baseIdMatch && baseIdMatch[1]) {
            baseId = baseIdMatch[1];
        }
        
        // Build Mermaid ID pattern arrays once, outside the node loops
        const taskIdPatterns = HighlightingService._buildMermaidPatterns(taskId);
        
        // Try pattern matching for Mermaid with the full taskId
        for (const node of nodes) {
            if (node.id && taskIdPatterns.some(p => p.test(node.id))) {
                return node;
            }
        }
        
        // Try pattern matching with base ID (if different from taskId)
        if (baseId !== taskId) {
            const baseIdPatterns = HighlightingService._buildMermaidPatterns(baseId);
            for (const node of nodes) {
                if (node.id && baseIdPatterns.some(p => p.test(node.id))) {
                    return node;
                }
            }
        }
        
        // Fallback: Try to find element by ID (CSS selector)
        try {
            const element = container.querySelector(`#${CSS.escape(taskId)}`);
            if (element) {
                return element;
            }
        } catch (e) {
            // ID selector failed
        }
        
        // Fallback: Try with base ID if different
        if (baseId !== taskId) {
            try {
                const element = container.querySelector(`#${CSS.escape(baseId)}`);
                if (element) {
                    return element;
                }
            } catch (e) {
                // Ignore
            }
        }
        
        // Fallback: Look for elements with data-task-id attribute
        try {
            const element = container.querySelector(`[data-task-id="${taskId}"]`);
            if (element) {
                return element;
            }
        } catch (e) {
            // data-task-id selector failed
        }
        
        return null;
    }

    /**
     * Build the array of Mermaid node-ID match patterns for a given identifier.
     * Compiled once per findTaskInSVG call instead of per-node.
     * @param {string} id - Raw task or gateway identifier
     * @returns {RegExp[]}
     */
    static _buildMermaidPatterns(id) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const types = [
            '-task-|:task:',
            '-script-|:script:',
            '-subprocess-|:subprocess:',
            '-exclusivegateway-|:exclusivegateway:',
            '-parallelgateway-|:parallelgateway:'
        ];
        const patterns = [];
        for (const t of types) {
            patterns.push(
                new RegExp(`^flowchart-${esc}(?:${t}|-|$)`),
                new RegExp(`flowchart-${esc}(?:${t})`),
                new RegExp(`(?:^|-)${esc}(?:${t})`),
                new RegExp(`^${esc}(?:${t})`)
            );
        }
        return patterns;
    }

    /**
     * Destroy the service
     */
    destroy() {
        this.reset();
    }
}