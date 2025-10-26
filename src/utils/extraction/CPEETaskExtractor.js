/**
 * CPEE Task Extractor
 * Extracts task information from CPEE XML content
 */

import { TaskIdentifier } from '../../models/TaskIdentifier.js';

export class CPEETaskExtractor {
    
    /**
     * Extract tasks from CPEE XML
     * @param {string} xmlString - CPEE XML content
     * @returns {TaskIdentifier[]} Array of TaskIdentifier objects
     */
    static extractTasksFromXML(xmlString) {
        console.log('[CPEETaskExtractor] Starting task extraction from XML...');
        
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
                console.warn('[CPEETaskExtractor] XML parsing error:', parserError.textContent);
                console.warn('[CPEETaskExtractor] Input XML (first 500 chars):', xmlString.substring(0, 500));
                return [];
            }
            
            console.log('[CPEETaskExtractor] XML parsed successfully');
            
            // Debug: Log XML structure for diagnosis
            const hasComplexStructure = xmlDoc.querySelector('loop, gateway, choose') !== null;
            const rootElement = xmlDoc.documentElement;
            const rootTagName = rootElement ? rootElement.tagName : 'unknown';
            const rootNamespace = rootElement ? rootElement.namespaceURI : 'unknown';
            console.log(`[CPEETaskExtractor] Root element: ${rootTagName} (ns: ${rootNamespace})`);
            console.log(`[CPEETaskExtractor] Has loops/gateways: ${hasComplexStructure}`);
            
            // Find all task elements (call, manipulate, script, etc.)
            const taskElements = this.findTaskElements(xmlDoc);
            console.log(`[CPEETaskExtractor] Found ${taskElements.length} task elements`);
            
            // Debug: log XML structure for complex structures with no tasks
            if (taskElements.length === 0 && hasComplexStructure) {
                console.warn('[CPEETaskExtractor] Found loops/gateways but no task elements');
                console.warn('[CPEETaskExtractor] XML structure (first 1500 chars):', xmlString.substring(0, 1500));
                
                // Try to find elements with explicit namespace
                const namespacedCalls = xmlDoc.querySelectorAll('call');
                console.warn(`[CPEETaskExtractor] Found ${namespacedCalls.length} <call> elements (any namespace)`);
            }
            
            // Extract TaskIdentifier for each element
            const tasks = [];
            taskElements.forEach((element, index) => {
                const task = this.extractTaskFromElement(element, index);
                if (task && task.isValid()) {
                    tasks.push(task);
                    console.log(`[CPEETaskExtractor] Extracted task: ${task.toString()}`);
                } else {
                    console.warn(`[CPEETaskExtractor] Invalid task at position ${index}:`, task);
                }
            });
            
            console.log(`[CPEETaskExtractor] Successfully extracted ${tasks.length} tasks`);
            return tasks;
            
        } catch (error) {
            console.error('[CPEETaskExtractor] Error extracting tasks:', error);
            return [];
        }
    }
    
    /**
     * Find all task elements in XML document, including nested ones
     * @param {Document} xmlDoc - Parsed XML document
     * @returns {Element[]} Array of task elements
     */
    static findTaskElements(xmlDoc) {
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
            console.log(`[CPEETaskExtractor] First few task IDs:`, firstFew.map(el => el.getAttribute('id')));
        }
        
        return elements;
    }
    
    /**
     * Extract TaskIdentifier from a single XML element
     * @param {Element} element - XML element
     * @param {number} position - Position in workflow
     * @returns {TaskIdentifier|null} TaskIdentifier or null if extraction fails
     */
    static extractTaskFromElement(element, position) {
        try {
            // Extract ID
            const id = element.getAttribute('id') || `task-${position}`;
            
            // Extract label (from various possible locations)
            let label = this.extractLabel(element);
            
            // Use ID as fallback label
            if (!label) {
                label = id;
            }
            
            // Extract type (element tag name)
            const type = element.tagName.toLowerCase();
            
            // Extract additional metadata
            const metadata = this.extractMetadata(element, type);
            
            // Create TaskIdentifier
            const task = new TaskIdentifier(id, label, type, 'cpee', metadata, position);
            
            // Explicitly set position to ensure it's not null
            task.position = position;
            
            return task;
            
        } catch (error) {
            console.error('[CPEETaskExtractor] Error extracting task from element:', error);
            return null;
        }
    }
    
    /**
     * Extract label from various possible locations in element
     * @param {Element} element - XML element
     * @returns {string|null} Label or null
     */
    static extractLabel(element) {
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
    static extractMetadata(element, type) {
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
    
    /**
     * Extract tasks from multiple XML documents
     * @param {string[]} xmlStrings - Array of XML strings
     * @returns {TaskIdentifier[][]} Array of task arrays
     */
    static extractTasksFromMultipleXML(xmlStrings) {
        console.log(`[CPEETaskExtractor] Extracting tasks from ${xmlStrings.length} XML documents`);
        
        const results = xmlStrings.map((xml, index) => {
            console.log(`[CPEETaskExtractor] Processing XML document ${index + 1}/${xmlStrings.length}`);
            return this.extractTasksFromXML(xml);
        });
        
        console.log('[CPEETaskExtractor] Completed extraction from all documents');
        return results;
    }
}

