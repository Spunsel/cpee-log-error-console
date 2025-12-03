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
     * Extract tasks from multiple XML documents
     * @param {string[]} xmlStrings - Array of XML strings
     * @returns {NodeIdentifier[][]} Array of task arrays
     */
    static extractFromMultiple(xmlStrings) {        
        return xmlStrings.map((xml) => this.extract(xml));
    }

    /**
     * Fix common XML issues
     * @param {string} xmlString - XML string to fix
     * @returns {string} Fixed XML string
     */
    static fixXMLIssues(xmlString) {
        let fixedXml = xmlString;
        
        // Escape unescaped < and > in attribute values
        fixedXml = fixedXml.replace(/=("([^"]*)<\s*([^"]*))"/g, (match) => match.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        
        fixedXml = fixedXml.replace(/=('([^']*)<\s*([^']*))'/g, (match) => match.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        
        // Fix comparison operators in condition attributes
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*<\s*([^"]*)"/g, 'condition="$1 &lt; $2"');
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*>\s*([^"]*)"/g, 'condition="$1 &gt; $2"');
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*<=\s*([^"]*)"/g, 'condition="$1 &lt;= $2"');
        fixedXml = fixedXml.replace(/condition="([^"]*)\s*>=\s*([^"]*)"/g, 'condition="$1 &gt;= $2"');
        
        return fixedXml;
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
        const gatewayTypes = ['choose', 'parallel'];
        const elements = [];
        
        gatewayTypes.forEach(type => {
            const found = xmlDoc.querySelectorAll(type);
            found.forEach(element => elements.push(element));
        });
        
        return elements;
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
            const isGateway = tagName === 'choose' || tagName === 'parallel';
            
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
            }
            
            const metadata = this.extractMetadata(element, tagName);
            
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
    
    // ============ Gateway Utility Methods ============
    
    /**
     * Check if a task/node is a gateway
     * @param {Object} task - Task object with type
     * @returns {boolean} True if gateway
     */
    static isGateway(task) {
        if (!task) {
            return false;
        }
        return task.type === 'gateway' || 
               task.type === 'choose' || 
               task.type === 'parallel';
    }
    
    /**
     * Check if an element-id is a CPEE gateway element-id (choose_N, parallel_N)
     * @param {string} elementId - Element ID
     * @returns {boolean} True if CPEE gateway element-id
     */
    static isCPEEGatewayElementId(elementId) {
        return elementId && elementId.match(/^(choose|parallel)_\d+$/);
    }
    
    /**
     * Extract gateway type from element-id
     * @param {string} elementId - Element ID (e.g., "choose_1", "parallel_0")
     * @returns {string|null} Gateway type ("choose" or "parallel") or null
     */
    static extractGatewayType(elementId) {
        const match = elementId && elementId.match(/^(choose|parallel)_\d+$/);
        return match ? match[1] : null;
    }
    
    /**
     * Extract SVG index from element-id
     * @param {string} elementId - Element ID (e.g., "choose_1")
     * @returns {number} SVG index or -1
     */
    static extractSvgIndex(elementId) {
        const match = elementId && elementId.match(/^(?:choose|parallel)_(\d+)$/);
        return match ? parseInt(match[1], 10) : -1;
    }

}

