/**
 * CPEE Node Extractor
 * Extracts tasks from CPEE XML syntax
 */

import { NodeIdentifier } from '../../models/NodeIdentifier.js';
import { CPEEParser } from '../content/CPEEParser.js';

export class CPEENodeExtractor {
    /**
     * Extract tasks and gateways from CPEE XML
     * @param {string} xmlString - CPEE XML content
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects (tasks and gateways)
     */
    static extract(xmlString) {        
        try {
            // Preprocess CPEE XML before extracting nodes
            let preprocessedXml = xmlString;
            try {
                const preprocessResult = CPEEParser.cleanAndValidate(xmlString, true);
                preprocessedXml = preprocessResult.xml;
            } catch (error) {
                console.warn('[CPEENodeExtractor] Failed to preprocess CPEE XML, using original:', error);
                // Fallback to original XML if preprocessing fails
            }
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(preprocessedXml, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.warn('[CPEENodeExtractor] XML parsing error:', parserError.textContent);
                return [];
            }
                        
            // Find all task and gateway elements
            const taskElements = this.findTaskElements(xmlDoc);
            const gatewayElements = this.findGatewayElements(xmlDoc);
            
            // Extract tasks and gateways
            const tasks = [];
            let position = 0;
            
            taskElements.forEach((element) => {
                const task = this.extractTaskFromElement(element, position);
                if (task && task.isValid()) {
                    tasks.push(task);
                    position++;
                }
            });
            
            gatewayElements.forEach((element) => {
                const gateway = this.extractTaskFromElement(element, position);
                if (gateway && gateway.isValid()) {
                    tasks.push(gateway);
                    position++;
                }
            });
            
            return tasks;
            
        } catch (error) {
            return [];
        }
    }

    /**
     * Find all task elements in XML document
     * @param {Document} xmlDoc - Parsed XML document
     * @returns {Element[]} Array of task elements
     */
    static findTaskElements(xmlDoc) {
        const taskTypes = ['call', 'manipulate', 'script'];
        const elements = [];
        
        taskTypes.forEach(type => {
            const found = xmlDoc.querySelectorAll(type);
            found.forEach(element => elements.push(element));
        });
        
        return elements;
    }

    /**
     * Find all gateway elements in XML document
     * @param {Document} xmlDoc - Parsed XML document
     * @returns {Element[]} Array of gateway elements
     */
    static findGatewayElements(xmlDoc) {
        const gatewayTypes = ['choose', 'parallel', 'loop'];
        const elements = [];
        
        gatewayTypes.forEach(type => {
            const found = xmlDoc.querySelectorAll(type);
            found.forEach(element => elements.push(element));
        });
        
        return elements;
    }

    /**
     * Calculate the nesting depth of a gateway element in the XML
     * Counts how many ancestor gateway elements (choose, parallel, loop) exist
     * This is used to distinguish nested gateways (different depths) from sequential gateways (same depth)
     * @param {Element} element - Gateway XML element
     * @returns {number} Nesting depth (0 = top level, 1 = inside one gateway, etc.)
     */
    static calculateNestingDepth(element) {
        const gatewayTypes = ['choose', 'parallel', 'loop'];
        let depth = 0;
        let parent = element.parentElement;
        
        while (parent) {
            const tagName = parent.tagName?.toLowerCase();
            if (tagName && gatewayTypes.includes(tagName)) {
                depth++;
            }
            parent = parent.parentElement;
        }
        
        return depth;
    }

    /**
     * Extract NodeIdentifier from a single XML element
     * @param {Element} element - XML element
     * @param {number} position - Position in workflow
     * @returns {NodeIdentifier|null} NodeIdentifier or null
     */
    static extractTaskFromElement(element, position) {
        try {
            const tagName = element.tagName.toLowerCase();
            const isGateway = tagName === 'choose' || tagName === 'parallel' || tagName === 'loop';
            
            // Extract alt_id from annotation namespace (a:alt_id)
            let altId = null;
            // Try both with and without namespace prefix
            altId = element.getAttribute('a:alt_id') || 
                   element.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') ||
                   null;
            
            // For gateways, they often don't have an id attribute, use alt_id as id if available
            let id = element.getAttribute('id');
            if (!id) {
                if (isGateway && altId) {
                    // For gateways, use alt_id as the id (since SVG element-id is usually set to alt_id)
                    id = altId;
                } else {
                    id = isGateway ? `gateway-${position}` : `task-${position}`;
                }
            }
            
            let label = this.extractLabel(element);
            
            if (!label) {
                label = id;
            }
            
            // Map CPEE tag names to node types
            let type = tagName;
            if (tagName === 'choose') {
                type = 'gateway'; // XOR gateway
            } else if (tagName === 'parallel') {
                type = 'gateway'; // AND gateway
            } else if (tagName === 'loop') {
                type = 'gateway'; // Loop gateway (back-edge)
            }
            
            const metadata = this.extractMetadata(element, tagName);
            
            // For gateways, calculate and store nesting depth
            // This is used to distinguish nested vs sequential gateways
            if (isGateway) {
                metadata.nestingDepth = this.calculateNestingDepth(element);
            }
            
            const task = new NodeIdentifier(id, label, type, 'cpee', metadata, position, altId);
            task.position = position;
            
            return task;
            
        } catch (error) {
            console.error('[CPEENodeExtractor] Error extracting task:', error);
            return null;
        }
    }

    /**
     * Extract label from element
     * @param {Element} element - XML element
     * @returns {string|null} Label or null
     */
    static extractLabel(element) {
        // Try label attribute
        let label = element.getAttribute('label');
        if (label) {
            return label;
        }
        
        // Try parameters > label
        const parametersLabel = element.querySelector('parameters > label');
        if (parametersLabel) {
            label = parametersLabel.textContent.trim();
            label = label.replace(/^["']|["']$/g, '');
            if (label) {
                return label;
            }
        }
        
        // Try description
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
     * Extract metadata from element
     * @param {Element} element - XML element
     * @param {string} type - Task type
     * @returns {Object} Metadata object
     */
    static extractMetadata(element, type) {
        const metadata = { tagName: element.tagName };
        
        if (type === 'call') {
            const endpoint = element.getAttribute('endpoint');
            if (endpoint) {
                metadata.endpoint = endpoint;
            }
            
            const method = element.querySelector('method');
            if (method) {
                metadata.method = method.textContent.trim();
            }
            
            const args = element.querySelector('arguments');
            if (args) {
                metadata.argumentCount = args.children.length;
            }
        }
        
        if (type === 'manipulate') {
            const output = element.querySelector('output');
            if (output) {
                metadata.output = output.textContent.trim();
            }
        }
        
        if (type === 'script') {
            const codeType = element.getAttribute('type');
            if (codeType) {
                metadata.codeType = codeType;
            }
        }
        
        Array.from(element.attributes).forEach(attr => {
            if (attr.name !== 'id' && attr.name !== 'label') {
                metadata[attr.name] = attr.value;
            }
        });
        
        return metadata;
    }
    
    // ==================== Gateway Element-ID Utility Methods ====================
    
    /**
     * Check if a string is a CPEE gateway element-id (e.g., "choose_1", "parallel_0")
     * @param {string} elementId - Element ID to check
     * @returns {boolean} True if it's a CPEE gateway element-id
     */
    static isCPEEGatewayElementId(elementId) {
        if (!elementId) {
            return false;
        }
        return /^(choose|parallel|loop)_\d+$/.test(elementId);
    }
    
    /**
     * Parse a CPEE gateway element-id to extract type and index
     * @param {string} elementId - Element ID like "choose_1", "parallel_0", or "loop_0"
     * @returns {Object|null} { type: 'choose'|'parallel'|'loop', index: number } or null
     */
    static parseCPEEGatewayElementId(elementId) {
        if (!elementId) {
            return null;
        }
        
        const match = elementId.match(/^(choose|parallel|loop)_(\d+)$/);
        if (!match) {
            return null;
        }
        
        return {
            type: match[1],
            index: parseInt(match[2], 10)
        };
    }
    
    /**
     * Build a CPEE gateway element-id from type and index
     * @param {string} type - Gateway type ('choose', 'parallel', or 'loop')
     * @param {number} index - SVG index
     * @returns {string} Element ID like "choose_1"
     */
    static buildCPEEGatewayElementId(type, index) {
        return `${type}_${index}`;
    }
    
    /**
     * Check if a node type represents a gateway
     * Includes CPEE types (choose, parallel, loop) and Mermaid types (exclusivegateway, parallelgateway)
     * @param {string} type - Node type
     * @returns {boolean} True if it's a gateway type
     */
    static isGatewayType(type) {
        return type === 'gateway' || 
               type === 'choose' || 
               type === 'parallel' ||
               type === 'loop' ||
               type === 'exclusivegateway' ||
               type === 'parallelgateway' ||
               type === 'decision';  // Mermaid diamond shapes may have 'decision' type
    }
    
    /**
     * Determine if a gateway type matches a specific CPEE gateway element type
     * @param {string} nodeType - Node type from mapping
     * @param {string} elementType - CPEE element type ('choose', 'parallel', or 'loop')
     * @param {Object|null} metadata - Node metadata (may contain tagName)
     * @returns {boolean} True if types match
     */
    static gatewayTypeMatches(nodeType, elementType, metadata = null) {
        if (elementType === 'choose') {
            return nodeType === 'choose' || 
                   nodeType === 'gateway' ||
                   nodeType === 'exclusivegateway' ||
                   nodeType === 'decision' ||
                   (metadata && metadata.tagName === 'choose');
        } else if (elementType === 'parallel') {
            return nodeType === 'parallel' || 
                   nodeType === 'gateway' ||
                   nodeType === 'parallelgateway' ||
                   (metadata && metadata.tagName === 'parallel');
        } else if (elementType === 'loop') {
            return nodeType === 'loop' || 
                   nodeType === 'gateway' ||
                   nodeType === 'exclusivegateway' ||  // Loops are represented as exclusive gateways in Mermaid
                   nodeType === 'decision' ||
                   (metadata && metadata.tagName === 'loop');
        }
        return false;
    }
    
    // ==================== SVG Element Alt-ID Extraction ====================
    
    /**
     * Extract alt_id from CPEE SVG gateway element
     * Looks for element-alt_id attribute on the gateway element or its parent group ("Übergruppe")
     * 
     * The presetaltid theme adds element-alt_id attributes directly to gateway SVG elements.
     * For gateways, the alt_id is on the parent group that contains both the splitting
     * and merging gateway (for XOR) or just the splitting gateway (for parallel).
     * 
     * @param {Element} svgElement - SVG element (gateway or its child)
     * @returns {string|null} The alt_id or null
     */
    static extractAltIdFromSvgElement(svgElement) {
        if (!svgElement) return null;
        
        // Check if element itself has element-alt_id
        let altId = svgElement.getAttribute('element-alt_id');
        if (altId) return altId;
        
        // Check parent group ("Übergruppe") - gateways have alt_id on their parent group
        const parentGroup = svgElement.closest('g[element-alt_id]');
        if (parentGroup) {
            return parentGroup.getAttribute('element-alt_id');
        }
        
        return null;
    }
    
    /**
     * Find CPEE SVG element by its element-alt_id attribute
     * This is the new direct lookup method that replaces the complex positional index resolution
     * 
     * @param {Element} container - SVG container to search in
     * @param {string} altId - The alt_id to search for (e.g., "gw1s", "3")
     * @returns {Element|null} The matching SVG element or null
     */
    static findSvgElementByAltId(container, altId) {
        if (!container || !altId) return null;
        
        // Direct lookup by element-alt_id attribute
        const element = container.querySelector(`g[element-alt_id="${CSS.escape(altId)}"]`);
        if (element) return element;
        
        // Also check for elements where the alt_id might be on a child element
        const allWithAltId = container.querySelectorAll('[element-alt_id]');
        for (const el of allWithAltId) {
            if (el.getAttribute('element-alt_id') === altId) {
                // Return the g.element parent if possible
                const parent = el.closest('g.element');
                return parent || el;
            }
        }
        
        return null;
    }

}

