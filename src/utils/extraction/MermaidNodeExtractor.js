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
            
            // Filter to keep tasks (including :script:, :subprocess:) and gateways
            const tasksAndGateways = nodes.filter(node => 
                node.type === 'task' || node.type === 'script' || node.type === 'subprocess' || node.type === 'gateway'
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
     * Extract nodes from a single line of Mermaid syntax
     * @param {string} line - Line of Mermaid code
     * @param {number} basePosition - Base position for this line's nodes
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects
     */
    static extractNodesFromLine(line, basePosition) {
        const nodes = [];
        
        const patterns = [
            { regex: /(\w+):task:\(([^)]+)\)/g, shape: 'rectangle', type: 'task' },
            { regex: /(\w+):script:\(([^)]+)\)/g, shape: 'rectangle', type: 'script' },
            { regex: /(\w+):subprocess:\(([^)]+)\)/g, shape: 'rectangle', type: 'subprocess' },
            { regex: /(\w+):\w+:\(\(([^)]+)\)\)/g, shape: 'circle', type: 'event' },
            { regex: /(\w+):exclusivegateway:\{([^}]+)\}/g, shape: 'diamond', type: 'gateway' },
            { regex: /(\w+):parallelgateway:\{([^}]+)\}/g, shape: 'diamond', type: 'gateway' },
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

    // ==================== Gateway Utility Methods ====================
    
    /**
     * Extract base task or gateway ID from Mermaid SVG ID format
     * Handles formats like:
     * - "flowchart-a1:task:-5" → "a1"
     * - "flowchart-gw1s:exclusivegateway:-5" → "gw1s"
     * - "gw1s:exclusivegateway:" → "gw1s"
     * @param {string} svgId - Full Mermaid SVG ID
     * @returns {string} Base ID (returns original if no pattern matched)
     */
    static extractBaseId(svgId) {
        if (!svgId) {
            return svgId;
        }
        
        // Already base if no typed fragments
        if (!/:(task|script|subprocess|exclusivegateway|parallelgateway):/.test(svgId)) {
            return svgId;
        }

        const tryMatch = (reArr) => {
            for (const re of reArr) {
                const m = svgId.match(re);
                if (m && m[1]) {
                    return m[1];
                }
            }
            return null;
        };
        
        // Include underscores, hyphens in middle, and alphanumeric characters for IDs like "task_c", "a3", etc.
        const idPattern = '([a-z0-9_][a-z0-9_-]*)';
        const patterns = [
            new RegExp(`-${idPattern}:task:`, 'i'), new RegExp(`^${idPattern}:task:`, 'i'),
            new RegExp(`-${idPattern}:script:`, 'i'), new RegExp(`^${idPattern}:script:`, 'i'),
            new RegExp(`-${idPattern}:subprocess:`, 'i'), new RegExp(`^${idPattern}:subprocess:`, 'i'),
            new RegExp(`-${idPattern}:exclusivegateway:`, 'i'), new RegExp(`^${idPattern}:exclusivegateway:`, 'i'),
            new RegExp(`-${idPattern}:parallelgateway:`, 'i'), new RegExp(`^${idPattern}:parallelgateway:`, 'i'),
            new RegExp(`flowchart-${idPattern}(?:-task-|:task:|-)`, 'i'),
            new RegExp(`flowchart-${idPattern}(?:-script-|:script:|-)`, 'i'),
            new RegExp(`flowchart-${idPattern}(?:-subprocess-|:subprocess:|-)`, 'i'),
            new RegExp(`flowchart-${idPattern}(?:-exclusivegateway-|:exclusivegateway:|-)`, 'i'),
            new RegExp(`flowchart-${idPattern}(?:-parallelgateway-|:parallelgateway:|-)`, 'i')
        ];
        
        return tryMatch(patterns) || svgId;
    }
    
    /**
     * Check if a Mermaid ID represents a gateway
     * Recognizes:
     * - gw\d+ pattern (e.g., "gw1s", "gw2e")
     * - Full SVG IDs containing :exclusivegateway: or :parallelgateway:
     * - Numeric IDs that came from gateway nodes (when full ID is provided)
     * @param {string} id - Mermaid node ID (base or full SVG ID)
     * @returns {boolean} True if it's a gateway ID
     */
    static isGatewayId(id) {
        if (!id) {
            return false;
        }
        
        // Check if full ID contains gateway type markers
        // This catches cases like "flowchart-e1s:exclusivegateway:-107" where base ID is "e1s"
        if (/:exclusivegateway:|:parallelgateway:/.test(id)) {
            return true;
        }
        
        const baseId = this.extractBaseId(id);
        // Classic gw\d+ convention
        if (/^gw\d+/i.test(baseId)) {
            return true;
        }
        // Permissive: any alphanumeric ID of length ≥ 3 ending in 's' or 'e'
        // (length ≥ 3 avoids false positives for 2-char event IDs like "se", "ee")
        if (/^\w{2,}[se]$/i.test(baseId)) {
            return true;
        }
        return false;
    }
    
    /**
     * Check if a Mermaid gateway ID is a START gateway (ends with 's')
     * For gw\d+s pattern, returns true only if it ends with 's'
     * For non-gw patterns (like numeric IDs "3", "6"), returns true as a fallback
     * since we cannot distinguish start/end from the ID alone
     * @param {string} id - Gateway ID (base or full SVG ID)
     * @returns {boolean} True if it's a start gateway or undetermined
     */
    static isStartGateway(id) {
        if (!id) {
            return false;
        }
        const baseId = this.extractBaseId(id);
        
        // Any gateway ID ending with 's' is a start gateway
        if (/s$/i.test(baseId)) {
            return true;
        }
        
        // For IDs with no s/e suffix (e.g. numeric "3", "6"), we cannot determine
        // start vs end from the ID alone — treat as potential start gateway.
        if (this.isGatewayId(id)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if a Mermaid gateway ID is an END gateway (ends with 'e')
     * Only works reliably for gw\d+e pattern
     * For non-gw patterns, returns false (we cannot determine)
     * @param {string} id - Gateway ID (base or full SVG ID)
     * @returns {boolean} True if it's definitely an end gateway
     */
    static isEndGateway(id) {
        if (!id) {
            return false;
        }
        const baseId = this.extractBaseId(id);
        // Any gateway ID ending with 'e' is an end gateway
        return /e$/i.test(baseId);
    }
    
    /**
     * Check if a gateway ID uses the paired start/end naming convention (any prefix ending in 's' or 'e').
     * Covers the classic gw\d+[se] format and any newer prefix like e1s/e1e, p1s/p1e, etc.
     * @param {string} id - Gateway ID
     * @returns {boolean} True if the ID ends with 's' or 'e', indicating a paired gateway
     */
    static usesGwNamingConvention(id) {
        if (!id) {
            return false;
        }
        const baseId = this.extractBaseId(id);
        return /[se]$/i.test(baseId);
    }
    
    /**
     * Get the paired gateway ID (start ↔ end)
     * @param {string} gatewayId - Gateway ID (base or full SVG ID)
     * @returns {string|null} Paired gateway base ID, or null if not a gateway
     */
    static getPairedGatewayId(gatewayId) {
        if (!gatewayId) {
            return null;
        }
        
        // Extract base ID from full Mermaid SVG ID (any gateway type, any prefix)
        let baseId = gatewayId;
        const baseIdMatch = gatewayId.match(/flowchart-(\w+):(?:exclusivegateway|parallelgateway|inclusivegateway):/i) ||
                           gatewayId.match(/^(\w+):(?:exclusivegateway|parallelgateway|inclusivegateway):/i);
        if (baseIdMatch) {
            baseId = baseIdMatch[1];
        } else {
            baseId = this.extractBaseId(gatewayId);
        }
        
        // Swap s ↔ e (supports any prefix: gw1s↔gw1e, e1s↔e1e, p1s↔p1e, etc.)
        if (/s$/i.test(baseId)) {
            return baseId.replace(/s$/i, 'e');
        } else if (/e$/i.test(baseId)) {
            return baseId.replace(/e$/i, 's');
        }
        
        return null;
    }
    
    /**
     * Get the gateway number from a gateway ID (e.g., "gw1s" → 1, "gw2e" → 2)
     * @param {string} gatewayId - Gateway ID
     * @returns {number|null} Gateway number or null
     */
    static getGatewayNumber(gatewayId) {
        if (!gatewayId) {
            return null;
        }
        const baseId = this.extractBaseId(gatewayId);
        const match = baseId.match(/^gw(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    }
}

