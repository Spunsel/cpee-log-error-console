/**
 * Content Processing Service
 * Centralized content cleaning, parsing, and validation
 * Single responsibility: Content processing operations
 */

import { CPEEParser } from '../utils/content/CPEEParser.js';
import { MermaidParser } from '../utils/content/MermaidParser.js';

export class ContentProcessingService {
    /**
     * Create a new ContentProcessingService instance
     */
    constructor() {
        // No dependencies - uses parser utilities directly
    }

    /**
     * Process CPEE tree content from log exposition
     * @param {string} rawContent - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Cleaned CPEE content
     */
    processCPEETreeContent(rawContent, type) {
        if (!rawContent) {
            return rawContent;
        }
        return CPEEParser.cleanCPEETreeContent(rawContent, type);
    }

    /**
     * Process and validate CPEE XML for rendering
     * @param {string} cpeeXML - Raw CPEE XML
     * @returns {string} Cleaned and validated XML
     * @throws {Error} If XML is invalid
     */
    processAndValidateCPEEXML(cpeeXML) {
        return CPEEParser.cleanAndValidateXML(cpeeXML);
    }

    /**
     * Process and validate CPEE XML with optional preprocessing
     * @param {string} cpeeXML - Raw CPEE XML
     * @param {boolean} preprocess - Whether to apply syntax preprocessing (default: true)
     * @returns {{xml: string, appliedSteps: Array}} Cleaned and validated XML with preprocessing steps
     * @throws {Error} If XML is invalid
     */
    processAndValidateCPEE(cpeeXML, preprocess = true) {
        return CPEEParser.cleanAndValidate(cpeeXML, preprocess);
    }

    /**
     * Process Mermaid content from log exposition
     * @param {string} rawContent - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Cleaned Mermaid content
     */
    processMermaidContent(rawContent, type) {
        if (!rawContent) {
            return rawContent;
        }
        return MermaidParser.cleanMermaidContent(rawContent, type);
    }

    /**
     * Process and validate Mermaid code for rendering
     * @param {string} mermaidCode - Raw Mermaid code
     * @param {boolean} preprocess - Whether to apply syntax preprocessing (default: true)
     * @returns {{code: string, appliedSteps: Array}} Cleaned and validated Mermaid code with preprocessing steps
     * @throws {Error} If code is invalid
     */
    processAndValidateMermaid(mermaidCode, preprocess = true) {
        return MermaidParser.cleanAndValidate(mermaidCode, preprocess);
    }

    /**
     * Process Mermaid content for log view (minimal cleaning)
     * @param {string} rawContent - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Minimally cleaned Mermaid content
     */
    processMermaidForLogView(rawContent, type) {
        if (!rawContent) {
            return rawContent;
        }
        return MermaidParser.cleanMermaidForLogView(rawContent, type);
    }

    /**
     * Process user input content
     * @param {string} rawContent - Raw user input content
     * @returns {string} Processed user input (currently returns as-is, can be extended)
     */
    processUserInput(rawContent) {
        // Currently user input is stored as-is
        // Can be extended with cleaning logic if needed
        return rawContent;
    }

    /**
     * Format user input content for display
     * Cleans the content, attempts JSON parsing for formatting, and returns HTML
     * @param {string} rawContent - Raw user input content from logs
     * @param {Object} options - Formatting options
     * @param {Function} options.extractCleanUserInput - Optional function to clean user input (from EventProcessingService)
     * @param {Function} options.escapeHtml - Optional function to escape HTML (from DOMRegistry)
     * @returns {string} Formatted HTML content wrapped in <pre><code> tags
     */
    formatUserInputForDisplay(rawContent, options = {}) {
        if (!rawContent || typeof rawContent !== 'string') {
            return '<pre><code class="no-content">No user input available</code></pre>';
        }

        // Extract clean user input (remove headers, formatting, normalize whitespace)
        let cleanedContent = rawContent;
        if (options.extractCleanUserInput && typeof options.extractCleanUserInput === 'function') {
            cleanedContent = options.extractCleanUserInput(rawContent);
        } else {
            // Fallback: basic cleaning if extractCleanUserInput not provided
            cleanedContent = rawContent.replace(/^#\s*User\s*Input\s*:\s*$/gm, '').trim();
        }

        if (!cleanedContent) {
            return '<pre><code class="no-content">No user input available</code></pre>';
        }

        try {
            // Try to parse as JSON for better formatting
            const parsed = JSON.parse(cleanedContent);
            const formattedJson = JSON.stringify(parsed, null, 2);
            // Escape HTML-sensitive characters to prevent XSS
            let escapedJson = formattedJson;
            if (options.escapeHtml && typeof options.escapeHtml === 'function') {
                escapedJson = options.escapeHtml(formattedJson);
            } else {
                // Fallback: basic HTML escaping
                escapedJson = formattedJson
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;')
                    .replace(/`/g, '&#96;');
            }
            return `<pre><code>${escapedJson}</code></pre>`;
        } catch {
            // If not JSON, display as plain text with proper escaping
            let escaped = cleanedContent;
            if (options.escapeHtml && typeof options.escapeHtml === 'function') {
                escaped = options.escapeHtml(cleanedContent);
            } else {
                // Fallback: basic HTML escaping
                escaped = cleanedContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;')
                    .replace(/`/g, '&#96;');
            }
            return `<pre><code>${escaped}</code></pre>`;
        }
    }
}

