/**
 * HighlightManager - Core highlighting system for SVG elements
 * 
 * Provides functionality to highlight, clear highlights, and manage clickable states
 * for SVG elements across CPEE and Mermaid visualizations.
 * 
 * @module components/managers/HighlightManager
 */

export default class HighlightManager {
    /**
     * Creates an instance of HighlightManager
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
     * @param {boolean} isActive - Whether this is the active (clicked) task
     */
    highlightElements(elementList, isActive = false) {
        if (!elementList) return;

        const elements = Array.from(elementList);
        console.log(`HighlightManager: Highlighting ${elements.length} element(s), isActive=${isActive}`);

        elements.forEach(element => {
            if (!element) return;

            // Store original styles for restoration
            this.storeOriginalStyles(element);

            // Apply highlight class
            const baseClass = 'task-highlighted';
            const activeClass = 'task-highlighted-active';
            
            if (isActive) {
                element.classList.add(activeClass);
            } else {
                element.classList.add(baseClass);
            }

            // Add to tracked elements
            this.highlightedElements.add(element);
        });
    }

    /**
     * Highlights a CPEE task element
     * 
     * @param {Element} svgElement - SVG element containing the CPEE task
     * @param {boolean} isActive - Whether this is the active (clicked) task
     */
    highlightCPEETask(svgElement, isActive = false) {
        if (!svgElement) return;

        console.log(`HighlightManager: Highlighting CPEE task element, isActive=${isActive}`);
        
        // Find the task group element
        const taskGroup = this.findTaskGroup(svgElement);
        if (taskGroup) {
            this.applyCPEEHighlight(taskGroup, isActive);
        }
    }

    /**
     * Highlights a Mermaid node element
     * 
     * @param {Element} svgElement - SVG element containing the Mermaid node
     * @param {boolean} isActive - Whether this is the active (clicked) task
     */
    highlightMermaidNode(svgElement, isActive = false) {
        if (!svgElement) return;

        console.log(`HighlightManager: Highlighting Mermaid node element, isActive=${isActive}`);
        
        // Find the node group element
        const nodeGroup = this.findMermaidNodeGroup(svgElement);
        if (nodeGroup) {
            this.applyMermaidHighlight(nodeGroup, isActive);
        }
    }

    /**
     * Sets elements as clickable with hover effects
     * 
     * @param {Element[]|NodeList|Set} elementList - List of elements to make clickable
     */
    setClickableElements(elementList) {
        if (!elementList) return;

        const elements = Array.from(elementList);
        console.log(`HighlightManager: Setting ${elements.length} element(s) as clickable`);

        elements.forEach(element => {
            if (!element) return;

            element.classList.add('task-clickable');
            this.clickableElements.add(element);
        });
    }

    /**
     * Clears all highlights from all tracked elements
     */
    clearAllHighlights() {
        console.log(`HighlightManager: Clearing highlights from ${this.highlightedElements.size} element(s)`);

        this.highlightedElements.forEach(element => {
            // Remove highlight classes from the element itself
            element.classList.remove('task-highlighted');
            element.classList.remove('task-highlighted-active');
            element.classList.remove('cpee-task-highlighted');
            element.classList.remove('cpee-task-highlighted-active');
            element.classList.remove('mermaid-node-highlighted');
            element.classList.remove('mermaid-node-highlighted-active');

            // Remove highlight classes from child shape elements
            const shapeElements = element.querySelectorAll('rect, circle, polygon, ellipse');
            shapeElements.forEach(shape => {
                shape.classList.remove('cpee-task-highlighted');
                shape.classList.remove('cpee-task-highlighted-active');
                shape.classList.remove('mermaid-node-highlighted');
                shape.classList.remove('mermaid-node-highlighted-active');
            });

            // Restore original styles if stored
            this.restoreOriginalStyles(element);
        });

        this.highlightedElements.clear();

        // Also clear CPEE library's "selected" class from all tasks to prevent persistence
        // This is needed because the CPEE WfAdaptor library maintains its own state
        document.querySelectorAll('.element.primitive.selected, .element.primitive.hover.selected').forEach(el => {
            el.classList.remove('hover');
            el.classList.remove('selected');
        });
    }

    /**
     * Clears all clickable states
     */
    clearAllClickable() {
        console.log(`HighlightManager: Clearing clickable state from ${this.clickableElements.size} element(s)`);

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
     * Finds the task group element in a CPEE SVG hierarchy
     * 
     * @private
     * @param {Element} element - Starting element
     * @returns {Element|null} - Task group element or null
     */
    findTaskGroup(element) {
        let current = element;
        while (current && current.tagName !== 'SVG') {
            if (current.classList && (
                current.classList.contains('task-group') ||
                current.classList.contains('element') ||
                current.classList.contains('primitive')
            )) {
                return current;
            }
            current = current.parentElement;
        }
        return current;
    }

    /**
     * Finds the node group element in a Mermaid SVG hierarchy
     * 
     * @private
     * @param {Element} element - Starting element
     * @returns {Element|null} - Node group element or null
     */
    findMermaidNodeGroup(element) {
        let current = element;
        while (current && current.tagName !== 'SVG') {
            if (current.classList && current.classList.contains('node')) {
                return current;
            }
            current = current.parentElement;
        }
        return current;
    }

    /**
     * Applies CPEE-specific highlighting to a task group
     * 
     * @private
     * @param {Element} taskGroup - Task group element
     * @param {boolean} isActive - Whether this is the active task
     */
    applyCPEEHighlight(taskGroup, isActive) {
        // Add highlight class to the task group itself
        if (isActive) {
            taskGroup.classList.add('cpee-task-highlighted-active');
        } else {
            taskGroup.classList.add('cpee-task-highlighted');
        }
        
        // Also highlight shape elements for visibility
        const shapeElements = taskGroup.querySelectorAll('rect, circle, polygon, ellipse');
        shapeElements.forEach(element => {
            if (isActive) {
                element.classList.add('cpee-task-highlighted-active');
            } else {
                element.classList.add('cpee-task-highlighted');
            }
        });

        this.highlightedElements.add(taskGroup);
    }

    /**
     * Applies Mermaid-specific highlighting to a node group
     * 
     * @private
     * @param {Element} nodeGroup - Node group element
     * @param {boolean} isActive - Whether this is the active node
     */
    applyMermaidHighlight(nodeGroup, isActive) {
        // Add highlight class to the node group itself
        if (isActive) {
            nodeGroup.classList.add('mermaid-node-highlighted-active');
        } else {
            nodeGroup.classList.add('mermaid-node-highlighted');
        }
        
        // Also highlight shape elements for visibility
        const shapeElements = nodeGroup.querySelectorAll('rect, circle, polygon, ellipse');
        shapeElements.forEach(element => {
            if (isActive) {
                element.classList.add('mermaid-node-highlighted-active');
            } else {
                element.classList.add('mermaid-node-highlighted');
            }
        });

        this.highlightedElements.add(nodeGroup);
    }
}

