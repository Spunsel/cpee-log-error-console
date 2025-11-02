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
        
        // Fix 2: Handle problematic node IDs starting with numbers or special chars
        const beforeFix2 = processedCode;
        const fix2LineNumbers = findLineNumbersMultiLine(processedCode, /(\W|^)(-\d+)(:\w+)/g);
        processedCode = processedCode.replace(/(\W|^)(-\d+)(:\w+)/g, (match, prefix, number, suffix) => prefix + 'N' + number.replace('-', '') + suffix.replace(':', '_'));
        if (beforeFix2 !== processedCode) {
            appliedSteps.push({
                description: 'Fixed problematic node IDs (prefix with N, replace special chars)',
                lineNumbers: Array.from(new Set(fix2LineNumbers)).sort((a, b) => a - b)
            });
        }
        
        // Fix 3: Remove spaces after node IDs that cause parsing issues
        const beforeFix3 = processedCode;
        const fix3LineNumbers = findLineNumbersMultiLine(processedCode, /(\w+:\w+:)\s+(\([^)]+\))/g);
        processedCode = processedCode.replace(/(\w+:\w+:)\s+(\([^)]+\))/g, '$1$2');
        if (beforeFix3 !== processedCode) {
            appliedSteps.push({
                description: 'Removed spaces after node IDs',
                lineNumbers: Array.from(new Set(fix3LineNumbers)).sort((a, b) => a - b)
            });
        }
        
        // Fix 4: Handle triple parentheses in node shapes
        const beforeFix4 = processedCode;
        const fix4LineNumbers = findLineNumbersMultiLine(processedCode, /\(\(\(([^)]+)\)\)\)/g);
        processedCode = processedCode.replace(/\(\(\(([^)]+)\)\)\)/g, '(($1))');
        if (beforeFix4 !== processedCode) {
            appliedSteps.push({
                description: 'Fixed triple parentheses in node shapes',
                lineNumbers: Array.from(new Set(fix4LineNumbers)).sort((a, b) => a - b)
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
                description: 'Removed space between node type and {x}',
                lineNumbers: Array.from(new Set(fix8LineNumbers)).sort((a, b) => a - b)
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
     * @param {string} code - Mermaid code
     * @returns {string|null} Diagram type or null if not found
     */
    static extractDiagramType(code) {
        if (!code || typeof code !== 'string') {
            return null;
        }

        const lowerCode = code.toLowerCase();
        if (lowerCode.includes('flowchart')) {
            return 'flowchart';
        }
        if (lowerCode.includes('graph')) {
            return 'graph';
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
            throw new Error('MermaidParser: Invalid Mermaid code input - must be a non-empty string');
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
            throw new Error('MermaidParser: Empty Mermaid code provided after cleaning');
        }

        // Basic validation - check for flowchart diagram type (graph or flowchart)
        const lowerCode = cleanedCode.toLowerCase();
        if (!lowerCode.includes('flowchart') && !lowerCode.includes('graph')) {
            console.warn('⚠️ Cleaned Mermaid code:', JSON.stringify(cleanedCode));
            throw new Error(`MermaidParser: Mermaid code does not contain 'flowchart' or 'graph' diagram type - cleaned content: "${cleanedCode.substring(0, 100)}..."`);
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
            throw new Error('MermaidParser: Invalid Mermaid code input - must be a non-empty string');
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
