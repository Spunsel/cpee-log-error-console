/**
 * Action Bar Component
 * Combines copy button, download button, export SVG button and search bar in a sticky container
 * Provides unified interface for raw content actions
 * Supports different modes via options (e.g., graph mode with export SVG)
 */

import { CopyButton } from './CopyButton.js';
import { DownloadButton } from './DownloadButton.js';
import { ExportSVGButton } from './ExportSVGButton.js';
import { SearchBar } from './SearchBar.js';
import { CodeMinimap } from './CodeMinimap.js';
import { ICONS } from '../../assets/icons.js';
import { eventBus } from '../../core/EventBus.js';

export class ActionBar {
    constructor(domRegistry = null, searchService = null, sectionId = null, options = {}) {
        this.domRegistry = domRegistry;
        this.copyButton = new CopyButton(domRegistry);
        this.downloadButton = new DownloadButton(domRegistry, { showText: false });
        this.searchBar = new SearchBar(domRegistry, searchService, sectionId);
        this.sectionId = sectionId;
        this.isVisible = false;
        this.onCopy = null;
        this.onDownload = null;
        this.onSearch = null;
        this.onClear = null;
        this.onNavigate = null;
        this.element = null; // Store reference to the action bar DOM element
        
        // Options
        this.showSearch = options.showSearch !== false; // Default to true
        this.showViewLog = options.showViewLog === true; // Default to false
        this.showCopy = options.showCopy !== false; // Default to true
        this.showDownload = options.showDownload !== false; // Default to true
        this.showExportSVG = options.showExportSVG === true; // Default to false
        this.showMinimap = options.showMinimap === true; // Default to false
        this.minimapContentType = options.minimapContentType || 'mermaid'; // 'cpee' or 'mermaid'
        this.showPreprocessingInMinimap = options.showPreprocessingInMinimap === true; // Default to false
        this.showSpeedControl = options.showSpeedControl === true; // Default to false
        
        // Speed control (for trace auto-play)
        this.speedControlContainer = null;
        this.currentSpeed = options.initialSpeed || 1000; // Default 1 second (in ms)
        this.onSpeedChange = options.onSpeedChange || null; // Callback when speed changes
        
        // Listen for global speed changes from other action bars
        if (this.showSpeedControl) {
            this._setupSpeedChangeListener();
        }
        
        // Download metadata
        this.instanceNumber = null;
        this.stepNumber = null;
        
        // View log URL
        this.viewLogUrl = null;
        this.viewLogButtonContainer = null;
        
        // Export SVG (for graph sections)
        this.exportSVGButton = null;
        this.exportSVGButtonContainer = null;
        this.graphContainer = null;
        
        // Minimap
        this.minimap = null;
        this.minimapToggleContainer = null;
        this.codeContainer = null;
    }

    /**
     * Set search service and section ID for search bar
     * @param {Object} searchService - SearchService instance
     * @param {string} sectionId - Section identifier
     */
    setSearchService(searchService, sectionId) {
        this.searchBar.setSearchService(searchService, sectionId);
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
     * Set callback for copy functionality
     * @param {Function} callback - Callback function to call with content
     */
    setOnCopy(callback) {
        this.onCopy = callback;
        // Note: CopyButton doesn't have setOnCopy, it uses setContent instead
    }

    /**
     * Set callback for search functionality
     * @param {Function} callback - Callback function to call with search term
     */
    setOnSearch(callback) {
        this.onSearch = callback;
        this.searchBar.setOnSearch(callback);
    }

    /**
     * Set callback for search clear
     * @param {Function} callback - Callback function to call
     */
    setOnClear(callback) {
        this.onClear = callback;
        this.searchBar.setOnClear(callback);
    }

    /**
     * Set callback for search navigation
     * @param {Function} callback - Callback function to call with direction and index
     */
    setOnNavigate(callback) {
        this.onNavigate = callback;
        this.searchBar.setOnNavigate(callback);
    }

    /**
     * Create action bar HTML structure
     * Horizontal layout for section header:
     * LEFT: search input | search count with nav (if showSearch is true)
     * RIGHT: download button | copy button
     * @param {Object} options - Options for action bar creation
     * @param {boolean} options.showSearch - Whether to show search (default: true)
     * @returns {HTMLElement} Action bar container
     */
    createActionBar(options = {}) {
        const { showSearch = true } = options;
        
        // Create a document fragment to hold all elements
        const fragment = document.createDocumentFragment();
        
        // Store references to elements for show/hide
        this.leftElement = null;
        this.rightElement = null;
        
        if (showSearch) {
            // === LEFT SIDE: Search (input, then counter + nav) ===
            const leftSide = document.createElement('div');
            leftSide.className = 'action-bar-left';
            leftSide.style.display = 'none'; // Hidden by default
            this.leftElement = leftSide;
            
            // Create search input container
            const searchContainer = document.createElement('div');
            searchContainer.className = 'action-bar-search-container';
            
            // Append search bar to search container
            this.searchBar.attachToContainer(searchContainer);
            
            // Create navigation container (prev | counter | next)
            const navContainer = document.createElement('div');
            navContainer.className = 'action-bar-nav-container';
            
            // Create previous button (<)
            const prevBtn = document.createElement('button');
            prevBtn.className = 'action-bar-nav-btn action-bar-nav-prev';
            prevBtn.setAttribute('aria-label', 'Previous match');
            prevBtn.setAttribute('title', 'Previous match');
            prevBtn.innerHTML = ICONS.LT;
            prevBtn.style.display = 'none'; // Hidden until matches found
            
            // Create counter container
            const counterContainer = document.createElement('div');
            counterContainer.className = 'action-bar-counter-container';
            
            // Create next button (>)
            const nextBtn = document.createElement('button');
            nextBtn.className = 'action-bar-nav-btn action-bar-nav-next';
            nextBtn.setAttribute('aria-label', 'Next match');
            nextBtn.setAttribute('title', 'Next match');
            nextBtn.innerHTML = ICONS.GT;
            nextBtn.style.display = 'none'; // Hidden until matches found
            
            // Store references
            this.prevBtn = prevBtn;
            this.nextBtn = nextBtn;
            this.counterContainer = counterContainer;
            
            // Add click handlers for navigation
            prevBtn.addEventListener('click', () => {
                if (this.onNavigate) {
                    this.onNavigate('prev');
                }
            });
            
            nextBtn.addEventListener('click', () => {
                if (this.onNavigate) {
                    this.onNavigate('next');
                }
            });
            
            // Assemble navigation: prev | counter | next
            navContainer.appendChild(prevBtn);
            navContainer.appendChild(counterContainer);
            navContainer.appendChild(nextBtn);
            
            // After search bar is attached, extract the counter
            requestAnimationFrame(() => {
                this.extractCounterToNavContainer();
            });
            
            // Assemble left side: search input | nav container
            leftSide.appendChild(searchContainer);
            leftSide.appendChild(navContainer);
            
            fragment.appendChild(leftSide);
        }
        
        // === RIGHT SIDE: Buttons (export SVG, download, copy, view log) ===
        const rightSide = document.createElement('div');
        rightSide.className = 'action-bar-right';
        rightSide.style.display = 'none'; // Hidden by default
        this.rightElement = rightSide;
        
        // Create export SVG button container (for graph sections)
        if (this.showExportSVG) {
            const exportSVGButtonContainer = document.createElement('div');
            exportSVGButtonContainer.className = 'action-bar-export-svg-container';
            this.exportSVGButtonContainer = exportSVGButtonContainer;
            rightSide.appendChild(exportSVGButtonContainer);
        }
        
        // Create download button container (if enabled)
        if (this.showDownload) {
            const downloadButtonContainer = document.createElement('div');
            downloadButtonContainer.className = 'action-bar-download-container';
            this.downloadButtonContainer = downloadButtonContainer;
            rightSide.appendChild(downloadButtonContainer);
        }
        
        // Create copy button container (if enabled)
        if (this.showCopy) {
            const copyButtonContainer = document.createElement('div');
            copyButtonContainer.className = 'action-bar-copy-container';
            this.copyButtonContainer = copyButtonContainer;
            rightSide.appendChild(copyButtonContainer);
        }
        
        // Create speed control container (for trace auto-play)
        if (this.showSpeedControl) {
            const speedControlContainer = document.createElement('div');
            speedControlContainer.className = 'action-bar-speed-container';
            this.speedControlContainer = speedControlContainer;
            rightSide.appendChild(speedControlContainer);
            
            // Create speed control UI
            this._createSpeedControl();
        }
        
        // Create view log button container (only if showViewLog is true)
        if (this.showViewLog) {
            const viewLogButtonContainer = document.createElement('div');
            viewLogButtonContainer.className = 'action-bar-viewlog-container';
            this.viewLogButtonContainer = viewLogButtonContainer;
            rightSide.appendChild(viewLogButtonContainer);
        }
        
        // Create minimap toggle button container (only if showMinimap is true)
        if (this.showMinimap) {
            const minimapToggleContainer = document.createElement('div');
            minimapToggleContainer.className = 'action-bar-minimap-container';
            this.minimapToggleContainer = minimapToggleContainer;
            rightSide.appendChild(minimapToggleContainer);
            
            // Create minimap instance
            this._createMinimap();
        }
        
        fragment.appendChild(rightSide);
        
        // For backwards compatibility, set this.element to rightElement
        // (used by code that expects a single element reference)
        this.element = rightSide;
        
        return fragment;
    }


    /**
     * Extract counter from search bar and move it to the navigation container
     */
    extractCounterToNavContainer() {
        if (!this.searchBar.element || !this.counterContainer) {
            return;
        }
        
        // Find the navigation element which contains the counter
        const navigation = this.searchBar.element.querySelector('.search-navigation');
        if (navigation && this.counterContainer) {
            // Find the counter element
            const counter = navigation.querySelector('.search-counter');
            if (counter) {
                // Move counter to our counter container
                this.counterContainer.appendChild(counter);
                
                // Hook into SearchBar's updateNavigationDisplay to sync visibility
                const originalUpdateNavigationDisplay = this.searchBar.updateNavigationDisplay.bind(this.searchBar);
                this.searchBar.updateNavigationDisplay = (matches, currentIndex) => {
                    // Call original method first
                    originalUpdateNavigationDisplay(matches, currentIndex);
                    
                    // Then sync counter and navigation buttons visibility based on matches
                    const hasMatches = matches && matches.length > 0;
                    
                    if (this.searchBar.counter) {
                        // Show counter only when there are matches
                        this.searchBar.counter.style.display = hasMatches ? 'inline-block' : 'none';
                    }
                    
                    // Show/hide navigation buttons based on matches
                    if (this.prevBtn) {
                        this.prevBtn.style.display = hasMatches ? 'inline-flex' : 'none';
                    }
                    if (this.nextBtn) {
                        this.nextBtn.style.display = hasMatches ? 'inline-flex' : 'none';
                    }
                };
                
                // Initialize counter and buttons as hidden (no matches yet)
                if (this.searchBar.counter) {
                    this.searchBar.counter.style.display = 'none';
                }
                if (this.prevBtn) {
                    this.prevBtn.style.display = 'none';
                }
                if (this.nextBtn) {
                    this.nextBtn.style.display = 'none';
                }
            }
        }
    }

    /**
     * Set copy content and create button
     * @param {string} content - Content to copy
     */
    setCopyContent(content) {
        if (!content || !this.copyButtonContainer) {
            return;
        }
        
        // Clear existing copy button
        this.copyButtonContainer.innerHTML = '';
        
        // Create copy button with icon only (no text label)
        // Pass options to CopyButton to disable text
        const copyButtonInstance = new CopyButton(this.domRegistry, { showText: false });
        const button = copyButtonInstance.createButton(content, '');
        this.copyButtonContainer.appendChild(button);
        
        // Update the copyButton reference
        this.copyButton = copyButtonInstance;
        
        // Set up copy button callback for button click
        if (this.copyButton.element) {
            this.copyButton.element.addEventListener('click', () => {
                if (this.onCopy) {
                    this.onCopy(this.copyButton.content);
                }
            });
        }
    }

    /**
     * Set download metadata for filename generation
     * @param {number} instanceNumber - CPEE instance/process number
     * @param {number} stepNumber - Step number
     */
    setDownloadMetadata(instanceNumber, stepNumber) {
        this.instanceNumber = instanceNumber;
        this.stepNumber = stepNumber;
    }

    /**
     * Set download content and create button
     * @param {string} content - Content to download
     */
    setDownloadContent(content) {
        if (!content || !this.downloadButtonContainer || !this.instanceNumber || !this.stepNumber || !this.sectionId) {
            return;
        }
        
        // Clear existing download button
        this.downloadButtonContainer.innerHTML = '';
        
        // Generate filename based on metadata
        const filename = DownloadButton.generateFilename(this.instanceNumber, this.stepNumber, this.sectionId);
        
        // Create download button with icon only (no text label)
        const downloadButtonInstance = new DownloadButton(this.domRegistry, { showText: false });
        const button = downloadButtonInstance.createButton(content, filename, '');
        this.downloadButtonContainer.appendChild(button);
        
        // Update the downloadButton reference
        this.downloadButton = downloadButtonInstance;
        
        // Set up download button callback for button click
        if (this.downloadButton.element) {
            this.downloadButton.element.addEventListener('click', () => {
                if (this.onDownload) {
                    this.onDownload(filename, this.downloadButton.content);
                }
            });
        }
    }

    /**
     * Set callback for download functionality
     * @param {Function} callback - Callback function to call with filename and content
     */
    setOnDownload(callback) {
        this.onDownload = callback;
    }

    /**
     * Set view log URL and create the view log button
     * Opens the CPEE log page in a new tab when clicked
     * @param {string} url - URL to the CPEE log page
     */
    setViewLogUrl(url) {
        if (!url || !this.viewLogButtonContainer) {
            return;
        }
        
        this.viewLogUrl = url;
        
        // Clear existing button
        this.viewLogButtonContainer.innerHTML = '';
        
        // Create view log button
        const button = document.createElement('button');
        button.className = 'viewlog-btn';
        button.setAttribute('aria-label', 'View log on CPEE');
        button.setAttribute('title', 'View log on CPEE');
        button.innerHTML = ICONS.VIEW_LOG;
        
        // Open URL in new tab on click
        button.addEventListener('click', () => {
            window.open(url, '_blank', 'noopener,noreferrer');
        });
        
        this.viewLogButtonContainer.appendChild(button);
        
        // Make sure container is visible
        this.viewLogButtonContainer.style.display = 'flex';
    }

    /**
     * Attach action bar to a container
     * @param {HTMLElement} container - Container to attach action bar to
     * @param {string} position - 'prepend' to insert at start, 'append' to insert at end (default: 'prepend')
     */
    attachToContainer(container, position = 'prepend') {
        if (!container) {
            console.warn('ActionBar: No container provided for attachment');
            return;
        }

        const fragment = this.createActionBar({ showSearch: this.showSearch });
        
        if (position === 'prepend') {
            // Insert at the beginning of the container
            container.insertBefore(fragment, container.firstChild);
        } else {
            // Append to the end of the container
            container.appendChild(fragment);
        }
    }

    /**
     * Show action bar
     */
    show() {
        if (this.leftElement) {
            this.leftElement.style.display = 'flex';
        }
        if (this.rightElement) {
            this.rightElement.style.display = 'flex';
        }
        this.isVisible = true;
    }

    /**
     * Hide action bar
     */
    hide() {
        if (this.leftElement) {
            this.leftElement.style.display = 'none';
        }
        if (this.rightElement) {
            this.rightElement.style.display = 'none';
        }
        this.isVisible = false;
    }

    /**
     * Focus search input
     */
    focusSearch() {
        this.searchBar.focus();
    }

    /**
     * Update search results UI from SearchService state
     * @param {Array} matches - Array of match objects (optional, reads from SearchService if not provided)
     */
    updateSearchResults(matches = null) {
        // If SearchService is available, always sync from it
        if (this.searchBar.searchService && this.searchBar.sectionId) {
            this.searchBar.updateUIFromService();
        } else if (matches !== null) {
            // Fallback: update with provided matches if SearchService not available
            this.searchBar.updateSearchResults(matches);
        }
    }

    /**
     * Clear search
     */
    clearSearch() {
        this.searchBar.clearSearch();
    }

    /**
     * Get current search term
     * @returns {string} Current search term
     */
    getSearchTerm() {
        return this.searchBar.getSearchTerm();
    }

    /**
     * Get current match count
     * @returns {number} Number of matches
     */
    getMatchCount() {
        return this.searchBar.getMatchCount();
    }

    /**
     * Get current match index
     * @returns {number} Current match index
     */
    getCurrentMatchIndex() {
        return this.searchBar.getCurrentMatchIndex();
    }

    /**
     * Check if action bar is visible
     * @returns {boolean} True if visible
     */
    isActionBarVisible() {
        return this.isVisible;
    }

    // === Export SVG Methods (for graph sections) ===

    /**
     * Set the graph container for SVG export
     * @param {HTMLElement} container - Graph container element
     */
    setGraphContainer(container) {
        this.graphContainer = container;
        this.updateExportSVGButton();
    }

    /**
     * Update or create the export SVG button with current settings
     */
    updateExportSVGButton() {
        if (!this.showExportSVG || !this.exportSVGButtonContainer || !this.graphContainer) {
            return;
        }
        
        if (!this.instanceNumber || !this.stepNumber || !this.sectionId) {
            return;
        }
        
        // Clear existing button
        this.exportSVGButtonContainer.innerHTML = '';
        
        // Generate filename
        const filename = ExportSVGButton.generateFilename(
            this.instanceNumber,
            this.stepNumber,
            this.sectionId
        );
        
        // Create export button with icon only (no text label)
        const exportButtonInstance = new ExportSVGButton(this.domRegistry, { showText: false });
        const button = exportButtonInstance.createButton(this.graphContainer, filename, '');
        this.exportSVGButtonContainer.appendChild(button);
        
        // Update the exportSVGButton reference
        this.exportSVGButton = exportButtonInstance;
    }

    /**
     * Set metadata for export SVG filename generation (uses same metadata as download)
     * @param {number} instanceNumber - CPEE instance/process number  
     * @param {number} stepNumber - Step number
     */
    setExportMetadata(instanceNumber, stepNumber) {
        this.instanceNumber = instanceNumber;
        this.stepNumber = stepNumber;
        this.updateExportSVGButton();
    }

    // === Element Management Methods ===

    /**
     * Get all action bar elements (left and right)
     * @returns {Array<HTMLElement>} Array of elements
     */
    getAllElements() {
        const elements = [];
        if (this.leftElement) {
            elements.push(this.leftElement);
        }
        if (this.rightElement) {
            elements.push(this.rightElement);
        }
        return elements;
    }

    /**
     * Remove all action bar elements from DOM
     */
    removeFromDOM() {
        if (this.leftElement && this.leftElement.parentNode) {
            this.leftElement.parentNode.removeChild(this.leftElement);
        }
        if (this.rightElement && this.rightElement.parentNode) {
            this.rightElement.parentNode.removeChild(this.rightElement);
        }
    }

    /**
     * Append all action bar elements to a container
     * @param {HTMLElement} container - Container to append to
     */
    appendToContainer(container) {
        if (!container) return;
        
        if (this.leftElement) {
            container.appendChild(this.leftElement);
        }
        if (this.rightElement) {
            container.appendChild(this.rightElement);
        }
    }

    /**
     * Check if action bar elements are attached to a specific container
     * @param {HTMLElement} container - Container to check
     * @returns {boolean} True if attached to the container
     */
    isAttachedTo(container) {
        if (!container) return false;
        
        const rightAttached = this.rightElement && this.rightElement.parentNode === container;
        const leftAttached = !this.leftElement || this.leftElement.parentNode === container;
        
        return rightAttached && leftAttached;
    }

    // === Minimap Methods ===

    /**
     * Create minimap instance and toggle button
     * @private
     */
    _createMinimap() {
        if (!this.showMinimap || !this.minimapToggleContainer) {
            return;
        }
        
        // Create minimap instance
        this.minimap = new CodeMinimap({
            sectionId: this.sectionId,
            contentType: this.minimapContentType,
            showPreprocessing: this.showPreprocessingInMinimap
        });
        
        // Create and attach toggle button
        const toggleButton = this.minimap.createToggleButton();
        this.minimapToggleContainer.appendChild(toggleButton);
    }

    /**
     * Set the code container for minimap to attach to
     * @param {HTMLElement} codeContainer - The scrollable code container ([data-content-type="raw"])
     * @param {HTMLElement} parentContainer - The parent container (content-box) to append minimap to
     */
    setMinimapCodeContainer(codeContainer, parentContainer) {
        if (!this.minimap) {
            return;
        }
        
        this.codeContainer = codeContainer;
        
        if (codeContainer && parentContainer) {
            this.minimap.attach(codeContainer, parentContainer);
        }
    }

    /**
     * Show minimap
     */
    showMinimap() {
        if (this.minimap) {
            this.minimap.show();
        }
    }

    /**
     * Hide minimap
     */
    hideMinimap() {
        if (this.minimap) {
            this.minimap.hide();
        }
    }

    /**
     * Toggle minimap visibility
     */
    toggleMinimap() {
        if (this.minimap) {
            this.minimap.toggle();
        }
    }

    /**
     * Refresh minimap content (call after code content changes)
     */
    refreshMinimap() {
        if (this.minimap) {
            this.minimap.refresh();
        }
    }

    /**
     * Update search markers in minimap
     * @param {Array} matches - Array of match objects with lineNumber property
     */
    updateMinimapSearchMarkers(matches = []) {
        if (this.minimap) {
            this.minimap.updateSearchMarkers(matches);
        }
    }

    /**
     * Get minimap instance
     * @returns {CodeMinimap|null} Minimap instance or null
     */
    getMinimap() {
        return this.minimap;
    }

    /**
     * Check if minimap is visible
     * @returns {boolean} True if minimap is visible
     */
    isMinimapVisible() {
        return this.minimap ? this.minimap.isVisible : false;
    }

    /**
     * Destroy minimap
     */
    destroyMinimap() {
        if (this.minimap) {
            this.minimap.destroy();
            this.minimap = null;
        }
    }

    /**
     * Create speed control dropdown for trace auto-play
     * @private
     */
    _createSpeedControl() {
        if (!this.speedControlContainer) {
            return;
        }

        // Speed options in milliseconds
        const speedOptions = [
            { label: '0.25s', value: 250 },
            { label: '0.5s', value: 500 },
            { label: '1s', value: 1000 },
            { label: '2s', value: 2000 }
        ];

        // Create wrapper for button and dropdown
        const wrapper = document.createElement('div');
        wrapper.className = 'speed-control-wrapper';

        // Create the button with icon and label
        const button = document.createElement('button');
        button.className = 'speed-control-btn';
        button.title = 'Trace autoplay speed';
        button.setAttribute('aria-label', 'Trace autoplay speed');
        button.setAttribute('aria-haspopup', 'listbox');
        button.setAttribute('aria-expanded', 'false');

        // Icon
        const iconSpan = document.createElement('span');
        iconSpan.className = 'speed-control-icon';
        iconSpan.innerHTML = ICONS.SPEED_CONTROL;
        button.appendChild(iconSpan);

        // Label showing current speed
        const labelSpan = document.createElement('span');
        labelSpan.className = 'speed-control-label';
        labelSpan.textContent = '1s';
        button.appendChild(labelSpan);

        wrapper.appendChild(button);

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'speed-control-dropdown';
        dropdown.setAttribute('role', 'listbox');
        dropdown.style.display = 'none';

        speedOptions.forEach(option => {
            const item = document.createElement('div');
            item.className = 'speed-control-option';
            item.setAttribute('role', 'option');
            item.setAttribute('data-value', option.value);
            item.textContent = option.label;
            
            // Mark default as selected
            if (option.value === this.currentSpeed) {
                item.classList.add('selected');
                item.setAttribute('aria-selected', 'true');
            }

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this._selectSpeed(option.value, option.label, dropdown);
                this._hideSpeedDropdown(button, dropdown);
            });

            dropdown.appendChild(item);
        });

        wrapper.appendChild(dropdown);

        // Toggle dropdown on button click
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = dropdown.style.display !== 'none';
            if (isExpanded) {
                this._hideSpeedDropdown(button, dropdown);
            } else {
                this._showSpeedDropdown(button, dropdown);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                this._hideSpeedDropdown(button, dropdown);
            }
        });

        // Store references
        this.speedButton = button;
        this.speedDropdown = dropdown;
        this.speedLabel = labelSpan;

        this.speedControlContainer.appendChild(wrapper);

        // Initialize with current speed (update label and selected state)
        this._updateSpeedDisplay(this.currentSpeed);
    }

    /**
     * Set up listener for global speed changes
     * @private
     */
    _setupSpeedChangeListener() {
        this._speedChangeHandler = ({ speedMs }) => {
            this._updateSpeedDisplay(speedMs);
        };
        eventBus.on('trace:playback:speedChanged', this._speedChangeHandler);
    }

    /**
     * Update speed control display without triggering callback
     * @private
     */
    _updateSpeedDisplay(speedMs) {
        const speedLabels = {
            250: '0.25s',
            500: '0.5s',
            1000: '1s',
            2000: '2s'
        };

        const label = speedLabels[speedMs] || '1s';
        this.currentSpeed = speedMs;

        // Update label
        if (this.speedLabel) {
            this.speedLabel.textContent = label;
        }

        // Update selected state in dropdown
        if (this.speedDropdown) {
            const options = this.speedDropdown.querySelectorAll('.speed-control-option');
            options.forEach(opt => {
                if (parseInt(opt.getAttribute('data-value')) === speedMs) {
                    opt.classList.add('selected');
                    opt.setAttribute('aria-selected', 'true');
                } else {
                    opt.classList.remove('selected');
                    opt.setAttribute('aria-selected', 'false');
                }
            });
        }
    }

    /**
     * Show speed dropdown
     * @private
     */
    _showSpeedDropdown(button, dropdown) {
        dropdown.style.display = 'block';
        button.setAttribute('aria-expanded', 'true');
        button.classList.add('active');
    }

    /**
     * Hide speed dropdown
     * @private
     */
    _hideSpeedDropdown(button, dropdown) {
        dropdown.style.display = 'none';
        button.setAttribute('aria-expanded', 'false');
        button.classList.remove('active');
    }

    /**
     * Select a speed option
     * @private
     */
    _selectSpeed(value, label, dropdown) {
        this.currentSpeed = value;
        
        // Update label
        if (this.speedLabel) {
            this.speedLabel.textContent = label;
        }

        // Update selected state in dropdown
        const options = dropdown.querySelectorAll('.speed-control-option');
        options.forEach(opt => {
            if (parseInt(opt.getAttribute('data-value')) === value) {
                opt.classList.add('selected');
                opt.setAttribute('aria-selected', 'true');
            } else {
                opt.classList.remove('selected');
                opt.setAttribute('aria-selected', 'false');
            }
        });

        // Trigger callback
        if (this.onSpeedChange) {
            this.onSpeedChange(value);
        }
    }

    /**
     * Set speed control callback
     * @param {Function} callback - Function to call when speed changes
     */
    setSpeedChangeCallback(callback) {
        this.onSpeedChange = callback;
    }

    /**
     * Get current playback speed in milliseconds
     * @returns {number} Current speed in milliseconds
     */
    getCurrentSpeed() {
        return this.currentSpeed;
    }

    /**
     * Set current playback speed
     * @param {number} speedMs - Speed in milliseconds
     */
    setCurrentSpeed(speedMs) {
        const speedLabels = {
            250: '0.25s',
            500: '0.5s',
            1000: '1s',
            2000: '2s'
        };
        
        if (speedLabels[speedMs]) {
            this._selectSpeed(speedMs, speedLabels[speedMs], this.speedDropdown);
        }
    }
}
