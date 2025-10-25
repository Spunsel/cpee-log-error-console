/**
 * Content Section Manager
 * Handles visual content rendering only
 * Responsibilities:
 * - CPEE graph rendering and management
 * - Mermaid diagram rendering and management
 * - Visual content DOM updates
 * - Renderer lifecycle management
 * - Visual content error handling
 */

import { CPEEWfAdaptorRenderer } from '../renderers/CPEEWfAdaptorRenderer.js';
import { MermaidRenderer } from '../renderers/MermaidRenderer.js';

export class ContentSectionManager {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        
        // Renderer instances
        this.inputGraphRenderer = null;
        this.outputGraphRenderer = null;
        this.inputMermaidRenderer = null;
        this.outputMermaidRenderer = null;
        
        // Current container reference for cleanup
        this.currentGraphContainer = null;
    }

    /**
     * Update all content sections from step data
     * @param {Object} stepContent - Step content object with different section data
     */
    async updateAllSections(stepContent) {
        try {
            // Update sections in parallel where possible
            await Promise.all([
                this.updateInputCpeeSection(stepContent.inputCpeeTree),
                this.updateInputIntermediateSection(stepContent.inputIntermediate)
            ]);
            
            // Update user input (synchronous)
            this.updateUserInputSection(stepContent.userInput);
            
            // Update output intermediate and output graph in parallel
            await Promise.all([
                this.updateOutputIntermediateSection(stepContent.outputIntermediate),
                this.updateOutputCpeeSection(stepContent.outputCpeeTree)
            ]);
            
        } catch (error) {
            console.error('❌ Error updating content sections:', error);
        }
    }

    /**
     * Update the Input CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     */
    async updateInputCpeeSection(cpeeXml) {
        const inputCpeeElement = this.domRegistry.getElementSafe('inputCpeeContent');
        if (!inputCpeeElement) {
            return;
        }

        // Check if we have valid CPEE XML
        if (!cpeeXml || cpeeXml === 'Not found' || cpeeXml === 'No content available') {
            inputCpeeElement.innerHTML = '<div class="no-content">No CPEE tree available for this step</div>';
            return;
        }

        let cleanup;
        try {
            // Preserve container height during transition
            cleanup = this.preserveHeightDuringTransition(inputCpeeElement);
            
            // Clear the existing content and create graph container
            inputCpeeElement.innerHTML = '';
            
            const graphContainer = this.createGraphContainer('input-cpee');
            inputCpeeElement.appendChild(graphContainer);
            
            // Initialize and render CPEE graph
            if (!this.inputGraphRenderer) {
                this.inputGraphRenderer = new CPEEWfAdaptorRenderer();
            }
            
            // Initialize with proper parameters (containerId, statusId, xmlInputId)
            // For embedded graphs, we don't need status or input elements
            await this.inputGraphRenderer.initialize(graphContainer.id, null, null);
            await this.inputGraphRenderer.renderGraph(cpeeXml);
            
            // Restore normal height behavior
            cleanup();
            
            console.log('✅ Input CPEE section updated with graph');
            
        } catch (error) {
            console.error('❌ Error updating input CPEE section:', error);
            this.showSectionError(inputCpeeElement, 'Failed to render CPEE graph', error.message);
            // Still need to call cleanup on error
            if (typeof cleanup === 'function') {
                cleanup();
            }
        }
    }

    /**
     * Update the Output CPEE Tree section with a rendered graph
     * @param {string} cpeeXml - CPEE XML content to render as graph
     */
    async updateOutputCpeeSection(cpeeXml) {
        const outputCpeeElement = this.domRegistry.getElementSafe('outputCpeeContent');
        if (!outputCpeeElement) {
            return;
        }

        // Check if we have valid CPEE XML
        if (!cpeeXml || cpeeXml === 'Not found' || cpeeXml === 'No content available') {
            outputCpeeElement.innerHTML = '<div class="no-content">No CPEE tree available for this step</div>';
            return;
        }

        try {
            // Preserve container height during transition
            const cleanup = this.preserveHeightDuringTransition(outputCpeeElement);
            
            // Clear the existing content and create graph container
            outputCpeeElement.innerHTML = '';
            
            const graphContainer = this.createGraphContainer('output-cpee');
            outputCpeeElement.appendChild(graphContainer);
            
            // Initialize and render CPEE graph
            if (!this.outputGraphRenderer) {
                this.outputGraphRenderer = new CPEEWfAdaptorRenderer();
            }
            
            // Initialize with proper parameters (containerId, statusId, xmlInputId)
            // For embedded graphs, we don't need status or input elements
            await this.outputGraphRenderer.initialize(graphContainer.id, null, null);
            await this.outputGraphRenderer.renderGraph(cpeeXml);
            
            // Restore normal height behavior
            cleanup();
            
            console.log('✅ Output CPEE section updated with graph');
            
        } catch (error) {
            console.error('❌ Error updating output CPEE section:', error);
            this.showSectionError(outputCpeeElement, 'Failed to render CPEE graph', error.message);
        }
    }

    /**
     * Update the Input Intermediate section with Mermaid diagram
     * @param {string} content - Mermaid diagram content
     */
    async updateInputIntermediateSection(content) {
        const inputIntermediateElement = this.domRegistry.getElementSafe('inputIntermediateContent');
        if (!inputIntermediateElement) {
            return;
        }

        if (!content || content === 'Not found' || content === 'No content available') {
            inputIntermediateElement.innerHTML = '<div class="no-content">No intermediate content available for this step</div>';
            return;
        }

        // Check if content is just a comment header without actual Mermaid content
        const cleanedForCheck = content.replace(/^\s*%%.*$/gm, '').trim();
        if (cleanedForCheck.length === 0) {
            inputIntermediateElement.innerHTML = '<div class="no-content">Empty intermediate content</div>';
            return;
        }

        let cleanup;
        try {
            // Preserve container height during transition
            cleanup = this.preserveHeightDuringTransition(inputIntermediateElement);
            
            // Clear existing content
            inputIntermediateElement.innerHTML = '';
            
            const graphContainer = this.createGraphContainer('input-intermediate');
            inputIntermediateElement.appendChild(graphContainer);
            
            // Initialize and render Mermaid diagram
            if (!this.inputMermaidRenderer) {
                this.inputMermaidRenderer = new MermaidRenderer();
            }
            
            await this.inputMermaidRenderer.initialize(graphContainer.id);
            await this.inputMermaidRenderer.renderGraph(content);
            
            // Restore normal height behavior
            cleanup();
            
            console.log('✅ Input intermediate section updated with Mermaid');
            
        } catch (error) {
            console.error('❌ Error updating input intermediate section:', error);
            // Show fallback with raw content instead of error
            inputIntermediateElement.innerHTML = `<pre><code>${this.escapeHtml(content)}</code></pre>`;
            // Still need to call cleanup on error
            if (typeof cleanup === 'function') {
                cleanup();
            }
        }
    }

    /**
     * Update the Output Intermediate section with Mermaid diagram
     * @param {string} content - Mermaid diagram content
     */
    async updateOutputIntermediateSection(content) {
        const outputIntermediateElement = this.domRegistry.getElementSafe('outputIntermediateContent');
        if (!outputIntermediateElement) {
            return;
        }

        if (!content || content === 'Not found' || content === 'No content available') {
            outputIntermediateElement.innerHTML = '<div class="no-content">No intermediate content available for this step</div>';
            return;
        }

        // Check if content is just a comment header without actual Mermaid content
        const cleanedForCheck = content.replace(/^\s*%%.*$/gm, '').trim();
        if (cleanedForCheck.length === 0) {
            outputIntermediateElement.innerHTML = '<div class="no-content">Empty intermediate content</div>';
            return;
        }

        let cleanup;
        try {
            // Preserve container height during transition
            cleanup = this.preserveHeightDuringTransition(outputIntermediateElement);
            
            // Clear existing content
            outputIntermediateElement.innerHTML = '';
            
            const graphContainer = this.createGraphContainer('output-intermediate');
            outputIntermediateElement.appendChild(graphContainer);
            
            // Initialize and render Mermaid diagram
            if (!this.outputMermaidRenderer) {
                this.outputMermaidRenderer = new MermaidRenderer();
            }
            
            await this.outputMermaidRenderer.initialize(graphContainer.id);
            await this.outputMermaidRenderer.renderGraph(content);
            
            // Restore normal height behavior
            cleanup();
            
            console.log('✅ Output intermediate section updated with Mermaid');
            
        } catch (error) {
            console.error('❌ Error updating output intermediate section:', error);
            // Show fallback with raw content instead of error
            outputIntermediateElement.innerHTML = `<pre><code>${this.escapeHtml(content)}</code></pre>`;
            // Still need to call cleanup on error
            if (typeof cleanup === 'function') {
                cleanup();
            }
        }
    }

    /**
     * Update the User Input section with text content
     * @param {string} content - User input content
     */
    updateUserInputSection(content) {
        const userInputElement = this.domRegistry.getElementSafe('userInputContent');
        if (!userInputElement) {
            return;
        }

        if (!content || content === 'Not found' || content === 'No content available') {
            userInputElement.innerHTML = '<div class="no-content">No user input for this step</div>';
            return;
        }

        try {
            // Create formatted content display
            const formattedContent = this.formatUserInputContent(content);
            userInputElement.innerHTML = formattedContent;
            
            // Add class to parent content-box to identify user input section
            const contentBox = userInputElement.closest('.content-box');
            if (contentBox) {
                contentBox.classList.add('user-input-section');
            }
            
            console.log('✅ User input section updated');
            
        } catch (error) {
            console.error('❌ Error updating user input section:', error);
            this.showSectionError(userInputElement, 'Failed to display user input', error.message);
        }
    }

    /**
     * Create graph container with unique ID and proper styling
     * @param {string} type - Container type identifier
     * @returns {HTMLElement} Graph container element
     */
    createGraphContainer(type) {
        const uniqueId = `${type}-${Date.now()}`;
        
        return this.domRegistry.createElement('div', {
            id: uniqueId,
            className: 'graph-container'
        }, {
            width: '100%',
            minHeight: '100px',
            height: 'auto',
            border: 'none',
            borderRadius: '0',
            background: 'white',
            position: 'relative',
            margin: '0',
            padding: '0'
        });
    }

    /**
     * Show error message in section
     * @param {HTMLElement} element - Section element
     * @param {string} title - Error title
     * @param {string} details - Error details
     */
    showSectionError(element, title, details) {
        const errorHtml = `
            <div class="content-error">
                <h6>${title}</h6>
                <p>${details}</p>
                <small>Check the console for more details.</small>
            </div>
        `;
        element.innerHTML = errorHtml;
    }

    /**
     * Format user input content for display
     * @param {string} content - Raw user input content
     * @returns {string} Formatted HTML content
     */
    formatUserInputContent(content) {
        // Clean the content first - remove "# User Input:" header and extra whitespace
        const cleanedContent = this.extractCleanUserInput(content);
        
        try {
            // Try to parse as JSON for better formatting
            const parsed = JSON.parse(cleanedContent);
            return `<pre><code>${JSON.stringify(parsed, null, 2)}</code></pre>`;
        } catch {
            // If not JSON, display as plain text with proper escaping
            const escaped = this.escapeHtml(cleanedContent);
            return `<pre><code>${escaped}</code></pre>`;
        }
    }

    /**
     * Extract clean user input text from raw log content
     * @param {string} content - Raw content from logs
     * @returns {string} Clean user input text
     */
    extractCleanUserInput(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // Remove the "# User Input:" header line
        let cleanedText = content.replace(/^#\s*User\s*Input\s*:\s*$/gm, '').trim();
        
        // Remove any leading whitespace from each line (handles indentation)
        cleanedText = cleanedText.split('\n').map(line => line.trimStart()).join('\n');
        
        // Remove any additional comment patterns that might be present
        cleanedText = cleanedText.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any markdown-style formatting if present
        cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '').trim();
        
        // Clean up extra whitespace and normalize line endings
        cleanedText = cleanedText.replace(/\r\n/g, '\n');
        cleanedText = cleanedText.replace(/\n\s*\n/g, '\n');
        cleanedText = cleanedText.trim();
        
        return cleanedText;
    }

    /**
     * Escape HTML for safe display
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            this.domRegistry.applyStyles(element, {
                height: currentHeight + 'px'
            });
        }
        
        // Return cleanup function
        return () => {
            setTimeout(() => {
                this.domRegistry.applyStyles(element, {
                    height: 'auto'
                });
                contentBox.classList.remove('transitioning');
            }, 100);
        };
    }

    /**
     * Clear all sections
     */
    clearAllSections() {
        const sections = [
            'inputCpeeContent',
            'inputIntermediateContent', 
            'userInputContent',
            'outputIntermediateContent',
            'outputCpeeContent'
        ];

        sections.forEach(sectionKey => {
            const element = this.domRegistry.getElementSafe(sectionKey);
            if (element) {
                element.innerHTML = '<div class="no-content">No content available</div>';
            }
        });
    }

    /**
     * Restore visual content for a section when switching from raw to visual mode
     * @param {string} sectionId - Section identifier
     */
    restoreVisualContent(sectionId) {
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) {
            return;
        }

        const contentBox = sectionElement.querySelector('.content-box');
        if (!contentBox) {
            return;
        }

        // Ensure positioning context for overlaid content
        contentBox.style.position = 'relative';

        // Restore parent container's scrollbar (visual content needs it)
        contentBox.style.overflow = 'auto';

        // Show all visual content
        const visualElements = contentBox.querySelectorAll('[data-content-type="visual"]');
        visualElements.forEach(el => {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.pointerEvents = 'auto';
            el.style.zIndex = '1';
        });

        console.log(`✅ Restored visual content for ${sectionId}`);
    }

    /**
     * Get renderer instances (for debugging or external access)
     * @returns {Object} Object containing all renderer instances
     */
    getRenderers() {
        return {
            inputGraphRenderer: this.inputGraphRenderer,
            outputGraphRenderer: this.outputGraphRenderer,
            inputMermaidRenderer: this.inputMermaidRenderer,
            outputMermaidRenderer: this.outputMermaidRenderer
        };
    }
}
