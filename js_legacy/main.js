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
        this.instances = {};
        
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
        
        // Show default state initially (no instance selected)
        this.showDefaultState();
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

        // Header step navigation removed

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
            
            // Fetch and parse log data
            this.logData = await LogParser.fetchAndParseLog(uuid);
            
            console.log('Raw parsed events:', this.logData.length, 'events total');
            
            // Parse steps from exposition events
            const steps = this.parseStepsFromLog(this.logData);
            
            console.log(`Found ${steps.length} steps`);
            console.log('Steps:', steps);
            
            if (steps.length === 0) {
                alert(`No steps found in log for instance ${uuid}`);
                return;
            }
            
            // Store instance data
            if (!this.instances) {
                this.instances = {};
            }
            this.instances[uuid] = {
                steps: steps,
                uuid: uuid
            };
            
            // Add instance tab to sidebar (but don't display content yet)
            this.addInstanceTab(uuid);
            
            // Clear the input field
            const uuidInput = document.getElementById('uuid-input');
            if (uuidInput) {
                uuidInput.value = '';
            }
            
            console.log(`Instance ${uuid} loaded successfully and added to sidebar`);
            
        } catch (error) {
            console.error('Failed to load instance:', error);
            alert(`Failed to load instance: ${error.message}`);
        }
    }
    
    /**
     * Parse steps from log data by grouping exposition events by change_uuid
     * @param {Array} logData - Parsed log events
     * @returns {Array} Array of step objects, sorted chronologically
     */
    parseStepsFromLog(logData) {
        // Find all exposition events
        const expositionEvents = logData.filter(event => {
            return event.event && event.event['cpee:lifecycle:transition'] === 'description/exposition';
        });
        
        console.log(`Found ${expositionEvents.length} exposition events`);
        if (expositionEvents.length > 0) {
            console.log('Sample exposition event:', expositionEvents[0]);
        }
        
        // Group by change_uuid
        const stepGroups = {};
        expositionEvents.forEach(event => {
            const changeUuid = event.event['cpee:change_uuid'];
            const timestamp = event.event['time:timestamp'];
            
            if (changeUuid) {
                if (!stepGroups[changeUuid]) {
                    stepGroups[changeUuid] = {
                        changeUuid: changeUuid,
                        events: [],
                        timestamp: timestamp // Use first event's timestamp for sorting
                    };
                }
                stepGroups[changeUuid].events.push(event.event);
                
                // Keep earliest timestamp for step ordering
                if (timestamp < stepGroups[changeUuid].timestamp) {
                    stepGroups[changeUuid].timestamp = timestamp;
                }
            }
        });
        
        // Convert to array and sort chronologically
        const steps = Object.values(stepGroups).sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Extract content from each step
        return steps.map((step, index) => {
            const content = this.extractStepContent(step.events);
            return {
                stepNumber: index + 1,
                changeUuid: step.changeUuid,
                timestamp: step.timestamp,
                content: content
            };
        });
    }
    
    /**
     * Extract the 5 content types from step events
     * @param {Array} events - Events for a single step
     * @returns {Object} Content object with 5 sections
     */
    extractStepContent(events) {
        const content = {
            inputCpeeTree: 'Not found',
            inputIntermediate: 'Not found', 
            userInput: 'Not found',
            outputIntermediate: 'Not found',
            outputCpeeTree: 'Not found'
        };
        
        events.forEach(event => {
            const exposition = event['cpee:exposition'] || '';
            
            if (exposition.includes('<!-- Input CPEE-Tree -->')) {
                content.inputCpeeTree = exposition;
            } else if (exposition.includes('%% Input Intermediate')) {
                content.inputIntermediate = exposition;
            } else if (exposition.includes('# User Input:')) {
                content.userInput = exposition;
            } else if (exposition.includes('%% Output Intermediate')) {
                content.outputIntermediate = exposition;
            } else if (exposition.includes('<!-- Output CPEE-Tree -->')) {
                content.outputCpeeTree = exposition;
            }
        });
        
        return content;
    }
    
    /**
     * Display a specific step
     * @param {number} stepIndex - Index of step to display
     */
    displayStep(stepIndex) {
        if (!this.steps || stepIndex < 0 || stepIndex >= this.steps.length) {
            return;
        }
        
        this.currentStepIndex = stepIndex;
        const step = this.steps[stepIndex];
        
        console.log(`Displaying step ${stepIndex + 1}/${this.steps.length}`);
        
        // Hide step details, show process analysis
        document.getElementById('step-details').classList.add('hidden');
        document.getElementById('process-analysis').classList.remove('hidden');
        
        // Update step header
        const stepHeader = document.querySelector('#process-analysis h2');
        if (stepHeader) {
            stepHeader.textContent = `Step ${step.stepNumber} of ${this.steps.length}`;
        }
        
        // Update content sections
        this.updateSectionContent('input-cpee-content', step.content.inputCpeeTree);
        this.updateSectionContent('input-intermediate-content', step.content.inputIntermediate);  
        this.updateSectionContent('user-input-content', step.content.userInput);
        this.updateSectionContent('output-intermediate-content', step.content.outputIntermediate);
        this.updateSectionContent('output-cpee-content', step.content.outputCpeeTree);
        
        // Update navigation buttons
        this.updateStepNavigation();
    }
    
    /**
     * Setup step navigation UI
     */
    setupStepNavigation() {
        // Add navigation controls if they don't exist
        let navContainer = document.getElementById('step-navigation');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'step-navigation';
            navContainer.className = 'step-navigation';
            navContainer.innerHTML = `
                <button id="prev-step" class="nav-btn">← Previous</button>
                <span id="step-counter">Step 1 of 1</span>
                <button id="next-step" class="nav-btn">Next →</button>
            `;
            
            // Insert before process analysis
            const processAnalysis = document.getElementById('process-analysis');
            processAnalysis.parentNode.insertBefore(navContainer, processAnalysis);
        }
        
        // Add event listeners
        document.getElementById('prev-step').onclick = () => this.previousStep();
        document.getElementById('next-step').onclick = () => this.nextStep();
        
        this.updateStepNavigation();
    }
    
    /**
     * Update step navigation state
     */
    updateStepNavigation() {
        if (!this.steps) return;
        
        const prevBtn = document.getElementById('prev-step');
        const nextBtn = document.getElementById('next-step');
        const counter = document.getElementById('step-counter');
        
        if (prevBtn && nextBtn && counter) {
            prevBtn.disabled = this.currentStepIndex === 0;
            nextBtn.disabled = this.currentStepIndex === this.steps.length - 1;
            counter.textContent = `Step ${this.currentStepIndex + 1} of ${this.steps.length}`;
        }
    }
    
    /**
     * Navigate to previous step
     */
    previousStep() {
        if (this.currentStepIndex > 0) {
            this.displayStep(this.currentStepIndex - 1);
        }
    }
    
    /**
     * Navigate to next step
     */
    nextStep() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.displayStep(this.currentStepIndex + 1);
        }
    }

    /**
     * Show default state when no instance is selected
     */
    showDefaultState() {
        const stepDetails = document.getElementById('step-details');
        const processAnalysis = document.getElementById('process-analysis');
        
        if (stepDetails) {
            stepDetails.classList.remove('hidden');
        }
        
        if (processAnalysis) {
            processAnalysis.classList.add('hidden');
        }
        
        // Clear current instance data
        this.steps = null;
        this.currentStepIndex = 0;
        this.currentUUID = null;
    }

    /**
     * Add instance tab to sidebar
     * @param {string} uuid - Instance UUID
     */
    addInstanceTab(uuid) {
        const instanceTabs = document.getElementById('instance-tabs');
        if (!instanceTabs) return;

        // Remove "no instances" message
        const noInstances = instanceTabs.querySelector('.no-instances');
        if (noInstances) {
            noInstances.remove();
        }

        // Check if tab already exists
        const existingTab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (existingTab) {
            // Just activate existing tab
            this.setActiveTab(uuid);
            return;
        }

        // Create new tab (not active by default)
        const tabElement = document.createElement('div');
        tabElement.className = 'instance-tab';
        tabElement.dataset.uuid = uuid;
        tabElement.textContent = uuid;
        
        // Add click handler
        tabElement.addEventListener('click', () => {
            this.setActiveTab(uuid);
        });

        instanceTabs.appendChild(tabElement);
        
        // Remove "no instances" message if it exists
        const noInstancesMsg = instanceTabs.querySelector('.no-instances');
        if (noInstancesMsg) {
            noInstancesMsg.remove();
        }
    }

    /**
     * Set active tab and display its content
     * @param {string} uuid - UUID of tab to activate
     */
    setActiveTab(uuid) {
        const instanceTabs = document.getElementById('instance-tabs');
        if (!instanceTabs) return;

        instanceTabs.querySelectorAll('.instance-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.uuid === uuid);
        });

        // Load and display the instance content
        if (this.instances && this.instances[uuid]) {
            console.log(`Displaying content for instance: ${uuid}`);
            
            // Set current instance data
            this.steps = this.instances[uuid].steps;
            this.currentStepIndex = 0;
            this.currentUUID = uuid;
            
            // Display first step
            this.displayStep(0);
            
            // Setup step navigation
            this.setupStepNavigation();
        } else {
            console.error(`Instance ${uuid} not found in loaded instances`);
        }
    }


    /**
     * Update content in a section
     * @param {string} elementId - ID of element to update
     * @param {string} content - Content to display
     */
    updateSectionContent(elementId, content) {
        const element = document.getElementById(elementId);
        if (element) {
            const code = element.querySelector('code');
            if (code) {
                code.textContent = content;
            }
        }
    }

    /**
     * Show instance error
     * @param {string} message - Error message
     */
    showInstanceError(message) {
        const processAnalysis = document.getElementById('process-analysis');
        if (processAnalysis) {
            processAnalysis.classList.remove('hidden');
            this.updateSectionContent('input-cpee-content', `Error: ${message}`);
            this.updateSectionContent('input-intermediate-content', '');
            this.updateSectionContent('user-input-content', '');
            this.updateSectionContent('output-intermediate-content', '');
            this.updateSectionContent('output-cpee-content', '');
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
        
        // Header navigation buttons removed
        
        console.log(`Navigated to step ${stepNumber}`);
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
