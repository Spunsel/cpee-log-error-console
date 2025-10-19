/**
 * Step Viewer Component
 * Handles display of step content and navigation
 */

import { DOMUtils } from '../utils/DOMUtils.js';
import { CPEEWfAdaptorRenderer } from './CPEEWfAdaptorRenderer.js';
import { MermaidRenderer } from './MermaidRenderer.js';

export class StepViewer {
    constructor(instanceService, domRegistry = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.onStepChange = null;
        this.inputGraphRenderer = null;
        this.outputGraphRenderer = null;
        this.inputMermaidRenderer = null;
        this.outputMermaidRenderer = null;
        this.currentGraphContainer = null;
    }

    /**
     * Get DOM element by key with fallback to direct ID access for backward compatibility
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (this.domRegistry) {
            return this.domRegistry.getElementSafe(key);
        }
        // Fallback to direct DOM access for backward compatibility
        return DOMUtils.getElementById(key);
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
        const processAnalysis = this.getElement('processAnalysis');
        if (processAnalysis) {
            const stepHeader = processAnalysis.querySelector('h2');
            if (stepHeader) {
                stepHeader.textContent = `${step.getDisplayName()} of ${navInfo.totalSteps}`;
            }
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
        
        // Remove navigation if exists (check DOM directly since it may not be registered yet)
        const navContainer = document.getElementById('step-navigation');
        if (navContainer) {
            navContainer.remove();
        }
    }

    /**
     * Setup step navigation UI
     */
    setupStepNavigation() {
        // Check DOM directly first since element may not be registered yet
        let navContainer = document.getElementById('step-navigation');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'step-navigation';
            navContainer.className = 'step-navigation';
            navContainer.innerHTML = `
                <div class="nav-left">
                    <button id="go-to-start" class="nav-btn nav-btn-start">⏮</button>
                </div>
                <div class="nav-center">
                    <button id="prev-step" class="nav-btn nav-btn-prev">←</button>
                    <span id="step-counter">Step 1 of 1</span>
                    <button id="next-step" class="nav-btn nav-btn-next">→</button>
                </div>
                <div class="nav-right">
                    <button id="go-to-end" class="nav-btn nav-btn-end">⏭</button>
                </div>
            `;
            
            // Add CSS for the new navigation layout
            navContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                margin: 10px 0;
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            // Style navigation sections
            const navLeft = navContainer.querySelector('.nav-left');
            const navCenter = navContainer.querySelector('.nav-center');
            const navRight = navContainer.querySelector('.nav-right');
            
            if (navLeft) navLeft.style.cssText = 'flex: 1; display: flex; justify-content: flex-start;';
            if (navCenter) navCenter.style.cssText = 'flex: 2; display: flex; justify-content: center; align-items: center; gap: 15px;';
            if (navRight) navRight.style.cssText = 'flex: 1; display: flex; justify-content: flex-end;';
            
            // Insert before process analysis
            const processAnalysis = this.getElement('processAnalysis');
            if (processAnalysis) {
                processAnalysis.parentNode.insertBefore(navContainer, processAnalysis);
            }
            
            // Register new DOM elements if DOMRegistry is available
            if (this.domRegistry) {
                this.domRegistry.register('stepNavigation', 'step-navigation');
                this.domRegistry.register('goToStartBtn', 'go-to-start');
                this.domRegistry.register('prevStepBtn', 'prev-step');
                this.domRegistry.register('nextStepBtn', 'next-step');
                this.domRegistry.register('goToEndBtn', 'go-to-end');
                this.domRegistry.register('stepCounter', 'step-counter');
                
                // Also register with the old key names for backward compatibility
                this.domRegistry.register('prevStep', 'prev-step');
                this.domRegistry.register('nextStep', 'next-step');
            }
        }

        // Add event listeners for all navigation buttons
        const goToStartBtn = this.getElement('goToStartBtn') || document.getElementById('go-to-start');
        const prevBtn = this.getElement('prevStepBtn') || document.getElementById('prev-step');
        const nextBtn = this.getElement('nextStepBtn') || document.getElementById('next-step');
        const goToEndBtn = this.getElement('goToEndBtn') || document.getElementById('go-to-end');

        if (goToStartBtn) {
            goToStartBtn.onclick = () => this.goToStart();
        }
        if (prevBtn) {
            prevBtn.onclick = () => this.previousStep();
        }
        if (nextBtn) {
            nextBtn.onclick = () => this.nextStep();
        }
        if (goToEndBtn) {
            goToEndBtn.onclick = () => this.goToEnd();
        }
    }

    /**
     * Update step navigation state
     * @param {Object} navInfo - Navigation info
     */
    updateStepNavigation(navInfo) {
        const goToStartBtn = this.getElement('goToStartBtn') || document.getElementById('go-to-start');
        const prevBtn = this.getElement('prevStepBtn') || document.getElementById('prev-step');
        const nextBtn = this.getElement('nextStepBtn') || document.getElementById('next-step');
        const goToEndBtn = this.getElement('goToEndBtn') || document.getElementById('go-to-end');
        const counter = this.getElement('stepCounter') || document.getElementById('step-counter');

        // Determine disable states
        const isFirstStep = !navInfo.canGoPrevious;
        const isLastStep = !navInfo.canGoNext;

        // Update button states and apply styling
        if (goToStartBtn) {
            goToStartBtn.disabled = isFirstStep;
            this.applyDisabledStyling(goToStartBtn, isFirstStep);
        }
        if (prevBtn) {
            prevBtn.disabled = isFirstStep;
            this.applyDisabledStyling(prevBtn, isFirstStep);
        }
        if (nextBtn) {
            nextBtn.disabled = isLastStep;
            this.applyDisabledStyling(nextBtn, isLastStep);
        }
        if (goToEndBtn) {
            goToEndBtn.disabled = isLastStep;
            this.applyDisabledStyling(goToEndBtn, isLastStep);
        }
        if (counter) {
            counter.textContent = `Step ${navInfo.currentStep} of ${navInfo.totalSteps}`;
        }
    }

    /**
     * Apply disabled styling to navigation buttons
     * @param {HTMLElement} button - Button element
     * @param {boolean} isDisabled - Whether button should appear disabled
     */
    applyDisabledStyling(button, isDisabled) {
        if (!button) return;

        if (isDisabled) {
            button.style.cssText += `
                opacity: 0.5;
                color: #6c757d;
                background-color: #e9ecef;
                border-color: #d6d9dc;
                cursor: not-allowed;
                pointer-events: none;
            `;
        } else {
            // Reset to default styling
            button.style.cssText = button.style.cssText.replace(/opacity:[^;]*;?/g, '')
                                                       .replace(/color:[^;]*;?/g, '')
                                                       .replace(/background-color:[^;]*;?/g, '')
                                                       .replace(/border-color:[^;]*;?/g, '')
                                                       .replace(/cursor:[^;]*;?/g, '')
                                                       .replace(/pointer-events:[^;]*;?/g, '');
            button.style.opacity = '';
            button.style.cursor = 'pointer';
            button.style.pointerEvents = 'auto';
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
     * Navigate to first step
     */
    async goToStart() {
        if (this.instanceService.goToFirstStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Navigate to last step
     */
    async goToEnd() {
        if (this.instanceService.goToLastStep()) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.displayStep(step, navInfo);
            
            if (this.onStepChange) {
                this.onStepChange(this.instanceService.currentStepIndex);
            }
        }
    }

    /**
     * Preserve container height and hide overflow during transitions
     * @param {HTMLElement} element - The container element
     * @returns {function} - Cleanup function to restore normal state
     */
    preserveHeightDuringTransition(element) {
        // Store current height to prevent bouncing
        const currentHeight = element.offsetHeight;
        const contentBox = element.closest('.content-box') || element;
        
        // Add transitioning class to hide overflow
        contentBox.classList.add('transitioning');
        
        // Preserve height only if it's significant
        if (currentHeight > 100) {
            element.style.height = currentHeight + 'px';
        }
        
        // Return cleanup function
        return () => {
            setTimeout(() => {
                element.style.height = 'auto';
                contentBox.classList.remove('transitioning');
            }, 100);
        };
    }

    /**
     * Update the Input CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     */
    async updateInputCpeeSection(cpeeXml) {
        const inputCpeeElement = this.getElement('inputCpeeContent');
        if (!inputCpeeElement) return;

        // Check if we have valid CPEE XML
        if (!cpeeXml || cpeeXml === 'Not found' || cpeeXml === 'No content available') {
            // No transition effects needed - input section has fixed height
            inputCpeeElement.innerHTML = '<div class="no-content">No CPEE tree available for this step</div>';
            return;
        }

        try {
            // No transition effects needed - input section has fixed height
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
        }
    }

    /**
     * Update the Output CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     */
    async updateOutputCpeeSection(cpeeXml) {
        const outputCpeeElement = this.getElement('outputCpeeContent');
        if (!outputCpeeElement) return;

        // Check if we have valid CPEE XML
        if (!cpeeXml || cpeeXml === 'Not found' || cpeeXml === 'No content available') {
            // Preserve height and hide overflow during transition
            const cleanup = this.preserveHeightDuringTransition(outputCpeeElement);
            
            outputCpeeElement.innerHTML = '<div class="no-content">No output CPEE tree available for this step</div>';
            
            // Restore normal state
            cleanup();
            return;
        }

        try {
            // Preserve height and hide overflow during transition
            const cleanup = this.preserveHeightDuringTransition(outputCpeeElement);
            
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
            
            // Restore normal state after graph is rendered
            cleanup();
            
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
            
            // Restore normal state after error content is set
            cleanup();
        }
    }

    /**
     * Update the Input Intermediate section with Mermaid graph or raw content
     * @param {string} content - Content from the log (may contain Mermaid syntax)
     */
    async updateInputIntermediateSection(content) {
        const inputIntermediateElement = this.getElement('inputIntermediateContent');
        if (!inputIntermediateElement) return;

        // Check if content is just a comment header without actual content
        if (this.isOnlyCommentHeader(content)) {
            // Preserve height and hide overflow during transition
            const cleanup = this.preserveHeightDuringTransition(inputIntermediateElement);
            
            inputIntermediateElement.innerHTML = '<div class="no-content">Empty Mermaid graph</div>';
            
            // Restore normal state
            cleanup();
            return;
        }

        // Check if content contains Mermaid syntax
        if (this.containsMermaidSyntax(content)) {
            try {
                // Preserve height and hide overflow during transition
                const cleanup = this.preserveHeightDuringTransition(inputIntermediateElement);
                
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
                
                // Restore normal state after graph is rendered
                cleanup();
                
            } catch (error) {
                console.error('❌ Error rendering input intermediate Mermaid:', error);
                // Fallback to raw content display
                this.updateSectionContent('input-intermediate-content', content);
                // Restore normal state after error
                cleanup();
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
        const outputIntermediateElement = this.getElement('outputIntermediateContent');
        if (!outputIntermediateElement) return;

        // Check if content is just a comment header without actual content
        if (this.isOnlyCommentHeader(content)) {
            // Preserve height and hide overflow during transition
            const cleanup = this.preserveHeightDuringTransition(outputIntermediateElement);
            
            outputIntermediateElement.innerHTML = '<div class="no-content">Empty Mermaid graph</div>';
            
            // Restore normal state
            cleanup();
            return;
        }

        // Check if content contains Mermaid syntax
        if (this.containsMermaidSyntax(content)) {
            try {
                // Preserve height and hide overflow during transition
                const cleanup = this.preserveHeightDuringTransition(outputIntermediateElement);
                
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
                
                // Restore normal state after graph is rendered
                cleanup();
                
            } catch (error) {
                console.error('❌ Error rendering output intermediate Mermaid:', error);
                // Fallback to raw content display
                this.updateSectionContent('output-intermediate-content', content);
                // Restore normal state after error
                cleanup();
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
        const userInputElement = this.getElement('userInputContent');
        if (!userInputElement) return;

        // Add class to parent content-box to identify user input section
        const contentBox = userInputElement.closest('.content-box');
        if (contentBox) {
            contentBox.classList.add('user-input-content-box');
        }

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
        const inputCpeeElement = this.getElement('inputCpeeContent');
        if (inputCpeeElement) {
            // No transition effects needed - input section has fixed height
            inputCpeeElement.innerHTML = '<div class="loading-graph">Loading input graph...</div>';
        }
        
        const outputCpeeElement = this.getElement('outputCpeeContent');
        if (outputCpeeElement) {
            // Preserve height and hide overflow during loading
            this.preserveHeightDuringTransition(outputCpeeElement);
            outputCpeeElement.innerHTML = '<div class="loading-graph">Loading output graph...</div>';
        }
        
        // Show loading for intermediate sections (will be handled by their specific methods)
        const inputIntermediateElement = this.getElement('inputIntermediateContent');
        if (inputIntermediateElement) {
            inputIntermediateElement.innerHTML = '<div class="no-content">Loading...</div>';
        }
        
        const userInputElement = this.getElement('userInputContent');
        if (userInputElement) {
            const codeElement = userInputElement.querySelector('code');
            if (codeElement) {
                codeElement.textContent = 'Loading...';
            } else {
                userInputElement.textContent = 'Loading...';
            }
        }
        
        const outputIntermediateElement = this.getElement('outputIntermediateContent');
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

        const inputCpeeElement = this.getElement('inputCpeeContent');
        if (inputCpeeElement) {
            // No transition effects needed - input section has fixed height
            inputCpeeElement.innerHTML = `<div class="error-message">Input Error: ${message}</div>`;
        }
        
        const outputCpeeElement = this.getElement('outputCpeeContent');
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
        const inputIntermediateElement = this.getElement('inputIntermediateContent');
        if (inputIntermediateElement) {
            inputIntermediateElement.innerHTML = '';
        }
        
        const userInputElement = this.getElement('userInputContent');
        if (userInputElement) {
            const codeElement = userInputElement.querySelector('code');
            if (codeElement) {
                codeElement.textContent = '';
            } else {
                userInputElement.textContent = '';
            }
        }
        
        const outputIntermediateElement = this.getElement('outputIntermediateContent');
        if (outputIntermediateElement) {
            outputIntermediateElement.innerHTML = '';
        }
    }
}
