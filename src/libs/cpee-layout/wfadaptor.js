/**
 * CPEE Layout - Workflow Adaptor
 * Simplified version for CPEE process visualization
 * Based on cpee-layout library concepts
 */

class CPEELayoutEngine {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            theme: 'default',
            autoLayout: true,
            interactive: true,
            nodeSpacing: 120,
            levelSpacing: 100,
            ...options
        };
        
        this.graph = null;
        this.svg = null;
        this.elements = new Map();
        
        this.init();
    }
    
    init() {
        // Create SVG container
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('class', 'cpee-process-diagram');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '400');
        this.svg.style.border = '1px solid #ddd';
        this.svg.style.backgroundColor = '#fafafa';
        
        // Add definitions for markers and patterns
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Arrow marker for edges
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
        this.svg.appendChild(defs);
        
        this.container.appendChild(this.svg);
    }
    
    render(graph) {
        if (!graph || !graph.nodes) {
            this.renderError('Invalid graph data');
            return;
        }
        
        this.graph = graph;
        this.clear();
        
        // Apply auto-layout if enabled
        if (this.options.autoLayout) {
            this.applyAutoLayout();
        }
        
        // Render edges first (so they appear behind nodes)
        if (graph.edges) {
            graph.edges.forEach(edge => this.renderEdge(edge));
        }
        
        // Render nodes
        graph.nodes.forEach(node => this.renderNode(node));
        
        // Adjust SVG viewBox to fit content
        this.adjustViewBox();
    }
    
    applyAutoLayout() {
        const nodes = this.graph.nodes;
        const levels = this.calculateLevels(nodes, this.graph.edges || []);
        
        // Position nodes by levels
        levels.forEach((levelNodes, levelIndex) => {
            const y = 50 + levelIndex * this.options.levelSpacing;
            const totalWidth = levelNodes.length * this.options.nodeSpacing;
            const startX = Math.max(50, (800 - totalWidth) / 2); // Center nodes
            
            levelNodes.forEach((node, nodeIndex) => {
                node.x = startX + nodeIndex * this.options.nodeSpacing;
                node.y = y;
            });
        });
    }
    
    calculateLevels(nodes, edges) {
        const levels = [];
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const visited = new Set();
        const inDegree = new Map();
        
        // Calculate in-degrees
        nodes.forEach(node => inDegree.set(node.id, 0));
        edges.forEach(edge => {
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        });
        
        // Find nodes with no incoming edges (start nodes)
        let currentLevel = nodes.filter(node => inDegree.get(node.id) === 0);
        
        while (currentLevel.length > 0) {
            levels.push([...currentLevel]);
            const nextLevel = [];
            
            currentLevel.forEach(node => {
                visited.add(node.id);
                
                // Find children
                edges.filter(edge => edge.source === node.id)
                     .forEach(edge => {
                         const target = nodeMap.get(edge.target);
                         if (target && !visited.has(target.id)) {
                             inDegree.set(target.id, inDegree.get(target.id) - 1);
                             if (inDegree.get(target.id) === 0 && 
                                 !nextLevel.find(n => n.id === target.id)) {
                                 nextLevel.push(target);
                             }
                         }
                     });
            });
            
            currentLevel = nextLevel;
        }
        
        // Add any remaining nodes (in case of cycles)
        const remaining = nodes.filter(node => !visited.has(node.id));
        if (remaining.length > 0) {
            levels.push(remaining);
        }
        
        return levels;
    }
    
    renderNode(node) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `cpee-node cpee-node-${node.type}`);
        group.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        
        // Node shape based on type
        let shape;
        switch (node.type) {
            case 'start':
                shape = this.createStartNode(node);
                break;
            case 'end':
                shape = this.createEndNode(node);
                break;
            case 'call':
                shape = this.createTaskNode(node);
                break;
            case 'parallel':
                shape = this.createGatewayNode(node, '+');
                break;
            case 'choose':
                shape = this.createGatewayNode(node, '×');
                break;
            case 'loop':
                shape = this.createTaskNode(node, true);
                break;
            case 'error':
                shape = this.createErrorNode(node);
                break;
            default:
                shape = this.createGenericNode(node);
        }
        
        group.appendChild(shape);
        
        // Add label
        if (node.label) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', (node.width || 100) / 2);
            text.setAttribute('y', (node.height || 60) / 2 + 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#333');
            text.textContent = this.truncateText(node.label, 15);
            group.appendChild(text);
        }
        
        // Add interactivity
        if (this.options.interactive) {
            group.style.cursor = 'pointer';
            group.addEventListener('click', () => this.onNodeClick(node));
            group.addEventListener('mouseenter', () => this.onNodeHover(node, true));
            group.addEventListener('mouseleave', () => this.onNodeHover(node, false));
        }
        
        this.svg.appendChild(group);
        this.elements.set(node.id, group);
    }
    
    createStartNode(node) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 30);
        circle.setAttribute('cy', 20);
        circle.setAttribute('r', 15);
        circle.setAttribute('fill', '#4CAF50');
        circle.setAttribute('stroke', '#2E7D32');
        circle.setAttribute('stroke-width', '2');
        return circle;
    }
    
    createEndNode(node) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 30);
        circle.setAttribute('cy', 20);
        circle.setAttribute('r', 15);
        circle.setAttribute('fill', '#F44336');
        circle.setAttribute('stroke', '#C62828');
        circle.setAttribute('stroke-width', '2');
        return circle;
    }
    
    createTaskNode(node, isLoop = false) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', node.width || 100);
        rect.setAttribute('height', node.height || 60);
        rect.setAttribute('rx', '8');
        rect.setAttribute('fill', isLoop ? '#FF9800' : '#2196F3');
        rect.setAttribute('stroke', isLoop ? '#F57C00' : '#1976D2');
        rect.setAttribute('stroke-width', '2');
        return rect;
    }
    
    createGatewayNode(node, symbol) {
        const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const size = 40;
        const points = `${size},0 ${size*2},${size} ${size},${size*2} 0,${size}`;
        diamond.setAttribute('points', points);
        diamond.setAttribute('fill', '#FFC107');
        diamond.setAttribute('stroke', '#F57C00');
        diamond.setAttribute('stroke-width', '2');
        
        // Add symbol
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', size);
        text.setAttribute('y', size + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-size', '16');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#333');
        text.textContent = symbol;
        
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.appendChild(diamond);
        group.appendChild(text);
        
        return group;
    }
    
    createErrorNode(node) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', node.width || 120);
        rect.setAttribute('height', node.height || 60);
        rect.setAttribute('rx', '8');
        rect.setAttribute('fill', '#FFEBEE');
        rect.setAttribute('stroke', '#F44336');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '5,5');
        return rect;
    }
    
    createGenericNode(node) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', node.width || 100);
        rect.setAttribute('height', node.height || 60);
        rect.setAttribute('rx', '8');
        rect.setAttribute('fill', '#E0E0E0');
        rect.setAttribute('stroke', '#757575');
        rect.setAttribute('stroke-width', '2');
        return rect;
    }
    
    renderEdge(edge) {
        const sourceNode = this.graph.nodes.find(n => n.id === edge.source);
        const targetNode = this.graph.nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return;
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        
        // Calculate connection points
        const sourceX = sourceNode.x + (sourceNode.width || 100) / 2;
        const sourceY = sourceNode.y + (sourceNode.height || 60);
        const targetX = targetNode.x + (targetNode.width || 100) / 2;
        const targetY = targetNode.y;
        
        line.setAttribute('x1', sourceX);
        line.setAttribute('y1', sourceY);
        line.setAttribute('x2', targetX);
        line.setAttribute('y2', targetY - 5); // Small gap before target
        line.setAttribute('stroke', '#666');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        line.setAttribute('class', 'cpee-edge');
        
        this.svg.appendChild(line);
    }
    
    renderError(message) {
        this.clear();
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '50');
        text.setAttribute('y', '50');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-size', '14');
        text.setAttribute('fill', '#F44336');
        text.textContent = `Error: ${message}`;
        
        this.svg.appendChild(text);
    }
    
    clear() {
        // Remove all child elements except defs
        Array.from(this.svg.children).forEach(child => {
            if (child.tagName !== 'defs') {
                this.svg.removeChild(child);
            }
        });
        this.elements.clear();
    }
    
    adjustViewBox() {
        if (!this.graph.nodes.length) return;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.graph.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + (node.width || 100));
            maxY = Math.max(maxY, node.y + (node.height || 60));
        });
        
        const padding = 50;
        const viewBoxWidth = maxX - minX + 2 * padding;
        const viewBoxHeight = maxY - minY + 2 * padding;
        
        this.svg.setAttribute('viewBox', 
            `${minX - padding} ${minY - padding} ${viewBoxWidth} ${viewBoxHeight}`);
        this.svg.setAttribute('height', Math.min(600, viewBoxHeight));
    }
    
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    onNodeClick(node) {
        console.log('Node clicked:', node);
        // Emit custom event
        this.container.dispatchEvent(new CustomEvent('nodeClick', { 
            detail: { node } 
        }));
    }
    
    onNodeHover(node, isEntering) {
        const element = this.elements.get(node.id);
        if (element) {
            element.style.opacity = isEntering ? '0.8' : '1';
        }
        
        if (isEntering && node.details) {
            // Could show tooltip with node details
            console.log('Node details:', node.details);
        }
    }
    
    // Public API
    zoomIn() {
        // Implement zoom functionality
        console.log('Zoom in requested');
    }
    
    zoomOut() {
        // Implement zoom functionality  
        console.log('Zoom out requested');
    }
    
    resetZoom() {
        // Reset to original view
        console.log('Reset zoom requested');
    }
    
    exportSVG() {
        return this.svg.outerHTML;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CPEELayoutEngine;
} else if (typeof window !== 'undefined') {
    window.CPEELayoutEngine = CPEELayoutEngine;
}
