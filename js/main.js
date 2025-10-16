/**
 * CPEE LLM Error Debugging Console - Main Application
 * Main application initialization and URL handling
 */

class CPEEDebugConsole {
    constructor() {
        this.currentUUID = null;
        this.currentStep = 1;
        this.logData = null;
        this.steps = [];
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing CPEE Debug Console...');
        
        // Parse URL parameters
        this.parseURLParameters();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load instance if UUID is provided
        if (this.currentUUID) {
            await this.loadInstance(this.currentUUID);
        }
        
        console.log('CPEE Debug Console initialized');
    }

    /**
     * Parse URL parameters to get UUID and step
     */
    parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        this.currentUUID = urlParams.get('uuid');
        const stepParam = urlParams.get('step');
        
        if (stepParam) {
            const step = parseInt(stepParam, 10);
            if (step > 0) {
                this.currentStep = step;
            }
        }

        console.log('URL Parameters:', { uuid: this.currentUUID, step: this.currentStep });
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Load instance button
        const loadButton = document.getElementById('load-instance');
        const viewLogButton = document.getElementById('view-log');
        const uuidInput = document.getElementById('uuid-input');
        
        if (loadButton && uuidInput) {
            loadButton.addEventListener('click', () => {
                const uuid = uuidInput.value.trim();
                if (uuid) {
                    this.loadInstance(uuid);
                    this.updateURL(uuid, 1);
                }
            });

            // Allow Enter key in UUID input
            uuidInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    loadButton.click();
                }
            });

            // Set current UUID in input if available
            if (this.currentUUID) {
                uuidInput.value = this.currentUUID;
            }
        }

        // View Log button (toggle functionality)
        if (viewLogButton && uuidInput) {
            viewLogButton.addEventListener('click', () => {
                const rawLogSection = document.getElementById('raw-log-section');
                
                if (rawLogSection && !rawLogSection.classList.contains('hidden')) {
                    // Log is currently visible, hide it
                    this.hideRawLog();
                    viewLogButton.textContent = 'View Log';
                } else {
                    // Log is hidden, show it
                    const uuid = uuidInput.value.trim();
                    if (uuid) {
                        this.viewRawLog(uuid);
                        viewLogButton.textContent = 'Hide Log';
                    } else {
                        alert('Please enter a UUID first!');
                    }
                }
            });
        }

        // Step navigation
        const prevButton = document.getElementById('prev-step');
        const nextButton = document.getElementById('next-step');

        if (prevButton) {
            prevButton.addEventListener('click', () => {
                if (this.currentStep > 1) {
                    this.navigateToStep(this.currentStep - 1);
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                if (this.currentStep < this.steps.length) {
                    this.navigateToStep(this.currentStep + 1);
                }
            });
        }

        // Tab switching
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    }

    /**
     * Load CPEE instance data
     * @param {string} uuid - CPEE instance UUID
     */
    async loadInstance(uuid) {
        try {
            console.log(`Loading instance: ${uuid}`);
            
            // Update UI to show loading state
            UI.showLoading('Loading CPEE log data...');
            
            // Fetch and parse log data
            this.logData = await LogParser.fetchAndParseLog(uuid);
            
            // Extract steps using StepAnalyzer
            this.steps = StepAnalyzer.extractSteps(this.logData);
            
            console.log(`Found ${this.steps.length} steps`);
            
            // Update current UUID
            this.currentUUID = uuid;
            
            // Update UI
            UI.displayInstance(uuid, this.steps);
            
            // Navigate to current step
            this.navigateToStep(this.currentStep);
            
        } catch (error) {
            console.error('Failed to load instance:', error);
            UI.showError(`Failed to load instance: ${error.message}`);
        }
    }

    /**
     * Navigate to a specific step
     * @param {number} stepNumber - Step number (1-based)
     */
    navigateToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > this.steps.length) {
            console.warn(`Invalid step number: ${stepNumber}`);
            return;
        }

        this.currentStep = stepNumber;
        
        // Update URL
        this.updateURL(this.currentUUID, stepNumber);
        
        // Update UI
        UI.displayStep(this.steps[stepNumber - 1], stepNumber, this.steps.length);
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        console.log(`Navigated to step ${stepNumber}`);
    }

    /**
     * Update navigation button states
     */
    updateNavigationButtons() {
        const prevButton = document.getElementById('prev-step');
        const nextButton = document.getElementById('next-step');
        const currentStepSpan = document.getElementById('current-step');

        if (prevButton) {
            prevButton.disabled = this.currentStep <= 1;
        }

        if (nextButton) {
            nextButton.disabled = this.currentStep >= this.steps.length;
        }

        if (currentStepSpan) {
            currentStepSpan.textContent = `Step ${this.currentStep} of ${this.steps.length}`;
        }
    }

    /**
     * Switch active tab
     * @param {string} tabName - Tab name to switch to
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-tab`);
        });

        console.log(`Switched to tab: ${tabName}`);
    }

    /**
     * View raw log content
     * @param {string} uuid - CPEE instance UUID
     */
    async viewRawLog(uuid) {
        try {
            console.log(`Viewing raw log for: ${uuid}`);
            
            // Show loading state
            this.showRawLogLoading();
            
            // Validate UUID format
            if (!this.isValidUUID(uuid)) {
                throw new Error('Invalid UUID format');
            }

            // Try multiple CORS proxy services
            const originalUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
            const proxies = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
                `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
                `https://cors-anywhere.herokuapp.com/${originalUrl}`,
                `https://thingproxy.freeboard.io/fetch/${originalUrl}`
            ];
            
            let response = null;
            let lastError = null;
            
            // Try each proxy until one works
            for (let i = 0; i < proxies.length; i++) {
                const proxyUrl = proxies[i];
                console.log(`Attempting proxy ${i + 1}/${proxies.length}: ${proxyUrl}`);
                
                try {
                    response = await fetch(proxyUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/plain, application/x-yaml, text/yaml'
                        }
                    });
                    
                    if (response.ok) {
                        console.log(`Success with proxy ${i + 1}: ${proxyUrl}`);
                        break;
                    } else {
                        console.log(`Proxy ${i + 1} failed with status: ${response.status}`);
                        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                } catch (error) {
                    console.log(`Proxy ${i + 1} failed with error:`, error.message);
                    lastError = error;
                    response = null;
                }
            }
            
            // If all proxies failed, show fallback option
            if (!response || !response.ok) {
                this.showCORSFallback(uuid);
                return;
            }

            const rawContent = await response.text();
            
            if (!rawContent.trim()) {
                throw new Error('Empty log file');
            }

            // Display raw log content
            this.showRawLog(rawContent, uuid);
            
        } catch (error) {
            console.error('Failed to fetch raw log:', error);
            this.showRawLogError(error.message);
        }
    }

    /**
     * Show raw log loading state
     */
    showRawLogLoading() {
        const rawLogSection = document.getElementById('raw-log-section');
        const rawLogContent = document.getElementById('raw-log-content');
        
        if (rawLogSection) {
            rawLogSection.classList.remove('hidden');
        }
        
        if (rawLogContent) {
            rawLogContent.innerHTML = '<code>Loading raw log content...</code>';
        }
    }

    /**
     * Display raw log content
     * @param {string} content - Raw log content
     * @param {string} uuid - UUID for reference
     */
    showRawLog(content, uuid) {
        const rawLogSection = document.getElementById('raw-log-section');
        const rawLogContent = document.getElementById('raw-log-content');
        
        if (rawLogSection) {
            rawLogSection.classList.remove('hidden');
        }
        
        if (rawLogContent) {
            // Update header to show just "Raw Log Content"
            const header = document.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            // Display content with proper escaping
            rawLogContent.innerHTML = `<code>${this.escapeHtml(content)}</code>`;
        }

        console.log(`Raw log displayed: ${content.length} characters`);
        
        // Update button text to "Hide Log"
        const viewLogButton = document.getElementById('view-log');
        if (viewLogButton) {
            viewLogButton.textContent = 'Hide Log';
        }
    }

    /**
     * Show raw log error
     * @param {string} errorMessage - Error message to display
     */
    showRawLogError(errorMessage) {
        const rawLogSection = document.getElementById('raw-log-section');
        const rawLogContent = document.getElementById('raw-log-content');
        
        if (rawLogSection) {
            rawLogSection.classList.remove('hidden');
        }
        
        if (rawLogContent) {
            // Update header to show just "Raw Log Content" 
            const header = document.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            rawLogContent.innerHTML = `<code style="color: var(--error-color);">Error: ${this.escapeHtml(errorMessage)}</code>`;
        }
    }

    /**
     * Hide raw log section
     */
    hideRawLog() {
        const rawLogSection = document.getElementById('raw-log-section');
        const viewLogButton = document.getElementById('view-log');
        
        if (rawLogSection) {
            rawLogSection.classList.add('hidden');
        }
        
        if (viewLogButton) {
            viewLogButton.textContent = 'View Log';
        }
    }

    /**
     * Validate UUID format
     * @param {string} uuid - UUID to validate
     * @returns {boolean} True if valid UUID format
     */
    isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show CORS fallback options
     * @param {string} uuid - UUID that failed to load
     */
    showCORSFallback(uuid) {
        const rawLogSection = document.getElementById('raw-log-section');
        const rawLogContent = document.getElementById('raw-log-content');
        
        if (rawLogSection) {
            rawLogSection.classList.remove('hidden');
        }
        
        if (rawLogContent) {
            // Update header to show just "Raw Log Content"
            const header = document.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = 'Raw Log Content';
            }
            
            const originalUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
            rawLogContent.innerHTML = `
                <div style="color: var(--error-color); margin-bottom: 1rem;">
                    <h4>❌ CORS Error: Cannot fetch log directly</h4>
                    <p>All proxy services failed. Here are your options:</p>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <h5>🔗 Option 1: Open log manually</h5>
                    <p>Click this link to view the log in a new tab:</p>
                    <a href="${originalUrl}" target="_blank" style="color: var(--primary-color); text-decoration: underline;">
                        ${originalUrl}
                    </a>
                    <p><small>Then copy-paste the content into the text area below:</small></p>
                    <textarea id="manual-log-input" placeholder="Paste the log content here..." 
                             style="width: 100%; height: 150px; font-family: monospace; margin: 0.5rem 0;"></textarea>
                    <button id="load-manual-log" style="padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Load Pasted Log
                    </button>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <h5>🛠️ Option 2: Disable CORS (Development Only)</h5>
                    <p>For Chrome, close browser completely and restart with:</p>
                    <code style="background: #f0f0f0; padding: 0.5rem; display: block; margin: 0.5rem 0;">
                        chrome.exe --disable-web-security --disable-features=VizDisplayCompositor --user-data-dir="C:/temp"
                    </code>
                </div>
                
                <div>
                    <h5>🧩 Option 3: Browser Extension</h5>
                    <p>Install a CORS extension like "CORS Unblock" from Chrome Web Store</p>
                </div>
            `;
            
            // Add event listener for manual log loading
            const loadButton = document.getElementById('load-manual-log');
            const textArea = document.getElementById('manual-log-input');
            
            if (loadButton && textArea) {
                loadButton.addEventListener('click', () => {
                    const content = textArea.value.trim();
                    if (content) {
                        this.showRawLog(content, uuid);
                    } else {
                        alert('Please paste the log content first!');
                    }
                });
            }
        }
        
        // Update button text to "Hide Log" when fallback is shown
        const viewLogButton = document.getElementById('view-log');
        if (viewLogButton) {
            viewLogButton.textContent = 'Hide Log';
        }
    }

    /**
     * Update browser URL with current state
     * @param {string} uuid - CPEE instance UUID
     * @param {number} step - Current step number
     */
    updateURL(uuid, step) {
        const url = new URL(window.location);
        url.searchParams.set('uuid', uuid);
        url.searchParams.set('step', step);
        
        // Update URL without page reload
        window.history.pushState({}, '', url);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.debugConsole = new CPEEDebugConsole();
});

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
    if (window.debugConsole) {
        window.debugConsole.parseURLParameters();
        if (window.debugConsole.currentUUID && window.debugConsole.steps.length > 0) {
            window.debugConsole.navigateToStep(window.debugConsole.currentStep);
        }
    }
});
