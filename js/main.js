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
