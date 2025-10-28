/**
 * Mermaid Task Extractor
 * Extracts tasks from Mermaid flowchart syntax
 */

import { TaskIdentifier } from '../../models/TaskIdentifier.js';

export class MermaidTaskExtractor {
    /**
     * Extract tasks from Mermaid flowchart syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects (only tasks, no gateways/events)
     */
    static extract(mermaidSyntax) {
        console.log('[MermaidTaskExtractor] Starting task extraction from Mermaid syntax...');
        
        try {
            const nodes = [];
            const lines = mermaidSyntax.split('\n');
            let position = 0;
            
            lines.forEach((line, lineIndex) => {
                const trimmedLine = line.trim();
                
                if (!trimmedLine || 
                    trimmedLine.startsWith('%%') || 
                    trimmedLine.startsWith('flowchart') ||
                    trimmedLine.startsWith('graph')) {
                    return;
                }
                
                const extractedNodes = this.extractNodesFromLine(trimmedLine, position);
                
                extractedNodes.forEach(node => {
                    nodes.push(node);
                });
                
                position += extractedNodes.length;
            });
            
            // Filter to keep only tasks
            const tasks = nodes.filter(node => node.type === 'task');
            const excluded = nodes.filter(node => node.type !== 'task');
            
            console.log(`[MermaidTaskExtractor] Extracted ${nodes.length} total nodes`);
            console.log(`[MermaidTaskExtractor] Filtered to ${tasks.length} tasks (excluded ${excluded.length} non-task nodes)`);
            
            if (excluded.length > 0) {
                console.log(`[MermaidTaskExtractor] Excluded nodes:`, excluded.map(n => `${n.id}:${n.type}`));
            }
            
            tasks.forEach(task => {
                console.log(`[MermaidTaskExtractor] Extracted task: ${task.toString()}`);
            });
            
            return tasks;
            
        } catch (error) {
            console.error('[MermaidTaskExtractor] Error extracting tasks:', error);
            return [];
        }
    }

    /**
     * Extract connections from Mermaid syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {Object[]} Array of connection objects
     */
    static extractConnections(mermaidSyntax) {
        console.log('[MermaidTaskExtractor] Extracting connections from Mermaid syntax...');
        
        const connections = [];
        const lines = mermaidSyntax.split('\n');
        
        const connectionPatterns = [
            { regex: /(\w+)\s*-->\s*(\w+)/, type: 'arrow' },
            { regex: /(\w+)\s*---\s*(\w+)/, type: 'line' },
            { regex: /(\w+)\s*\.->\s*(\w+)/, type: 'dotted' },
            { regex: /(\w+)\s*==>\s*(\w+)/, type: 'thick' }
        ];
        
        lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine.startsWith('%%')) {
                return;
            }
            
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
            nodes: this.extract(mermaidSyntax),
            connections: this.extractConnections(mermaidSyntax)
        };
    }

    /**
     * Extract nodes from a single line of Mermaid syntax
     * @param {string} line - Line of Mermaid code
     * @param {number} basePosition - Base position for this line's nodes
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects
     */
    static extractNodesFromLine(line, basePosition) {
        const nodes = [];
        
        const patterns = [
            { regex: /(\w+):task:\(([^)]+)\)/g, shape: 'rectangle', type: 'task' },
            { regex: /(\w+):\w+:\(\(([^)]+)\)\)/g, shape: 'circle', type: 'event' },
            { regex: /(\w+):exclusivegateway:\{([^}]+)\}/g, shape: 'diamond', type: 'gateway' },
            { regex: /(\w+)\[([^\]]+)\]/g, shape: 'rectangle', type: 'task' },
            { regex: /(\w+)\(\[([^\]]+)\]\)/g, shape: 'rounded', type: 'event' },
            { regex: /(\w+)\{([^}]+)\}/g, shape: 'diamond', type: 'decision' },
            { regex: /(\w+)\(\(([^)]+)\)\)/g, shape: 'circle', type: 'event' },
            { regex: /(\w+)\{\{([^}]+)\}\}/g, shape: 'hexagon', type: 'task' },
            { regex: /(\w+)\[\/([^/]+)\/\]/g, shape: 'parallelogram', type: 'input' },
            { regex: /(\w+)\[\\([^\\]+)\\\]/g, shape: 'trapezoid', type: 'output' }
        ];
        
        let localPosition = 0;
        
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
}

