/**
 * Progressive Graph Service
 * Handles step-by-step visualization of CPEE process evolution
 */

export class ProgressiveGraphService {
    
    /**
     * Generate progressive graph data from all steps
     * @param {Array} steps - Array of step data
     * @returns {Array} Array of progressive graph states
     */
    static generateProgressiveStates(steps) {
        const progressiveStates = [];
        
        for (let i = 0; i < steps.length; i++) {
            const currentStep = steps[i];
            
            // Each step represents the state after this modification
            const state = {
                stepNumber: i + 1,
                title: `Step ${i + 1}: After "${this.extractUserAction(currentStep.content.userInput)}"`,
                cpeeXml: currentStep.content.outputCpeeTree,
                userAction: currentStep.content.userInput,
                mermaidGraph: currentStep.content.outputIntermediate,
                timestamp: currentStep.timestamp
            };
            
            progressiveStates.push(state);
        }
        
        return progressiveStates;
    }
    
    /**
     * Extract a clean user action description from user input
     * @param {string} userInput - Raw user input content
     * @returns {string} Clean action description
     */
    static extractUserAction(userInput) {
        if (!userInput) return 'Unknown action';
        
        // Remove markdown headers and cleanup
        let action = userInput
            .replace(/# User Input:\s*/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .trim();
            
        // Take first line if multi-line
        const firstLine = action.split('\n')[0];
        
        // Limit length for display
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
    }
    
    /**
     * Generate iframe URL for CPEE-style XML visualization
     * Uses CPEE's graph viewer approach but with log XML content
     * @param {string} cpeeXml - CPEE XML content
     * @param {number} stepNumber - Step number for identification
     * @param {string} processNumber - Original process number (optional)
     * @returns {string} URL for iframe visualization
     */
    static generateVisualizationURL(cpeeXml, stepNumber, processNumber = null) {
        // If we have a process number, try to use the actual CPEE graph viewer
        // But modify it to show the specific step state
        if (processNumber) {
            // For now, create a CPEE-styled visualization that mimics the official viewer
            const htmlContent = this.createCPEEStyleVisualizationHTML(cpeeXml, stepNumber, processNumber);
            return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        } else {
            // Fallback to CPEE-styled visualization
            const htmlContent = this.createCPEEStyleVisualizationHTML(cpeeXml, stepNumber);
            return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        }
    }
    
    /**
     * Create CPEE-style HTML content for XML visualization
     * Mimics the official CPEE graph viewer styling and layout
     * @param {string} cpeeXml - CPEE XML content
     * @param {number} stepNumber - Step number
     * @param {string} processNumber - Process number (optional)
     * @returns {string} HTML content
     */
    static createCPEEStyleVisualizationHTML(cpeeXml, stepNumber, processNumber = null) {
        // Parse CPEE XML to extract tasks and structure
        const processStructure = this.parseCPEEXMLStructure(cpeeXml);
        const svgDiagram = this.generateCPEEStyleSVG(processStructure, stepNumber);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>CPEE Graph - Evolution Step ${stepNumber}</title>
    <style>
        /* CPEE Graph Viewer Styles - Based on cpee.org styling */
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: #f0f0f0;
            overflow: hidden;
        }
        
        .cpee-header {
            background: #2c3e50;
            color: white;
            padding: 10px 15px;
            font-size: 14px;
            border-bottom: 1px solid #34495e;
        }
        
        .cpee-header .title {
            font-weight: bold;
            display: inline-block;
        }
        
        .cpee-header .info {
            float: right;
            opacity: 0.8;
        }
        
        .cpee-graph-container {
            width: 100%;
            height: calc(100vh - 45px);
            background: white;
            position: relative;
            overflow: auto;
        }
        
        .cpee-svg-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        }
        
        /* CPEE Node Styles */
        .cpee-node {
            cursor: pointer;
        }
        
        .cpee-node rect {
            stroke-width: 1;
            fill: #e8e8e8;
            stroke: #c0c0c0;
        }
        
        .cpee-node.start rect {
            fill: #5cb85c;
            stroke: #4cae4c;
        }
        
        .cpee-node.end rect {
            fill: #d9534f;
            stroke: #d43f3a;
        }
        
        .cpee-node.task rect {
            fill: #f0ad4e;
            stroke: #ec971f;
        }
        
        .cpee-node text {
            font-family: Arial, sans-serif;
            font-size: 11px;
            fill: #333;
            text-anchor: middle;
            pointer-events: none;
        }
        
        .cpee-edge {
            fill: none;
            stroke: #666;
            stroke-width: 1.5;
            marker-end: url(#arrowhead);
        }
        
        .cpee-edge:hover {
            stroke: #2c3e50;
            stroke-width: 2;
        }
        
        /* Evolution indicator */
        .evolution-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #3498db;
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            z-index: 100;
        }
    </style>
</head>
<body>
    <div class="cpee-header">
        <span class="title">CPEE Process Graph</span>
        <span class="info">Evolution Step ${stepNumber}${processNumber ? ` | Process ${processNumber}` : ''}</span>
    </div>
    
    <div class="cpee-graph-container">
        <div class="evolution-badge">Step ${stepNumber}</div>
        <div class="cpee-svg-container">
            ${svgDiagram}
        </div>
    </div>
</body>
</html>`;
    }
    
    /**
     * Extract tasks from CPEE XML
     * @param {string} xml - CPEE XML content  
     * @returns {Array} Array of task objects
     */
    static extractTasksFromXML(xml) {
        if (!xml) return [];
        
        const tasks = [];
        
        try {
            // Simple regex-based parsing for labels
            const labelMatches = xml.match(/<label>([^<]+)<\/label>/g);
            if (labelMatches) {
                labelMatches.forEach(match => {
                    const label = match.replace(/<\/?label>/g, '');
                    if (label && label.trim()) {
                        tasks.push({
                            type: 'task',
                            label: label.trim()
                        });
                    }
                });
            }
        } catch (error) {
            console.warn('Error parsing CPEE XML:', error);
        }
        
        return tasks;
    }
    
    /**
     * Parse CPEE XML to extract process structure
     * @param {string} xml - CPEE XML content
     * @returns {Object} Process structure with nodes and edges
     */
    static parseCPEEXMLStructure(xml) {
        if (!xml) return { nodes: [], edges: [] };
        
        const structure = {
            nodes: [
                { id: 'start', type: 'start', label: 'Start', x: 50, y: 100 }
            ],
            edges: []
        };
        
        // Extract tasks from XML
        const tasks = this.extractTasksFromXML(xml);
        let currentX = 150;
        
        // Add task nodes
        tasks.forEach((task, index) => {
            const nodeId = `task_${index}`;
            structure.nodes.push({
                id: nodeId,
                type: 'task', 
                label: task.label,
                x: currentX,
                y: 100
            });
            currentX += 120;
        });
        
        // Add end node
        structure.nodes.push({
            id: 'end',
            type: 'end',
            label: 'End',
            x: currentX,
            y: 100
        });
        
        // Create edges (start -> tasks -> end)
        for (let i = 0; i < structure.nodes.length - 1; i++) {
            structure.edges.push({
                from: structure.nodes[i].id,
                to: structure.nodes[i + 1].id
            });
        }
        
        return structure;
    }
    
    /**
     * Generate CPEE-style SVG diagram
     * @param {Object} structure - Process structure
     * @param {number} stepNumber - Step number
     * @returns {string} SVG content
     */
    static generateCPEEStyleSVG(structure, stepNumber) {
        if (!structure.nodes.length) return '<p>No process structure found</p>';
        
        // Calculate SVG dimensions
        const maxX = Math.max(...structure.nodes.map(n => n.x)) + 100;
        const maxY = Math.max(...structure.nodes.map(n => n.y)) + 50;
        
        let svg = `
<svg width="${maxX}" height="200" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
        </marker>
    </defs>
`;

        // Draw edges first (so they appear behind nodes)
        structure.edges.forEach(edge => {
            const fromNode = structure.nodes.find(n => n.id === edge.from);
            const toNode = structure.nodes.find(n => n.id === edge.to);
            
            if (fromNode && toNode) {
                const fromX = fromNode.x + (fromNode.type === 'start' ? 40 : 60);
                const toX = toNode.x;
                const y = fromNode.y + 20;
                
                svg += `<line x1="${fromX}" y1="${y}" x2="${toX}" y2="${y}" class="cpee-edge" />`;
            }
        });
        
        // Draw nodes
        structure.nodes.forEach(node => {
            const width = node.type === 'start' || node.type === 'end' ? 40 : 120;
            const height = 40;
            
            svg += `
    <g class="cpee-node ${node.type}">
        <rect x="${node.x}" y="${node.y}" width="${width}" height="${height}" rx="3" />
        <text x="${node.x + width/2}" y="${node.y + height/2 + 4}">${node.label}</text>
    </g>`;
        });
        
        svg += '</svg>';
        return svg;
    }
    
    /**
     * Escape HTML content
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Get step count and navigation info
     * @param {Array} progressiveStates - Progressive states array
     * @param {number} currentIndex - Current step index
     * @returns {Object} Navigation information
     */
    static getNavigationInfo(progressiveStates, currentIndex) {
        return {
            totalSteps: progressiveStates.length,
            currentStep: currentIndex + 1,
            canGoPrevious: currentIndex > 0,
            canGoNext: currentIndex < progressiveStates.length - 1,
            hasSteps: progressiveStates.length > 0
        };
    }
}
