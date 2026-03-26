/**
 * Content View Coordinator
 * Coordinates all content view modes (visual, raw, log, traces, analysis)
 * Routes to appropriate renderers based on view mode
 * 
 * Responsibilities:
 * - View mode toggle management
 * - Route to appropriate renderer (RawContentRenderer, LogContentRenderer, TraceContentRenderer, AnalysisContentRenderer, ContentVisualizationCoordinator)
 * - View mode state coordination
 * - Coordinate content hiding/restoration when switching modes
 * 
 * View Mode Routing:
 * - 'raw' → RawContentRenderer (preprocessed content)
 * - 'log' → LogContentRenderer (untouched log content)
 * - 'traces' → TraceContentRenderer (execution traces)
 * - 'analysis' → AnalysisContentRenderer (soundness and boundedness verification)
 * - 'visual' → ContentVisualizationCoordinator (SVG graphs)
 */

import { ViewModeToggle } from '../ui/ViewModeToggle.js';
import { RawContentRenderer } from '../renderers/RawContentRenderer.js';
import { LogContentRenderer } from '../renderers/LogContentRenderer.js';
import { TraceContentRenderer } from '../renderers/TraceContentRenderer.js';
import { AnalysisContentRenderer } from '../renderers/AnalysisContentRenderer.js';
import { TraceComparisonCoordinator } from './TraceComparisonCoordinator.js';
import { CPEETraceCalculator } from '../../utils/trace/CPEETraceCalculator.js';
import { MermaidTraceCalculator } from '../../utils/trace/MermaidTraceCalculator.js';
import { verifySoundnessAndBoundedness } from '../../utils/trace/SoundnessBoundednessVerifier.js';
import { analyzeReachabilityFromTraces } from '../../utils/trace/ReachabilityAnalyzer.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { stateManager as defaultStateManager } from '../../core/StateManager.js';

export class ContentViewCoordinator {
    constructor(domRegistry = null, contentSectionCoordinator = null, eventBus = null, stateManager = null, contentProcessingService = null) {
        this.domRegistry = domRegistry;
        this.contentSectionCoordinator = contentSectionCoordinator;
        this.eventBus = eventBus || defaultEventBus;
        this.stateManager = stateManager || defaultStateManager;
        this.contentProcessingService = contentProcessingService || null;

        // Content View Components (pass stateManager so ViewModeToggle can read state)
        this.viewModeToggle = new ViewModeToggle(domRegistry, this.eventBus, this.stateManager);
        
        // Instantiate all renderers for different view modes
        this.rawContentRenderer = new RawContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        this.logContentRenderer = new LogContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        this.traceContentRenderer = new TraceContentRenderer(domRegistry, this.eventBus, contentProcessingService);
        this.analysisContentRenderer = new AnalysisContentRenderer(domRegistry, this.eventBus);
        
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
            this.setViewMode(data.sectionId, data.mode);
            this.updateSectionDisplay(data.sectionId, data.mode);
            
            // Note: Comparison info boxes remain visible regardless of view mode
            // Traces are kept in calculatedTraces map for comparison purposes
        });
        
        // Listen for step changes to handle analysis view updates 
        this.eventBus.on('stepViewer:stepChanged', (data) => {
            const { step } = data;
            if (step) {
                // Check if any section is in analysis mode and update if needed
                const viewModes = this.stateManager.getState('viewModes') || {};
                Object.keys(viewModes).forEach(sectionId => {
                    if (viewModes[sectionId] === 'analysis') {
                        // Re-render analysis content for this section with new step
                        const sectionElement = this.domRegistry.getElementSafe(sectionId);
                        if (sectionElement) {
                            const contentContainer = sectionElement.querySelector('.content-box');
                            if (contentContainer) {
                                this.analysisContentRenderer.display(sectionId, contentContainer, step);
                            }
                        }
                    }
                });
            }
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
        
        // Listen for trace reconciliation events to re-render traces
        this.eventBus.on('traceReconciliation:tracesAdded', (data) => {
            this.handleTracesAddedAfterReconciliation(data);
        });

        // Listen for re-analysis requests after reconciliation
        this.eventBus.on('traceReconciliation:rerunAnalysis', (data) => {
            this.handleRerunAnalysisAfterReconciliation(data);
        });

        // Listen for trace re-render requests
        this.eventBus.on('traceContentRenderer:requestReRender', (data) => {
            this.handleTraceReRenderRequest(data);
        });
        
        // Note: View mode changes are already handled in setupViewModeIntegration()
        // We don't need a separate listener here since updateSectionDisplay() handles traces mode
        // and checkTraceCacheAndCompare() is called when switching to traces mode
    }
    
    /**
     * Handle trace calculation event
     * @param {Object} data - Event data with sectionId, stepNumber, traceCount, traces
     */
    handleTraceCalculated(data) {
        const { sectionId, traces, stepNumber } = data;
        
        // Store calculated traces regardless of view mode (for comparison display)
        if (traces && Array.isArray(traces)) {
            this.calculatedTraces.set(sectionId, traces);
            
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
     * Handle traces added after reconciliation
     * Re-renders trace displays for the affected sections
     * @param {Object} data - Event data with sectionPair, targetGraph, addedCount, validatedTraces
     */
    handleTracesAddedAfterReconciliation(data) {
        const { sectionPair, targetGraph, addedCount } = data;
        
        if (!this.currentStep) {
            return;
        }

        console.log(`[ContentViewCoordinator] Handling ${addedCount} reconciled traces for ${sectionPair} (target: ${targetGraph})`);

        // Determine which sections need re-rendering
        const sectionIds = sectionPair === 'input'
            ? ['input-cpee', 'input-intermediate']
            : ['output-cpee', 'output-intermediate'];

        // Update calculated traces cache with new traces from step
        for (const sectionId of sectionIds) {
            const traces = this.currentStep.getTraces(sectionId);
            if (traces) {
                this.calculatedTraces.set(sectionId, traces);
            }
        }

        // Re-render traces for sections in traces view mode
        const viewModes = this.stateManager.getState('viewModes') || {};
        for (const sectionId of sectionIds) {
            if (viewModes[sectionId] === 'traces') {
                const sectionElement = this.domRegistry?.getElementSafe(sectionId) || document.getElementById(sectionId);
                if (sectionElement) {
                    const contentContainer = sectionElement.querySelector('.content-box');
                    if (contentContainer) {
                        this.traceContentRenderer.display(sectionId, contentContainer, this.currentStep);
                    }
                }
            }
        }
    }

    /**
     * Handle re-run analysis request after reconciliation
     * Re-runs verification and reachability analysis for the affected section
     * @param {Object} data - Event data with sectionId, sectionPair, stepNumber, traces
     */
    handleRerunAnalysisAfterReconciliation(data) {
        const { sectionId, traces } = data;
        
        if (!this.currentStep || !traces) {
            return;
        }

        console.log(`[ContentViewCoordinator] Re-running analysis for ${sectionId} after reconciliation`);

        // Determine if this is a CPEE or Mermaid section
        const isCPEE = sectionId.includes('cpee');
        
        // Get raw content
        let rawContent = null;
        let contentString = null;
        
        try {
            if (sectionId === 'input-cpee') {
                rawContent = this.currentStep.getInputCpeeTreeRaw();
            } else if (sectionId === 'output-cpee') {
                rawContent = this.currentStep.getOutputCpeeTreeRaw();
            } else if (sectionId === 'input-intermediate') {
                rawContent = this.currentStep.getInputMermaidRaw();
            } else if (sectionId === 'output-intermediate') {
                rawContent = this.currentStep.getOutputMermaidRaw();
            }
            
            if (rawContent && rawContent.getContent) {
                contentString = rawContent.getContent();
            }
        } catch (error) {
            console.error(`[ContentViewCoordinator] Error getting content for ${sectionId}:`, error);
            return;
        }

        if (!contentString) {
            return;
        }

        // Re-run verification (soundness and boundedness)
        try {
            const format = isCPEE ? 'cpee' : 'mermaid';
            const verificationResult = verifySoundnessAndBoundedness(
                traces,
                contentString,
                format,
                { maxLoopIterations: 1 }
            );
            
            this.currentStep.setVerificationResult(sectionId, verificationResult);
            
            // Emit verification completion event
            this.eventBus.emit('verification:complete', {
                sectionId,
                stepNumber: this.currentStep.stepNumber || 'unknown',
                verificationResult,
                afterReconciliation: true
            });
            
            console.log(`[ContentViewCoordinator] Verification re-run complete for ${sectionId}: sound=${verificationResult.sound}, bounded=${verificationResult.bounded}`);
        } catch (error) {
            console.warn(`[ContentViewCoordinator] Verification re-run failed for ${sectionId}:`, error);
        }

        // Re-run trace-based reachability analysis
        try {
            const format = isCPEE ? 'cpee' : 'mermaid';
            
            // Extract all tasks from the GRAPH (not just traces) for accurate unreachable task detection
            let allTasksFromGraph = [];
            try {
                let rawContent = null;
                if (sectionId === 'input-cpee') {
                    rawContent = this.currentStep.getInputCpeeTreeRaw();
                } else if (sectionId === 'output-cpee') {
                    rawContent = this.currentStep.getOutputCpeeTreeRaw();
                } else if (sectionId === 'input-intermediate') {
                    rawContent = this.currentStep.getInputMermaidRaw();
                } else if (sectionId === 'output-intermediate') {
                    rawContent = this.currentStep.getOutputMermaidRaw();
                }
                
                if (rawContent && rawContent.getContent) {
                    const contentString = rawContent.getContent();
                    if (contentString && contentString.trim() !== '') {
                        if (isCPEE) {
                            allTasksFromGraph = CPEETraceCalculator.extractAllTasksFromGraph(contentString);
                        } else {
                            allTasksFromGraph = MermaidTraceCalculator.extractAllTasksFromGraph(contentString);
                        }
                    }
                }
            } catch (extractError) {
                console.warn(`[ContentViewCoordinator] Failed to extract all tasks from graph for ${sectionId}, falling back to traces:`, extractError);
                allTasksFromGraph = this.extractAllTasksFromTraces(traces);
            }
            
            // Fallback to trace-based extraction if graph extraction failed
            if (allTasksFromGraph.length === 0) {
                allTasksFromGraph = this.extractAllTasksFromTraces(traces);
            }
            
            const reachabilityResult = analyzeReachabilityFromTraces(
                traces,
                allTasksFromGraph,
                { format }
            );
            
            this.currentStep.setReachabilityResult(sectionId, reachabilityResult);
            
            // Emit reachability completion event
            this.eventBus.emit('reachability:analyzed', {
                sectionId,
                stepNumber: this.currentStep.stepNumber || 'unknown',
                reachabilityResult,
                afterReconciliation: true
            });
            
            if (reachabilityResult.success) {
                console.log(`[ContentViewCoordinator] Trace-based reachability re-run complete for ${sectionId}`);
            }
        } catch (error) {
            console.warn(`[ContentViewCoordinator] Trace-based reachability re-run failed for ${sectionId}:`, error);
        }

        // Update analysis button issue state after re-running analysis
        this.updateAnalysisButtonForSection(sectionId, this.currentStep);

        // If analysis view is active, re-render it
        const viewModes = this.stateManager.getState('viewModes') || {};
        if (viewModes[sectionId] === 'analysis') {
            const sectionElement = this.domRegistry?.getElementSafe(sectionId) || document.getElementById(sectionId);
            if (sectionElement) {
                const contentContainer = sectionElement.querySelector('.content-box');
                if (contentContainer) {
                    this.analysisContentRenderer.display(sectionId, contentContainer, this.currentStep);
                }
            }
        }
    }

    /**
     * Handle trace re-render request from TraceContentRenderer
     * @param {Object} data - Event data with sectionId, sectionPair
     */
    handleTraceReRenderRequest(data) {
        const { sectionId } = data;
        
        if (!this.currentStep) {
            return;
        }

        const sectionElement = this.domRegistry?.getElementSafe(sectionId) || document.getElementById(sectionId);
        if (sectionElement) {
            const contentContainer = sectionElement.querySelector('.content-box');
            if (contentContainer) {
                this.traceContentRenderer.display(sectionId, contentContainer, this.currentStep);
            }
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
            const stepNumber = this.currentStep?.stepNumber || null;
            this.traceComparisonCoordinator.compareInputTraces(inputCpeeTraces, inputMermaidTraces, stepNumber);
        }
        
        // Compare output traces if both are available (regardless of view mode)
        const outputCpeeTraces = this.calculatedTraces.get('output-cpee');
        const outputMermaidTraces = this.calculatedTraces.get('output-intermediate');
        
        if (outputCpeeTraces && outputMermaidTraces) {
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
     * @param {string} mode - View mode ('visual', 'raw', 'log', 'traces', or 'analysis')
     * @returns {boolean} True if mode was set successfully
     */
    setViewMode(sectionId, mode) {
        if (!(mode === 'visual' || mode === 'raw' || mode === 'log' || mode === 'traces' || mode === 'analysis')) {
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
     * @param {string} mode - View mode (visual, raw, log, traces, or analysis)
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
            // Hide other content types when switching to raw mode
            this.traceContentRenderer.hideTraceContent(contentContainer);
            this.analysisContentRenderer.hideAnalysisContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.rawContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else if (mode === 'log') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide other content types when switching to log mode
            this.traceContentRenderer.hideTraceContent(contentContainer);
            this.analysisContentRenderer.hideAnalysisContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.logContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else if (mode === 'traces') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide other content types when switching to traces mode
            this.rawContentRenderer.hideRawContent(contentContainer);
            this.logContentRenderer.hideLogContent(contentContainer);
            this.analysisContentRenderer.hideAnalysisContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.traceContentRenderer.display(sectionId, contentContainer, this.currentStep);
            
            // After displaying traces, check if we can perform comparison
            // (traces will be calculated and emitted via traces:calculated event)
            // The comparison will be triggered in handleTraceCalculated()
            // Also check trace cache directly in case traces are already calculated
            this.checkTraceCacheAndCompare(sectionId);
        } else if (mode === 'analysis') {
            contentContainer.scrollTo({
                top: 0,
                left: 0,
            });
            // Hide other content types when switching to analysis mode
            this.rawContentRenderer.hideRawContent(contentContainer);
            this.logContentRenderer.hideLogContent(contentContainer);
            this.traceContentRenderer.hideTraceContent(contentContainer);
            // Store view mode in section element for renderer to access
            sectionElement.dataset.viewMode = mode;
            this.analysisContentRenderer.display(sectionId, contentContainer, this.currentStep);
        } else {
            // Visual mode - ContentSectionManager handles this
            // Just ensure all other content types are hidden
            delete sectionElement.dataset.viewMode;
            this.rawContentRenderer.hideRawContent(contentContainer);
            this.logContentRenderer.hideLogContent(contentContainer);
            this.traceContentRenderer.hideTraceContent(contentContainer);
            this.analysisContentRenderer.hideAnalysisContent(contentContainer);
            
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

        // Set current step on trace comparison coordinator for reconciliation
        this.traceComparisonCoordinator.setCurrentStep(step);

        // Clear all search states when switching to a different step
        this.rawContentRenderer.clearAllSearchStates();
        this.logContentRenderer.clearAllSearchStates();

        // Clear trace cache when switching to a different step
        this.traceContentRenderer.clearTraceCache();
        
        // Clear calculated traces when switching to a different step
        this.calculatedTraces.clear();
        
        // Clear comparison info boxes and reconciliation state when switching to a different step
        this.traceComparisonCoordinator.clearAllInfoBoxes();
        this.traceComparisonCoordinator.clearReconciliationState();
        
        // Clear analysis displays and cache when switching to a different step 
        this.analysisContentRenderer.clearAll();
        
        // Clear analysis button issue states when switching steps
        this.sectionIds.forEach(sectionId => {
            this.viewModeToggle.updateAnalysisButtonIssueState(sectionId, false);
        });
        
        // Clear reachability results when navigating to new step 
        if (step) {
            step.clearAllReachabilityResults();
        }

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
                
                // Preprocess content if needed
                if (section.isCPEE && this.contentProcessingService) {
                    try {
                        const preprocessedResult = this.contentProcessingService.processAndValidateCPEE(contentString, true);
                        contentString = preprocessedResult.xml;
                    } catch (error) {
                        console.warn(`[ContentViewCoordinator] Failed to preprocess CPEE XML for ${section.id}, using original:`, error);
                    }
                } else if (!section.isCPEE && this.contentProcessingService) {
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
                
                // Store traces in step
                step.setTraces(section.id, traces);
                
                // Perform soundness and boundedness verification
                try {
                    const format = section.isCPEE ? 'cpee' : 'mermaid';
                    const verificationResult = verifySoundnessAndBoundedness(
                        traces,
                        contentString,
                        format,
                        { maxLoopIterations: options.maxLoopIterations }
                    );
                    
                    // Store verification result in step
                    step.setVerificationResult(section.id, verificationResult);
                    
                    // Emit verification completion event
                    this.eventBus.emit('verification:complete', {
                        sectionId: section.id,
                        stepNumber: step.stepNumber || 'unknown',
                        verificationResult: verificationResult
                    }, { silent: true });
                } catch (verificationError) {
                    console.error(`[ContentViewCoordinator] Verification failed for ${section.id}:`, verificationError);
                    console.error(`[ContentViewCoordinator] Verification error stack:`, verificationError.stack);
                    // Don't fail trace calculation if verification fails
                }
                
                // Perform trace-based reachability analysis
                try {
                    const format = section.isCPEE ? 'cpee' : 'mermaid';
                    
                    // Extract all tasks from the GRAPH (not just traces) for accurate unreachable task detection
                    let allTasksFromGraph = [];
                    try {
                        if (section.isCPEE) {
                            allTasksFromGraph = CPEETraceCalculator.extractAllTasksFromGraph(contentString);
                        } else {
                            allTasksFromGraph = MermaidTraceCalculator.extractAllTasksFromGraph(contentString);
                        }
                    } catch (extractError) {
                        console.warn(`[ContentViewCoordinator] Failed to extract all tasks from graph for ${section.id}, falling back to traces:`, extractError);
                        allTasksFromGraph = this.extractAllTasksFromTraces(traces);
                    }
                    
                    // Fallback to trace-based extraction if graph extraction failed
                    if (allTasksFromGraph.length === 0) {
                        allTasksFromGraph = this.extractAllTasksFromTraces(traces);
                    }
                    
                    const reachabilityResult = analyzeReachabilityFromTraces(
                        traces,
                        allTasksFromGraph,
                        { format }
                    );
                    
                    // Store reachability result in step
                    step.setReachabilityResult(section.id, reachabilityResult);
                    
                    // Emit reachability analysis completion event 
                    this.eventBus.emit('reachability:analyzed', {
                        sectionId: section.id,
                        stepNumber: step.stepNumber || 'unknown',
                        reachabilityResult: reachabilityResult
                    }, { silent: true });
                } catch (reachabilityError) {
                    console.error(`[ContentViewCoordinator] Trace-based reachability analysis failed for ${section.id}:`, reachabilityError);
                    console.error(`[ContentViewCoordinator] Reachability error stack:`, reachabilityError.stack);
                    // Don't fail trace calculation if reachability analysis fails
                }
                
                // Update analysis button issue state after both verification and reachability are complete
                this.updateAnalysisButtonForSection(section.id, step);
                
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
     * Update analysis button issue indicator for a specific section
     * @param {string} sectionId - Section identifier
     * @param {CPEEStep} step - Current step with verification/reachability results
     */
    updateAnalysisButtonForSection(sectionId, step) {
        if (!step) {
            return;
        }
        
        const verificationResult = step.getVerificationResult(sectionId);
        const reachabilityResult = step.getReachabilityResult(sectionId);
        
        const hasIssues = ViewModeToggle.hasAnalysisIssues(verificationResult, reachabilityResult);
        this.viewModeToggle.updateAnalysisButtonIssueState(sectionId, hasIssues);
    }

    /**
     * Update analysis button issue indicators for all sections
     * @param {CPEEStep} step - Current step with verification/reachability results
     */
    updateAllAnalysisButtons(step) {
        if (!step) {
            return;
        }
        
        this.sectionIds.forEach(sectionId => {
            this.updateAnalysisButtonForSection(sectionId, step);
        });
    }

    /**
     * Extract all unique tasks from calculated traces
     * @param {Array<Trace>} traces - Calculated traces
     * @returns {Array<Object>} Array of unique task objects with id/alt_id properties
     * @private
     */
    extractAllTasksFromTraces(traces) {
        const taskMap = new Map();
        
        if (!traces || !Array.isArray(traces)) {
            return [];
        }
        
        for (const trace of traces) {
            // Handle both Trace objects with .path and plain arrays
            const path = trace?.path || trace;
            if (Array.isArray(path)) {
                for (const step of path) {
                    const taskId = step?.id || step?.alt_id;
                    if (taskId && !taskMap.has(taskId)) {
                        taskMap.set(taskId, {
                            id: step.id,
                            alt_id: step.alt_id,
                            task: step.task || step.label
                        });
                    }
                }
            }
        }
        
        return Array.from(taskMap.values());
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.currentStep = null;
        this.rawContentRenderer.destroy();
        this.logContentRenderer.destroy();
        this.traceContentRenderer.destroy();
        // AnalysisContentRenderer doesn't have a destroy method, but we can clear displays if needed
        if (this.analysisContentRenderer && this.analysisContentRenderer.analysisDisplays) {
            this.analysisContentRenderer.analysisDisplays.clear();
        }
    }
}

