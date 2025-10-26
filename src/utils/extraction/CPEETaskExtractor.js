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
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.error('[CPEETaskExtractor] XML parsing error:', parserError.textContent);
                return [];
            }
            
            console.log('[CPEETaskExtractor] XML parsed successfully');
            
            // Find all task elements (call, manipulate, script, etc.)
            const taskElements = this.findTaskElements(xmlDoc);
            console.log(`[CPEETaskExtractor] Found ${taskElements.length} task elements`);
            
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

