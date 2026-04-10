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
     * Detect if an error is a Mermaid syntax error.
     * Checks the original error AND the formatted message so that
     * diagnosed graph-render errors (whose formatted message starts
     * with "Parse error on line") are also recognised as syntax errors
     * without needing a separate flag.
     *
     * @param {Error} error - Error to check
     * @param {string} [formattedMessage] - The formatted message produced by categorizeError
     * @returns {boolean} True if it's a syntax error
     */
    static isSyntaxError(error, formattedMessage = null) {
        if (!error) {
            return false;
        }

        if (error.name === 'MermaidValidationError' || error.validationType) {
            return true;
        }

        if (error instanceof MermaidErrorHandler.MermaidSyntaxError ||
            error.errorType === 'syntax') {
            return true;
        }

        const messagesToCheck = [error.message || ''];
        if (formattedMessage) {
            messagesToCheck.push(formattedMessage);
        }

        const syntaxIndicators = [
            'syntax error',
            'parse error on line',
            'parsing error',
            'invalid syntax',
            'unexpected token',
            'unexpected character',
            'invalid character',
            'malformed',
            'parse failed',
            'lexer error',
            'no diagram type detected',
            'diagram type'
        ];

        for (const msg of messagesToCheck) {
            const lower = msg.toLowerCase();
            if (syntaxIndicators.some(ind => lower.includes(ind))) {
                return true;
            }
        }

        const errorName = (error.name || '').toLowerCase();
        return errorName.includes('syntax') ||
               errorName.includes('parse') ||
               errorName.includes('lexer');
    }

    /**
     * Categorize an error and produce a structured error object.
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
            } else if (codeToUse && this._isGraphRenderError(message)) {
                const diagResult = this._diagnoseGraphError(message, codeToUse);
                if (diagResult) {
                    formattedMessage = diagResult.formattedMessage;
                }
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

        if (this.isSyntaxError(error, formattedMessage)) {
            categorizedError.errorType = 'syntax';
            categorizedError.category = 'MermaidSyntaxError';
        } else {
            categorizedError.errorType = 'rendering';
            categorizedError.category = 'MermaidRenderingError';
        }

        return categorizedError;
    }

    /**
     * Check if an error message indicates a graph rendering crash
     * (as opposed to a parse error that already has structured info).
     * @param {string} message - Error message
     * @returns {boolean}
     */
    static _isGraphRenderError(message) {
        if (!message) return false;
        const lower = message.toLowerCase();
        if (lower.includes('parse error on line')) return false;
        return lower.includes('cannot read properties of null') ||
               lower.includes('cannot read property') ||
               lower.includes('is not a function') ||
               lower.includes('is null');
    }

    /**
     * Diagnose a graph render error by scanning the mermaid code for known
     * problematic patterns and produce a formatted error message that matches
     * the exact format of Mermaid's native ParseError output.
     *
     * Mermaid format:
     *   Parse error on line <N>:
     *   ...<truncated snippet>
     *   -----------------------^
     *   Expected: 'TOKEN1', 'TOKEN2', ...
     *   Got: TOKEN
     *
     * @param {string} _errorMessage - Original error message from Mermaid (unused, kept for signature clarity)
     * @param {string} code - Mermaid code that was being rendered
     * @returns {Object|null} { formattedMessage, issues } or null if nothing found
     */
    static _diagnoseGraphError(_errorMessage, code) {
        if (!code) return null;

        const lines = code.split('\n');

        // Empty graph: only the header line (e.g. "flowchart LR") with no nodes/edges
        const nonEmptyLines = lines.filter(l => l.trim().length > 0);
        if (nonEmptyLines.length <= 1) {
            const header = nonEmptyLines[0] || code.trim();
            let msg = `Parse error on line 1:\n${header}\n`;
            msg += `Expected: at least one node or edge definition\n`;
            msg += `Got: empty graph`;
            return { formattedMessage: msg, issues: [{ line: 1, column: 0 }] };
        }

        const patterns = [
            {
                regex: /:\(\)/,
                errorColumn: (match, line) => line.indexOf(match[0]) + 2,
                expected: "'PS', 'TAGEND', 'STR', 'MD_STR', 'UNICODE_TEXT', 'TEXT', 'TAGSTART'",
                got: 'PE'
            },
            {
                regex: /:\(\(\)\)/,
                errorColumn: (match, line) => line.indexOf(match[0]) + 3,
                expected: "'PS', 'TAGEND', 'STR', 'MD_STR', 'UNICODE_TEXT', 'TEXT', 'TAGSTART'",
                got: 'PE'
            },
            {
                regex: /:\{\}/,
                errorColumn: (match, line) => line.indexOf(match[0]) + 2,
                expected: "'STR', 'MD_STR', 'UNICODE_TEXT', 'TEXT', 'TAGSTART'",
                got: 'DIAMOND_STOP'
            },
            {
                regex: /(-->|--|\s|^)(-\d+:\S+)/,
                errorColumn: (match, line) => line.indexOf(match[2]),
                expected: "'NODE_ID', 'STR', 'MD_STR', 'UNICODE_TEXT', 'TEXT'",
                got: 'MINUS'
            },
            {
                // Unescaped pipe inside a parenthesized label: :(text|more)
                // Mermaid treats | as edge-label delimiter, not as literal text.
                regex: /:\([^)]*(?<!\\)\|/,
                errorColumn: (match, line) => {
                    const start = line.indexOf(match[0]);
                    return start + match[0].length - 1;
                },
                expected: "'SEMI', 'NEWLINE', 'SPACE', 'EOF', 'SHAPE_DATA', 'STYLE_SEPARATOR', 'START_LINK', 'LINK', 'LINK_ID'",
                got: 'PIPE'
            }
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            for (const pat of patterns) {
                const match = line.match(pat.regex);
                if (!match) continue;

                const errorCol = pat.errorColumn(match, line);

                const CONTEXT_BEFORE = 20;
                let snippet;
                let caretOffset;

                if (errorCol > CONTEXT_BEFORE) {
                    const sliceStart = errorCol - CONTEXT_BEFORE;
                    snippet = '...' + line.slice(sliceStart);
                    caretOffset = 3 + CONTEXT_BEFORE;
                } else {
                    snippet = line;
                    caretOffset = errorCol;
                }

                const caretLine = '-'.repeat(caretOffset) + '^';

                let msg = `Parse error on line ${lineNum}:\n`;
                msg += `${snippet}\n`;
                msg += `${caretLine}\n`;
                msg += `Expected: ${pat.expected}\n`;
                msg += `Got: ${pat.got}`;

                return { formattedMessage: msg, issues: [{ line: lineNum, column: errorCol }] };
            }
        }

        return null;
    }

    /**
     * Format a validation error as a Mermaid-style error message.
     * Handles missingDiagramType, invalidInput, and emptyCode.
     * @param {Error} error - Validation error with metadata
     * @returns {string} Formatted error message
     */
    static _formatValidationError(error) {
        if (!error.validationType) {
            return error.message;
        }

        if (error.validationType === 'missingDiagramType') {
            const code = error.code;
            if (!code) {
                return error.message;
            }

            const lines = code.split('\n');
            let problematicLine = lines[0] || '';
            if (problematicLine.length > 20) {
                problematicLine = problematicLine.slice(0, 20) + '...';
            }

            const expectedStr = error.expected
                ? error.expected.map(v => `'${v}'`).join(' or ')
                : "'flowchart' or 'graph'";

            let msg = `Parse error on line 1:\n${problematicLine}\n`;
            msg += `Expected: ${expectedStr}\nGot: ${error.got || 'unknown'}`;
            return msg;
        }

        if (error.validationType === 'invalidInput' || error.validationType === 'emptyCode') {
            return `Validation Error:\n${error.details || error.message}`;
        }

        return error.message;
    }

    /**
     * Parse an error message string to extract structured information
     * for display (line number, snippet, caret, expected/got).
     * @param {string} message - Error message
     * @returns {Object} Parsed error information
     */
    static parseErrorMessage(message) {
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

        for (let i = 0; i < messageLines.length; i++) {
            const line = messageLines[i];
            if (line.includes('^') && /^[-\s]*\^[-\s]*$/.test(line)) {
                caretLine = line;
                if (i > 0) {
                    snippetLine = messageLines[i - 1];
                }
                break;
            }
        }

        // If no caret was found, look for snippet lines between the header
        // and the Expected/Got lines (e.g. missingDiagramType errors).
        if (!snippetLine && parsed.lineNumber) {
            for (let i = 0; i < messageLines.length; i++) {
                const line = messageLines[i];
                if (!line.trim()) continue;
                if (/^Parse error on line/i.test(line)) continue;
                if (/^Expected:/i.test(line)) break;
                if (/^Got:/i.test(line)) break;
                snippetLine = line;
                break;
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

        const expectedMatch = message.match(/Expected:\s*(.+?)(?:\n|$)/i);
        const gotMatch = message.match(/Got:\s*(.+?)(?:\n|$)/i);

        if (expectedMatch && gotMatch) {
            parsed.expecting = expectedMatch[1].trim();
            parsed.got = gotMatch[1].trim();
        } else {
            // Mermaid older format: "Expecting 'TOKEN1', 'TOKEN2', ..., got 'TOKEN'"
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
     * Determine the error title shown in the UI error box.
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
     * @param {HTMLElement} container - Container element where the graph should be rendered
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

        const parsedError = this.parseErrorMessage(categorizedError.message);

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
