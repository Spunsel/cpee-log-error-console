/**
 * Instance Loader Viewer Component
 * Handles the initial page UI where users input process number, fetch UUID, and load instances
 */

import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { instanceFallbackService } from '../../services/InstanceFallbackService.js';
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

        const loadGen2Button = this.getElement('loadGeneration2Instances');
        if (loadGen2Button) {
            loadGen2Button.addEventListener('click', () => this.loadGenerationInstances('generation2'));
        }

        const loadGen1Button = this.getElement('loadGeneration1Instances');
        if (loadGen1Button) {
            loadGen1Button.addEventListener('click', () => this.loadGenerationInstances('generation1'));
        }

        this.setupKnownInstancesFilter();

        // Load all known instances button (sequentially loads all instances)
        const loadAllKnownButton = this.getElement('loadAllKnownInstances');
        if (loadAllKnownButton) {
            loadAllKnownButton.addEventListener('click', () => {
                this.loadAllKnownInstancesSequentially();
            });
        }
    }

    /**
     * Show the known-instances list pre-filtered to a single generation.
     * Reuses loadAllCPEEInstances (which populates from configManager) then
     * immediately applies a generation filter so only that generation is visible.
     * @param {string} generation - e.g. 'generation1' or 'generation2'
     */
    async loadGenerationInstances(generation) {
        // Build the full list first (so filters + error counts work)
        await this.loadAllCPEEInstances(generation);
    }

    /**
     * Handle load instance - bidirectional loading logic
     * - If process number is provided → fetch UUID from server (process number takes precedence)
     * - If only UUID is provided → load directly
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
            let resolvedProcessNumber = null;
            
            // Process number takes precedence over UUID when both are provided
            if (processNumber) {
                const processNum = parseInt(processNumber, 10);
                if (isNaN(processNum) || processNum <= 0) {
                    alert('Please enter a valid process number (positive integer).');
                    return;
                }
                resolvedProcessNumber = processNum;
                
                console.log(`Fetching UUID for process number: ${processNum} (server only)`);
                
                const cpeeService = serviceFactory.get('CPEEService');
                const result = await cpeeService.fetchUUIDFromProcessNumber(processNum, { source: 'server' });
                finalUuid = result.uuid;
                
                if (uuidInput) {
                    uuidInput.value = finalUuid;
                    uuidInput.dataset.processNumber = processNum.toString();
                }
                
                console.log(`UUID fetched successfully from server: ${finalUuid}`);
            } else if (uuid && this.isValidUUID(uuid)) {
                console.log(`Loading instance with UUID: ${uuid}`);
            } else if (uuid && !this.isValidUUID(uuid)) {
                alert('Please enter a valid UUID format (e.g., 8a22c296-daa5-4acf-b167-4286c998e54e).');
                return;
            }
            
            // Store process number if available
            if (uuidInput && processNumber) {
                uuidInput.dataset.processNumber = processNumber;
            }
            
            // Trigger load instance event (manual input uses server only)
            this.stateManager.setState('ui.loading', true);
            this.eventBus.emit('instanceLoader:loadInstance', {
                uuid: finalUuid,
                source: 'server',
                processNumber: resolvedProcessNumber
            });
            
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
            
            // Process number takes precedence over UUID when both are provided
            if (processNumber) {
                const processNum = parseInt(processNumber, 10);
                if (isNaN(processNum) || processNum <= 0) {
                    alert('Please enter a valid process number.');
                    return;
                }
                
                if (viewLogButton) {
                    viewLogButton.disabled = true;
                    viewLogButton.textContent = 'Fetching...';
                }
                
                const cpeeService = serviceFactory.get('CPEEService');
                const result = await cpeeService.fetchUUIDFromProcessNumber(processNum, { source: 'server' });
                finalUuid = result.uuid;
                
                if (uuidInput) {
                    uuidInput.value = finalUuid;
                    uuidInput.dataset.processNumber = processNum.toString();
                }
            } else if (uuid && this.isValidUUID(uuid)) {
                console.log(`Viewing log with UUID: ${uuid}`);
            }
            
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
     * @param {string|null} [generation=null] - Generation bucket when process numbers collide across generations
     * @returns {Promise<string>} The fetched UUID
     */
    async fetchUUIDFromProcessNumber(processNumber, generation = null) {
        const uuidInput = this.getElement('uuidInput');
        const processNumberInput = this.getElement('processNumberInput');
        
        try {
            const genLabel = generation ? `, ${generation}` : '';
            console.log(`Fetching UUID for known instance ${processNumber}${genLabel} (fallback only)`);

            // Fetch UUID from fallback only (known instances use local data)
            const cpeeService = serviceFactory.get('CPEEService');
            const result = await cpeeService.fetchUUIDFromProcessNumber(processNumber, {
                source: 'fallback',
                generation
            });
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
            const result = await cpeeService.fetchUUIDFromProcessNumber(processNumber, { source: 'server' });
            const uuid = result.uuid;
            
            try {
                const logResult = await this.logFetchService.fetchAndParseLog(uuid, { source: 'server' });
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
                console.warn(`Failed to fetch log for instance ${processNumber}:`, error.message);
                return {
                    hasSteps: false,
                    processNumber,
                    uuid,
                    error: error.message
                };
            }
        } catch (error) {
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
                   errorMessage.includes('429') ||
                   errorMessage.includes('Forbidden') || 
                   errorMessage.includes('Too Many Requests') ||
                   error?.status === 403 ||
                   error?.status === 429;
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
                const delay = Math.min(10000 * rateLimitedCount, 60000); // 10s per error, max 60s delay
                if (scanButton) {
                    scanButton.textContent = `Rate limited (429). Waiting ${delay/1000}s... (${completedCount}/${instancesToCheck.length})`;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                // Reset rate limit flag after delay
                isRateLimited = false;
                rateLimitedCount = 0;
            }
            
            // Process batch in parallel
            await Promise.all(batch.map(processNumber => processInstance(processNumber)));
            
            // Delay between batches to prevent overwhelming the server
            const interRequestDelay = configManager.get('network.interRequestDelay', 500);
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
        
        box.addEventListener('click', () => {
            this.loadInstanceForProcessNumber(instance.processNumber, instance.uuid, 'server');
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
     * Load instance for a given process number and UUID
     * Simulates "load instance" by setting inputs and triggering load
     * @param {number} processNumber - Process instance number
     * @param {string} uuid - Process UUID
     * @param {string} [source='fallback'] - Data source: 'server' for scanned instances, 'fallback' for known instances
     */
    loadInstanceForProcessNumber(processNumber, uuid, source = 'fallback') {
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
        
        this.stateManager.setState('ui.loading', true);
        this.eventBus.emit('instanceLoader:loadInstance', { uuid, source, processNumber });
    }

    /**
     * Build instance list entries with generation context.
     * "Show all" keeps separate entries when the same process number exists in multiple generations.
     * @param {string|null} [generation=null] - Restrict to a single generation, or null for all
     * @returns {Promise<Array<{processNumber: number|string, generation: string}>>}
     */
    async resolveKnownInstanceEntries(generation = null) {
        const generationOrder = ['generation2', 'generation1'];
        const generations = generation
            ? [generation]
            : generationOrder.filter((gen) => configManager.get(`ui.instances.${gen}`));

        const entries = [];
        for (const gen of generations) {
            const fromConfig = configManager.get(`ui.instances.${gen}`);
            const processNumbers = Array.isArray(fromConfig) && fromConfig.length > 0
                ? fromConfig
                : await instanceFallbackService.getProcessNumbersByGeneration(gen);
            for (const processNumber of processNumbers) {
                entries.push({ processNumber, generation: gen });
            }
        }
        return entries;
    }

    /**
     * Short generation label for duplicate process numbers in the combined list.
     * @param {string} generation - e.g. 'generation1'
     * @returns {string}
     */
    formatGenerationShortLabel(generation) {
        const match = /^generation(\d+)$/i.exec(generation || '');
        return match ? `G${match[1]}` : generation;
    }

    /**
     * Load all CPEE instances - displays buttons for predefined process numbers.
     * When `generation` is provided only that generation's numbers are shown.
     * @param {string|null} [generation=null] - Optional generation name to restrict the list
     */
    async loadAllCPEEInstances(generation = null) {
        const instanceListContainer = this.getElement('loadAllInstancesListContainer');
        const instanceList = this.getElement('loadAllInstancesList');

        await instanceFallbackService.loadUUIDMapping();

        const instanceEntries = await this.resolveKnownInstanceEntries(generation);
        
        if (!Array.isArray(instanceEntries) || instanceEntries.length === 0) {
            console.warn('No process numbers configured in ui.instances');
            alert('No process numbers configured. Please check the configuration.');
            return;
        }

        const duplicateProcessNumbers = new Set();
        const processNumberCounts = new Map();
        for (const { processNumber } of instanceEntries) {
            const key = String(processNumber);
            const count = (processNumberCounts.get(key) || 0) + 1;
            processNumberCounts.set(key, count);
            if (count > 1) {
                duplicateProcessNumbers.add(key);
            }
        }
        
        // Load error counts for filter dropdown
        await this.loadErrorCounts();
        
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
        
        this.populateKnownInstancesErrorOptions();

        // Clear any active filters so all instances are shown
        this.clearKnownInstancesFilters();
        
        // Create buttons for each process number (with generation when needed)
        for (const { processNumber, generation: entryGeneration } of instanceEntries) {
            const resolved = await instanceFallbackService.getUUIDForProcess(processNumber, entryGeneration);
            const resolvedUuid = resolved?.uuid ?? null;
            const processKey = String(processNumber);
            const showGenerationLabel = duplicateProcessNumbers.has(processKey);
            const displayLabel = showGenerationLabel
                ? `${processNumber} (${this.formatGenerationShortLabel(entryGeneration)})`
                : processNumber.toString();

            const box = document.createElement('div');
            box.className = 'instance-number-box';
            box.textContent = displayLabel;
            box.title = resolvedUuid
                ? `Load instance ${processNumber} (${entryGeneration})`
                : `Instance ${processNumber} (${entryGeneration}, UUID not found in fallback)`;
            box.dataset.processNumber = processKey;
            box.dataset.displayLabel = displayLabel;
            box.dataset.generation = entryGeneration;
            if (resolvedUuid) {
                box.dataset.uuid = resolvedUuid;
            }
            
            // Add click handler — use the UUID resolved at box creation time
            box.addEventListener('click', async () => {
                try {
                    const uuid = box.dataset.uuid;
                    if (!uuid) {
                        const fallbackGeneration = box.dataset.generation || null;
                        await this.fetchUUIDFromProcessNumber(processNumber, fallbackGeneration);
                        const uuidInput = this.getElement('uuidInput');
                        if (!uuidInput?.value) {
                            throw new Error(`No fallback UUID for process ${processNumber}`);
                        }
                        this.loadInstanceForProcessNumber(processNumber, uuidInput.value);
                        return;
                    }

                    const uuidInput = this.getElement('uuidInput');
                    if (uuidInput) {
                        uuidInput.value = uuid;
                        uuidInput.dataset.processNumber = processNumber.toString();
                    }
                    this.loadInstanceForProcessNumber(processNumber, uuid);
                } catch (error) {
                    console.error(`Failed to load instance ${processNumber}:`, error);
                    alert(`Failed to load instance ${processNumber}: ${error.message}`);
                }
            });
            
            if (instanceList) {
                instanceList.appendChild(box);
            }
        }
        
        const genLabel = generation ? ` (${generation})` : '';
        console.log(`Loaded ${instanceEntries.length} CPEE instance buttons${genLabel}`);
    }
    
    /**
     * Load error counts from fallback JSON for the error type filter
     */
    async loadErrorCounts() {
        if (this.errorCountsData) {
            return;
        }
        try {
            const response = await fetch('./fallback/errorCounts.json');
            if (response.ok) {
                const raw = await response.json();
                // Support both flat and generation-nested formats.
                // Flatten nested structure into a single lookup for the filter UI.
                const isNested = raw.generation1 !== undefined || raw.generation2 !== undefined;
                if (isNested) {
                    this.errorCountsData = {};
                    for (const entries of Object.values(raw)) {
                        Object.assign(this.errorCountsData, entries);
                    }
                } else {
                    this.errorCountsData = raw;
                }
            }
        } catch (error) {
            console.warn('Failed to load errorCounts.json:', error.message);
        }
    }
    
    /**
     * Wire known-instances filter controls (markup lives in index.html).
     */
    setupKnownInstancesFilter() {
        if (this.knownInstancesFilterInitialized) {
            return;
        }

        const filterRoot = this.getElement('knownInstancesFilter');
        const input = this.getElement('knownInstancesFilterInput');
        const errorSelect = this.getElement('knownInstancesErrorSelect');
        const clearBtn = this.getElement('knownInstancesFilterClear');
        const errorClearBtn = this.getElement('knownInstancesErrorClear');

        if (!filterRoot || !input || !errorSelect || !clearBtn || !errorClearBtn) {
            return;
        }

        filterRoot.querySelectorAll('[data-icon="filter"]').forEach(el => {
            el.innerHTML = ICONS.FILTER;
        });
        filterRoot.querySelectorAll('[data-icon="clear"]').forEach(el => {
            el.innerHTML = ICONS.CLEAR_SEARCH;
        });

        const applyFilters = () => {
            const textValue = input.value.trim();
            const errorType = errorSelect.value;
            clearBtn.style.display = textValue ? 'block' : 'none';
            errorClearBtn.style.display = errorType ? 'block' : 'none';
            errorSelect.classList.toggle('has-selection', !!errorType);
            this.filterKnownInstances(textValue, errorType);
        };

        input.addEventListener('input', applyFilters);
        errorSelect.addEventListener('change', applyFilters);

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            applyFilters();
            input.focus();
        });

        errorClearBtn.addEventListener('click', () => {
            errorSelect.value = '';
            errorClearBtn.style.display = 'none';
            errorSelect.classList.remove('has-selection');
            applyFilters();
            errorSelect.focus();
        });

        this.knownInstancesFilterInput = input;
        this.knownInstancesErrorSelect = errorSelect;
        this.knownInstancesFilterInitialized = true;
    }

    /**
     * Refresh error-type dropdown options (counts depend on loaded errorCounts.json).
     */
    populateKnownInstancesErrorOptions() {
        const errorSelect = this.getElement('knownInstancesErrorSelect');
        if (!errorSelect) {
            return;
        }

        const selected = errorSelect.value;
        errorSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Filter by occurring errors';
        placeholder.hidden = true;
        placeholder.selected = true;
        errorSelect.appendChild(placeholder);

        const counts = this.getErrorTypeCounts();
        const options = [
            { value: 'warningCount', label: `Syntax Warning [${counts.warningCount}]`, className: 'error-option-warning' },
            { value: 'errorCount', label: `Syntax Error [${counts.errorCount}]`, className: 'error-option-error' },
            { value: 'conversionErrors', label: `Conversion Error [${counts.conversionErrors}]`, className: 'error-option-conversion' },
            { value: 'structuralErrors', label: `Structural Violation [${counts.structuralErrors}]`, className: 'error-option-structural' },
        ];

        options.forEach(({ value, label, className }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if (className) opt.className = className;
            errorSelect.appendChild(opt);
        });

        if (selected && options.some(o => o.value === selected)) {
            errorSelect.value = selected;
            errorSelect.classList.add('has-selection');
        } else {
            errorSelect.value = '';
            errorSelect.classList.remove('has-selection');
        }
    }

    /**
     * Reset both known-instances filters (text + error type) to their default state.
     */
    clearKnownInstancesFilters() {
        const input = this.getElement('knownInstancesFilterInput');
        const errorSelect = this.getElement('knownInstancesErrorSelect');
        const clearBtn = this.getElement('knownInstancesFilterClear');
        const errorClearBtn = this.getElement('knownInstancesErrorClear');

        if (input) {
            input.value = '';
        }
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        if (errorSelect) {
            errorSelect.value = '';
            errorSelect.classList.remove('has-selection');
        }
        if (errorClearBtn) {
            errorClearBtn.style.display = 'none';
        }
    }
    
    /**
     * Count how many known instances have each error type (count > 0)
     * @returns {Object} Counts per error type key
     */
    getErrorTypeCounts() {
        const processNumbers = configManager.get('ui.instances.processNumbers', []);
        const data = this.errorCountsData || {};
        const counts = { warningCount: 0, errorCount: 0, conversionErrors: 0, structuralErrors: 0 };
        
        for (const pn of processNumbers) {
            const entry = data[String(pn)];
            if (!entry) continue;
            if (entry.warningCount > 0) counts.warningCount++;
            if (entry.errorCount > 0) counts.errorCount++;
            if (entry.conversionErrors > 0) counts.conversionErrors++;
            if (entry.structuralErrors > 0) counts.structuralErrors++;
        }
        return counts;
    }
    
    /**
     * Filter known instances by partial match on instance number and/or error type.
     * @param {string} filterValue - The filter string to match against instance numbers
     * @param {string} [errorType=''] - Error type key to filter by (e.g. 'warningCount')
     */
    filterKnownInstances(filterValue, errorType = '') {
        const instanceList = this.getElement('loadAllInstancesList');
        if (!instanceList) {
            return;
        }
        
        const errorData = this.errorCountsData || {};
        const instanceBoxes = instanceList.querySelectorAll('.instance-number-box');
        
        instanceBoxes.forEach((box) => {
            const processNumber = box.dataset.processNumber || box.textContent.trim();
            const displayLabel = box.dataset.displayLabel || processNumber;
            
            // Check error type filter
            let passesErrorFilter = true;
            if (errorType) {
                const entry = errorData[processNumber];
                passesErrorFilter = entry && entry[errorType] > 0;
            }
            
            // Check text filter (match on process number and visible label)
            let passesTextFilter = true;
            let matchIndex = -1;
            if (filterValue) {
                const processMatch = processNumber.indexOf(filterValue);
                const labelMatch = displayLabel.indexOf(filterValue);
                if (processMatch !== -1) {
                    matchIndex = processMatch;
                } else if (labelMatch !== -1) {
                    matchIndex = labelMatch;
                } else {
                    passesTextFilter = false;
                }
            }
            
            const visible = passesTextFilter && passesErrorFilter;
            box.style.display = visible ? '' : 'none';
            
            // Update highlight markup
            if (filterValue && passesTextFilter) {
                const before = displayLabel.substring(0, matchIndex);
                const match = displayLabel.substring(matchIndex, matchIndex + filterValue.length);
                const after = displayLabel.substring(matchIndex + filterValue.length);
                box.innerHTML = `${before}<span class="instance-filter-match">${match}</span>${after}`;
            } else {
                box.textContent = displayLabel;
            }
        });
    }
    
    /**
     * Sequentially load all known CPEE instances
     * Each instance is loaded only after the previous one has finished loading
     */
    async loadAllKnownInstancesSequentially() {
        const loadAllKnownButton = this.getElement('loadAllKnownInstances');

        // Always load only the currently visible boxes. This naturally honours both
        // the generation filter (loadAllCPEEInstances already wrote only the correct
        // generation into the DOM) and any active text/error-type filter.
        const instanceList = this.getElement('loadAllInstancesList');
        const instanceBoxes = instanceList
            ? Array.from(instanceList.querySelectorAll('.instance-number-box'))
                  .filter(box => box.style.display !== 'none')
                  .map(box => ({
                      processNumber: parseInt(box.dataset.processNumber || box.textContent.trim(), 10),
                      generation: box.dataset.generation || null,
                      uuid: box.dataset.uuid || null
                  }))
                  .filter(entry => !isNaN(entry.processNumber))
            : [];

        if (!Array.isArray(instanceBoxes) || instanceBoxes.length === 0) {
            console.warn('No process numbers match the current filter');
            alert('No instances match the current filter.');
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
        for (const { processNumber, generation, uuid: presetUuid } of instanceBoxes) {
            try {
                // Update button text to show progress
                if (loadAllKnownButton) {
                    loadAllKnownButton.textContent = `Loading ${loadedCount + 1}/${instanceBoxes.length}...`;
                }
                
                let uuid = presetUuid;
                if (!uuid) {
                    const cpeeService = serviceFactory.get('CPEEService');
                    const result = await cpeeService.fetchUUIDFromProcessNumber(processNumber, {
                        source: 'fallback',
                        generation
                    });
                    uuid = result.uuid;
                }
                
                if (uuid) {
                    await this.loadInstanceAndWait(uuid, processNumber);
                    loadedCount++;
                    console.log(`Successfully loaded instance ${processNumber} (${loadedCount}/${instanceBoxes.length})`);
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
            
            this.stateManager.setState('ui.loading', true);
            this.eventBus.emit('instanceLoader:loadInstance', { uuid, source: 'fallback', processNumber });
            
            // Set a timeout to prevent hanging forever
            setTimeout(() => {
                this.eventBus.off('instance:loaded', onLoadComplete);
                this.eventBus.off('instance:loadFailed', onLoadFailed);
                reject(new Error(`Timeout loading instance ${processNumber}`));
            }, 60000); // 60 second timeout per instance
        });
    }
}
