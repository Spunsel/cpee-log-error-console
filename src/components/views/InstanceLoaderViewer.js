/**
 * Instance Loader Viewer Component
 * Handles the initial page UI where users input process number, fetch UUID, and load instances
 */

import { CPEEService } from '../../services/CPEEService.js';
import { configManager } from '../../config/ConfigManager.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

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
            const uuid = await CPEEService.fetchUUIDFromProcessNumber(processNumber);

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
}
