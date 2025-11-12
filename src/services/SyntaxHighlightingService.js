/**
 * Syntax Highlighting Service
 * Manages Prism.js syntax highlighting configuration for CPEE XML and Mermaid diagrams
 * Handles theme application, custom color overrides, and language definitions
 */

import { configManager } from '../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../core/EventBus.js';

export class SyntaxHighlightingService {
    constructor(eventBus = null) {
        this.initialized = false;
        this.mutationObserver = null;
        this.eventBus = eventBus || defaultEventBus;
    }

    /**
     * Initialize syntax highlighting service
     * Sets up Prism.js, applies theme, registers languages, and applies custom styling
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        try {
            const sh = configManager.get('syntaxHighlighting', {});
            
            if (!sh || !sh.enabled) {
                return;
            }

            // Configure Prism autoloader
            this._configureAutoloader(sh);
            
            // Apply theme
            this._applyTheme(sh);
            
            // Apply custom styling
            this._applyCustomStyling(sh);
            
            // Register Mermaid language definition
            this._registerMermaidLanguage(sh);
            
            // Set up Mermaid block highlighting
            this._setupMermaidHighlighting();
            
            // Set up dark mode listener to reapply styles
            this._setupDarkModeListener();
            
            this.initialized = true;
        } catch (e) {
            console.warn('SyntaxHighlightingService: Initialization failed:', e);
        }
    }

    /**
     * Set up listener for dark mode changes to reapply syntax highlighting styles
     * @private
     */
    _setupDarkModeListener() {
        this.eventBus.on('darkMode:toggled', () => {
            const sh = configManager.get('syntaxHighlighting', {});
            if (sh && sh.enabled) {
                // Reapply custom styling with new colors
                this._applyCustomStyling(sh);
            }
        });
    }

    /**
     * Configure Prism autoloader path
     * @private
     */
    _configureAutoloader(sh) {
        if (window.Prism && window.Prism.plugins && window.Prism.plugins.autoloader && sh.autoloaderPath) {
            window.Prism.plugins.autoloader.languages_path = sh.autoloaderPath;
        }
    }

    /**
     * Apply Prism theme
     * @private
     */
    _applyTheme(sh) {
        const themeLink = document.getElementById('prism-theme');
        if (themeLink && sh.themeUrl) {
            themeLink.setAttribute('href', sh.themeUrl);
        }
    }

    /**
     * Apply custom CSS styling for syntax highlighting
     * @private
     */
    _applyCustomStyling(sh) {
        const styleId = 'prism-overrides';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const colors = sh.colors || {};
        const activeColors = isDarkMode && colors.dark ? colors.dark : colors;
        const mermaid = sh.mermaid || {};
        const activeMermaid = isDarkMode && mermaid.dark ? mermaid.dark : mermaid;
        const mermaidDefault = activeMermaid.default || (isDarkMode ? '#a8b8d0' : '#374151');
        const typo = sh.typography || {};
        
        let css = '';
        
        // Typography
        if (typo.fontFace?.enabled && typo.fontFace?.src && typo.fontFace?.name) {
            css += `@font-face{font-family:"${typo.fontFace.name}";src:url("${typo.fontFace.src}") format("truetype");font-weight:${typo.fontFace.weight||'400'};font-style:${typo.fontFace.style||'normal'};font-display:swap;}`;
        }
        const fontFamily = typo.fontFamily || 'Adwaita Mono Regular';
        const fontSize = typo.fontSize || '13px';
        css += `.raw-content-container pre, .raw-content-container code, pre.raw-code-block, pre.raw-code-block code, pre code { font-family: ${fontFamily}; font-size: ${fontSize}; }`;
        
        // Code block background
        if (sh.codeBlockBackground !== null && sh.codeBlockBackground !== undefined) {
            css += `.raw-content-container pre, pre.raw-code-block, pre { background-color: ${sh.codeBlockBackground} !important; }`;
        }
        
        // XML/CPEE colors
        if (activeColors.textContent !== null && activeColors.textContent !== undefined) {
            css += `.raw-content-container pre code:not(.language-mermaid):not(.language-text), pre code:not(.language-mermaid):not(.language-text) { color: ${activeColors.textContent} !important; }`;
        }
        
        const xmlMappings = {
            tag: '.token.tag',
            attrName: '.token.attr-name',
            attrValue: '.token.attr-value',
            punctuation: '.token.punctuation'
        };
        Object.entries(xmlMappings).forEach(([key, selector]) => {
            if (activeColors[key] !== null && activeColors[key] !== undefined) {
                css += `${selector} { color: ${activeColors[key]} !important; }`;
            }
        });
        
        // Mermaid colors
        if (activeMermaid.default !== null && activeMermaid.default !== undefined) {
            css += `.language-mermaid, code.language-mermaid { color: ${mermaidDefault} !important; }`;
        }
        css += `.token.mermaid-id { color: ${activeMermaid.id || (isDarkMode ? '#f5a5a5' : '#b91c1c')} !important; }`;
        css += `.token.mermaid-punctuation { color: ${activeMermaid.punctuation || (isDarkMode ? '#94a3b8' : '#9ca3af')} !important; }`;
        css += `.token.mermaid-parentheses { color: ${activeMermaid.parentheses || (isDarkMode ? '#86efac' : '#008000')} !important; }`;
        css += `.token.mermaid-condition { color: ${activeMermaid.condition || (isDarkMode ? '#6ba3f5' : '#2563eb')} !important; }`;
        css += `.token.node-type { color: ${mermaidDefault} !important; }`;
        
        // User input override
        css += `.user-input-raw code, .user-input-section code, #user-input-content code, code.language-text { color: var(--text-primary, #1e293b) !important; }`;
        css += `.user-input-raw code .token, .user-input-section code .token, #user-input-content code .token, code.language-text .token { color: inherit !important; }`;
        
        styleEl.textContent = css;
    }

    /**
     * Register Mermaid language definition for Prism.js
     * @private
     */
    _registerMermaidLanguage(_sh) {
        if (!window.Prism) {
            return;
        }

        // Define Mermaid language - order matters for pattern matching
        window.Prism.languages.mermaid = {
            // Conditions in pipes must match first: |"true"|, |"Results Require"|, |""|
            'condition': {
                pattern: /\|"([^"]*)"\|/,
                alias: 'mermaid-condition'
            },
            // Arrows: -->
            'arrow': {
                pattern: /-->/,
                alias: 'mermaid-punctuation'
            },
            // Quoted strings inside parentheses: ("House of Representatives (435 Members)")
            // This must come before parentheses-content to match the entire quoted string
            // Pattern handles escaped quotes and backslashes: matches non-quote/non-backslash chars or escaped chars
            'quoted-parentheses-content': {
                pattern: /(?<=\()"(?:[^"\\]|\\.)+"(?=\))/,
                alias: 'mermaid-parentheses'
            },
            // Text content inside parentheses: (startevent), (Task X), ((startevent)), etc.
            // Match just the content, not the brackets themselves (brackets will be matched by punctuation pattern)
            // Use fixed-length lookbehind for single opening paren, lookahead for single closing paren
            // For multiple parens like ((startevent)), extra parens will be matched by punctuation pattern
            // This pattern should not match quoted strings (handled above) - negative lookahead ensures no quote immediately after opening paren
            'parentheses-content': {
                pattern: /(?<=\()(?!")[^()]+(?=\))/,
                alias: 'mermaid-parentheses'
            },
            // IDs: alphanumeric + underscore/hyphen at start of line or after whitespace, before colon
            // Pattern: word chars followed by colon then letter (node type)
            'id': {
                pattern: /(^|\s)([a-zA-Z0-9_-]+)(?=:[a-zA-Z])/,
                lookbehind: true,
                alias: 'mermaid-id'
            },
            // Node types: :startevent:, :task:, :exclusivegateway:
            // Match colon, word chars, colon - these should be black (default), no special alias
            'node-type': {
                pattern: /:[a-zA-Z]+:/
            },
            // Keywords like "flowchart", "graph", "LR", "TD", etc.
            'keyword': {
                pattern: /\b(flowchart|graph|LR|TD|TB|RL|BT|subgraph|end)\b/
            },
            // Punctuation: colons, dots, dashes, pipes, parentheses (but not those already matched)
            // Exclude colons that are part of node-type pattern (those are already matched above)
            // This will match remaining punctuation that wasn't caught by more specific patterns
            'punctuation': {
                pattern: /[:().\-{}|]/,
                // Don't match if the colon is part of :nodetype: pattern
                // Since node-type is matched first, its colons won't be available to this pattern
                lookbehind: false
            }
        };
    }

    /**
     * Set up automatic highlighting for Mermaid code blocks
     * @private
     */
    _setupMermaidHighlighting() {
        if (!window.Prism) {
            return;
        }

        // Ensure Prism highlights Mermaid code blocks when they're rendered
        // Exclude user input blocks
        const highlightMermaidBlocks = () => {
            document.querySelectorAll('code.language-mermaid, code:not(.language-text)').forEach(block => {
                // Skip user input blocks (check multiple selectors)
                const userInputContainer = block.closest('.user-input-raw, .user-input-section, #user-input-content, [data-section-id="user-input"]');
                if (userInputContainer || block.classList.contains('language-text')) {
                    return;
                }
                
                if (!block.dataset.mermaidHighlighted) {
                    window.Prism.highlightElement(block);
                    block.dataset.mermaidHighlighted = 'true';
                }
            });
        };
        
        // Highlight existing blocks
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(highlightMermaidBlocks, 100);
            });
        } else {
            setTimeout(highlightMermaidBlocks, 100);
        }
        
        // Watch for dynamically added Mermaid blocks
        this.mutationObserver = new MutationObserver(() => {
            highlightMermaidBlocks();
        });
        this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Highlight code blocks in a container
     * Initializes the service lazily if not already initialized
     * Excludes user input from syntax highlighting
     * @param {HTMLElement} container - Container element containing code blocks
     */
    highlightCodeBlocks(container) {
        // Lazy initialization - initialize on first use if not already initialized
        if (!this.initialized) {
            this.initialize();
        }

        if (!window.Prism || typeof window.Prism.highlightElement !== 'function') {
            return;
        }

        try {
            const sh = configManager.get('syntaxHighlighting', { enabled: true, highlightOnRender: true });
            if (!sh.enabled || !sh.highlightOnRender) {
                return;
            }

            // Exclude user input containers and language-text blocks
            const codeBlocks = container.querySelectorAll('pre code:not(.language-text)');
            codeBlocks.forEach(block => {
                // Skip if within user input container (check multiple selectors)
                const userInputContainer = block.closest('.user-input-raw, .user-input-section, #user-input-content, [data-section-id="user-input"]');
                // Also skip if it's a language-text block
                if (userInputContainer || block.classList.contains('language-text')) {
                    return;
                }
                
                // Skip if already processed (has line numbers)
                if (block.closest('.raw-code-block-with-lines')) {
                    return;
                }
                
                window.Prism.highlightElement(block);
                
                // Add line numbers after highlighting
                this._addLineNumbers(block);
            });
        } catch (error) {
            console.warn('SyntaxHighlightingService: Error highlighting code blocks:', error);
        }
    }

    /**
     * Add line numbers to a code block
     * Wraps the code in a structure with line numbers on the left
     * @private
     * @param {HTMLElement} codeElement - The code element to add line numbers to
     */
    _addLineNumbers(codeElement) {
        if (!codeElement || !codeElement.parentElement) {
            return;
        }

        const preElement = codeElement.parentElement;
        
        // Skip if already has line numbers
        if (preElement.classList.contains('raw-code-block-with-lines') || 
            preElement.querySelector('.raw-code-block-with-lines')) {
            return;
        }
        
        // Skip if inside trace-details-json (don't add line numbers to trace JSON)
        if (preElement.classList.contains('trace-details-json')) {
            return;
        }

        // Get the original text content to count lines
        const originalText = codeElement.textContent || '';
        const lines = originalText.split('\n');
        const lineCount = lines.length;
        
        // If there's only one empty line or no content, don't add line numbers
        if (lineCount <= 1 && !originalText.trim()) {
            return;
        }

        // Get the highlighted HTML (Prism has already processed it)
        const highlightedHTML = codeElement.innerHTML;
        
        // Create wrapper div for line numbers
        const wrapper = document.createElement('div');
        wrapper.className = 'raw-code-block-with-lines';
        
        // Create line numbers container
        const lineNumbersContainer = document.createElement('div');
        lineNumbersContainer.className = 'raw-code-line-numbers';
        
        // Create code content container
        const codeContentContainer = document.createElement('div');
        codeContentContainer.className = 'raw-code-content';
        
        // Create a new code element for the content (preserve original classes)
        const newCodeElement = document.createElement('code');
        newCodeElement.className = codeElement.className;
        newCodeElement.innerHTML = highlightedHTML;
        
        codeContentContainer.appendChild(newCodeElement);
        
        // Add line numbers - one per line
        for (let i = 1; i <= lineCount; i++) {
            const lineNumber = document.createElement('span');
            lineNumber.className = 'raw-code-line-number';
            lineNumber.textContent = i;
            lineNumber.setAttribute('data-line', i);
            lineNumbersContainer.appendChild(lineNumber);
        }
        
        // Append line numbers and code content to wrapper
        wrapper.appendChild(lineNumbersContainer);
        wrapper.appendChild(codeContentContainer);
        
        // Replace the pre element's content with the wrapper
        // Preserve the pre element's class and other attributes
        const preClasses = preElement.className;
        const preAttributes = {};
        Array.from(preElement.attributes).forEach(attr => {
            if (attr.name !== 'class') {
                preAttributes[attr.name] = attr.value;
            }
        });
        
        preElement.innerHTML = '';
        preElement.className = preClasses;
        Object.entries(preAttributes).forEach(([name, value]) => {
            preElement.setAttribute(name, value);
        });
        preElement.appendChild(wrapper);
    }

    /**
     * Destroy the service and clean up resources
     */
    destroy() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        this.initialized = false;
    }
}

