/**
 * CPEE Parser
 * Comprehensive parsing, validation, and processing for XML/CPEE content
 * 
 * Consolidates all XML/CPEE-related functionality:
 * - XML parsing and validation
 * - CPEE tree content cleaning
 * - XML formatting and indentation
 * - CPEE-specific comment removal
 */

export class CPEEParser {
    
    /**
     * Preprocess CPEE XML syntax to fix common issues
     * @param {string} xml - Raw CPEE XML code
     * @returns {{xml: string, appliedSteps: Array<{description: string, lineNumbers: Array<number>}>}} Preprocessed XML and list of applied steps with line numbers
     */
    static preprocessSyntax(xml) {
        let processedXml = xml;
        const appliedSteps = [];
        
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
        
        // Fix 1: Replace nested double quotes in condition attributes with single quotes
        // Example: condition="data.refill == "no"" -> condition="data.refill == 'no'"
        const conditionLineNumbers = [];
        
        // Process line by line to find and fix nested quotes in condition attributes
        const lines = processedXml.split('\n');
        const updatedLines = lines.map((line, index) => {
            // Match condition attribute with potential nested quotes
            const conditionMatch = line.match(/condition\s*=\s*"/);
            if (!conditionMatch) {
                return line; // No condition attribute on this line
            }
            
            // Find the position where condition value starts (after the opening quote)
            const startPos = line.indexOf(conditionMatch[0]) + conditionMatch[0].length;
            
            // Find the closing quote of the condition attribute
            // The closing quote is followed by:
            // - space + attribute name + = (next attribute)
            // - > or /> (end of tag)
            // - end of string
            let closingQuotePos = -1;
            for (let i = startPos; i < line.length; i++) {
                if (line[i] === '"') {
                    const rest = line.substring(i + 1);
                    // Check if this quote is followed by patterns indicating end of attribute
                    if (rest.length === 0 ||                           // end of string
                        rest[0] === '>' ||                             // end of tag
                        rest.startsWith('/>') ||                       // self-closing tag
                        /^\s+[\w:]+\s*=/.test(rest) ||                 // space + next attribute (including namespaced like a:alt_id)
                        /^\s*>/.test(rest) ||                          // optional space + end of tag
                        /^\s*\/>/.test(rest)) {                        // optional space + self-closing
                        closingQuotePos = i;
                        break;
                    }
                }
            }
            
            if (closingQuotePos === -1 || closingQuotePos <= startPos) {
                return line; // No valid closing quote found
            }
            
            // Extract the content between opening and closing quotes
            const content = line.substring(startPos, closingQuotePos);
            
            // Check if content has nested double quotes (either literal " or HTML entity &quot;)
            if (content.includes('"') || content.includes('&quot;')) {
                conditionLineNumbers.push(index + 1); // 1-based line numbers
                // Replace double quotes with single quotes in the content
                // Handle both literal quotes and HTML entities
                const fixedContent = content
                    .replace(/"/g, "'")
                    .replace(/&quot;/g, "'");
                // Reconstruct the line
                return line.substring(0, startPos) + fixedContent + line.substring(closingQuotePos);
            }
            
            return line;
        });
        
        if (conditionLineNumbers.length > 0) {
            processedXml = updatedLines.join('\n');
            appliedSteps.push({
                description: `Replaced nested double quotes with single quotes in ${conditionLineNumbers.length} condition attribute${conditionLineNumbers.length > 1 ? 's' : ''}`,
                lineNumbers: conditionLineNumbers
            });
        }
        
        // Fix 2: Clean malformed a:alt_id attributes
        // Example: a:alt_id=""|a8" -> a:alt_id="a8"
        // Valid format: letters, numbers, underscores, dashes (e.g., "a8", "7", "gw1s", "my_id", "alt-1")
        const altIdLineNumbers = [];
        
        const lines2 = processedXml.split('\n');
        const updatedLines2 = lines2.map((line, index) => {
            // Find a:alt_id attribute
            const altIdMatch = line.match(/a:alt_id\s*=\s*"/);
            if (!altIdMatch) {
                return line;
            }
            
            // Find the position where alt_id value starts (after the opening quote)
            const startPos = line.indexOf(altIdMatch[0]) + altIdMatch[0].length;
            
            // Find the closing quote - similar approach to condition fix
            // The closing quote is followed by: space + attribute, >, />, or end of string
            let closingQuotePos = -1;
            for (let i = startPos; i < line.length; i++) {
                if (line[i] === '"') {
                    const rest = line.substring(i + 1);
                    if (rest.length === 0 ||
                        rest[0] === '>' ||
                        rest.startsWith('/>') ||
                        /^\s+[\w:]+\s*=/.test(rest) ||
                        /^\s*>/.test(rest) ||
                        /^\s*\/>/.test(rest)) {
                        closingQuotePos = i;
                        break;
                    }
                }
            }
            
            if (closingQuotePos === -1 || closingQuotePos <= startPos) {
                return line; // No valid closing quote found
            }
            
            // Extract the content between opening and closing quotes
            const innerValue = line.substring(startPos, closingQuotePos);
            
            // Check if it's already valid: any combination of letters, numbers, underscores, and dashes
            if (/^[a-z0-9_-]+$/i.test(innerValue)) {
                return line; // Already valid, no change needed
            }
            
            // Extract valid alt_id pattern: any alphanumeric sequence with underscores/dashes
            const validMatches = innerValue.match(/[a-z0-9_-]+/gi);
            
            if (validMatches && validMatches.length > 0) {
                altIdLineNumbers.push(index + 1); // 1-based line numbers
                // Use the last valid match (in case of ""|a8", we want "a8")
                const cleanedValue = validMatches[validMatches.length - 1];
                // Reconstruct the line with the cleaned value
                return line.substring(0, startPos) + cleanedValue + line.substring(closingQuotePos);
            }
            
            return line;
        });
        
        if (altIdLineNumbers.length > 0) {
            processedXml = updatedLines2.join('\n');
            appliedSteps.push({
                description: `Standardized ${altIdLineNumbers.length} malformed alt_id attribute${altIdLineNumbers.length > 1 ? 's' : ''} to valid format`,
                lineNumbers: altIdLineNumbers
            });
        }
        
        // Fix 3: Escape < and > characters inside attribute values (e.g., condition="Counter < 10")
        // This regex matches attribute values and escapes comparison operators inside them
        const beforeLtGtFix = processedXml;
        const ltGtLineNumbers = [];
        
        // Process the XML to escape < and > inside attribute values
        // Pattern: find attribute="value" pairs and escape < > inside the value
        processedXml = processedXml.replace(
            /(\w+\s*=\s*)(["'])([^"']*?)(["'])/g,
            (match, attrPrefix, openQuote, value, closeQuote, offset) => {
                // Check if the value contains unescaped < or >
                if (value.includes('<') || value.includes('>')) {
                    // Find line number for this match
                    const upToMatch = processedXml.substring(0, offset);
                    const lineNumber = (upToMatch.match(/\n/g) || []).length + 1;
                    ltGtLineNumbers.push(lineNumber);
                    
                    // Escape < and > but preserve already-escaped entities
                    const escapedValue = value
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    
                    return attrPrefix + openQuote + escapedValue + closeQuote;
                }
                return match;
            }
        );
        
        if (beforeLtGtFix !== processedXml) {
            const uniqueLtGtLines = Array.from(new Set(ltGtLineNumbers)).sort((a, b) => a - b);
            appliedSteps.push({
                description: `Escaped < and > characters to &lt; and &gt; in ${uniqueLtGtLines.length} attribute value${uniqueLtGtLines.length > 1 ? 's' : ''}`,
                lineNumbers: uniqueLtGtLines
            });
        }
        
        // Fix 4: Replace unescaped & with &amp;
        // Match & that is not part of an XML entity
        // Valid entities: &amp;, &lt;, &gt;, &quot;, &apos;, &#...; (character references)
        // Pattern: & not followed by valid entity pattern (# or letters/digits ending with ;)
        const beforeFix = processedXml;
        const fixLineNumbers = findLineNumbers(processedXml, /&(?![#a-zA-Z0-9]+;)/g);
        // Replace & with &amp; but only if it's not already part of an entity
        processedXml = processedXml.replace(/&(?![#a-zA-Z0-9]+;)/g, '&amp;');
        if (beforeFix !== processedXml) {
            const uniqueAmpLines = Array.from(new Set(fixLineNumbers)).sort((a, b) => a - b);
            appliedSteps.push({
                description: `Escaped ${uniqueAmpLines.length} unescaped & character${uniqueAmpLines.length > 1 ? 's' : ''} to &amp;`,
                lineNumbers: uniqueAmpLines
            });
        }
        
        return {
            xml: processedXml,
            appliedSteps: appliedSteps
        };
    }
    
    /**
     * Apply preprocessing only (without full validation)
     * Use this for Cleaned View where we want to show preprocessed content even if final validation fails
     * @param {string} xml - Raw CPEE XML code
     * @returns {{xml: string, appliedSteps: Array<{description: string, lineNumbers: Array<number>}>}} Preprocessed XML and list of applied steps
     */
    static preprocessOnly(xml) {
        if (!xml || typeof xml !== 'string') {
            return { xml: xml || '', appliedSteps: [] };
        }
        
        // Remove HTML comments
        let cleanedXml = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Normalize line endings
        cleanedXml = cleanedXml.replace(/\r\n/g, '\n');
        
        // Apply preprocessing
        const preprocessResult = this.preprocessSyntax(cleanedXml);
        
        return {
            xml: preprocessResult.xml,
            appliedSteps: preprocessResult.appliedSteps
        };
    }
    
    /**
     * Parse XML string to DOM document
     * @param {string} xmlString - XML string to parse
     * @returns {Document} Parsed XML document
     * @throws {Error} If parsing fails
     */
    static parseXML(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
            throw new Error('CPEEParser: XML string must be a non-empty string');
        }
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('CPEEParser: XML parsing error - ' + parseError.textContent);
            }
            
            return xmlDoc;
        } catch (error) {
            throw new Error('CPEEParser: Failed to parse XML - ' + error.message);
        }
    }

    /**
     * Clean CPEE tree content from log exposition and extract just the <description> block.
     * When the exposition wraps <description> inside outer elements (e.g. <testset><dslx>),
     * only the <description> subtree is returned so the Cleaned View is uncluttered.
     * 
     * @param {string} content - Raw content from exposition
     * @param {string} type - 'input' or 'output'
     * @returns {string} Cleaned content containing only the <description> block
     */
    static cleanCPEETreeContent(content, type) {
        if (!content) { 
            return content;
        }
        
        let cleaned = content;
        
        // Remove CPEE tree comments based on type
        if (type === 'input') {
            cleaned = cleaned.replace(/<!-- Input CPEE-Tree -->\s*/g, '');
        } else if (type === 'output') {
            cleaned = cleaned.replace(/<!-- Output CPEE-Tree -->\s*/g, '');
        }
        
        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();
        
        // Parse and extract just the <description> block if it is nested inside a wrapper
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(cleaned, 'text/xml');
            
            if (!xmlDoc.querySelector('parsererror')) {
                const root = xmlDoc.documentElement;
                if (root && root.tagName !== 'description') {
                    // <description> is nested inside a wrapper (e.g. <testset><dslx>)
                    const descElement = xmlDoc.querySelector('description');
                    if (descElement) {
                        return this.formatXMLWithIndentation(descElement);
                    }
                }
            }
        } catch (_e) {
            // fall through to plain formatting
        }
        
        // Root is already <description>, or the XML could not be parsed — format as-is
        return this.formatXML(cleaned);
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
            
            // Format with indentation
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
        const indent = '  '.repeat(indentLevel);
        const nextIndent = '  '.repeat(indentLevel + 1);
        
        let result = '';
        
        // Add opening tag
        result += indent + '<' + element.tagName;
        
        // Add attributes
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            result += ` ${attr.name}="${attr.value}"`;
        }
        
        // Handle content
        const children = element.childNodes;
        const hasTextContent = children.length === 1 && children[0].nodeType === Node.TEXT_NODE;
        
        if (hasTextContent) {
            // Single text node - inline format
            result += `>${children[0].textContent}</${element.tagName}>\n`;
        } else if (children.length === 0) {
            // Self-closing tag
            result += '/>\n';
        } else {
            // Multiple children - block format
            result += '>\n';
            
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === Node.ELEMENT_NODE) {
                    result += this.formatXMLWithIndentation(child, indentLevel + 1);
                } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    result += nextIndent + child.textContent.trim() + '\n';
                }
            }
            
            result += indent + `</${element.tagName}>\n`;
        }
        
        return result;
    }

    /**
     * Clean and validate CPEE XML with optional preprocessing
     * Similar to MermaidParser.cleanAndValidate but for CPEE XML
     * 
     * @param {string} xml - Raw CPEE XML string
     * @param {boolean} preprocess - Whether to apply syntax preprocessing (default: true)
     * @returns {{xml: string, appliedSteps: Array}} Cleaned and validated XML with preprocessing steps
     * @throws {Error} If XML is invalid
     */
    static cleanAndValidate(xml, preprocess = true) {
        if (!xml || typeof xml !== 'string') {
            const error = new Error('Invalid CPEE XML input');
            error.name = 'CPEEValidationError';
            error.validationType = 'invalidInput';
            error.details = 'Input must be a non-empty string';
            throw error;
        }

        // Remove HTML comments and extra whitespace
        let cleanedXml = xml.replace(/<!--[\s\S]*?-->/g, '').trim();
        
        // Remove leading whitespace
        cleanedXml = cleanedXml.replace(/^\s+/, '');

        // Extract XML from markdown code blocks if present
        const xmlBlockMatch = cleanedXml.match(/```xml\s*\n([\s\S]*?)\n\s*```/);
        if (xmlBlockMatch) {
            cleanedXml = xmlBlockMatch[1].trim();
        }

        // Remove any remaining markdown code block syntax
        cleanedXml = cleanedXml.replace(/^```.*$/gm, '').trim();
        cleanedXml = cleanedXml.replace(/```\s*$/gm, '').trim();

        // Normalize line endings
        cleanedXml = cleanedXml.replace(/\r\n/g, '\n');

        let appliedSteps = [];

        // Apply preprocessing (only if preprocess is true)
        if (preprocess) {
            const preprocessResult = this.preprocessSyntax(cleanedXml);
            cleanedXml = preprocessResult.xml;
            appliedSteps = preprocessResult.appliedSteps;
        }

        if (cleanedXml.length === 0) {
            const error = new Error('Empty CPEE XML after cleaning');
            error.name = 'CPEEValidationError';
            error.validationType = 'emptyCode';
            error.details = 'XML became empty after cleaning and preprocessing';
            error.xml = xml; // Store original XML for context
            throw error;
        }

        // Validate basic XML structure
        if (!cleanedXml.includes('<description')) {
            const error = new Error('Invalid CPEE XML - missing <description> element');
            error.name = 'CPEEValidationError';
            error.validationType = 'missingDescription';
            error.xml = cleanedXml;
            throw error;
        }

        // Try to parse the XML to validate structure
        try {
            const xmlDoc = this.parseXML(cleanedXml);
            
            // Check for required CPEE elements
            const descElement = xmlDoc.querySelector('description');
            if (!descElement) {
                const error = new Error('Missing required <description> element');
                error.name = 'CPEEValidationError';
                error.validationType = 'missingDescription';
                error.xml = cleanedXml;
                throw error;
            }
        } catch (error) {
            // If parsing fails, throw validation error
            if (error.name === 'CPEEValidationError') {
                throw error;
            }
            const validationError = new Error('Invalid XML structure - ' + error.message);
            validationError.name = 'CPEEValidationError';
            validationError.validationType = 'parseError';
            validationError.xml = cleanedXml;
            throw validationError;
        }
        
        // Return object with XML and preprocessing steps
        return {
            xml: cleanedXml,
            appliedSteps: appliedSteps
        };
    }

}
