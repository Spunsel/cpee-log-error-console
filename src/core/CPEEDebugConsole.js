/**
 * CPEE Debug Console - Main Application Controller
 * Coordinates all components and services
 */

import { LogService } from '../services/LogService.js';
import { Sidebar } from '../components/ui/Sidebar.js';
import { StepViewer } from '../components/views/StepViewer.js';
import { LogViewer } from '../components/views/LogViewer.js';
import { InstanceLoaderViewer } from '../components/views/InstanceLoaderViewer.js';
import { RawContentCoordinator } from '../components/coordinators/RawContentCoordinator.js';
import { HighlightCoordinator } from '../components/coordinators/HighlightCoordinator.js';
import { DEFAULT_DOM_MAPPINGS, DOMRegistry } from './DOMRegistry.js';
import { eventBus } from './EventBus.js';
import { serviceFactory } from './ServiceFactory.js';
import { stateManager } from './StateManager.js';
import { URLManager } from '../utils/system/URLManager.js';

export class CPEEDebugConsole {
    constructor() {
        // Initialize DOM registry for dependency injection
        this.domRegistry = new DOMRegistry();
        this.setupDOMRegistry();
        
        this.eventBus = eventBus;
        this.serviceFactory = serviceFactory;
        this.stateManager = stateManager;
        this.instanceService = this.serviceFactory.get('InstanceService');
        this.highlightCoordinator = new HighlightCoordinator(this.domRegistry);
        this.rawContentCoordinator = new RawContentCoordinator(this.instanceService, this.domRegistry, null, this.eventBus, this.stateManager);
        
        // Initialize components with DOM registry, event bus, and state manager
        this.sidebar = new Sidebar(this.instanceService, this.domRegistry, this.eventBus);
        this.stepViewer = new StepViewer(this.instanceService, this.domRegistry, this.rawContentCoordinator, this.highlightCoordinator, this.eventBus, this.stateManager);
        this.logViewer = new LogViewer(this.domRegistry, this.eventBus, this.stateManager);
        this.instanceLoaderViewer = new InstanceLoaderViewer(this.instanceService, this.domRegistry, this.eventBus, this.stateManager);
        
        this.setupEventBusListeners();
        
        // Initialize application
        this.init();
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
        }
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing CPEE Debug Console...');
        
        // Parse URL parameters
        const urlParams = URLManager.parseURLParameters();
        
        // Initialize sidebar toggle functionality
        this.sidebar.initializeToggle();
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
     * Setup event bus listeners for component communication
     */
    setupEventBusListeners() {
        // Instance selection from sidebar
        this.eventBus.on('sidebar:instanceSelected', async (data) => {
            await this.displayInstance(data.uuid);
        });

        // Step changes from step viewer
        this.eventBus.on('stepViewer:stepChanged', (data) => {
            URLManager.updateURL(this.instanceService.currentUUID, data.stepIndex + 1);
        });

        // Instance loading from instance loader
        this.eventBus.on('instanceLoader:loadInstance', async (data) => {
            await this.loadInstance(data.uuid);
        });

        // View log request from instance loader
        this.eventBus.on('instanceLoader:viewLog', async (data) => {
            await this.logViewer.toggleRawLog(data.uuid);
        });

        // Keyboard navigation events
        this.eventBus.on('keyboard:arrowLeft', () => {
            this.stepViewer.navigator.previousStep();
        });

        this.eventBus.on('keyboard:arrowRight', () => {
            this.stepViewer.navigator.nextStep();
        });

        // Header click to return home
        this.eventBus.on('header:click', () => {
            this.returnToHome();
        });

        // Instance loaded successfully
        this.eventBus.on('instance:loaded', (data) => {
            console.log(`Instance ${data.uuid} loaded successfully`);
        });

        // Instance loading failed
        this.eventBus.on('instance:loadFailed', (data) => {
            console.error('Failed to load instance:', data.error);
            alert(`Failed to load instance: ${data.error.message}`);
        });

        // Step display completed
        this.eventBus.on('step:displayed', (data) => {
            console.log(`Step ${data.stepIndex + 1} displayed for instance ${data.uuid}`);
        });
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        this.instanceLoaderViewer.setupEventListeners();

        // Header content click - return to home
        const headerContent = this.getElement('headerContent');
        if (headerContent) {
            headerContent.addEventListener('click', () => {
                this.eventBus.emit('header:click');
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
                this.eventBus.emit('keyboard:arrowLeft');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.eventBus.emit('keyboard:arrowRight');
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
            
            // Update state manager
            this.stateManager.setState('instances', this.instanceService.getAllInstances());
            this.stateManager.setState('ui.loading', false);
            
            // Add to sidebar (but don't display content yet)
            this.sidebar.addInstanceTab(uuid);
            
            // Keep instance loader visible for loading multiple instances
            // It will be hidden when user clicks on an instance tab to view it
            
            // Clear inputs for next instance loading
            const processNumberInput = this.getElement('processNumberInput');
            if (processNumberInput) {
                processNumberInput.value = '';
            }
            
            // Emit success event
            this.eventBus.emit('instance:loaded', { uuid, steps: steps.length });
            
        } catch (error) {
            // Update state manager
            this.stateManager.setState('ui.loading', false);
            
            // Emit error event
            this.eventBus.emit('instance:loadFailed', { uuid, error });
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
        
        // Update state manager
        this.stateManager.setState('currentInstance', uuid);
        this.stateManager.setState('currentStep', step);
        this.stateManager.setState('currentStepIndex', stepIndex);
        this.stateManager.setState('ui.activeView', 'instance');
        
        if (step) {
            await this.stepViewer.displayStep(step, navInfo);
            URLManager.updateURL(uuid, stepIndex + 1);
            
            // Emit step displayed event
            this.eventBus.emit('step:displayed', { uuid, stepIndex, step });
        } else {
            this.stepViewer.showError('Failed to load step data');
            this.eventBus.emit('step:displayFailed', { uuid, stepIndex, error: 'Failed to load step data' });
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
            URLManager.updateURL(this.instanceService.currentUUID, stepIndex + 1);
        }
    }

    /**
     * Get current application state
     * @returns {Object} Current state
     */
    getCurrentState() {
        return {
            currentUUID: this.stateManager.getState('currentInstance'),
            currentStepIndex: this.stateManager.getState('currentStepIndex'),
            loadedInstances: this.stateManager.getState('instances'),
            navigationInfo: this.instanceService.getNavigationInfo(),
            ui: this.stateManager.getState('ui'),
            search: this.stateManager.getState('search'),
            viewModes: this.stateManager.getState('viewModes')
        };
    }

    /**
     * Return to home page (default state)
     */
    returnToHome() {
        console.log('Returning to home page...');
        
        // Clear any active instance selection
        this.instanceService.setCurrentInstance(null);
        
        // Update state manager
        this.stateManager.setState('currentInstance', null);
        this.stateManager.setState('currentStep', null);
        this.stateManager.setState('currentStepIndex', 0);
        this.stateManager.setState('ui.activeView', 'home');
        
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
        this.logViewer.hideRawLog();
        
        URLManager.clearURLParameters();
        
        this.instanceLoaderViewer.clearInputs();
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
        URLManager.clearURLParameters();
        
        this.instanceLoaderViewer.clearInputs();
    }
}
