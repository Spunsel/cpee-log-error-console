/**
 * Progressive Graph Service
 * Handles step-by-step visualization of CPEE process evolution
 */

export class ProgressiveGraphService {
    
    /**
     * Generate progressive graph data from all steps
     * @param {Array} steps - Array of step data
     * @returns {Array} Array of progressive graph states
     */
    static generateProgressiveStates(steps) {
        const progressiveStates = [];
        
        for (let i = 0; i < steps.length; i++) {
            const currentStep = steps[i];
            
            // Each step represents the state after this modification
            const state = {
                stepNumber: i + 1,
                title: `Step ${i + 1}: After "${this.extractUserAction(currentStep.content.userInput)}"`,
                cpeeXml: currentStep.content.outputCpeeTree,
                userAction: currentStep.content.userInput,
                mermaidGraph: currentStep.content.outputIntermediate,
                timestamp: currentStep.timestamp
            };
            
            progressiveStates.push(state);
        }
        
        return progressiveStates;
    }
    
    /**
     * Extract a clean user action description from user input
     * @param {string} userInput - Raw user input content
     * @returns {string} Clean action description
     */
    static extractUserAction(userInput) {
        if (!userInput) return 'Unknown action';
        
        // Remove markdown headers and cleanup
        let action = userInput
            .replace(/# User Input:\s*/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .trim();
            
        // Take first line if multi-line
        const firstLine = action.split('\n')[0];
        
        // Limit length for display
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
    }
    
    /**
     * Generate iframe URL for CPEE XML visualization
     * This is a workaround since we can't easily create temporary CPEE instances
     * We'll use a data URL approach for testing
     * @param {string} cpeeXml - CPEE XML content
     * @param {number} stepNumber - Step number for identification
     * @returns {string} URL for iframe visualization
     */
    static generateVisualizationURL(cpeeXml, stepNumber) {
        // For now, we'll create a simple HTML page that shows the XML
        // In a real implementation, this could use a CPEE XML renderer
        const htmlContent = this.createXMLVisualizationHTML(cpeeXml, stepNumber);
        
        // Create a data URL for the iframe
        return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    }
    
    /**
     * Create HTML content for XML visualization
     * @param {string} cpeeXml - CPEE XML content
     * @param {number} stepNumber - Step number
     * @returns {string} HTML content
     */
    static createXMLVisualizationHTML(cpeeXml, stepNumber) {
        // Parse CPEE XML to extract tasks for simple visualization
        const tasks = this.extractTasksFromXML(cpeeXml);
        const diagram = this.generateSimpleDiagram(tasks, stepNumber);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>CPEE Process - Step ${stepNumber}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            background: #f8f9fa;
        }
        .process-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .process-title {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.2em;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
        }
        .process-diagram {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
            justify-content: center;
            margin: 20px 0;
        }
        .node {
            padding: 12px 20px;
            border-radius: 25px;
            border: 2px solid #dee2e6;
            background: #f8f9fa;
            font-size: 14px;
            font-weight: 500;
            min-width: 80px;
            text-align: center;
            transition: all 0.2s ease;
        }
        .node.start {
            background: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
        }
        .node.task {
            background: #cce5ff;
            border-color: #99d6ff;
            color: #0056b3;
        }
        .node.end {
            background: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
        }
        .arrow {
            font-size: 18px;
            color: #6c757d;
            font-weight: bold;
        }
        .xml-section {
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .xml-title {
            font-weight: 600;
            color: #495057;
            margin-bottom: 10px;
        }
        .xml-content {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            color: #6c757d;
            max-height: 200px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="process-container">
        <div class="process-title">
            🔄 CPEE Process Evolution - Step ${stepNumber}
        </div>
        
        <div class="process-diagram">
            ${diagram}
        </div>
        
        <div class="xml-section">
            <div class="xml-title">📋 CPEE XML Definition:</div>
            <div class="xml-content">${this.escapeHtml(cpeeXml)}</div>
        </div>
    </div>
</body>
</html>`;
    }
    
    /**
     * Extract tasks from CPEE XML
     * @param {string} xml - CPEE XML content  
     * @returns {Array} Array of task objects
     */
    static extractTasksFromXML(xml) {
        if (!xml) return [];
        
        const tasks = [];
        
        try {
            // Simple regex-based parsing for labels
            const labelMatches = xml.match(/<label>([^<]+)<\/label>/g);
            if (labelMatches) {
                labelMatches.forEach(match => {
                    const label = match.replace(/<\/?label>/g, '');
                    if (label && label.trim()) {
                        tasks.push({
                            type: 'task',
                            label: label.trim()
                        });
                    }
                });
            }
        } catch (error) {
            console.warn('Error parsing CPEE XML:', error);
        }
        
        return tasks;
    }
    
    /**
     * Generate simple diagram HTML
     * @param {Array} tasks - Array of tasks
     * @param {number} stepNumber - Step number
     * @returns {string} HTML for diagram
     */
    static generateSimpleDiagram(tasks, stepNumber) {
        let diagram = '<div class="node start">🟢 Start</div>';
        
        tasks.forEach((task, index) => {
            diagram += '<div class="arrow">→</div>';
            diagram += `<div class="node task">⚙️ ${task.label}</div>`;
        });
        
        diagram += '<div class="arrow">→</div>';
        diagram += '<div class="node end">🔴 End</div>';
        
        return diagram;
    }
    
    /**
     * Escape HTML content
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Get step count and navigation info
     * @param {Array} progressiveStates - Progressive states array
     * @param {number} currentIndex - Current step index
     * @returns {Object} Navigation information
     */
    static getNavigationInfo(progressiveStates, currentIndex) {
        return {
            totalSteps: progressiveStates.length,
            currentStep: currentIndex + 1,
            canGoPrevious: currentIndex > 0,
            canGoNext: currentIndex < progressiveStates.length - 1,
            hasSteps: progressiveStates.length > 0
        };
    }
}
