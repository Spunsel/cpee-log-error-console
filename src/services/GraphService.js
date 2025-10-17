/**
 * Graph Service
 * Converts CPEE XML trees to graph format for visualization
 */

export class GraphService {
    
    /**
     * Convert CPEE XML to graph format
     * @param {string} cpeeXML - CPEE XML string
     * @returns {Object} Graph object with nodes and edges
     */
    static convertCPEEToGraph(cpeeXML) {
        if (!cpeeXML || cpeeXML.trim() === '' || cpeeXML === 'Not found') {
            return this.createEmptyGraph();
        }
        
        try {
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(cpeeXML, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                console.warn('XML parsing error:', parseError.textContent);
                return this.createErrorGraph('Invalid XML format');
            }
            
            // Extract root description element
            const description = xmlDoc.querySelector('description');
            if (!description) {
                return this.createErrorGraph('No description element found');
            }
            
            // Convert to graph structure
            const graph = this.parseDescriptionElement(description);
            
            console.log('Converted CPEE XML to graph:', graph);
            return graph;
            
        } catch (error) {
            console.error('Error converting CPEE XML to graph:', error);
            return this.createErrorGraph(`Conversion error: ${error.message}`);
        }
    }
    
    /**
     * Parse description element and create graph
     * @param {Element} description - Description XML element
     * @returns {Object} Graph object
     */
    static parseDescriptionElement(description) {
        const nodes = [];
        const edges = [];
        let nodeIndex = 0;
        
        // Add start node
        const startNode = {
            id: 'start',
            type: 'start',
            label: 'Start',
            x: 50,
            y: 50,
            width: 80,
            height: 40
        };
        nodes.push(startNode);
        
        // Process child elements
        const childElements = Array.from(description.children);
        let previousNodeId = 'start';
        
        for (const element of childElements) {
            const node = this.parseElement(element, nodeIndex++);
            if (node) {
                nodes.push(node);
                
                // Create edge from previous node
                edges.push({
                    id: `edge_${previousNodeId}_${node.id}`,
                    source: previousNodeId,
                    target: node.id,
                    type: 'sequence'
                });
                
                previousNodeId = node.id;
            }
        }
        
        // Add end node if we have content
        if (nodes.length > 1) {
            const endNode = {
                id: 'end',
                type: 'end',
                label: 'End',
                x: 50,
                y: 200,
                width: 80,
                height: 40
            };
            nodes.push(endNode);
            
            // Connect last node to end
            edges.push({
                id: `edge_${previousNodeId}_end`,
                source: previousNodeId,
                target: 'end',
                type: 'sequence'
            });
        }
        
        return {
            nodes: nodes,
            edges: edges,
            layout: 'vertical',
            type: 'cpee-process'
        };
    }
    
    /**
     * Parse individual CPEE element to graph node
     * @param {Element} element - XML element
     * @param {number} index - Node index for ID generation
     * @returns {Object|null} Graph node or null
     */
    static parseElement(element, index) {
        const tagName = element.tagName.toLowerCase();
        
        switch (tagName) {
            case 'call':
                return this.parseCallElement(element, index);
            case 'parallel':
                return this.parseParallelElement(element, index);
            case 'choose':
                return this.parseChooseElement(element, index);
            case 'loop':
                return this.parseLoopElement(element, index);
            case 'alternative':
                return this.parseAlternativeElement(element, index);
            case 'manipulate':
                return this.parseManipulateElement(element, index);
            case 'scripts':
                return this.parseScriptsElement(element, index);
            default:
                console.log(`Unknown CPEE element: ${tagName}`);
                return this.parseGenericElement(element, index);
        }
    }
    
    /**
     * Parse call element (task/service call)
     * @param {Element} element - Call XML element
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseCallElement(element, index) {
        const parameters = element.querySelector('parameters');
        const label = parameters?.querySelector('label')?.textContent || 'Call';
        const method = parameters?.querySelector('method')?.textContent || '';
        const type = parameters?.querySelector('type')?.textContent || '';
        const endpoint = element.getAttribute('endpoint') || '';
        
        return {
            id: element.getAttribute('id') || `call_${index}`,
            type: 'call',
            label: label,
            details: {
                endpoint: endpoint,
                method: method,
                elementType: type
            },
            x: 50 + (index * 150),
            y: 120,
            width: 120,
            height: 60
        };
    }
    
    /**
     * Parse parallel element
     * @param {Element} element - Parallel XML element  
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseParallelElement(element, index) {
        return {
            id: element.getAttribute('id') || `parallel_${index}`,
            type: 'parallel',
            label: 'Parallel',
            x: 50 + (index * 150),
            y: 120,
            width: 100,
            height: 60
        };
    }
    
    /**
     * Parse choose element (exclusive gateway)
     * @param {Element} element - Choose XML element
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseChooseElement(element, index) {
        return {
            id: element.getAttribute('id') || `choose_${index}`,
            type: 'choose',
            label: 'Choose',
            x: 50 + (index * 150),
            y: 120,
            width: 80,
            height: 80
        };
    }
    
    /**
     * Parse loop element
     * @param {Element} element - Loop XML element
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseLoopElement(element, index) {
        return {
            id: element.getAttribute('id') || `loop_${index}`,
            type: 'loop',
            label: 'Loop',
            x: 50 + (index * 150),
            y: 120,
            width: 100,
            height: 60
        };
    }
    
    /**
     * Parse alternative element
     * @param {Element} element - Alternative XML element
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseAlternativeElement(element, index) {
        return {
            id: element.getAttribute('id') || `alternative_${index}`,
            type: 'alternative',
            label: 'Alternative',
            x: 50 + (index * 150),
            y: 120,
            width: 100,
            height: 60
        };
    }
    
    /**
     * Parse manipulate element
     * @param {Element} element - Manipulate XML element
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseManipulateElement(element, index) {
        return {
            id: element.getAttribute('id') || `manipulate_${index}`,
            type: 'manipulate',
            label: 'Manipulate',
            x: 50 + (index * 150),
            y: 120,
            width: 100,
            height: 60
        };
    }
    
    /**
     * Parse scripts element
     * @param {Element} element - Scripts XML element
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseScriptsElement(element, index) {
        return {
            id: element.getAttribute('id') || `scripts_${index}`,
            type: 'scripts',
            label: 'Scripts',
            x: 50 + (index * 150),
            y: 120,
            width: 100,
            height: 60
        };
    }
    
    /**
     * Parse unknown/generic element
     * @param {Element} element - Generic XML element
     * @param {number} index - Node index
     * @returns {Object} Graph node
     */
    static parseGenericElement(element, index) {
        return {
            id: element.getAttribute('id') || `generic_${index}`,
            type: 'generic',
            label: element.tagName,
            x: 50 + (index * 150),
            y: 120,
            width: 100,
            height: 60
        };
    }
    
    /**
     * Create empty graph structure
     * @returns {Object} Empty graph
     */
    static createEmptyGraph() {
        return {
            nodes: [{
                id: 'empty',
                type: 'info',
                label: 'Empty Process',
                x: 100,
                y: 50,
                width: 120,
                height: 40
            }],
            edges: [],
            layout: 'vertical',
            type: 'empty'
        };
    }
    
    /**
     * Create error graph structure
     * @param {string} errorMessage - Error message to display
     * @returns {Object} Error graph
     */
    static createErrorGraph(errorMessage) {
        return {
            nodes: [{
                id: 'error',
                type: 'error',
                label: 'Parse Error',
                details: { error: errorMessage },
                x: 100,
                y: 50,
                width: 140,
                height: 60
            }],
            edges: [],
            layout: 'vertical',
            type: 'error'
        };
    }
    
    /**
     * Calculate automatic layout positions for nodes
     * @param {Array} nodes - Array of graph nodes
     * @param {Array} edges - Array of graph edges
     * @returns {Array} Nodes with updated positions
     */
    static applyAutoLayout(nodes, edges) {
        // Simple vertical layout for now
        let yPosition = 50;
        const xCenter = 200;
        const verticalSpacing = 100;
        
        return nodes.map((node, index) => {
            const updatedNode = { ...node };
            
            if (node.type === 'start') {
                updatedNode.x = xCenter - (node.width / 2);
                updatedNode.y = yPosition;
            } else if (node.type === 'end') {
                updatedNode.x = xCenter - (node.width / 2);
                updatedNode.y = yPosition + (nodes.length - 1) * verticalSpacing;
            } else {
                updatedNode.x = xCenter - (node.width / 2);
                updatedNode.y = yPosition + index * verticalSpacing;
            }
            
            return updatedNode;
        });
    }
    
    /**
     * Validate graph structure
     * @param {Object} graph - Graph object to validate
     * @returns {boolean} True if graph is valid
     */
    static validateGraph(graph) {
        if (!graph || !graph.nodes || !graph.edges) {
            return false;
        }
        
        // Check node structure
        for (const node of graph.nodes) {
            if (!node.id || !node.type || !node.label) {
                return false;
            }
        }
        
        // Check edge structure
        for (const edge of graph.edges) {
            if (!edge.id || !edge.source || !edge.target) {
                return false;
            }
        }
        
        return true;
    }
}
