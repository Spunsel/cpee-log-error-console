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

        // View Log button
        if (viewLogButton && uuidInput) {
            viewLogButton.addEventListener('click', () => {
                const uuid = uuidInput.value.trim();
                if (uuid) {
                    this.viewRawLog(uuid);
                }
            });
        }

        // Hide log button
        const hideLogButton = document.getElementById('hide-log');
        if (hideLogButton) {
            hideLogButton.addEventListener('click', () => {
                this.hideRawLog();
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

            // Fetch raw log content
            const logUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
            const response = await fetch(logUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, application/x-yaml, text/yaml'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Log not found for UUID: ${uuid}`);
                } else if (response.status === 403) {
                    throw new Error('Access denied to log file');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
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
            // Update header to show UUID
            const header = document.querySelector('.raw-log-header h3');
            if (header) {
                header.textContent = `Raw Log Content - UUID: ${uuid}`;
            }
            
            // Display content with proper escaping
            rawLogContent.innerHTML = `<code>${this.escapeHtml(content)}</code>`;
        }

        console.log(`Raw log displayed: ${content.length} characters`);
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
            rawLogContent.innerHTML = `<code style="color: var(--error-color);">Error: ${this.escapeHtml(errorMessage)}</code>`;
        }
    }

    /**
     * Hide raw log section
     */
    hideRawLog() {
        const rawLogSection = document.getElementById('raw-log-section');
        if (rawLogSection) {
            rawLogSection.classList.add('hidden');
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
