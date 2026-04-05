/**
 * SVG Click Detector
 * Generic utility for detecting and handling clicks on SVG elements
 * Uses event delegation for efficient event handling on dynamic SVG content
 */

export class SVGClickDetector {
    
    constructor() {
        this.activeListeners = new Map(); // Track active listeners for cleanup
        this.clickCount = 0;
    }
    
    /**
     * Attach click listener to SVG container using event delegation
     * @param {Element|string} svgContainer - SVG container element or selector
     * @param {Function} callback - Callback function(clickEvent, clickedElement, elementPath)
     * @returns {Function} Cleanup function to remove listener
     */
    attachClickListener(svgContainer, callback) {
        // Resolve container element
        const container = typeof svgContainer === 'string' 
            ? document.querySelector(svgContainer)
            : svgContainer;
            
        if (!container) {
            return () => {};
        }
        
        // Create event handler
        const clickHandler = (event) => {
            this.handleClick(event, callback);
        };
        
        // Add listener
        container.addEventListener('click', clickHandler, { capture: false });
        
        // Store for cleanup
        const listenerId = `listener-${Date.now()}-${Math.random()}`;
        this.activeListeners.set(listenerId, {
            container,
            handler: clickHandler
        });
                
        // Return cleanup function
        return () => {
            container.removeEventListener('click', clickHandler);
            this.activeListeners.delete(listenerId);
        };
    }
    
    /**
     * Handle click event
     * @param {MouseEvent} event - Click event
     * @param {Function} callback - User callback
     */
    handleClick(event, callback) {
        this.clickCount++;
        
        const clickedElement = event.target;

        // Get element path (from clicked element up to SVG root)
        const elementPath = this.getElementPath(clickedElement);
        
        // Find task/node container
        const taskContainer = this.findTaskContainer(clickedElement);
        
        // Call user callback
        try {
            callback(event, clickedElement, elementPath, taskContainer);
        } catch (error) {
            console.error('[SVGClickDetector] Error in callback:', error);
        }
    }
    
    /**
     * Get element path from clicked element to SVG root
     * @param {Element} element - Starting element
     * @returns {Element[]} Array of elements from clicked to root
     */
    getElementPath(element) {
        const path = [];
        let current = element;
        
        while (current && current.tagName) {
            path.push(current);
            
            // Stop at SVG root
            if (current.tagName.toLowerCase() === 'svg') {
                break;
            }
            
            current = current.parentElement;
        }
        
        return path;
    }
    
    /**
     * Find task/node container element by traversing up the DOM
     * @param {Element} element - Starting element
     * @returns {Element|null} Task container or null
     */
    findTaskContainer(element) {
        let current = element;
        const maxDepth = 10; // Prevent infinite loops
        let depth = 0;
        
        while (current && depth < maxDepth) {
            // CPEE task: <g class="element" element-id="...">
            if (this.isCPEETask(current)) {
                return current;
            }
            
            // Mermaid node: <g class="node" id="flowchart-...">
            if (this.isMermaidNode(current)) {
                return current;
            }
            
            // Move up
            current = current.parentElement;
            depth++;
            
            // Stop at SVG root
            if (current && current.tagName && current.tagName.toLowerCase() === 'svg') {
                break;
            }
        }
        
        return null;
    }
    
    /**
     * Check if element is a CPEE task
     * @param {Element} element - Element to check
     * @returns {boolean} True if CPEE task
     */
    isCPEETask(element) {
        if (!element || !element.classList) {
            return false;
        }
        
        return element.tagName.toLowerCase() === 'g' &&
               element.classList.contains('element') &&
               element.hasAttribute('element-id');
    }
    
    /**
     * Check if element is a Mermaid node
     * @param {Element} element - Element to check
     * @returns {boolean} True if Mermaid node
     */
    isMermaidNode(element) {
        if (!element || !element.classList) {
            return false;
        }
        
        return element.tagName.toLowerCase() === 'g' &&
               element.classList.contains('node') &&
               element.hasAttribute('id');
    }
    
    /**
     * Get human-readable element description
     * @param {Element} element - Element to describe
     * @returns {string} Description
     */
    getElementDescription(element) {
        if (!element || !element.tagName) {
            return 'null';
        }
        
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className && typeof element.className === 'string' 
            ? `.${element.className.split(' ').join('.')}` 
            : '';
        
        // For SVG elements with baseVal
        const classesFromBaseVal = element.className && element.className.baseVal
            ? `.${element.className.baseVal.split(' ').join('.')}`
            : '';
        
        return `<${tag}${id}${classes}${classesFromBaseVal}>`;
    }
    
    /**
     * Extract task ID from element
     * @param {Element} element - Task container element
     * @returns {string|null} Task ID or null
     */
    extractTaskId(element) {
        if (!element) {
            return null;
        }
        
        // CPEE: element-id attribute
        if (element.hasAttribute('element-id')) {
            return element.getAttribute('element-id');
        }
        
        // Mermaid: extract from id (flowchart-NodeID-number)
        if (element.hasAttribute('id')) {
            const fullId = element.id;
            const match = fullId.match(/flowchart-(\w+)-\d+/);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    }
    
    /**
     * Remove all active listeners
     */
    cleanup() {
        this.activeListeners.forEach((listener) => {
            listener.container.removeEventListener('click', listener.handler);
        });
        
        this.activeListeners.clear();
        this.clickCount = 0;
    }
    
    // ==================== Click Target Classification Methods ====================
    
    /**
     * Check if a click target is on an actual graph element (task, node, gateway, etc.)
     * This distinguishes between clicking on a graph element vs empty space in a graph container
     * @param {Element} target - Click target element
     * @returns {boolean} True if click is on a graph element
     */
    isClickOnGraphElement(target) {
        if (!target) {
            return false;
        }
        
        // Walk up the DOM tree to check if we're on a graph element
        let element = target;
        while (element && element !== document.body && element !== document.documentElement) {
            // Check for task-clickable class (indicates a clickable graph element)
            try {
                if (element.classList && element.classList.contains('task-clickable')) {
                    return true;
                }
            } catch (e) {
                // Some SVG elements might not have classList, ignore
            }
            
            // Check for CPEE element groups with element-id attribute (tasks and gateways)
            if (element.tagName === 'g' || element.tagName === 'G') {
                const elementId = element.getAttribute('element-id');
                const elementType = element.getAttribute('element-type');
                // If it has element-id or element-type, it's a CPEE task or gateway element
                if (elementId || elementType) {
                    return true;
                }
            }
            
            // Check for Mermaid node elements (tasks and gateways)
            try {
                if (element.classList) {
                    const classList = element.classList;
                    // Mermaid nodes have class "node" (includes tasks and gateways)
                    if (classList.contains('node')) {
                        return true;
                    }
                    // CPEE elements have class "element" (tasks)
                    if (classList.contains('element') && element.getAttribute('element-id')) {
                        return true;
                    }
                    // CPEE gateways have class "choose" or "parallel"
                    if ((classList.contains('choose') || classList.contains('parallel')) && element.getAttribute('element-id')) {
                        return true;
                    }
                }
            } catch (e) {
                // Some SVG elements might not have classList, ignore
            }
            
            // If we've reached an SVG element without finding a graph element,
            // the click is on empty space within the SVG (not on a graph element)
            if (element.tagName === 'svg' || element.tagName === 'SVG') {
                return false;
            }
            
            // If we've reached a graph container without finding a graph element,
            // the click is on empty space within the container
            if (this.isGraphContainer(element)) {
                return false;
            }
            
            element = element.parentElement;
        }
        
        return false;
    }

    /**
     * Check if a click target is inside a content-box of a Graph View section
     * @param {Element} target - Click target element
     * @param {Function} getViewMode - Function to get view mode for a section ID (returns 'visual', 'raw', etc.)
     * @returns {boolean} True if click is inside a Graph View content-box
     */
    isClickInsideVisualContentBox(target, getViewMode = null) {
        if (!target) {
            return false;
        }
        
        // Walk up the DOM tree to find if we're inside a content-box
        let element = target;
        while (element && element !== document.body && element !== document.documentElement) {
            // Check if this element is a content-box or is inside one
            if (element.classList && element.classList.contains('content-box')) {
                // Found a content-box, now check if it's in visual mode
                const sectionElement = element.closest('[id^="input-"], [id^="output-"], [id^="user-input"]');
                if (sectionElement && sectionElement.id) {
                    // Use provided function to get view mode, or assume visual if not provided
                    if (getViewMode) {
                        const mode = getViewMode(sectionElement.id);
                        return mode === 'visual';
                    }
                    // If no getViewMode function provided, assume it's visual
                    return true;
                }
                // If we found a content-box but can't determine the section, assume it's visual
                return true;
            }
            
            element = element.parentElement;
        }
        
        return false;
    }

    /**
     * Check if an element is a graph container
     * @param {Element} element - Element to check
     * @returns {boolean} True if element is a graph container
     */
    isGraphContainer(element) {
        if (!element || !element.id) {
            return false;
        }
        
        const id = element.id;
        
        // Check for graph container IDs
        return id.includes('-graph-container') ||
               id.startsWith('graphcanvas-') ||
               id.startsWith('graphgrid-') ||
               id.startsWith('modelling-') ||
               id.includes('mermaid-graph-');
    }
}

