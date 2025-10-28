/**
 * CPEE Debug Console - Main Application Controller
 * Coordinates all components and services
 */

import { LogService } from '../services/LogService.js';
import { InstanceService } from '../services/InstanceService.js';
import { Sidebar } from '../components/ui/Sidebar.js';
import { StepViewer } from '../components/views/StepViewer.js';
import { LogViewer } from '../components/views/LogViewer.js';
import { InstanceLoaderViewer } from '../components/views/InstanceLoaderViewer.js';
import { RawContentCoordinator } from '../components/coordinators/RawContentCoordinator.js';
import { HighlightCoordinator } from '../components/coordinators/HighlightCoordinator.js';
import { DEFAULT_DOM_MAPPINGS, DOMRegistry } from './DOMRegistry.js';

export class CPEEDebugConsole {
    constructor() {
        // Initialize DOM registry for dependency injection
        this.domRegistry = new DOMRegistry();
        this.setupDOMRegistry();
        
        // Initialize services
        this.instanceService = new InstanceService();
        
        // Initialize highlighting coordinator
        this.highlightCoordinator = new HighlightCoordinator(this.domRegistry);
        
        // Initialize content coordinator
        this.rawContentCoordinator = new RawContentCoordinator(this.instanceService, this.domRegistry);
        
        // Initialize components with DOM registry
        this.sidebar = new Sidebar(this.instanceService, this.domRegistry);
        this.stepViewer = new StepViewer(this.instanceService, this.domRegistry, this.rawContentCoordinator, this.highlightCoordinator);
        this.logViewer = new LogViewer(this.domRegistry);
        this.instanceLoaderViewer = new InstanceLoaderViewer(this.instanceService, this.domRegistry);
        
        // Set up component callbacks
        this.setupComponentCallbacks();
        
        // Initialize application
        this.init();
    }

    /**
     * Parse URL parameters
     * @returns {Object} Parsed parameters
     */
    parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        return {
            uuid: urlParams.get('uuid'),
            step: parseInt(urlParams.get('step'), 10) || 1
        };
    }

    /**
     * Update URL with current state
     * @param {string} uuid - Current UUID
     * @param {number} step - Current step number
     */
    updateURL(uuid, step) {
        if (!uuid) {
            return;
        }
        
        const url = new URL(window.location);
        url.searchParams.set('uuid', uuid);
        url.searchParams.set('step', step);
        
        window.history.replaceState({}, '', url);
    }

    /**
     * Clear URL parameters
     */
    clearURLParameters() {
        const url = new URL(window.location);
        url.search = '';
        window.history.replaceState({}, '', url);
    }

    /**
     * Get DOM element by key with fallback to direct ID access
     * Delegates to DOMRegistry for centralized DOM management
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        return this.domRegistry.getElementSafe(key);
    }


    /**
     * Setup DOM registry with default mappings
     * This provides a centralized way to manage DOM element access
     */
    setupDOMRegistry() {
        try {
            // Register all default DOM mappings
            this.domRegistry.registerBatch(DEFAULT_DOM_MAPPINGS);
            
            // Validate that all required elements exist
            const validation = this.domRegistry.validateRegistry();
            if (validation.missing.length > 0) {
                console.warn('DOMRegistry: Some registered elements are missing from DOM:', validation.missing);
            }
            
            console.log(`DOMRegistry: Initialized with ${validation.total} elements (${validation.valid.length} found, ${validation.missing.length} missing)`);
        } catch (error) {
            console.error('DOMRegistry: Failed to initialize:', error);
            // In case of failure, components will fall back to direct DOM access
        }
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing CPEE Debug Console...');
        
        // Parse URL parameters
        const urlParams = this.parseURLParameters();
        
        // Initialize sidebar toggle functionality
        this.sidebar.initializeToggle();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load instance if UUID is provided
        if (urlParams.uuid) {
            await this.loadInstance(urlParams.uuid);
            if (this.instanceService.hasInstance(urlParams.uuid)) {
                this.sidebar.setActiveTab(urlParams.uuid);
                await this.displayInstance(urlParams.uuid, urlParams.step - 1);
                // Hide instance loader when showing instance
                this.instanceLoaderViewer.hide();
            }
        } else {
            // Show default state (instance loader)
            this.instanceLoaderViewer.show();
            this.stepViewer.showDefaultState();
        }
        
        console.log('CPEE Debug Console initialized');
    }

    /**
     * Setup callbacks between components
     */
    setupComponentCallbacks() {
        // When instance is selected in sidebar
        this.sidebar.setOnInstanceSelect(async (uuid) => {
            await this.displayInstance(uuid);
        });

        // When step changes in step viewer
        this.stepViewer.setOnStepChange((stepIndex) => {
            this.updateURL(this.instanceService.currentUUID, stepIndex + 1);
        });

        // When instance is loaded from instance loader
        this.instanceLoaderViewer.setOnLoadInstance(async (uuid) => {
            await this.loadInstance(uuid);
        });

        // When view log is requested from instance loader
        this.instanceLoaderViewer.setOnViewLog(async (uuid) => {
            await this.logViewer.toggleRawLog(uuid);
        });
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Setup instance loader viewer event listeners
        this.instanceLoaderViewer.setupEventListeners();

        // Header content click - return to home
        const headerContent = this.getElement('headerContent');
        if (headerContent) {
            headerContent.addEventListener('click', () => {
                this.returnToHome();
            });
        }

        // Keyboard navigation for step viewing (arrow keys)
        document.addEventListener('keydown', (e) => {
            // Don't trigger if user is typing in an input or textarea
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            )) {
                return;
            }

            // Navigate with arrow keys
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.stepViewer.navigator.previousStep();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.stepViewer.navigator.nextStep();
            }
        });
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
            
            // Get process number from InstanceLoaderViewer
            const processNumber = this.instanceLoaderViewer.getProcessNumberFromUUIDInput();
            
            // Store instance data
            this.instanceService.addInstance(uuid, steps, processNumber);
            
            // Add to sidebar (but don't display content yet)
            this.sidebar.addInstanceTab(uuid);
            
            // Keep instance loader visible for loading multiple instances
            // It will be hidden when user clicks on an instance tab to view it
            
            // Clear inputs for next instance loading
            const processNumberInput = this.getElement('processNumberInput');
            if (processNumberInput) {
                processNumberInput.value = '';
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
    async displayInstance(uuid, stepIndex = 0) {
        console.log(`Displaying instance: ${uuid}, step: ${stepIndex + 1}`);
        
        // Hide raw log viewer when selecting an instance
        this.logViewer.hideRawLog();
        
        // Hide instance loader when displaying an instance
        this.instanceLoaderViewer.hide();
        
        if (!this.instanceService.setCurrentInstance(uuid, stepIndex)) {
            console.error(`Instance ${uuid} not found`);
            return;
        }
        
        const step = this.instanceService.getCurrentStep();
        const navInfo = this.instanceService.getNavigationInfo();
        
        if (step) {
            await this.stepViewer.displayStep(step, navInfo);
            this.updateURL(uuid, stepIndex + 1);
        } else {
            this.stepViewer.showError('Failed to load step data');
        }
    }

    /**
     * Navigate to specific step
     * @param {number} stepIndex - Step index
     */
    async goToStep(stepIndex) {
        if (this.instanceService.goToStep(stepIndex)) {
            const step = this.instanceService.getCurrentStep();
            const navInfo = this.instanceService.getNavigationInfo();
            await this.stepViewer.displayStep(step, navInfo);
            this.updateURL(this.instanceService.currentUUID, stepIndex + 1);
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
        const instanceTabs = this.getElement('instanceTabs');
        if (instanceTabs) {
            instanceTabs.querySelectorAll('.instance-tab').forEach(tab => {
                tab.classList.remove('active');
            });
        }
        
        // Show instance loader and hide debugging interface
        this.instanceLoaderViewer.show();
        this.stepViewer.showDefaultState();
        
        // Hide raw log viewer if open
        this.logViewer.hideRawLog();
        
        // Clear URL parameters
        this.clearURLParameters();
        
        // Clear inputs
        this.instanceLoaderViewer.clearInputs();
        
        // Focus on process number input
        this.instanceLoaderViewer.focusProcessNumberInput();
        
        console.log('Returned to home page');
    }

    /**
     * Clear all data and reset to default state
     */
    reset() {
        this.instanceService.clear();
        this.sidebar.clearAllTabs();
        this.instanceLoaderViewer.show();
        this.stepViewer.showDefaultState();
        this.logViewer.hideRawLog();
        this.clearURLParameters();
        
        // Clear inputs
        this.instanceLoaderViewer.clearInputs();
    }
}
