/**
 * ViewModeToggle Component
 * Manages graph/cleaned/raw/traces/analysis mode toggle buttons for content sections
 * Provides toggle interface for switching between:
 * - Graph View (rendered visualization)
 * - Cleaned View (preprocessed code)
 * - Raw View (original un-preprocessed code)
 * - Traces View (execution paths)
 * - Analysis View (soundness & boundedness)
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

        // Create visual mode button (Graph View)
        const visualBtn = this.domRegistry.createElement('button', {
            className: 'toggle-btn toggle-btn-visual active',
            'data-mode': 'visual',
            'aria-label': `Show ${sectionTitle} as rendered graph`,
            title: 'Graph View'
        });
        visualBtn.innerHTML = ICONS.VISUAL;

        // Create raw mode button (Cleaned View - preprocessed code)
        const rawBtn = this.domRegistry.createElement('button', {
            className: 'toggle-btn toggle-btn-raw',
            'data-mode': 'raw',
            'aria-label': `Show ${sectionTitle} as cleaned/preprocessed code`,
            title: 'Cleaned View (Preprocessed)'
        });
        rawBtn.innerHTML = ICONS.RAW;

        // Create log mode button (Raw View - original un-preprocessed code)
        const logBtn = this.domRegistry.createElement('button', {
            className: 'toggle-btn toggle-btn-log',
            'data-mode': 'log',
            'aria-label': `Show ${sectionTitle} as raw/original code`,
            title: 'Raw View (Original)'
        });
        logBtn.innerHTML = ICONS.LOG;

        // Create traces mode button
        const tracesBtn = this.domRegistry.createElement('button', {
            className: 'toggle-btn toggle-btn-traces',
            'data-mode': 'traces',
            'aria-label': `Show ${sectionTitle} execution traces`,
            title: 'Traces View'
        });
        tracesBtn.innerHTML = ICONS.TRACES;

        // Create analysis mode button
        const analysisBtn = this.domRegistry.createElement('button', {
            className: 'toggle-btn toggle-btn-analysis',
            'data-mode': 'analysis',
            'aria-label': `Show ${sectionTitle} soundness and boundedness analysis`,
            title: 'Analysis View'
        });
        analysisBtn.innerHTML = ICONS.ANALYSIS;

        // Add click handlers
        visualBtn.addEventListener('click', () => this.switchMode(sectionId, 'visual'));
        rawBtn.addEventListener('click', () => this.switchMode(sectionId, 'raw'));
        logBtn.addEventListener('click', () => this.switchMode(sectionId, 'log'));
        tracesBtn.addEventListener('click', () => this.switchMode(sectionId, 'traces'));
        analysisBtn.addEventListener('click', () => this.switchMode(sectionId, 'analysis'));

        toggleContainer.appendChild(visualBtn);
        toggleContainer.appendChild(rawBtn);
        toggleContainer.appendChild(logBtn);
        toggleContainer.appendChild(tracesBtn);
        toggleContainer.appendChild(analysisBtn);

        return toggleContainer;
    }

    /**
     * Switch view mode for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - Mode to switch to ('visual', 'raw', 'log', 'traces', or 'analysis')
     */
    switchMode(sectionId, mode) {
        // Update button states (UI only)
        this.updateToggleState(sectionId, mode);

        // Emit event - StateManager will be updated by the listener (ContentViewCoordinator)
        this.eventBus.emit('viewModeToggle:modeChanged', { sectionId, mode });
    }

    /**
     * Update toggle button states for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - Current mode ('visual', 'raw', 'log', 'traces', or 'analysis')
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
     * @returns {string} Current mode ('visual', 'raw', 'log', 'traces', or 'analysis')
     */
    getMode(sectionId) {
        const viewModes = this.stateManager.getState('viewModes') || {};
        return viewModes[sectionId] || 'visual';
    }

    /**
     * Set mode for a section programmatically
     * @param {string} sectionId - Section identifier
     * @param {string} mode - Mode to set ('visual', 'raw', 'log', 'traces', or 'analysis')
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
     * Resets all view modes (visual, raw, log, traces, analysis) to visual
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

    /**
     * Update the analysis button to indicate whether there are issues
     * @param {string} sectionId - Section identifier
     * @param {boolean} hasIssues - Whether there are analysis issues
     */
    updateAnalysisButtonIssueState(sectionId, hasIssues) {
        const toggleContainer = document.querySelector(`.view-mode-toggle[data-section-id="${sectionId}"]`);
        if (toggleContainer) {
            const analysisBtn = toggleContainer.querySelector('.toggle-btn-analysis');
            if (analysisBtn) {
                analysisBtn.classList.toggle('has-issues', hasIssues);
            }
        }
    }

    /**
     * Check if a section has analysis issues based on verification and reachability results
     * Returns true if: not sound, or has reachability issues (dead-end/unreachable nodes)
     * Note: Boundedness is NOT checked because it's always true due to hardcoded bounded exploration
     * Excludes empty graphs and graphs with only start/end nodes (no tasks)
     * @param {Object} verificationResult - Verification result from step
     * @param {Object} reachabilityResult - Reachability result from step
     * @returns {boolean} True if there are analysis issues
     */
    static hasAnalysisIssues(verificationResult, reachabilityResult) {
        // No results means no issues to report (data not yet available)
        if (!verificationResult && !reachabilityResult) {
            return false;
        }

        // Check if this is an empty graph or a graph with no meaningful tasks
        // If taskCount is 0 or undefined, don't flag as having issues
        if (verificationResult) {
            const taskCount = verificationResult.taskCount || 0;
            if (taskCount === 0) {
                return false;
            }
        }

        // Check verification issues (soundness only - boundedness is always true)
        if (verificationResult && !verificationResult.error) {
            // Not sound
            if (verificationResult.sound === false) {
                return true;
            }
            // Note: Boundedness check removed - always true due to hardcoded bounded exploration
        }

        // Check reachability issues (dead-end or unreachable nodes)
        if (reachabilityResult && !reachabilityResult.error && reachabilityResult.success !== false) {
            const nodeClass = reachabilityResult.nodeClassification || {};
            const totalNodes = (nodeClass.usefulCount || 0) + (nodeClass.deadEndCount || 0) + (nodeClass.unreachableCount || 0);
            
            // Only check if there are actual nodes to analyze
            if (totalNodes > 0) {
                if ((nodeClass.deadEndCount || 0) > 0 || (nodeClass.unreachableCount || 0) > 0) {
                    return true;
                }
            }
        }

        return false;
    }
}

