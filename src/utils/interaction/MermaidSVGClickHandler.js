/**
 * Mermaid SVG Click Handler
 * Identifies clicked nodes in Mermaid-generated SVGs
 * Matches clicked SVG elements to NodeIdentifier objects
 */

import { SVGClickDetector } from './SVGClickDetector.js';

export class MermaidSVGClickHandler {
    
    constructor() {
        console.log('[MermaidSVGClickHandler] Initialized');
        this.clickDetector = new SVGClickDetector();
    }
    
    /**
     * Identify clicked node from SVG element
     * @param {Element} clickedElement - The element that was clicked
     * @param {NodeIdentifier[]} mermaidTaskList - List of Mermaid nodes (from SVGNodeExtractor)
     * @returns {NodeIdentifier|null} Identified node or null
     */
    identifyClickedNode(clickedElement, mermaidTaskList) {
        console.log('[MermaidSVGClickHandler] Identifying clicked node...');
        console.log(`[MermaidSVGClickHandler] Task list contains ${mermaidTaskList.length} nodes`);
        
        // Find node container using SVGClickDetector (generic detection)
        const nodeContainer = this.clickDetector.findTaskContainer(clickedElement);
        
        if (!nodeContainer) {
            console.log('[MermaidSVGClickHandler] No node container found');
            return null;
        }
        
        // Verify it's actually a Mermaid node
        if (!this.clickDetector.isMermaidNode(nodeContainer)) {
            console.log('[MermaidSVGClickHandler] Container found but not a Mermaid node');
            return null;
        }
        
        // Extract node ID from container (Mermaid-specific)
        const nodeId = this.extractNodeId(nodeContainer);
        
        if (!nodeId) {
            console.warn('[MermaidSVGClickHandler] Could not extract node ID from container');
            return null;
        }
        
        console.log(`[MermaidSVGClickHandler] Extracted node ID: "${nodeId}"`);
        
        // Find matching node in list
        const matchedNode = this.findNodeById(nodeId, mermaidTaskList);
        
        if (matchedNode) {
            console.log(`[MermaidSVGClickHandler] ✅ Node identified: "${matchedNode.label}" (${matchedNode.id})`);
            console.log(`[MermaidSVGClickHandler]    Type: ${matchedNode.type}`);
            console.log(`[MermaidSVGClickHandler]    Position: ${matchedNode.position}`);
            
            // Log clicked element details
            this.logClickDetails(clickedElement, nodeContainer);
        } else {
            console.warn(`[MermaidSVGClickHandler] ❌ No node found with ID "${nodeId}"`);
        }
        
        return matchedNode;
    }
    
    /**
     * Extract node ID from container (Mermaid-specific)
     * Mermaid format: id="flowchart-NodeID-123"
     * @param {Element} container - Node container element
     * @returns {string|null} Node ID or null
     */
    extractNodeId(container) {
        if (!container) {
            return null;
        }
        
        const fullId = container.getAttribute('id');
        
        if (!fullId) {
            return null;
        }
        
        console.log(`[MermaidSVGClickHandler] Full element ID: "${fullId}"`);
        
        // Extract node ID from Mermaid's ID format: flowchart-NodeID-number
        const match = fullId.match(/flowchart-(\w+)-\d+/);
        
        if (match) {
            const nodeId = match[1];
            console.log(`[MermaidSVGClickHandler] Node ID extracted: "${nodeId}"`);
            return nodeId;
        }
        
        // Fallback: try other patterns
        // Sometimes it might be just "NodeID" or "node-NodeID"
        if (fullId.startsWith('flowchart-')) {
            const parts = fullId.split('-');
            if (parts.length >= 2) {
                const nodeId = parts[1];
                console.log(`[MermaidSVGClickHandler] Node ID extracted (fallback): "${nodeId}"`);
                return nodeId;
            }
        }
        
        console.warn(`[MermaidSVGClickHandler] Could not parse node ID from: "${fullId}"`);
        return null;
    }
    
    /**
     * Find node by ID in task list
     * @param {string} nodeId - Node ID to find
     * @param {NodeIdentifier[]} taskList - List of nodes
     * @returns {NodeIdentifier|null} Matched node or null
     */
    findNodeById(nodeId, taskList) {
        if (!Array.isArray(taskList)) {
            console.error('[MermaidSVGClickHandler] Task list is not an array');
            return null;
        }
        
        // Try exact match first
        let match = taskList.find(task => task.id === nodeId);
        
        if (match) {
            console.log(`[MermaidSVGClickHandler] Exact ID match found`);
            return match;
        }
        
        // Try case-insensitive match
        match = taskList.find(task => task.id.toLowerCase() === nodeId.toLowerCase());
        
        if (match) {
            console.log(`[MermaidSVGClickHandler] Case-insensitive ID match found`);
            return match;
        }
        
        // Try matching by SVG element reference
        match = taskList.find(task => {
            const svgElement = task.getSVGElement ? task.getSVGElement() : task.svgElement;
            if (!svgElement) {
                return false;
            }
            
            const fullId = svgElement.id;
            const extractedId = fullId.match(/flowchart-(\w+)-\d+/);
            return extractedId && extractedId[1] === nodeId;
        });
        
        if (match) {
            console.log(`[MermaidSVGClickHandler] Match found by SVG element reference`);
            return match;
        }
        
        return null;
    }
    
    /**
     * Identify clicked element type (rect, text, circle, etc.)
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
        if (tag === 'circle') {
            return 'circle';
        }
        if (tag === 'ellipse') {
            return 'ellipse';
        }
        if (tag === 'polygon') {
            return 'polygon/diamond';
        }
        if (tag === 'text' || tag === 'tspan') {
            return 'text';
        }
        if (tag === 'path') {
            return 'path';
        }
        if (tag === 'g') {
            // Check if it's a node container
            if (this.isNodeContainer(element)) {
                return 'node-container';
            }
            return 'group';
        }
        
        return tag;
    }
    
    /**
     * Identify Mermaid node shape
     * @param {Element} nodeContainer - Node container element
     * @returns {string} Node shape
     */
    identifyNodeShape(nodeContainer) {
        if (!nodeContainer) {
            return 'unknown';
        }
        
        // Check child elements for shape indicators
        const rect = nodeContainer.querySelector('rect');
        const circle = nodeContainer.querySelector('circle');
        const polygon = nodeContainer.querySelector('polygon');
        const path = nodeContainer.querySelector('path');
        
        if (circle) {
            return 'circle';
        }
        if (polygon) {
            return 'diamond/polygon';
        }
        if (rect) {
            // Check if it's rounded (rounded rectangle)
            const rx = rect.getAttribute('rx');
            if (rx && parseFloat(rx) > 0) {
                return 'rounded-rectangle';
            }
            return 'rectangle';
        }
        if (path) {
            return 'path/custom-shape';
        }
        
        return 'unknown';
    }
    
    /**
     * Log detailed click information
     * @param {Element} clickedElement - The element that was clicked
     * @param {Element} nodeContainer - The node container found
     */
    logClickDetails(clickedElement, nodeContainer) {
        console.log('[MermaidSVGClickHandler] === Click Details ===');
        
        // Clicked element
        const clickedType = this.identifyClickedElementType(clickedElement);
        console.log(`[MermaidSVGClickHandler] Clicked on: ${clickedType}`);
        console.log(`[MermaidSVGClickHandler] Clicked element:`, this.clickDetector.getElementDescription(clickedElement));
        
        // Node container
        console.log(`[MermaidSVGClickHandler] Node container:`, this.clickDetector.getElementDescription(nodeContainer));
        
        // Node shape
        const shape = this.identifyNodeShape(nodeContainer);
        console.log(`[MermaidSVGClickHandler] Node shape: ${shape}`);
        
        // Container classes
        const classes = nodeContainer.className.baseVal || nodeContainer.className;
        console.log(`[MermaidSVGClickHandler] Container classes: ${classes}`);
        
        // Container attributes
        const attrs = Array.from(nodeContainer.attributes)
            .map(attr => `${attr.name}="${attr.value}"`)
            .join(', ');
        console.log(`[MermaidSVGClickHandler] Container attributes: ${attrs}`);
        
        // Check for label
        const label = nodeContainer.querySelector('text, tspan');
        if (label) {
            console.log(`[MermaidSVGClickHandler] Node label text: "${label.textContent.trim()}"`);
        }
    }
    
    /**
     * Check if click is on a node element (not background)
     * @param {Element} clickedElement - Clicked element
     * @returns {boolean} True if click is on a node
     */
    isClickOnNode(clickedElement) {
        const nodeContainer = this.clickDetector.findTaskContainer(clickedElement);
        return nodeContainer !== null && this.clickDetector.isMermaidNode(nodeContainer);
    }
    
    /**
     * Get all node containers in SVG
     * @param {Element} svgContainer - SVG container element
     * @returns {Element[]} Array of node containers
     */
    getAllNodeContainers(svgContainer) {
        if (!svgContainer) {
            return [];
        }
        
        const containers = svgContainer.querySelectorAll('g.node');
        console.log(`[MermaidSVGClickHandler] Found ${containers.length} node containers in SVG`);
        
        return Array.from(containers);
    }
    
    /**
     * Match all nodes to their SVG elements
     * @param {NodeIdentifier[]} taskList - List of nodes
     * @param {Element} svgContainer - SVG container
     * @returns {Map<string, Element>} Map of node ID to SVG element
     */
    matchNodesToElements(taskList, svgContainer) {
        const mapping = new Map();
        const containers = this.getAllNodeContainers(svgContainer);
        
        console.log(`[MermaidSVGClickHandler] Matching ${taskList.length} nodes to ${containers.length} SVG elements`);
        
        taskList.forEach(task => {
            const matchingElement = containers.find(el => {
                const fullId = el.id;
                const match = fullId.match(/flowchart-(\w+)-\d+/);
                return match && match[1] === task.id;
            });
            
            if (matchingElement) {
                mapping.set(task.id, matchingElement);
                console.log(`[MermaidSVGClickHandler] Matched node "${task.id}" to SVG element`);
            } else {
                console.warn(`[MermaidSVGClickHandler] No SVG element found for node "${task.id}"`);
            }
        });
        
        return mapping;
    }
}

