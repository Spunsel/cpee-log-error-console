/**
 * MermaidErrorHandler - Handles errors from Mermaid.js rendering
 * 
 * Catches and categorizes different types of Mermaid rendering errors:
 * - MermaidSyntaxError: Syntax errors in the Mermaid code
 * - Other rendering errors: General rendering failures
 * 
 * Provides visual feedback by displaying error indicators (red boxes)
 * in the affected graph sections.
 */

import { ICON_ERROR } from '../../assets/icons.js';

export class MermaidErrorHandler {
    /**
     * Custom error class for Mermaid syntax errors
     */
    static MermaidSyntaxError = class MermaidSyntaxError extends Error {
        constructor(message, originalError = null, code = null) {
            super(message);
            this.name = 'MermaidSyntaxError';
            this.originalError = originalError;
            this.code = code;
            this.errorType = 'syntax';
        }
    };

    /**
     * Detect if an error is a Mermaid syntax error
     * @param {Error} error - Error to check
     * @returns {boolean} True if it's a syntax error
     */
    static isSyntaxError(error) {
        if (!error) {
            return false;
        }

        // Check if it's a validation error (should be treated as syntax error)
        if (error.name === 'MermaidValidationError' || error.validationType) {
            return true;
        }

        // Check error message for syntax-related keywords
        const message = error.message || '';
        const lowerMessage = message.toLowerCase();

        // Common Mermaid syntax error indicators
        const syntaxIndicators = [
            'syntax error',
            'parse error',
            'parsing error',
            'invalid syntax',
            'unexpected token',
            'unexpected character',
            'invalid character',
            'malformed',
            'parse failed',
            'line',
            'token',
            'lexer error',
            'no diagram type detected',
            'diagram type'
        ];

        // Check if error message contains syntax error indicators
        const hasSyntaxIndicator = syntaxIndicators.some(indicator => 
            lowerMessage.includes(indicator)
        );

        // Check error name/type
        const errorName = (error.name || '').toLowerCase();
        const hasSyntaxName = errorName.includes('syntax') || 
                             errorName.includes('parse') ||
                             errorName.includes('lexer');

        // Check if it's our custom MermaidSyntaxError
        const isCustomSyntaxError = error instanceof MermaidErrorHandler.MermaidSyntaxError ||
                                   error.errorType === 'syntax';

        return hasSyntaxIndicator || hasSyntaxName || isCustomSyntaxError;
    }

    /**
     * Wrap an error in a categorized error object
     * @param {Error} error - Original error
     * @param {string} mermaidCode - Mermaid code that caused the error
     * @returns {Object} Categorized error object
     */
    static categorizeError(error, mermaidCode = null) {
        // Format validation errors as Mermaid syntax errors
        let formattedMessage = error?.message || 'Unknown error occurred';
        const codeToUse = error?.code || mermaidCode;
        
        if (error?.validationType) {
            formattedMessage = this.formatValidationError(error);
        } else {
            // Check if this is a "No diagram type detected" error from Mermaid.js
            const message = error?.message || '';
            const noDiagramTypeMatch = message.match(/No diagram type detected matching given configuration for text:\s*(\w+)/i);
            if (noDiagramTypeMatch && codeToUse) {
                // Extract the actual diagram type from the first line of code (not from error message)
                // The error message might only have "bpmn" but the code might have "bpmn-lr"
                const lines = codeToUse.split('\n');
                const firstLine = lines[0] || '';
                // Extract the first word/token from the first line (e.g., "bpmn-lr" from "bpmn-lr")
                const actualDiagramType = firstLine.trim().split(/\s+/)[0] || noDiagramTypeMatch[1];
                
                // Format this as a syntax error with proper structure
                formattedMessage = this.formatMissingDiagramTypeError(actualDiagramType, codeToUse);
                // Mark as validation error so it gets treated as syntax error
                error.validationType = 'missingDiagramType';
                error.expected = ['flowchart', 'graph', 'stateDiagram', 'stateDiagram-v2', 'sequenceDiagram', 'journey'];
                error.got = actualDiagramType;
            }
        }
        
        const categorizedError = {
            originalError: error,
            code: codeToUse,
            timestamp: new Date().toISOString(),
            errorType: 'unknown',
            message: formattedMessage,
            name: error?.name || 'Error'
        };

        // Determine error type
        if (this.isSyntaxError(error)) {
            categorizedError.errorType = 'syntax';
            categorizedError.category = 'MermaidSyntaxError';
        } else {
            categorizedError.errorType = 'rendering';
            categorizedError.category = 'MermaidRenderingError';
        }

        return categorizedError;
    }

    /**
     * Format missing diagram type error from Mermaid.js
     * @param {string} got - The diagram type that was found (invalid)
     * @param {string} code - The Mermaid code
     * @returns {string} Formatted error message in Mermaid syntax error format
     */
    static formatMissingDiagramTypeError(got, code) {
        if (!code) {
            return `No diagram type detected matching given configuration for text: ${got}`;
        }
        
        const lines = code.split('\n');
        const errorLineIndex = 0; // First line is where diagram type should be
        const errorLineNumber = errorLineIndex + 1;
        const problematicLine = lines[errorLineIndex] || '';
        
        // Get the next line if available (for context like "direction LR")
        const nextLine = lines[errorLineIndex + 1] || '';
        
        // Format expected values
        const expected = ['flowchart', 'graph', 'stateDiagram', 'stateDiagram-v2', 'sequenceDiagram', 'journey'];
        const expectedStr = expected.map(v => `'${v}'`).join(' or ');
        
        // Build error message in exact Mermaid syntax error format
        // Format matches: "Parse error on line 1:\n\nbpmn\ndirection LR\nExpected: ...\nGot: ..."
        let errorMessage = `Parse error on line ${errorLineNumber}:\n\n`;
        errorMessage += `${problematicLine}`;
        if (nextLine) {
            errorMessage += `\n${nextLine}`;
        }
        errorMessage += `\n\nExpected: ${expectedStr}\n`;
        errorMessage += `Got: ${got}`;
        
        return errorMessage;
    }

    /**
     * Format validation error as Mermaid syntax error
     * @param {Error} error - Validation error with metadata
     * @returns {string} Formatted error message in Mermaid syntax error format
     */
    static formatValidationError(error) {
        if (!error.validationType) {
            return error.message;
        }

        if (error.validationType === 'missingDiagramType') {
            if (!error.code) {
                return error.message;
            }
            
            const lines = error.code.split('\n');
            const errorLineIndex = 0; // First line is where diagram type should be
            const errorLineNumber = errorLineIndex + 1;
            const problematicLine = lines[errorLineIndex] || '';
            
            // Get the next line if available (for context like "direction LR")
            const nextLine = lines[errorLineIndex + 1] || '';
            
            // Format expected values
            const expectedStr = error.expected ? 
                error.expected.map(v => `'${v}'`).join(' or ') : 
                "'flowchart' or 'graph'";
            
            // Build error message in exact Mermaid syntax error format
            // Format matches: "Parse error on line 1:\n\nbpmn\ndirection LR\nExpected: ...\nGot: ..."
            let errorMessage = `Parse error on line ${errorLineNumber}:\n\n`;
            errorMessage += `${problematicLine}`;
            if (nextLine) {
                errorMessage += `\n${nextLine}`;
            }
            errorMessage += `\n\nExpected: ${expectedStr}\n`;
            errorMessage += `Got: ${error.got || 'unknown'}`;
            
            return errorMessage;
        }

        if (error.validationType === 'invalidInput') {
            return `Validation Error:\n${error.details || error.message}`;
        }

        if (error.validationType === 'emptyCode') {
            return `Validation Error:\n${error.details || error.message}`;
        }

        return error.message;
    }

    /**
     * Parse error message to extract structured information
     * @param {string} message - Error message
     * @param {string} code - Mermaid code (optional)
     * @returns {Object} Parsed error information
     */
    static parseErrorMessage(message, code = null) {
        const parsed = {
            header: null,
            lineNumber: null,
            codeContext: null,
            expecting: null,
            got: null,
            rawMessage: message
        };

        // Try to extract line number from "Parse error on line X:"
        const lineMatch = message.match(/Parse error on line (\d+):/i);
        if (lineMatch) {
            parsed.lineNumber = parseInt(lineMatch[1], 10);
            parsed.header = `on line ${parsed.lineNumber}:`;
        }

        // Try to extract column position from caret indicator (^)
        // Format: lines with caret like "-----------------------^"
        // The error message shows a truncated snippet, so we need to find the actual position in the real line
        const messageLines = message.split('\n');
        let snippetLine = null;
        let caretLine = null;
        
        for (let i = 0; i < messageLines.length; i++) {
            const line = messageLines[i];
            if (line.includes('^')) {
                const lineWithoutCaret = line.replace(/\^/g, '');
                // Check if line contains only dashes/spaces and a caret
                if (/^[\s-]+$/.test(lineWithoutCaret.trim())) {
                    // This line contains only dashes/spaces and a caret - it's the marker line
                    caretLine = line;
                    // The snippet line should be right before this
                    if (i > 0) {
                        snippetLine = messageLines[i - 1];
                    }
                    break;
                }
            }
        }
        
        // If no caret line found, try to extract snippet line directly from error message
        // Sometimes Mermaid shows the problematic line without a caret indicator
        if (!snippetLine) {
            // Look for lines that look like code (contain node patterns like :task:, :exclusivegateway:, etc.)
            // But be careful not to match lines that are clearly part of the next line
            for (let i = 0; i < messageLines.length; i++) {
                const line = messageLines[i].trim();
                // Check if line looks like Mermaid code (contains node patterns)
                // But skip if it looks like it starts mid-line (starts with --> or node pattern without proper prefix)
                if (line && (
                    /:\w+:/g.test(line) ||  // Contains :task:, :exclusivegateway:, etc.
                    /-->/g.test(line) ||    // Contains edge arrows
                    /\(\(/.test(line) ||    // Contains double parentheses
                    /\{x\}/.test(line)       // Contains {x}
                )) {
                    // Check if this line looks like it might be concatenated with the next line
                    // If it ends with a node pattern that could continue, check the next line
                    // But if it ends with a complete statement (like )-->nodeId:task:()), use it
                    // If line ends with :task:() or similar complete pattern, it's likely the full problematic line
                    // If line ends with incomplete pattern, it might be truncated
                    const endsWithCompletePattern = /\)\s*$/.test(line) || /:\w+:\{[^}]+\}\s*$/.test(line);
                    const mightBeTruncated = line.endsWith(':') || line.endsWith('(') || /:\w+:\s*$/.test(line);
                    
                    if (endsWithCompletePattern || !mightBeTruncated) {
                        snippetLine = line;
                        break;
                    } else if (mightBeTruncated && i + 1 < messageLines.length) {
                        // Check if next line continues this pattern - if so, this is likely a concatenated error
                        const nextLine = messageLines[i + 1].trim();
                        // If next line starts with a node pattern, the current line is likely truncated
                        // Extract just the part before the truncation marker (if any)
                        // For now, use the line as-is but be aware it might be truncated
                        snippetLine = line;
                        break;
                    } else {
                        snippetLine = line;
                        break;
                    }
                }
            }
        }
        
        // Store snippet and caret line from original message
        if (snippetLine) {
            // Check if snippet line contains concatenated lines (e.g., "...tevent))-->a0:task:()a0:task:()-->gw1s:")
            // Pattern: ends with a complete node pattern like :task:() or :gateway:{x} followed immediately by another node pattern
            // We want to extract only up to the first complete node pattern
            let cleanedSnippet = snippetLine.trim();
            
            // Pattern to detect concatenated lines: node pattern ending with ) or {x} followed immediately (no space) by another node ID
            // Example: "...tevent))-->a0:task:()a0:task:()-->gw1s:"
            // Should extract: "...tevent))-->a0:task:()"
            // Match: complete node pattern (ending with ) or {x}) followed immediately by node ID (alphanumeric:)
            const concatenatedPattern = /(.+?:\w+:(?:\([^)]*\)|\{[^}]+\}))([a-zA-Z0-9_]+:\w+:)/;
            const match = cleanedSnippet.match(concatenatedPattern);
            if (match) {
                // Found concatenated lines - extract only the first part (up to the first complete node pattern)
                cleanedSnippet = match[1];
            }
            
            parsed.errorSnippet = cleanedSnippet;
        }
        if (caretLine) {
            parsed.caretLine = caretLine; // Store original caret line (e.g., "-----------------------^")
        }

        // Try to extract "Expected:" and "Got:" parts (new format)
        // Format: "Expected: 'TOKEN1' or 'TOKEN2' or ...\nGot: TOKEN"
        const expectedMatch = message.match(/Expected:\s*(.+?)(?:\n|$)/i);
        const gotMatch = message.match(/Got:\s*(\S+)/i);
        
        if (expectedMatch && gotMatch) {
            // Clean up the expected part - remove quotes and 'or' separators
            let expectedText = expectedMatch[1].trim();
            // Remove quotes and 'or' to get clean list
            expectedText = expectedText.replace(/'/g, '').replace(/\s+or\s+/g, ' or ').trim();
            parsed.expecting = expectedText;
            parsed.got = gotMatch[1].trim();
        } else {
            // Try old format: "Expecting 'TOKEN1', 'TOKEN2', ..., got 'TOKEN'"
            const expectingMatch = message.match(/Expecting\s+(.+?),\s+got\s+'([^']+)'/i);
            if (expectingMatch) {
                // Clean up the expecting part - it may contain multiple quoted tokens
                let expectingText = expectingMatch[1].trim();
                // Remove trailing commas and clean up
                expectingText = expectingText.replace(/,\s*$/, '').trim();
                parsed.expecting = expectingText;
                parsed.got = expectingMatch[2];
            } else {
                // Try simpler format: "Expecting 'TOKEN', got 'TOKEN'"
                const simpleMatch = message.match(/Expecting\s+'([^']+)'[\s,]+got\s+'([^']+)'/i);
                if (simpleMatch) {
                    parsed.expecting = simpleMatch[1];
                    parsed.got = simpleMatch[2];
                }
            }
        }
        
        // Also try to extract code lines from error message if not found in snippet
        // Look for lines after "Parse error on line X:" that look like code
        if (!snippetLine && parsed.lineNumber) {
            const messageLines = message.split('\n');
            // Find the line after "Parse error on line X:"
            for (let i = 0; i < messageLines.length; i++) {
                if (messageLines[i].includes('Parse error on line')) {
                    // The next line(s) should be the code
                    if (i + 1 < messageLines.length) {
                        const codeLine1 = messageLines[i + 1].trim();
                        const codeLine2 = i + 2 < messageLines.length ? messageLines[i + 2].trim() : null;
                        // Check if these look like code (not empty, not "Expected:", not "Got:")
                        if (codeLine1 && !codeLine1.startsWith('Expected:') && !codeLine1.startsWith('Got:')) {
                            snippetLine = codeLine1;
                            if (codeLine2 && !codeLine2.startsWith('Expected:') && !codeLine2.startsWith('Got:')) {
                                // Store both lines as context
                                parsed.errorSnippet = `${codeLine1}\n${codeLine2}`;
                            } else {
                                parsed.errorSnippet = codeLine1;
                            }
                        }
                        break;
                    }
                }
            }
        }

        // Extract code context if code is available and line number is known
        if (code && parsed.lineNumber) {
            const lines = code.split('\n');
            const errorLineIndex = parsed.lineNumber - 1;
            
            if (errorLineIndex >= 0 && errorLineIndex < lines.length) {
                // Get 2-3 lines of context (1 before, error line, 1 after)
                const startLine = Math.max(0, errorLineIndex - 1);
                const endLine = Math.min(lines.length - 1, errorLineIndex + 1);
                
                // Build context lines - use snippet for error line if available
                const contextLines = [];
                for (let i = startLine; i <= endLine; i++) {
                    if (i === errorLineIndex && parsed.errorSnippet) {
                        contextLines.push(parsed.errorSnippet);
                    } else {
                        contextLines.push(lines[i]);
                    }
                }
                
                parsed.codeContext = {
                    lines: contextLines,
                    errorLineIndex: errorLineIndex - startLine,
                    startLineNumber: startLine + 1,
                    caretLine: parsed.caretLine // Include original caret line from error message
                };
            }
        }

        return parsed;
    }

    /**
     * Extract the most specific error title from the error object
     * @param {Object} categorizedError - Categorized error object
     * @returns {string} Specific error title, or fallback to generic types
     */
    static getSpecificErrorTitle(categorizedError) {
        const error = categorizedError.originalError || {};
        const message = (categorizedError.message || error.message || '').toLowerCase();
        const errorName = (error.name || categorizedError.name || '').toLowerCase();
        const validationType = error.validationType || categorizedError.validationType;

        // Validation type mapping
        const validationTypeMap = {
            'missingDiagramType': 'UnknownDiagramError',
            'emptyCode': 'EmptyCodeError',
            'invalidInput': 'InvalidInputError'
        };
        if (validationType && validationTypeMap[validationType]) {
            return validationTypeMap[validationType];
        }

        // Error name pattern mapping
        const namePatterns = [
            { patterns: ['validation'], result: 'ValidationError' },
            { patterns: ['parse', 'parsing'], result: 'ParseError' },
            { patterns: ['lexer'], result: 'LexerError' },
            { patterns: ['render', 'rendering'], result: 'RenderingError' },
            { patterns: ['diagram'], result: 'DiagramError' },
            { patterns: ['syntax'], result: 'SyntaxError' },
            { patterns: ['graph'], result: 'GraphError' }
        ];
        for (const { patterns, result } of namePatterns) {
            if (patterns.some(p => errorName.includes(p))) {
                return result;
            }
        }

        // Message pattern mapping
        const messagePatterns = [
            { patterns: ['no diagram type detected', 'unknown diagram type', 'diagram type not recognized'], result: 'UnknownDiagramError' },
            { patterns: ['parse error on line', 'parsing error', 'parse failed'], result: 'ParseError' },
            { patterns: ['syntax error', 'invalid syntax', 'unexpected token', 'unexpected character'], result: 'SyntaxError' },
            { patterns: ['validation error', 'invalid input'], result: 'ValidationError' },
            { patterns: ['empty', 'code'], result: 'EmptyCodeError', matchAll: true },
            { patterns: ['graph', 'error'], result: 'GraphError', matchAll: true },
            { patterns: ['render', 'rendering'], result: 'RenderingError' }
        ];
        for (const { patterns, result, matchAll } of messagePatterns) {
            const matches = matchAll 
                ? patterns.every(p => message.includes(p))
                : patterns.some(p => message.includes(p));
            if (matches) {
                return result;
            }
        }

        // Fallback to generic types
        return categorizedError.errorType === 'syntax' ? 'SyntaxError' 
             : categorizedError.errorType === 'rendering' ? 'GraphError' 
             : 'UnknownError';
    }

    /**
     * Display a visual error indicator (red box) in the graph container
     * @param {HTMLElement} container - Container element where the graph should be rendered
     * @param {Object} categorizedError - Categorized error object
     */
    static displayErrorIndicator(container, categorizedError) {
        if (!container) {
            console.error('MermaidErrorHandler: Cannot display error - container is null');
            return;
        }

        // Remove any existing error indicators
        this.removeErrorIndicator(container);

        // Create error box
        const errorBox = document.createElement('div');
        errorBox.className = 'mermaid-error-indicator';
        errorBox.setAttribute('data-error-type', categorizedError.errorType);

        // Create error icon
        const errorIcon = document.createElement('div');
        errorIcon.className = 'mermaid-error-indicator__icon';
        errorIcon.innerHTML = ICON_ERROR;

        // Create error header
        const errorHeader = document.createElement('div');
        errorHeader.className = 'mermaid-error-indicator__header';
        
        // Get the most specific error title
        const errorTypeText = this.getSpecificErrorTitle(categorizedError);
        
        errorHeader.appendChild(errorIcon);
        errorHeader.appendChild(document.createTextNode(` ${errorTypeText}`));

        // Parse error message
        const parsedError = this.parseErrorMessage(categorizedError.message, categorizedError.code);

        // Create error message container
        const errorMessageContainer = document.createElement('div');
        errorMessageContainer.className = 'mermaid-error-indicator__message';

        // Add parse error header if available
        if (parsedError.header) {
            const headerText = document.createElement('div');
            headerText.className = 'mermaid-error-indicator__parse-header';
            headerText.textContent = parsedError.header;
            errorMessageContainer.appendChild(headerText);
        }

        // Add code context if available
        if (parsedError.codeContext && parsedError.codeContext.lines.length > 0) {
            const codeContext = document.createElement('div');
            codeContext.className = 'mermaid-error-indicator__code-context';
            
            parsedError.codeContext.lines.forEach((line, index) => {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'mermaid-error-indicator__code-line';
                
                const isErrorLine = index === parsedError.codeContext.errorLineIndex;
                if (isErrorLine) {
                    lineDiv.classList.add('mermaid-error-indicator__code-line--error');
                }
                
                const lineNumber = document.createElement('span');
                lineNumber.className = 'mermaid-error-indicator__line-number';
                lineNumber.textContent = `${parsedError.codeContext.startLineNumber + index}: `;
                
                // Create line content wrapper
                const lineWrapper = document.createElement('div');
                lineWrapper.className = 'mermaid-error-indicator__line-wrapper';
                
                const lineContent = document.createElement('span');
                lineContent.className = 'mermaid-error-indicator__line-content';
                lineContent.textContent = line || ' ';
                
                lineWrapper.appendChild(lineContent);
                lineDiv.appendChild(lineNumber);
                lineDiv.appendChild(lineWrapper);
                
                codeContext.appendChild(lineDiv);
                
                // If this is the error line and we have a caret line, add it right after
                if (isErrorLine && parsedError.codeContext.caretLine) {
                    const caretLineDiv = document.createElement('div');
                    caretLineDiv.className = 'mermaid-error-indicator__code-line mermaid-error-indicator__code-line--caret';
                    
                    const caretLineNumber = document.createElement('span');
                    caretLineNumber.className = 'mermaid-error-indicator__line-number';
                    caretLineNumber.textContent = '  '; // Empty space to align with line numbers
                    
                    const caretLineWrapper = document.createElement('div');
                    caretLineWrapper.className = 'mermaid-error-indicator__line-wrapper';
                    
                    const caretLineContent = document.createElement('span');
                    caretLineContent.className = 'mermaid-error-indicator__line-content mermaid-error-indicator__caret-line';
                    caretLineContent.textContent = parsedError.codeContext.caretLine;
                    
                    caretLineWrapper.appendChild(caretLineContent);
                    caretLineDiv.appendChild(caretLineNumber);
                    caretLineDiv.appendChild(caretLineWrapper);
                    
                    codeContext.appendChild(caretLineDiv);
                }
            });
            
            errorMessageContainer.appendChild(codeContext);
        }

        // Add expecting/got information if available
        if (parsedError.expecting || parsedError.got) {
            const expectationInfo = document.createElement('div');
            expectationInfo.className = 'mermaid-error-indicator__expectation';
            
            if (parsedError.expecting) {
                const expectingDiv = document.createElement('div');
                expectingDiv.className = 'mermaid-error-indicator__expecting';
                const expectingLabel = document.createElement('span');
                expectingLabel.className = 'mermaid-error-indicator__label';
                expectingLabel.textContent = 'Expected: ';
                const expectingValue = document.createElement('span');
                expectingValue.className = 'mermaid-error-indicator__value';
                expectingValue.textContent = parsedError.expecting;
                expectingDiv.appendChild(expectingLabel);
                expectingDiv.appendChild(expectingValue);
                expectationInfo.appendChild(expectingDiv);
            }
            
            if (parsedError.got) {
                const gotDiv = document.createElement('div');
                gotDiv.className = 'mermaid-error-indicator__got';
                const gotLabel = document.createElement('span');
                gotLabel.className = 'mermaid-error-indicator__label';
                gotLabel.textContent = 'Got: ';
                const gotValue = document.createElement('span');
                gotValue.className = 'mermaid-error-indicator__value';
                gotValue.textContent = parsedError.got;
                gotDiv.appendChild(gotLabel);
                gotDiv.appendChild(gotValue);
                expectationInfo.appendChild(gotDiv);
            }
            
            errorMessageContainer.appendChild(expectationInfo);
        }

        // Fallback: if no parsing worked, show raw message
        if (!parsedError.header && !parsedError.expecting && !parsedError.got) {
            const fallbackMessage = document.createElement('div');
            fallbackMessage.textContent = categorizedError.message || 'An error occurred while rendering the Mermaid graph.';
            errorMessageContainer.appendChild(fallbackMessage);
        }

        // Append header and message
        errorBox.appendChild(errorHeader);
        errorBox.appendChild(errorMessageContainer);

        // Append to container
        container.appendChild(errorBox);

        console.error('🔴 Mermaid Error Indicator displayed:', {
            type: categorizedError.errorType,
            message: categorizedError.message,
            container: container.id || 'unknown'
        });
    }

    /**
     * Remove existing error indicator from container
     * @param {HTMLElement} container - Container to clean
     */
    static removeErrorIndicator(container) {
        if (!container) {
            return;
        }

        const existingIndicator = container.querySelector('.mermaid-error-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }

    /**
     * Handle a Mermaid rendering error
     * @param {Error} error - Error that occurred
     * @param {HTMLElement} container - Container where graph should be rendered
     * @param {string} mermaidCode - Mermaid code that caused the error
     * @returns {Object} Categorized error object
     */
    static handleError(error, container, mermaidCode = null) {
        console.error('❌ Mermaid rendering error caught:', error);

        // Categorize the error
        const categorizedError = this.categorizeError(error, mermaidCode);

        // Display visual indicator
        this.displayErrorIndicator(container, categorizedError);

        return categorizedError;
    }

    /**
     * Wrap Mermaid render call with error handling
     * @param {Function} renderFunction - Function that returns a Promise for Mermaid rendering
     * @param {HTMLElement} container - Container element
     * @param {string} mermaidCode - Mermaid code being rendered
     * @returns {Promise} Promise that resolves with render result or rejects with categorized error
     */
    static async wrapRenderCall(renderFunction, container, mermaidCode) {
        try {
            return await renderFunction();
        } catch (error) {
            // Handle the error and re-throw categorized error
            const categorizedError = this.handleError(error, container, mermaidCode);
            
            // Wrap in appropriate error type
            if (categorizedError.errorType === 'syntax') {
                throw new this.MermaidSyntaxError(
                    categorizedError.message,
                    categorizedError.originalError,
                    categorizedError.code
                );
            }
            
            // Re-throw with categorized information
            const wrappedError = new Error(categorizedError.message);
            wrappedError.originalError = categorizedError.originalError;
            wrappedError.categorizedError = categorizedError;
            throw wrappedError;
        }
    }
}
