/**
 * Content Visualization Coordinator
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
import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { SVGScaleUtility } from '../../utils/dom/SVGScaleUtility.js';
import { TextParser } from '../../utils/content/TextParser.js';
import { StepSection } from '../ui/StepSection.js';

export class ContentVisualizationCoordinator {
    constructor(domRegistry = null, highlightCoordinator = null, eventBus = null) {
        this.domRegistry = domRegistry;
        this.highlightCoordinator = highlightCoordinator;
        this.eventBus = eventBus || defaultEventBus;
        
        // Renderer instances
        this.inputGraphRenderer = null;
        this.outputGraphRenderer = null;
        this.inputMermaidRenderer = null;
        this.outputMermaidRenderer = null;
        
        // Current container reference for cleanup
        this.currentGraphContainer = null;
        
        // Store current CPEE XML content for re-rendering on theme change
        this.currentInputCpeeXml = null;
        this.currentOutputCpeeXml = null;
        
        // Store current Mermaid code for re-rendering on dark mode change
        this.currentInputMermaidCode = null;
        this.currentOutputMermaidCode = null;
        
        // Scale management - listen for scale changes to coordinate all renderers
        this.setupScaleListener();
        
        // Theme management - listen for theme changes to re-render CPEE graphs
        this.setupThemeListener();
        
        // Dark mode management - listen for dark mode changes to re-render all graphs
        this.setupDarkModeListener();
        
        // StepSection instances for collapsible sections
        this.stepSections = new Map();
    }
    
    /**
     * Setup event listener for scale changes
     * Ensures scale coordination across all graph renderers
     */
    setupScaleListener() {
        this.eventBus.on('scaleDisplay:scaleChanged', (data) => {
            const scale = data.scale;
            console.log(`[ContentVisualizationCoordinator] Scale changed to ${scale}x`);
            // Renderers handle scale updates automatically via their own listeners
            // This listener is for coordination/logging purposes
        });
    }
    
    /**
     * Setup event listener for theme changes
     * Re-renders CPEE graphs when theme changes
     */
    setupThemeListener() {
        this.eventBus.on('themeSelector:themeChanged', async (data) => {
            const theme = data.theme;
            console.log(`[ContentVisualizationCoordinator] Theme changed to ${theme}, re-rendering CPEE graphs...`);
            
            // Re-render input CPEE graph if we have stored XML
            if (this.currentInputCpeeXml) {
                await this.updateInputCpeeSection(this.currentInputCpeeXml);
            }
            
            // Re-render output CPEE graph if we have stored XML
            if (this.currentOutputCpeeXml) {
                await this.updateOutputCpeeSection(this.currentOutputCpeeXml);
            }
        });
    }
    
    /**
     * Setup event listener for dark mode changes
     * Re-renders all graphs (CPEE and Mermaid) when dark mode toggles
     */
    setupDarkModeListener() {
        this.eventBus.on('darkMode:toggled', async (data) => {
            const isDark = data.isDark;
            console.log(`[ContentVisualizationCoordinator] Dark mode toggled to ${isDark}, re-rendering all graphs...`);
            
            // Re-render input CPEE graph if we have stored XML
            if (this.currentInputCpeeXml) {
                await this.updateInputCpeeSection(this.currentInputCpeeXml);
            }
            
            // Re-render output CPEE graph if we have stored XML
            if (this.currentOutputCpeeXml) {
                await this.updateOutputCpeeSection(this.currentOutputCpeeXml);
            }
            
            // Re-render input Mermaid diagram if we have stored code
            if (this.currentInputMermaidCode) {
                await this.updateInputIntermediateSection(this.currentInputMermaidCode);
            }
            
            // Re-render output Mermaid diagram if we have stored code
            if (this.currentOutputMermaidCode) {
                await this.updateOutputIntermediateSection(this.currentOutputMermaidCode);
            }
        });
    }
    
    /**
     * Get current scale from localStorage
     * @returns {number} Current scale value (default from config)
     */
    getCurrentScale() {
        try {
            const stored = localStorage.getItem('cpee-debug-console-graph-scale');
            if (stored) {
                const scale = parseFloat(stored);
                if (SVGScaleUtility.isValidScale(scale)) {
                    return scale;
                }
            }
        } catch (error) {
            console.warn('Failed to load scale from storage:', error);
        }
        return configManager.get('rendering.scaling.default') || 1.0; // Default scale from config
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
        // Store XML for re-rendering on theme change
        this.currentInputCpeeXml = cpeeXml;
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
                this.inputGraphRenderer = new CPEEWfAdaptorRenderer(this.eventBus);
            }
            
            // Set up post-render callback for highlighting
            this.inputGraphRenderer.setPostRenderCallback((sectionId, svgElement) => {
                console.log(`[ContentVisualizationCoordinator] Post-render callback for ${sectionId}`);
                if (this.highlightCoordinator) {
                    this.highlightCoordinator.registerSection('input-cpee', svgElement);
                    this.highlightCoordinator.attachCPEEClickHandlers(svgElement, 'input-cpee');
                }
            });
            
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
        // Store XML for re-rendering on theme change
        this.currentOutputCpeeXml = cpeeXml;
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
                this.outputGraphRenderer = new CPEEWfAdaptorRenderer(this.eventBus);
            }
            
            // Set up post-render callback for highlighting
            this.outputGraphRenderer.setPostRenderCallback((sectionId, svgElement) => {
                console.log(`[ContentVisualizationCoordinator] Post-render callback for ${sectionId}`);
                if (this.highlightCoordinator) {
                    this.highlightCoordinator.registerSection('output-cpee', svgElement);
                    this.highlightCoordinator.attachCPEEClickHandlers(svgElement, 'output-cpee');
                }
            });
            
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
        // Store Mermaid code for re-rendering on dark mode change
        this.currentInputMermaidCode = content;
        
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
                this.inputMermaidRenderer = new MermaidRenderer(this.eventBus);
            }
            
            // Set up post-render callback for highlighting
            this.inputMermaidRenderer.setPostRenderCallback((sectionId, svgElement) => {
                console.log(`[ContentVisualizationCoordinator] Post-render callback for ${sectionId}`);
                if (this.highlightCoordinator) {
                    this.highlightCoordinator.registerSection('input-intermediate', svgElement);
                    this.highlightCoordinator.attachMermaidClickHandlers(svgElement, 'input-intermediate');
                }
            });
            
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
        // Store Mermaid code for re-rendering on dark mode change
        this.currentOutputMermaidCode = content;
        
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
                this.outputMermaidRenderer = new MermaidRenderer(this.eventBus);
            }
            
            // Set up post-render callback for highlighting
            this.outputMermaidRenderer.setPostRenderCallback((sectionId, svgElement) => {
                console.log(`[ContentVisualizationCoordinator] Post-render callback for ${sectionId}`);
                if (this.highlightCoordinator) {
                    this.highlightCoordinator.registerSection('output-intermediate', svgElement);
                    this.highlightCoordinator.attachMermaidClickHandlers(svgElement, 'output-intermediate');
                }
            });
            
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
            // Initialize StepSection even if no content
            this.initializeStepSection('user-input');
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
            
            // Initialize StepSection for collapsible functionality
            this.initializeStepSection('user-input');
            
            console.log('✅ User input section updated');
            
        } catch (error) {
            console.error('❌ Error updating user input section:', error);
            this.showSectionError(userInputElement, 'Failed to display user input', error.message);
        }
    }
    
    /**
     * Initialize StepSection component for a section
     * @param {string} sectionId - ID of the section to make collapsible
     */
    initializeStepSection(sectionId) {
        // Only initialize once per section
        if (this.stepSections.has(sectionId)) {
            return;
        }
        
        try {
            const stepSection = new StepSection(sectionId, {
                startCollapsed: false
            });
            this.stepSections.set(sectionId, stepSection);
            console.log(`✅ StepSection initialized for ${sectionId}`);
        } catch (error) {
            console.warn(`⚠️ Failed to initialize StepSection for ${sectionId}:`, error);
        }
    }

    /**
     * Create graph container with unique ID and proper styling
     * @param {string} type - Container type identifier
     * @returns {HTMLElement} Graph container element
     */
    createGraphContainer(type) {
        const uniqueId = `${type}-${Date.now()}`;
        const containerConfig = configManager.get('rendering.containers.graphContainer');
        
        return this.domRegistry.createElement('div', {
            id: uniqueId,
            className: 'graph-container'
        }, containerConfig);
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
        const cleanedContent = TextParser.extractCleanUserInput(content);
        
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
        const minHeightThreshold = configManager.get('rendering.containers.graphContainer.minHeight', '100px');
        const minHeightValue = parseInt(minHeightThreshold);
        
        if (currentHeight > minHeightValue) {
            this.domRegistry.applyStyles(element, {
                height: currentHeight + 'px'
            });
        }
        
        // Return cleanup function
        return () => {
            // Use requestAnimationFrame instead of setTimeout for immediate next frame update
            // This reduces delay from ~100ms to ~16ms (one frame)
            requestAnimationFrame(() => {
                this.domRegistry.applyStyles(element, {
                    height: 'auto'
                });
                contentBox.classList.remove(configManager.get('dom.classes.transitioning'));
                // Force layout recalculation immediately
                void element.offsetHeight;
            });
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
