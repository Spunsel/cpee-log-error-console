/**
 * CopyButton Component
 * Provides copy-to-clipboard functionality with feedback
 * Phase 21.5: Copy Functionality
 */

import { ICONS } from '../../assets/icons.js';

export class CopyButton {
    constructor(domRegistry = null, options = {}) {
        this.domRegistry = domRegistry;
        
        // Configuration
        this.options = {
            showIcon: options.showIcon !== false,
            showText: options.showText !== false,
            successDuration: options.successDuration || 500,
            onCopySuccess: options.onCopySuccess || null,
            onCopyError: options.onCopyError || null,
            ...options
        };
        
        this.element = null;
        this.originalContent = null;
        this.isCopying = false;
    }

    /**
     * Create a copy button for content
     * @param {string} content - Content to copy
     * @param {string} buttonText - Button label
     * @returns {HTMLElement} Button element
     */
    createButton(content, buttonText = 'Copy') {
        this.content = content;
        
        const button = this.domRegistry.createElement('button', {
            className: 'copy-btn',
            type: 'button',
            title: 'Copy to clipboard'
        });

        // Store original content
        this.originalContent = buttonText;
        
        // Create button content
        const buttonContainer = this.domRegistry.createElement('span', {
            className: 'copy-btn-content'
        });

        if (this.options.showIcon) {
            // Create a wrapper span for the icon
            const iconWrapper = this.domRegistry.createElement('span', {
                className: 'copy-icon-wrapper',
                innerHTML: ICONS.COPY
            });
            buttonContainer.appendChild(iconWrapper);
        }

        if (this.options.showText) {
            const text = this.domRegistry.createElement('span', {
                className: 'copy-text',
                textContent: buttonText
            });
            buttonContainer.appendChild(text);
        }

        button.appendChild(buttonContainer);
        button.addEventListener('click', () => this.copy());

        this.element = button;
        return button;
    }

    /**
     * Copy content to clipboard
     * @returns {Promise<boolean>} Success status
     */
    async copy() {
        if (this.isCopying || !this.content) {
            return false;
        }

        this.isCopying = true;
        
        try {
            // Try modern Clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(this.content);
                this.showSuccess();
                
                if (this.options.onCopySuccess) {
                    this.options.onCopySuccess(this.content);
                }
                
                return true;
            } else {
                // Fallback for older browsers
                this.copyFallback();
                this.showSuccess();
                
                if (this.options.onCopySuccess) {
                    this.options.onCopySuccess(this.content);
                }
                
                return true;
            }
        } catch (error) {
            console.error('Copy failed:', error);
            this.showError(error.message);
            
            if (this.options.onCopyError) {
                this.options.onCopyError(error);
            }
            
            return false;
        } finally {
            this.isCopying = false;
        }
    }

    /**
     * Fallback copy method for older browsers
     * Uses textarea trick
     */
    copyFallback() {
        const textarea = document.createElement('textarea');
        textarea.value = this.content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
        } catch (error) {
            console.error('Fallback copy failed:', error);
            throw new Error('Failed to copy: ' + error.message);
        } finally {
            document.body.removeChild(textarea);
        }
    }

    /**
     * Show success feedback
     */
    showSuccess() {
        if (!this.element) { 
            return;
        }

        this.element.classList.add('copy-success');
        
        // Update button text
        if (this.options.showText) {
            const textSpan = this.element.querySelector('.copy-text');
            if (textSpan) {
                textSpan.textContent = 'Copied';
            }
        }

        // Update icon to checkmark
        if (this.options.showIcon) {
            const iconWrapper = this.element.querySelector('.copy-icon-wrapper');
            if (iconWrapper) {
                iconWrapper.innerHTML = ICONS.CHECK;
            }
        }

        // Reset after duration
        setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('copy-success');
                
                if (this.options.showText) {
                    const textSpan = this.element.querySelector('.copy-text');
                    if (textSpan) {
                        textSpan.textContent = this.originalContent;
                    }
                }

                if (this.options.showIcon) {
                    const iconWrapper = this.element.querySelector('.copy-icon-wrapper');
                    if (iconWrapper) {
                        iconWrapper.innerHTML = ICONS.COPY;
                    }
                }
            }
        }, this.options.successDuration);
    }

    /**
     * Show error feedback
     * @param {string} message - Error message
     */
    showError(message = 'Copy failed') {
        if (!this.element) {
             return;
        }

        console.error('Copy error:', message);
        this.element.classList.add('copy-error');

        if (this.options.showText) {
            const textSpan = this.element.querySelector('.copy-text');
            if (textSpan) {
                textSpan.textContent = '✗ Failed';
                textSpan.title = message;
            }
        }

        // Reset after duration
        setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('copy-error');
                
                if (this.options.showText) {
                    const textSpan = this.element.querySelector('.copy-text');
                    if (textSpan) {
                        textSpan.textContent = this.originalContent;
                    }
                }
            }
        }, this.options.successDuration);
    }

    /**
     * Set new content to copy
     * @param {string} content - New content
     */
    setContent(content) {
        this.content = content;
    }

    /**
     * Update button text
     * @param {string} text - New text
     */
    setText(text) {
        this.originalContent = text;
        if (this.element) {
            const textSpan = this.element.querySelector('.copy-text');
            if (textSpan) {
                textSpan.textContent = text;
            }
        }
    }

    /**
     * Enable/disable button
     * @param {boolean} enabled - Enable state
     */
    setEnabled(enabled) {
        if (this.element) {
            this.element.disabled = !enabled;
            this.element.classList.toggle('disabled', !enabled);
        }
    }

    /**
     * Destroy button and cleanup
     */
    destroy() {
        if (this.element) {
            this.element.removeEventListener('click', () => this.copy());
            this.element = null;
        }
        this.content = null;
        this.originalContent = null;
    }

    /**
     * Check if clipboard API is available
     * @returns {boolean} Availability
     */
    static isSupported() {
        return !!(navigator.clipboard && navigator.clipboard.writeText);
    }

    /**
     * Get browser support information
     * @returns {Object} Support info
     */
    static getBrowserSupport() {
        return {
            modern: !!(navigator.clipboard && navigator.clipboard.writeText),
            supported: this.isSupported()
        };
    }
}
