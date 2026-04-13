/**
 * Log Viewer Component
 * Handles display of raw log content
 */

import { configManager } from '../../config/ConfigManager.js';
import { buildCpeeLogXesYamlUrl } from '../../utils/url/CpeeLogUrl.js';
import { fixUtf8MojibakeIfPresent } from '../../utils/text/utf8Mojibake.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { DOMRegistry } from '../../core/DOMRegistry.js';

export class LogViewer {
    constructor(domRegistry = null, eventBus = null, stateManager = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.isVisible = false;
    }


    /**
     * Get DOM element by key with fallback to direct ID access
     * Delegates to DOMRegistry for centralized DOM management
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (this.domRegistry) {
            return this.domRegistry.getElementSafe(key);
        }
        // Fallback to direct DOM access
        return document.getElementById(key);
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
            
            // Fetch raw log using proxy for CORS handling
            const logUrl = buildCpeeLogXesYamlUrl(
                configManager.get('api.endpoints.cpeeLogs'),
                uuid
            );
            
            // Create timeout controller
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), configManager.get('network.timeouts.default'));
            
            const proxy = configManager.get('api.cors.logProxy');
            const proxyUrl = proxy + encodeURIComponent(logUrl);
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': configManager.get('api.headers.yamlAccept')
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                const content = fixUtf8MojibakeIfPresent(new TextDecoder('utf-8').decode(buffer));
                this.displayRawLog(content);
                this.updateViewLogButton('Hide Log');
            } else {
                throw new Error(`LogViewer: HTTP ${response.status} - ${response.statusText}`);
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
        this.domRegistry.addClass('rawLogSection', 'hidden');
        this.isVisible = false;
        this.updateViewLogButton('View Log');
    }

    /**
     * Show loading state for log
     */
    showLogLoading() {
        const rawLogSection = this.getElement('rawLogSection');
        const rawLogContent = this.getElement('rawLogContent');
        
        if (rawLogSection && rawLogContent) {
            this.domRegistry.removeClass('rawLogSection', 'hidden');
            rawLogContent.innerHTML = '<code>Loading log...</code>';
            this.isVisible = true;
        }
    }

    /**
     * Display raw log content
     * @param {string} content - Raw log content
     */
    displayRawLog(content) {
        const rawLogSection = this.getElement('rawLogSection');
        const rawLogContent = this.getElement('rawLogContent');
        
        if (rawLogSection && rawLogContent) {
            this.domRegistry.removeClass('rawLogSection', 'hidden');
            
            // Update header (class-based selector, not ID-based, so use querySelector directly)
            const header = document.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            // Display content
            rawLogContent.innerHTML = `<code>${DOMRegistry.escapeHtml(content)}</code>`;
            this.isVisible = true;
        }
    }

    /**
     * Show raw log error
     * @param {string} errorMessage - Error message
     */
    showRawLogError(errorMessage) {
        const rawLogSection = this.getElement('rawLogSection');
        const rawLogContent = this.getElement('rawLogContent');
        
        if (rawLogSection && rawLogContent) {
            this.domRegistry.removeClass('rawLogSection', 'hidden');
            
            // Update header (class-based selector, not ID-based, so use querySelector directly)
            const header = document.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            rawLogContent.innerHTML = `<code style="color: var(--error-color);">Error: ${DOMRegistry.escapeHtml(errorMessage)}</code>`;
            this.isVisible = true;
        }
    }

    /**
     * Show CORS fallback options
     * @param {string} uuid - Instance UUID
     */
    showCORSFallback(uuid) {
        const rawLogSection = this.getElement('rawLogSection');
        const rawLogContent = this.getElement('rawLogContent');
        
        if (rawLogSection && rawLogContent) {
            this.domRegistry.removeClass('rawLogSection', 'hidden');
            
            // Use DOMRegistry if available, fallback to querySelector
            const header = this.domRegistry 
                ? (this.domRegistry.getElement('rawLogHeader')?.querySelector('h3') || document.querySelector('.raw-log-header h3'))
                : document.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            const originalUrl = buildCpeeLogXesYamlUrl(
                configManager.get('api.endpoints.cpeeLogs'),
                uuid
            );
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
                    <textarea id="manual-log-input" style="width: 100%; height: 100px; margin-top: 0.5rem; font-family: Adwaita Mono Regular;" placeholder="Paste YAML log content here..."></textarea>
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
            const loadButton = this.getElement('loadPastedLog');
            if (loadButton) {
                loadButton.addEventListener('click', () => {
                    const textarea = this.getElement('manualLogInput');
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
        const viewLogBtn = this.getElement('viewLog');
        if (viewLogBtn) {
            viewLogBtn.textContent = text;
        }
    }
}
