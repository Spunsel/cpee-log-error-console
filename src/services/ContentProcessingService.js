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
}

