/**
 * Instance Loader Viewer Component
 * Handles the initial page UI where users input process number, fetch UUID, and load instances
 */

import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { RecentAdditionsAndFixes } from '../ui/RecentAdditionsAndFixes.js';

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
        const advancedInstanceLoading = this.domRegistry 
            ? this.domRegistry.getElement('advancedInstanceLoading')
            : document.getElementById('advanced-instance-loading');
        if (advancedInstanceLoading) {
            advancedInstanceLoading.classList.remove('hidden');
        }
        
        // Show recent additions and fixes section
        const recentAdditionsAndFixes = document.getElementById('recent-additions-and-fixes');
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
        const fetchUuidButton = this.getElement('fetchUuid');
        const uuidInput = this.getElement('uuidInput');
        const processNumberInput = this.getElement('processNumberInput');

        // Load instance button
        if (loadButton && uuidInput) {
            loadButton.addEventListener('click', () => {
                const uuid = uuidInput.value.trim();
                if (uuid) {
                    // Set loading state
                    this.stateManager.setState('ui.loading', true);
                    this.eventBus.emit('instanceLoader:loadInstance', { uuid });
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
            viewLogButton.addEventListener('click', () => {
                const uuid = uuidInput.value.trim();
                if (uuid) {
                    this.eventBus.emit('instanceLoader:viewLog', { uuid });
                } else {
                    alert('Please enter a UUID first');
                }
            });
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

        // Load all instances button
        const loadAllButton = this.getElement('loadAllInstances');
        if (loadAllButton) {
            loadAllButton.addEventListener('click', () => {
                this.loadAllCPEEInstances();
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
            const fetchButton = this.getElement('fetchUuid');
            const uuidInput = this.getElement('uuidInput');

            if (fetchButton) {
                fetchButton.textContent = 'Fetching...';
                fetchButton.disabled = true;
            }

            // Fetch UUID from CPEE service
            const cpeeService = serviceFactory.get('CPEEService');
            const uuid = await cpeeService.fetchUUIDFromProcessNumber(processNumber);

            // Update UUID input field and store the process number for later use
            if (uuidInput) {
                uuidInput.value = uuid;
                // Store process number as data attribute for later use
                uuidInput.dataset.processNumber = processNumber;
                console.log(`UUID fetched successfully: ${uuid}`);

                // Show success message
                const processNumberInput = this.getElement('processNumberInput');
                if (processNumberInput) {
                    processNumberInput.style.borderColor = configManager.get('styling.colors.success');
                    setTimeout(() => {
                        processNumberInput.style.borderColor = '';
                    }, configManager.get('ui.notifications.successDuration'));
                }
            }

        } catch (error) {
            // Check if it's a 404 (process number doesn't exist)
            if (error.status === 404 || error.isNotFound || (error.message && error.message.includes('404'))) {
                console.log(`Process number ${processNumber} does not exist (404)`);
                alert(`Process number ${processNumber} does not exist. Please enter a valid process number.`);
            } else {
                console.error('Error fetching UUID:', error);
                alert(`Failed to fetch UUID: ${error.message}`);
            }

            // Show error state
            const processNumberInput = this.getElement('processNumberInput');
            if (processNumberInput) {
                processNumberInput.style.borderColor = configManager.get('styling.colors.error');
                setTimeout(() => {
                    processNumberInput.style.borderColor = '';
                }, configManager.get('ui.notifications.errorDuration'));
            }
        } finally {
            // Reset button state
            const fetchButton = this.getElement('fetchUuid');
            if (fetchButton) {
                fetchButton.textContent = 'Fetch UUID';
                fetchButton.disabled = false;
            }
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
            // Fetch UUID from process number
            const uuid = await cpeeService.fetchUUIDFromProcessNumber(processNumber);
            
            try {
                // Fetch and parse log
                const logData = await this.logFetchService.fetchAndParseLog(uuid);
                
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
                console.warn(`Failed to fetch/parse log for instance ${processNumber}:`, error);
                return {
                    hasSteps: false,
                    processNumber,
                    uuid,
                    error: error.message
                };
            }
        } catch (error) {
            // Check if it's a 404 (process number doesn't exist) - this is expected, not an error
            const isNotFound = error.status === 404 || error.isNotFound || (error.message && error.message.includes('404'));
            if (isNotFound) {
                // Silently skip - process number doesn't exist, no need to log as error
                return {
                    hasSteps: false,
                    processNumber,
                    uuid: null,
                    error: 'Process number does not exist',
                    isNotFound: true
                };
            }
            // Other errors (network issues, rate limits, etc.) - silently handle
            return {
                hasSteps: false,
                processNumber,
                uuid: null,
                error: error.message
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
        const instancesWithSteps = [];
        const concurrency = configManager.get('network.scanConcurrency', 5);
        
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
                    instancesWithSteps.push(result);
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
                    scanButton.textContent = `Rate limited. Waiting ${delay/1000}s...`;
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
        
        try {
            this.displayInstanceList(instancesWithSteps);
        } catch (displayError) {
            // Silently handle display errors
        }
        
        if (instancesWithSteps.length === 0) {
            if (instanceList) {
                instanceList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No CPEE LLM Instances found in the specified range.</p>';
            }
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
        
        // Trigger load instance event
        this.stateManager.setState('ui.loading', true);
        this.eventBus.emit('instanceLoader:loadInstance', { uuid });
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
        
        // Clear existing list
        if (instanceList) {
            instanceList.innerHTML = '';
        }
        
        // Create buttons for each process number
        processNumbers.forEach((processNumber) => {
            const box = document.createElement('div');
            box.className = 'instance-number-box';
            box.textContent = processNumber.toString();
            box.title = `Click to load instance ${processNumber}`;
            
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
}
