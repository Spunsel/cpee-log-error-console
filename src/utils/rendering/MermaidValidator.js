/**
 * Mermaid Validator
 * Handles Mermaid code validation and preprocessing
 * Focused on validation and syntax fixing for flowchart diagrams
 */

export class MermaidValidator {
    
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
}
