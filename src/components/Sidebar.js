/**
 * Sidebar Component
 * Manages the instance tabs in the sidebar
 */

import { DOMUtils } from '../utils/DOMUtils.js';

export class Sidebar {
    constructor(instanceService) {
        this.instanceService = instanceService;
        this.onInstanceSelect = null;
    }

    /**
     * Set callback for when an instance is selected
     * @param {Function} callback - Callback function
     */
    setOnInstanceSelect(callback) {
        this.onInstanceSelect = callback;
    }

    /**
     * Add instance tab to sidebar
     * @param {string} uuid - Instance UUID
     */
    addInstanceTab(uuid) {
        const instanceTabs = DOMUtils.getElementById('instance-tabs');
        if (!instanceTabs) return;

        // Check if tab already exists
        const existingTab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (existingTab) {
            this.setActiveTab(uuid);
            return;
        }

        // Get instance data to extract process number
        const instanceData = this.instanceService.getInstance(uuid);
        const displayText = instanceData && instanceData.processNumber 
            ? `${uuid} (${instanceData.processNumber})` 
            : uuid;

        // Create new tab (not active by default)
        const tabElement = document.createElement('div');
        tabElement.className = 'instance-tab';
        tabElement.dataset.uuid = uuid;
        tabElement.textContent = displayText;
        
        // Add click handler
        tabElement.addEventListener('click', () => {
            this.setActiveTab(uuid);
            if (this.onInstanceSelect) {
                this.onInstanceSelect(uuid);
            }
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
        const instanceTabs = DOMUtils.getElementById('instance-tabs');
        if (!instanceTabs) return;

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
        const instanceTabs = DOMUtils.getElementById('instance-tabs');
        if (!instanceTabs) return;

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
        const instanceTabs = DOMUtils.getElementById('instance-tabs');
        if (!instanceTabs) return null;

        const activeTab = instanceTabs.querySelector('.instance-tab.active');
        return activeTab ? activeTab.dataset.uuid : null;
    }

    /**
     * Clear all tabs
     */
    clearAllTabs() {
        const instanceTabs = DOMUtils.getElementById('instance-tabs');
        if (!instanceTabs) return;

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
        const instanceTabs = DOMUtils.getElementById('instance-tabs');
        if (!instanceTabs) return;

        const tab = instanceTabs.querySelector(`[data-uuid="${uuid}"]`);
        if (tab) {
            tab.textContent = displayName;
        }
    }
}
