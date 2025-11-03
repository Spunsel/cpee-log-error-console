/**
 * SVG Click Detector
 * Generic utility for detecting and handling clicks on SVG elements
 * Uses event delegation for efficient event handling on dynamic SVG content
 */

export class SVGClickDetector {
    
    constructor() {
        console.log('[SVGClickDetector] Initialized');
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
            console.error('[SVGClickDetector] Container not found:', svgContainer);
            return () => {};
        }
        
        console.log('[SVGClickDetector] Attaching click listener to:', this.getElementDescription(container));
        
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
        
        console.log(`[SVGClickDetector] Listener attached (ID: ${listenerId})`);
        
        // Return cleanup function
        return () => {
            container.removeEventListener('click', clickHandler);
            this.activeListeners.delete(listenerId);
            console.log(`[SVGClickDetector] Listener removed (ID: ${listenerId})`);
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
        const coordinates = {
            x: event.clientX,
            y: event.clientY,
            offsetX: event.offsetX,
            offsetY: event.offsetY
        };
        
        console.log(`[SVGClickDetector] Click #${this.clickCount} detected`);
        console.log(`[SVGClickDetector] Coordinates:`, coordinates);
        console.log(`[SVGClickDetector] Target element:`, this.getElementDescription(clickedElement));
        
        // Get element path (from clicked element up to SVG root)
        const elementPath = this.getElementPath(clickedElement);
        console.log(`[SVGClickDetector] Element path:`, elementPath.map(el => this.getElementDescription(el)).join(' → '));
        
        // Find task/node container
        const taskContainer = this.findTaskContainer(clickedElement);
        if (taskContainer) {
            console.log(`[SVGClickDetector] Task container found:`, this.getElementDescription(taskContainer));
        } else {
            console.log(`[SVGClickDetector] No task container found (clicked on background or non-task element)`);
        }
        
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
                console.log(`[SVGClickDetector] Found CPEE task at depth ${depth}`);
                return current;
            }
            
            // Mermaid node: <g class="node" id="flowchart-...">
            if (this.isMermaidNode(current)) {
                console.log(`[SVGClickDetector] Found Mermaid node at depth ${depth}`);
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
     * Get all clickable elements in container
     * @param {Element} container - SVG container
     * @returns {Element[]} Array of clickable elements
     */
    getClickableElements(container) {
        const elements = [];
        
        // Find all CPEE tasks
        const cpeeTasks = container.querySelectorAll('g.element[element-id]');
        cpeeTasks.forEach(task => elements.push(task));
        
        // Find all Mermaid nodes
        const mermaidNodes = container.querySelectorAll('g.node');
        mermaidNodes.forEach(node => elements.push(node));
        
        console.log(`[SVGClickDetector] Found ${elements.length} clickable elements (${cpeeTasks.length} CPEE, ${mermaidNodes.length} Mermaid)`);
        
        return elements;
    }
    
    /**
     * Add visual indicator for clickable elements
     * @param {Element} container - SVG container
     * @param {string} cursorStyle - CSS cursor style (default: 'pointer')
     */
    makeElementsClickable(container, cursorStyle = 'pointer') {
        const elements = this.getClickableElements(container);
        
        elements.forEach(element => {
            element.style.cursor = cursorStyle;
        });
        
        console.log(`[SVGClickDetector] Made ${elements.length} elements clickable (cursor: ${cursorStyle})`);
    }
    
    /**
     * Remove all active listeners
     */
    cleanup() {
        console.log(`[SVGClickDetector] Cleaning up ${this.activeListeners.size} listeners`);
        
        this.activeListeners.forEach((listener, id) => {
            listener.container.removeEventListener('click', listener.handler);
            console.log(`[SVGClickDetector] Removed listener: ${id}`);
        });
        
        this.activeListeners.clear();
        this.clickCount = 0;
    }
    
    /**
     * Get statistics about click detection
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            activeListeners: this.activeListeners.size,
            totalClicks: this.clickCount
        };
    }
}

