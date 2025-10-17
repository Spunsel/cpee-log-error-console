/**
 * SVG Progressive Service
 * Handles progressive revelation of CPEE SVG graphs based on modification steps
 */

export class SVGProgressiveService {
    
    /**
     * Fetch SVG content from CPEE graph viewer
     * @param {number} processNumber - CPEE process number
     * @returns {Promise<string>} SVG content
     */
    static async fetchCPEESVG(processNumber) {
        try {
            // CPEE graph URL - we'll need to extract the SVG from the rendered page
            const graphUrl = `https://cpee.org/flow/graph.html?monitor=https://cpee.org/flow/engine/${processNumber}/`;
            
            // For now, we'll create a mock SVG based on CPEE styling
            // In a real implementation, this would fetch from CPEE
            console.log(`Would fetch SVG from: ${graphUrl}`);
            
            // Return a sample CPEE-style SVG for testing
            return this.generateSampleCPEESVG(processNumber);
            
        } catch (error) {
            console.error('Error fetching CPEE SVG:', error);
            throw new Error(`Failed to fetch SVG for process ${processNumber}: ${error.message}`);
        }
    }
    
    /**
     * Generate sample CPEE-style SVG for testing
     * @param {number} processNumber - Process number
     * @returns {string} Sample SVG content
     */
    static generateSampleCPEESVG(processNumber) {
        return `
<svg width="800" height="300" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
        </marker>
        <style>
            .cpee-node { cursor: pointer; }
            .cpee-node rect { fill: #e8e8e8; stroke: #c0c0c0; stroke-width: 1; }
            .cpee-node.start rect { fill: #5cb85c; stroke: #4cae4c; }
            .cpee-node.task rect { fill: #f0ad4e; stroke: #ec971f; }
            .cpee-node.end rect { fill: #d9534f; stroke: #d43f3a; }
            .cpee-node text { font-family: Arial, sans-serif; font-size: 11px; fill: #333; text-anchor: middle; }
            .cpee-edge { fill: none; stroke: #666; stroke-width: 1.5; marker-end: url(#arrowhead); }
            .hidden { opacity: 0; }
            .revealing { opacity: 0.3; }
            .visible { opacity: 1; }
        </style>
    </defs>
    
    <!-- Background -->
    <rect width="800" height="300" fill="#f8f9fa" />
    
    <!-- Process elements with step IDs -->
    
    <!-- Start node (always visible) -->
    <g class="cpee-node start visible" data-step="0" data-element-type="start">
        <rect x="50" y="130" width="60" height="40" rx="3" />
        <text x="80" y="155">Start</text>
    </g>
    
    <!-- Task A (step 1) -->
    <g class="cpee-node task hidden" data-step="1" data-element-type="task" data-task-name="Task A">
        <rect x="170" y="130" width="100" height="40" rx="3" />
        <text x="220" y="155">Task A</text>
    </g>
    
    <!-- Task B (step 2) -->
    <g class="cpee-node task hidden" data-step="2" data-element-type="task" data-task-name="Task B">
        <rect x="330" y="130" width="100" height="40" rx="3" />
        <text x="380" y="155">Task B</text>
    </g>
    
    <!-- Task C (step 3) -->
    <g class="cpee-node task hidden" data-step="3" data-element-type="task" data-task-name="Task C">
        <rect x="490" y="130" width="100" height="40" rx="3" />
        <text x="540" y="155">Task C</text>
    </g>
    
    <!-- End node (final step) -->
    <g class="cpee-node end hidden" data-step="4" data-element-type="end">
        <rect x="650" y="130" width="60" height="40" rx="3" />
        <text x="680" y="155">End</text>
    </g>
    
    <!-- Edges -->
    <line class="cpee-edge hidden" data-step="1" data-element-type="edge" x1="110" y1="150" x2="170" y2="150" />
    <line class="cpee-edge hidden" data-step="2" data-element-type="edge" x1="270" y1="150" x2="330" y2="150" />
    <line class="cpee-edge hidden" data-step="3" data-element-type="edge" x1="430" y1="150" x2="490" y2="150" />
    <line class="cpee-edge hidden" data-step="4" data-element-type="edge" x1="590" y1="150" x2="650" y2="150" />
    
    <!-- Step indicator -->
    <text x="400" y="30" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#2c3e50">
        Process ${processNumber} - Progressive View
    </text>
</svg>`;
    }
    
    /**
     * Parse SVG and extract progressive elements
     * @param {string} svgContent - SVG content
     * @returns {Object} Parsed progressive data
     */
    static parseSVGElements(svgContent) {
        try {
            // Create a temporary DOM element to parse SVG
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');
            
            if (!svgElement) {
                throw new Error('Invalid SVG content');
            }
            
            // Extract elements with step data
            const progressiveElements = [];
            const elementsWithSteps = svgElement.querySelectorAll('[data-step]');
            
            elementsWithSteps.forEach(element => {
                const stepNumber = parseInt(element.getAttribute('data-step'));
                const elementType = element.getAttribute('data-element-type');
                const taskName = element.getAttribute('data-task-name');
                
                progressiveElements.push({
                    stepNumber,
                    elementType,
                    taskName,
                    element: element.cloneNode(true),
                    id: element.id || `${elementType}_${stepNumber}`
                });
            });
            
            // Sort by step number
            progressiveElements.sort((a, b) => a.stepNumber - b.stepNumber);
            
            return {
                originalSVG: svgContent,
                maxSteps: Math.max(...progressiveElements.map(e => e.stepNumber)) + 1,
                elements: progressiveElements,
                svgElement: svgElement.cloneNode(true)
            };
            
        } catch (error) {
            console.error('Error parsing SVG:', error);
            throw new Error(`Failed to parse SVG: ${error.message}`);
        }
    }
    
    /**
     * Generate progressive SVG for a specific step
     * @param {Object} parsedData - Parsed SVG data
     * @param {number} currentStep - Current step (0-based)
     * @param {Array} userSteps - Array of user modification steps
     * @returns {string} Progressive SVG content
     */
    static generateProgressiveSVG(parsedData, currentStep, userSteps = []) {
        try {
            const svgClone = parsedData.svgElement.cloneNode(true);
            
            // Reset all elements to hidden first
            const allElements = svgClone.querySelectorAll('[data-step]');
            allElements.forEach(element => {
                element.classList.remove('visible', 'revealing', 'hidden');
                element.classList.add('hidden');
            });
            
            // Show elements up to current step
            for (let step = 0; step <= currentStep; step++) {
                const elementsForStep = svgClone.querySelectorAll(`[data-step="${step}"]`);
                elementsForStep.forEach(element => {
                    element.classList.remove('hidden', 'revealing');
                    
                    // Add revealing effect for current step
                    if (step === currentStep) {
                        element.classList.add('revealing');
                        // After a brief delay, make it fully visible
                        setTimeout(() => {
                            element.classList.remove('revealing');
                            element.classList.add('visible');
                        }, 300);
                    } else {
                        element.classList.add('visible');
                    }
                });
            }
            
            // Add step info text
            const stepInfo = userSteps[currentStep] || { userInput: `Step ${currentStep + 1}` };
            const stepText = svgClone.querySelector('text');
            if (stepText) {
                stepText.textContent = `Step ${currentStep + 1}: ${this.extractUserAction(stepInfo.userInput || stepInfo.content?.userInput)}`;
            }
            
            // Return the modified SVG as string
            return new XMLSerializer().serializeToString(svgClone);
            
        } catch (error) {
            console.error('Error generating progressive SVG:', error);
            return parsedData.originalSVG;
        }
    }
    
    /**
     * Extract user action from user input text
     * @param {string} userInput - Raw user input
     * @returns {string} Clean action description
     */
    static extractUserAction(userInput) {
        if (!userInput) return 'Unknown action';
        
        // Clean up the user input
        let action = userInput
            .replace(/# User Input:\s*/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .trim();
            
        // Take first line if multi-line
        const firstLine = action.split('\n')[0];
        
        // Limit length for display
        return firstLine.length > 30 ? firstLine.substring(0, 27) + '...' : firstLine;
    }
    
    /**
     * Create progressive viewer HTML with controls
     * @param {Object} parsedData - Parsed SVG data
     * @param {number} currentStep - Current step
     * @param {Array} userSteps - User modification steps
     * @returns {string} HTML content with progressive SVG
     */
    static createProgressiveViewerHTML(parsedData, currentStep, userSteps = []) {
        const progressiveSVG = this.generateProgressiveSVG(parsedData, currentStep, userSteps);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Progressive CPEE Graph Viewer</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f8f9fa;
        }
        
        .progressive-container {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .progressive-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .progressive-title {
            font-size: 1.2rem;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .progressive-controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .step-btn {
            padding: 8px 15px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
        }
        
        .step-btn:hover:not(:disabled) {
            background: #2980b9;
            transform: translateY(-1px);
        }
        
        .step-btn:disabled {
            background: #bdc3c7;
            cursor: not-allowed;
            transform: none;
        }
        
        .step-info {
            margin: 0 15px;
            font-weight: 500;
            color: #34495e;
        }
        
        .svg-container {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            background: white;
            overflow: hidden;
        }
        
        svg {
            width: 100%;
            height: auto;
            display: block;
        }
        
        /* Animation styles */
        .revealing {
            animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="progressive-container">
        <div class="progressive-header">
            <div class="progressive-title">📊 CPEE Process Evolution</div>
            <div class="progressive-controls">
                <button class="step-btn" onclick="previousStep()" ${currentStep === 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <div class="step-info">Step ${currentStep + 1} of ${parsedData.maxSteps}</div>
                <button class="step-btn" onclick="nextStep()" ${currentStep >= parsedData.maxSteps - 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
        </div>
        
        <div class="svg-container">
            ${progressiveSVG}
        </div>
    </div>
    
    <script>
        // These functions would be called by parent window
        window.previousStep = function() {
            window.parent.postMessage({type: 'previousStep'}, '*');
        };
        
        window.nextStep = function() {
            window.parent.postMessage({type: 'nextStep'}, '*');
        };
        
        // Auto-reveal animation for newly visible elements
        document.addEventListener('DOMContentLoaded', function() {
            const revealingElements = document.querySelectorAll('.revealing');
            revealingElements.forEach((element, index) => {
                setTimeout(() => {
                    element.classList.remove('revealing');
                    element.classList.add('visible');
                }, index * 100 + 300);
            });
        });
    </script>
</body>
</html>`;
    }
}
