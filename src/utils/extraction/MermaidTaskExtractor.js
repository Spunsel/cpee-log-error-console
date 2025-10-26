/**
 * Mermaid Task Extractor
 * Extracts node/task information from Mermaid flowchart syntax
 */

import { TaskIdentifier } from '../../models/TaskIdentifier.js';

export class MermaidTaskExtractor {
    
    /**
     * Extract tasks from Mermaid flowchart syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects
     */
    static extractTasksFromMermaid(mermaidSyntax) {
        console.log('[MermaidTaskExtractor] Starting task extraction from Mermaid syntax...');
        
        try {
            const tasks = [];
            const lines = mermaidSyntax.split('\n');
            let position = 0;
            
            // Process each line
            lines.forEach((line, lineIndex) => {
                const trimmedLine = line.trim();
                
                // Skip empty lines, comments, and flowchart declaration
                if (!trimmedLine || 
                    trimmedLine.startsWith('%%') || 
                    trimmedLine.startsWith('flowchart') ||
                    trimmedLine.startsWith('graph')) {
                    return;
                }
                
                console.log(`[MermaidTaskExtractor] Processing line ${lineIndex + 1}: "${trimmedLine}"`);
                
                // Try to extract node information
                const nodes = this.extractNodesFromLine(trimmedLine, position);
                
                if (nodes.length > 0) {
                    nodes.forEach(node => {
                        tasks.push(node);
                        console.log(`[MermaidTaskExtractor] Extracted node: ${node.toString()}`);
                    });
                    position += nodes.length;
                }
            });
            
            console.log(`[MermaidTaskExtractor] Successfully extracted ${tasks.length} nodes`);
            return tasks;
            
        } catch (error) {
            console.error('[MermaidTaskExtractor] Error extracting tasks:', error);
            return [];
        }
    }
    
    /**
     * Extract nodes from a single line of Mermaid syntax
     * @param {string} line - Line of Mermaid code
     * @param {number} basePosition - Base position for this line's nodes
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects
     */
    static extractNodesFromLine(line, basePosition) {
        const nodes = [];
        
        // Node patterns for different shapes
        const patterns = [
            // Rectangle: A[Label]
            { regex: /(\w+)\[([^\]]+)\]/g, shape: 'rectangle', type: 'task' },
            // Rounded: A([Label])
            { regex: /(\w+)\(\[([^\]]+)\]\)/g, shape: 'rounded', type: 'event' },
            // Diamond: A{Label}
            { regex: /(\w+)\{([^}]+)\}/g, shape: 'diamond', type: 'decision' },
            // Circle: A((Label))
            { regex: /(\w+)\(\(([^)]+)\)\)/g, shape: 'circle', type: 'event' },
            // Hexagon: A{{Label}}
            { regex: /(\w+)\{\{([^}]+)\}\}/g, shape: 'hexagon', type: 'task' },
            // Parallelogram: A[/Label/]
            { regex: /(\w+)\[\/([^/]+)\/\]/g, shape: 'parallelogram', type: 'input' },
            // Trapezoid: A[\\Label\\]
            { regex: /(\w+)\[\\([^\\]+)\\\]/g, shape: 'trapezoid', type: 'output' }
        ];
        
        let localPosition = 0;
        
        // Try each pattern
        patterns.forEach(({ regex, shape, type }) => {
            const matches = [...line.matchAll(regex)];
            
            matches.forEach(match => {
                const id = match[1];
                const label = match[2].trim();
                
                const task = new TaskIdentifier(
                    id,
                    label,
                    type,
                    'mermaid',
                    { shape },
                    basePosition + localPosition
                );
                
                // Explicitly set position to ensure it's not null
                task.position = basePosition + localPosition;
                
                nodes.push(task);
                localPosition++;
            });
        });
        
        return nodes;
    }
    
    /**
     * Map Mermaid shape to generic task type
     * @param {string} shape - Mermaid shape name
     * @returns {string} Generic task type
     */
    static mapShapeToType(shape) {
        const shapeTypeMap = {
            'rectangle': 'task',
            'rounded': 'event',
            'diamond': 'decision',
            'circle': 'event',
            'hexagon': 'task',
            'parallelogram': 'input',
            'trapezoid': 'output',
            'stadium': 'event'
        };
        
        return shapeTypeMap[shape] || 'task';
    }
    
    /**
     * Extract connection information from Mermaid syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {Object[]} Array of connection objects
     */
    static extractConnections(mermaidSyntax) {
        console.log('[MermaidTaskExtractor] Extracting connections from Mermaid syntax...');
        
        const connections = [];
        const lines = mermaidSyntax.split('\n');
        
        // Connection patterns
        const connectionPatterns = [
            // A --> B
            { regex: /(\w+)\s*-->\s*(\w+)/, type: 'arrow' },
            // A --- B
            { regex: /(\w+)\s*---\s*(\w+)/, type: 'line' },
            // A -.-> B
            { regex: /(\w+)\s*\.->\s*(\w+)/, type: 'dotted' },
            // A ==> B
            { regex: /(\w+)\s*==>\s*(\w+)/, type: 'thick' }
        ];
        
        lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('%%')) {
                return;
            }
            
            // Try each connection pattern
            connectionPatterns.forEach(({ regex, type }) => {
                const match = trimmedLine.match(regex);
                
                if (match) {
                    connections.push({
                        from: match[1],
                        to: match[2],
                        type: type,
                        line: lineIndex + 1
                    });
                    console.log(`[MermaidTaskExtractor] Found connection: ${match[1]} -> ${match[2]}`);
                }
            });
        });
        
        console.log(`[MermaidTaskExtractor] Extracted ${connections.length} connections`);
        return connections;
    }
    
    /**
     * Extract both nodes and connections from Mermaid syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {Object} Object with nodes and connections arrays
     */
    static extractNodesAndConnections(mermaidSyntax) {
        return {
            nodes: this.extractTasksFromMermaid(mermaidSyntax),
            connections: this.extractConnections(mermaidSyntax)
        };
    }
}

