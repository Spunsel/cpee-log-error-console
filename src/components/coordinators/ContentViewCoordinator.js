/**
 * Content View Coordinator
 * Coordinates all content view modes (visual, raw, log, traces)
 * Routes to appropriate renderers based on view mode
 * 
 * Responsibilities:
 * - View mode toggle management
 * - Route to appropriate renderer (RawContentRenderer, LogContentRenderer, TraceContentRenderer, ContentVisualizationCoordinator)
 * - View mode state coordination
 * - Coordinate content hiding/restoration when switching modes
 * 
 * View Mode Routing:
 * - 'raw' → RawContentRenderer (preprocessed content)
 * - 'log' → LogContentRenderer (untouched log content)
 * - 'traces' → TraceContentRenderer (execution traces)
 * - 'visual' → ContentVisualizationCoordinator (SVG graphs)
 */

import { ViewModeToggle } from '../ui/ViewModeToggle.js';
import { RawContentRenderer } from '../renderers/RawContentRenderer.js';
import { LogContentRenderer } from '../renderers/LogContentRenderer.js';
import { TraceContentRenderer } from '../renderers/TraceContentRenderer.js';
import { TraceComparisonCoordinator } from './TraceComparisonCoordinator.js';
import { CPEETraceCalculator } from '../../utils/trace/CPEETraceCalculator.js';
import { MermaidTraceCalculator } from '../../utils/trace/MermaidTraceCalculator.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class ContentViewCoordinator {
    constructor(domRegistry = null, contentSectionCoordinator = null, eventBus = null, stateManager = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.contentSectionCoordinator = contentSectionCoordinator;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;

        // Content View Components (pass stateManager so ViewModeToggle can read state)
        this.viewModeToggle = new ViewModeToggle(domRegistry, this.eventBus, this.stateManager);
        
        // Instantiate all three renderers for different view modes
        this.rawContentRenderer = new RawContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        this.logContentRenderer = new LogContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        this.traceContentRenderer = new TraceContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        
        // Trace comparison coordinator
        this.traceComparisonCoordinator = new TraceComparisonCoordinator(domRegistry, this.eventBus);
        
        // Track calculated traces per section for comparison
        this.calculatedTraces = new Map(); // Map<sectionId, traces>
        
        // Action bars per section (moved to RawContentRenderer)
        // this.actionBars = new Map();
        
        // Store original content per section (moved to RawContentRenderer)
        // this.originalContent = new Map();

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

        // Initialize view mode integration
        this.setupViewModeIntegration();
        
        // Setup trace comparison integration
        this.setupTraceComparisonIntegration();
    }

    /**
     * Setup view mode integration with StateManager
     */
    setupViewModeIntegration() {
        // ViewModes are automatically persisted by StateManager
        // Just ensure we have initial values if needed
        const stateModes = this.stateManager.getState('viewModes');
        if (!stateModes || Object.keys(stateModes).length === 0) {
            // Initialize with defaults if empty
            const defaultModes = {
                'input-cpee': 'visual',
                'input-intermediate': 'visual',
                'output-intermediate': 'visual',
                'output-cpee': 'visual'
            };
            this.stateManager.setState('viewModes', defaultModes);
        }

        // Listen for view mode toggle events (always register listener)
        this.eventBus.on('viewModeToggle:modeChanged', (data) => {
            console.log(`Mode changed: ${data.sectionId} → ${data.mode}`);
            this.setViewMode(data.sectionId, data.mode);
            this.updateSectionDisplay(data.sectionId, data.mode);
            
            // Note: Comparison info boxes remain visible regardless of view mode
            // Traces are kept in calculatedTraces map for comparison purposes
        });

        // Listen to StateManager changes to sync toggle button UI
        this.stateManager.subscribe('viewModes', (newModes) => {
            // Update all toggle buttons when state changes externally
            Object.keys(newModes || {}).forEach(sectionId => {
                this.viewModeToggle.updateToggleState(sectionId, newModes[sectionId]);
            });
        });
    }
    
    /**
     * Setup trace comparison integration
     * Listens for trace calculation events and triggers comparison when appropriate
     */
    setupTraceComparisonIntegration() {
        // Listen for trace calculation events
        this.eventBus.on('traces:calculated', (data) => {
            this.handleTraceCalculated(data);
        });
        
        // Listen for trace calculation errors
        this.eventBus.on('traces:error', (data) => {
            this.handleTraceError(data);
        });
        
        // Note: View mode changes are already handled in setupViewModeIntegration()
        // We don't need a separate listener here since updateSectionDisplay() handles traces mode
        // and checkTraceCacheAndCompare() is called when switching to traces mode
        
        console.log('[ContentViewCoordinator] Trace comparison integration setup complete');
    }
    
    /**
     * Handle trace calculation event
     * @param {Object} data - Event data with sectionId, stepNumber, traceCount, traces
     */
    handleTraceCalculated(data) {
        const { sectionId, traces, stepNumber } = data;
        
        console.log(`[ContentViewCoordinator] Trace calculated for ${sectionId}, step ${stepNumber}, count: ${traces?.length || 0}`);
        
        // Store calculated traces regardless of view mode (for comparison display)
        if (traces && Array.isArray(traces)) {
            this.calculatedTraces.set(sectionId, traces);
            console.log(`[ContentViewCoordinator] Stored ${traces.length} traces for ${sectionId}`);
            
            // Check if we can perform comparison now
            this.checkAndPerformComparison();
        }
    }
    
    /**
     * Handle trace calculation error
     * @param {Object} data - Event data with sectionId, stepNumber, error
     */
    handleTraceError(data) {
        const { sectionId } = data;
        console.warn(`[ContentViewCoordinator] Trace calculation error for ${sectionId}:`, data.error);
        
        // Remove traces for this section (don't compare if calculation failed)
        this.calculatedTraces.delete(sectionId);
        
        // Clear comparison info box for the affected pair
        if (sectionId === 'input-cpee' || sectionId === 'input-intermediate') {
            this.traceComparisonCoordinator.clearInfoBox('input');
        } else if (sectionId === 'output-cpee' || sectionId === 'output-intermediate') {
            this.traceComparisonCoordinator.clearInfoBox('output');
        }
    }
    
    /**
     * Check trace cache for a section and store if found
     * @param {string} sectionId - Section identifier
     */
    checkTraceCacheAndCompare(sectionId) {
        if (!this.currentStep) {
            return;
        }
        
        // Get trace cache from TraceContentRenderer
        const cacheKey = `${sectionId}-${this.currentStep.stepNumber || 'unknown'}`;
        const cachedTraces = this.traceContentRenderer.traceCache?.get(cacheKey);
        
        if (cachedTraces && Array.isArray(cachedTraces) && cachedTraces.length > 0) {
            console.log(`[ContentViewCoordinator] Found cached traces for ${sectionId}, storing for comparison`);
            this.calculatedTraces.set(sectionId, cachedTraces);
            // Check if we can perform comparison now
            this.checkAndPerformComparison();
        }
    }
    
    /**
     * Check if all traces for a pair are calculated and perform comparison
     * Performs comparison regardless of view mode (info box should be visible when step opens)
     */
    checkAndPerformComparison() {
        // Compare input traces if both are available (regardless of view mode)
        const inputCpeeTraces = this.calculatedTraces.get('input-cpee');
        const inputMermaidTraces = this.calculatedTraces.get('input-intermediate');
        
        if (inputCpeeTraces && inputMermaidTraces) {
            console.log('[ContentViewCoordinator] Performing input trace comparison');
            const stepNumber = this.currentStep?.stepNumber || null;
            this.traceComparisonCoordinator.compareInputTraces(inputCpeeTraces, inputMermaidTraces, stepNumber);
        }
        
        // Compare output traces if both are available (regardless of view mode)
        const outputCpeeTraces = this.calculatedTraces.get('output-cpee');
        const outputMermaidTraces = this.calculatedTraces.get('output-intermediate');
        
        if (outputCpeeTraces && outputMermaidTraces) {
            console.log('[ContentViewCoordinator] Performing output trace comparison');
            const stepNumber = this.currentStep?.stepNumber || null;
            this.traceComparisonCoordinator.compareOutputTraces(outputCpeeTraces, outputMermaidTraces, stepNumber);
        }
    }

    /**
     * Get view mode for a section
     * @param {string} sectionId - Section identifier
     * @returns {string} View mode ('visual', 'raw', 'log', or 'traces')
     */
    getViewMode(sectionId) {
        const viewModes = this.stateManager.getState('viewModes');
        return viewModes[sectionId] || 'visual';
    }

    /**
     * Set view mode for a section
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode ('visual', 'raw', 'log', or 'traces')
     * @returns {boolean} True if mode was set successfully
     */
    setViewMode(sectionId, mode) {
        if (!(mode === 'visual' || mode === 'raw' || mode === 'log' || mode === 'traces')) {
            return false;
        }
        
        // Update StateManager
        const currentModes = this.stateManager.getState('viewModes') || {};
        currentModes[sectionId] = mode;
        this.stateManager.setState('viewModes', currentModes);
        
        return true;
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

        // Toggle button is now handled via EventBus in setupViewModeIntegration()
        // No need to set up direct callbacks here
    }

    /**
     * Update section display based on view mode
     * @param {string} sectionId - Section identifier
     * @param {string} mode - View mode (visual, raw, log, or traces)
     */
    updateSectionDisplay(sectionId, mode) {
        if (!this.currentStep) {
            return;
        }

        // Get the section element using DOMRegistry for consistent DOM access
        // Use getElementSafe to avoid warnings for unregistered dynamic IDs
        const sectionElement = this.domRegistry 
            ? this.domRegistry.getElementSafe(sectionId)
            : null;
        if (!sectionElement) {
            console.warn(`ContentViewCoordinator: Section element '${sectionId}' not found`);
            return;
        }

        // Find the content box (pre element with content)
        const contentContainer = sectionElement.querySelector('.content-box');
        if (!contentContainer) {
            console.warn(`ContentViewCoordinator: Content box not found in section '${sectionId}'`);
            return;
        }

        // Route to appropriate renderer based on view mode
        if (mode === 'raw') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide trace content (including copy button) when switching to raw mode
            this.traceContentRenderer.hideTraceContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.rawContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else if (mode === 'log') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide trace content (including copy button) when switching to log mode
            this.traceContentRenderer.hideTraceContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.logContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else if (mode === 'traces') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide raw/log content (including action bars) when switching to traces mode
            this.rawContentRenderer.hideRawContent(contentContainer);
            this.logContentRenderer.hideLogContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.traceContentRenderer.display(sectionId, contentContainer, this.currentStep);
            
            // After displaying traces, check if we can perform comparison
            // (traces will be calculated and emitted via traces:calculated event)
            // The comparison will be triggered in handleTraceCalculated()
            // Also check trace cache directly in case traces are already calculated
            this.checkTraceCacheAndCompare(sectionId);
        } else {
            // Visual mode - ContentSectionManager handles this
            // Just ensure raw/log/traces content is hidden
            delete sectionElement.dataset.viewMode;
            this.rawContentRenderer.hideRawContent(contentContainer);
            this.logContentRenderer.hideLogContent(contentContainer);
            this.traceContentRenderer.hideTraceContent(contentContainer);
            
            // Only restore original content if we have it stored (i.e., if we were in raw/log mode)
            if (this.rawContentRenderer.hasOriginalContent(sectionId)) {
                this.rawContentRenderer.restoreOriginalContent(sectionId);
            }
            if (this.logContentRenderer.hasOriginalContent(sectionId)) {
                this.logContentRenderer.restoreOriginalContent(sectionId);
            }
            
            // Delegate visual content restoration to ContentVisualizationCoordinator
            if (this.contentSectionCoordinator) {
                this.contentSectionCoordinator.restoreVisualContent(sectionId);
            }
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

        // Clear all search states when switching to a different step
        this.rawContentRenderer.clearAllSearchStates();
        this.logContentRenderer.clearAllSearchStates();

        // Clear trace cache when switching to a different step
        this.traceContentRenderer.clearTraceCache();
        
        // Clear calculated traces when switching to a different step
        this.calculatedTraces.clear();
        
        // Clear comparison info boxes when switching to a different step
        this.traceComparisonCoordinator.clearAllInfoBoxes();

        // Reset all view modes to visual for this step
        // (View mode does not persist across steps)
        this.resetAllViewModes();

        // Attach toggles to all sections (only once)
        if (!this.togglesAttached) {
            this.viewModeToggle.attachToSections();
            // Attach expand/collapse buttons after view mode toggles are attached
            // (expand/collapse needs the left-title-side structure created by ViewModeToggle)
            if (this.contentSectionCoordinator && this.contentSectionCoordinator.attachExpandCollapseButtons) {
                this.contentSectionCoordinator.attachExpandCollapseButtons();
            }
            this.togglesAttached = true;
        }
        
        // Trigger trace calculation for all sections to enable comparison display
        // This ensures traces are calculated when step opens, regardless of view mode
        this.triggerTraceCalculationForStep(step);

        // Toggle change handler is now managed via EventBus in setupViewModeIntegration()
        // No need to set up direct callbacks here
    }
    
    /**
     * Trigger trace calculation for all sections when step opens
     * This ensures comparison info boxes can be displayed immediately
     * Calculates traces without rendering them to the DOM
     * @param {CPEEStep} step - Current step
     */
    triggerTraceCalculationForStep(step) {
        if (!step) {
            return;
        }
        
        const sections = [
            { id: 'input-cpee', rawGetter: 'getInputCpeeTreeRaw', isCPEE: true },
            { id: 'input-intermediate', rawGetter: 'getInputMermaidRaw', isCPEE: false },
            { id: 'output-intermediate', rawGetter: 'getOutputMermaidRaw', isCPEE: false },
            { id: 'output-cpee', rawGetter: 'getOutputCpeeTreeRaw', isCPEE: true }
        ];
        
        sections.forEach(section => {
            try {
                // Get raw content
                const rawContent = step[section.rawGetter]();
                if (!rawContent || !rawContent.getContent) {
                    return;
                }
                
                let contentString = rawContent.getContent();
                if (!contentString || contentString.trim() === '') {
                    return;
                }
                
                // Preprocess Mermaid code if needed
                if (!section.isCPEE && this.contentProcessingService) {
                    try {
                        const preprocessedResult = this.contentProcessingService.processAndValidateMermaid(contentString, true);
                        contentString = preprocessedResult.code;
                    } catch (error) {
                        console.warn(`[ContentViewCoordinator] Failed to preprocess Mermaid for ${section.id}, using original:`, error);
                    }
                }
                
                // Calculate traces
                const options = {
                    maxLoopIterations: 1,
                    maxPathLength: 50
                };
                
                let traces = [];
                if (section.isCPEE) {
                    traces = CPEETraceCalculator.calculateAllTraces(contentString, options);
                } else {
                    traces = MermaidTraceCalculator.calculateAllTraces(contentString, options);
                }
                
                // Cache traces in renderer
                const cacheKey = `${section.id}-${step.stepNumber || 'unknown'}`;
                this.traceContentRenderer.traceCache.set(cacheKey, traces);
                
                // Emit traces:calculated event
                this.eventBus.emit('traces:calculated', {
                    sectionId: section.id,
                    stepNumber: step.stepNumber || 'unknown',
                    traceCount: traces.length,
                    traces
                }, { silent: true });
                
                console.log(`[ContentViewCoordinator] Calculated ${traces.length} traces for ${section.id}`);
            } catch (error) {
                console.warn(`[ContentViewCoordinator] Failed to calculate traces for ${section.id}:`, error);
                // Emit error event
                this.eventBus.emit('traces:error', {
                    sectionId: section.id,
                    stepNumber: step.stepNumber || 'unknown',
                    error: error.message || 'Unknown error occurred',
                    errorObject: error
                }, { silent: true });
            }
        });
    }


    /**
     * Reset all view modes to visual
     */
    resetAllViewModes() {
        this.sectionIds.forEach(sectionId => {
            this.setViewMode(sectionId, 'visual');
            // Update the actual DOM display to show visual content
            this.updateSectionDisplay(sectionId, 'visual');
        });
        
        // Update toggle button UI to reflect the reset
        this.updateAllToggleButtons();
    }

    /**
     * Update all toggle button states to reflect current modes
     */
    updateAllToggleButtons() {
        this.sectionIds.forEach(sectionId => {
            const currentMode = this.getViewMode(sectionId);
            this.viewModeToggle.updateToggleState(sectionId, currentMode);
        });
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.currentStep = null;
        this.rawContentRenderer.destroy();
        this.logContentRenderer.destroy();
        this.traceContentRenderer.destroy();
    }
}

