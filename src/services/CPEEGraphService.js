/**
 * CPEE Graph Service
 * Converts CPEE XML trees into official CPEE-style graph visualizations
 */

export class CPEEGraphService {
    
    /**
     * Create CPEE graph from XML
     * @param {HTMLElement} container - Container for the graph
     * @param {string} cpeeXML - CPEE XML description
     * @returns {Object} Result with rendering info
     */
    static parseXMLToTasks(cpeeXML) {
        try {
            console.log('Parsing CPEE XML to extract tasks...');
            
            // Clean and validate XML
            const cleanedXML = this.cleanXML(cpeeXML);
            
            // Extract tasks from XML
            const tasks = this.extractTasks(cleanedXML);
            console.log('📋 Extracted tasks:', tasks);
            
            if (tasks.length === 0) {
                return { success: false, message: 'No tasks found in XML', tasks: [] };
            }
            
            console.log('✅ CPEE XML parsed successfully');
            
            return {
                success: true,
                tasks: tasks,
                message: `Successfully parsed ${tasks.length} tasks from CPEE XML`
            };
        } catch (error) {
            console.error('Error parsing XML:', error);
            return { success: false, error: error.message, tasks: [] };
        }
    }
    

    /**
     * Clean and validate CPEE XML
     * @param {string} xml - Raw CPEE XML
     * @returns {string} Cleaned XML
     */
    static cleanXML(xml) {
        if (!xml || typeof xml !== 'string') {
            throw new Error('Invalid XML input');
        }
        
        console.log('Original XML input:', xml);
        
        // Remove HTML comments and extra whitespace
        let cleanedXML = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any leading whitespace and newlines
        cleanedXML = cleanedXML.replace(/^\s+/, '');
        
        console.log('After removing comments:', cleanedXML);
        
        // If no XML declaration, add one
        if (!cleanedXML.startsWith('<?xml')) {
            cleanedXML = '<?xml version="1.0"?>\n' + cleanedXML;
        }
        
        // Validate basic XML structure
        if (!cleanedXML.includes('<description')) {
            throw new Error('Invalid CPEE XML: Missing <description> element');
        }
        
        console.log('Final cleaned XML:', cleanedXML);
        return cleanedXML;
    }
    
    
    /**
     * Extract task information from CPEE XML (enhanced for complex structures)
     * @param {string} cpeeXML - CPEE XML description
     * @returns {Array<Object>} Array of task objects
     */
    static extractTasks(cpeeXML) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cpeeXML, 'text/xml');
        
        const tasks = [];
        const description = xmlDoc.querySelector('description');
        
        if (!description) {
            console.warn('No description element found in CPEE XML');
            return tasks;
        }
        
        // Recursively parse all child elements
        this._parseElements(description, tasks, 0);
        
        return tasks;
    }
    
    /**
     * Recursively parse CPEE elements
     * @param {Element} parent - Parent XML element
     * @param {Array} tasks - Array to collect parsed tasks
     * @param {number} depth - Current nesting depth
     */
    static _parseElements(parent, tasks, depth = 0) {
        // Process all child elements in order
        Array.from(parent.children).forEach((element, index) => {
            const elementName = element.tagName.toLowerCase();
            
            switch (elementName) {
                case 'call':
                    this._parseCall(element, tasks, depth, 'call');
                    break;
                    
                case 'callmanipulate':
                    this._parseCall(element, tasks, depth, 'callmanipulate');
                    break;
                    
                case 'loop':
                    this._parseLoop(element, tasks, depth);
                    break;
                    
                case 'choose':
                    this._parseChoose(element, tasks, depth);
                    break;
                    
                case 'alternative':
                    this._parseAlternative(element, tasks, depth);
                    break;
                    
                case 'escape':
                    this._parseEscape(element, tasks, depth);
                    break;
                    
                case 'parallel':
                    this._parseParallel(element, tasks, depth);
                    break;
                    
                case 'critical':
                    this._parseCritical(element, tasks, depth);
                    break;
                    
                default:
                    // For unknown elements, recursively parse their children
                    this._parseElements(element, tasks, depth);
                    break;
            }
        });
    }
    
    /**
     * Parse call/callmanipulate elements
     */
    static _parseCall(element, tasks, depth, elementType) {
        const label = element.querySelector('parameters > label')?.textContent || '';
        const id = element.getAttribute('id') || '';
        const type = element.querySelector('parameters > type')?.textContent || ':task';
        
        tasks.push({
            id: id,
            label: label,
            type: type,
            elementType: elementType,
            depth: depth,
            controlType: 'task'
        });
    }
    
    /**
     * Parse loop elements
     */
    static _parseLoop(element, tasks, depth) {
        const mode = element.getAttribute('mode') || 'pre_test';
        const condition = element.getAttribute('condition') || 'true';
        
        // Add loop start marker
        tasks.push({
            id: `loop_${tasks.length}`,
            label: `LOOP (${mode}: ${condition})`,
            type: ':loop',
            elementType: 'loop_start',
            depth: depth,
            controlType: 'control',
            mode: mode,
            condition: condition
        });
        
        // Parse loop body
        this._parseElements(element, tasks, depth + 1);
        
        // Add loop end marker
        tasks.push({
            id: `loop_end_${tasks.length}`,
            label: 'END LOOP',
            type: ':loop_end',
            elementType: 'loop_end',
            depth: depth,
            controlType: 'control'
        });
    }
    
    /**
     * Parse choose elements (conditional branching)
     */
    static _parseChoose(element, tasks, depth) {
        const mode = element.getAttribute('mode') || 'exclusive';
        
        // Add choose start marker
        tasks.push({
            id: `choose_${tasks.length}`,
            label: `CHOOSE (${mode})`,
            type: ':choose',
            elementType: 'choose_start',
            depth: depth,
            controlType: 'control',
            mode: mode
        });
        
        // Parse alternatives
        this._parseElements(element, tasks, depth + 1);
        
        // Add choose end marker
        tasks.push({
            id: `choose_end_${tasks.length}`,
            label: 'END CHOOSE',
            type: ':choose_end',
            elementType: 'choose_end',
            depth: depth,
            controlType: 'control'
        });
    }
    
    /**
     * Parse alternative elements (branches within choose)
     */
    static _parseAlternative(element, tasks, depth) {
        const condition = element.getAttribute('condition') || '';
        const language = element.getAttribute('language') || '';
        
        const conditionText = condition ? `${condition}` : 'DEFAULT';
        const langText = language ? ` (${language})` : '';
        
        // Add alternative start marker
        tasks.push({
            id: `alt_${tasks.length}`,
            label: `IF: ${conditionText}${langText}`,
            type: ':alternative',
            elementType: 'alternative_start',
            depth: depth,
            controlType: 'control',
            condition: condition,
            language: language
        });
        
        // Parse alternative body
        this._parseElements(element, tasks, depth + 1);
        
        // Add alternative end marker
        tasks.push({
            id: `alt_end_${tasks.length}`,
            label: 'END IF',
            type: ':alternative_end',
            elementType: 'alternative_end',
            depth: depth,
            controlType: 'control'
        });
    }
    
    /**
     * Parse escape elements
     */
    static _parseEscape(element, tasks, depth) {
        tasks.push({
            id: `escape_${tasks.length}`,
            label: 'ESCAPE',
            type: ':escape',
            elementType: 'escape',
            depth: depth,
            controlType: 'control'
        });
    }
    
    /**
     * Parse parallel elements
     */
    static _parseParallel(element, tasks, depth) {
        const mode = element.getAttribute('mode') || 'wait';
        
        tasks.push({
            id: `parallel_${tasks.length}`,
            label: `PARALLEL (${mode})`,
            type: ':parallel',
            elementType: 'parallel_start',
            depth: depth,
            controlType: 'control',
            mode: mode
        });
        
        this._parseElements(element, tasks, depth + 1);
        
        tasks.push({
            id: `parallel_end_${tasks.length}`,
            label: 'END PARALLEL',
            type: ':parallel_end',
            elementType: 'parallel_end',
            depth: depth,
            controlType: 'control'
        });
    }
    
    /**
     * Parse critical elements
     */
    static _parseCritical(element, tasks, depth) {
        tasks.push({
            id: `critical_${tasks.length}`,
            label: 'CRITICAL SECTION',
            type: ':critical',
            elementType: 'critical_start',
            depth: depth,
            controlType: 'control'
        });
        
        this._parseElements(element, tasks, depth + 1);
        
        tasks.push({
            id: `critical_end_${tasks.length}`,
            label: 'END CRITICAL',
            type: ':critical_end',
            elementType: 'critical_end',
            depth: depth,
            controlType: 'control'
        });
    }
    
    
    /**
     * Get color scheme for control flow elements
     * @param {string} elementType - Type of control element
     * @returns {Object} Color configuration
     */
    static _getControlElementColor(elementType) {
        const colorMap = {
            'loop_start': { fill: '#e1f5fe', stroke: '#01579b', text: '#01579b' },
            'loop_end': { fill: '#e1f5fe', stroke: '#01579b', text: '#01579b' },
            'choose_start': { fill: '#fff3e0', stroke: '#ef6c00', text: '#ef6c00' },
            'choose_end': { fill: '#fff3e0', stroke: '#ef6c00', text: '#ef6c00' },
            'alternative_start': { fill: '#f3e5f5', stroke: '#7b1fa2', text: '#7b1fa2' },
            'alternative_end': { fill: '#f3e5f5', stroke: '#7b1fa2', text: '#7b1fa2' },
            'escape': { fill: '#ffebee', stroke: '#c62828', text: '#c62828' },
            'parallel_start': { fill: '#e8f5e8', stroke: '#2e7d32', text: '#2e7d32' },
            'parallel_end': { fill: '#e8f5e8', stroke: '#2e7d32', text: '#2e7d32' },
            'critical_start': { fill: '#fce4ec', stroke: '#ad1457', text: '#ad1457' },
            'critical_end': { fill: '#fce4ec', stroke: '#ad1457', text: '#ad1457' }
        };
        
        return colorMap[elementType] || { fill: '#f5f5f5', stroke: '#666', text: '#333' };
    }
    
    /**
     * Get icon/symbol for control flow elements
     * @param {string} elementType - Type of control element
     * @returns {string} Icon character or symbol
     */
    static _getControlElementIcon(elementType) {
        const iconMap = {
            'loop_start': '↻',
            'loop_end': '⤴',
            'choose_start': '?',
            'choose_end': '⤴',
            'alternative_start': '→',
            'alternative_end': '⤴',
            'escape': '⚡',
            'parallel_start': '∥',
            'parallel_end': '⤴',
            'critical_start': '⚠',
            'critical_end': '⤴'
        };
        
        return iconMap[elementType] || '●';
    }
    
    
    /**
     * Validate CPEE XML format
     * @param {string} xml - XML to validate
     * @returns {Object} Validation result
     */
    static validateXML(xml) {
        try {
            // First clean the XML
            const cleanedXML = this.cleanXML(xml);
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(cleanedXML, 'text/xml');
            
            // Check for parser errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                return {
                    valid: false,
                    error: 'XML parsing error: ' + parseError.textContent.trim()
                };
            }
            
            // Check for CPEE namespace
            const description = xmlDoc.querySelector('description');
            if (!description) {
                return {
                    valid: false,
                    error: 'Missing <description> root element'
                };
            }
            
            const namespace = description.getAttribute('xmlns');
            if (!namespace || !namespace.includes('cpee.org')) {
                return {
                    valid: false,
                    error: 'Missing or invalid CPEE namespace'
                };
            }
            
            return {
                valid: true,
                message: 'Valid CPEE XML',
                cleanedXML: cleanedXML
            };
        } catch (error) {
            return {
                valid: false,
                error: 'XML validation failed: ' + error.message
            };
        }
    }
}
