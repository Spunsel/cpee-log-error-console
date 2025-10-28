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
        
        console.log('Sidebar initialized - isCollapsed:', this.isCollapsed);
    }

    /**
     * Apply state change without CSS transitions
     * @param {Function} stateChange - Function that applies the state change
     */
    applyStateWithoutTransition(stateChange) {
        const elements = [
            this.sidebarElement,
            this.sidebarElement?.parentElement,
            document.querySelector('.content')
        ].filter(Boolean);

        // Disable transitions
        elements.forEach(el => {
            el.style.transition = 'none';
        });

        // Apply state change
        stateChange();

        // Re-enable transitions
        requestAnimationFrame(() => {
            setTimeout(() => {
                elements.forEach(el => {
                    el.style.transition = '';
                });
            }, 0);
        });
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
        return document.getElementById(key);
    }

    /**
     * Get instance tabs element
     * @returns {HTMLElement|null} Instance tabs container or null
     */
    getInstanceTabs() {
        return this.getElement('instanceTabs');
    }

    /**
     * Update single tab text based on state
     * @param {HTMLElement} tab - Tab element
     */
    updateTabText(tab) {
        if (this.isCollapsed) {
            const processNumber = tab.dataset.processNumber || '';
            tab.textContent = processNumber;
        } else {
            const uuid = tab.dataset.uuid;
            const instanceData = this.instanceService.getInstance(uuid);
            const displayText = instanceData ? instanceData.getDisplayName() : uuid;
            tab.textContent = displayText;
        }
    }

    /**
     * Create or get no instances message
     * @returns {HTMLElement} No instances message element
     */
    createNoInstancesMessage() {
        const noInstancesMsg = document.createElement('div');
        noInstancesMsg.className = 'no-instances';
        noInstancesMsg.textContent = 'No instances loaded yet';
        return noInstancesMsg;
    }

    /**
     * Show no instances message if needed
     * @param {HTMLElement} container - Container element
     */
    showNoInstancesIfNeeded(container) {
        const tabs = container.querySelectorAll('.instance-tab');
        if (tabs.length === 0) {
            const noInstancesMsg = this.createNoInstancesMessage();
            container.appendChild(noInstancesMsg);
        }
    }


    /**
     * Add instance tab to sidebar
     * @param {string} uuid - Instance UUID
     */
    addInstanceTab(uuid) {
        const instanceTabs = this.getInstanceTabs();
        if (!instanceTabs) {
            return;
        }

        // Check if tab already exists
        const existingTab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (existingTab) {
            this.setActiveTab(uuid);
            return;
        }

        // Get instance data
        const instanceData = this.instanceService.getInstance(uuid);
        const processNumber = instanceData?.processNumber?.toString() || '';

        // Create new tab
        const tabElement = document.createElement('div');
        tabElement.className = 'instance-tab';
        tabElement.dataset.uuid = uuid;
        tabElement.dataset.processNumber = processNumber;
        
        // Set initial text
        this.updateTabText(tabElement);
        
        // Add click handler
        tabElement.addEventListener('click', () => {
            this.setActiveTab(uuid);
            this.eventBus.emit('sidebar:instanceSelected', { uuid });
        });

        instanceTabs.appendChild(tabElement);
        
        // Remove no instances message if exists
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
        const instanceTabs = this.getInstanceTabs();
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

    removeInstanceTab(uuid) {
        const instanceTabs = this.getInstanceTabs();
        if (!instanceTabs) {
            return;
        }

        const tab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (tab) {
            tab.remove();
        }

        this.showNoInstancesIfNeeded(instanceTabs);
    }

    getActiveTab() {
        const instanceTabs = this.getInstanceTabs();
        if (!instanceTabs) {
            return null;
        }

        const activeTab = instanceTabs.querySelector('.instance-tab.active');
        return activeTab ? activeTab.dataset.uuid : null;
    }

    clearAllTabs() {
        const instanceTabs = this.getInstanceTabs();
        if (!instanceTabs) {
            return;
        }

        instanceTabs.querySelectorAll('.instance-tab').forEach(tab => tab.remove());
        this.showNoInstancesIfNeeded(instanceTabs);
    }

    updateTabDisplayName(uuid) {
        const instanceTabs = this.getInstanceTabs();
        if (!instanceTabs) {
            return;
        }

        const tab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (tab) {
            this.updateTabText(tab);
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

        const isCurrentlyCollapsed = this.sidebarElement.classList.contains('sidebar-collapsed');
        
        // Only apply state if it needs to be changed
        if (this.isCollapsed && !isCurrentlyCollapsed) {
            this.applyStateWithoutTransition(() => {
                this.sidebarElement.classList.add('sidebar-collapsed');
                this.sidebarElement.classList.remove('sidebar-expanded');
            });
        } else if (!this.isCollapsed && !this.sidebarElement.classList.contains('sidebar-expanded')) {
            this.sidebarElement.classList.remove('sidebar-collapsed');
            this.sidebarElement.classList.add('sidebar-expanded');
        }

        // Set initial icon based on current state
        this.updateToggleButton();
        this.updateTabTexts();

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
        this.updateTabTexts();
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
        this.updateTabTexts();
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
    updateTabTexts() {
        const instanceTabs = this.getInstanceTabs();
        if (!instanceTabs) {
            return;
        }

        const tabs = instanceTabs.querySelectorAll('.instance-tab');
        tabs.forEach(tab => this.updateTabText(tab));
    }
}
