/**
 * CPEE Debug Console - Main Application Controller
 * Coordinates all components and services
 */

import { URLUtils } from '../utils/URLUtils.js';
import { LogService } from '../services/LogService.js';
import { InstanceService } from '../services/InstanceService.js';
import { CPEEService } from '../services/CPEEService.js';
import { Sidebar } from '../components/Sidebar.js';
import { StepViewer } from '../components/StepViewer.js';
import { LogViewer } from '../components/LogViewer.js';

export class CPEEDebugConsole {
    constructor() {
        // Initialize services
        this.instanceService = new InstanceService();
        
        // Initialize components
        this.sidebar = new Sidebar(this.instanceService);
        this.stepViewer = new StepViewer(this.instanceService);
        this.logViewer = new LogViewer();
        
        // Set up component callbacks
        this.setupComponentCallbacks();
        
        // Initialize application
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing CPEE Debug Console...');
        
        // Parse URL parameters
        const urlParams = URLUtils.parseParameters();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load instance if UUID is provided
        if (urlParams.uuid) {
            await this.loadInstance(urlParams.uuid);
            if (this.instanceService.hasInstance(urlParams.uuid)) {
                this.sidebar.setActiveTab(urlParams.uuid);
                this.displayInstance(urlParams.uuid, urlParams.step - 1);
            }
        } else {
            // Show default state
            this.stepViewer.showDefaultState();
        }
        
        console.log('CPEE Debug Console initialized');
    }

    /**
     * Setup callbacks between components
     */
    setupComponentCallbacks() {
        // When instance is selected in sidebar
        this.sidebar.setOnInstanceSelect((uuid) => {
            this.displayInstance(uuid);
        });

        // When step changes in step viewer
        this.stepViewer.setOnStepChange((stepIndex) => {
            URLUtils.updateURL(this.instanceService.currentUUID, stepIndex + 1);
        });
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Get UI elements
        const loadButton = document.getElementById('load-instance');
        const viewLogButton = document.getElementById('view-log');
        const fetchUuidButton = document.getElementById('fetch-uuid');
        const uuidInput = document.getElementById('uuid-input');
        const processNumberInput = document.getElementById('process-number-input');
        
        // Load instance button
        if (loadButton && uuidInput) {
            loadButton.addEventListener('click', async () => {
                const uuid = uuidInput.value.trim();
                if (uuid) {
                    await this.loadInstance(uuid);
                } else {
                    alert('Please use "Fetch UUID" from process number first.');
                }
            });
        }
        
        // Fetch UUID button
        if (fetchUuidButton && processNumberInput && uuidInput) {
            fetchUuidButton.addEventListener('click', async () => {
                const processNumber = processNumberInput.value.trim();
                if (processNumber) {
                    await this.fetchUUIDFromProcessNumber(parseInt(processNumber, 10));
                } else {
                    alert('Please enter a process number first.');
                }
            });
        }

        // UUID input is now readonly, so no need for Enter key handler
        
        // Allow Enter key in process number input
        if (processNumberInput) {
            processNumberInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const processNumber = processNumberInput.value.trim();
                    if (processNumber) {
                        await this.fetchUUIDFromProcessNumber(parseInt(processNumber, 10));
                    }
                }
            });
        }

        // View log button
        if (viewLogButton && uuidInput) {
            viewLogButton.addEventListener('click', async () => {
                const uuid = uuidInput.value.trim();
                if (uuid) {
                    await this.logViewer.toggleRawLog(uuid);
                } else {
                    alert('Please enter a UUID first');
                }
            });
        }

        // App title click - return to home
        const appTitle = document.getElementById('app-title');
        if (appTitle) {
            appTitle.addEventListener('click', () => {
                this.returnToHome();
            });
        }
    }

    /**
     * Fetch UUID from CPEE process number
     * @param {number} processNumber - CPEE process instance number
     */
    async fetchUUIDFromProcessNumber(processNumber) {
        try {
            console.log(`Fetching UUID for process number: ${processNumber}`);
            
            // Show loading state
            const fetchButton = document.getElementById('fetch-uuid');
            const uuidInput = document.getElementById('uuid-input');
            
            if (fetchButton) {
                fetchButton.textContent = 'Fetching...';
                fetchButton.disabled = true;
            }
            
            // Fetch UUID from CPEE service
            const uuid = await CPEEService.fetchUUIDFromProcessNumber(processNumber);
            
            // Update UUID input field
            if (uuidInput) {
                uuidInput.value = uuid;
                console.log(`UUID fetched successfully: ${uuid}`);
                
                // Show success message
                const processNumberInput = document.getElementById('process-number-input');
                if (processNumberInput) {
                    processNumberInput.style.borderColor = '#28a745';
                    setTimeout(() => {
                        processNumberInput.style.borderColor = '';
                    }, 2000);
                }
            }
            
        } catch (error) {
            console.error('Error fetching UUID:', error);
            alert(`Failed to fetch UUID: ${error.message}`);
            
            // Show error state
            const processNumberInput = document.getElementById('process-number-input');
            if (processNumberInput) {
                processNumberInput.style.borderColor = '#dc3545';
                setTimeout(() => {
                    processNumberInput.style.borderColor = '';
                }, 3000);
            }
        } finally {
            // Reset button state
            const fetchButton = document.getElementById('fetch-uuid');
            if (fetchButton) {
                fetchButton.textContent = 'Fetch UUID';
                fetchButton.disabled = false;
            }
        }
    }

    /**
     * Load CPEE instance data
     * @param {string} uuid - CPEE instance UUID
     */
    async loadInstance(uuid) {
        try {
            console.log(`Loading instance: ${uuid}`);
            
            // Check if already loaded
            if (this.instanceService.hasInstance(uuid)) {
                this.sidebar.addInstanceTab(uuid);
                return;
            }
            
            // Fetch and parse log data
            const logData = await LogService.fetchAndParseLog(uuid);
            const steps = LogService.parseStepsFromLog(logData);
            
            console.log(`Found ${steps.length} steps`);
            
            if (steps.length === 0) {
                alert(`No steps found in log for instance ${uuid}`);
                return;
            }
            
            // Store instance data
            this.instanceService.addInstance(uuid, steps);
            
            // Add to sidebar (but don't display content yet)
            this.sidebar.addInstanceTab(uuid);
            
            // Clear input field
            const uuidInput = document.getElementById('uuid-input');
            if (uuidInput) {
                uuidInput.value = '';
            }
            
            console.log(`Instance ${uuid} loaded successfully`);
            
        } catch (error) {
            console.error('Failed to load instance:', error);
            alert(`Failed to load instance: ${error.message}`);
        }
    }

    /**
     * Display instance content
     * @param {string} uuid - Instance UUID
     * @param {number} stepIndex - Step index (optional)
     */
    displayInstance(uuid, stepIndex = 0) {
        console.log(`Displaying instance: ${uuid}, step: ${stepIndex + 1}`);
        
        // Hide raw log viewer when selecting an instance
        this.logViewer.hideRawLog();
        
        if (!this.instanceService.setCurrentInstance(uuid, stepIndex)) {
            console.error(`Instance ${uuid} not found`);
            return;
        }
        
        const step = this.instanceService.getCurrentStep();
        const navInfo = this.instanceService.getNavigationInfo();
        
        if (step) {
            this.stepViewer.displayStep(step, navInfo);
            URLUtils.updateURL(uuid, stepIndex + 1);
        } else {
            this.stepViewer.showError('Failed to load step data');
        }
    }

    /**
     * Navigate to specific step
     * @param {number} stepIndex - Step index
     */
    goToStep(stepIndex) {
        if (this.instanceService.goToStep(stepIndex)) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            this.stepViewer.displayStep(step, navInfo);
            URLUtils.updateURL(this.instanceService.currentUUID, stepIndex + 1);
        }
    }

    /**
     * Get current application state
     * @returns {Object} Current state
     */
    getCurrentState() {
        return {
            currentUUID: this.instanceService.currentUUID,
            currentStepIndex: this.instanceService.currentStepIndex,
            loadedInstances: this.instanceService.getAllInstances(),
            navigationInfo: this.instanceService.getNavigationInfo()
        };
    }

    /**
     * Return to home page (default state)
     */
    returnToHome() {
        console.log('Returning to home page...');
        
        // Clear any active instance selection
        this.instanceService.setCurrentInstance(null);
        
        // Deactivate all tabs but keep instances loaded
        const instanceTabs = document.getElementById('instance-tabs');
        if (instanceTabs) {
            instanceTabs.querySelectorAll('.instance-tab').forEach(tab => {
                tab.classList.remove('active');
            });
        }
        
        // Show default state (input form)
        this.stepViewer.showDefaultState();
        
        // Hide raw log viewer if open
        this.logViewer.hideRawLog();
        
        // Clear URL parameters
        URLUtils.clearParameters();
        
        // Clear input field
        const uuidInput = document.getElementById('uuid-input');
        if (uuidInput) {
            uuidInput.value = '';
            uuidInput.focus(); // Focus on input for easy typing
        }
        
        console.log('Returned to home page');
    }

    /**
     * Clear all data and reset to default state
     */
    reset() {
        this.instanceService.clear();
        this.sidebar.clearAllTabs();
        this.stepViewer.showDefaultState();
        this.logViewer.hideRawLog();
        URLUtils.clearParameters();
        
        // Clear input field
        const uuidInput = document.getElementById('uuid-input');
        if (uuidInput) {
            uuidInput.value = '';
        }
    }
}
