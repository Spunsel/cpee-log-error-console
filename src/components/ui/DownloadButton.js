/**
 * DownloadButton Component
 * Provides file download functionality with feedback
 */

import { ICONS } from '../../assets/icons.js';

export class DownloadButton {
    constructor(domRegistry = null, options = {}) {
        this.domRegistry = domRegistry;
        
        // Configuration
        this.options = {
            showIcon: options.showIcon !== false,
            showText: options.showText !== false,
            successDuration: options.successDuration || 500,
            onDownloadSuccess: options.onDownloadSuccess || null,
            onDownloadError: options.onDownloadError || null,
            ...options
        };
        
        this.element = null;
        this.originalContent = null;
        this.isDownloading = false;
        this.content = null;
        this.filename = null;
    }

    /**
     * Create a download button for content
     * @param {string} content - Content to download
     * @param {string} filename - Filename for download
     * @param {string} buttonText - Button label
     * @returns {HTMLElement} Button element
     */
    createButton(content, filename, buttonText = 'Download') {
        this.content = content;
        this.filename = filename;
        
        const button = this.domRegistry.createElement('button', {
            className: 'download-btn',
            type: 'button',
            title: 'Download Code'
        });

        // Store original content
        this.originalContent = buttonText;
        
        // Create button content
        const buttonContainer = this.domRegistry.createElement('span', {
            className: 'download-btn-content'
        });

        if (this.options.showIcon) {
            // Create a wrapper span for the icon
            const iconWrapper = this.domRegistry.createElement('span', {
                className: 'download-icon-wrapper',
                innerHTML: ICONS.DOWNLOAD
            });
            buttonContainer.appendChild(iconWrapper);
        }

        if (this.options.showText) {
            const text = this.domRegistry.createElement('span', {
                className: 'download-text',
                textContent: buttonText
            });
            buttonContainer.appendChild(text);
        }

        button.appendChild(buttonContainer);
        button.addEventListener('click', () => this.download());

        this.element = button;
        return button;
    }

    /**
     * Download content as a file
     * @returns {boolean} Success status
     */
    download() {
        if (this.isDownloading || !this.content || !this.filename) {
            return false;
        }

        this.isDownloading = true;
        
        try {
            // Create blob and download link
            const blob = new Blob([this.content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = this.filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            this.showSuccess();
            
            if (this.options.onDownloadSuccess) {
                this.options.onDownloadSuccess(this.filename, this.content);
            }
            
            return true;
        } catch (error) {
            console.error('Download failed:', error);
            this.showError(error.message);
            
            if (this.options.onDownloadError) {
                this.options.onDownloadError(error);
            }
            
            return false;
        } finally {
            this.isDownloading = false;
        }
    }

    /**
     * Show success feedback
     */
    showSuccess() {
        if (!this.element) { 
            return;
        }

        this.element.classList.add('download-success');
        
        // Update button text
        if (this.options.showText) {
            const textSpan = this.element.querySelector('.download-text');
            if (textSpan) {
                textSpan.textContent = 'Downloaded';
            }
        }

        // Update icon to checkmark
        if (this.options.showIcon) {
            const iconWrapper = this.element.querySelector('.download-icon-wrapper');
            if (iconWrapper) {
                iconWrapper.innerHTML = ICONS.CHECK;
            }
        }

        // Reset after duration
        setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('download-success');
                
                if (this.options.showText) {
                    const textSpan = this.element.querySelector('.download-text');
                    if (textSpan) {
                        textSpan.textContent = this.originalContent;
                    }
                }

                if (this.options.showIcon) {
                    const iconWrapper = this.element.querySelector('.download-icon-wrapper');
                    if (iconWrapper) {
                        iconWrapper.innerHTML = ICONS.DOWNLOAD;
                    }
                }
            }
        }, this.options.successDuration);
    }

    /**
     * Show error feedback
     * @param {string} message - Error message
     */
    showError(message = 'Download failed') {
        if (!this.element) {
             return;
        }

        console.error('Download error:', message);
        this.element.classList.add('download-error');

        if (this.options.showText) {
            const textSpan = this.element.querySelector('.download-text');
            if (textSpan) {
                textSpan.textContent = '✗ Failed';
                textSpan.title = message;
            }
        }

        // Reset after duration
        setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('download-error');
                
                if (this.options.showText) {
                    const textSpan = this.element.querySelector('.download-text');
                    if (textSpan) {
                        textSpan.textContent = this.originalContent;
                    }
                }
            }
        }, this.options.successDuration);
    }

    /**
     * Set new content to download
     * @param {string} content - New content
     */
    setContent(content) {
        this.content = content;
    }

    /**
     * Set new filename
     * @param {string} filename - New filename
     */
    setFilename(filename) {
        this.filename = filename;
        // Title stays as "Download Code" regardless of filename
    }

    /**
     * Update both content and filename
     * @param {string} content - New content
     * @param {string} filename - New filename
     */
    update(content, filename) {
        this.setContent(content);
        this.setFilename(filename);
    }

    /**
     * Update button text
     * @param {string} text - New text
     */
    setText(text) {
        this.originalContent = text;
        if (this.element) {
            const textSpan = this.element.querySelector('.download-text');
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
            this.element.removeEventListener('click', () => this.download());
            this.element = null;
        }
        this.content = null;
        this.filename = null;
        this.originalContent = null;
    }

    /**
     * Generate filename based on section metadata
     * @param {number} instanceNumber - CPEE instance/process number
     * @param {number} stepNumber - Step number
     * @param {string} sectionId - Section identifier (e.g., 'input-cpee', 'output-intermediate')
     * @returns {string} Generated filename
     */
    static generateFilename(instanceNumber, stepNumber, sectionId) {
        // Determine input/output (I/O)
        const isOutput = sectionId.startsWith('output');
        const ioPrefix = isOutput ? 'O' : 'I';
        
        // Determine file extension based on section type
        const isCpee = sectionId.includes('cpee');
        const extension = isCpee ? 'xml' : 'mermaid';
        
        // Format: <instance number>_Step<step number>_<I/O>.<extension>
        return `${instanceNumber}_Step${stepNumber}_${ioPrefix}.${extension}`;
    }
}

