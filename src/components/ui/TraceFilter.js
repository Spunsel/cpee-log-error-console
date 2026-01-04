/**
 * Trace Filter Component
 * Provides filtering for traces by Alt ID, ID, and Task Label
 * Includes autocomplete functionality based on tasks in current section
 */

import { ICONS } from '../../assets/icons.js';

export class TraceFilter {
    constructor(domRegistry = null, sectionId = null) {
        this.domRegistry = domRegistry;
        this.sectionId = sectionId;
        this.onFilterChange = null;
        
        // Store references to DOM elements
        this.element = null;
        this.altIdInput = null;
        this.idInput = null;
        this.taskLabelInput = null;
        
        // Autocomplete data
        this.autocompleteData = {
            altIds: new Set(),
            ids: new Set(),
            taskLabels: new Set()
        };
        
        // Current filter values
        this.currentFilters = {
            altId: '',
            id: '',
            taskLabel: ''
        };
        
        // Autocomplete dropdowns
        this.altIdDropdown = null;
        this.idDropdown = null;
        this.taskLabelDropdown = null;
        
        // Track highlighted item per filter type
        this.highlightedItems = {
            'alt-id': null,
            'id': null,
            'task-label': null
        };
    }

    /**
     * Set callback for when filter changes
     * @param {Function} callback - Callback function to call with filter values
     */
    setOnFilterChange(callback) {
        this.onFilterChange = callback;
    }

    /**
     * Update autocomplete data from traces
     * @param {Array} traces - Array of trace objects
     */
    updateAutocompleteData(traces) {
        this.autocompleteData.altIds.clear();
        this.autocompleteData.ids.clear();
        this.autocompleteData.taskLabels.clear();
        
        traces.forEach(trace => {
            if (trace.path) {
                trace.path.forEach(task => {
                    if (task.alt_id) {
                        this.autocompleteData.altIds.add(task.alt_id);
                    }
                    if (task.id) {
                        this.autocompleteData.ids.add(task.id);
                    }
                    if (task.task) {
                        this.autocompleteData.taskLabels.add(task.task);
                    }
                });
            }
        });
    }

    /**
     * Create trace filter HTML structure
     * @returns {HTMLElement} Filter container
     */
    createFilter() {
        const filterContainer = document.createElement('div');
        filterContainer.className = 'trace-filter-container';
        
        // Alt ID filter
        const altIdGroup = this.createFilterInput('alt-id', 'Filter by Alt ID');
        filterContainer.appendChild(altIdGroup.container);
        this.altIdInput = altIdGroup.input;
        this.altIdDropdown = altIdGroup.dropdown;
        this.altIdClearBtn = altIdGroup.clearBtn;
        
        // ID filter
        const idGroup = this.createFilterInput('id', 'Filter by ID');
        filterContainer.appendChild(idGroup.container);
        this.idInput = idGroup.input;
        this.idDropdown = idGroup.dropdown;
        this.idClearBtn = idGroup.clearBtn;
        
        // Task Label filter
        const taskLabelGroup = this.createFilterInput('task-label', 'Filter by task label');
        filterContainer.appendChild(taskLabelGroup.container);
        this.taskLabelInput = taskLabelGroup.input;
        this.taskLabelDropdown = taskLabelGroup.dropdown;
        this.taskLabelClearBtn = taskLabelGroup.clearBtn;
        
        this.element = filterContainer;
        this.setupEventListeners();
        
        return filterContainer;
    }

    /**
     * Create a filter input with autocomplete
     * @param {string} type - Input type ('alt-id', 'id', 'task-label')
     * @param {string} placeholder - Placeholder text
     * @returns {Object} Object with container, input, and dropdown elements
     */
    createFilterInput(type, placeholder) {
        const container = document.createElement('div');
        container.className = 'trace-filter-input-group';
        
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'trace-filter-input-wrapper';
        
        // Use search-input-group structure like SearchBar
        const inputGroup = document.createElement('div');
        inputGroup.className = 'search-input-group';
        
        const searchIcon = document.createElement('div');
        searchIcon.className = 'search-icon';
        searchIcon.innerHTML = ICONS.SEARCH;
        inputGroup.appendChild(searchIcon);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'search-input';
        input.placeholder = placeholder;
        input.setAttribute('data-filter-type', type);
        inputGroup.appendChild(input);
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'search-clear-btn';
        clearBtn.innerHTML = ICONS.CLEAR_SEARCH;
        clearBtn.setAttribute('aria-label', 'Clear filter');
        clearBtn.style.display = 'none';
        clearBtn.addEventListener('click', () => {
            input.value = '';
            this.currentFilters[type] = '';
            clearBtn.style.display = 'none';
            this.hideAutocomplete(type);
            this.applyFilters();
        });
        inputGroup.appendChild(clearBtn);
        
        inputWrapper.appendChild(inputGroup);
        
        // Autocomplete dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'trace-filter-autocomplete';
        dropdown.setAttribute('data-filter-type', type);
        dropdown.style.display = 'none';
        inputWrapper.appendChild(dropdown);
        
        container.appendChild(inputWrapper);
        
        return { container, input, dropdown, clearBtn };
    }

    /**
     * Setup event listeners for filter inputs
     */
    setupEventListeners() {
        // Alt ID input
        if (this.altIdInput) {
            this.setupInputListeners(this.altIdInput, 'alt-id', this.altIdDropdown);
        }
        
        // ID input
        if (this.idInput) {
            this.setupInputListeners(this.idInput, 'id', this.idDropdown);
        }
        
        // Task Label input
        if (this.taskLabelInput) {
            this.setupInputListeners(this.taskLabelInput, 'task-label', this.taskLabelDropdown);
        }
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target)) {
                this.hideAllAutocompletes();
            }
        });
    }

    /**
     * Setup event listeners for a specific input
     * @param {HTMLElement} input - Input element
     * @param {string} type - Filter type
     * @param {HTMLElement} dropdown - Autocomplete dropdown
     */
    setupInputListeners(input, type, dropdown) {
        const clearBtn = input.parentElement.querySelector('.search-clear-btn');
        
        // Input event - apply filter and show autocomplete
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            this.currentFilters[type] = value;
            
            // Show/hide clear button
            if (clearBtn) {
                clearBtn.style.display = value ? 'block' : 'none';
            }
            
            // Show autocomplete on focus or when typing
            if (value || document.activeElement === input) {
                this.showAutocomplete(type, value);
            } else {
                this.hideAutocomplete(type);
            }
            
            // Apply filters
            this.applyFilters();
        });
        
        // Focus event - show autocomplete
        input.addEventListener('focus', () => {
            if (input.value || this.getAutocompleteOptions(type, '').length > 0) {
                this.showAutocomplete(type, input.value);
            }
        });
        
        // Blur event - hide autocomplete after a short delay (to allow click on suggestion)
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.activeElement !== dropdown) {
                    this.hideAutocomplete(type);
                }
            }, 200);
        });
        
        // Keyboard events - Enter to select highlighted item or navigate results
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                // Check if dropdown is visible and has items
                const isDropdownVisible = dropdown.style.display !== 'none';
                const hasDropdownItems = dropdown.querySelectorAll('.trace-filter-autocomplete-item').length > 0;
                
                // If dropdown is visible with items, select the highlighted/first item
                if (isDropdownVisible && hasDropdownItems) {
                    const highlightedItem = this.highlightedItems[type];
                    if (highlightedItem) {
                        highlightedItem.click();
                    } else {
                        // If no item highlighted, select first item
                        const firstItem = dropdown.querySelector('.trace-filter-autocomplete-item');
                        if (firstItem) {
                            firstItem.click();
                        }
                    }
                }
            }
        });
    }

    /**
     * Natural sort comparison function
     * Sorts strings with numbers numerically (e.g., "a5" before "a41")
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Comparison result
     */
    naturalSort(a, b) {
        const aStr = String(a);
        const bStr = String(b);
        
        // Split strings into parts (text and numbers)
        const aParts = aStr.match(/(\d+|\D+)/g) || [];
        const bParts = bStr.match(/(\d+|\D+)/g) || [];
        
        const minLength = Math.min(aParts.length, bParts.length);
        
        for (let i = 0; i < minLength; i++) {
            const aPart = aParts[i];
            const bPart = bParts[i];
            
            const aIsNum = /^\d+$/.test(aPart);
            const bIsNum = /^\d+$/.test(bPart);
            
            if (aIsNum && bIsNum) {
                // Both are numbers - compare numerically
                const aNum = parseInt(aPart, 10);
                const bNum = parseInt(bPart, 10);
                if (aNum !== bNum) {
                    return aNum - bNum;
                }
            } else if (aIsNum) {
                // a is number, b is text - numbers come first
                return -1;
            } else if (bIsNum) {
                // b is number, a is text - numbers come first
                return 1;
            } else {
                // Both are text - compare alphabetically (case-insensitive)
                const comparison = aPart.toLowerCase().localeCompare(bPart.toLowerCase());
                if (comparison !== 0) {
                    return comparison;
                }
            }
        }
        
        // If all parts match up to minLength, shorter string comes first
        return aParts.length - bParts.length;
    }

    /**
     * Get autocomplete options for a filter type
     * @param {string} type - Filter type
     * @param {string} query - Search query
     * @returns {Array} Array of matching options
     */
    getAutocompleteOptions(type, query) {
        let sourceSet;
        let isPartialMatch = false;
        
        switch (type) {
            case 'alt-id':
                sourceSet = this.autocompleteData.altIds;
                isPartialMatch = false; // Exact match
                break;
            case 'id':
                sourceSet = this.autocompleteData.ids;
                isPartialMatch = false; // Exact match
                break;
            case 'task-label':
                sourceSet = this.autocompleteData.taskLabels;
                isPartialMatch = true; // Partial match
                break;
            default:
                return [];
        }
        
        const options = Array.from(sourceSet);
        
        if (!query) {
            return options.sort((a, b) => this.naturalSort(a, b));
        }
        
        const queryLower = query.toLowerCase();
        
        if (isPartialMatch) {
            // Partial match for task labels
            return options
                .filter(option => option.toLowerCase().includes(queryLower))
                .sort((a, b) => this.naturalSort(a, b));
        } else {
            // Exact match for IDs
            return options
                .filter(option => option.toLowerCase() === queryLower || option.toLowerCase().startsWith(queryLower))
                .sort((a, b) => this.naturalSort(a, b));
        }
    }

    /**
     * Show autocomplete dropdown
     * @param {string} type - Filter type
     * @param {string} query - Search query
     */
    showAutocomplete(type, query) {
        const dropdown = this.element.querySelector(`.trace-filter-autocomplete[data-filter-type="${type}"]`);
        if (!dropdown) {
            return;
        }
        
        const input = this.element.querySelector(`.search-input[data-filter-type="${type}"]`);
        if (!input) {
            return;
        }
        
        const options = this.getAutocompleteOptions(type, query);
        
        if (options.length === 0) {
            this.hideAutocomplete(type);
            return;
        }
        
        dropdown.innerHTML = '';
        this.highlightedItems[type] = null;
        
        options.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'trace-filter-autocomplete-item';
            item.textContent = option;
            
            // Highlight first item by default
            if (index === 0) {
                item.classList.add('highlighted');
                this.highlightedItems[type] = item;
            }
            
            item.addEventListener('click', () => {
                this.selectAutocompleteItem(type, option, input);
            });
            
            // Mouse hover - update highlighted item
            item.addEventListener('mouseenter', () => {
                // Remove highlight from all items
                dropdown.querySelectorAll('.trace-filter-autocomplete-item').forEach(i => {
                    i.classList.remove('highlighted');
                });
                // Add highlight to hovered item
                item.classList.add('highlighted');
                this.highlightedItems[type] = item;
            });
            
            dropdown.appendChild(item);
        });
        
        dropdown.style.display = 'block';
    }

    /**
     * Select an autocomplete item
     * @param {string} type - Filter type
     * @param {string} option - Selected option value
     * @param {HTMLElement} input - Input element (optional, will be found if not provided)
     */
    selectAutocompleteItem(type, option, input = null) {
        if (!input) {
            input = this.element.querySelector(`.search-input[data-filter-type="${type}"]`);
        }
        if (input) {
            input.value = option;
            this.currentFilters[type] = option;
            const clearBtn = input.parentElement.querySelector('.search-clear-btn');
            if (clearBtn) {
                clearBtn.style.display = 'block';
            }
            this.hideAutocomplete(type);
            this.applyFilters();
            input.focus();
        }
    }

    /**
     * Hide autocomplete dropdown
     * @param {string} type - Filter type
     */
    hideAutocomplete(type) {
        const dropdown = this.element.querySelector(`.trace-filter-autocomplete[data-filter-type="${type}"]`);
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    /**
     * Hide all autocomplete dropdowns
     */
    hideAllAutocompletes() {
        const dropdowns = this.element.querySelectorAll('.trace-filter-autocomplete');
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }

    /**
     * Apply filters and notify callback
     */
    applyFilters() {
        if (this.onFilterChange) {
            const filterValues = {
                altId: this.currentFilters['alt-id'] || '',
                id: this.currentFilters['id'] || '',
                taskLabel: this.currentFilters['task-label'] || ''
            };
            console.log('[TraceFilter] Applying filters:', filterValues);
            this.onFilterChange(filterValues);
        }
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        this.currentFilters = {
            'alt-id': '',
            'id': '',
            'task-label': ''
        };
        
        if (this.altIdInput) {
            this.altIdInput.value = '';
            if (this.altIdClearBtn) {
                this.altIdClearBtn.style.display = 'none';
            }
        }
        if (this.idInput) {
            this.idInput.value = '';
            if (this.idClearBtn) {
                this.idClearBtn.style.display = 'none';
            }
        }
        if (this.taskLabelInput) {
            this.taskLabelInput.value = '';
            if (this.taskLabelClearBtn) {
                this.taskLabelClearBtn.style.display = 'none';
            }
        }
        
        this.hideAllAutocompletes();
        this.applyFilters();
    }

    /**
     * Attach filter to a container
     * @param {HTMLElement} container - Container to attach filter to
     */
    attachToContainer(container) {
        if (!container) {
            console.warn('TraceFilter: No container provided for attachment');
            return;
        }
        
        if (!this.element) {
            this.createFilter();
        }
        
        container.appendChild(this.element);
    }
}

