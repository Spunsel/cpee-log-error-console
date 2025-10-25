/**
 * ViewModeManager
 * Single source of truth for view mode state management
 * Responsibilities:
 * - Store view mode state for all instances
 * - Handle persistence to localStorage
 * - Coordinate view mode changes across components
 * - Manage instance-specific view mode storage
 */

export class ViewModeManager {
    constructor(instanceService = null) {
        this.instanceService = instanceService;
        this.storageKey = 'cpee-debug-console-view-modes';
        
        // Internal view mode storage - single source of truth
        this.viewModes = new Map(); // Map<instanceUuid, Map<sectionId, mode>>
        
        // Default view modes for new instances
        this.defaultModes = {
            'input-cpee': 'visual',
            'input-intermediate': 'visual',
            'output-intermediate': 'visual',
            'output-cpee': 'visual'
        };
        
        // Callback for mode changes
        this.onModeChange = null;
        
        // Load existing data from localStorage
        this.loadFromStorage();
    }

    /**
     * Get current instance UUID
     * @returns {string|null} Current instance UUID or null
     */
    getCurrentInstanceUuid() {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            return currentInstance ? currentInstance.uuid : null;
        }
        return null;
    }

    /**
     * Get view mode for a section from current instance
     * @param {string} sectionId - Section identifier
     * @returns {string} View mode ('visual' or 'raw')
     */
    getMode(sectionId) {
        const currentUuid = this.getCurrentInstanceUuid();
        if (currentUuid) {
            const instanceModes = this.viewModes.get(currentUuid);
            if (instanceModes && instanceModes.has(sectionId)) {
                return instanceModes.get(sectionId);
            }
        }
        return this.defaultModes[sectionId] || 'visual';
    }

    /**
     * Set view mode for a section in current instance
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode ('visual' or 'raw')
     * @returns {boolean} True if mode was set successfully
     */
    setMode(sectionId, mode) {
        if (!(mode === 'visual' || mode === 'raw')) {
            return false;
        }
        
        const currentUuid = this.getCurrentInstanceUuid();
        if (!currentUuid) {
            return false;
        }
        
        // Ensure instance modes exist
        if (!this.viewModes.has(currentUuid)) {
            this.viewModes.set(currentUuid, new Map());
        }
        
        const instanceModes = this.viewModes.get(currentUuid);
        instanceModes.set(sectionId, mode);
        
        // Save to localStorage
        this.saveToStorage();
        
        // Trigger callback
        if (this.onModeChange) {
            this.onModeChange(sectionId, mode, currentUuid);
        }
        
        return true;
    }

    /**
     * Get all view modes for current instance
     * @returns {Object} Object mapping section IDs to view modes
     */
    getAllModes() {
        const currentUuid = this.getCurrentInstanceUuid();
        if (currentUuid) {
            const instanceModes = this.viewModes.get(currentUuid);
            if (instanceModes) {
                const modes = {};
                for (const [sectionId, mode] of instanceModes) {
                    modes[sectionId] = mode;
                }
                return modes;
            }
        }
        return { ...this.defaultModes };
    }

    /**
     * Set multiple view modes at once for current instance
     * @param {Object} modes - Object mapping section IDs to view modes
     */
    setAllModes(modes) {
        const currentUuid = this.getCurrentInstanceUuid();
        if (!currentUuid) {
            return;
        }
        
        // Ensure instance modes exist
        if (!this.viewModes.has(currentUuid)) {
            this.viewModes.set(currentUuid, new Map());
        }
        
        const instanceModes = this.viewModes.get(currentUuid);
        Object.entries(modes).forEach(([sectionId, mode]) => {
            if (mode === 'visual' || mode === 'raw') {
                instanceModes.set(sectionId, mode);
            }
        });
        
        this.saveToStorage();
    }

    /**
     * Reset all sections to visual mode
     */
    resetToVisual() {
        const currentUuid = this.getCurrentInstanceUuid();
        if (!currentUuid) {
            return;
        }
        
        // Ensure instance modes exist
        if (!this.viewModes.has(currentUuid)) {
            this.viewModes.set(currentUuid, new Map());
        }
        
        const instanceModes = this.viewModes.get(currentUuid);
        Object.keys(this.defaultModes).forEach(sectionId => {
            instanceModes.set(sectionId, 'visual');
        });
        
        this.saveToStorage();
        
        // Trigger callback for each section
        if (this.onModeChange) {
            Object.keys(this.defaultModes).forEach(sectionId => {
                this.onModeChange(sectionId, 'visual', currentUuid);
            });
        }
    }

    /**
     * Load view modes from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const allModes = JSON.parse(stored);
                this.viewModes.clear();
                
                Object.entries(allModes).forEach(([uuid, modes]) => {
                    const instanceModes = new Map();
                    Object.entries(modes).forEach(([sectionId, mode]) => {
                        instanceModes.set(sectionId, mode);
                    });
                    this.viewModes.set(uuid, instanceModes);
                });
            }
        } catch (error) {
            console.warn('Failed to load view modes from storage:', error);
        }
    }

    /**
     * Save view modes to localStorage
     */
    saveToStorage() {
        try {
            const allModes = {};
            for (const [uuid, instanceModes] of this.viewModes) {
                const modes = {};
                for (const [sectionId, mode] of instanceModes) {
                    modes[sectionId] = mode;
                }
                allModes[uuid] = modes;
            }
            
            localStorage.setItem(this.storageKey, JSON.stringify(allModes));
        } catch (error) {
            console.warn('Failed to save view modes to storage:', error);
        }
    }

    /**
     * Restore view modes from storage for current instance
     * Applies stored modes to the instance
     */
    restoreFromStorage() {
        const currentUuid = this.getCurrentInstanceUuid();
        if (!currentUuid) {
            return false;
        }
        
        const instanceModes = this.viewModes.get(currentUuid);
        if (instanceModes && instanceModes.size > 0) {
            // Trigger callback to update UI
            if (this.onModeChange) {
                for (const [sectionId, mode] of instanceModes) {
                    this.onModeChange(sectionId, mode, currentUuid);
                }
            }
            return true;
        }
        
        return false;
    }

    /**
     * Clear saved view modes for a specific instance
     * @param {string} uuid - Instance UUID
     */
    clearStorageForInstance(uuid) {
        this.viewModes.delete(uuid);
        this.saveToStorage();
    }

    /**
     * Clear all saved view modes from storage
     */
    clearAllStorage() {
        this.viewModes.clear();
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Failed to clear all view modes from storage:', error);
        }
    }

    /**
     * Get statistics about current view mode usage
     * @returns {Object} Stats with visual and raw counts
     */
    getStats() {
        const currentUuid = this.getCurrentInstanceUuid();
        if (currentUuid) {
            const instanceModes = this.viewModes.get(currentUuid);
            if (instanceModes) {
                const stats = { visual: 0, raw: 0 };
                for (const mode of instanceModes.values()) {
                    stats[mode]++;
                }
                return stats;
            }
        }
        
        // Calculate stats from default modes
        const stats = { visual: 0, raw: 0 };
        Object.values(this.defaultModes).forEach(mode => {
            stats[mode]++;
        });
        return stats;
    }

    /**
     * Check if any section is in raw mode
     * @returns {boolean} True if at least one section is in raw mode
     */
    hasRawModes() {
        const currentUuid = this.getCurrentInstanceUuid();
        if (currentUuid) {
            const instanceModes = this.viewModes.get(currentUuid);
            if (instanceModes) {
                for (const mode of instanceModes.values()) {
                    if (mode === 'raw') {
                        return true;
                    }
                }
            }
        }
        return Object.values(this.defaultModes).some(mode => mode === 'raw');
    }

    /**
     * Sync view modes from ViewModeToggle component to current instance
     * @param {Object} modes - Modes from ViewModeToggle.getAllModes()
     */
    syncFromToggle(modes) {
        this.setAllModes(modes);
    }

    /**
     * Sync view modes from current instance to ViewModeToggle component
     * @returns {Object} Current view modes for syncing to toggle
     */
    syncToToggle() {
        return this.getAllModes();
    }

    /**
     * Handle instance switch - restore view modes for new instance
     * @param {string} newUuid - UUID of newly selected instance
     */
    onInstanceSwitch(newUuid) {
        // Try to restore from storage
        const restored = this.restoreFromStorage();
        
        // If nothing in storage, modes will be default
        // Trigger callback to update UI
        if (this.onModeChange) {
            const modes = this.getAllModes();
            Object.entries(modes).forEach(([sectionId, mode]) => {
                this.onModeChange(sectionId, mode, newUuid);
            });
        }
        
        return restored;
    }

    /**
     * Export view modes for all instances (for backup/debugging)
     * @returns {Object} All saved view modes
     */
    exportAllModes() {
        const allModes = {};
        for (const [uuid, instanceModes] of this.viewModes) {
            const modes = {};
            for (const [sectionId, mode] of instanceModes) {
                modes[sectionId] = mode;
            }
            allModes[uuid] = modes;
        }
        return allModes;
    }

    /**
     * Import view modes (for restore from backup)
     * @param {Object} modes - All view modes to import
     */
    importAllModes(modes) {
        try {
            this.viewModes.clear();
            
            Object.entries(modes).forEach(([uuid, instanceModes]) => {
                const modesMap = new Map();
                Object.entries(instanceModes).forEach(([sectionId, mode]) => {
                    modesMap.set(sectionId, mode);
                });
                this.viewModes.set(uuid, modesMap);
            });
            
            this.saveToStorage();
            return true;
        } catch (error) {
            console.warn('Failed to import view modes:', error);
            return false;
        }
    }
}

