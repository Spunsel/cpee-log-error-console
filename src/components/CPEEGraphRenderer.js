/**
 * CPEE Graph Renderer Component
 * Handles UI for CPEE graph rendering from XML
 */

import { CPEEGraphService } from '../services/CPEEGraphService.js';

export class CPEEGraphRenderer {
    
    constructor() {
        this.currentAdaptor = null;
        this.isRendered = false;
    }
    
    /**
     * Initialize the graph renderer
     * @param {string} containerId - ID of the container element
     * @param {string} statusId - ID of the status element
     * @param {string} xmlInputId - ID of the XML input textarea
     */
    initialize(containerId, statusId, xmlInputId) {
        this.container = document.getElementById(containerId);
        this.statusElement = document.getElementById(statusId);
        this.xmlInput = document.getElementById(xmlInputId);
        
        if (!this.container) {
            throw new Error(`Container with ID ${containerId} not found`);
        }
        
        // Initialize container styling
        this.setupContainer();
    }
    
    /**
     * Setup container with proper styling
     */
    setupContainer() {
        this.container.style.border = '1px solid #dee2e6';
        this.container.style.borderRadius = '8px';
        this.container.style.minHeight = '400px';
        this.container.style.padding = '20px';
        this.container.style.backgroundColor = '#f8f9fa';
        this.container.style.display = 'flex';
        this.container.style.alignItems = 'center';
        this.container.style.justifyContent = 'center';
        this.container.innerHTML = '<div style="color: #6c757d; font-size: 1.1rem;">Enter CPEE XML above to generate graph visualization</div>';
    }
    
    /**
     * Render graph from CPEE XML
     * @param {string} cpeeXML - CPEE XML description
     */
    async renderGraph(cpeeXML) {
        try {
            this.showStatus('🔄 Parsing CPEE XML...', 'loading');
            
            // Validate XML first
            const validation = CPEEGraphService.validateXML(cpeeXML);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // Use cleaned XML for parsing
            const cleanedXML = validation.cleanedXML || CPEEGraphService.cleanXML(cpeeXML);
            
            // Parse XML to tasks
            const result = CPEEGraphService.parseXMLToTasks(cleanedXML);
            
            if (!result.success) {
                throw new Error(result.error || result.message);
            }
            
            // Clear container and prepare for display
            this.container.innerHTML = '';
            this.container.style.display = 'block';
            this.container.style.textAlign = 'left';
            this.container.style.backgroundColor = '#ffffff';
            
            this.isRendered = true;
            
            this.showStatus(`✅ XML parsed successfully - ${result.tasks.length} tasks found`, 'success');
            
            // Show tasks info
            this.showTasksInfo(result.tasks);
            
        } catch (error) {
            console.error('Error parsing XML:', error);
            this.showStatus(`❌ Failed to parse XML: ${error.message}`, 'error');
            this.setupContainer(); // Reset to original state
        }
    }
    
    /**
     * Show parsed tasks information
     * @param {Array} tasks - Array of parsed tasks
     */
    showTasksInfo(tasks) {
        try {
            const stats = {
                totalElements: tasks.length,
                taskCount: tasks.filter(t => t.controlType === 'task').length,
                controlCount: tasks.filter(t => t.controlType === 'control').length,
                callCount: tasks.filter(t => t.elementType === 'call').length,
                manipulationCount: tasks.filter(t => t.elementType === 'callmanipulate').length,
                loopCount: tasks.filter(t => t.elementType?.includes('loop')).length,
                chooseCount: tasks.filter(t => t.elementType?.includes('choose')).length,
                escapeCount: tasks.filter(t => t.elementType === 'escape').length
            };
            
            // Create info element
            const infoDiv = document.createElement('div');
            infoDiv.style.marginTop = '20px';
            infoDiv.style.padding = '15px';
            infoDiv.style.backgroundColor = '#e9ecef';
            infoDiv.style.borderRadius = '5px';
            infoDiv.style.fontSize = '14px';
            
            infoDiv.innerHTML = `
                <h4 style="margin: 0 0 10px 0; color: #495057;">📊 Parsed Tasks Information</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <div><strong>Total Elements:</strong> ${stats.totalElements}</div>
                    <div><strong>Tasks:</strong> ${stats.taskCount}</div>
                    <div><strong>Control Flow:</strong> ${stats.controlCount}</div>
                    <div><strong>Calls:</strong> ${stats.callCount}</div>
                    <div><strong>Manipulations:</strong> ${stats.manipulationCount}</div>
                    <div><strong>Loops:</strong> ${stats.loopCount}</div>
                    <div><strong>Choices:</strong> ${stats.chooseCount}</div>
                    <div><strong>Escapes:</strong> ${stats.escapeCount}</div>
                </div>
            `;
            
            // Add tasks list
            const tasksContainer = document.createElement('div');
            tasksContainer.style.marginTop = '20px';
            
            const tasksHeader = document.createElement('h4');
            tasksHeader.textContent = '📋 Tasks List';
            tasksHeader.style.margin = '0 0 10px 0';
            tasksHeader.style.color = '#495057';
            tasksContainer.appendChild(tasksHeader);
            
            const tasksList = document.createElement('pre');
            tasksList.style.backgroundColor = '#f8f9fa';
            tasksList.style.padding = '10px';
            tasksList.style.borderRadius = '5px';
            tasksList.style.fontSize = '12px';
            tasksList.style.overflow = 'auto';
            tasksList.style.maxHeight = '300px';
            tasksList.textContent = JSON.stringify(tasks, null, 2);
            
            tasksContainer.appendChild(tasksList);
            
            this.container.appendChild(infoDiv);
            this.container.appendChild(tasksContainer);
            
        } catch (error) {
            console.error('Error showing tasks info:', error);
        }
    }
    
    /**
     * Create sample CPEE XML for testing
     */
    createSampleXML() {
        return `<?xml version="1.0"?>
<description xmlns="http://cpee.org/ns/description/1.0">
  <call id="a2" endpoint="">
    <parameters>
      <label>Task A</label>
      <method/>
      <type>:task</type>
      <mid>'a2'</mid>
      <arguments/>
    </parameters>
  </call>
  <call id="a4" endpoint="">
    <parameters>
      <label>Task B</label>
      <method/>
      <type>:task</type>
      <mid>'b'</mid>
      <arguments/>
    </parameters>
  </call>
  <callmanipulate id="a1" endpoint="">
    <parameters>
      <label>Process Data</label>
      <method/>
      <type>:manipulation</type>
      <mid>'s'</mid>
      <arguments/>
    </parameters>
  </callmanipulate>
</description>`;
    }

    /**
     * Create complex sample CPEE XML with parallel branches
     */
    createComplexSampleXML() {
        return `<?xml version="1.0"?>
<description xmlns="http://cpee.org/ns/description/1.0">
  <call id="start" endpoint="">
    <parameters>
      <label>Initialize Process</label>
      <method>post</method>
      <type>:task</type>
      <mid>'start'</mid>
      <arguments/>
    </parameters>
  </call>
  <parallel>
    <parallel_branch>
      <call id="task1" endpoint="">
        <parameters>
          <label>Parallel Task 1</label>
          <method>post</method>
          <type>:task</type>
          <mid>'p1'</mid>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="task2" endpoint="">
        <parameters>
          <label>Parallel Task 2</label>
          <method>post</method>
          <type>:task</type>
          <mid>'p2'</mid>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <call id="final" endpoint="">
    <parameters>
      <label>Finalize Process</label>
      <method>post</method>
      <type>:task</type>
      <mid>'final'</mid>
      <arguments/>
    </parameters>
  </call>
</description>`;
    }

    /**
     * Load sample CPEE XML for testing
     */
    loadSample() {
        if (this.xmlInput) {
            const sampleXML = this.createSampleXML();
            this.xmlInput.value = sampleXML;
            this.renderGraph(sampleXML);
        }
    }
    
    /**
     * Load complex sample CPEE XML
     */
    loadComplexSample() {
        if (this.xmlInput) {
            const complexXML = this.createComplexSampleXML();
            this.xmlInput.value = complexXML;
            this.renderGraph(complexXML);
        }
    }
    
    /**
     * Render graph from input textarea
     */
    renderFromInput() {
        if (this.xmlInput) {
            const xml = this.xmlInput.value.trim();
            if (!xml) {
                this.showStatus('Please enter CPEE XML in the textarea above', 'error');
                return;
            }
            this.renderGraph(xml);
        }
    }
    
    /**
     * Clear the rendered graph
     */
    clearGraph() {
        CPEEGraphService.clearGraph(this.container);
        this.currentAdaptor = null;
        this.isRendered = false;
        this.clearStatus();
        
        if (this.xmlInput) {
            this.xmlInput.value = '';
        }
    }
    
    /**
     * Show status message
     * @param {string} message - Status message
     * @param {string} type - Status type (loading, success, error)
     */
    showStatus(message, type) {
        if (this.statusElement) {
            const statusClass = `status ${type}`;
            this.statusElement.innerHTML = `<div class="${statusClass}">${message}</div>`;
        } else {
            console.log(`Status: ${message}`);
        }
    }
    
    /**
     * Clear status message
     */
    clearStatus() {
        if (this.statusElement) {
            this.statusElement.innerHTML = '';
        }
    }
    
    /**
     * Get current rendering status
     * @returns {Object} Current status information
     */
    getStatus() {
        return {
            isRendered: this.isRendered,
            hasAdaptor: this.currentAdaptor !== null,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Export rendered graph (placeholder for future implementation)
     * @returns {Object} Export information
     */
    exportGraph() {
        if (!this.isRendered) {
            throw new Error('No graph rendered to export');
        }
        
        return {
            message: 'Graph export functionality not yet implemented',
            timestamp: new Date().toISOString(),
            hasGraph: true
        };
    }
}
