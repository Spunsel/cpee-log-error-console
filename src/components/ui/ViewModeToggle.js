/**
 * ViewModeToggle Component
 * Manages visual/raw mode toggle buttons for content sections
 * Provides toggle interface for switching between rendered and raw code views
 */

import { ICONS } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class ViewModeToggle {
    constructor(domRegistry = null, eventBus = null, stateManager = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
    }


    /**
     * Create toggle button for a content section
     * @param {string} sectionId - Section identifier (e.g., 'input-cpee')
     * @param {string} sectionTitle - Section title for accessibility
     * @returns {HTMLElement} Toggle button container
     */
    createToggleButton(sectionId, sectionTitle) {
        const toggleContainer = this.domRegistry.createElement('div', {
            className: 'view-mode-toggle',
            'data-section-id': sectionId
        });

        // Create visual mode button
        const visualBtn = this.domRegistry.createElement('button', {
            className: 'toggle-btn toggle-btn-visual active',
            'data-mode': 'visual',
            'aria-label': `Show ${sectionTitle} as rendered visualization`,
            title: 'Visual View'
        });
        visualBtn.innerHTML = ICONS.VISUAL;

        // Create raw mode button
        const rawBtn = this.domRegistry.createElement('button', {
            className: 'toggle-btn toggle-btn-raw',
            'data-mode': 'raw',
            'aria-label': `Show ${sectionTitle} as raw code`,
            title: 'Raw Code View'
        });
        rawBtn.innerHTML = ICONS.RAW;

        // Add click handlers
        visualBtn.addEventListener('click', () => this.switchMode(sectionId, 'visual'));
        rawBtn.addEventListener('click', () => this.switchMode(sectionId, 'raw'));

        toggleContainer.appendChild(visualBtn);
        toggleContainer.appendChild(rawBtn);

        return toggleContainer;
    }

    /**
     * Switch view mode for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - Mode to switch to ('visual' or 'raw')
     */
    switchMode(sectionId, mode) {
        // Update button states (UI only)
        this.updateToggleState(sectionId, mode);

        // Emit event - StateManager will be updated by the listener (RawContentCoordinator)
        this.eventBus.emit('viewModeToggle:modeChanged', { sectionId, mode });
    }

    /**
     * Update toggle button states for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - Current mode ('visual' or 'raw')
     */
    updateToggleState(sectionId, mode) {
        const toggleContainer = document.querySelector(`.view-mode-toggle[data-section-id="${sectionId}"]`);
        if (toggleContainer) {
            const buttons = toggleContainer.querySelectorAll('.toggle-btn');
            buttons.forEach(btn => {
                const btnMode = btn.getAttribute('data-mode');
                btn.classList.toggle('active', btnMode === mode);
            });
        }
    }

    /**
     * Get current mode for a section (reads from StateManager)
     * @param {string} sectionId - Section identifier
     * @returns {string} Current mode ('visual' or 'raw')
     */
    getMode(sectionId) {
        const viewModes = this.stateManager.getState('viewModes') || {};
        return viewModes[sectionId] || 'visual';
    }

    /**
     * Set mode for a section programmatically
     * @param {string} sectionId - Section identifier
     * @param {string} mode - Mode to set ('visual' or 'raw')
     */
    setMode(sectionId, mode) {
        this.switchMode(sectionId, mode);
    }

    /**
     * Get all section modes (reads from StateManager)
     * @returns {Object} Object mapping section IDs to their current modes
     */
    getAllModes() {
        return { ...(this.stateManager.getState('viewModes') || {}) };
    }

    /**
     * Reset all sections to visual mode
     */
    resetAllToVisual() {
        const sectionIds = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        sectionIds.forEach(sectionId => {
            this.switchMode(sectionId, 'visual');
        });
    }

    /**
     * Attach toggle buttons to all content sections
     * Should be called after sections are rendered in DOM
     */
    attachToSections() {
        const sections = [
            { id: 'input-cpee', title: 'Input CPEE-Tree', selector: '#input-cpee h3' },
            { id: 'input-intermediate', title: 'Input Intermediate', selector: '#input-intermediate h3' },
            { id: 'output-intermediate', title: 'Output Intermediate', selector: '#output-intermediate h3' },
            { id: 'output-cpee', title: 'Output CPEE-Tree', selector: '#output-cpee h3' }
        ];

        // Get current state from StateManager
        const currentModes = this.stateManager.getState('viewModes') || {};

        sections.forEach(section => {
            const header = document.querySelector(section.selector);
            if (header && !header.querySelector('.view-mode-toggle')) {
                const toggleBtn = this.createToggleButton(section.id, section.title);
                
                // Initialize toggle state from StateManager
                const currentMode = currentModes[section.id] || 'visual';
                this.updateToggleState(section.id, currentMode);
                
                // Create a flex container for title and toggle
                const headerContainer = this.domRegistry.createElement('div', {
                    className: 'section-header-container'
                });
                
                // Create left side for title
                const leftSide = this.domRegistry.createElement('div', {
                    className: 'left-title-side'
                });
                
                // Create right side for toggle
                const rightSide = this.domRegistry.createElement('div', {
                    className: 'right-title-side'
                });
                
                // Move title text to left side
                const titleText = header.textContent;
                header.textContent = '';
                
                const titleSpan = this.domRegistry.createElement('span', {
                    className: 'section-title',
                    textContent: titleText
                });
                
                leftSide.appendChild(titleSpan);
                rightSide.appendChild(toggleBtn);
                
                headerContainer.appendChild(leftSide);
                headerContainer.appendChild(rightSide);
                header.appendChild(headerContainer);
            }
        });
    }

    /**
     * Remove all toggle buttons from sections
     */
    detachFromSections() {
        const toggles = document.querySelectorAll('.view-mode-toggle');
        toggles.forEach(toggle => {
            const container = toggle.closest('.section-header-container');
            if (container) {
                const header = container.parentElement;
                const titleSpan = container.querySelector('.section-title');
                if (header && titleSpan) {
                    header.textContent = titleSpan.textContent;
                }
            }
        });
    }
}

