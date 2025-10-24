/**
 * UserInput Model
 * Represents user input text extracted from CPEE logs during LLM modifications
 * Stores the raw user modification request/instruction
 */

export class UserInput {
    constructor(text = '') {
        this.text = text || '';
        this.extractedAt = new Date();
        this.isEmpty = this.text.trim().length === 0;
    }

    /**
     * Get the user input text
     * @returns {string} Raw user input text
     */
    getText() {
        return this.text;
    }

    /**
     * Set the user input text
     * @param {string} text - User input text
     */
    setText(text) {
        this.text = text || '';
        this.isEmpty = this.text.trim().length === 0;
        this.extractedAt = new Date();
    }

    /**
     * Get trimmed user input (whitespace removed)
     * @returns {string} Trimmed text
     */
    getTrimmed() {
        return this.text.trim();
    }

    /**
     * Get text length
     * @returns {number} Length in characters
     */
    getLength() {
        return this.text.length;
    }

    /**
     * Get trimmed text length
     * @returns {number} Length without whitespace
     */
    getTrimmedLength() {
        return this.getTrimmed().length;
    }

    /**
     * Get number of lines
     * @returns {number} Number of lines
     */
    getLineCount() {
        return this.text.split('\n').length;
    }

    /**
     * Get number of words
     * @returns {number} Approximate word count
     */
    getWordCount() {
        return this.getTrimmed().split(/\s+/).filter(w => w.length > 0).length;
    }

    /**
     * Get first line (useful for summaries)
     * @returns {string} First line of user input
     */
    getFirstLine() {
        return this.text.split('\n')[0] || '';
    }

    /**
     * Get preview of user input
     * @param {number} length - Maximum characters to show
     * @returns {string} Preview text
     */
    getPreview(length = 100) {
        const trimmed = this.getTrimmed();
        if (trimmed.length <= length) {
            return trimmed;
        }
        return trimmed.substring(0, length) + '...';
    }

    /**
     * Check if user input contains certain keywords
     * @param {string[]} keywords - Keywords to search for
     * @returns {boolean} True if any keyword found
     */
    containsKeywords(keywords) {
        const lowerText = this.text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    /**
     * Extract potential actions from user input (case-insensitive)
     * @returns {string[]} Array of action keywords found
     */
    extractActions() {
        const actions = ['add', 'remove', 'modify', 'change', 'insert', 'delete', 'replace', 'move', 'reorder', 'rename', 'create', 'update'];
        const foundActions = [];

        actions.forEach(action => {
            if (this.text.toLowerCase().includes(action)) {
                foundActions.push(action);
            }
        });

        return foundActions;
    }

    /**
     * Normalize whitespace (multiple spaces to single space)
     * @returns {string} Normalized text
     */
    normalize() {
        return this.text.replace(/\s+/g, ' ').trim();
    }

    /**
     * Check if user input is a question
     * @returns {boolean} True if ends with question mark
     */
    isQuestion() {
        return this.getTrimmed().endsWith('?');
    }

    /**
     * Check if user input is a command (starts with verb-like words)
     * @returns {boolean} True if appears to be a command
     */
    isCommand() {
        const commandPatterns = /^(add|remove|modify|change|insert|delete|replace|move|create|update|set|get|do|make)\b/i;
        return commandPatterns.test(this.getTrimmed());
    }

    /**
     * Clone this user input object
     * @returns {UserInput} New UserInput instance with same text
     */
    clone() {
        return new UserInput(this.text);
    }

    /**
     * Convert to plain object (for serialization)
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            text: this.text,
            extractedAt: this.extractedAt,
            length: this.getLength(),
            lineCount: this.getLineCount(),
            wordCount: this.getWordCount(),
            preview: this.getPreview(),
            isQuestion: this.isQuestion(),
            isCommand: this.isCommand()
        };
    }

    /**
     * Create UserInput from plain object
     * @param {Object} obj - Plain object with text
     * @returns {UserInput} New UserInput instance
     */
    static fromObject(obj) {
        const userInput = new UserInput(obj.text);
        if (obj.extractedAt) {
            userInput.extractedAt = new Date(obj.extractedAt);
        }
        return userInput;
    }

    /**
     * Create empty UserInput
     * @returns {UserInput} Empty UserInput instance
     */
    static empty() {
        return new UserInput('');
    }

    /**
     * Create UserInput from multiple text fragments
     * @param {string[]} fragments - Array of text fragments
     * @param {string} separator - Text to join fragments
     * @returns {UserInput} New UserInput with joined text
     */
    static fromFragments(fragments, separator = ' ') {
        const text = fragments.join(separator);
        return new UserInput(text);
    }
}
