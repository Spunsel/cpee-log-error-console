/**
 * MermaidErrorHandler - Handles errors from Mermaid.js rendering
 *
 * Takes error messages produced by the Mermaid library and reformats their
 * LAYOUT for display in the error indicator box, without altering the
 * actual error content. The only special formatting is for "No diagram type
 * detected" errors from Mermaid which lack structured output.
 *
 * Provides visual feedback by displaying error indicators (red boxes)
 * in the affected graph sections.
 */

import { ICON_ERROR } from '../../assets/icons.js';

export class MermaidErrorHandler {
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
     * Detect if an error is a Mermaid syntax/parse error (as opposed to a
     * generic rendering crash).
     * @param {Error} error - Error to check
     * @returns {boolean}
     */
    static isSyntaxError(error) {
        if (!error) return false;

        if (error.name === 'MermaidValidationError' || error.validationType) return true;
        if (error instanceof MermaidErrorHandler.MermaidSyntaxError || error.errorType === 'syntax') return true;

        const message = (error.message || '').toLowerCase();
        const syntaxIndicators = [
            'syntax error', 'parse error on line', 'parse error', 'parsing error',
            'unexpected token', 'unexpected character', 'invalid character',
            'malformed', 'parse failed', 'lexer error',
            'no diagram type detected', 'diagram type',
            'expecting ', 'expected:'
        ];
        if (syntaxIndicators.some(ind => message.includes(ind))) return true;

        const errorName = (error.name || '').toLowerCase();
        return errorName.includes('syntax') || errorName.includes('parse') || errorName.includes('lexer');
    }

    /**
     * Categorize an error and produce a structured error object.
     * The error message from Mermaid is passed through as-is; only
     * "No diagram type detected" gets special formatting because Mermaid
     * doesn't produce structured output for that case.
     * @param {Error} error - Original error
     * @param {string} mermaidCode - Mermaid code that caused the error
     * @returns {Object} Categorized error object
     */
    static categorizeError(error, mermaidCode = null) {
        let formattedMessage = error?.message || 'Unknown error occurred';
        const codeToUse = error?.code || mermaidCode;

        if (error?.validationType) {
            formattedMessage = this._formatValidationError(error);
        } else {
            const message = error?.message || '';
            const noDiagramTypeMatch = message.match(
                /No diagram type detected matching given configuration for text:\s*(\w+)/i
            );
            if (noDiagramTypeMatch && codeToUse) {
                const firstLine = (codeToUse.split('\n')[0] || '').trim();
                const actualDiagramType = firstLine.split(/\s+/)[0] || noDiagramTypeMatch[1];
                error.validationType = 'missingDiagramType';
                error.code = codeToUse;
                error.expected = ['flowchart', 'graph', 'stateDiagram', 'stateDiagram-v2', 'sequenceDiagram', 'journey'];
                error.got = actualDiagramType;
                formattedMessage = this._formatValidationError(error);
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
     * Format a validation error as a Mermaid-style error message.
     * @param {Error} error - Validation error with metadata
     * @returns {string} Formatted error message
     */
    static _formatValidationError(error) {
        if (!error.validationType) return error.message;

        if (error.validationType === 'missingDiagramType') {
            const code = error.code;
            if (!code) return error.message;

            let problematicLine = (code.split('\n')[0] || '').trim();
            if (problematicLine.length > 20) {
                problematicLine = problematicLine.slice(0, 20) + '...';
            }

            const expectedStr = error.expected
                ? error.expected.map(v => `'${v}'`).join(' or ')
                : "'flowchart' or 'graph'";

            return `Parse error on line 1:\n${problematicLine}\nExpected: ${expectedStr}\nGot: ${error.got || 'unknown'}`;
        }

        if (error.validationType === 'invalidInput' || error.validationType === 'emptyCode') {
            return `Validation Error:\n${error.details || error.message}`;
        }

        return error.message;
    }

    /**
     * Parse an error message string to extract structured information
     * for display layout (line number, snippet, caret, expected/got).
     *
     * Handles two Mermaid message formats:
     *   New: "Parse error on line N:\n...snippet\n---^...\nExpecting ..., got ..."
     *   Old: "Error: Parse error on line N:\n...snippet\n---^...\nExpecting ..., got ..."
     *
     * Also normalizes "Expecting X, got Y" to Expected/Got labels.
     *
     * @param {string} message - Error message
     * @param {string} originalCode - Original mermaid code (optional, for accurate line extraction)
     * @returns {Object} Parsed error information
     */
    static parseErrorMessage(message, originalCode = null) {
        const parsed = {
            header: null,
            lineNumber: null,
            codeContext: null,
            expecting: null,
            got: null,
            rawMessage: message
        };

        const lineMatch = message.match(/Parse error on line (\d+):/i);
        if (lineMatch) {
            parsed.lineNumber = parseInt(lineMatch[1], 10);
            parsed.header = `on line ${parsed.lineNumber}:`;
        }

        const messageLines = message.split('\n');
        let snippetLine = null;
        let caretLine = null;

        // Look for the caret line (---^) and the snippet line above it
        for (let i = 0; i < messageLines.length; i++) {
            const line = messageLines[i];
            if (line.includes('^') && /^[-\s]*\^[-\s]*$/.test(line)) {
                caretLine = line;
                // If we have the original code, extract the actual line from it
                // This fixes the issue where Mermaid concatenates lines in error messages
                if (originalCode && parsed.lineNumber) {
                    const codeLines = originalCode.split('\n');
                    if (parsed.lineNumber > 0 && parsed.lineNumber <= codeLines.length) {
                        snippetLine = codeLines[parsed.lineNumber - 1];
                    } else if (i > 0) {
                        // Fallback to Mermaid's snippet if line number is out of range
                        snippetLine = messageLines[i - 1];
                    }
                } else if (i > 0) {
                    // Fallback to Mermaid's snippet if no original code available
                    snippetLine = messageLines[i - 1];
                }
                break;
            }
        }

        // Fallback: find snippet lines between header and Expected/Got
        // (for errors without a caret, like missingDiagramType)
        if (!snippetLine && parsed.lineNumber) {
            // Try to extract from original code first
            if (originalCode) {
                const codeLines = originalCode.split('\n');
                if (parsed.lineNumber > 0 && parsed.lineNumber <= codeLines.length) {
                    snippetLine = codeLines[parsed.lineNumber - 1];
                }
            }
            
            // Fallback to error message if no original code or line not found
            if (!snippetLine) {
                for (const line of messageLines) {
                    if (!line.trim()) continue;
                    if (/^(Error:\s*)*Parse error on line/i.test(line)) continue;
                    if (/^(Expected|Expecting|Got)[\s:]/i.test(line)) break;
                    snippetLine = line;
                    break;
                }
            }
        }

        if (snippetLine && caretLine) {
            parsed.originalErrorText = snippetLine + '\n' + caretLine;
            parsed.errorSnippet = snippetLine;
            parsed.caretLine = caretLine;
        } else if (snippetLine) {
            parsed.originalErrorText = snippetLine;
            parsed.errorSnippet = snippetLine;
        }

        // New format: "Expected: ...\nGot: ..."
        const expectedMatch = message.match(/Expected:\s*(.+?)(?:\n|$)/i);
        const gotMatch = message.match(/Got:\s*(.+?)(?:\n|$)/i);

        if (expectedMatch && gotMatch) {
            parsed.expecting = expectedMatch[1].trim();
            parsed.got = gotMatch[1].trim();
        } else {
            // Old Mermaid format: "Expecting 'T1', 'T2', ..., got 'T'"
            const expectingMatch = message.match(/Expecting\s+(.+?),\s+got\s+'([^']+)'/i);
            if (expectingMatch) {
                parsed.expecting = expectingMatch[1].trim().replace(/,\s*$/, '');
                parsed.got = expectingMatch[2];
            }
        }

        if (parsed.originalErrorText && parsed.lineNumber) {
            parsed.codeContext = {
                originalErrorText: parsed.originalErrorText,
                lineNumber: parsed.lineNumber,
                snippetLine: parsed.errorSnippet,
                caretLine: parsed.caretLine
            };
        }

        return parsed;
    }

    /**
     * Determine the error title shown in the UI error box header.
     * @param {Object} categorizedError - Categorized error object
     * @returns {string} Error title string
     */
    static getSpecificErrorTitle(categorizedError) {
        const error = categorizedError.originalError || {};
        const message = (categorizedError.message || error.message || '').toLowerCase();
        const errorName = (error.name || categorizedError.name || '').toLowerCase();
        const validationType = error.validationType || categorizedError.validationType;

        const validationTypeMap = {
            'missingDiagramType': 'UnknownDiagramError',
            'emptyCode': 'EmptyCodeError',
            'invalidInput': 'InvalidInputError'
        };
        if (validationType && validationTypeMap[validationType]) {
            return validationTypeMap[validationType];
        }

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

        const messagePatterns = [
            { patterns: ['no diagram type detected', 'unknown diagram type'], result: 'UnknownDiagramError' },
            { patterns: ['parse error on line', 'parse failed'], result: 'ParseError' },
            { patterns: ['syntax error', 'unexpected token', 'unexpected character'], result: 'SyntaxError' },
            { patterns: ['validation error'], result: 'ValidationError' }
        ];
        for (const { patterns, result } of messagePatterns) {
            if (patterns.some(p => message.includes(p))) {
                return result;
            }
        }

        return categorizedError.errorType === 'syntax' ? 'SyntaxError'
             : categorizedError.errorType === 'rendering' ? 'GraphError'
             : 'UnknownError';
    }

    /**
     * Display a visual error indicator (red box) in the graph container.
     * @param {HTMLElement} container - Container element
     * @param {Object} categorizedError - Categorized error object
     */
    static displayErrorIndicator(container, categorizedError) {
        if (!container) {
            console.error('MermaidErrorHandler: Cannot display error - container is null');
            return;
        }

        this.removeErrorIndicator(container);

        const errorBox = document.createElement('div');
        errorBox.className = 'mermaid-error-indicator';
        errorBox.setAttribute('data-error-type', categorizedError.errorType);

        const errorIcon = document.createElement('div');
        errorIcon.className = 'mermaid-error-indicator__icon';
        errorIcon.innerHTML = ICON_ERROR;

        const errorHeader = document.createElement('div');
        errorHeader.className = 'mermaid-error-indicator__header';
        const errorTypeText = this.getSpecificErrorTitle(categorizedError);
        errorHeader.appendChild(errorIcon);
        errorHeader.appendChild(document.createTextNode(` ${errorTypeText}`));

        const parsedError = this.parseErrorMessage(categorizedError.message, categorizedError.code);

        const errorMessageContainer = document.createElement('div');
        errorMessageContainer.className = 'mermaid-error-indicator__message';

        if (parsedError.header) {
            const headerText = document.createElement('div');
            headerText.className = 'mermaid-error-indicator__parse-header';
            headerText.textContent = parsedError.header;
            errorMessageContainer.appendChild(headerText);
        }

        if (parsedError.codeContext?.originalErrorText) {
            const codeContext = document.createElement('div');
            codeContext.className = 'mermaid-error-indicator__code-context';

            const errorTextLines = parsedError.codeContext.originalErrorText.split('\n');
            const snippetLine = errorTextLines[0] || '';
            const caretLine = errorTextLines[1] || '';

            const lineDiv = document.createElement('div');
            lineDiv.className = 'mermaid-error-indicator__code-line mermaid-error-indicator__code-line--error';

            const lineNumber = document.createElement('span');
            lineNumber.className = 'mermaid-error-indicator__line-number';
            lineNumber.textContent = `${parsedError.codeContext.lineNumber}: `;

            const lineWrapper = document.createElement('div');
            lineWrapper.className = 'mermaid-error-indicator__line-wrapper';

            const lineContent = document.createElement('span');
            lineContent.className = 'mermaid-error-indicator__line-content';
            lineContent.textContent = snippetLine;

            lineWrapper.appendChild(lineContent);
            lineDiv.appendChild(lineNumber);
            lineDiv.appendChild(lineWrapper);
            codeContext.appendChild(lineDiv);

            if (caretLine) {
                const caretLineDiv = document.createElement('div');
                caretLineDiv.className = 'mermaid-error-indicator__code-line mermaid-error-indicator__code-line--caret';

                const caretLineNumber = document.createElement('span');
                caretLineNumber.className = 'mermaid-error-indicator__line-number';
                caretLineNumber.textContent = '  ';

                const caretLineWrapper = document.createElement('div');
                caretLineWrapper.className = 'mermaid-error-indicator__line-wrapper';

                const caretLineContent = document.createElement('span');
                caretLineContent.className = 'mermaid-error-indicator__line-content mermaid-error-indicator__caret-line';
                caretLineContent.textContent = caretLine;

                caretLineWrapper.appendChild(caretLineContent);
                caretLineDiv.appendChild(caretLineNumber);
                caretLineDiv.appendChild(caretLineWrapper);
                codeContext.appendChild(caretLineDiv);
            }

            errorMessageContainer.appendChild(codeContext);
        }

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

        if (!parsedError.header && !parsedError.expecting && !parsedError.got) {
            const fallbackMessage = document.createElement('div');
            fallbackMessage.textContent = categorizedError.message || 'An error occurred while rendering the Mermaid graph.';
            errorMessageContainer.appendChild(fallbackMessage);
        }

        errorBox.appendChild(errorHeader);
        errorBox.appendChild(errorMessageContainer);
        container.appendChild(errorBox);

        console.error('🔴 Mermaid Error Indicator displayed:', {
            type: categorizedError.errorType,
            message: categorizedError.message,
            container: container.id || 'unknown'
        });
    }

    /**
     * Remove existing error indicator from container.
     * @param {HTMLElement} container - Container to clean
     */
    static removeErrorIndicator(container) {
        if (!container) return;
        const existing = container.querySelector('.mermaid-error-indicator');
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Handle a Mermaid rendering error: categorize and display.
     * @param {Error} error - Error that occurred
     * @param {HTMLElement} container - Container where graph should be rendered
     * @param {string} mermaidCode - Mermaid code that caused the error
     * @returns {Object} Categorized error object
     */
    static handleError(error, container, mermaidCode = null) {
        console.error('❌ Mermaid rendering error caught:', error);
        const categorizedError = this.categorizeError(error, mermaidCode);
        this.displayErrorIndicator(container, categorizedError);
        return categorizedError;
    }
}
