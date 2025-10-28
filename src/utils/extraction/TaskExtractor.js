/**
 * Task Extractor
 * Unified task extraction from CPEE XML and Mermaid flowchart syntax
 * 
 * Consolidates CPEETaskExtractor and MermaidTaskExtractor functionality
 */

import { TaskIdentifier } from '../../models/TaskIdentifier.js';

export class TaskExtractor {
    
    // ============================================
    // CPEE XML EXTRACTION METHODS
    // ============================================

    /**
     * Extract tasks from CPEE XML
     * @param {string} xmlString - CPEE XML content
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects
     */
    static extractFromCPEE(xmlString) {
        console.log('[TaskExtractor] Starting task extraction from CPEE XML...');
        
        try {
            // Fix common XML issues: unescaped < in attribute values
            // Pattern: attribute="...<..."  should be "...&lt;..."
            let fixedXml = xmlString;
            
            // Escape unescaped < and > in attribute values
            fixedXml = fixedXml.replace(/=("([^"]*)<\s*([^"]*))"/g, (match, p1, p2, p3) => {
                return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            });
            
            // Also handle single-quoted attributes
            fixedXml = fixedXml.replace(/=('([^']*)<\s*([^']*))'/g, (match, p1, p2, p3) => {
                return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            });
            
            // Try to fix common cases like condition="count < 10"
            fixedXml = fixedXml.replace(/condition="([^"]*)\s*<\s*([^"]*)"/g, 'condition="$1 &lt; $2"');
            fixedXml = fixedXml.replace(/condition="([^"]*)\s*>\s*([^"]*)"/g, 'condition="$1 &gt; $2"');
            fixedXml = fixedXml.replace(/condition="([^"]*)\s*<=\s*([^"]*)"/g, 'condition="$1 &lt;= $2"');
            fixedXml = fixedXml.replace(/condition="([^"]*)\s*>=\s*([^"]*)"/g, 'condition="$1 &gt;= $2"');
            
            // Parse XML with fixed content
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fixedXml, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                // Log parsing errors for debugging
                console.warn('[TaskExtractor] XML parsing error:', parserError.textContent);
                console.warn('[TaskExtractor] Input XML (first 500 chars):', xmlString.substring(0, 500));
                return [];
            }
            
            console.log('[TaskExtractor] XML parsed successfully');
            
            // Debug: Log XML structure for diagnosis
            const hasComplexStructure = xmlDoc.querySelector('loop, gateway, choose') !== null;
            const rootElement = xmlDoc.documentElement;
            const rootTagName = rootElement ? rootElement.tagName : 'unknown';
            const rootNamespace = rootElement ? rootElement.namespaceURI : 'unknown';
            console.log(`[TaskExtractor] Root element: ${rootTagName} (ns: ${rootNamespace})`);
            console.log(`[TaskExtractor] Has loops/gateways: ${hasComplexStructure}`);
            
            // Find all task elements (call, manipulate, script, etc.)
            const taskElements = this.findCPEETaskElements(xmlDoc);
            console.log(`[TaskExtractor] Found ${taskElements.length} task elements`);
            
            // Debug: log XML structure for complex structures with no tasks
            if (taskElements.length === 0 && hasComplexStructure) {
                console.warn('[TaskExtractor] Found loops/gateways but no task elements');
                console.warn('[TaskExtractor] XML structure (first 1500 chars):', xmlString.substring(0, 1500));
                
                // Try to find elements with explicit namespace
                const namespacedCalls = xmlDoc.querySelectorAll('call');
                console.warn(`[TaskExtractor] Found ${namespacedCalls.length} <call> elements (any namespace)`);
            }
            
            // Extract TaskIdentifier for each element
            const tasks = [];
            taskElements.forEach((element, index) => {
                const task = this.extractCPEETaskFromElement(element, index);
                if (task && task.isValid()) {
                    tasks.push(task);
                    console.log(`[TaskExtractor] Extracted task: ${task.toString()}`);
                } else {
                    console.warn(`[TaskExtractor] Invalid task at position ${index}:`, task);
                }
            });
            
            console.log(`[TaskExtractor] Successfully extracted ${tasks.length} tasks`);
            return tasks;
            
        } catch (error) {
            console.error('[TaskExtractor] Error extracting tasks:', error);
            return [];
        }
    }
    
    /**
     * Find all task elements in XML document, including nested ones
     * @param {Document} xmlDoc - Parsed XML document
     * @returns {Element[]} Array of task elements
     */
    static findCPEETaskElements(xmlDoc) {
        const taskTypes = ['call', 'manipulate', 'script'];
        const elements = [];
        
        taskTypes.forEach(type => {
            // Use querySelectorAll to find ALL elements of this type, including nested ones
            // This will find tasks inside loops, gateways, etc.
            const found = xmlDoc.querySelectorAll(type);
            found.forEach(element => elements.push(element));
        });
        
        // Debug logging for complex structures
        if (elements.length > 0) {
            const firstFew = elements.slice(0, 5);
            console.log(`[TaskExtractor] First few task IDs:`, firstFew.map(el => el.getAttribute('id')));
        }
        
        return elements;
    }
    
    /**
     * Extract TaskIdentifier from a single XML element
     * @param {Element} element - XML element
     * @param {number} position - Position in workflow
     * @returns {TaskIdentifier|null} TaskIdentifier or null if extraction fails
     */
    static extractCPEETaskFromElement(element, position) {
        try {
            // Extract ID
            const id = element.getAttribute('id') || `task-${position}`;
            
            // Extract label (from various possible locations)
            let label = this.extractCPEELabel(element);
            
            // Use ID as fallback label
            if (!label) {
                label = id;
            }
            
            // Extract type (element tag name)
            const type = element.tagName.toLowerCase();
            
            // Extract additional metadata
            const metadata = this.extractCPEEMetadata(element, type);
            
            // Create TaskIdentifier
            const task = new TaskIdentifier(id, label, type, 'cpee', metadata, position);
            
            // Explicitly set position to ensure it's not null
            task.position = position;
            
            return task;
            
        } catch (error) {
            console.error('[TaskExtractor] Error extracting task from element:', error);
            return null;
        }
    }
    
    /**
     * Extract label from various possible locations in element
     * @param {Element} element - XML element
     * @returns {string|null} Label or null
     */
    static extractCPEELabel(element) {
        // Try label attribute
        let label = element.getAttribute('label');
        if (label) {
            return label;
        }
        
        // Try parameters > label element
        const parametersLabel = element.querySelector('parameters > label');
        if (parametersLabel) {
            label = parametersLabel.textContent.trim();
            // Remove quotes if present
            label = label.replace(/^["']|["']$/g, '');
            if (label) {
                return label;
            }
        }
        
        // Try description element
        const description = element.querySelector('description');
        if (description) {
            label = description.textContent.trim();
            if (label) {
                return label;
            }
        }
        
        // Try annotations > description
        const annotationDesc = element.querySelector('annotations > description');
        if (annotationDesc) {
            label = annotationDesc.textContent.trim();
            if (label) {
                return label;
            }
        }
        
        return null;
    }
    
    /**
     * Extract metadata from element based on type
     * @param {Element} element - XML element
     * @param {string} type - Task type
     * @returns {Object} Metadata object
     */
    static extractCPEEMetadata(element, type) {
        const metadata = {
            tagName: element.tagName
        };
        
        // For 'call' elements, extract endpoint and method
        if (type === 'call') {
            const endpoint = element.getAttribute('endpoint');
            if (endpoint) {
                metadata.endpoint = endpoint;
            }
            
            const method = element.querySelector('method');
            if (method) {
                metadata.method = method.textContent.trim();
            }
            
            // Extract arguments
            const args = element.querySelector('arguments');
            if (args) {
                const argCount = args.children.length;
                metadata.argumentCount = argCount;
            }
        }
        
        // For 'manipulate' elements, extract output
        if (type === 'manipulate') {
            const output = element.querySelector('output');
            if (output) {
                metadata.output = output.textContent.trim();
            }
        }
        
        // For 'script' elements, extract code type
        if (type === 'script') {
            const codeType = element.getAttribute('type');
            if (codeType) {
                metadata.codeType = codeType;
            }
        }
        
        // Extract all attributes
        Array.from(element.attributes).forEach(attr => {
            if (attr.name !== 'id' && attr.name !== 'label') {
                metadata[attr.name] = attr.value;
            }
        });
        
        return metadata;
    }

    // ============================================
    // MERMAID EXTRACTION METHODS
    // ============================================

    /**
     * Extract tasks from Mermaid flowchart syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects (only tasks, no gateways/events)
     */
    static extractFromMermaid(mermaidSyntax) {
        console.log('[TaskExtractor] Starting task extraction from Mermaid syntax...');
        
        try {
            const nodes = [];
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
                
                console.log(`[TaskExtractor] Processing line ${lineIndex + 1}: "${trimmedLine}"`);
                
                // Try to extract node information
                const extractedNodes = this.extractMermaidNodesFromLine(trimmedLine, position);
                
                if (extractedNodes.length > 0) {
                    extractedNodes.forEach(node => {
                        nodes.push(node);
                    });
                    position += extractedNodes.length;
                }
            });
            
            // Filter to keep only tasks (exclude gateways, events, etc.)
            const tasks = nodes.filter(node => node.type === 'task');
            const excluded = nodes.filter(node => node.type !== 'task');
            
            console.log(`[TaskExtractor] Extracted ${nodes.length} total nodes`);
            console.log(`[TaskExtractor] Filtered to ${tasks.length} tasks (excluded ${excluded.length} non-task nodes)`);
            
            if (excluded.length > 0) {
                console.log(`[TaskExtractor] Excluded nodes:`, excluded.map(n => `${n.id}:${n.type}`));
            }
            
            tasks.forEach(task => {
                console.log(`[TaskExtractor] Extracted task: ${task.toString()}`);
            });
            
            return tasks;
            
        } catch (error) {
            console.error('[TaskExtractor] Error extracting tasks:', error);
            return [];
        }
    }
    
    /**
     * Extract nodes from a single line of Mermaid syntax
     * @param {string} line - Line of Mermaid code
     * @param {number} basePosition - Base position for this line's nodes
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects
     */
    static extractMermaidNodesFromLine(line, basePosition) {
        const nodes = [];
        
        // Node patterns for different shapes
        const patterns = [
            // Edge-style notation: id:type:(Label) - e.g., a2:task:(Task X)
            { regex: /(\w+):task:\(([^)]+)\)/g, shape: 'rectangle', type: 'task' },
            // Edge-style with special shapes: id:type:shape(Label) - e.g., se:startevent:((startevent))
            { regex: /(\w+):\w+:\(\(([^)]+)\)\)/g, shape: 'circle', type: 'event' },
            // Edge-style exclusivegateway: id:exclusivegateway:{label}
            { regex: /(\w+):exclusivegateway:\{([^}]+)\}/g, shape: 'diamond', type: 'gateway' },
            // Standard Rectangle: A[Label]
            { regex: /(\w+)\[([^\]]+)\]/g, shape: 'rectangle', type: 'task' },
            // Standard Rounded: A([Label])
            { regex: /(\w+)\(\[([^\]]+)\]\)/g, shape: 'rounded', type: 'event' },
            // Standard Diamond: A{Label}
            { regex: /(\w+)\{([^}]+)\}/g, shape: 'diamond', type: 'decision' },
            // Standard Circle: A((Label))
            { regex: /(\w+)\(\(([^)]+)\)\)/g, shape: 'circle', type: 'event' },
            // Standard Hexagon: A{{Label}}
            { regex: /(\w+)\{\{([^}]+)\}\}/g, shape: 'hexagon', type: 'task' },
            // Standard Parallelogram: A[/Label/]
            { regex: /(\w+)\[\/([^/]+)\/\]/g, shape: 'parallelogram', type: 'input' },
            // Standard Trapezoid: A[\\Label\\]
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
    static mapMermaidShapeToType(shape) {
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
    static extractMermaidConnections(mermaidSyntax) {
        console.log('[TaskExtractor] Extracting connections from Mermaid syntax...');
        
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
                    console.log(`[TaskExtractor] Found connection: ${match[1]} -> ${match[2]}`);
                }
            });
        });
        
        console.log(`[TaskExtractor] Extracted ${connections.length} connections`);
        return connections;
    }
    
    /**
     * Extract both nodes and connections from Mermaid syntax
     * @param {string} mermaidSyntax - Mermaid flowchart code
     * @returns {Object} Object with nodes and connections arrays
     */
    static extractMermaidNodesAndConnections(mermaidSyntax) {
        return {
            nodes: this.extractFromMermaid(mermaidSyntax),
            connections: this.extractMermaidConnections(mermaidSyntax)
        };
    }

    // ============================================
    // MULTI-SOURCE EXTRACTION METHODS
    // ============================================

    /**
     * Extract tasks from multiple XML documents
     * @param {string[]} xmlStrings - Array of XML strings
     * @returns {TaskIdentifier[][]} Array of task arrays
     */
    static extractFromMultipleCPEE(xmlStrings) {
        console.log(`[TaskExtractor] Extracting tasks from ${xmlStrings.length} XML documents`);
        
        const results = xmlStrings.map((xml, index) => {
            console.log(`[TaskExtractor] Processing XML document ${index + 1}/${xmlStrings.length}`);
            return this.extractFromCPEE(xml);
        });
        
        console.log('[TaskExtractor] Completed extraction from all documents');
        return results;
    }
}
