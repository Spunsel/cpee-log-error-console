/**
 * Instance Loader Viewer Component
 * Handles the initial page UI where users input process number, fetch UUID, and load instances
 */

import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { RecentAdditionsAndFixes } from '../ui/RecentAdditionsAndFixes.js';
import { ICONS } from '../../assets/icons.js';

export class InstanceLoaderViewer {
    constructor(instanceService, domRegistry = null, eventBus = null, stateManager = null, logFetchService = null, eventProcessingService = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.isVisible = true;
        
        // Services injected via constructor
        this.logFetchService = logFetchService;
        this.eventProcessingService = eventProcessingService;
        
        // Initialize Recent Additions and Fixes component
        this.recentAdditionsAndFixes = new RecentAdditionsAndFixes(domRegistry);
        
        // Track collapsed state of advanced options
        this.advancedOptionsCollapsed = true;
        
        // Initialize advanced options toggle
        this.initAdvancedOptionsToggle();
    }
    
    /**
     * Initialize the advanced options collapsible section
     */
    initAdvancedOptionsToggle() {
        const advancedSection = document.querySelector('.advanced-instance-loading');
        if (!advancedSection) {
            return;
        }
        
        const header = advancedSection.querySelector('.advanced-options-header');
        const toggleIcon = advancedSection.querySelector('.section-toggle-icon');
        
        // Set initial icon state (collapsed)
        if (toggleIcon) {
            toggleIcon.innerHTML = ICONS.SECTION_EXPAND;
        }
        
        // Add click handler to header
        if (header) {
            header.addEventListener('click', () => this.toggleAdvancedOptions());
        }
    }
    
    /**
     * Toggle the advanced options section
     */
    toggleAdvancedOptions() {
        const advancedSection = document.querySelector('.advanced-instance-loading');
        if (!advancedSection) {
            return;
        }
        
        const toggleButton = advancedSection.querySelector('.section-toggle-button');
        const toggleIcon = advancedSection.querySelector('.section-toggle-icon');
        
        this.advancedOptionsCollapsed = !this.advancedOptionsCollapsed;
        
        if (this.advancedOptionsCollapsed) {
            advancedSection.classList.add('collapsed');
            if (toggleButton) {
                toggleButton.setAttribute('aria-expanded', 'false');
            }
            if (toggleIcon) {
                toggleIcon.innerHTML = ICONS.SECTION_EXPAND;
            }
        } else {
            advancedSection.classList.remove('collapsed');
            if (toggleButton) {
                toggleButton.setAttribute('aria-expanded', 'true');
            }
            if (toggleIcon) {
                toggleIcon.innerHTML = ICONS.SECTION_COLLAPSE;
            }
        }
    }

    /**
     * Get DOM element by key with fallback to direct ID access
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (this.domRegistry) {
            return this.domRegistry.getElementSafe(key);
        }
        return document.getElementById(key);
    }


    /**
     * Show the instance loader view
     */
    show() {
        // Use class selector to find the load section
        const loadSection = document.querySelector('.load-single-instance-section');
        if (loadSection) {
            loadSection.classList.remove('hidden');
            this.isVisible = true;
        }
        
        // Show advanced instance loading section
        const advancedInstanceLoading = document.querySelector('.advanced-instance-loading');
        if (advancedInstanceLoading) {
            advancedInstanceLoading.classList.remove('hidden');
        }
        
        // Show recent additions and fixes section
        const recentAdditionsAndFixes = document.querySelector('.recent-additions-and-fixes-section');
        if (recentAdditionsAndFixes) {
            recentAdditionsAndFixes.classList.remove('hidden');
        }
    }

    /**
     * Hide the instance loader view
     */
    hide() {
        // Use class selector to find the load section
        const loadSection = document.querySelector('.load-single-instance-section');
        if (loadSection) {
            loadSection.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Setup event listeners for instance loader interactions
     */
    setupEventListeners() {
        // Clear any pre-filled values in scan inputs to ensure placeholders show
        const scanStartInput = this.getElement('scanStartInput');
        const scanEndInput = this.getElement('scanEndInput');
        if (scanStartInput) {
            scanStartInput.value = '';
        }
        if (scanEndInput) {
            scanEndInput.value = '';
        }
        
        const loadButton = this.getElement('loadInstance');
        const viewLogButton = this.getElement('viewLog');
        const uuidInput = this.getElement('uuidInput');
        const processNumberInput = this.getElement('processNumberInput');

        // Load instance button - bidirectional loading
        if (loadButton) {
            loadButton.addEventListener('click', () => this.handleLoadInstance());
        }

        // Allow Enter key in either input to trigger load
        if (processNumberInput) {
            processNumberInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLoadInstance();
                }
            });
        }
        
        if (uuidInput) {
            uuidInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLoadInstance();
                }
            });
        }

        // View log button
        if (viewLogButton) {
            viewLogButton.addEventListener('click', () => this.handleViewLog());
        }

        // Scan instances button
        const scanButton = this.getElement('scanInstances');
        if (scanButton) {
            scanButton.addEventListener('click', () => {
                const startInput = this.getElement('scanStartInput');
                const endInput = this.getElement('scanEndInput');
                
                if (startInput && endInput) {
                    const start = parseInt(startInput.value.trim(), 10);
                    const end = parseInt(endInput.value.trim(), 10);
                    
                    if (!start || !end || isNaN(start) || isNaN(end)) {
                        alert('Please enter valid start and end instance numbers.');
                        return;
                    }
                    
                    if (start > end) {
                        alert('Start number must be less than or equal to end number.');
                        return;
                    }
                    
                    this.scanInstancesForSteps(start, end);
                }
            });
        }

        // Load all instances button (shows the known instances list)
        const loadAllButton = this.getElement('loadAllInstances');
        if (loadAllButton) {
            loadAllButton.addEventListener('click', () => {
                this.loadAllCPEEInstances();
            });
        }
        
        // Load all known instances button (sequentially loads all instances)
        const loadAllKnownButton = this.getElement('loadAllKnownInstances');
        if (loadAllKnownButton) {
            loadAllKnownButton.addEventListener('click', () => {
                this.loadAllKnownInstancesSequentially();
            });
        }
    }
    
    /**
     * Handle load instance - bidirectional loading logic
     * - If UUID is provided → load directly
     * - If only process number → fetch UUID first, then load
     * - If neither → show error
     */
    async handleLoadInstance() {
        const uuidInput = this.getElement('uuidInput');
        const processNumberInput = this.getElement('processNumberInput');
        const loadButton = this.getElement('loadInstance');
        
        const uuid = uuidInput?.value.trim() || '';
        const processNumber = processNumberInput?.value.trim() || '';
        
        // Validate: at least one input must be provided
        if (!uuid && !processNumber) {
            alert('Please enter a process number or UUID.');
            return;
        }
        
        // Set loading state on button
        if (loadButton) {
            loadButton.disabled = true;
            loadButton.textContent = 'Loading...';
        }
        
        try {
            let finalUuid = uuid;
            
            // If process number is provided, always use it to fetch UUID
            // This ensures process number takes priority when both fields have values
            if (processNumber) {
                const processNum = parseInt(processNumber, 10);
                if (isNaN(processNum) || processNum <= 0) {
                    alert('Please enter a valid process number (positive integer).');
                    return;
                }
                
                console.log(`Fetching UUID for process number: ${processNum} (server only)`);
                
                // Fetch UUID from server only (manual input uses server)
                const cpeeService = serviceFactory.get('CPEEService');
                const result = await cpeeService.fetchUUIDFromProcessNumber(processNum, { source: 'server' });
                finalUuid = result.uuid;
                
                // Update UUID input with fetched value
                if (uuidInput) {
                    uuidInput.value = finalUuid;
                    uuidInput.dataset.processNumber = processNum.toString();
                }
                
                console.log(`UUID fetched successfully from server: ${finalUuid}`);
            } 
            // If only UUID is provided (no process number), use it directly
            else if (uuid && this.isValidUUID(uuid)) {
                // UUID provided - load directly
                console.log(`Loading instance with UUID: ${uuid}`);
            } else {
                // UUID was provided but invalid format
                alert('Please enter a valid UUID format (e.g., 8a22c296-daa5-4acf-b167-4286c998e54e).');
                return;
            }
            
            // Store process number if available
            if (uuidInput && processNumber) {
                uuidInput.dataset.processNumber = processNumber;
            }
            
            // Trigger load instance event (manual input uses server only)
            this.stateManager.setState('ui.loading', true);
            this.eventBus.emit('instanceLoader:loadInstance', { uuid: finalUuid, source: 'server' });
            
        } catch (error) {
            // Handle specific error types
            if (error.status === 404 || error.isNotFound || (error.message && error.message.includes('404'))) {
                alert(`Process number ${processNumber} does not exist. Please check and try again.`);
            } else {
                console.error('Error loading instance:', error);
                alert(`Failed to load instance: ${error.message}`);
            }
            
            // Show error state on process number input
            if (processNumberInput) {
                processNumberInput.style.borderColor = configManager.get('styling.colors.error');
                setTimeout(() => {
                    processNumberInput.style.borderColor = '';
                }, configManager.get('ui.notifications.errorDuration'));
            }
        } finally {
            // Reset button state
            if (loadButton) {
                loadButton.disabled = false;
                loadButton.textContent = 'Load Instance';
            }
        }
    }
    
    /**
     * Handle view log button - similar bidirectional logic
     */
    async handleViewLog() {
        const uuidInput = this.getElement('uuidInput');
        const processNumberInput = this.getElement('processNumberInput');
        const viewLogButton = this.getElement('viewLog');
        
        const uuid = uuidInput?.value.trim() || '';
        const processNumber = processNumberInput?.value.trim() || '';
        
        // Validate: at least one input must be provided
        if (!uuid && !processNumber) {
            alert('Please enter a process number or UUID.');
            return;
        }
        
        try {
            let finalUuid = uuid;
            
            // If process number is provided, always use it to fetch UUID
            // This ensures process number takes priority when both fields have values
            if (processNumber) {
                const processNum = parseInt(processNumber, 10);
                if (isNaN(processNum) || processNum <= 0) {
                    alert('Please enter a valid process number.');
                    return;
                }
                
                // Temporarily disable button
                if (viewLogButton) {
                    viewLogButton.disabled = true;
                    viewLogButton.textContent = 'Fetching...';
                }
                
                // Fetch UUID from server only (manual input uses server)
                const cpeeService = serviceFactory.get('CPEEService');
                const result = await cpeeService.fetchUUIDFromProcessNumber(processNum, { source: 'server' });
                finalUuid = result.uuid;
                
                // Update UUID input
                if (uuidInput) {
                    uuidInput.value = finalUuid;
                    uuidInput.dataset.processNumber = processNum.toString();
                }
            }
            
            // Emit view log event (manual input uses server only)
            this.eventBus.emit('instanceLoader:viewLog', { uuid: finalUuid, source: 'server' });
            
        } catch (error) {
            if (error.status === 404 || error.isNotFound || (error.message && error.message.includes('404'))) {
                alert(`Process number ${processNumber} does not exist.`);
            } else {
                alert(`Failed to view log: ${error.message}`);
            }
        } finally {
            // Reset button state
            if (viewLogButton) {
                viewLogButton.disabled = false;
                viewLogButton.textContent = 'View Raw Log';
            }
        }
    }
    
    /**
     * Validate UUID format
     * @param {string} uuid - UUID string to validate
     * @returns {boolean} True if valid UUID format
     */
    isValidUUID(uuid) {
        if (!uuid || typeof uuid !== 'string') {
            return false;
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Fetch UUID from local fallback for known instances
     * Used by known instances list - uses fallback only (no server query)
     * @param {number} processNumber - CPEE process instance number
     * @returns {Promise<string>} The fetched UUID
     */
    async fetchUUIDFromProcessNumber(processNumber) {
        const uuidInput = this.getElement('uuidInput');
        const processNumberInput = this.getElement('processNumberInput');
        
        try {
            console.log(`Fetching UUID for known instance ${processNumber} (fallback only)`);

            // Fetch UUID from fallback only (known instances use local data)
            const cpeeService = serviceFactory.get('CPEEService');
            const result = await cpeeService.fetchUUIDFromProcessNumber(processNumber, { source: 'fallback' });
            const uuid = result.uuid;

            // Update UUID input field and store the process number for later use
            if (uuidInput) {
                uuidInput.value = uuid;
                uuidInput.dataset.processNumber = processNumber;
                console.log(`UUID fetched from fallback: ${uuid}`);
            }
            
            // Show success feedback
            if (processNumberInput) {
                processNumberInput.style.borderColor = configManager.get('styling.colors.success');
                setTimeout(() => {
                    processNumberInput.style.borderColor = '';
                }, configManager.get('ui.notifications.successDuration'));
            }
            
            return uuid;

        } catch (error) {
            console.error(`Error fetching UUID from fallback for instance ${processNumber}:`, error);

            // Show error state
            if (processNumberInput) {
                processNumberInput.style.borderColor = configManager.get('styling.colors.error');
                setTimeout(() => {
                    processNumberInput.style.borderColor = '';
                }, configManager.get('ui.notifications.errorDuration'));
            }
            
            throw error;
        }
    }

    /**
     * Clear input fields
     */
    clearInputs() {
        const uuidInput = this.getElement('uuidInput');
        const processNumberInput = this.getElement('processNumberInput');
        
        if (processNumberInput) {
            processNumberInput.value = '';
        }
        
        if (uuidInput) {
            uuidInput.value = '';
            uuidInput.dataset.processNumber = '';
        }
    }

    /**
     * Focus on process number input
     */
    focusProcessNumberInput() {
        const processNumberInput = this.getElement('processNumberInput');
        if (processNumberInput) {
            processNumberInput.focus();
        }
    }

    /**
     * Get process number from UUID input data attribute
     * @returns {number|null} Process number or null
     */
    getProcessNumberFromUUIDInput() {
        const uuidInput = this.getElement('uuidInput');
        return uuidInput?.dataset.processNumber ? parseInt(uuidInput.dataset.processNumber) : null;
    }

    /**
     * Check if an instance has steps in its log (optimized version)
     * Uses lightweight check that stops early after finding first step
     * @param {number} processNumber - Process instance number
     * @returns {Promise<{hasSteps: boolean, processNumber: number, uuid: string|null}>}
     */
    async checkInstanceForSteps(processNumber) {
        const cpeeService = serviceFactory.get('CPEEService');
        
        try {
            // Fetch UUID from fallback only (known instances use local data)
            const result = await cpeeService.fetchUUIDFromProcessNumber(processNumber, { source: 'fallback' });
            const uuid = result.uuid;
            
            try {
                // Fetch and parse log from fallback only
                const logResult = await this.logFetchService.fetchAndParseLog(uuid, { source: 'fallback' });
                const logData = logResult.events;
                
                // Use lightweight check instead of full parsing
                const { hasSteps, stepCount } = this.eventProcessingService.hasStepsInLog(logData);
                return {
                    hasSteps,
                    processNumber,
                    uuid,
                    stepCount
                };
            } catch (error) {
                // Log fetch/parse failed, but we have the UUID
                console.warn(`No fallback log for instance ${processNumber}:`, error.message);
                return {
                    hasSteps: false,
                    processNumber,
                    uuid,
                    error: error.message
                };
            }
        } catch (error) {
            // No fallback data for this process number
            return {
                hasSteps: false,
                processNumber,
                uuid: null,
                error: error.message,
                isNotFound: true
            };
        }
    }

    /**
     * Scan a range of instances in parallel to find those with steps
     * Uses parallel processing with configurable concurrency limit for faster scanning
     * @param {number} start - Starting instance number
     * @param {number} end - Ending instance number
     */
    async scanInstancesForSteps(start, end) {
        const scanButton = this.getElement('scanInstances');
        const instanceListContainer = this.getElement('instanceListContainer');
        const instanceList = this.getElement('instanceList');
        
        // Initialize UI
        if (scanButton) {
            scanButton.disabled = true;
            scanButton.textContent = 'Scanning...';
        }
        if (instanceList) {
            instanceList.innerHTML = '';
        }
        if (instanceListContainer) {
            instanceListContainer.classList.remove('hidden');
        }
        
        // Create array of instance numbers to check
        const instancesToCheck = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const concurrency = configManager.get('network.scanConcurrency', 5);
        let foundCount = 0;
        
        // Track progress
        let completedCount = 0;
        let rateLimitedCount = 0;
        let isRateLimited = false;
        
        // Helper function to check if error is rate limit
        const isRateLimitError = (error) => {
            const errorMessage = error?.message || String(error);
            return errorMessage.includes('403') || 
                   errorMessage.includes('Forbidden') || 
                   error?.status === 403;
        };
        
        // Helper function to update progress UI
        const updateProgress = () => {
            if (scanButton) {
                const progress = ((completedCount / instancesToCheck.length) * 100).toFixed(1);
                scanButton.textContent = `Scanning... (${completedCount}/${instancesToCheck.length}, ${progress}%)`;
            }
        };
        
        // Process instances with concurrency limit
        const processInstance = async (processNumber) => {
            try {
                const result = await this.checkInstanceForSteps(processNumber);
                
                if (result && result.hasSteps && result.uuid) {
                    // Immediately append to the list as soon as found
                    foundCount++;
                    this.appendInstanceToList(result, instanceList);
                } else if (result && result.error) {
                    // Check if it's a 404 (process doesn't exist) - skip silently
                    if (result.isNotFound) {
                        return; // Process number doesn't exist, just skip
                    }
                    
                    // Check if it's a rate limit error
                    if (isRateLimitError({ message: result.error })) {
                        rateLimitedCount++;
                        isRateLimited = true;
                        return;
                    }
                }
            } catch (error) {
                // Check if it's a 404 (process doesn't exist)
                const isNotFound = error.status === 404 || error.isNotFound || (error.message && error.message.includes('404'));
                if (isNotFound) {
                    return; // Process number doesn't exist, just skip
                }
                
                if (isRateLimitError(error)) {
                    rateLimitedCount++;
                    isRateLimited = true;
                }
            } finally {
                completedCount++;
                updateProgress();
            }
        };
        
        // Process instances in batches with concurrency limit
        const processBatch = async (batch) => {
            // If rate limited, add delay between batches
            if (isRateLimited && rateLimitedCount > 0) {
                const delay = Math.min(5000 * rateLimitedCount, 30000); // Max 30s delay
                if (scanButton) {
                    scanButton.textContent = `Rate limited. Waiting ${delay/1000}s... (${completedCount}/${instancesToCheck.length})`;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                // Reset rate limit flag after delay
                isRateLimited = false;
                rateLimitedCount = 0;
            }
            
            // Process batch in parallel
            await Promise.all(batch.map(processNumber => processInstance(processNumber)));
            
            // Small delay between batches to prevent overwhelming the server
            const interRequestDelay = configManager.get('network.interRequestDelay', 10);
            if (interRequestDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, interRequestDelay));
            }
        };
        
        // Split instances into batches based on concurrency limit
        try {
            for (let i = 0; i < instancesToCheck.length; i += concurrency) {
                const batch = instancesToCheck.slice(i, i + concurrency);
                await processBatch(batch);
            }
        } catch (error) {
            // Silently handle errors during scan
        }
        
        // Finish scanning
        if (scanButton) {
            scanButton.disabled = false;
            scanButton.textContent = 'Scan for CPEE LLM Instances';
        }
        
        // Show message if no instances found
        if (foundCount === 0) {
            if (instanceList) {
                instanceList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No CPEE LLM Instances found in the specified range.</p>';
            }
        }
    }
    
    /**
     * Append a single instance to the instance list in sorted order
     * @param {Object} instance - Instance with processNumber and uuid
     * @param {HTMLElement} instanceList - The list container element
     */
    appendInstanceToList(instance, instanceList) {
        if (!instanceList) {
            return;
        }
        
        const box = document.createElement('div');
        box.className = 'instance-number-box';
        box.textContent = instance.processNumber.toString();
        box.title = `Click to load instance ${instance.processNumber}`;
        box.dataset.processNumber = instance.processNumber;
        
        // Add click handler to simulate "load instance"
        box.addEventListener('click', () => {
            this.loadInstanceForProcessNumber(instance.processNumber, instance.uuid);
        });
        
        // Insert in sorted order (by process number)
        const existingBoxes = instanceList.querySelectorAll('.instance-number-box');
        let inserted = false;
        
        for (const existingBox of existingBoxes) {
            const existingNumber = parseInt(existingBox.dataset.processNumber, 10);
            if (instance.processNumber < existingNumber) {
                instanceList.insertBefore(box, existingBox);
                inserted = true;
                break;
            }
        }
        
        if (!inserted) {
            instanceList.appendChild(box);
        }
    }

    /**
     * Display list of instances with steps as clickable boxes
     * @param {Array<{processNumber: number, uuid: string}>} instances - Array of instances with steps
     */
    displayInstanceList(instances) {
        const instanceList = this.getElement('instanceList');
        if (!instanceList) {
            return;
        }
        
        // Sort by process number
        instances.sort((a, b) => a.processNumber - b.processNumber);
        
        instanceList.innerHTML = '';
        
        instances.forEach((instance) => {
            const box = document.createElement('div');
            box.className = 'instance-number-box';
            box.textContent = instance.processNumber.toString();
            box.title = `Click to load instance ${instance.processNumber}`;
            
            // Add click handler to simulate "load instance"
            box.addEventListener('click', () => {
                this.loadInstanceForProcessNumber(instance.processNumber, instance.uuid);
            });
            
            instanceList.appendChild(box);
        });
    }

    /**
     * Load instance for a given process number and UUID
     * Simulates "load instance" by setting inputs and triggering load
     * @param {number} processNumber - Process instance number
     * @param {string} uuid - Process UUID
     */
    loadInstanceForProcessNumber(processNumber, uuid) {
        const processNumberInput = this.getElement('processNumberInput');
        const uuidInput = this.getElement('uuidInput');
        
        // Set process number and UUID
        if (processNumberInput) {
            processNumberInput.value = processNumber.toString();
        }
        
        if (uuidInput) {
            uuidInput.value = uuid;
            uuidInput.dataset.processNumber = processNumber.toString();
        }
        
        // Trigger load instance event (known instances use fallback only)
        this.stateManager.setState('ui.loading', true);
        this.eventBus.emit('instanceLoader:loadInstance', { uuid, source: 'fallback' });
    }

    /**
     * Load all CPEE instances - displays buttons for predefined process numbers
     * Does not fetch logs, just creates the buttons that can be clicked to load instances
     */
    loadAllCPEEInstances() {
        const instanceListContainer = this.getElement('loadAllInstancesListContainer');
        const instanceList = this.getElement('loadAllInstancesList');
        
        // Get predefined list of process numbers from config
        const processNumbers = configManager.get('ui.instances.processNumbers', []);
        
        // Validate that we have process numbers
        if (!Array.isArray(processNumbers) || processNumbers.length === 0) {
            console.warn('No process numbers configured in ui.instances.processNumbers');
            alert('No process numbers configured. Please check the configuration.');
            return;
        }
        
        // Show the instance list container
        if (instanceListContainer) {
            instanceListContainer.classList.remove('hidden');
        }
        
        // Show the "Load All" button now that instances are visible
        const loadAllKnownButton = this.getElement('loadAllKnownInstances');
        if (loadAllKnownButton) {
            loadAllKnownButton.classList.remove('hidden');
        }
        
        // Clear existing list
        if (instanceList) {
            instanceList.innerHTML = '';
        }
        
        // Add filter input if not already present
        this.createKnownInstancesFilter(instanceListContainer);
        
        // Create buttons for each process number
        processNumbers.forEach((processNumber) => {
            const box = document.createElement('div');
            box.className = 'instance-number-box';
            box.textContent = processNumber.toString();
            box.title = `Click to load instance ${processNumber}`;
            box.dataset.processNumber = processNumber.toString();
            
            // Add click handler to fetch UUID and load instance
            box.addEventListener('click', async () => {
                try {
                    // Fetch UUID for this process number
                    await this.fetchUUIDFromProcessNumber(processNumber);
                    
                    // Get the UUID that was fetched
                    const uuidInput = this.getElement('uuidInput');
                    if (uuidInput && uuidInput.value) {
                        // Load the instance
                        this.loadInstanceForProcessNumber(processNumber, uuidInput.value);
                    }
                } catch (error) {
                    console.error(`Failed to load instance ${processNumber}:`, error);
                    alert(`Failed to load instance ${processNumber}: ${error.message}`);
                }
            });
            
            if (instanceList) {
                instanceList.appendChild(box);
            }
        });
        
        console.log(`Loaded ${processNumbers.length} CPEE instance buttons`);
    }
    
    /**
     * Create filter input for known instances list
     * @param {HTMLElement} container - The instance list container
     */
    createKnownInstancesFilter(container) {
        if (!container) {
            return;
        }
        
        // Check if filter already exists
        if (container.querySelector('.known-instances-filter')) {
            return;
        }
        
        const filterWrapper = document.createElement('div');
        filterWrapper.className = 'known-instances-filter';
        
        const inputGroup = document.createElement('div');
        inputGroup.className = 'search-input-group';
        
        const searchIcon = document.createElement('div');
        searchIcon.className = 'search-icon';
        searchIcon.innerHTML = ICONS.FILTER;
        inputGroup.appendChild(searchIcon);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'search-input';
        input.placeholder = 'Filter by instance number';
        input.setAttribute('inputmode', 'numeric');
        inputGroup.appendChild(input);
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'search-clear-btn';
        clearBtn.innerHTML = ICONS.CLEAR_SEARCH;
        clearBtn.setAttribute('aria-label', 'Clear filter');
        clearBtn.style.display = 'none';
        inputGroup.appendChild(clearBtn);
        
        filterWrapper.appendChild(inputGroup);
        
        // Insert filter after the h5 label
        const h5Label = container.querySelector('h5');
        if (h5Label) {
            h5Label.insertAdjacentElement('afterend', filterWrapper);
        } else {
            container.insertBefore(filterWrapper, container.firstChild);
        }
        
        // Setup event listeners
        input.addEventListener('input', () => {
            const filterValue = input.value.trim();
            clearBtn.style.display = filterValue ? 'block' : 'none';
            this.filterKnownInstances(filterValue);
        });
        
        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            this.filterKnownInstances('');
            input.focus();
        });
        
        // Store reference for later use
        this.knownInstancesFilterInput = input;
    }
    
    /**
     * Filter known instances by partial match on instance number
     * @param {string} filterValue - The filter string to match against instance numbers
     */
    filterKnownInstances(filterValue) {
        const instanceList = this.getElement('loadAllInstancesList');
        if (!instanceList) {
            return;
        }
        
        const instanceBoxes = instanceList.querySelectorAll('.instance-number-box');
        
        instanceBoxes.forEach((box) => {
            const instanceNumber = box.dataset.processNumber || box.textContent;
            
            if (!filterValue) {
                // No filter - show all and restore original text
                box.style.display = '';
                box.innerHTML = instanceNumber;
            } else {
                // Check if instance number contains the filter value (partial match)
                const matchIndex = instanceNumber.indexOf(filterValue);
                const matches = matchIndex !== -1;
                box.style.display = matches ? '' : 'none';
                
                if (matches) {
                    // Highlight the matching substring
                    const before = instanceNumber.substring(0, matchIndex);
                    const match = instanceNumber.substring(matchIndex, matchIndex + filterValue.length);
                    const after = instanceNumber.substring(matchIndex + filterValue.length);
                    box.innerHTML = `${before}<span class="instance-filter-match">${match}</span>${after}`;
                } else {
                    box.innerHTML = instanceNumber;
                }
            }
        });
    }
    
    /**
     * Sequentially load all known CPEE instances
     * Each instance is loaded only after the previous one has finished loading
     */
    async loadAllKnownInstancesSequentially() {
        const loadAllKnownButton = this.getElement('loadAllKnownInstances');
        const processNumbers = configManager.get('ui.instances.processNumbers', []);
        
        // Validate that we have process numbers
        if (!Array.isArray(processNumbers) || processNumbers.length === 0) {
            console.warn('No process numbers configured in ui.instances.processNumbers');
            alert('No process numbers configured. Please check the configuration.');
            return;
        }
        
        // Disable the button and show loading state
        if (loadAllKnownButton) {
            loadAllKnownButton.disabled = true;
            loadAllKnownButton.textContent = 'Loading...';
        }
        
        let loadedCount = 0;
        let failedCount = 0;
        
        // Load instances sequentially
        for (const processNumber of processNumbers) {
            try {
                // Update button text to show progress
                if (loadAllKnownButton) {
                    loadAllKnownButton.textContent = `Loading ${loadedCount + 1}/${processNumbers.length}...`;
                }
                
                // Fetch UUID for this process number
                const cpeeService = serviceFactory.get('CPEEService');
                const result = await cpeeService.fetchUUIDFromProcessNumber(processNumber);
                const uuid = result.uuid;
                
                if (uuid) {
                    // Wait for instance to load using a promise that resolves on load completion
                    await this.loadInstanceAndWait(uuid, processNumber);
                    loadedCount++;
                    console.log(`Successfully loaded instance ${processNumber} (${loadedCount}/${processNumbers.length})`);
                }
            } catch (error) {
                failedCount++;
                console.error(`Failed to load instance ${processNumber}:`, error);
                // Continue loading other instances even if one fails
            }
        }
        
        // Reset button state
        if (loadAllKnownButton) {
            loadAllKnownButton.disabled = false;
            loadAllKnownButton.textContent = 'Load All';
        }
        
        // Show completion message
        if (failedCount > 0) {
            console.log(`Finished loading: ${loadedCount} succeeded, ${failedCount} failed`);
        } else {
            console.log(`Successfully loaded all ${loadedCount} instances`);
        }
    }
    
    /**
     * Load an instance and wait for it to complete
     * @param {string} uuid - Instance UUID
     * @param {number} processNumber - Process number for logging
     * @returns {Promise<void>} Resolves when instance is loaded
     */
    loadInstanceAndWait(uuid, processNumber) {
        return new Promise((resolve, reject) => {
            // Set up one-time listeners for load completion or failure
            const onLoadComplete = (data) => {
                if (data.uuid === uuid) {
                    this.eventBus.off('instance:loaded', onLoadComplete);
                    this.eventBus.off('instance:loadFailed', onLoadFailed);
                    resolve();
                }
            };
            
            const onLoadFailed = (data) => {
                if (data.uuid === uuid) {
                    this.eventBus.off('instance:loaded', onLoadComplete);
                    this.eventBus.off('instance:loadFailed', onLoadFailed);
                    reject(new Error(`Failed to load instance ${processNumber}`));
                }
            };
            
            // Subscribe to events
            this.eventBus.on('instance:loaded', onLoadComplete);
            this.eventBus.on('instance:loadFailed', onLoadFailed);
            
            // Set the process number on the UUID input so it's available when loading
            const uuidInput = this.getElement('uuidInput');
            const processNumberInput = this.getElement('processNumberInput');
            if (uuidInput) {
                uuidInput.value = uuid;
                uuidInput.dataset.processNumber = processNumber.toString();
            }
            if (processNumberInput) {
                processNumberInput.value = processNumber.toString();
            }
            
            // Trigger the load
            this.stateManager.setState('ui.loading', true);
            this.eventBus.emit('instanceLoader:loadInstance', { uuid });
            
            // Set a timeout to prevent hanging forever
            setTimeout(() => {
                this.eventBus.off('instance:loaded', onLoadComplete);
                this.eventBus.off('instance:loadFailed', onLoadFailed);
                reject(new Error(`Timeout loading instance ${processNumber}`));
            }, 60000); // 60 second timeout per instance
        });
    }
}
