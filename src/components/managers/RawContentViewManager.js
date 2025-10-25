/**
 * Raw Content View Manager
 * Handles raw content viewing functionality only
 * Responsibilities:
 * - View mode toggle management
 * - Raw content display and rendering
 * - Copy functionality
 * - Raw content DOM updates
 * - View mode state coordination
 */

import { ViewModeToggle } from '../ui/ViewModeToggle.js';
import { CopyButton } from '../ui/CopyButton.js';
import { RawContentRenderer } from '../renderers/RawContentRenderer.js';
import { ViewModeManager } from './ViewModeManager.js';

export class RawContentViewManager {
    constructor(instanceService, domRegistry = null, contentSectionManager = null) {
        this.instanceService = instanceService;
        this.domRegistry = domRegistry;
        this.contentSectionManager = contentSectionManager;

        // Content View Components
        this.viewModeToggle = new ViewModeToggle(domRegistry);
        this.viewModeManager = new ViewModeManager(instanceService);
        this.rawContentRenderer = new RawContentRenderer(domRegistry);
        this.copyButton = new CopyButton(domRegistry);

        // Configuration
        this.sectionIds = [
            'input-cpee',
            'input-intermediate',
            'output-intermediate',
            'output-cpee'
        ];

        // Current step tracking
        this.currentStep = null;
        this.togglesAttached = false;

        // Initialize view mode manager
        this.setupViewModeManager();
    }

    /**
     * Setup view mode manager callbacks
     */
    setupViewModeManager() {
        this.viewModeManager.onModeChange = (sectionId, mode, _uuid) => {
            console.log(`Mode changed: ${sectionId} → ${mode}`);
            this.updateSectionDisplay(sectionId, mode);
        };
    }

    /**
     * Initialize raw content features for a section
     * Adds toggle button and sets up raw content rendering
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} sectionElement - Section container
     */
    initializeSection(sectionId, sectionElement) {
        if (!sectionElement) {
            return;
        }

        // Setup toggle change handler
        this.viewModeToggle.onModeChange = (toggleSectionId, mode) => {
            this.viewModeManager.setMode(toggleSectionId, mode);
        };
    }

    /**
     * Update section display based on view mode
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode (visual or raw)
     */
    updateSectionDisplay(sectionId, mode) {
        if (!this.currentStep) {
            return;
        }

        // Get the section element directly from DOM
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) {
            console.warn(`RawContentViewManager: Section element with ID '${sectionId}' not found`);
            return;
        }

        // Find the content box (pre element with content)
        const contentContainer = sectionElement.querySelector('.content-box');
        if (!contentContainer) {
            console.warn(`RawContentViewManager: Content box not found in section '${sectionId}'`);
            return;
        }

        if (mode === 'raw') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            this.displayRawContent(sectionId, contentContainer);
        } else {
            // Visual mode - ContentSectionManager handles this
            // Just ensure raw content is hidden
            this.hideRawContent(contentContainer);
        }
    }

    /**
     * Display raw content for a section
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     */
    displayRawContent(sectionId, container) {
        if (!this.currentStep || !container) {
            return;
        }

        let rawContent = null;
        let renderer = null;

        // Get raw content based on section
        switch (sectionId) {
            case 'input-cpee':
                rawContent = this.currentStep.getInputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawCPEETree(rawContent.getContent());
                }
                break;
            case 'input-intermediate':
                rawContent = this.currentStep.getInputMermaidRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-intermediate':
                rawContent = this.currentStep.getOutputMermaidRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawMermaid(rawContent.getContent());
                }
                break;
            case 'output-cpee':
                rawContent = this.currentStep.getOutputCpeeTreeRaw();
                if (rawContent && rawContent.getContent) {
                    renderer = () => this.rawContentRenderer.renderRawCPEETree(rawContent.getContent());
                }
                break;
        }

        if (!rawContent || !renderer) {
            container.innerHTML = '<pre><code class="no-content">No raw content available</code></pre>';
            return;
        }

        try {
            // Check if raw content container already exists
            let rawContainer = container.querySelector('[data-content-type="raw"]');
            if (!rawContainer) {
                rawContainer = document.createElement('div');
                rawContainer.setAttribute('data-content-type', 'raw');
                // Position raw container to overlay visual content
                rawContainer.style.position = 'absolute';
                rawContainer.style.top = '0';
                rawContainer.style.left = '0';
                rawContainer.style.width = '100%';
                rawContainer.style.height = '100%';
                rawContainer.style.overflow = 'auto';
                container.style.position = 'relative';
                container.appendChild(rawContainer);
            }

            // Hide the original visual content
            const visualElements = container.querySelectorAll('[data-content-type="visual"]');
            visualElements.forEach(el => {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            });

            // Hide parent container's scrollbar (raw container will handle scrolling)
            container.style.overflow = 'hidden';

            // Ensure raw container is visible and interactive
            rawContainer.style.display = 'block';
            rawContainer.style.visibility = 'visible';
            rawContainer.style.pointerEvents = 'auto';
            rawContainer.style.zIndex = '10';
            rawContainer.style.backgroundColor = '#ffffff';

            // Clear and populate raw container
            rawContainer.innerHTML = '';
            const rawElement = renderer();
            rawContainer.appendChild(rawElement);

            // Add copy button if content exists
            if (rawContent.getLength && rawContent.getLength() > 0) {
                this.addCopyButton(rawContainer, sectionId, rawContent);
            }
        } catch (error) {
            console.error(`Error rendering raw content for ${sectionId}:`, error);
            container.innerHTML = '<pre><code class="error">Error rendering raw content</code></pre>';
        }
    }

    /**
     * Hide raw content when switching to visual mode
     * @param {HTMLElement} container - Content container
     */
    hideRawContent(container) {
        if (!container) {
            return;
        }

        // Hide raw content elements
        const rawElements = container.querySelectorAll('[data-content-type="raw"]');
        rawElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '0';
        });

        // Delegate visual content restoration to ContentSectionManager
        if (this.contentSectionManager) {
            const sectionId = container.closest('[id]')?.id;
            if (sectionId) {
                this.contentSectionManager.restoreVisualContent(sectionId);
            }
        }
    }

    /**
     * Add copy button to a section
     * @param {HTMLElement} container - Container element
     * @param {string} sectionId - Section identifier
     * @param {Object} rawContent - Raw content object
     */
    addCopyButton(container, sectionId, rawContent) {
        // Get content to copy
        const contentToCopy = rawContent.getContent ? rawContent.getContent() : rawContent.getText();

        // Create copy button
        const copyBtn = new CopyButton(this.domRegistry, {
            successDuration: 2000,
            onCopySuccess: (content) => {
                console.log(`✓ Copied ${sectionId}:`, content.substring(0, 50) + '...');
            },
            onCopyError: (error) => {
                console.error(`✗ Copy failed for ${sectionId}:`, error);
            }
        });

        const button = copyBtn.createButton(contentToCopy, 'Copy');

        // Add button to container
        const buttonContainer = this.domRegistry.createElement('div', {
            className: 'raw-content-actions'
        });
        buttonContainer.appendChild(button);

        // Insert before content if possible
        if (container.firstChild) {
            container.insertBefore(buttonContainer, container.firstChild);
        } else {
            container.appendChild(buttonContainer);
        }
    }

    /**
     * Setup sections for current step
     * @param {CPEEStep} step - Current step
     */
    setupForStep(step) {
        if (!step) {
            return;
        }

        this.currentStep = step;

        // Reset all view modes to visual for this step
        // (View mode does not persist across steps)
        this.resetAllViewModes();

        // Attach toggles to all sections (only once)
        if (!this.togglesAttached) {
            this.viewModeToggle.attachToSections();
            this.togglesAttached = true;
        }

        // Setup toggle change handler
        this.viewModeToggle.onModeChange = (sectionId, mode) => {
            this.viewModeManager.setMode(sectionId, mode);
        };
    }

    /**
     * Get view mode for a section
     * @param {string} sectionId - Section identifier
     * @returns {string} View mode (visual or raw)
     */
    getViewMode(sectionId) {
        return this.viewModeManager.getMode(sectionId) || 'visual';
    }

    /**
     * Set view mode for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode (visual or raw)
     */
    setViewMode(sectionId, mode) {
        this.viewModeManager.setMode(sectionId, mode);
    }

    /**
     * Get all view modes
     * @returns {Object} View modes for all sections
     */
    getAllViewModes() {
        const instance = this.instanceService.getCurrentInstance();
        if (instance && instance.getAllViewModes) {
            return instance.getAllViewModes();
        }
        return {};
    }

    /**
     * Reset all view modes to visual
     */
    resetAllViewModes() {
        this.sectionIds.forEach(sectionId => {
            this.viewModeManager.setMode(sectionId, 'visual');
        });
        
        // Update toggle button UI to reflect the reset
        this.updateAllToggleButtons();
    }

    /**
     * Update all toggle button states to reflect current modes
     */
    updateAllToggleButtons() {
        this.sectionIds.forEach(sectionId => {
            const currentMode = this.viewModeManager.getMode(sectionId);
            this.viewModeToggle.updateToggleState(sectionId, currentMode);
        });
    }

    /**
     * Check if any section is in raw mode
     * @returns {boolean}
     */
    hasRawModes() {
        const instance = this.instanceService.getCurrentInstance();
        if (instance && instance.hasRawModes) {
            return instance.hasRawModes();
        }
        return false;
    }

    /**
     * Get statistics about raw content usage
     * @returns {Object} Statistics
     */
    getRawModeStats() {
        const instance = this.instanceService.getCurrentInstance();
        if (instance) {
            return {
                totalSections: this.sectionIds.length,
                modes: instance.getAllViewModes()
            };
        }
        return { totalSections: this.sectionIds.length, modes: {} };
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.currentStep = null;
    }
}
