/**
 * Text Parser
 * General text processing and cleaning utilities
 * Handles text extraction, cleaning, and normalization operations
 */

export class TextParser {
    
    /**
     * Extract clean user input text from raw log content
     * Removes headers, formatting, and normalizes whitespace
     * @param {string} content - Raw content from logs
     * @returns {string} Clean user input text
     */
    static extractCleanUserInput(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // Remove the "# User Input:" header line
        let cleanedText = content.replace(/^#\s*User\s*Input\s*:\s*$/gm, '').trim();
        
        // Remove any leading whitespace from each line (handles indentation)
        cleanedText = cleanedText.split('\n').map(line => line.trimStart()).join('\n');
        
        // Remove any additional comment patterns that might be present
        cleanedText = cleanedText.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any markdown-style formatting if present
        cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '').trim();
        
        // Clean up extra whitespace and normalize line endings
        cleanedText = cleanedText.replace(/\r\n/g, '\n');
        cleanedText = cleanedText.replace(/\n\s*\n/g, '\n');
        cleanedText = cleanedText.trim();
        
        return cleanedText;
    }
}

