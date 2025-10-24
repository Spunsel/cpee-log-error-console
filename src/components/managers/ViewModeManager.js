/**
 * ViewModeManager
 * Manages view mode state synchronization and persistence
 * Coordinates between ViewModeToggle component, CPEEInstance, and localStorage
 */

export class ViewModeManager {
    constructor(instanceService = null) {
        this.instanceService = instanceService;
        this.storageKey = 'cpee-debug-console-view-modes';
        
        // Global default view modes (fallback when no instance is active)
        this.globalDefaults = {
            'input-cpee': 'visual',
            'input-intermediate': 'visual',
            'user-input': 'visual',
            'output-intermediate': 'visual',
            'output-cpee': 'visual'
        };
        
        // Callback for mode changes
        this.onModeChange = null;
    }

    /**
     * Set callback for view mode changes
     * @param {Function} callback - Callback function (sectionId, mode, uuid) => void
     */
    setOnModeChange(callback) {
        this.onModeChange = callback;
    }

    /**
     * Get view mode for a section from current instance
     * @param {string} sectionId - Section identifier
     * @returns {string} View mode ('visual' or 'raw')
     */
    getMode(sectionId) {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                return currentInstance.getViewMode(sectionId);
            }
        }
        return this.globalDefaults[sectionId] || 'visual';
    }

    /**
     * Set view mode for a section in current instance
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode ('visual' or 'raw')
     * @returns {boolean} True if mode was set successfully
     */
    setMode(sectionId, mode) {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                const success = currentInstance.setViewMode(sectionId, mode);
                if (success) {
                    // Save to localStorage
                    this.saveToStorage(currentInstance.uuid, currentInstance.getAllViewModes());
                    
                    // Trigger callback
                    if (this.onModeChange) {
                        this.onModeChange(sectionId, mode, currentInstance.uuid);
                    }
                }
                return success;
            }
        }
        
        // Update global defaults if no instance
        if (sectionId in this.globalDefaults) {
            this.globalDefaults[sectionId] = mode;
            return true;
        }
        
        return false;
    }

    /**
     * Get all view modes for current instance
     * @returns {Object} Object mapping section IDs to view modes
     */
    getAllModes() {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                return currentInstance.getAllViewModes();
            }
        }
        return { ...this.globalDefaults };
    }

    /**
     * Set multiple view modes at once for current instance
     * @param {Object} modes - Object mapping section IDs to view modes
     */
    setAllModes(modes) {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                currentInstance.setViewModes(modes);
                this.saveToStorage(currentInstance.uuid, currentInstance.getAllViewModes());
            }
        }
    }

    /**
     * Reset all sections to visual mode
     */
    resetToVisual() {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                currentInstance.resetViewModesToVisual();
                this.saveToStorage(currentInstance.uuid, currentInstance.getAllViewModes());
                
                // Trigger callback for each section
                if (this.onModeChange) {
                    Object.keys(currentInstance.viewModes).forEach(sectionId => {
                        this.onModeChange(sectionId, 'visual', currentInstance.uuid);
                    });
                }
            }
        }
    }

    /**
     * Load view modes from localStorage for a specific instance
     * @param {string} uuid - Instance UUID
     * @returns {Object|null} Saved view modes or null if not found
     */
    loadFromStorage(uuid) {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const allModes = JSON.parse(stored);
                return allModes[uuid] || null;
            }
        } catch (error) {
            console.warn('Failed to load view modes from storage:', error);
        }
        return null;
    }

    /**
     * Save view modes to localStorage for a specific instance
     * @param {string} uuid - Instance UUID
     * @param {Object} modes - View modes to save
     */
    saveToStorage(uuid, modes) {
        try {
            let allModes = {};
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                allModes = JSON.parse(stored);
            }
            
            allModes[uuid] = modes;
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
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                const savedModes = this.loadFromStorage(currentInstance.uuid);
                if (savedModes) {
                    currentInstance.setViewModes(savedModes);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Clear saved view modes for a specific instance
     * @param {string} uuid - Instance UUID
     */
    clearStorageForInstance(uuid) {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const allModes = JSON.parse(stored);
                delete allModes[uuid];
                localStorage.setItem(this.storageKey, JSON.stringify(allModes));
            }
        } catch (error) {
            console.warn('Failed to clear view modes from storage:', error);
        }
    }

    /**
     * Clear all saved view modes from storage
     */
    clearAllStorage() {
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
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                return currentInstance.getViewModeStats();
            }
        }
        
        // Calculate stats from global defaults
        const stats = { visual: 0, raw: 0 };
        Object.values(this.globalDefaults).forEach(mode => {
            stats[mode]++;
        });
        return stats;
    }

    /**
     * Check if any section is in raw mode
     * @returns {boolean} True if at least one section is in raw mode
     */
    hasRawModes() {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                return currentInstance.hasRawModes();
            }
        }
        return Object.values(this.globalDefaults).some(mode => mode === 'raw');
    }

    /**
     * Sync view modes from ViewModeToggle component to current instance
     * @param {Object} modes - Modes from ViewModeToggle.getAllModes()
     */
    syncFromToggle(modes) {
        if (this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                currentInstance.setViewModes(modes);
                this.saveToStorage(currentInstance.uuid, modes);
            }
        }
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
        
        // If nothing in storage, modes will be default from CPEEInstance
        // Trigger callback to update UI
        if (this.onModeChange && this.instanceService) {
            const currentInstance = this.instanceService.getCurrentInstance();
            if (currentInstance) {
                const modes = currentInstance.getAllViewModes();
                Object.entries(modes).forEach(([sectionId, mode]) => {
                    this.onModeChange(sectionId, mode, newUuid);
                });
            }
        }
        
        return restored;
    }

    /**
     * Export view modes for all instances (for backup/debugging)
     * @returns {Object} All saved view modes
     */
    exportAllModes() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to export view modes:', error);
            return {};
        }
    }

    /**
     * Import view modes (for restore from backup)
     * @param {Object} modes - All view modes to import
     */
    importAllModes(modes) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(modes));
            return true;
        } catch (error) {
            console.warn('Failed to import view modes:', error);
            return false;
        }
    }
}

