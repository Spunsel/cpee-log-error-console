/**
 * Instance Loader Viewer Component
 * Handles the initial page UI where users input process number, fetch UUID, and load instances
 */

import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';
import { serviceFactory } from '../../core/ServiceFactory.js';
import { LogService } from '../../services/LogService.js';

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
        const stepDetails = this.getElement('stepDetails');
        if (stepDetails) {
            stepDetails.classList.remove('hidden');
            this.isVisible = true;
        }
    }

    /**
     * Hide the instance loader view
     */
    hide() {
        const stepDetails = this.getElement('stepDetails');
        if (stepDetails) {
            stepDetails.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Setup event listeners for instance loader interactions
     */
    setupEventListeners() {
        // Clear any pre-filled values in scan inputs to ensure placeholders show
        const scanStartInput = this.getElement('scan-start-input');
        const scanEndInput = this.getElement('scan-end-input');
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
        const scanButton = this.getElement('scan-instances');
        if (scanButton) {
            scanButton.addEventListener('click', () => {
                const startInput = this.getElement('scan-start-input');
                const endInput = this.getElement('scan-end-input');
                
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
            console.error('Error fetching UUID:', error);
            alert(`Failed to fetch UUID: ${error.message}`);

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
                    uuid: uuid
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
        const scanButton = this.getElement('scan-instances');
        const instanceListContainer = this.getElement('instance-list-container');
        const instanceList = this.getElement('instance-list');
        
        // Disable button and clear previous results
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
        const instancesToCheck = [];
        for (let i = start; i <= end; i++) {
            instancesToCheck.push(i);
        }
        
        // Store results
        const instancesWithSteps = [];
        let currentIndex = 0;
        
        // Function to check next instance sequentially
        const checkNextInstance = () => {
            if (currentIndex >= instancesToCheck.length) {
                // Finished scanning
                if (scanButton) {
                    scanButton.disabled = false;
                    scanButton.textContent = 'Scan for Instances with Steps';
                }
                
                // Display results
                this.displayInstanceList(instancesWithSteps);
                
                if (instancesWithSteps.length === 0) {
                    if (instanceList) {
                        instanceList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No instances with steps found in the specified range.</p>';
                    }
                }
                
                return;
            }
            
            const processNumber = instancesToCheck[currentIndex];
            currentIndex++;
            
            // Update UI to show progress
            if (scanButton) {
                scanButton.textContent = `Scanning ${processNumber}... (${currentIndex}/${instancesToCheck.length})`;
            }
            
            // Check this instance
            this.checkInstanceForSteps(processNumber).then((result) => {
                if (result.hasSteps && result.uuid) {
                    instancesWithSteps.push(result);
                }
                
                // Check next instance after this one completes
                checkNextInstance();
            }).catch((error) => {
                console.error(`Error checking instance ${processNumber}:`, error);
                // Continue to next instance even on error
                checkNextInstance();
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
        const instanceList = this.getElement('instance-list');
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
}
