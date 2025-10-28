/**
 * Sidebar Component
 * Manages the instance tabs in the sidebar
 */

import { ICON_SIDEBAR_COLLAPSE, ICON_SIDEBAR_EXPAND } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager } from '../../core/StateManager.js';

export class Sidebar {
    constructor(instanceService, domRegistry = null, eventBus = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        
        // Initialize state from StateManager
        this.isCollapsed = stateManager.getState('ui.sidebarCollapsed') || false;
        
        // Subscribe to state changes
        stateManager.subscribe('ui.sidebarCollapsed', (newValue) => {
            this.isCollapsed = newValue;
            // Apply visual changes based on state
            if (newValue) {
                this.collapse();
            } else {
                this.expand();
            }
        });
        
        // Debug: Log the initialized state
        console.log('Sidebar initialized - isCollapsed:', this.isCollapsed);
    }


    /**
     * Get DOM element by key with fallback to direct ID access
     * Delegates to DOMRegistry for centralized DOM management
     * @param {string} key - Registry key or element ID
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(key) {
        if (this.domRegistry) {
            return this.domRegistry.getElementSafe(key);
        }
        // Fallback to direct DOM access
        return document.getElementById(key);
    }


    /**
     * Add instance tab to sidebar
     * @param {string} uuid - Instance UUID
     */
    addInstanceTab(uuid) {
        const instanceTabs = this.getElement('instanceTabs');
        if (!instanceTabs) {
            return;
        }

        // Check if tab already exists
        const existingTab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (existingTab) {
            this.setActiveTab(uuid);
            return;
        }

        // Get instance data to extract process number
        const instanceData = this.instanceService.getInstance(uuid);
        const displayText = instanceData 
            ? instanceData.getDisplayName()
            : uuid;
        
        // Extract process number for collapsed state
        const processNumber = instanceData && instanceData.processNumber 
            ? instanceData.processNumber.toString()
            : '';

        // Create new tab (not active by default)
        const tabElement = document.createElement('div');
        tabElement.className = 'instance-tab';
        tabElement.dataset.uuid = uuid;
        tabElement.dataset.processNumber = processNumber;
        
        // Set initial text based on sidebar state
        if (this.isCollapsed) {
            tabElement.textContent = processNumber;
        } else {
            tabElement.textContent = displayText;
        }
        
        // Add click handler
        tabElement.addEventListener('click', () => {
            this.setActiveTab(uuid);
            this.eventBus.emit('sidebar:instanceSelected', { uuid });
        });

        instanceTabs.appendChild(tabElement);
        
        // Remove "no instances" message if it exists
        const noInstancesMsg = instanceTabs.querySelector('.no-instances');
        if (noInstancesMsg) {
            noInstancesMsg.remove();
        }
    }

    /**
     * Set active tab
     * @param {string} uuid - UUID of tab to activate
     */
    setActiveTab(uuid) {
        const instanceTabs = this.getElement('instanceTabs');
        if (!instanceTabs) {
            return;
        }

        // Update tab styles
        instanceTabs.querySelectorAll('.instance-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.uuid === uuid);
        });

        // Update instance service
        this.instanceService.setCurrentInstance(uuid);
    }

    /**
     * Remove instance tab
     * @param {string} uuid - Instance UUID
     */
    removeInstanceTab(uuid) {
        const instanceTabs = this.getElement('instanceTabs');
        if (!instanceTabs) {
            return;
        }

        const tab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (tab) {
            tab.remove();
        }

        // Show "no instances" message if no tabs left
        const remainingTabs = instanceTabs.querySelectorAll('.instance-tab');
        if (remainingTabs.length === 0) {
            const noInstancesMsg = document.createElement('div');
            noInstancesMsg.className = 'no-instances';
            noInstancesMsg.textContent = 'No instances loaded yet';
            instanceTabs.appendChild(noInstancesMsg);
        }
    }

    /**
     * Get active tab UUID
     * @returns {string|null} Active UUID or null
     */
    getActiveTab() {
        const instanceTabs = this.getElement('instanceTabs');
        if (!instanceTabs) {
            return null;
        }

        const activeTab = instanceTabs.querySelector('.instance-tab.active');
        return activeTab ? activeTab.dataset.uuid : null;
    }

    /**
     * Clear all tabs
     */
    clearAllTabs() {
        const instanceTabs = this.getElement('instanceTabs');
        if (!instanceTabs) {
            return;
        }

        // Remove all tabs
        instanceTabs.querySelectorAll('.instance-tab').forEach(tab => tab.remove());

        // Show "no instances" message
        const noInstancesMsg = document.createElement('div');
        noInstancesMsg.className = 'no-instances';
        noInstancesMsg.textContent = 'No instances loaded yet';
        instanceTabs.appendChild(noInstancesMsg);
    }

    /**
     * Update tab display name
     * @param {string} uuid - Instance UUID
     * @param {string} displayName - Display name
     */
    updateTabDisplayName(uuid, displayName) {
        const instanceTabs = this.getElement('instanceTabs');
        if (!instanceTabs) {
            return;
        }

        const tab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (tab) {
            // Update text based on sidebar state
            if (this.isCollapsed) {
                const processNumber = tab.dataset.processNumber || '';
                tab.textContent = processNumber;
            } else {
                tab.textContent = displayName;
            }
        }
    }

    /**
     * Initialize sidebar toggle functionality
     * Attaches event listener to toggle button
     */
    initializeToggle() {
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebarEl = document.querySelector('.sidebar');
        
        if (!toggleBtn || !sidebarEl) {
            return;
        }

        this.toggleButton = toggleBtn;
        this.sidebarElement = sidebarEl;

        // Get current state from classes
        const isCurrentlyCollapsed = this.sidebarElement.classList.contains('sidebar-collapsed');
        const isCurrentlyExpanded = this.sidebarElement.classList.contains('sidebar-expanded');
        
        console.log('initializeToggle - this.isCollapsed:', this.isCollapsed, 'isCurrentlyCollapsed:', isCurrentlyCollapsed, 'isCurrentlyExpanded:', isCurrentlyExpanded);
        
        // Only apply state if it needs to be changed
        if (this.isCollapsed && !isCurrentlyCollapsed) {
            // Disable transitions during initial state application to prevent animation on page load
            const mainContainer = this.sidebarElement.parentElement;
            const contentElement = document.querySelector('.content');
            
            // Temporarily disable all transitions
            this.sidebarElement.style.transition = 'none';
            if (mainContainer) {
                mainContainer.style.transition = 'none';
            }
            if (contentElement) {
                contentElement.style.transition = 'none';
            }
            
            // Apply collapsed state
            this.sidebarElement.classList.remove('sidebar-expanded');
            this.sidebarElement.classList.add('sidebar-collapsed');
            
            // Re-enable transitions after DOM update
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.sidebarElement.style.transition = '';
                    if (mainContainer) {
                        mainContainer.style.transition = '';
                    }
                    if (contentElement) {
                        contentElement.style.transition = '';
                    }
                }, 0);
            });
        } else if (!this.isCollapsed && !isCurrentlyExpanded) {
            // Apply expanded state only if not already expanded
            this.sidebarElement.classList.remove('sidebar-collapsed');
            this.sidebarElement.classList.add('sidebar-expanded');
        }

        // Set initial icon based on current state
        this.updateToggleButton();
        this.updateTabTexts(this.isCollapsed);

        // Attach click listener
        toggleBtn.addEventListener('click', () => {
            this.toggle();
        });

        // Attach keyboard listener for accessibility
        toggleBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Toggle sidebar collapsed/expanded state
     */
    toggle() {
        const newState = !this.isCollapsed;
        stateManager.setState('ui.sidebarCollapsed', newState);
    }

    /**
     * Save sidebar state to localStorage (deprecated - now handled by StateManager)
     */
    saveState() {
        // State is now managed by StateManager, this method is kept for backward compatibility
        console.warn('Sidebar.saveState() is deprecated - state is now managed by StateManager');
    }

    /**
     * Collapse sidebar to minimal width
     */
    collapse() {
        if (!this.sidebarElement) {
            // Get sidebar element if not already set
            this.sidebarElement = document.querySelector('.sidebar');
            if (!this.sidebarElement) {
                return;
            }
        }

        this.sidebarElement.classList.remove('sidebar-expanded');
        this.sidebarElement.classList.add('sidebar-collapsed');
        
        this.updateToggleButton();
        this.updateTabTexts(true); // collapsed = true
    }

    /**
     * Expand sidebar to full width
     */
    expand() {
        if (!this.sidebarElement) {
            // Get sidebar element if not already set
            this.sidebarElement = document.querySelector('.sidebar');
            if (!this.sidebarElement) {
                return;
            }
        }

        this.sidebarElement.classList.remove('sidebar-collapsed');
        this.sidebarElement.classList.add('sidebar-expanded');
        
        this.updateToggleButton();
        this.updateTabTexts(false); // collapsed = false
    }

    /**
     * Update toggle button icon and ARIA attributes
     */
    updateToggleButton() {
        if (!this.toggleButton) {
            return;
        }

        const iconSpan = this.toggleButton.querySelector('.sidebar-toggle-icon');
        if (!iconSpan) {
            return;
        }

        if (this.isCollapsed) {
            // Show expand icon
            iconSpan.innerHTML = ICON_SIDEBAR_EXPAND;
            this.toggleButton.setAttribute('aria-label', 'Expand sidebar');
            this.toggleButton.setAttribute('aria-expanded', 'false');
            this.toggleButton.setAttribute('data-sidebar-state', 'collapsed');
            this.toggleButton.setAttribute('title', 'Click to expand sidebar');
        } else {
            // Show collapse icon
            iconSpan.innerHTML = ICON_SIDEBAR_COLLAPSE;
            this.toggleButton.setAttribute('aria-label', 'Collapse sidebar');
            this.toggleButton.setAttribute('aria-expanded', 'true');
            this.toggleButton.setAttribute('data-sidebar-state', 'expanded');
            this.toggleButton.setAttribute('title', 'Click to collapse sidebar');
        }
    }

    /**
     * Update tab texts based on sidebar collapsed state
     * @param {boolean} isCollapsed - Whether the sidebar is collapsed
     */
    updateTabTexts(isCollapsed) {
        const instanceTabs = this.getElement('instanceTabs');
        if (!instanceTabs) {
            return;
        }

        const tabs = instanceTabs.querySelectorAll('.instance-tab');
        tabs.forEach(tab => {
            if (isCollapsed) {
                // Show only process number
                const processNumber = tab.dataset.processNumber || '';
                tab.textContent = processNumber;
            } else {
                // Show full display name
                const uuid = tab.dataset.uuid;
                const instanceData = this.instanceService.getInstance(uuid);
                const displayText = instanceData 
                    ? instanceData.getDisplayName()
                    : uuid;
                tab.textContent = displayText;
            }
        });
    }
}
