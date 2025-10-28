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
     * @returns {string} Preprocessed code
     */
    static preprocessSyntax(code) {
        let processedCode = code;

        // Fix 1: Remove empty edge labels that cause parse errors
        // Pattern: -->|""| becomes -->
        processedCode = processedCode.replace(/-->\|""\|/g, '-->');
        
        // Also handle variations with single quotes or no quotes
        processedCode = processedCode.replace(/-->\|''\|/g, '-->');
        processedCode = processedCode.replace(/-->\|\|\|/g, '-->');
        
        // Fix 2: Handle problematic node IDs starting with numbers or special chars
        // Pattern: -1:escalate becomes N1_escalate (prefix with N, replace special chars)
        processedCode = processedCode.replace(/(\W|^)(-\d+)(:\w+)/g, (match, prefix, number, suffix) => prefix + 'N' + number.replace('-', '') + suffix.replace(':', '_'));
        
        // Fix 3: Remove spaces after node IDs that cause parsing issues
        // Pattern: "a9:task: (Task b)" becomes "a9:task:(Task b)"
        processedCode = processedCode.replace(/(\w+:\w+:)\s+(\([^)]+\))/g, '$1$2');
        
        // Fix 4: Handle triple parentheses in node shapes
        // Pattern: (((text))) becomes ((text))
        processedCode = processedCode.replace(/\(\(\(([^)]+)\)\)\)/g, '(($1))');
        
        // Fix 5: Remove empty parentheses
        processedCode = processedCode.replace(/\(\s*\)/g, '');
        
        // Fix 6: Handle malformed edge syntax
        // Pattern: A --> B --> becomes A --> B
        processedCode = processedCode.replace(/(\w+)\s*-->\s*$/gm, '$1');
        
        // Fix 7: Handle malformed node references in edge labels
        // Ensure node IDs in edge targets don't have extra spaces
        processedCode = processedCode.replace(/(\|\s*[^|]*\s*\|\s*)(\w+:\w+:)\s+(\([^)]+\))/g, '$1$2$3');
        
        console.log('🔧 Mermaid preprocessing applied');
        if (code !== processedCode) {
            console.log('📝 Preprocessing changes detected');
            console.log('Original length:', code.length, 'Processed length:', processedCode.length);
            
            // Show specific changes for debugging
            const changes = [];
            if (code.includes('|""|') && !processedCode.includes('|""|')) {
                changes.push('✅ Removed empty edge labels |""|');
            }
            if (code.includes(': (') && !processedCode.includes(': (')) {
                changes.push('✅ Fixed spaces after node IDs');
            }
            if (code.includes('(((') && !processedCode.includes('(((')) {
                changes.push('✅ Fixed triple parentheses');
            }
            if (code.includes('-1:escalate') && !processedCode.includes('-1:escalate')) {
                changes.push('✅ Fixed problematic node IDs');
            }
            if (code.includes('()') && !processedCode.includes('()')) {
                changes.push('✅ Removed empty parentheses');
            }
            if (code.includes('-->') && !processedCode.includes('-->')) {
                changes.push('✅ Fixed malformed edge syntax');
            }
            
            if (changes.length > 0) {
                console.log('🔧 Applied fixes:', changes);
            }
        }
        
        return processedCode;
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
     * @returns {string} Cleaned and validated mermaid code
     * @throws {Error} If code is invalid
     */
    static cleanAndValidate(code) {
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

        // Fix common CPEE-to-Mermaid conversion issues
        cleanedCode = this.preprocessSyntax(cleanedCode);

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
        return cleanedCode;
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
     * 
     * @param {string} content - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Cleaned content
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
