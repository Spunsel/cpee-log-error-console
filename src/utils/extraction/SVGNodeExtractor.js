/**
 * SVG Node Extractor
 * Extracts task/node information from rendered SVG elements
 * Supports both CPEE WfAdaptor SVGs and Mermaid SVGs
 */

import { NodeIdentifier } from '../../models/NodeIdentifier.js';

export class SVGNodeExtractor {
    
    constructor() {
    }
    
    /**
     * Extract tasks from CPEE SVG rendered by WfAdaptor
     * @param {Element} svgElement - SVG DOM element
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects
     */
    extractTasksFromCPEESVG(svgElement) {        
        try {
            const tasks = [];
            
            // Find all task groups in CPEE SVG
            // CPEE uses <g class="element" element-id="..."> for tasks
            const taskGroups = svgElement.querySelectorAll('g.element[element-id]');
                        
            taskGroups.forEach((_group, index) => {
                const task = this.extractTaskFromCPEEGroup(_group, index);
                if (task && task.isValid()) {
                    tasks.push(task);
                }
            });
            return tasks;
            
        } catch (error) {
            console.error('[SVGNodeExtractor] Error extracting tasks from CPEE SVG:', error);
            return [];
        }
    }
    
    /**
     * Extract task from a single CPEE SVG group element
     * @param {Element} group - SVG group element
     * @param {number} position - Position in workflow
     * @returns {NodeIdentifier|null} NodeIdentifier or null
     */
    extractTaskFromCPEEGroup(group, position) {
        try {
            // Extract ID from element-id attribute
            const id = group.getAttribute('element-id') || `task-${position}`;
            
            // Extract label from text element
            let label = this.extractLabelFromCPEEGroup(group);
            
            // Use ID as fallback
            if (!label) {
                label = id;
            }
            
            // Determine type from class names or use elements
            const type = this.determineCPEETaskType(group);
            
            // Extract additional metadata
            const metadata = {
                classes: group.className.baseVal,
                transform: group.getAttribute('transform') || ''
            };
            
            // Create NodeIdentifier
            const task = new NodeIdentifier(id, label, type, 'cpee', metadata, position);
            
            // Store reference to SVG element
            task.setSVGElement(group);
            
            return task;
            
        } catch (error) {
            console.error('[SVGNodeExtractor] Error extracting task from CPEE group:', error);
            return null;
        }
    }
    
    /**
     * Extract label from CPEE SVG group
     * @param {Element} group - SVG group element
     * @returns {string|null} Label or null
     */
    extractLabelFromCPEEGroup(group) {
        // Try to find text element with label
        const textElement = group.querySelector('text.label, text');
        if (textElement) {
            return textElement.textContent.trim();
        }
        
        // Try title element
        const titleElement = group.querySelector('title');
        if (titleElement) {
            return titleElement.textContent.trim();
        }
        
        return null;
    }
    
    /**
     * Determine CPEE task type from SVG group
     * @param {Element} group - SVG group element
     * @returns {string} Task type
     */
    determineCPEETaskType(group) {
        const classes = group.className.baseVal;
        
        // Check for specific CPEE task types in class names
        if (classes.includes('call')) {
            return 'call';
        }
        if (classes.includes('manipulate')) {
            return 'manipulate';
        }
        if (classes.includes('script')) {
            return 'script';
        }
        if (classes.includes('parallel')) {
            return 'parallel';
        }
        if (classes.includes('choose')) {
            return 'choose';
        }
        if (classes.includes('loop')) {
            return 'loop';
        }
        
        // Check for use elements referencing symbols
        const useElement = group.querySelector('use');
        if (useElement) {
            const href = useElement.getAttribute('xlink:href') || useElement.getAttribute('href');
            if (href) {
                if (href.includes('call')) {
                    return 'call';
                }
                if (href.includes('manipulate')) {
                    return 'manipulate';
                }
                if (href.includes('script')) {
                    return 'script';
                }
            }
        }
        
        return 'task'; // Default fallback
    }
    
    /**
     * Extract tasks from Mermaid SVG
     * @param {Element} svgElement - SVG DOM element
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects
     */
    extractTasksFromMermaidSVG(svgElement) {        
        try {
            const tasks = [];
            
            // Find all node groups in Mermaid SVG
            // Mermaid uses <g class="node"> for nodes
            const nodeGroups = svgElement.querySelectorAll('g.node');
                        
            nodeGroups.forEach((_group, index) => {
                const task = this.extractTaskFromMermaidGroup(_group, index);
                if (task && task.isValid()) {
                    tasks.push(task);
                }
            });
            return tasks;
            
        } catch (error) {
            console.error('[SVGNodeExtractor] Error extracting tasks from Mermaid SVG:', error);
            return [];
        }
    }
    
    /**
     * Extract task from a single Mermaid SVG group element
     * @param {Element} group - SVG group element
     * @param {number} position - Position in workflow
     * @returns {NodeIdentifier|null} NodeIdentifier or null
     */
    extractTaskFromMermaidGroup(group, position) {
        try {
            // Extract ID from id attribute (Mermaid uses flowchart-NodeID-...)
            const fullId = group.getAttribute('id') || '';
            let id = this.extractMermaidNodeId(fullId);
            
            if (!id) {
                id = `node-${position}`;
            }
            
            // Extract label from text element or use id
            let label = this.extractLabelFromMermaidGroup(group);
            
            if (!label) {
                label = id;
            }
            
            // Determine type from shape
            const type = this.determineMermaidNodeType(group);
            
            // Extract additional metadata
            const metadata = {
                fullId: fullId,
                classes: group.className.baseVal,
                transform: group.getAttribute('transform') || ''
            };
            
            // Store shape information
            const shape = this.extractMermaidShape(group);
            if (shape) {
                metadata.shape = shape;
            }
            
            // Create NodeIdentifier
            const task = new NodeIdentifier(id, label, type, 'mermaid', metadata, position);
            
            // Store reference to SVG element
            task.setSVGElement(group);
            
            return task;
            
        } catch (error) {
            console.error('[SVGNodeExtractor] Error extracting task from Mermaid group:', error);
            return null;
        }
    }
    
    /**
     * Extract Mermaid node ID from full SVG id
     * @param {string} fullId - Full SVG id (e.g., "flowchart-A-123")
     * @returns {string|null} Node ID or null
     */
    extractMermaidNodeId(fullId) {
        // Mermaid format: flowchart-NodeID-number
        const match = fullId.match(/flowchart-(\w+)-\d+/);
        if (match) {
            return match[1];
        }
        
        // Alternative format: just use the full id
        if (fullId && !fullId.startsWith('flowchart-')) {
            return fullId;
        }
        
        return null;
    }
    
    /**
     * Extract label from Mermaid SVG group
     * @param {Element} group - SVG group element
     * @returns {string|null} Label or null
     */
    extractLabelFromMermaidGroup(group) {
        // Try to find text element
        const textElement = group.querySelector('text');
        if (textElement) {
            // Get all text content, including tspans
            return textElement.textContent.trim();
        }
        
        // Try title element
        const titleElement = group.querySelector('title');
        if (titleElement) {
            return titleElement.textContent.trim();
        }
        
        return null;
    }
    
    /**
     * Determine Mermaid node type from shape
     * @param {Element} group - SVG group element
     * @returns {string} Node type
     */
    determineMermaidNodeType(group) {
        // Check for shape elements
        const rect = group.querySelector('rect');
        const polygon = group.querySelector('polygon');
        const circle = group.querySelector('circle');
        const ellipse = group.querySelector('ellipse');
        const path = group.querySelector('path');
        
        if (polygon) {
            // Diamond shape (decision)
            return 'decision';
        }
        
        if (circle || ellipse) {
            // Circle/ellipse (event)
            return 'event';
        }
        
        if (rect) {
            // Check if rounded corners (stadium/rounded)
            const rx = rect.getAttribute('rx');
            if (rx && parseFloat(rx) > 0) {
                return 'event';
            }
            return 'task';
        }
        
        if (path) {
            // Could be various shapes
            return 'task';
        }
        
        return 'task'; // Default
    }
    
    /**
     * Extract Mermaid shape information
     * @param {Element} group - SVG group element
     * @returns {string|null} Shape name or null
     */
    extractMermaidShape(group) {
        const rect = group.querySelector('rect');
        const polygon = group.querySelector('polygon');
        const circle = group.querySelector('circle');
        const ellipse = group.querySelector('ellipse');
        
        if (polygon) {
            return 'diamond';
        }
        if (circle) {
            return 'circle';
        }
        if (ellipse) {
            return 'ellipse';
        }
        if (rect) {
            const rx = rect.getAttribute('rx');
            if (rx && parseFloat(rx) > 0) {
                return 'rounded';
            }
            return 'rectangle';
        }
        
        return null;
    }
    
    /**
     * Extract tasks from any SVG (auto-detect format)
     * @param {Element} svgElement - SVG DOM element
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects
     */
    extractTasks(svgElement) {        
        // Check for CPEE indicators
        const cpeeElements = svgElement.querySelectorAll('g.element[element-id]');
        if (cpeeElements.length > 0) {
            return this.extractTasksFromCPEESVG(svgElement);
        }
        
        // Check for Mermaid indicators
        const mermaidNodes = svgElement.querySelectorAll('g.node');
        if (mermaidNodes.length > 0) {
            return this.extractTasksFromMermaidSVG(svgElement);
        }
        
        console.warn('[SVGNodeExtractor] Could not detect SVG format');
        return [];
    }
}

