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
            'lexer error'
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
            
            // Find where the error is (start of the line for diagram type)
            const errorColumn = problematicLine.length > 0 ? 1 : 1;
            
            // Build caret indicator line (dashes up to error position, then caret)
            const caretDashes = '-'.repeat(Math.max(0, errorColumn - 1));
            const caretLine = caretDashes + '^';
            
            // Format expected values
            const expectedStr = error.expected ? 
                error.expected.map(v => `'${v}'`).join(' or ') : 
                "'flowchart' or 'graph'";
            
            // Build error message in exact Mermaid syntax error format
            let errorMessage = `Parse error on line ${errorLineNumber}:\n`;
            errorMessage += `${problematicLine}\n`;
            errorMessage += `${caretLine}\n`;
            errorMessage += `Expecting ${expectedStr}, got '${error.got || 'unknown'}'`;
            
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
            parsed.header = `Parse error on line ${parsed.lineNumber}:`;
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
        
        // Store snippet info for later matching with actual code
        if (snippetLine && caretLine) {
            parsed.errorSnippet = snippetLine.trim();
            parsed.caretPositionInSnippet = caretLine.indexOf('^') + 1; // 1-based position in snippet
        }

        // Try to extract "Expecting" and "got" parts
        // Format: "Expecting 'TOKEN1', 'TOKEN2', ..., got 'TOKEN'"
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

        // Extract code context if code is available and line number is known
        if (code && parsed.lineNumber) {
            const lines = code.split('\n');
            const errorLineIndex = parsed.lineNumber - 1;
            
            if (errorLineIndex >= 0 && errorLineIndex < lines.length) {
                const actualLine = lines[errorLineIndex];
                
                // Calculate actual error column by matching snippet to actual line
                let actualErrorColumn = null;
                if (parsed.errorSnippet && parsed.caretPositionInSnippet) {
                    const snippet = parsed.errorSnippet.trim();
                    const caretPos0Based = parsed.caretPositionInSnippet - 1; // Convert to 0-based
                    
                    if (snippet.startsWith('...')) {
                        // Truncated snippet: "...CONTENT"
                        // The visible part starts at position 3 (after "...")
                        const visiblePart = snippet.substring(3);
                        const caretInVisiblePart = caretPos0Based - 3; // Position relative to visible part start
                        
                        if (caretInVisiblePart < 0 || caretInVisiblePart >= visiblePart.length) {
                            // Invalid caret position, skip column calculation
                        } else {
                            // Strategy 1: Try to match the character at caret position
                            const caretChar = visiblePart.charAt(caretInVisiblePart);
                            
                            // Strategy 2: Find unique pattern that includes the caret
                            // Look for distinctive patterns like ":exclusivegateway:" or ": {"
                            // Try patterns from most specific to least specific
                            const patternsToTry = [
                                /:exclusivegateway:\s*\{/g,      // Most specific
                                /:\w+:\s*\{/g,                    // Node type with space before {
                                /:\s*\{/g,                        // Colon followed by space and {
                                /\w+:\w+:\s*\{/g                  // General node pattern
                            ];
                            
                            let foundMatch = false;
                            for (const pattern of patternsToTry) {
                                pattern.lastIndex = 0; // Reset regex
                                let match;
                                while ((match = pattern.exec(visiblePart)) !== null) {
                                    const patternStart = match.index;
                                    const patternEnd = patternStart + match[0].length;
                                    
                                    // Check if caret falls within this pattern
                                    if (caretInVisiblePart >= patternStart && caretInVisiblePart < patternEnd) {
                                        const patternText = match[0];
                                        const patternIndex = actualLine.indexOf(patternText);
                                        
                                        if (patternIndex !== -1) {
                                            // Calculate where in the pattern the caret falls
                                            const caretOffsetInPattern = caretInVisiblePart - patternStart;
                                            actualErrorColumn = patternIndex + caretOffsetInPattern + 1;
                                            foundMatch = true;
                                            break;
                                        }
                                    }
                                }
                                if (foundMatch) {
                                    break;
                                }
                            }
                            
                            // Strategy 3: If pattern matching failed, try finding the character at caret position
                            if (!foundMatch && caretChar && caretChar.trim() !== '') {
                                // Find all occurrences of this character in visible part
                                const charInSnippet = caretInVisiblePart;
                                // Count how many times this char appears before the caret in the snippet
                                let charCount = 0;
                                for (let i = 0; i < charInSnippet; i++) {
                                    if (visiblePart.charAt(i) === caretChar) {
                                        charCount++;
                                    }
                                }
                                
                                // Find the same occurrence in actual line
                                let actualCharCount = 0;
                                for (let i = 0; i < actualLine.length; i++) {
                                    if (actualLine.charAt(i) === caretChar) {
                                        if (actualCharCount === charCount) {
                                            actualErrorColumn = i + 1;
                                            break;
                                        }
                                        actualCharCount++;
                                    }
                                }
                            }
                        }
                    } else {
                        // Not truncated, find exact match
                        const matchIndex = actualLine.indexOf(snippet);
                        if (matchIndex !== -1) {
                            actualErrorColumn = matchIndex + parsed.caretPositionInSnippet;
                        }
                    }
                }
                
                // Get 2-3 lines of context (1 before, error line, 1 after)
                const startLine = Math.max(0, errorLineIndex - 1);
                const endLine = Math.min(lines.length - 1, errorLineIndex + 1);
                
                parsed.codeContext = {
                    lines: lines.slice(startLine, endLine + 1),
                    errorLineIndex: errorLineIndex - startLine,
                    startLineNumber: startLine + 1,
                    errorColumn: actualErrorColumn
                };
            }
        }

        return parsed;
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
        
        const errorTypeText = categorizedError.errorType === 'syntax' 
            ? 'Mermaid Syntax Error' 
            : 'Mermaid Rendering Error';
        
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
                
                if (isErrorLine && parsedError.codeContext.errorColumn) {
                    // Split line at error column and highlight the character
                    const errorCol = parsedError.codeContext.errorColumn - 1; // Convert to 0-based
                    const beforeError = line.substring(0, errorCol);
                    const atError = line.substring(errorCol, errorCol + 1) || ' ';
                    const afterError = line.substring(errorCol + 1);
                    
                    if (beforeError) {
                        const beforeSpan = document.createTextNode(beforeError);
                        lineContent.appendChild(beforeSpan);
                    }
                    
                    // Highlight the character at error position
                    const errorCharSpan = document.createElement('span');
                    errorCharSpan.className = 'mermaid-error-indicator__error-char';
                    errorCharSpan.textContent = atError;
                    lineContent.appendChild(errorCharSpan);
                    
                    if (afterError) {
                        const afterSpan = document.createTextNode(afterError);
                        lineContent.appendChild(afterSpan);
                    }
                    
                    lineWrapper.appendChild(lineContent);
                    lineDiv.appendChild(lineNumber);
                    lineDiv.appendChild(lineWrapper);
                } else {
                    // Regular line without error marker
                    lineContent.textContent = line || ' ';
                    lineWrapper.appendChild(lineContent);
                    lineDiv.appendChild(lineNumber);
                    lineDiv.appendChild(lineWrapper);
                }
                
                codeContext.appendChild(lineDiv);
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
