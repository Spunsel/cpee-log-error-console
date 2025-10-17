/**
 * CPEE Layout Library - Workflow Adaptor
 * Themable, flexible BPMN auto-layout library for CPEE
 * Based on: https://github.com/etm/cpee-layout
 */

class WFAdaptor {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            theme: 'cpee-default',
            autoLayout: true,
            interactive: true,
            ...options
        };
        
        this.nodes = new Map();
        this.edges = [];
        this.svgElement = null;
        
        this.init();
    }
    
    init() {
        // Create SVG container
        this.container.innerHTML = '';
        this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgElement.setAttribute('class', 'cpee-workflow-graph');
        this.svgElement.setAttribute('width', '100%');
        this.svgElement.setAttribute('height', '400');
        
        // Add SVG definitions for arrows and patterns
        this.addSVGDefinitions();
        
        this.container.appendChild(this.svgElement);
    }
    
    addSVGDefinitions() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Arrow marker
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#666');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.svgElement.appendChild(defs);
    }
    
    /**
     * Load CPEE XML and render workflow
     */
    loadCPEEXML(xmlString) {
        try {
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing error: ' + parseError.textContent);
            }
            
            // Extract workflow elements
            this.extractWorkflowElements(xmlDoc);
            
            // Auto-layout if enabled
            if (this.options.autoLayout) {
                this.autoLayout();
            }
            
            // Render the workflow
            this.render();
            
        } catch (error) {
            console.error('Error loading CPEE XML:', error);
            this.renderError('Failed to load CPEE XML: ' + error.message);
        }
    }
    
    extractWorkflowElements(xmlDoc) {
        this.nodes.clear();
        this.edges = [];
        
        // Add start node
        this.nodes.set('start', {
            id: 'start',
            type: 'start',
            label: 'Start',
            x: 50,
            y: 100,
            width: 60,
            height: 40
        });
        
        let nodeCounter = 0;
        let currentX = 150;
        const nodeSpacing = 150;
        
        // Extract call elements (tasks)
        const callElements = xmlDoc.querySelectorAll('call');
        callElements.forEach((callEl, index) => {
            const id = callEl.getAttribute('id') || `task_${index}`;
            const labelEl = callEl.querySelector('label');
            const label = labelEl ? labelEl.textContent.trim() : `Task ${index + 1}`;
            
            this.nodes.set(id, {
                id: id,
                type: 'call',
                label: label,
                x: currentX,
                y: 100,
                width: 120,
                height: 40
            });
            
            // Create edge from previous node
            const prevNodeId = nodeCounter === 0 ? 'start' : Array.from(this.nodes.keys())[nodeCounter];
            this.edges.push({
                id: `edge_${nodeCounter}`,
                from: prevNodeId,
                to: id
            });
            
            currentX += nodeSpacing;
            nodeCounter++;
        });
        
        // Add end node
        this.nodes.set('end', {
            id: 'end',
            type: 'end',
            label: 'End',
            x: currentX,
            y: 100,
            width: 60,
            height: 40
        });
        
        // Connect last task to end
        if (nodeCounter > 0) {
            const lastTaskId = Array.from(this.nodes.keys())[nodeCounter];
            this.edges.push({
                id: `edge_end`,
                from: lastTaskId,
                to: 'end'
            });
        } else {
            // Direct connection from start to end if no tasks
            this.edges.push({
                id: 'edge_direct',
                from: 'start',
                to: 'end'
            });
        }
    }
    
    autoLayout() {
        // Simple horizontal layout
        let currentX = 50;
        const nodeSpacing = 150;
        const centerY = 100;
        
        this.nodes.forEach((node) => {
            node.x = currentX;
            node.y = centerY;
            currentX += nodeSpacing;
        });
    }
    
    render() {
        // Clear existing content
        const existingElements = this.svgElement.querySelectorAll('g, line');
        existingElements.forEach(el => el.remove());
        
        // Render edges first (so they appear behind nodes)
        this.renderEdges();
        
        // Render nodes
        this.renderNodes();
        
        // Adjust SVG viewBox
        this.adjustViewBox();
    }
    
    renderEdges() {
        this.edges.forEach(edge => {
            const fromNode = this.nodes.get(edge.from);
            const toNode = this.nodes.get(edge.to);
            
            if (fromNode && toNode) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', fromNode.x + fromNode.width);
                line.setAttribute('y1', fromNode.y + fromNode.height / 2);
                line.setAttribute('x2', toNode.x);
                line.setAttribute('y2', toNode.y + toNode.height / 2);
                line.setAttribute('class', 'cpee-edge');
                line.setAttribute('stroke', '#666');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('marker-end', 'url(#arrowhead)');
                
                this.svgElement.appendChild(line);
            }
        });
    }
    
    renderNodes() {
        this.nodes.forEach(node => {
            const nodeGroup = this.createNodeElement(node);
            this.svgElement.appendChild(nodeGroup);
        });
    }
    
    createNodeElement(node) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `cpee-node cpee-node-${node.type}`);
        group.setAttribute('data-id', node.id);
        
        // Create node shape based on type
        let shape;
        if (node.type === 'start') {
            shape = this.createStartNode(node);
        } else if (node.type === 'end') {
            shape = this.createEndNode(node);
        } else {
            shape = this.createTaskNode(node);
        }
        
        group.appendChild(shape);
        
        // Add label
        if (node.label) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x + node.width / 2);
            text.setAttribute('y', node.y + node.height / 2 + 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('class', 'cpee-node-label');
            text.textContent = this.truncateText(node.label, 15);
            group.appendChild(text);
        }
        
        return group;
    }
    
    createStartNode(node) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x + node.width / 2);
        circle.setAttribute('cy', node.y + node.height / 2);
        circle.setAttribute('r', Math.min(node.width, node.height) / 2);
        circle.setAttribute('class', 'cpee-start-node');
        circle.setAttribute('fill', '#5cb85c');
        circle.setAttribute('stroke', '#4cae4c');
        circle.setAttribute('stroke-width', '2');
        return circle;
    }
    
    createEndNode(node) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x + node.width / 2);
        circle.setAttribute('cy', node.y + node.height / 2);
        circle.setAttribute('r', Math.min(node.width, node.height) / 2);
        circle.setAttribute('class', 'cpee-end-node');
        circle.setAttribute('fill', '#d9534f');
        circle.setAttribute('stroke', '#d43f3a');
        circle.setAttribute('stroke-width', '2');
        return circle;
    }
    
    createTaskNode(node) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', node.x);
        rect.setAttribute('y', node.y);
        rect.setAttribute('width', node.width);
        rect.setAttribute('height', node.height);
        rect.setAttribute('rx', '5');
        rect.setAttribute('class', 'cpee-task-node');
        rect.setAttribute('fill', '#f0ad4e');
        rect.setAttribute('stroke', '#ec971f');
        rect.setAttribute('stroke-width', '2');
        return rect;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    adjustViewBox() {
        if (this.nodes.size === 0) return;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
        });
        
        const padding = 20;
        const width = maxX - minX + 2 * padding;
        const height = maxY - minY + 2 * padding;
        
        this.svgElement.setAttribute('viewBox', 
            `${minX - padding} ${minY - padding} ${width} ${height}`);
        this.svgElement.setAttribute('width', width);
        this.svgElement.setAttribute('height', height);
    }
    
    renderError(message) {
        this.svgElement.innerHTML = `
            <text x="50%" y="50%" text-anchor="middle" fill="#d9534f" font-size="14">
                ${message}
            </text>
        `;
    }
    
    /**
     * Clear the workflow
     */
    clear() {
        this.nodes.clear();
        this.edges = [];
        if (this.svgElement) {
            const elements = this.svgElement.querySelectorAll('g, line');
            elements.forEach(el => el.remove());
        }
    }
    
    /**
     * Get SVG as string
     */
    getSVG() {
        return new XMLSerializer().serializeToString(this.svgElement);
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.WFAdaptor = WFAdaptor;
}

// Also export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WFAdaptor;
}
