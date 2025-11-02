/**
 * RawUntouchedLogRender
 * Renders log view content with minimal processing (untouched from logs)
 * Handles rendering of un-preprocessed Mermaid code from logs and marks preprocessing lines
 * 
 * Responsibilities:
 * - Render log Mermaid content with minimal cleaning (no preprocessing)
 * - Detect which lines would have preprocessing fixes applied
 * - Mark affected line numbers with background highlight
 */

import { MermaidParser } from '../../utils/content/MermaidParser.js';

export class RawUntouchedLogRender {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
    }

    /**
     * Render log Mermaid content with minimal processing
     * Only removes: %% Input/Output Intermediate comment, ```mermaid markers, and fixes indentation
     * Uses MermaidParser.cleanMermaidForLogView() for minimal cleaning
     * @param {string} mermaidText - Raw Mermaid diagram text from logs (rawExposition)
     * @param {Object} options - Rendering options (can include 'type' for input/output)
     * @returns {HTMLElement} Container with rendered content
     */
    renderLogMermaid(mermaidText, options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container mermaid-log'
        });

        // Apply minimal cleaning: remove comments, markdown markers, and fix indentation
        const type = options.type || 'output'; // Default to output, can be set to 'input'
        let processedText = mermaidText || '';
        
        try {
            processedText = MermaidParser.cleanMermaidForLogView(processedText, type);
        } catch (error) {
            console.warn('Failed to clean log Mermaid content, using raw text:', error);
            // Fallback to raw text if cleaning fails
            processedText = mermaidText || '';
        }

        // Detect which lines would have preprocessing fixes applied
        // Parse with preprocessing to get appliedSteps, but don't use the processed code
        let affectedLineNumbers = [];
        try {
            const cleanResult = MermaidParser.cleanAndValidate(processedText, true);
            if (cleanResult.appliedSteps && cleanResult.appliedSteps.length > 0) {
                // Collect all line numbers from all applied steps
                cleanResult.appliedSteps.forEach(step => {
                    if (step.lineNumbers && Array.isArray(step.lineNumbers)) {
                        affectedLineNumbers.push(...step.lineNumbers);
                    }
                });
                // Remove duplicates and sort
                affectedLineNumbers = Array.from(new Set(affectedLineNumbers)).sort((a, b) => a - b);
            }
        } catch (error) {
            // If parsing fails, just continue without marking lines
            console.warn('Failed to detect preprocessing steps for log view:', error);
        }

        // Store affected line numbers in data attribute for later marking
        if (affectedLineNumbers.length > 0) {
            container.setAttribute('data-preprocessing-lines', affectedLineNumbers.join(','));
        }

        const codeElement = this.domRegistry.createElement('pre', {
            className: 'raw-code-block'
        });

        const codeContent = this.domRegistry.createElement('code', {
            className: 'language-mermaid',
            textContent: processedText
        });

        codeElement.appendChild(codeContent);
        container.appendChild(codeElement);

        return container;
    }

    /**
     * Wait for line numbers to be added, then mark preprocessing lines (log mode only)
     * @param {HTMLElement} container - Container with rendered content
     * @param {number} attempt - Current attempt number
     * @param {number} maxAttempts - Maximum number of attempts
     */
    waitForLineNumbersAndMark(container, attempt = 0, maxAttempts = 10) {
        if (!container || attempt >= maxAttempts) {
            return;
        }

        // Check if line numbers have been added
        const logContainer = container.querySelector('.mermaid-log') || container;
        const lineNumberElements = logContainer.querySelectorAll('.raw-code-line-number');
        
        if (lineNumberElements.length > 0) {
            // Line numbers are present, mark preprocessing lines
            this.markPreprocessingLines(container);
        } else {
            // Line numbers not yet added, retry after a short delay
            setTimeout(() => {
                this.waitForLineNumbersAndMark(container, attempt + 1, maxAttempts);
            }, 50); // 50ms delay between attempts
        }
    }

    /**
     * Mark line numbers with background highlight for lines that have preprocessing fixes applied (log mode only)
     * @param {HTMLElement} container - Container with rendered content
     */
    markPreprocessingLines(container) {
        if (!container) {
            return;
        }

        // Find the mermaid-log container (might be nested)
        const logContainer = container.querySelector('.mermaid-log') || container;
        const preprocessingLinesAttr = logContainer.getAttribute('data-preprocessing-lines');
        
        if (!preprocessingLinesAttr) {
            return; // No preprocessing lines to mark
        }

        // Parse line numbers from data attribute
        const affectedLineNumbers = preprocessingLinesAttr.split(',').map(num => parseInt(num, 10)).filter(num => !isNaN(num) && num > 0);
        
        if (affectedLineNumbers.length === 0) {
            return; // No valid line numbers
        }

        // Find all line number elements
        const lineNumberElements = logContainer.querySelectorAll('.raw-code-line-number');
        
        // Mark each affected line number with background highlight
        lineNumberElements.forEach(lineNumberEl => {
            const lineNumber = parseInt(lineNumberEl.getAttribute('data-line'), 10);
            if (!isNaN(lineNumber) && affectedLineNumbers.includes(lineNumber)) {
                lineNumberEl.classList.add('preprocessing-line-number');
            }
        });
    }
}

