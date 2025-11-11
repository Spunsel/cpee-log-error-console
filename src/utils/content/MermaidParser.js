/**
 * Mermaid Parser
 * Comprehensive parsing, validation, and preprocessing for Mermaid diagrams
 * 
 * Consolidates all Mermaid-related functionality:
 * - Syntax validation and preprocessing
 * - Content cleaning from log exposition
 * - Markdown code block extraction
 * - CPEE-specific comment removal
 */

export class MermaidParser {
    
    /**
     * Preprocess Mermaid syntax to fix common CPEE-to-Mermaid conversion issues
     * @param {string} code - Raw mermaid code
     * @returns {{code: string, appliedSteps: Array<{description: string, lineNumbers: Array<number>}>}} Preprocessed code and list of applied steps with line numbers
     */
    static preprocessSyntax(code) {
        let processedCode = code;
        const appliedSteps = [];
        const originalCode = code;
        
        // Helper function to find line numbers where a regex matches
        const findLineNumbers = (text, regex) => {
            const lines = text.split('\n');
            const lineNumbers = [];
            // Create a fresh regex for each search to avoid state issues
            const testRegex = new RegExp(regex.source, regex.flags);
            lines.forEach((line, index) => {
                if (testRegex.test(line)) {
                    lineNumbers.push(index + 1); // 1-based line numbers
                }
            });
            return lineNumbers;
        };
        
        // Helper function to find line numbers for multi-line patterns
        const findLineNumbersMultiLine = (text, regex) => {
            const lineNumbers = [];
            let match;
            // Reset regex to search from beginning
            const globalRegex = new RegExp(regex.source, regex.flags + (regex.global ? '' : 'g'));
            while ((match = globalRegex.exec(text)) !== null) {
                // Find which line this match starts on
                const beforeMatch = text.substring(0, match.index);
                const lineNumber = beforeMatch.split('\n').length;
                lineNumbers.push(lineNumber);
            }
            return lineNumbers;
        };

        // Fix 1: Remove empty edge labels that cause parse errors
        const beforeFix1 = processedCode;
        const fix1LineNumbers = new Set();
        // Find line numbers for each pattern and add them all to the set
        findLineNumbers(processedCode, /-->\|""\|/).forEach(lineNum => {
            if (lineNum !== null && lineNum !== undefined && lineNum > 0) {
                fix1LineNumbers.add(lineNum);
            }
        });
        findLineNumbers(processedCode, /-->\|''\|/).forEach(lineNum => {
            if (lineNum !== null && lineNum !== undefined && lineNum > 0) {
                fix1LineNumbers.add(lineNum);
            }
        });
        findLineNumbers(processedCode, /-->\|\|\|/).forEach(lineNum => {
            if (lineNum !== null && lineNum !== undefined && lineNum > 0) {
                fix1LineNumbers.add(lineNum);
            }
        });
        processedCode = processedCode.replace(/-->\|""\|/g, '-->');
        processedCode = processedCode.replace(/-->\|''\|/g, '-->');
        processedCode = processedCode.replace(/-->\|\|\|/g, '-->');
        if (beforeFix1 !== processedCode) {
            appliedSteps.push({
                description: 'Removed empty edge labels (|""|, |\'\'|, |||)',
                lineNumbers: Array.from(fix1LineNumbers).sort((a, b) => a - b)
            });
        }
        
        // Fix 3: Remove spaces after node IDs that cause parsing issues
        const beforeFix3 = processedCode;
        const fix3LineNumbers = findLineNumbersMultiLine(processedCode, /(\w+:\w+:)\s+(\([^)]+\))/g);
        processedCode = processedCode.replace(/(\w+:\w+:)\s+(\([^)]+\))/g, '$1$2');
        if (beforeFix3 !== processedCode) {
            appliedSteps.push({
                description: 'Removed spaces after task ID',
                lineNumbers: Array.from(new Set(fix3LineNumbers)).sort((a, b) => a - b)
            });
        }
        
        // Fix 5: Remove empty parentheses - DISABLED: preserve empty parentheses like ()
        // Removed to preserve empty parentheses in Mermaid code (e.g., a1:task:())
        
        // Fix 6: Handle malformed edge syntax
        const beforeFix6 = processedCode;
        const fix6LineNumbers = findLineNumbersMultiLine(processedCode, /(\w+)\s*-->\s*$/gm);
        processedCode = processedCode.replace(/(\w+)\s*-->\s*$/gm, '$1');
        if (beforeFix6 !== processedCode) {
            appliedSteps.push({
                description: 'Fixed malformed edge syntax',
                lineNumbers: Array.from(new Set(fix6LineNumbers)).sort((a, b) => a - b)
            });
        }
        
        // Fix 7: Handle malformed node references in edge labels
        const beforeFix7 = processedCode;
        const fix7LineNumbers = findLineNumbersMultiLine(processedCode, /(\|\s*[^|]*\s*\|\s*)(\w+:\w+:)\s+(\([^)]+\))/g);
        processedCode = processedCode.replace(/(\|\s*[^|]*\s*\|\s*)(\w+:\w+:)\s+(\([^)]+\))/g, '$1$2$3');
        if (beforeFix7 !== processedCode) {
            appliedSteps.push({
                description: 'Fixed malformed node references in edge labels',
                lineNumbers: Array.from(new Set(fix7LineNumbers)).sort((a, b) => a - b)
            });
        }
        
        // Fix 8: Remove space between node type and {x} (e.g., :exclusivegateway: {x} -> :exclusivegateway:{x})
        const beforeFix8 = processedCode;
        const fix8LineNumbers = findLineNumbersMultiLine(processedCode, /:(\w+):\s+\{x\}/g);
        processedCode = processedCode.replace(/:(\w+):\s+\{x\}/g, ':$1:{x}');
        if (beforeFix8 !== processedCode) {
            appliedSteps.push({
                description: 'Removed space after gateway ID',
                lineNumbers: Array.from(new Set(fix8LineNumbers)).sort((a, b) => a - b)
            });
            }
        
        // Fix 9: Sync gateway nodes with same ID - if one has full specification, apply to incomplete ones
        const fix9LineNumbers = [];
        
        // Pattern to match gateway nodes: id:type: or id:type:{something}
        // Matches patterns like: pg1:parallelgateway: or pg1:parallelgateway:{AND}
        const gatewayPattern = /(\w+):(\w+):(\{[^}]+\})?/g;
        const gatewayMap = new Map(); // Map<id:type, fullSpecification>
        
        // First pass: find all gateway nodes and collect their full specifications
        let match;
        // Use the pattern directly since it already has the 'g' flag
        const globalPattern = new RegExp(gatewayPattern.source, gatewayPattern.flags);
        while ((match = globalPattern.exec(processedCode)) !== null) {
            const idType = match[1] + ':' + match[2] + ':'; // e.g., "pg1:parallelgateway:"
            const specification = match[3]; // e.g., "{AND}" or undefined
            
            // If this gateway has a specification, store it
            if (specification) {
                if (!gatewayMap.has(idType) || gatewayMap.get(idType) === null) {
                    gatewayMap.set(idType, specification);
                }
            } else {
                // Mark that this ID exists but might need a specification
                if (!gatewayMap.has(idType)) {
                    gatewayMap.set(idType, null);
                }
            }
        }
        
        // Second pass: replace incomplete gateway nodes with complete ones
        const lines9 = processedCode.split('\n');
        const updatedLines = lines9.map((line, index) => {
            let updatedLine = line;
            
            // Check if this line contains a gateway node that needs completion
            gatewayMap.forEach((specification, idType) => {
                if (specification) {
                    // Create pattern to match incomplete version (id:type: not followed by {})
                    // Use word boundary and negative lookahead to avoid matching already complete ones
                    const escapedIdType = idType.replace(/:/g, '\\:');
                    const incompletePattern = new RegExp(`\\b${escapedIdType}(?!\\{[^}]+\\})`, 'g');
                    
                    // Store original line to detect changes
                    const originalLine = updatedLine;
                    // Replace incomplete gateway with complete one
                    updatedLine = updatedLine.replace(incompletePattern, idType + specification);
                    
                    // If the line changed, record the line number
                    if (updatedLine !== originalLine) {
                        fix9LineNumbers.push(index + 1); // 1-based line numbers
                    }
                }
            });
            
            return updatedLine;
        });
        
        if (fix9LineNumbers.length > 0) {
            processedCode = updatedLines.join('\n');
            appliedSteps.push({
                description: `Synchronized ${fix9LineNumbers.length} gateway node${fix9LineNumbers.length > 1 ? 's' : ''} with same ID`,
                lineNumbers: Array.from(new Set(fix9LineNumbers)).sort((a, b) => a - b)
            });
        }
        
        // Fix 10: Remove duplicate connection lines (exact duplicates)
        const lines = processedCode.split('\n');
        const seenConnections = new Map(); // Map<connectionLine, firstLineNumber>
        const duplicateLineNumbers = [];
        const filteredLines = [];
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Check if this line contains a connection (-->)
            if (trimmedLine.includes('-->')) {
                // Check if we've seen this exact connection before
                if (seenConnections.has(trimmedLine)) {
                    // This is a duplicate, mark it for removal
                    duplicateLineNumbers.push(index + 1); // 1-based line numbers
                } else {
                    // First time seeing this connection, keep it
                    seenConnections.set(trimmedLine, index + 1);
                    filteredLines.push(line);
                }
            } else {
                // Not a connection line, keep it as-is
                filteredLines.push(line);
            }
        });
        
        if (duplicateLineNumbers.length > 0) {
            processedCode = filteredLines.join('\n');
            appliedSteps.push({
                description: `Removed ${duplicateLineNumbers.length} duplicate connection${duplicateLineNumbers.length > 1 ? 's' : ''}`,
                lineNumbers: duplicateLineNumbers.sort((a, b) => a - b)
            });
        }
        
        // Fix 11: Replace double quotes with single quotes in edge labels (conditions)
        // Only replace double quotes that appear after == or = (comparison operators)
        // Pattern: |"..."| where content contains nested double quotes after == or =
        // Example: |"data.refill == "no""| -> |"data.refill == 'no'"|
        const beforeFix11 = processedCode;
        const fix11LineNumbers = [];
        const lines11 = processedCode.split('\n');
        const updatedLines11 = lines11.map((line, index) => {
            let updatedLine = line;
            let hasChanges = false;
            
            // Match edge labels: |...| 
            // Pattern to match: |"..."| where content may contain nested double quotes
            const edgeLabelPattern = /\|([^|]*)\|/g;
            
            // Replace all edge labels in this line
            updatedLine = updatedLine.replace(edgeLabelPattern, (fullMatch, labelContent) => {
                // Check if label content contains double quotes
                if (!labelContent.includes('"')) {
                    return fullMatch; // No double quotes, no change needed
                }
                
                // Check if label contains == or = followed by double quotes
                // Pattern: == or = followed by optional whitespace and then a double quote
                if (!/(==|=)\s*"/.test(labelContent)) {
                    return fullMatch; // No == or = before double quotes, no change needed
                }
                
                // Replace double quotes that come after == or = with single quotes
                // Pattern: (==|=) followed by optional whitespace, then double quote, then value, then closing double quote
                // Replace: == "value" -> == 'value' or = "value" -> = 'value'
                const fixedContent = labelContent.replace(/(==|=)\s*"([^"]*)"/g, (match, operator, value) => {
                    hasChanges = true;
                    return `${operator} '${value}'`;
                });
                
                return `|${fixedContent}|`;
            });
            
            if (hasChanges) {
                fix11LineNumbers.push(index + 1); // 1-based line numbers
            }
            
            return updatedLine;
        });
        
        if (beforeFix11 !== updatedLines11.join('\n')) {
            processedCode = updatedLines11.join('\n');
            appliedSteps.push({
                description: `Replaced double quotes with single quotes in ${fix11LineNumbers.length} edge label${fix11LineNumbers.length > 1 ? 's' : ''}`,
                lineNumbers: Array.from(new Set(fix11LineNumbers)).sort((a, b) => a - b)
            });
        }
        
        if (originalCode !== processedCode && appliedSteps.length > 0) {
            console.log('🔧 Mermaid preprocessing applied:', appliedSteps.map(s => s.description));
        }
        
        return {
            code: processedCode,
            appliedSteps: appliedSteps
        };
    }

    /**
     * Validate Mermaid code structure
     * @param {string} code - Mermaid code to validate
     * @returns {boolean} True if valid flowchart
     */
    static isValidStructure(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }

        // Check for flowchart diagram type (graph or flowchart)
        const lowerCode = code.toLowerCase();
        return lowerCode.includes('flowchart') || lowerCode.includes('graph');
    }

    /**
     * Extract diagram type from Mermaid code
     * Only extracts workflow/process-relevant diagram types for CPEE transformations
     * @param {string} code - Mermaid code
     * @returns {string|null} Diagram type or null if not found
     */
    static extractDiagramType(code) {
        if (!code || typeof code !== 'string') {
            return null;
        }

        const lowerCode = code.toLowerCase();
        
        // Only workflow/process-relevant diagram types for CPEE transformations (not all may be relevant but keep for robustness)
        // in particular: "bpmn" is not valid Mermaid graph type
        // Order matters - check more specific first
        // State diagrams - for state machine workflows
        if (lowerCode.includes('statediagram-v2')) {
            return 'stateDiagram-v2';
        }
        if (lowerCode.includes('statediagram')) {
            return 'stateDiagram';
        }
        // Sequence diagrams - for process interactions
        if (lowerCode.includes('sequencediagram')) {
            return 'sequenceDiagram';
        }
        // Flow diagrams - core workflow representation (most common for CPEE)
        if (lowerCode.includes('flowchart')) {
            return 'flowchart';
        }
        if (lowerCode.includes('graph')) {
            return 'graph';
        }
        // User journey - for user-facing workflows
        if (lowerCode.includes('journey')) {
            return 'journey';
        }
        
        return null;
    }

    /**
     * Clean and validate Mermaid code
     * Comprehensive validation and cleaning for Mermaid diagrams
     * 
     * @param {string} code - Raw mermaid code
     * @param {boolean} preprocess - Whether to apply syntax preprocessing (default: true)
     * @returns {string} Cleaned and validated mermaid code
     * @throws {Error} If code is invalid
     */
    static cleanAndValidate(code, preprocess = true) {
        if (!code || typeof code !== 'string') {
            const error = new Error('Invalid Mermaid code input');
            error.name = 'MermaidValidationError';
            error.validationType = 'invalidInput';
            error.details = 'Input must be a non-empty string';
            throw error;
        }

        // Remove HTML comments and extra whitespace
        let cleanedCode = code.replace(/<!--[\s\S]*?-->/g, '').trim();

        // Remove CPEE-style comments (e.g., "%% Output Intermediate", "%% Input Intermediate")
        cleanedCode = cleanedCode.replace(/^\s*%%.*$/gm, '').trim();

        // Extract Mermaid code from markdown code blocks
        const mermaidBlockMatch = cleanedCode.match(/```mermaid\s*\n([\s\S]*?)\n\s*```/);
        if (mermaidBlockMatch) {
            cleanedCode = mermaidBlockMatch[1].trim();
        }

        // Remove any remaining markdown code block syntax that might be incomplete
        cleanedCode = cleanedCode.replace(/^```.*$/gm, '').trim();
        cleanedCode = cleanedCode.replace(/```\s*$/gm, '').trim();

        // Remove any leading/trailing whitespace and normalize line endings
        cleanedCode = cleanedCode.replace(/^\s+|\s+$/g, '');
        cleanedCode = cleanedCode.replace(/\r\n/g, '\n');

        // Remove all indentation: all lines start at column 0
        const lines = cleanedCode.split('\n');
        cleanedCode = lines.map(line => line.trimStart()).join('\n');

        let appliedSteps = [];

        // Fix common CPEE-to-Mermaid conversion issues (only if preprocess is true)
        if (preprocess) {
            const preprocessResult = this.preprocessSyntax(cleanedCode);
            cleanedCode = preprocessResult.code;
            appliedSteps = preprocessResult.appliedSteps;
        }

        if (cleanedCode.length === 0) {
            const error = new Error('Empty Mermaid code after cleaning');
            error.name = 'MermaidValidationError';
            error.validationType = 'emptyCode';
            error.details = 'Code became empty after cleaning and preprocessing';
            error.code = code; // Store original code for context
            throw error;
        }

        // Basic validation - check for valid workflow-relevant diagram type
        const diagramType = this.extractDiagramType(cleanedCode);
        if (!diagramType) {
            // Throw error with metadata for MermaidErrorHandler to format
            const error = new Error('Missing diagram type declaration');
            error.name = 'MermaidValidationError';
            error.validationType = 'missingDiagramType';
            error.code = cleanedCode;
            error.expected = ['flowchart', 'graph', 'stateDiagram', 'stateDiagram-v2', 'sequenceDiagram', 'journey'];
            
            // Extract the diagram type that was found (if any) for error message
            // Get the full first token (e.g., "bpmn-lr" not just "bpmn")
            const lines = cleanedCode.split('\n');
            const problematicLine = lines[0] || '';
            // Extract the first token (word characters, hyphens, underscores, etc. up to first whitespace)
            const diagramTypeMatch = problematicLine.match(/^\s*([^\s]+)/);
            error.got = diagramTypeMatch ? diagramTypeMatch[1] : 'unknown';
            
            throw error;
        }

        console.log('✅ Mermaid code validation successful');
        console.log('🔍 Cleaned Mermaid code:', cleanedCode);
        
        // Return object with code and preprocessing steps
        return {
            code: cleanedCode,
            appliedSteps: appliedSteps
        };
    }

    /**
     * Clean Mermaid code (basic cleaning without validation)
     * 
     * @param {string} code - Raw mermaid code
     * @returns {string} Cleaned mermaid code
     * @throws {Error} If code is invalid
     */
    static cleanMermaidCode(code) {
        if (!code || typeof code !== 'string') {
            const error = new Error('Invalid Mermaid code input');
            error.name = 'MermaidValidationError';
            error.validationType = 'invalidInput';
            error.details = 'Input must be a non-empty string';
            throw error;
        }

        // Remove HTML comments and extra whitespace
        let cleanedCode = code.replace(/<!--[\s\S]*?-->/g, '').trim();

        // Remove CPEE-style comments
        cleanedCode = cleanedCode.replace(/^\s*%%.*$/gm, '').trim();

        // Extract Mermaid code from markdown code blocks
        const mermaidBlockMatch = cleanedCode.match(/```mermaid\s*\n([\s\S]*?)\n\s*```/);
        if (mermaidBlockMatch) {
            cleanedCode = mermaidBlockMatch[1].trim();
        }

        // Remove any remaining markdown code block syntax
        cleanedCode = cleanedCode.replace(/^```.*$/gm, '').trim();
        cleanedCode = cleanedCode.replace(/```\s*$/gm, '').trim();

        // Remove any leading/trailing whitespace and normalize line endings
        cleanedCode = cleanedCode.replace(/^\s+|\s+$/g, '');
        cleanedCode = cleanedCode.replace(/\r\n/g, '\n');

        // Apply syntax preprocessing
        cleanedCode = this.preprocessSyntax(cleanedCode);

        return cleanedCode;
    }

    /**
     * Clean Mermaid content from log exposition
     * Removes all indentation: all lines start at column 0
     * 
     * @param {string} content - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Cleaned content with all indentation removed
     */
    static cleanMermaidContent(content, type) {
        if (!content) { 
            return content;
        }
        
        let cleaned = content;
        
        // Remove Mermaid comments
        if (type === 'input') {
            cleaned = cleaned.replace(/%% Input Intermediate\s*/g, '');
        } else if (type === 'output') {
            cleaned = cleaned.replace(/%% Output Intermediate\s*/g, '');
        }
        
        // Remove markdown code block markers
        cleaned = cleaned.replace(/```mermaid\s*/g, '');
        cleaned = cleaned.replace(/```\s*$/g, '');
        
        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();
        
        // Remove all indentation: all lines start at column 0
        const lines = cleaned.split('\n');
        cleaned = lines.map(line => line.trimStart()).join('\n');
        
        return cleaned;
    }

    /**
     * Minimal cleaning for log view - only removes comments, markdown markers, and removes indentation
     * Used for displaying un-preprocessed Mermaid code from logs
     * Removes all indentation: all lines start at column 0
     * 
     * @param {string} content - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Minimally cleaned content with all indentation removed
     */
    static cleanMermaidForLogView(content, type) {
        if (!content) { 
            return content;
        }
        
        let cleaned = content;
        
        // Remove Mermaid comments (%% Input Intermediate or %% Output Intermediate)
        if (type === 'input') {
            cleaned = cleaned.replace(/^\s*%%\s*Input\s+Intermediate\s*$/gm, '');
        } else if (type === 'output') {
            cleaned = cleaned.replace(/^\s*%%\s*Output\s+Intermediate\s*$/gm, '');
        }
        
        // Remove markdown code block markers at the start
        cleaned = cleaned.replace(/^\s*```\s*mermaid\s*\n?/i, '');
        
        // Remove markdown code block markers at the end
        cleaned = cleaned.replace(/\n?\s*```\s*$/g, '');
        
        // Remove all indentation: all lines start at column 0
        const lines = cleaned.split('\n');
        cleaned = lines.map(line => line.trimStart()).join('\n');
        
        // Trim leading/trailing whitespace
        cleaned = cleaned.trim();
        
        return cleaned;
    }

    /**
     * Extract content from markdown code blocks
     * Common utility for handling ```mermaid blocks
     * 
     * @param {string} content - Content containing markdown blocks
     * @param {string} language - Language identifier (e.g., 'mermaid')
     * @returns {string} Extracted content or original if no blocks found
     */
    static extractFromMarkdownBlocks(content, language = 'mermaid') {
        if (!content) {
            return content;
        }

        const pattern = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\\s*\`\`\``);
        const match = content.match(pattern);
        
        if (match) {
            return match[1].trim();
        }
        
        return content;
    }

    /**
     * Normalize whitespace and line endings
     * Common utility for consistent formatting
     * 
     * @param {string} content - Content to normalize
     * @returns {string} Normalized content
     */
    static normalizeWhitespace(content) {
        if (!content) {
            return content;
        }
        
        // Remove leading/trailing whitespace
        let normalized = content.replace(/^\s+|\s+$/g, '');
        
        // Normalize line endings
        normalized = normalized.replace(/\r\n/g, '\n');
        
        return normalized;
    }
}
