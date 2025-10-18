/**
 * Step Viewer Component
 * Handles display of step content and navigation
 */

import { DOMUtils } from '../utils/DOMUtils.js';
import { CPEEWfAdaptorRenderer } from './CPEEWfAdaptorRenderer.js';
import { MermaidRenderer } from './MermaidRenderer.js';

export class StepViewer {
    constructor(instanceService) {
        this.instanceService = instanceService;
        this.onStepChange = null;
        this.inputGraphRenderer = null;
        this.outputGraphRenderer = null;
        this.inputMermaidRenderer = null;
        this.outputMermaidRenderer = null;
        this.currentGraphContainer = null;
    }

    /**
     * Set callback for when step changes
     * @param {Function} callback - Callback function
     */
    setOnStepChange(callback) {
        this.onStepChange = callback;
    }

    /**
     * Display step content
     * @param {CPEEStep} step - Step data
     * @param {Object} navInfo - Navigation info
     */
    async displayStep(step, navInfo) {
        if (!step) return;

        console.log(`Displaying ${step.getDisplayName()}`);

        // Show process analysis section
        DOMUtils.addClass('step-details', 'hidden');
        DOMUtils.removeClass('process-analysis', 'hidden');

        // Update step header
        const stepHeader = DOMUtils.querySelector('#process-analysis h2');
        if (stepHeader) {
            stepHeader.textContent = `${step.getDisplayName()} of ${navInfo.totalSteps}`;
        }

        // Update content sections using CPEEStep methods
        // For input CPEE tree, render as graph instead of raw XML
        await this.updateInputCpeeSection(step.getContent('inputCpeeTree'));
        await this.updateInputIntermediateSection(step.getContent('inputIntermediate'));
        this.updateUserInputSection(step.getContent('userInput'));
        await this.updateOutputIntermediateSection(step.getContent('outputIntermediate'));
        
        // Small delay to prevent renderer conflicts, then render output graph
        setTimeout(async () => {
            await this.updateOutputCpeeSection(step.getContent('outputCpeeTree'));
        }, 100);

        // Setup/update navigation
        this.setupStepNavigation();
        this.updateStepNavigation(navInfo);
    }

    /**
     * Show default state (no instance selected)
     */
    showDefaultState() {
        DOMUtils.removeClass('step-details', 'hidden');
        DOMUtils.addClass('process-analysis', 'hidden');
        
        // Remove navigation if exists
        const navContainer = DOMUtils.getElementById('step-navigation');
        if (navContainer) {
            navContainer.remove();
        }
    }

    /**
     * Setup step navigation UI
     */
    setupStepNavigation() {
        let navContainer = DOMUtils.getElementById('step-navigation');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'step-navigation';
            navContainer.className = 'step-navigation';
            navContainer.innerHTML = `
                <button id="prev-step" class="nav-btn">← Previous</button>
                <span id="step-counter">Step 1 of 1</span>
                <button id="next-step" class="nav-btn">Next →</button>
            `;
            
            // Insert before process analysis
            const processAnalysis = DOMUtils.getElementById('process-analysis');
            if (processAnalysis) {
                processAnalysis.parentNode.insertBefore(navContainer, processAnalysis);
            }
        }

        // Add event listeners
        const prevBtn = DOMUtils.getElementById('prev-step');
        const nextBtn = DOMUtils.getElementById('next-step');

        if (prevBtn) {
            prevBtn.onclick = () => this.previousStep();
        }
        if (nextBtn) {
            nextBtn.onclick = () => this.nextStep();
        }
    }

    /**
     * Update step navigation state
     * @param {Object} navInfo - Navigation info
     */
    updateStepNavigation(navInfo) {
        const prevBtn = DOMUtils.getElementById('prev-step');
        const nextBtn = DOMUtils.getElementById('next-step');
        const counter = DOMUtils.getElementById('step-counter');

        if (prevBtn) {
            prevBtn.disabled = !navInfo.canGoPrevious;
        }
        if (nextBtn) {
            nextBtn.disabled = !navInfo.canGoNext;
        }
        if (counter) {
            counter.textContent = `Step ${navInfo.currentStep} of ${navInfo.totalSteps}`;
        }
    }

    /**
     * Navigate to previous step
     */
    async previousStep() {
        if (this.instanceService.previousStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Navigate to next step
     */
    async nextStep() {
        if (this.instanceService.nextStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Update the Input CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     */
    async updateInputCpeeSection(cpeeXml) {
        const inputCpeeElement = DOMUtils.getElementById('input-cpee-content');
        if (!inputCpeeElement) return;

        // Check if we have valid CPEE XML
        if (!cpeeXml || cpeeXml === 'Not found' || cpeeXml === 'No content available') {
            // Store current height to prevent flickering
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            
            inputCpeeElement.innerHTML = '<div class="no-content">No CPEE tree available for this step</div>';
            
            // Reset height after content is set
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 50);
            return;
        }

        try {
            // Store current height to prevent flickering during transition
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            
            // Clear the existing content and create graph container
            inputCpeeElement.innerHTML = '';
            
            // Create unique IDs to avoid conflicts with main form
            const uniqueId = `step-${Date.now()}`;
            
            // Create a container for the graph
            const graphContainer = document.createElement('div');
            graphContainer.id = `${uniqueId}-graph-container`;
            graphContainer.style.cssText = `
                width: 100%;
                min-height: 100px;
                height: auto;
                border: none;
                border-radius: 0;
                background: white;
                position: relative;
                margin: 0;
                padding: 0;
            `;
            
            // Create elements that CPEE WfAdaptor expects for hover functionality
            
            const inputElement = document.createElement('textarea');
            inputElement.id = `${uniqueId}-input`;
            inputElement.style.cssText = 'display: none; pointer-events: none; position: absolute; left: -9999px;';
            inputElement.value = cpeeXml; // Provide the XML content
            inputElement.setAttribute('readonly', true); // Make it readonly to prevent interference
            
            // Create modelling container structure that WfAdaptor expects
            const modellingDiv = document.createElement('div');
            modellingDiv.id = `${uniqueId}-modelling`;
            modellingDiv.style.cssText = 'display: none;';
            
            inputCpeeElement.appendChild(inputElement);
            inputCpeeElement.appendChild(modellingDiv);
            inputCpeeElement.appendChild(graphContainer);
            
            // Initialize or reuse input graph renderer
            if (!this.inputGraphRenderer) {
                this.inputGraphRenderer = new CPEEWfAdaptorRenderer();
            }
            
            // Initialize the renderer with the container and required elements
            await this.inputGraphRenderer.initialize(`${uniqueId}-graph-container`, null, `${uniqueId}-input`);
            
            // Render the graph
            await this.inputGraphRenderer.renderGraph(cpeeXml);
            
            console.log('✅ CPEE graph rendered in step viewer');
            
            // Reset height to auto after graph is rendered to allow natural sizing
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 100);
            
        } catch (error) {
            console.error('❌ Failed to render CPEE graph in step viewer:', error);
            
            // Fallback to text display with error message
            inputCpeeElement.innerHTML = `
                <div class="graph-error">
                    <p><strong>Failed to render graph:</strong> ${error.message}</p>
                    <details>
                        <summary>Show raw XML content</summary>
                        <pre><code>${cpeeXml}</code></pre>
                    </details>
                </div>
            `;
            
            // Reset height after error content is set
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 50);
        }
    }

    /**
     * Update the Output CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     */
    async updateOutputCpeeSection(cpeeXml) {
        const outputCpeeElement = DOMUtils.getElementById('output-cpee-content');
        if (!outputCpeeElement) return;

        // Check if we have valid CPEE XML
        if (!cpeeXml || cpeeXml === 'Not found' || cpeeXml === 'No content available') {
            // Store current height to prevent flickering
            const currentHeight = outputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                outputCpeeElement.style.height = currentHeight + 'px';
            }
            
            outputCpeeElement.innerHTML = '<div class="no-content">No output CPEE tree available for this step</div>';
            
            // Reset height after content is set
            setTimeout(() => {
                outputCpeeElement.style.height = 'auto';
            }, 50);
            return;
        }

        try {
            // Store current height to prevent flickering during transition
            const currentHeight = outputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                outputCpeeElement.style.height = currentHeight + 'px';
            }
            
            // Clear the existing content and create graph container
            outputCpeeElement.innerHTML = '';
            
            // Create unique IDs to avoid conflicts with input graph and main form
            const uniqueId = `output-step-${Date.now()}`;
            
            // Create a container for the output graph
            const graphContainer = document.createElement('div');
            graphContainer.id = `${uniqueId}-graph-container`;
            graphContainer.style.cssText = `
                width: 100%;
                min-height: 100px;
                height: auto;
                border: none;
                border-radius: 0;
                background: white;
                position: relative;
                margin: 0;
                padding: 0;
            `;
            
            // Create elements that CPEE WfAdaptor expects for hover functionality
            
            const inputElement = document.createElement('textarea');
            inputElement.id = `${uniqueId}-input`;
            inputElement.style.cssText = 'display: none; pointer-events: none; position: absolute; left: -9999px;';
            inputElement.value = cpeeXml; // Provide the XML content
            inputElement.setAttribute('readonly', true); // Make it readonly to prevent interference
            
            // Create modelling container structure that WfAdaptor expects
            const modellingDiv = document.createElement('div');
            modellingDiv.id = `${uniqueId}-modelling`;
            modellingDiv.style.cssText = 'display: none;';
            
            outputCpeeElement.appendChild(inputElement);
            outputCpeeElement.appendChild(modellingDiv);
            outputCpeeElement.appendChild(graphContainer);
            
            // Initialize or reuse output graph renderer
            if (!this.outputGraphRenderer) {
                this.outputGraphRenderer = new CPEEWfAdaptorRenderer();
            }
            
            // Initialize the renderer with the container and required elements
            await this.outputGraphRenderer.initialize(`${uniqueId}-graph-container`, null, `${uniqueId}-input`);
            
            // Render the graph
            await this.outputGraphRenderer.renderGraph(cpeeXml);
            
            console.log('✅ Output CPEE graph rendered in step viewer');
            
            // Reset height to auto after graph is rendered to allow natural sizing
            setTimeout(() => {
                outputCpeeElement.style.height = 'auto';
            }, 100);
            
        } catch (error) {
            console.error('❌ Failed to render output CPEE graph in step viewer:', error);
            
            // Fallback to text display with error message
            outputCpeeElement.innerHTML = `
                <div class="graph-error">
                    <p><strong>Failed to render output graph:</strong> ${error.message}</p>
                    <details>
                        <summary>Show raw XML content</summary>
                        <pre><code>${cpeeXml}</code></pre>
                    </details>
                </div>
            `;
            
            // Reset height after error content is set
            setTimeout(() => {
                outputCpeeElement.style.height = 'auto';
            }, 50);
        }
    }

    /**
     * Update the Input Intermediate section with Mermaid graph or raw content
     * @param {string} content - Content from the log (may contain Mermaid syntax)
     */
    async updateInputIntermediateSection(content) {
        const inputIntermediateElement = DOMUtils.getElementById('input-intermediate-content');
        if (!inputIntermediateElement) return;

        // Check if content is just a comment header without actual content
        if (this.isOnlyCommentHeader(content)) {
            inputIntermediateElement.innerHTML = '<div class="no-content">Empty Mermaid graph</div>';
            // Reset height to auto for no-content case
            inputIntermediateElement.style.height = 'auto';
            inputIntermediateElement.style.minHeight = 'auto';
            return;
        }

        // Check if content contains Mermaid syntax
        if (this.containsMermaidSyntax(content)) {
            try {
                // Store current height to prevent flickering
                const currentHeight = inputIntermediateElement.offsetHeight;
                if (currentHeight > 100) {
                    inputIntermediateElement.style.height = currentHeight + 'px';
                }
                
                // Clear existing content and create graph container
                inputIntermediateElement.innerHTML = '';
                
                // Create unique IDs for this intermediate graph
                const uniqueId = `input-intermediate-${Date.now()}`;
                
                // Create container for the Mermaid graph
                const graphContainer = document.createElement('div');
                graphContainer.id = `${uniqueId}-graph-container`;
                graphContainer.style.cssText = `
                    width: 100%;
                    min-height: 100px;
                    height: auto;
                    border: none;
                    border-radius: 0;
                    background: white;
                    position: relative;
                    margin: 0;
                    padding: 0;
                `;
                
                inputIntermediateElement.appendChild(graphContainer);
                
                // Initialize or reuse input mermaid renderer
                if (!this.inputMermaidRenderer) {
                    this.inputMermaidRenderer = new MermaidRenderer();
                }
                
                // Initialize the renderer with the container
                await this.inputMermaidRenderer.initialize(`${uniqueId}-graph-container`);
                
                // Extract Mermaid code and render
                const mermaidCode = this.extractMermaidCode(content);
                await this.inputMermaidRenderer.renderGraph(mermaidCode);
                
                console.log('✅ Input intermediate Mermaid graph rendered');
                
                // Reset height to auto after graph is rendered
                setTimeout(() => {
                    inputIntermediateElement.style.height = 'auto';
                }, 100);
                
            } catch (error) {
                console.error('❌ Error rendering input intermediate Mermaid:', error);
                // Fallback to raw content display
                this.updateSectionContent('input-intermediate-content', content);
            }
        } else {
            // Display as regular text content
            this.updateSectionContent('input-intermediate-content', content);
        }
    }

    /**
     * Update the Output Intermediate section with Mermaid graph or raw content
     * @param {string} content - Content from the log (may contain Mermaid syntax)
     */
    async updateOutputIntermediateSection(content) {
        const outputIntermediateElement = DOMUtils.getElementById('output-intermediate-content');
        if (!outputIntermediateElement) return;

        // Check if content is just a comment header without actual content
        if (this.isOnlyCommentHeader(content)) {
            outputIntermediateElement.innerHTML = '<div class="no-content">Empty Mermaid graph</div>';
            // Reset height to auto for no-content case
            outputIntermediateElement.style.height = 'auto';
            outputIntermediateElement.style.minHeight = 'auto';
            return;
        }

        // Check if content contains Mermaid syntax
        if (this.containsMermaidSyntax(content)) {
            try {
                // Store current height to prevent flickering
                const currentHeight = outputIntermediateElement.offsetHeight;
                if (currentHeight > 100) {
                    outputIntermediateElement.style.height = currentHeight + 'px';
                }
                
                // Clear existing content and create graph container
                outputIntermediateElement.innerHTML = '';
                
                // Create unique IDs for this intermediate graph
                const uniqueId = `output-intermediate-${Date.now()}`;
                
                // Create container for the Mermaid graph
                const graphContainer = document.createElement('div');
                graphContainer.id = `${uniqueId}-graph-container`;
                graphContainer.style.cssText = `
                    width: 100%;
                    min-height: 100px;
                    height: auto;
                    border: none;
                    border-radius: 0;
                    background: white;
                    position: relative;
                    margin: 0;
                    padding: 0;
                `;
                
                outputIntermediateElement.appendChild(graphContainer);
                
                // Initialize or reuse output mermaid renderer
                if (!this.outputMermaidRenderer) {
                    this.outputMermaidRenderer = new MermaidRenderer();
                }
                
                // Initialize the renderer with the container
                await this.outputMermaidRenderer.initialize(`${uniqueId}-graph-container`);
                
                // Extract Mermaid code and render
                const mermaidCode = this.extractMermaidCode(content);
                await this.outputMermaidRenderer.renderGraph(mermaidCode);
                
                console.log('✅ Output intermediate Mermaid graph rendered');
                
                // Reset height to auto after graph is rendered
                setTimeout(() => {
                    outputIntermediateElement.style.height = 'auto';
                }, 100);
                
            } catch (error) {
                console.error('❌ Error rendering output intermediate Mermaid:', error);
                // Fallback to raw content display
                this.updateSectionContent('output-intermediate-content', content);
            }
        } else {
            // Display as regular text content
            this.updateSectionContent('output-intermediate-content', content);
        }
    }

    /**
     * Check if content contains Mermaid diagram syntax
     * @param {string} content - Content to check
     * @returns {boolean} True if content contains Mermaid syntax
     */
    containsMermaidSyntax(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        const mermaidTypes = [
            'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
            'stateDiagram', 'erDiagram', 'gantt', 'pie', 'journey',
            'gitgraph', 'mindmap', 'timeline'
        ];

        return mermaidTypes.some(type => 
            content.toLowerCase().includes(type.toLowerCase())
        );
    }

    /**
     * Extract Mermaid code from content (removes CPEE-style comment headers)
     * @param {string} content - Raw content from logs
     * @returns {string} Clean Mermaid code
     */
    extractMermaidCode(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // Remove CPEE-style comment headers like "%% Input Intermediate" or "%% Output Intermediate"
        let cleanedCode = content.replace(/^\s*%%.*$/gm, '').trim();
        
        // Remove any other comment patterns that might interfere
        cleanedCode = cleanedCode.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        return cleanedCode;
    }

    /**
     * Update the User Input section with clean text (removes log formatting)
     * @param {string} content - Raw user input content from logs
     */
    updateUserInputSection(content) {
        const userInputElement = DOMUtils.getElementById('user-input-content');
        if (!userInputElement) return;

        // Check if there's valid user input content
        if (!content || content === 'Not found' || content === 'No content available') {
            const codeElement = userInputElement.querySelector('code');
            if (codeElement) {
                codeElement.textContent = 'No user input available';
            } else {
                userInputElement.textContent = 'No user input available';
            }
            return;
        }

        try {
            // Extract clean user input text
            const cleanText = this.extractUserInputText(content);
            
            // Update the content with clean text
            const codeElement = userInputElement.querySelector('code');
            if (codeElement) {
                codeElement.textContent = cleanText || 'No user input available';
            } else {
                userInputElement.textContent = cleanText || 'No user input available';
            }
            
        } catch (error) {
            console.error('❌ Error processing user input:', error);
            // Fallback to raw content display
            this.updateSectionContent('user-input-content', content);
        }
    }

    /**
     * Extract clean user input text from raw log content
     * @param {string} content - Raw content from logs
     * @returns {string} Clean user input text
     */
    extractUserInputText(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // Remove the "# User Input:" header and get the content after it
        let cleanedText = content.replace(/^#\s*User\s*Input\s*:\s*/i, '').trim();
        
        // Remove any additional comment patterns
        cleanedText = cleanedText.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any markdown-style formatting if present
        cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '').trim();
        
        // Clean up extra whitespace and normalize line endings
        cleanedText = cleanedText.replace(/\r\n/g, '\n');
        cleanedText = cleanedText.replace(/\n\s*\n/g, '\n');
        
        return cleanedText;
    }

    /**
     * Check if content is only a comment header without actual content
     * @param {string} content - Content to check
     * @returns {boolean} True if content is only a comment header
     */
    isOnlyCommentHeader(content) {
        if (!content || typeof content !== 'string') {
            return true;
        }

        // Remove CPEE-style comment headers and whitespace
        const cleanedContent = content.replace(/^\s*%%.*$/gm, '').trim();
        
        // If nothing remains after removing comment headers, it's only a header
        return cleanedContent.length === 0;
    }

    /**
     * Update content in a section
     * @param {string} elementId - Element ID
     * @param {string} content - Content to display
     */
    updateSectionContent(elementId, content) {
        const element = DOMUtils.getElementById(elementId);
        if (element) {
            const codeElement = element.querySelector('code');
            if (codeElement) {
                codeElement.textContent = content || 'No content available';
            } else {
                element.textContent = content || 'No content available';
            }
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        DOMUtils.removeClass('process-analysis', 'hidden');
        DOMUtils.addClass('step-details', 'hidden');

        // Show loading in all sections
        const inputCpeeElement = DOMUtils.getElementById('input-cpee-content');
        if (inputCpeeElement) {
            // Store current height to prevent flickering during loading
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            inputCpeeElement.innerHTML = '<div class="loading-graph">Loading input graph...</div>';
        }
        
        const outputCpeeElement = DOMUtils.getElementById('output-cpee-content');
        if (outputCpeeElement) {
            // Store current height to prevent flickering during loading
            const currentHeight = outputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                outputCpeeElement.style.height = currentHeight + 'px';
            }
            outputCpeeElement.innerHTML = '<div class="loading-graph">Loading output graph...</div>';
        }
        
        // Show loading for intermediate sections (will be handled by their specific methods)
        const inputIntermediateElement = DOMUtils.getElementById('input-intermediate-content');
        if (inputIntermediateElement) {
            inputIntermediateElement.innerHTML = '<div class="no-content">Loading...</div>';
        }
        
        const userInputElement = DOMUtils.getElementById('user-input-content');
        if (userInputElement) {
            const codeElement = userInputElement.querySelector('code');
            if (codeElement) {
                codeElement.textContent = 'Loading...';
            } else {
                userInputElement.textContent = 'Loading...';
            }
        }
        
        const outputIntermediateElement = DOMUtils.getElementById('output-intermediate-content');
        if (outputIntermediateElement) {
            outputIntermediateElement.innerHTML = '<div class="no-content">Loading...</div>';
        }
    }

    /**
     * Show error state
     * @param {string} message - Error message
     */
    showError(message) {
        DOMUtils.removeClass('process-analysis', 'hidden');
        DOMUtils.addClass('step-details', 'hidden');

        const inputCpeeElement = DOMUtils.getElementById('input-cpee-content');
        if (inputCpeeElement) {
            // Store current height to prevent flickering during error display
            const currentHeight = inputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                inputCpeeElement.style.height = currentHeight + 'px';
            }
            inputCpeeElement.innerHTML = `<div class="error-message">Input Error: ${message}</div>`;
            
            // Reset height after error content is set
            setTimeout(() => {
                inputCpeeElement.style.height = 'auto';
            }, 50);
        }
        
        const outputCpeeElement = DOMUtils.getElementById('output-cpee-content');
        if (outputCpeeElement) {
            // Store current height to prevent flickering during error display
            const currentHeight = outputCpeeElement.offsetHeight;
            if (currentHeight > 100) {
                outputCpeeElement.style.height = currentHeight + 'px';
            }
            outputCpeeElement.innerHTML = `<div class="error-message">Output Error: ${message}</div>`;
            
            // Reset height after error content is set
            setTimeout(() => {
                outputCpeeElement.style.height = 'auto';
            }, 50);
        }
        
        // Clear intermediate sections (will be handled by their specific methods)
        const inputIntermediateElement = DOMUtils.getElementById('input-intermediate-content');
        if (inputIntermediateElement) {
            inputIntermediateElement.innerHTML = '';
        }
        
        const userInputElement = DOMUtils.getElementById('user-input-content');
        if (userInputElement) {
            const codeElement = userInputElement.querySelector('code');
            if (codeElement) {
                codeElement.textContent = '';
            } else {
                userInputElement.textContent = '';
            }
        }
        
        const outputIntermediateElement = DOMUtils.getElementById('output-intermediate-content');
        if (outputIntermediateElement) {
            outputIntermediateElement.innerHTML = '';
        }
    }
}
