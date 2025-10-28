/**
 * RawContentRenderer
 * Renders raw content (Mermaid, CPEE XML, user input) as plain text
 * Phase 21.4: Raw View Rendering
 * 
 * Responsibilities:
 * - Render raw content into DOM elements
 * - Provide DOM structure for content display
 */

export class RawContentRenderer {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
    }

    /**
     * Render raw Mermaid content as plain text
     * @param {string} mermaidText - Raw Mermaid diagram text
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with rendered content
     */
    renderRawMermaid(mermaidText, _options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container mermaid-raw'
        });

        const codeElement = this.domRegistry.createElement('pre', {
            className: 'raw-code-block'
        });

        const codeContent = this.domRegistry.createElement('code', {
            className: 'language-mermaid',
            textContent: mermaidText
        });

        codeElement.appendChild(codeContent);
        container.appendChild(codeElement);

        return container;
    }

    /**
     * Render raw CPEE XML content as plain text
     * @param {string} xmlText - Raw CPEE XML text
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with rendered content
     */
    renderRawCPEETree(xmlText, _options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container cpee-raw'
        });

        const codeElement = this.domRegistry.createElement('pre', {
            className: 'raw-code-block'
        });

        const codeContent = this.domRegistry.createElement('code', {
            className: 'language-xml',
            textContent: xmlText
        });

        codeElement.appendChild(codeContent);
        container.appendChild(codeElement);

        return container;
    }

    /**
     * Render raw user input text
     * @param {string} userInputText - User input text
     * @param {Object} options - Rendering options
     * @returns {HTMLElement} Container with rendered content
     */
    renderRawUserInput(userInputText, _options = {}) {
        const container = this.domRegistry.createElement('div', {
            className: 'raw-content-container user-input-raw'
        });

        const textElement = this.domRegistry.createElement('pre', {
            className: 'raw-text-block'
        });

        const textContent = this.domRegistry.createElement('code', {
            className: 'language-text',
            textContent: userInputText
        });

        textElement.appendChild(textContent);
        container.appendChild(textElement);

        return container;
    }
}
