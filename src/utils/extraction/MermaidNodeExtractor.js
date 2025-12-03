/**
 * Mermaid Node Extractor
 * Extracts tasks, gateways, and events from Mermaid flowchart syntax
 */

import { NodeIdentifier } from '../../models/NodeIdentifier.js';

export class MermaidNodeExtractor {
    /**
     * Extract tasks and gateways from Mermaid flowchart syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects (tasks and gateways)
     */
    static extract(mermaidSyntax) {
        try {
            const nodes = [];
            const lines = mermaidSyntax.split('\n');
            let position = 0;
            
            lines.forEach((line, _lineIndex) => {
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
            
            // Filter to keep tasks and gateways
            const tasksAndGateways = nodes.filter(node => 
                node.type === 'task' || node.type === 'gateway'
            );            
            return tasksAndGateways;
            
        } catch (error) {
            console.error('[MermaidNodeExtractor] Error extracting tasks:', error);
            return [];
        }
    }

    /**
     * Extract connections from Mermaid syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {Object[]} Array of connection objects
     */
    static extractConnections(mermaidSyntax) {        
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
                }
            });
        });
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
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects
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
                
                const task = new NodeIdentifier(
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
    
    // ============ Gateway Utility Methods ============
    
    /**
     * Check if a task/node is a gateway
     * @param {Object} task - Task object with id and type
     * @returns {boolean} True if gateway
     */
    static isGateway(task) {
        if (!task) {
            return false;
        }
        return task.type === 'gateway' || 
               task.type === 'decision' ||
               (task.id && task.id.match(/^gw\d+[se]?$/i));
    }
    
    /**
     * Check if a gateway ID is a START gateway (ends with 's')
     * @param {string} gatewayId - Gateway ID
     * @returns {boolean} True if start gateway
     */
    static isStartGateway(gatewayId) {
        return gatewayId && gatewayId.match(/^gw\d+s$/i);
    }
    
    /**
     * Check if a gateway ID is an END gateway (ends with 'e')
     * @param {string} gatewayId - Gateway ID
     * @returns {boolean} True if end gateway
     */
    static isEndGateway(gatewayId) {
        return gatewayId && gatewayId.match(/^gw\d+e$/i);
    }
    
    /**
     * Get the paired gateway ID (start ↔ end)
     * @param {string} gatewayId - Gateway ID (can be full Mermaid SVG ID or base ID)
     * @returns {string|null} Paired gateway ID or null
     */
    static getPairedGatewayId(gatewayId) {
        // Extract base ID from full Mermaid SVG ID if needed
        let baseId = gatewayId;
        const baseIdMatch = gatewayId.match(/flowchart-(gw\d+[se]):(?:exclusivegateway|parallelgateway):/i) ||
                           gatewayId.match(/^(gw\d+[se])$/i);
        if (baseIdMatch) {
            baseId = baseIdMatch[1];
        }
        
        // Swap s ↔ e
        if (baseId.match(/s$/i)) {
            return baseId.replace(/s$/i, 'e');
        } else if (baseId.match(/e$/i)) {
            return baseId.replace(/e$/i, 's');
        }
        
        return null;
    }
    
    /**
     * Convert END gateway ID to START gateway ID
     * @param {string} gatewayId - Gateway ID
     * @returns {string} Start gateway ID (or original if not an end gateway)
     */
    static toStartGatewayId(gatewayId) {
        if (this.isEndGateway(gatewayId)) {
            return gatewayId.replace(/e$/i, 's');
        }
        return gatewayId;
    }
    
    /**
     * Extract base gateway ID from full Mermaid SVG ID
     * @param {string} fullId - Full SVG ID (e.g., "flowchart-gw1s:exclusivegateway:-5")
     * @returns {string} Base ID (e.g., "gw1s")
     */
    static extractBaseGatewayId(fullId) {
        const match = fullId.match(/flowchart-(gw\d+[se]?):(?:exclusivegateway|parallelgateway):/i);
        if (match) {
            return match[1];
        }
        // Already a base ID
        if (fullId.match(/^gw\d+[se]?$/i)) {
            return fullId;
        }
        return fullId;
    }
}

