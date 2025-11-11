/**
 * CPEE Node Extractor
 * Extracts tasks from CPEE XML syntax
 */

import { NodeIdentifier } from '../../models/NodeIdentifier.js';

export class CPEENodeExtractor {
    /**
     * Extract tasks from CPEE XML
     * @param {string} xmlString - CPEE XML content
     * @returns {NodeIdentifier[]} Array of NodeIdentifier objects
     */
    static extract(xmlString) {
        console.log('[CPEENodeExtractor] Starting task extraction from CPEE XML...');
        
        try {
            // Fix common XML issues: unescaped < in attribute values
            const fixedXml = this.fixXMLIssues(xmlString);
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fixedXml, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.warn('[CPEENodeExtractor] XML parsing error:', parserError.textContent);
                return [];
            }
            
            console.log('[CPEENodeExtractor] XML parsed successfully');
            
            // Find all task elements
            const taskElements = this.findTaskElements(xmlDoc);
            console.log(`[CPEENodeExtractor] Found ${taskElements.length} task elements`);
            
            // Extract tasks
            const tasks = [];
            taskElements.forEach((element, index) => {
                const task = this.extractTaskFromElement(element, index);
                if (task && task.isValid()) {
                    tasks.push(task);
                }
            });
            
            console.log(`[CPEENodeExtractor] Successfully extracted ${tasks.length} tasks`);
            return tasks;
            
        } catch (error) {
            console.error('[CPEENodeExtractor] Error extracting tasks:', error);
            return [];
        }
    }

    /**
     * Extract tasks from multiple XML documents
     * @param {string[]} xmlStrings - Array of XML strings
     * @returns {NodeIdentifier[][]} Array of task arrays
     */
    static extractFromMultiple(xmlStrings) {
        console.log(`[CPEENodeExtractor] Extracting from ${xmlStrings.length} XML documents`);
        
        const results = xmlStrings.map((xml, index) => {
            console.log(`[CPEENodeExtractor] Processing XML document ${index + 1}/${xmlStrings.length}`);
            return this.extract(xml);
        });
        
        return results;
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
     * Extract NodeIdentifier from a single XML element
     * @param {Element} element - XML element
     * @param {number} position - Position in workflow
     * @returns {NodeIdentifier|null} NodeIdentifier or null
     */
    static extractTaskFromElement(element, position) {
        try {
            const id = element.getAttribute('id') || `task-${position}`;
            
            // Extract alt_id from annotation namespace (a:alt_id)
            let altId = null;
            // Try both with and without namespace prefix
            altId = element.getAttribute('a:alt_id') || 
                   element.getAttributeNS('http://cpee.org/ns/annotation/1.0', 'alt_id') ||
                   null;
            
            let label = this.extractLabel(element);
            
            if (!label) {
                label = id;
            }
            
            const type = element.tagName.toLowerCase();
            const metadata = this.extractMetadata(element, type);
            
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

}

