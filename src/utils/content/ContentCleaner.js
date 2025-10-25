/**
 * Content Cleaner - Unified content cleaning and validation utility
 * 
 * Consolidates all content cleaning and validation logic from:
 * - XMLProcessor.js (cleanAndValidate, cleanMermaidCode)
 * - MermaidSyntaxProcessor.js (cleanAndValidate)
 * - LogService.js (cleanCPEETreeContent, cleanMermaidContent)
 * - CPEEWfAdaptorRenderer.js (cleanAndValidateXML wrapper)
 * 
 * Provides a single source of truth for content preprocessing with
 * direct implementation instead of delegation for better performance.
 */

export class ContentCleaner {
    
    /**
     * Parse XML string to DOM document
     * @param {string} xmlString - XML string to parse
     * @returns {Document} Parsed XML document
     * @throws {Error} If parsing fails
     */
    static parseXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
            throw new Error('ContentCleaner: XML string must be a non-empty string');
        }
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('ContentCleaner: XML parsing error - ' + parseError.textContent);
            }
            
            return xmlDoc;
        } catch (error) {
            throw new Error('ContentCleaner: Failed to parse XML - ' + error.message);
        }
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
        
        // Fix 5: Remove empty parentheses
        processedCode = processedCode.replace(/\(\s*\)/g, '');
        
        // Fix 6: Handle malformed edge syntax
        // Pattern: A --> B --> becomes A --> B
        processedCode = processedCode.replace(/(\w+)\s*-->\s*$/gm, '$1');
        
        return processedCode;
    }
    
    /**
     * Clean and validate CPEE XML content
     * Direct implementation of XMLProcessor.cleanAndValidate() functionality
     * 
     * @param {string} xml - Raw XML string
     * @returns {string} Cleaned and validated XML
     * @throws {Error} If XML is invalid
     */
    static cleanAndValidateCPEEXML(xml) {
        if (!xml || typeof xml !== 'string') {
            throw new Error('ContentCleaner: Invalid XML input - must be a non-empty string');
        }

        // Remove HTML comments and extra whitespace
        let cleanedXML = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove any leading whitespace and newlines
        cleanedXML = cleanedXML.replace(/^\s+/, '');
        
        // If no XML declaration, add one
        if (!cleanedXML.startsWith('<?xml')) {
            cleanedXML = '<?xml version="1.0"?>\n' + cleanedXML;
        }
        
        // Validate basic XML structure
        if (!cleanedXML.includes('<description')) {
            throw new Error('ContentCleaner: Invalid CPEE XML - missing <description> element');
        }
        
        // Parse and validate the XML structure
        try {
            const xmlDoc = this.parseXML(cleanedXML);
            
            // Ensure we have a proper description element
            const descElement = xmlDoc.querySelector('description');
            if (!descElement) {
                throw new Error('ContentCleaner: No valid <description> element found');
            }
            
            console.log('✅ XML validation successful');
            return cleanedXML;
            
        } catch (error) {
            console.error('❌ XML validation failed:', error);
            throw new Error('ContentCleaner: Invalid XML structure - ' + error.message);
        }
    }
    
    /**
     * Clean and validate Mermaid code
     * Direct implementation of MermaidSyntaxProcessor.cleanAndValidate() functionality
     * 
     * @param {string} code - Raw mermaid code
     * @returns {string} Cleaned and validated mermaid code
     * @throws {Error} If code is invalid
     */
    static cleanAndValidateMermaid(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('ContentCleaner: Invalid Mermaid code input - must be a non-empty string');
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
            throw new Error('ContentCleaner: Empty Mermaid code provided after cleaning');
        }

        // Basic validation - check for flowchart diagram type (graph or flowchart)
        const lowerCode = cleanedCode.toLowerCase();
        if (!lowerCode.includes('flowchart') && !lowerCode.includes('graph')) {
            console.warn('⚠️ Cleaned Mermaid code:', JSON.stringify(cleanedCode));
            throw new Error(`ContentCleaner: Mermaid code does not contain 'flowchart' or 'graph' diagram type - cleaned content: "${cleanedCode.substring(0, 100)}..."`);
        }

        console.log('✅ Mermaid code validation successful');
        console.log('🔍 Cleaned Mermaid code:', cleanedCode);
        return cleanedCode;
    }
    
    /**
     * Clean Mermaid code (basic cleaning without validation)
     * Direct implementation of XMLProcessor.cleanMermaidCode() functionality
     * 
     * @param {string} code - Raw mermaid code
     * @returns {string} Cleaned mermaid code
     * @throws {Error} If code is invalid
     */
    static cleanMermaidCode(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('ContentCleaner: Invalid Mermaid code input - must be a non-empty string');
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

        // Normalize line endings
        cleanedCode = cleanedCode.replace(/^\s+|\s+$/g, '');
        cleanedCode = cleanedCode.replace(/\r\n/g, '\n');

        return cleanedCode;
    }
    
    /**
     * Clean CPEE tree content from log exposition
     * Direct implementation of LogService.cleanCPEETreeContent() functionality
     * 
     * @param {string} content - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Cleaned content
     */
    static cleanCPEETreeContent(content, type) {
        if (!content) { 
            return content;
        }
        
        let cleaned = content;
        
        // Remove HTML comments
        if (type === 'input') {
            cleaned = cleaned.replace(/<!-- Input CPEE-Tree -->\s*/g, '');
        } else if (type === 'output') {
            cleaned = cleaned.replace(/<!-- Output CPEE-Tree -->\s*/g, '');
        }
        
        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();
        
        // Format XML with proper indentation
        cleaned = this.formatXML(cleaned);
        
        return cleaned;
    }
    
    /**
     * Format XML with proper indentation
     * @param {string} xml - XML string to format
     * @returns {string} Formatted XML with proper indentation
     */
    static formatXML(xml) {
        if (!xml || typeof xml !== 'string') {
            return xml;
        }
        
        try {
            // Parse the XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                // If parsing fails, return original XML
                return xml;
            }
            
            // Format with proper indentation using a simpler approach
            return this.formatXMLWithIndentation(xmlDoc.documentElement);
        } catch (error) {
            // If any error occurs, return original XML
            return xml;
        }
    }
    
    /**
     * Format XML element with proper indentation
     * @param {Element} element - XML element to format
     * @param {number} indentLevel - Current indentation level
     * @returns {string} Formatted XML string
     */
    static formatXMLWithIndentation(element, indentLevel = 0) {
        const indentSize = 2;
        const indent = ' '.repeat(indentLevel * indentSize);
        
        if (!element) {
            return '';
        }
        
        // Handle text nodes
        if (element.nodeType === Node.TEXT_NODE) {
            return element.textContent.trim();
        }
        
        // Handle element nodes
        if (element.nodeType === Node.ELEMENT_NODE) {
            const tagName = element.tagName;
            const attributes = Array.from(element.attributes)
                .map(attr => `${attr.name}="${attr.value}"`)
                .join(' ');
            
            const hasAttributes = attributes.length > 0;
            const hasChildren = element.children.length > 0;
            const hasTextContent = element.textContent.trim() && element.children.length === 0;
            
            if (hasTextContent) {
                // Element with only text content - keep inline
                const textContent = element.textContent.trim();
                return `${indent}<${tagName}${hasAttributes ? ' ' + attributes : ''}>${textContent}</${tagName}>\n`;
            } else if (hasChildren) {
                // Element with child elements
                let result = `${indent}<${tagName}${hasAttributes ? ' ' + attributes : ''}>\n`;
                
                // Process child elements
                for (const child of element.children) {
                    result += this.formatXMLWithIndentation(child, indentLevel + 1);
                }
                
                result += `${indent}</${tagName}>\n`;
                return result;
            } else {
                // Self-closing element
                return `${indent}<${tagName}${hasAttributes ? ' ' + attributes : ''}/>\n`;
            }
        }
        
        return '';
    }
    
    /**
     * Clean Mermaid content from log exposition
     * Direct implementation of LogService.cleanMermaidContent() functionality
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
     * Clean and validate XML (wrapper for CPEEWfAdaptorRenderer compatibility)
     * Direct implementation of CPEEWfAdaptorRenderer.cleanAndValidateXML() functionality
     * 
     * @param {string} xml - Raw XML string
     * @returns {string} Cleaned and validated XML
     * @throws {Error} If XML is invalid
     */
    static cleanAndValidateXML(xml) {
        return this.cleanAndValidateCPEEXML(xml);
    }
    
    /**
     * Comprehensive content cleaning pipeline
     * Applies all cleaning steps for maximum content purity
     * 
     * @param {string} content - Raw content
     * @param {string} contentType - 'xml', 'mermaid', 'cpee-tree', 'mermaid-content'
     * @param {string} type - 'input' or 'output' (for log content)
     * @returns {string} Fully cleaned content
     * @throws {Error} If content is invalid
     */
    static cleanContent(content, contentType, type = null) {
        if (!content || typeof content !== 'string') {
            throw new Error('ContentCleaner: Invalid content input - must be a non-empty string');
        }
        
        switch (contentType) {
            case 'xml':
                return this.cleanAndValidateCPEEXML(content);
                
            case 'mermaid':
                return this.cleanAndValidateMermaid(content);
                
            case 'cpee-tree':
                if (!type) {
                    throw new Error('ContentCleaner: Type parameter required for CPEE tree content');
                }
                return this.cleanCPEETreeContent(content, type);
                
            case 'mermaid-content':
                if (!type) {
                    throw new Error('ContentCleaner: Type parameter required for Mermaid content');
                }
                return this.cleanMermaidContent(content, type);
                
            default:
                throw new Error(`ContentCleaner: Unknown content type '${contentType}'`);
        }
    }
    
    /**
     * Remove HTML comments from content
     * Common utility used across multiple cleaning methods
     * 
     * @param {string} content - Content to clean
     * @returns {string} Content with HTML comments removed
     */
    static removeHTMLComments(content) {
        if (!content) {
            return content;
        }
        return content.replace(/<!--[\s\S]*?-->/g, '').trim();
    }
    
    /**
     * Remove CPEE-style comments from content
     * Common utility for removing %% comments
     * 
     * @param {string} content - Content to clean
     * @returns {string} Content with CPEE comments removed
     */
    static removeCPEEComments(content) {
        if (!content) {
            return content;
        }
        return content.replace(/^\s*%%.*$/gm, '').trim();
    }
    
    /**
     * Extract content from markdown code blocks
     * Common utility for handling ```mermaid blocks
     * 
     * @param {string} content - Content that may contain markdown blocks
     * @param {string} language - Language identifier (e.g., 'mermaid')
     * @returns {string} Extracted content from code blocks
     */
    static extractFromMarkdownBlocks(content, language = 'mermaid') {
        if (!content) {
            return content;
        }
        
        const blockMatch = content.match(new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\\s*\`\`\``));
        if (blockMatch) {
            return blockMatch[1].trim();
        }
        
        // Remove any remaining markdown code block syntax
        let cleaned = content.replace(/^```.*$/gm, '').trim();
        cleaned = cleaned.replace(/```\s*$/gm, '').trim();
        
        return cleaned;
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
