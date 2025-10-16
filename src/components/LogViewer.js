/**
 * Log Viewer Component
 * Handles display of raw log content
 */

import { DOMUtils } from '../utils/DOMUtils.js';
import { LogService } from '../services/LogService.js';

export class LogViewer {
    constructor() {
        this.isVisible = false;
    }

    /**
     * Toggle raw log display
     * @param {string} uuid - Instance UUID
     */
    async toggleRawLog(uuid) {
        if (this.isVisible) {
            this.hideRawLog();
        } else {
            await this.showRawLog(uuid);
        }
    }

    /**
     * Show raw log content
     * @param {string} uuid - Instance UUID
     */
    async showRawLog(uuid) {
        try {
            // Show loading state
            this.showLogLoading();
            
            // Fetch raw log using the same approach as LogService
            const logUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
            
            // Create timeout controller
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(LogService.CORS_PROXY + encodeURIComponent(logUrl), {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, application/x-yaml, text/yaml'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const content = await response.text();
                this.displayRawLog(content);
                this.updateViewLogButton('Hide Log');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('Error fetching raw log:', error);
            if (error.name === 'AbortError') {
                this.showRawLogError('Request timed out. The log file may be large or the server is slow.');
            } else {
                this.showCORSFallback(uuid);
            }
        }
    }

    /**
     * Hide raw log
     */
    hideRawLog() {
        DOMUtils.addClass('raw-log-section', 'hidden');
        this.isVisible = false;
        this.updateViewLogButton('View Log');
    }

    /**
     * Show loading state for log
     */
    showLogLoading() {
        const rawLogSection = DOMUtils.getElementById('raw-log-section');
        const rawLogContent = DOMUtils.getElementById('raw-log-content');
        
        if (rawLogSection && rawLogContent) {
            DOMUtils.removeClass('raw-log-section', 'hidden');
            rawLogContent.innerHTML = '<code>Loading log...</code>';
            this.isVisible = true;
        }
    }

    /**
     * Display raw log content
     * @param {string} content - Raw log content
     */
    displayRawLog(content) {
        const rawLogSection = DOMUtils.getElementById('raw-log-section');
        const rawLogContent = DOMUtils.getElementById('raw-log-content');
        
        if (rawLogSection && rawLogContent) {
            DOMUtils.removeClass('raw-log-section', 'hidden');
            
            // Update header
            const header = DOMUtils.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            // Display content
            rawLogContent.innerHTML = `<code>${DOMUtils.escapeHtml(content)}</code>`;
            this.isVisible = true;
        }
    }

    /**
     * Show raw log error
     * @param {string} errorMessage - Error message
     */
    showRawLogError(errorMessage) {
        const rawLogSection = DOMUtils.getElementById('raw-log-section');
        const rawLogContent = DOMUtils.getElementById('raw-log-content');
        
        if (rawLogSection && rawLogContent) {
            DOMUtils.removeClass('raw-log-section', 'hidden');
            
            // Update header
            const header = DOMUtils.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            rawLogContent.innerHTML = `<code style="color: var(--error-color);">Error: ${DOMUtils.escapeHtml(errorMessage)}</code>`;
            this.isVisible = true;
        }
    }

    /**
     * Show CORS fallback options
     * @param {string} uuid - Instance UUID
     */
    showCORSFallback(uuid) {
        const rawLogSection = DOMUtils.getElementById('raw-log-section');
        const rawLogContent = DOMUtils.getElementById('raw-log-content');
        
        if (rawLogSection && rawLogContent) {
            DOMUtils.removeClass('raw-log-section', 'hidden');
            
            const header = DOMUtils.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            const originalUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
            rawLogContent.innerHTML = `
                <div style="color: var(--error-color); margin-bottom: 1rem;">
                    <strong>CORS Error:</strong> Unable to fetch log directly. Try these options:
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <strong>Option 1:</strong> Open log in new tab and copy content manually:<br>
                    <a href="${originalUrl}" target="_blank" style="color: var(--primary-color);">${originalUrl}</a>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <strong>Option 2:</strong> Paste log content below:
                    <textarea id="manual-log-input" style="width: 100%; height: 100px; margin-top: 0.5rem; font-family: monospace;" placeholder="Paste YAML log content here..."></textarea>
                    <button id="load-pasted-log" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">Load Pasted Log</button>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <strong>Option 3:</strong> Disable web security in Chrome:<br>
                    <code>chrome.exe --user-data-dir=/tmp/chrome_dev --disable-web-security</code>
                </div>
                
                <div>
                    <strong>Option 4:</strong> Install a CORS browser extension
                </div>
            `;
            
            // Add event listener for pasted log
            const loadButton = DOMUtils.getElementById('load-pasted-log');
            if (loadButton) {
                loadButton.addEventListener('click', () => {
                    const textarea = DOMUtils.getElementById('manual-log-input');
                    if (textarea && textarea.value.trim()) {
                        this.displayRawLog(textarea.value.trim());
                    }
                });
            }
            
            this.isVisible = true;
            this.updateViewLogButton('Hide Log');
        }
    }

    /**
     * Update view log button text
     * @param {string} text - Button text
     */
    updateViewLogButton(text) {
        const viewLogBtn = DOMUtils.getElementById('view-log');
        if (viewLogBtn) {
            viewLogBtn.textContent = text;
        }
    }
}
