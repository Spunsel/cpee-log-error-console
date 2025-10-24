/**
 * Mermaid Syntax Processor
 * Handles Mermaid code validation, cleaning, and preprocessing
 * Separates complex syntax processing from rendering logic
 */

export class MermaidSyntaxProcessor {
    
    /**
     * Get supported Mermaid diagram types
     * @returns {string[]} Array of supported diagram types
     */
    static getSupportedDiagramTypes() {
        return [
            'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
            'stateDiagram', 'erDiagram', 'gantt', 'pie', 'journey',
            'gitgraph', 'mindmap', 'timeline'
        ];
    }
    
    /**
     * Clean and validate Mermaid code
     * @param {string} code - Raw mermaid code (can be markdown-wrapped or plain)
     * @returns {string} Cleaned and validated code
     * @throws {Error} If code is invalid
     */
    static cleanAndValidate(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('MermaidSyntaxProcessor: Invalid Mermaid code input - must be a non-empty string');
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
            throw new Error('MermaidSyntaxProcessor: Empty Mermaid code provided after cleaning');
        }

        // Basic validation - check for common mermaid diagram types
        const hasValidType = this.getSupportedDiagramTypes().some(type => 
            cleanedCode.toLowerCase().includes(type.toLowerCase())
        );

        if (!hasValidType) {
            console.warn('⚠️ Cleaned Mermaid code:', JSON.stringify(cleanedCode));
            throw new Error(`MermaidSyntaxProcessor: Mermaid code does not contain a recognized diagram type - cleaned content: "${cleanedCode.substring(0, 100)}..."`);
        }

        console.log('✅ Mermaid code validation successful');
        console.log('🔍 Cleaned Mermaid code:', cleanedCode);
        return cleanedCode;
    }

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
        
        // Fix 5: Handle malformed node references in edge labels
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
            
            if (changes.length > 0) {
                console.log('🔧 Applied fixes:', changes);
            }
        }
        
        return processedCode;
    }

    /**
     * Validate Mermaid code structure
     * @param {string} code - Mermaid code to validate
     * @returns {boolean} True if valid
     */
    static isValidStructure(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }

        // Check for supported diagram types
        return this.getSupportedDiagramTypes().some(type => 
            code.toLowerCase().includes(type.toLowerCase())
        );
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
        for (const type of this.getSupportedDiagramTypes()) {
            if (lowerCode.includes(type.toLowerCase())) {
                return type;
            }
        }
        
        return null;
    }
}
