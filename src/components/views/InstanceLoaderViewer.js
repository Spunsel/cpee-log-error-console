/**
 * Instance Loader Viewer Component
 * Handles the initial page UI where users input process number, fetch UUID, and load instances
 */

import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { LogService } from '../../services/LogService.js';
import { proxyRotationService } from '../../services/ProxyRotationService.js';

export class InstanceLoaderViewer {
    constructor(instanceService, domRegistry = null, eventBus = null, stateManager = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.isVisible = true;
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
        const loadSection = document.querySelector('.load-single-instance-section');
        if (loadSection) {
            loadSection.classList.remove('hidden');
            this.isVisible = true;
        }
    }

    /**
     * Hide the instance loader view
     */
    hide() {
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
     * Check if an instance has steps in its log
     * Uses promises instead of async/await as requested
     * @param {number} processNumber - Process instance number
     * @returns {Promise<{hasSteps: boolean, processNumber: number, uuid: string|null}>}
     */
    checkInstanceForSteps(processNumber) {
        const cpeeService = serviceFactory.get('CPEEService');
        
        return cpeeService.fetchUUIDFromProcessNumber(processNumber).then((uuid) => 
            LogService.fetchAndParseLog(uuid).then((logData) => {
                const steps = LogService.parseStepsFromLog(logData);
                return {
                    hasSteps: steps.length > 0,
                    processNumber: processNumber,
                    uuid: uuid,
                    stepCount: steps.length
                };
            }).catch((error) => {
                console.warn(`Failed to fetch/parse log for instance ${processNumber}:`, error);
                return {
                    hasSteps: false,
                    processNumber: processNumber,
                    uuid: uuid,
                    error: error.message
                };
            })
        ).catch((error) => {
            // Check if it's a 404 (process number doesn't exist) - this is expected, not an error
            const isNotFound = error.status === 404 || error.isNotFound || (error.message && error.message.includes('404'));
            if (isNotFound) {
                // Silently skip - process number doesn't exist, no need to log as error
                return {
                    hasSteps: false,
                    processNumber: processNumber,
                    uuid: null,
                    error: 'Process number does not exist',
                    isNotFound: true
                };
            }
            // Other errors (network issues, rate limits, etc.) should be logged
            console.warn(`Failed to fetch UUID for instance ${processNumber}:`, error);
            return {
                hasSteps: false,
                processNumber: processNumber,
                uuid: null,
                error: error.message
            };
        });
    }

    /**
     * Scan a range of instances sequentially to find those with steps
     * Checks each instance one by one without using async/await
     * @param {number} start - Starting instance number
     * @param {number} end - Ending instance number
     */
    scanInstancesForSteps(start, end) {
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
        let currentIndex = 0;
        const startTime = Date.now();
        let rateLimitDelay = 15000;
        let isRateLimited = false;
        let successfulRequestsAfterRateLimit = 0; // Track successful requests after rate limit
        
        // Helper function to handle rate limit delays
        const handleRateLimit = (processNumber) => {
            isRateLimited = true;
            successfulRequestsAfterRateLimit = 0; // Reset counter
            console.warn(`⚠ Rate limit detected at instance ${processNumber}. Waiting ${rateLimitDelay/1000}s before continuing...`);
            if (scanButton) {
                scanButton.textContent = `Waiting ${rateLimitDelay/1000}s (rate limited at ${processNumber})...`;
            }
            
            setTimeout(() => {
                rateLimitDelay = Math.min(60000, rateLimitDelay + 10000);
                const initialResumeDelay = Math.max(10000, rateLimitDelay * 0.5);
                console.log(`Resuming after rate limit. Waiting additional ${initialResumeDelay/1000}s before first request...`);
                
                setTimeout(() => {
                    // Use standard 2 second delay after rate limit recovery
                    console.log('Resuming with 2 second delay between requests (0.5 requests/second).');
                    setTimeout(() => continueScan(), 2000);
                }, initialResumeDelay);
            }, rateLimitDelay);
        };
        
        // Helper function to update rate limit state on success
        const updateRateLimitState = () => {
            if (isRateLimited) {
                successfulRequestsAfterRateLimit++;
                // After 2 successful requests, reset to normal speed
                if (successfulRequestsAfterRateLimit >= 2) {
                    isRateLimited = false;
                    rateLimitDelay = 15000;
                    console.log('✓ Rate limit cleared. Resuming normal scan speed.');
                }
            }
        };
        
        // Helper function to get delay between requests
        // Delay between log fetches to prevent rate limiting (configurable via network.interRequestDelay)
        // Proxies 2 and 3 (indices 1 and 2) are faster, so use shorter delay for them
        const getInterRequestDelay = () => {
            const baseDelay = configManager.get('network.interRequestDelay', 10);
            const currentProxyIndex = proxyRotationService.getCurrentIndex();
            
            // Proxy 1 (index 0): use base delay
            // Proxies 2 and 3 (indices 1 and 2): use shorter delay since they're faster
            if (currentProxyIndex === 1 || currentProxyIndex === 2) {
                // Use half the delay for faster proxies
                return Math.max(5, Math.floor(baseDelay / 2));
            }
            
            return baseDelay;
        };
        
        // Helper function to continue scanning
        const continueScan = (delay = getInterRequestDelay()) => {
            setTimeout(() => {
                try {
                    checkNextInstance();
                } catch (error) {
                    console.error(`Error continuing scan:`, error);
                    currentIndex++;
                    if (currentIndex < instancesToCheck.length) {
                        setTimeout(() => checkNextInstance(), 100);
                    }
                }
            }, delay);
        };
        
        // Helper function to check if error is rate limit
        const isRateLimitError = (error) => {
            const errorMessage = error?.message || String(error);
            return errorMessage.includes('403') || 
                   errorMessage.includes('Forbidden') || 
                   error?.status === 403;
        };
        
        // Helper function to finish scanning
        const finishScan = () => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✓ Scan complete! Checked ${instancesToCheck.length} instances, found ${instancesWithSteps.length} CPEE LLM Instances in ${elapsed} seconds`);
            
            if (scanButton) {
                scanButton.disabled = false;
                scanButton.textContent = 'Scan for CPEE LLM Instances';
            }
            
            try {
                this.displayInstanceList(instancesWithSteps);
            } catch (displayError) {
                console.error('Error displaying instance list:', displayError);
            }
            
            if (instancesWithSteps.length === 0) {
                if (instanceList) {
                    instanceList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No CPEE LLM Instances found in the specified range.</p>';
                }
            } else {
                const foundNumbers = instancesWithSteps.map(i => i.processNumber).sort((a, b) => a - b);
                console.log(`CPEE LLM Instances (${foundNumbers.length} total): ${foundNumbers.join(', ')}`);
            }
        };
        
        // Main function to check next instance sequentially
        const checkNextInstance = () => {
            if (currentIndex >= instancesToCheck.length) {
                finishScan();
                return;
            }
            
            const processNumber = instancesToCheck[currentIndex];
            currentIndex++;
            
            // Log progress
            if (currentIndex % 100 === 0 || currentIndex === 1) {
                console.log(`Checking instance ${processNumber} (${currentIndex}/${instancesToCheck.length})`);
            }
            
            // Update UI
            if (scanButton) {
                const progress = ((currentIndex / instancesToCheck.length) * 100).toFixed(1);
                scanButton.textContent = `Scanning ${processNumber}... (${currentIndex}/${instancesToCheck.length}, ${progress}%)`;
            }
            
            // Check this instance
            this.checkInstanceForSteps(processNumber).then((result) => {
                if (result && result.hasSteps && result.uuid) {
                    instancesWithSteps.push(result);
                    console.log(`✓ Instance ${processNumber} has ${result.stepCount || 'unknown'} steps`);
                    updateRateLimitState();
                    continueScan();
                } else if (result && result.error) {
                    // Check if it's a 404 (process doesn't exist) - skip silently
                    if (result.isNotFound) {
                        // Process number doesn't exist, just continue without logging
                        continueScan();
                        return;
                    }
                    
                    // Check if it's a rate limit error
                    if (isRateLimitError({ message: result.error })) {
                        handleRateLimit(processNumber);
                        return;
                    }
                    
                    // Log other errors occasionally
                    if (currentIndex % 50 === 0) {
                        console.log(`✗ Instance ${processNumber}: ${result.error} (logged every 50 instances)`);
                    }
                    
                    updateRateLimitState();
                    continueScan();
                } else {
                    continueScan();
                }
            }).catch((error) => {
                // Check if it's a 404 (process doesn't exist)
                const isNotFound = error.status === 404 || error.isNotFound || (error.message && error.message.includes('404'));
                if (isNotFound) {
                    // Process number doesn't exist, just continue silently
                    continueScan();
                    return;
                }
                
                if (isRateLimitError(error)) {
                    handleRateLimit(processNumber);
                } else {
                    console.error(`✗ Error checking instance ${processNumber}:`, error);
                    updateRateLimitState();
                    continueScan();
                }
            });
        };
        
        // Start checking
        checkNextInstance();
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
