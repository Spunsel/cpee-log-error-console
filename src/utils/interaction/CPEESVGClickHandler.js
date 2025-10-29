/**
 * CPEE SVG Click Handler
 * Identifies clicked tasks in CPEE WfAdaptor-generated SVGs
 * Matches clicked SVG elements to TaskIdentifier objects
 */

import { SVGClickDetector } from './SVGClickDetector.js';

export class CPEESVGClickHandler {
    
    constructor() {
        console.log('[CPEESVGClickHandler] Initialized');
        this.clickDetector = new SVGClickDetector();
    }
    
    /**
     * Identify clicked task from SVG element
     * @param {Element} clickedElement - The element that was clicked
     * @param {TaskIdentifier[]} cpeeTaskList - List of CPEE tasks (from SVGTaskExtractor)
     * @returns {TaskIdentifier|null} Identified task or null
     */
    identifyClickedTask(clickedElement, cpeeTaskList) {
        console.log('[CPEESVGClickHandler] Identifying clicked task...');
        console.log(`[CPEESVGClickHandler] Task list contains ${cpeeTaskList.length} tasks`);
        
        // Find task container using SVGClickDetector (generic detection)
        const taskContainer = this.clickDetector.findTaskContainer(clickedElement);
        
        if (!taskContainer) {
            console.log('[CPEESVGClickHandler] No task container found');
            return null;
        }
        
        // Verify it's actually a CPEE task
        if (!this.clickDetector.isCPEETask(taskContainer)) {
            console.log('[CPEESVGClickHandler] Container found but not a CPEE task');
            return null;
        }
        
        // Extract task ID from container (CPEE-specific)
        const taskId = this.extractTaskId(taskContainer);
        
        if (!taskId) {
            console.warn('[CPEESVGClickHandler] Could not extract task ID from container');
            return null;
        }
        
        console.log(`[CPEESVGClickHandler] Extracted task ID: "${taskId}"`);
        
        // Find matching task in list
        const matchedTask = this.findTaskById(taskId, cpeeTaskList);
        
        if (matchedTask) {
            console.log(`[CPEESVGClickHandler] ✅ Task identified: "${matchedTask.label}" (${matchedTask.id})`);
            console.log(`[CPEESVGClickHandler]    Type: ${matchedTask.type}`);
            console.log(`[CPEESVGClickHandler]    Position: ${matchedTask.position}`);
            
            // Log clicked element details
            this.logClickDetails(clickedElement, taskContainer);
        } else {
            console.warn(`[CPEESVGClickHandler] ❌ No task found with ID "${taskId}"`);
        }
        
        return matchedTask;
    }
    
    /**
     * Extract task ID from container (CPEE-specific)
     * @param {Element} container - Task container element
     * @returns {string|null} Task ID or null
     */
    extractTaskId(container) {
        if (!container) {
            return null;
        }
        
        const taskId = container.getAttribute('element-id');
        
        if (taskId) {
            console.log(`[CPEESVGClickHandler] Task ID from element-id: "${taskId}"`);
        }
        
        return taskId;
    }
    
    /**
     * Find task by ID in task list
     * @param {string} taskId - Task ID to find
     * @param {TaskIdentifier[]} taskList - List of tasks
     * @returns {TaskIdentifier|null} Matched task or null
     */
    findTaskById(taskId, taskList) {
        if (!Array.isArray(taskList)) {
            console.error('[CPEESVGClickHandler] Task list is not an array');
            return null;
        }
        
        // Try exact match first
        let match = taskList.find(task => task.id === taskId);
        
        if (match) {
            console.log(`[CPEESVGClickHandler] Exact ID match found`);
            return match;
        }
        
        // Try case-insensitive match
        match = taskList.find(task => task.id.toLowerCase() === taskId.toLowerCase());
        
        if (match) {
            console.log(`[CPEESVGClickHandler] Case-insensitive ID match found`);
            return match;
        }
        
        // Try matching by SVG element reference
        match = taskList.find(task => {
            const svgElement = task.getSVGElement ? task.getSVGElement() : task.svgElement;
            return svgElement && svgElement.getAttribute('element-id') === taskId;
        });
        
        if (match) {
            console.log(`[CPEESVGClickHandler] Match found by SVG element reference`);
            return match;
        }
        
        return null;
    }
    
    /**
     * Identify clicked element type (rect, text, icon, etc.)
     * @param {Element} element - Clicked element
     * @returns {string} Element type
     */
    identifyClickedElementType(element) {
        if (!element || !element.tagName) {
            return 'unknown';
        }
        
        const tag = element.tagName.toLowerCase();
        
        // Direct SVG shape elements
        if (tag === 'rect') {
            return 'rectangle';
        }
        if (tag === 'text' || tag === 'tspan') {
            return 'text';
        }
        if (tag === 'path') {
            return 'path/icon';
        }
        if (tag === 'use') {
            return 'symbol-reference';
        }
        if (tag === 'g') {
            // Check if it's a task container
            if (this.isTaskContainer(element)) {
                return 'task-container';
            }
            return 'group';
        }
        
        return tag;
    }
    
    /**
     * Log detailed click information
     * @param {Element} clickedElement - The element that was clicked
     * @param {Element} taskContainer - The task container found
     */
    logClickDetails(clickedElement, taskContainer) {
        console.log('[CPEESVGClickHandler] === Click Details ===');
        
        // Clicked element
        const clickedType = this.identifyClickedElementType(clickedElement);
        console.log(`[CPEESVGClickHandler] Clicked on: ${clickedType}`);
        console.log(`[CPEESVGClickHandler] Clicked element:`, this.clickDetector.getElementDescription(clickedElement));
        
        // Task container
        console.log(`[CPEESVGClickHandler] Task container:`, this.clickDetector.getElementDescription(taskContainer));
        
        // Container classes
        const classes = taskContainer.className.baseVal || taskContainer.className;
        console.log(`[CPEESVGClickHandler] Container classes: ${classes}`);
        
        // Container attributes
        const attrs = Array.from(taskContainer.attributes)
            .map(attr => `${attr.name}="${attr.value}"`)
            .join(', ');
        console.log(`[CPEESVGClickHandler] Container attributes: ${attrs}`);
        
        // Check for label
        const label = taskContainer.querySelector('text.label');
        if (label) {
            console.log(`[CPEESVGClickHandler] Task label text: "${label.textContent.trim()}"`);
        }
    }
    
    
    /**
     * Check if click is on a task element (not background)
     * @param {Element} clickedElement - Clicked element
     * @returns {boolean} True if click is on a task
     */
    isClickOnTask(clickedElement) {
        const taskContainer = this.clickDetector.findTaskContainer(clickedElement);
        return taskContainer !== null && this.clickDetector.isCPEETask(taskContainer);
    }
    
    /**
     * Get all task containers in SVG
     * @param {Element} svgContainer - SVG container element
     * @returns {Element[]} Array of task containers
     */
    getAllTaskContainers(svgContainer) {
        if (!svgContainer) {
            return [];
        }
        
        const containers = svgContainer.querySelectorAll('g.element[element-id]');
        console.log(`[CPEESVGClickHandler] Found ${containers.length} task containers in SVG`);
        
        return Array.from(containers);
    }
    
    /**
     * Match all tasks to their SVG elements
     * @param {TaskIdentifier[]} taskList - List of tasks
     * @param {Element} svgContainer - SVG container
     * @returns {Map<string, Element>} Map of task ID to SVG element
     */
    matchTasksToElements(taskList, svgContainer) {
        const mapping = new Map();
        const containers = this.getAllTaskContainers(svgContainer);
        
        console.log(`[CPEESVGClickHandler] Matching ${taskList.length} tasks to ${containers.length} SVG elements`);
        
        taskList.forEach(task => {
            const matchingElement = containers.find(el => 
                el.getAttribute('element-id') === task.id
            );
            
            if (matchingElement) {
                mapping.set(task.id, matchingElement);
                console.log(`[CPEESVGClickHandler] Matched task "${task.id}" to SVG element`);
            } else {
                console.warn(`[CPEESVGClickHandler] No SVG element found for task "${task.id}"`);
            }
        });
        
        return mapping;
    }
}

