/**
 * AnalysisContentRenderer
 * Renders soundness and boundedness verification results for CPEE and Mermaid sections
 * Displays verification analysis from SoundnessBoundednessVerifier
 * 
 * Responsibilities:
 * - Retrieve verification results from step model using getVerificationResult(sectionId)
 * - Display soundness verification results with status indicators
 * - Display boundedness verification results with status indicators
 * - Show detailed issues and violations when verification fails
 * - Format verification results in readable, structured format
 * - Handle edge cases: missing verification data, errors, malformed results
 * - Cache analysis displays to avoid unnecessary re-rendering
 * - Update analysis view when verification results change
 * - Clear analysis content when navigating between steps
 * 
 * Analysis View Structure:
 * - Summary section: Overall sound/bounded status with statistics
 * - Soundness section: Option to Complete, Proper Completion, No Dead Transitions
 * - Boundedness section: Bounded Places, Bounded Loops, Bounded Parallelism
 * - Issues section: List of all identified problems and violations
 * 
 * Verification Results Display:
 * - Results are retrieved from CPEEStep model via getVerificationResult(sectionId)
 * - If no results available: Shows "No Verification Results Available" message
 * - If error occurred: Shows error message with details
 * - If results valid: Displays full analysis with collapsible sections
 * 
 * Edge Cases Handled:
 * - Null/undefined verification results
 * - Missing or incomplete verification data
 * - Malformed verification result structures
 * - Missing graph content
 * - Verification errors
 * 
 * Caching:
 * - Analysis displays are cached per section-step combination
 * - Cache is invalidated when traces are recalculated or verification completes
 * - Cache is cleared when navigating to a new step
 * 
 * Events:
 * - Listens to: traces:calculated, verification:complete, viewModeToggle:modeChanged, stepViewer:stepChanged
 * - Emits: analysis:updated
 * 
 * @class AnalysisContentRenderer
 */

import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { ICONS } from '../../assets/icons.js';

export class AnalysisContentRenderer {
    constructor(domRegistry = null, eventBus = null) {
        this.domRegistry = domRegistry;
        this.eventBus = eventBus || defaultEventBus;
        
        // Analysis displays per section
        this.analysisDisplays = new Map();
        
        // Cache verification results to avoid unnecessary re-rendering
        // Structure: Map<sectionId-stepNumber, { verificationResult, timestamp, rendered }>
        this.verificationCache = new Map();
        
        // Setup event listeners for verification result updates
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for verification result updates 
     * Registers listeners for trace calculation, verification completion, and view mode changes
     * Handles cache invalidation and event emission for analysis view
     * @returns {void}
     */
    setupEventListeners() {
        // Listen for trace calculation events - verification happens after trace calculation
        this.eventBus.on('traces:calculated', (data) => {
            const { sectionId, stepNumber } = data;
            if (sectionId && stepNumber) {
                // Invalidate cache for this section when traces are recalculated
                // (verification will be recalculated too)
                this.invalidateCache(sectionId, stepNumber);
            }
        });
        
        // Listen for verification completion events 
        this.eventBus.on('verification:complete', (data) => {
            const { sectionId, stepNumber } = data;
            
            // Invalidate cache for this section
            if (sectionId && stepNumber) {
                this.invalidateCache(sectionId, stepNumber);
            }
            
            // Note: We don't automatically update the view here because we don't have access to the step object
            // The view will be updated when the user switches to analysis mode or when updateAnalysisView() is called
        });
        
        // Listen for reachability analysis completion events (, 35.20)
        this.eventBus.on('reachability:analyzed', (data) => {
            const { sectionId, stepNumber, _reachabilityResult } = data;
            
            // Enhanced logging for reachability events 
            // removed
            
            // Invalidate cache for this section
            if (sectionId && stepNumber) {
                this.invalidateCache(sectionId, stepNumber);
            }
            
            // Note: View will be updated when user switches to analysis mode or when updateAnalysisView() is called
        });
        
        // Listen for view mode changes (, 35.20)
        this.eventBus.on('viewModeToggle:modeChanged', (data) => {
            const { mode } = data;
            if (mode === 'analysis') {
                // Analysis mode activated - reachability view will be shown/hidden automatically
            }
        });
        
        // Listen for graph content changes to trigger re-analysis 
        // Note: This is a placeholder - actual content change detection would need to be implemented
        // based on how graph content is updated in the application
        this.eventBus.on('graph:contentChanged', (data) => {
            const { sectionId, stepNumber } = data;
            console.log(`[AnalysisContentRenderer] Graph content changed for ${sectionId} (Step ${stepNumber}) - reachability will be re-analyzed`);
            // Cache will be invalidated when traces are recalculated, which triggers reachability re-analysis
        });
    }

    /**
     * Get cache key for a section 
     * Generates a unique cache key from section ID and step number
     * @param {string} sectionId - Section identifier
     * @param {number|string} stepNumber - Step number
     * @returns {string} Cache key in format 'sectionId-stepNumber'
     */
    getCacheKey(sectionId, stepNumber) {
        return `${sectionId}-${stepNumber || 'unknown'}`;
    }

    /**
     * Invalidate cache for a section 
     * Removes cached analysis display for a specific section-step combination
     * Called when verification results change or traces are recalculated
     * @param {string} sectionId - Section identifier
     * @param {number|string} stepNumber - Step number
     * @returns {void}
     */
    invalidateCache(sectionId, stepNumber) {
        const cacheKey = this.getCacheKey(sectionId, stepNumber);
        if (this.verificationCache.has(cacheKey)) {
            this.verificationCache.delete(cacheKey);
        }
    }

    /**
     * Clear all verification cache 
     * Removes all cached analysis displays
     * Called when navigating to a new step or clearing data
     * @returns {void}
     */
    clearCache() {
        this.verificationCache.clear();
    }

    /**
     * Display analysis content for a section 
     * Main entry point for displaying analysis view
     * Hides other content types and shows analysis container
     * @param {string} sectionId - Section identifier ('input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee')
     * @param {HTMLElement} container - Content container element
     * @param {Object} step - Current step object (CPEEStep instance)
     * @param {Object} options - Rendering options (currently unused)
     * @returns {void}
     */
    display(sectionId, container, step, _options = {}) {
        if (!step || !container) {
            return;
        }

        // Hide visual content
        const visualElements = container.querySelectorAll('[data-content-type="visual"]');
        visualElements.forEach(el => {
            el.classList.add('analysis-container-hidden');
        });

        // Hide raw/log/traces content
        const otherContentElements = container.querySelectorAll('[data-content-type="raw"], [data-content-type="log"], [data-content-type="traces"]');
        otherContentElements.forEach(el => {
            el.classList.add('analysis-container-hidden');
        });

        // Restore container overflow
        container.style.overflow = 'visible';

        // Get or create analysis container
        let analysisContainer = container.querySelector('[data-content-type="analysis"]');
        if (!analysisContainer) {
            analysisContainer = this.domRegistry.createElement('div');
            analysisContainer.setAttribute('data-content-type', 'analysis');
            container.style.position = 'relative';
            container.appendChild(analysisContainer);
        }

        // Ensure analysis container is visible
        analysisContainer.className = 'analysis-container';

        // Render analysis content
        this.renderAnalysisContent(sectionId, analysisContainer, step);
    }

    /**
     * Render analysis content for a section 
     * Retrieves verification results and renders analysis display
     * Handles caching, error states, and missing data gracefully
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} container - Content container
     * @param {Object} step - Current step object
     * @returns {HTMLElement|null} Analysis display container or null if rendering failed
     */
    renderAnalysisContent(sectionId, container, step) {
        if (!step || !container) {
            console.warn('[AnalysisContentRenderer] Missing step or container for analysis rendering');
            return null;
        }

        const stepNumber = step.stepNumber || 'unknown';
        const cacheKey = this.getCacheKey(sectionId, stepNumber);

        // Check cache first
        const cached = this.verificationCache.get(cacheKey);
        if (cached && cached.rendered) {
            // Check if verification result has changed
            const currentResult = step.getVerificationResult(sectionId);
            const currentReachabilityResult = step.getReachabilityResult(sectionId);
            if (currentResult && this.isSameResult(cached.verificationResult, currentResult) &&
                this.isSameReachabilityResult(cached.reachabilityResult, currentReachabilityResult)) {
                // Reuse cached display
                container.innerHTML = '';
                const clonedContent = cached.rendered.cloneNode(true);
                container.appendChild(clonedContent);
                
                // Reattach event listeners after cloning (event listeners are lost during cloneNode)
                this.reattachEventListeners(container);
                
                this.analysisDisplays.set(sectionId, container.querySelector('.analysis-content-wrapper'));
                return container.querySelector('.analysis-content-wrapper');
            } else {
                // Result changed, invalidate cache
                this.invalidateCache(sectionId, stepNumber);
            }
        }

        // Clear existing content
        container.innerHTML = '';

        // Retrieve verification results from step model
        const verificationResult = step.getVerificationResult(sectionId);
        
        // Handle null/undefined verification results gracefully 
        if (!verificationResult) {
            const message = this.renderNoVerificationMessage(container, sectionId);
            // Cache the "no verification" state
            this.verificationCache.set(cacheKey, {
                verificationResult: null,
                timestamp: Date.now(),
                rendered: message
            });
            return message;
        }

        // Handle error in verification result 
        if (verificationResult.error) {
            console.warn(`[AnalysisContentRenderer] Verification error for ${sectionId}: ${verificationResult.error}`);
            const error = this.renderErrorMessage(container, verificationResult.error);
            // Cache the error state
            this.verificationCache.set(cacheKey, {
                verificationResult: verificationResult,
                timestamp: Date.now(),
                rendered: error
            });
            return error;
        }

        // Validate verification result structure 
        if (!this.isValidVerificationResult(verificationResult)) {
            console.error(`[AnalysisContentRenderer] Invalid verification result structure for ${sectionId}:`, verificationResult);
            const error = this.renderErrorMessage(container, 'Verification result has invalid structure');
            this.verificationCache.set(cacheKey, {
                verificationResult: verificationResult,
                timestamp: Date.now(),
                rendered: error
            });
            return error;
        }

        // Create analysis-content-wrapper (styled like trace-list-wrapper)
        const analysisContentWrapper = this.domRegistry.createElement('div');
        analysisContentWrapper.className = 'analysis-content-wrapper';
        
        // Create analysis-list (styled like trace-list)
        const analysisList = this.domRegistry.createElement('div');
        analysisList.className = 'analysis-list';
        
        // Render soundness section (single collapsible panel)
        this.renderSoundnessSection(analysisList, verificationResult.soundness);
        
        // Render boundedness section (single collapsible panel)
        this.renderBoundednessSection(analysisList, verificationResult.boundedness);
        
        // Retrieve and render reachability results (, 35.21)
        const reachabilityResult = step.getReachabilityResult(sectionId);
        if (reachabilityResult) {
            this.renderReachabilitySection(analysisList, reachabilityResult);
        } else {
            // Handle missing reachability data gracefully 
            this.renderNoReachabilityMessage(analysisList, sectionId);
        }
        
        analysisContentWrapper.appendChild(analysisList);
        container.appendChild(analysisContentWrapper);
        
        // Store display reference
        this.analysisDisplays.set(sectionId, analysisContentWrapper);
        
        // Cache the rendered result (including reachability)
        this.verificationCache.set(cacheKey, {
            verificationResult: verificationResult,
            reachabilityResult: reachabilityResult,
            timestamp: Date.now(),
            rendered: analysisContentWrapper.cloneNode(true)
        });
        
        return analysisContentWrapper;
    }

    /**
     * Check if two verification results are the same 
     * Compares key properties to determine if results are identical
     * Used for cache validation to avoid unnecessary re-rendering
     * @param {Object|null} result1 - First verification result
     * @param {Object|null} result2 - Second verification result
     * @returns {boolean} True if results have the same key properties
     */
    isSameResult(result1, result2) {
        if (!result1 && !result2) {
            return true;
        }
        if (!result1 || !result2) {
            return false;
        }
        
        // Compare key properties
        return result1.sound === result2.sound &&
               result1.bounded === result2.bounded &&
               result1.traceCount === result2.traceCount &&
               result1.taskCount === result2.taskCount &&
               result1.format === result2.format &&
               result1.timestamp === result2.timestamp;
    }

    /**
     * Check if two reachability results are the same 
     * Compares key properties to determine if results are identical
     * Used for cache validation to avoid unnecessary re-rendering
     * @param {Object|null} result1 - First reachability result
     * @param {Object|null} result2 - Second reachability result
     * @returns {boolean} True if results have the same key properties
     */
    isSameReachabilityResult(result1, result2) {
        if (!result1 && !result2) {
            return true;
        }
        if (!result1 || !result2) {
            return false;
        }
        
        // Compare key properties
        const nodeClass1 = result1.nodeClassification || {};
        const nodeClass2 = result2.nodeClassification || {};
        
        return nodeClass1.usefulCount === nodeClass2.usefulCount &&
               nodeClass1.deadEndCount === nodeClass2.deadEndCount &&
               nodeClass1.unreachableCount === nodeClass2.unreachableCount &&
               result1.timestamp === result2.timestamp;
    }

    /**
     * Validate verification result structure 
     * @param {Object} verificationResult - Verification result to validate
     * @returns {boolean} True if verification result has valid structure
     */
    isValidVerificationResult(verificationResult) {
        if (!verificationResult || typeof verificationResult !== 'object') {
            return false;
        }
        
        // Check for required top-level properties
        if (typeof verificationResult.sound !== 'boolean' || typeof verificationResult.bounded !== 'boolean') {
            return false;
        }
        
        // Check for soundness and boundedness objects (should exist even if empty)
        if (!verificationResult.soundness || typeof verificationResult.soundness !== 'object') {
            return false;
        }
        
        if (!verificationResult.boundedness || typeof verificationResult.boundedness !== 'object') {
            return false;
        }
        
        // Check soundness properties
        if (typeof verificationResult.soundness.sound !== 'boolean' ||
            typeof verificationResult.soundness.optionToComplete !== 'boolean' ||
            typeof verificationResult.soundness.properCompletion !== 'boolean' ||
            typeof verificationResult.soundness.noDeadTransitions !== 'boolean') {
            return false;
        }
        
        // Check boundedness properties
        if (typeof verificationResult.boundedness.bounded !== 'boolean' ||
            typeof verificationResult.boundedness.boundedPlaces !== 'boolean' ||
            typeof verificationResult.boundedness.boundedLoops !== 'boolean' ||
            typeof verificationResult.boundedness.boundedParallelism !== 'boolean') {
            return false;
        }
        
        return true;
    }

    /**
     * Render summary section with overall status 
     * Displays verification summary with sound/bounded indicators and statistics
     * @param {HTMLElement} container - Container element
     * @param {Object} verificationResult - Verification result object
     * @throws {Error} If verificationResult is invalid
     */
    renderSummary(container, verificationResult) {
        if (!verificationResult) {
            console.error('[AnalysisContentRenderer] Cannot render summary: verificationResult is null');
            return;
        }
        const summarySection = this.domRegistry.createElement('div');
        summarySection.className = 'analysis-summary';
        
        const title = this.domRegistry.createElement('h3');
        title.className = 'analysis-section-title';
        title.textContent = 'Verification Summary';
        summarySection.appendChild(title);
        
        const statusContainer = this.domRegistry.createElement('div');
        statusContainer.className = 'verification-status-container';
        
        // Statistics
        const stats = this.domRegistry.createElement('div');
        stats.className = 'verification-stats';
        stats.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Traces:</span>
                <span class="stat-value">${verificationResult.traceCount || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tasks:</span>
                <span class="stat-value">${verificationResult.taskCount || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Format:</span>
                <span class="stat-value">${verificationResult.format || 'unknown'}</span>
            </div>
        `;
        statusContainer.appendChild(stats);
        
        summarySection.appendChild(statusContainer);
        container.appendChild(summarySection);
    }

    /**
     * Create status indicator element 
     * Creates a visual status indicator with icon, label, and optional issue badge
     * @param {string} label - Status label (e.g., 'Sound', 'Bounded')
     * @param {boolean} status - Status value (true = pass, false = fail)
     * @param {number} issueCount - Number of issues (displayed as badge if > 0)
     * @returns {HTMLElement} Status indicator element with appropriate styling
     */
    createStatusIndicator(label, status, issueCount) {
        const indicator = this.domRegistry.createElement('div');
        indicator.className = `status-indicator ${status ? 'status-pass' : 'status-fail'}`;
        
        const icon = this.domRegistry.createElement('span');
        icon.className = 'status-icon';
        icon.innerHTML = status ? ICONS.ISSUE_CLOSED : ICONS.ISSUE_OPEN;
        indicator.appendChild(icon);
        
        const labelSpan = this.domRegistry.createElement('span');
        labelSpan.className = 'status-label';
        labelSpan.textContent = label;
        indicator.appendChild(labelSpan);
        
        if (issueCount > 0) {
            const issueBadge = this.domRegistry.createElement('span');
            issueBadge.className = 'issue-badge';
            issueBadge.textContent = `${issueCount} issue${issueCount !== 1 ? 's' : ''}`;
            indicator.appendChild(issueBadge);
        }
        
        return indicator;
    }

    /**
     * Create status indicator element without icon (for expandable sections)
     * Creates a visual status indicator with label, but no checkmark icon or issue badge
     * @param {string} label - Status label (e.g., 'Sound', 'Bounded')
     * @param {boolean} status - Status value (true = pass, false = fail)
     * @param {number} _issueCount - Number of issues (not displayed, kept for API compatibility)
     * @returns {HTMLElement} Status indicator element with appropriate styling (no icon)
     */
    createStatusIndicatorWithoutIcon(label, status, _issueCount) {
        const indicator = this.domRegistry.createElement('div');
        indicator.className = `status-indicator ${status ? 'status-pass' : 'status-fail'}`;
        
        const labelSpan = this.domRegistry.createElement('span');
        labelSpan.className = 'status-label';
        labelSpan.textContent = label;
        indicator.appendChild(labelSpan);
        
        // Issue badge removed - not displayed in status indicator
        
        return indicator;
    }

    /**
     * Render soundness section with collapsible functionality
     * @param {HTMLElement} container - Container element
     * @param {Object} soundnessResult - Soundness verification result
     */
    renderSoundnessSection(container, soundnessResult) {
        if (!soundnessResult) {
            return;
        }
        
        const soundnessSection = this.domRegistry.createElement('div');
        soundnessSection.className = 'soundness-section trace-item';
        
        // Create trace-header structure (matching trace items)
        const traceHeader = this.domRegistry.createElement('div');
        traceHeader.className = 'trace-header';
        traceHeader.setAttribute('role', 'button');
        traceHeader.setAttribute('tabindex', '0');
        traceHeader.setAttribute('aria-expanded', 'false');
        
        // Add expand button (matching trace-expand-btn)
        const expandBtn = this.domRegistry.createElement('button');
        expandBtn.className = 'trace-expand-btn';
        expandBtn.setAttribute('aria-label', 'Toggle soundness details');
        expandBtn.setAttribute('aria-expanded', 'false');
        expandBtn.innerHTML = ICONS.EXPAND_TRACE;
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSection(soundnessSection);
        });
        traceHeader.appendChild(expandBtn);
        
        // Create clickable status indicator (the green box) without icon
        const statusIndicator = this.createStatusIndicatorWithoutIcon(
            soundnessResult.sound ? 'Sound' : 'Not Sound',
            soundnessResult.sound,
            soundnessResult.issues?.length || 0
        );
        // Make status indicator only as wide as its content (not flex: 1)
        statusIndicator.classList.add('analysis-status-indicator');
        traceHeader.appendChild(statusIndicator);
        
        // Create collapsible content (initially hidden) - matching trace-details structure
        const content = this.domRegistry.createElement('div');
        content.className = 'trace-details analysis-section-content collapsed';
        // Dynamic maxHeight will be set by toggleSection
        
        // Create enumeration list for soundness properties
        const soundnessList = this.domRegistry.createElement('ul');
        soundnessList.className = 'analysis-property-list';
        
        // Option to Complete
        const tracesReachingEnd = soundnessResult.tracesReachingEnd || 0;
        const tracesNotReachingEnd = soundnessResult.tracesNotReachingEnd || 0;
        
        const optionToCompleteItem = this.domRegistry.createElement('li');
        optionToCompleteItem.className = 'analysis-property-item';
        optionToCompleteItem.innerHTML = `<strong>Option to Complete</strong>`;
        
        const optionToCompleteDetails = this.domRegistry.createElement('ul');
        optionToCompleteDetails.className = 'analysis-property-details';
        
        const reachingEndItem = this.domRegistry.createElement('li');
        reachingEndItem.innerHTML = `- ${tracesReachingEnd} traces that reach the end node(s)`;
        optionToCompleteDetails.appendChild(reachingEndItem);
        
        const notReachingEndItem = this.domRegistry.createElement('li');
        if (tracesNotReachingEnd > 0) {
            notReachingEndItem.className = 'reachability-dead-end';
        }
        notReachingEndItem.innerHTML = `- ${tracesNotReachingEnd} traces that don't reach the end node(s)`;
        optionToCompleteDetails.appendChild(notReachingEndItem);
        
        if (tracesNotReachingEnd > 0 && soundnessResult.incompleteTraces) {
            const tracesInfo = soundnessResult.incompleteTraces
                .filter(t => t.reason.includes('Empty trace') || t.reason.includes('not complete'))
                .map(t => `Trace ${t.traceIndex}: ${t.reason}`)
                .join(', ');
            if (tracesInfo) {
                const detailsItem = this.domRegistry.createElement('li');
                detailsItem.className = 'analysis-property-detail-item';
                detailsItem.innerHTML = `<strong>Incomplete Traces:</strong> ${tracesInfo}`;
                optionToCompleteDetails.appendChild(detailsItem);
            }
        }
        
        optionToCompleteItem.appendChild(optionToCompleteDetails);
        soundnessList.appendChild(optionToCompleteItem);
        
        // Proper Completion
        const tracesEndingProperly = soundnessResult.tracesEndingProperly || 0;
        const tracesNotEndingProperly = soundnessResult.tracesNotEndingProperly || 0;
        
        const properCompletionItem = this.domRegistry.createElement('li');
        properCompletionItem.className = 'analysis-property-item';
        properCompletionItem.innerHTML = `<strong>Proper Completion</strong>`;
        
        const properCompletionDetails = this.domRegistry.createElement('ul');
        properCompletionDetails.className = 'analysis-property-details';
        
        const endingProperlyItem = this.domRegistry.createElement('li');
        endingProperlyItem.innerHTML = `- ${tracesEndingProperly} traces that end without residual tasks`;
        properCompletionDetails.appendChild(endingProperlyItem);
        
        const notEndingProperlyItem = this.domRegistry.createElement('li');
        if (tracesNotEndingProperly > 0) {
            notEndingProperlyItem.className = 'reachability-dead-end';
        }
        notEndingProperlyItem.innerHTML = `- ${tracesNotEndingProperly} traces that don't end without residual tasks`;
        properCompletionDetails.appendChild(notEndingProperlyItem);
        
        if (tracesNotEndingProperly > 0 && soundnessResult.incompleteTraces) {
            const tracesInfo = soundnessResult.incompleteTraces
                .filter(t => t.reason.includes('invalid tasks') || t.reason.includes('proper completion'))
                .map(t => `Trace ${t.traceIndex}: ${t.reason}`)
                .join(', ');
            if (tracesInfo) {
                const detailsItem = this.domRegistry.createElement('li');
                detailsItem.className = 'analysis-property-detail-item';
                detailsItem.innerHTML = `<strong>Invalid Traces:</strong> ${tracesInfo}`;
                properCompletionDetails.appendChild(detailsItem);
            }
        }
        
        properCompletionItem.appendChild(properCompletionDetails);
        soundnessList.appendChild(properCompletionItem);
        
        // Dead Transitions
        const tasksAppearing = soundnessResult.tasksAppearingInTraces || 0;
        const tasksNotAppearing = soundnessResult.tasksNotAppearingInTraces || 0;
        
        const deadTransitionsItem = this.domRegistry.createElement('li');
        deadTransitionsItem.className = 'analysis-property-item';
        deadTransitionsItem.innerHTML = `<strong>Dead Transitions</strong>`;
        
        const deadTransitionsDetails = this.domRegistry.createElement('ul');
        deadTransitionsDetails.className = 'analysis-property-details';
        
        const appearingItem = this.domRegistry.createElement('li');
        appearingItem.innerHTML = `- ${tasksAppearing} tasks that appear in at least one trace`;
        deadTransitionsDetails.appendChild(appearingItem);
        
        const notAppearingItem = this.domRegistry.createElement('li');
        if (tasksNotAppearing > 0) {
            notAppearingItem.className = 'reachability-dead-end';
        }
        notAppearingItem.innerHTML = `- ${tasksNotAppearing} tasks that don't appear in at least one trace`;
        deadTransitionsDetails.appendChild(notAppearingItem);
        
        if (tasksNotAppearing > 0 && soundnessResult.deadTasks && soundnessResult.deadTasks.length > 0) {
            const detailsItem = this.domRegistry.createElement('li');
            detailsItem.className = 'analysis-property-detail-item';
            detailsItem.innerHTML = `<strong>Dead Tasks:</strong> ${soundnessResult.deadTasks.join(', ')}`;
            deadTransitionsDetails.appendChild(detailsItem);
        }
        
        deadTransitionsItem.appendChild(deadTransitionsDetails);
        soundnessList.appendChild(deadTransitionsItem);
        
        content.appendChild(soundnessList);
        
        // Add toggle functionality to header
        traceHeader.addEventListener('click', () => this.toggleSection(soundnessSection));
        traceHeader.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleSection(soundnessSection);
            }
        });
        
        soundnessSection.appendChild(traceHeader);
        soundnessSection.appendChild(content);
        container.appendChild(soundnessSection);
    }

    /**
     * Render boundedness section with collapsible functionality 
     * Displays three boundedness properties: Bounded Places, Bounded Loops, Bounded Parallelism
     * Includes collapsible detail sections for unbounded places and max tokens
     * @param {HTMLElement} container - Container element
     * @param {Object} boundednessResult - Boundedness verification result
     * @returns {void}
     */
    renderBoundednessSection(container, boundednessResult) {
        if (!boundednessResult) {
            console.warn('[AnalysisContentRenderer] Cannot render boundedness section: boundednessResult is null');
            return;
        }
        
        const boundednessSection = this.domRegistry.createElement('div');
        boundednessSection.className = 'boundedness-section trace-item';
        
        // Create trace-header structure (matching trace items)
        const traceHeader = this.domRegistry.createElement('div');
        traceHeader.className = 'trace-header';
        traceHeader.setAttribute('role', 'button');
        traceHeader.setAttribute('tabindex', '0');
        traceHeader.setAttribute('aria-expanded', 'false');
        
        // Add expand button (matching trace-expand-btn)
        const expandBtn = this.domRegistry.createElement('button');
        expandBtn.className = 'trace-expand-btn';
        expandBtn.setAttribute('aria-label', 'Toggle boundedness details');
        expandBtn.setAttribute('aria-expanded', 'false');
        expandBtn.innerHTML = ICONS.EXPAND_TRACE;
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSection(boundednessSection);
        });
        traceHeader.appendChild(expandBtn);
        
        // Create clickable status indicator (the green box) without icon - same format as Sound
        const statusIndicator = this.createStatusIndicatorWithoutIcon(
            boundednessResult.bounded ? 'Bounded' : 'Not Bounded',
            boundednessResult.bounded,
            boundednessResult.issues?.length || 0
        );
        // Make status indicator only as wide as its content (not flex: 1)
        statusIndicator.classList.add('analysis-status-indicator');
        traceHeader.appendChild(statusIndicator);
        
        // Create collapsible content (initially hidden) - matching trace-details structure
        const content = this.domRegistry.createElement('div');
        content.className = 'trace-details analysis-section-content collapsed';
        // Dynamic maxHeight will be set by toggleSection
        
        // Create enumeration list for boundedness properties
        const boundednessList = this.domRegistry.createElement('ul');
        boundednessList.className = 'analysis-property-list';
        
        // Bounded/Unbounded Places
        const boundedPlaceCount = boundednessResult.boundedPlaceCount || 0;
        const unboundedPlaceCount = boundednessResult.unboundedPlaceCount || 0;
        
        const placesItem = this.domRegistry.createElement('li');
        placesItem.className = 'analysis-property-item';
        placesItem.innerHTML = `<strong>Places</strong>`;
        
        const placesDetails = this.domRegistry.createElement('ul');
        placesDetails.className = 'analysis-property-details';
        
        const boundedItem = this.domRegistry.createElement('li');
        boundedItem.innerHTML = `- ${boundedPlaceCount} bounded places`;
        placesDetails.appendChild(boundedItem);
        
        const unboundedItem = this.domRegistry.createElement('li');
        if (unboundedPlaceCount > 0) {
            unboundedItem.className = 'reachability-dead-end';
        }
        unboundedItem.innerHTML = `- ${unboundedPlaceCount} unbounded places`;
        placesDetails.appendChild(unboundedItem);
        
        if (unboundedPlaceCount > 0 && boundednessResult.unboundedNodes && boundednessResult.unboundedNodes.length > 0) {
            const detailsItem = this.domRegistry.createElement('li');
            detailsItem.className = 'analysis-property-detail-item';
            detailsItem.innerHTML = `<strong>Unbounded Places:</strong> ${boundednessResult.unboundedNodes.join(', ')}`;
            placesDetails.appendChild(detailsItem);
        }
        
        placesItem.appendChild(placesDetails);
        boundednessList.appendChild(placesItem);
        
        // Bounded Loops (always true)
        const boundedLoopsItem = this.domRegistry.createElement('li');
        boundedLoopsItem.className = 'analysis-property-item';
        boundedLoopsItem.innerHTML = '<strong>Bounded Loops</strong>: Always true (because of max loop iteration limit)';
        boundednessList.appendChild(boundedLoopsItem);
        
        // Parallel Branches
        const parallelNotCreating = boundednessResult.parallelBranchesNotCreatingUnbounded || 0;
        const parallelCreating = boundednessResult.parallelBranchesCreatingUnbounded || 0;
        
        const parallelBranchesItem = this.domRegistry.createElement('li');
        parallelBranchesItem.className = 'analysis-property-item';
        parallelBranchesItem.innerHTML = `<strong>Parallel Branches</strong>`;
        
        const parallelBranchesDetails = this.domRegistry.createElement('ul');
        parallelBranchesDetails.className = 'analysis-property-details';
        
        const notCreatingItem = this.domRegistry.createElement('li');
        notCreatingItem.innerHTML = `- ${parallelNotCreating} parallel branches that don't create unbounded token accumulation`;
        parallelBranchesDetails.appendChild(notCreatingItem);
        
        const creatingItem = this.domRegistry.createElement('li');
        if (parallelCreating > 0) {
            creatingItem.className = 'reachability-dead-end';
        }
        creatingItem.innerHTML = `- ${parallelCreating} parallel branches that create unbounded token accumulation`;
        parallelBranchesDetails.appendChild(creatingItem);
        
        if (parallelCreating > 0 && boundednessResult.issues) {
            const parallelIssues = boundednessResult.issues
                .filter(issue => issue.includes('parallelism') || issue.includes('parallel'))
                .join(', ');
            if (parallelIssues) {
                const detailsItem = this.domRegistry.createElement('li');
                detailsItem.className = 'analysis-property-detail-item';
                detailsItem.innerHTML = `<strong>Parallel Issues:</strong> ${parallelIssues}`;
                parallelBranchesDetails.appendChild(detailsItem);
            }
        }
        
        parallelBranchesItem.appendChild(parallelBranchesDetails);
        boundednessList.appendChild(parallelBranchesItem);
        
        content.appendChild(boundednessList);
        
        // Add toggle functionality to header
        traceHeader.addEventListener('click', () => this.toggleSection(boundednessSection));
        traceHeader.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleSection(boundednessSection);
            }
        });
        
        boundednessSection.appendChild(traceHeader);
        boundednessSection.appendChild(content);
        container.appendChild(boundednessSection);
    }

    /**
     * Render reachability section with collapsible functionality 
     * Displays forward/backward reachability statistics, node classifications, and SCC information
     * @param {HTMLElement} container - Container element
     * @param {Object} reachabilityResult - Reachability analysis result
     * @returns {void}
     */
    renderReachabilitySection(container, reachabilityResult) {
        if (!reachabilityResult) {
            console.warn('[AnalysisContentRenderer] Cannot render reachability section: reachabilityResult is null');
            return;
        }

        // Handle error in reachability result
        if (reachabilityResult.error) {
            console.warn(`[AnalysisContentRenderer] Reachability error: ${reachabilityResult.error}`);
            return;
        }

        const reachabilitySection = this.domRegistry.createElement('div');
        reachabilitySection.className = 'reachability-section trace-item';

        // Create trace-header structure (matching trace items)
        const traceHeader = this.domRegistry.createElement('div');
        traceHeader.className = 'trace-header';
        traceHeader.setAttribute('role', 'button');
        traceHeader.setAttribute('tabindex', '0');
        traceHeader.setAttribute('aria-expanded', 'false');

        // Add expand button (matching trace-expand-btn)
        const expandBtn = this.domRegistry.createElement('button');
        expandBtn.className = 'trace-expand-btn';
        expandBtn.setAttribute('aria-label', 'Toggle reachability details');
        expandBtn.setAttribute('aria-expanded', 'false');
        expandBtn.innerHTML = ICONS.EXPAND_TRACE;
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSection(reachabilitySection);
        });
        traceHeader.appendChild(expandBtn);

        // Determine overall status: "Reachable" if all nodes are useful, "Issues Found" otherwise
        const nodeClass = reachabilityResult.nodeClassification || {};
        const totalNodes = nodeClass.usefulCount + nodeClass.deadEndCount + nodeClass.unreachableCount;
        const hasIssues = (nodeClass.deadEndCount > 0) || (nodeClass.unreachableCount > 0);
        const allReachable = totalNodes > 0 && nodeClass.unreachableCount === 0 && nodeClass.deadEndCount === 0;

        // Create clickable status indicator
        const statusIndicator = this.createStatusIndicatorWithoutIcon(
            allReachable ? 'All Tasks Reachable' : 'Reachability Issues Found',
            allReachable,
            hasIssues ? (nodeClass.deadEndCount + nodeClass.unreachableCount) : 0
        );
        statusIndicator.classList.add('analysis-status-indicator');
        traceHeader.appendChild(statusIndicator);

        // Create collapsible content (initially hidden)
        const content = this.domRegistry.createElement('div');
        content.className = 'trace-details analysis-section-content collapsed';

        // Create enumeration list for reachability properties
        const reachabilityList = this.domRegistry.createElement('ul');
        reachabilityList.className = 'analysis-property-list';

        // Forward Reachability
        const forwardReach = reachabilityResult.forwardReachability || {};
        const forwardReachableCount = forwardReach.count || 0;
        const forwardUnreachableCount = (forwardReach.unreachableNodes || []).length;
        // Coverage is a decimal (0-1), multiply by 100 to get percentage
        const forwardCoverage = forwardReach.coverage !== undefined ? (forwardReach.coverage * 100).toFixed(1) : 'N/A';

        const forwardItem = this.domRegistry.createElement('li');
        forwardItem.className = 'analysis-property-item';
        forwardItem.innerHTML = `<strong>Forward Reachability</strong>`;

        const forwardDetails = this.domRegistry.createElement('ul');
        forwardDetails.className = 'analysis-property-details';

        const forwardReachableItem = this.domRegistry.createElement('li');
        forwardReachableItem.innerHTML = `- ${forwardReachableCount} tasks reachable from start node(s)`;
        forwardDetails.appendChild(forwardReachableItem);

        if (forwardUnreachableCount > 0) {
            const forwardUnreachableItem = this.domRegistry.createElement('li');
            forwardUnreachableItem.className = 'reachability-unreachable';
            forwardUnreachableItem.innerHTML = `- ${forwardUnreachableCount} tasks not reachable from start node(s)`;
            forwardDetails.appendChild(forwardUnreachableItem);

            if (forwardReach.unreachableNodes && forwardReach.unreachableNodes.length > 0) {
                const detailsItem = this.domRegistry.createElement('li');
                detailsItem.className = 'analysis-property-detail-item';
                detailsItem.innerHTML = `<strong>Unreachable Tasks:</strong> ${forwardReach.unreachableNodes.slice(0, 20).join(', ')}${forwardReach.unreachableNodes.length > 20 ? '...' : ''}`;
                forwardDetails.appendChild(detailsItem);
            }
        }

        const forwardCoverageItem = this.domRegistry.createElement('li');
        forwardCoverageItem.innerHTML = `- Coverage: ${forwardCoverage}%`;
        forwardDetails.appendChild(forwardCoverageItem);

        forwardItem.appendChild(forwardDetails);
        reachabilityList.appendChild(forwardItem);

        // Backward Reachability
        const backwardReach = reachabilityResult.backwardReachability || {};
        const backwardReachableCount = backwardReach.count || 0;
        const backwardUnreachableCount = (backwardReach.unreachableNodes || []).length;
        // Coverage is a decimal (0-1), multiply by 100 to get percentage
        const backwardCoverage = backwardReach.coverage !== undefined ? (backwardReach.coverage * 100).toFixed(1) : 'N/A';

        const backwardItem = this.domRegistry.createElement('li');
        backwardItem.className = 'analysis-property-item';
        backwardItem.innerHTML = `<strong>Backward Reachability</strong>`;

        const backwardDetails = this.domRegistry.createElement('ul');
        backwardDetails.className = 'analysis-property-details';

        const backwardReachableItem = this.domRegistry.createElement('li');
        backwardReachableItem.innerHTML = `- ${backwardReachableCount} tasks can reach end node(s)`;
        backwardDetails.appendChild(backwardReachableItem);

        if (backwardUnreachableCount > 0) {
            const backwardUnreachableItem = this.domRegistry.createElement('li');
            backwardUnreachableItem.className = 'reachability-dead-end';
            backwardUnreachableItem.innerHTML = `- ${backwardUnreachableCount} tasks cannot reach end node(s)`;
            backwardDetails.appendChild(backwardUnreachableItem);

            if (backwardReach.unreachableNodes && backwardReach.unreachableNodes.length > 0) {
                const detailsItem = this.domRegistry.createElement('li');
                detailsItem.className = 'analysis-property-detail-item';
                detailsItem.innerHTML = `<strong>Dead-End Tasks:</strong> ${backwardReach.unreachableNodes.slice(0, 20).join(', ')}${backwardReach.unreachableNodes.length > 20 ? '...' : ''}`;
                backwardDetails.appendChild(detailsItem);
            }
        }

        const backwardCoverageItem = this.domRegistry.createElement('li');
        backwardCoverageItem.innerHTML = `- Coverage: ${backwardCoverage}%`;
        backwardDetails.appendChild(backwardCoverageItem);

        backwardItem.appendChild(backwardDetails);
        reachabilityList.appendChild(backwardItem);

        // Node Classification
        const bidirectionalReach = reachabilityResult.bidirectionalReachability || {};
        const deadEndNodes = bidirectionalReach.deadEndNodes || [];
        const unreachableNodes = bidirectionalReach.unreachableNodes || [];

        const classificationItem = this.domRegistry.createElement('li');
        classificationItem.className = 'analysis-property-item';
        classificationItem.innerHTML = `<strong>Task Classification</strong>`;

        const classificationDetails = this.domRegistry.createElement('ul');
        classificationDetails.className = 'analysis-property-details';

        const usefulItem = this.domRegistry.createElement('li');
        usefulItem.innerHTML = `- ${nodeClass.usefulCount || 0} useful tasks (reachable from start AND can reach end)`;
        classificationDetails.appendChild(usefulItem);

        if (nodeClass.deadEndCount > 0) {
            const deadEndItem = this.domRegistry.createElement('li');
            deadEndItem.className = 'reachability-dead-end';
            deadEndItem.innerHTML = `- ${nodeClass.deadEndCount} dead-end tasks (reachable from start but cannot reach end)`;
            classificationDetails.appendChild(deadEndItem);

            if (deadEndNodes.length > 0) {
                const detailsItem = this.domRegistry.createElement('li');
                detailsItem.className = 'analysis-property-detail-item';
                detailsItem.innerHTML = `<strong>Dead-End Tasks:</strong> ${deadEndNodes.slice(0, 20).join(', ')}${deadEndNodes.length > 20 ? '...' : ''}`;
                classificationDetails.appendChild(detailsItem);
            }
        }

        if (nodeClass.unreachableCount > 0) {
            const unreachableItem = this.domRegistry.createElement('li');
            unreachableItem.className = 'reachability-unreachable';
            unreachableItem.innerHTML = `- ${nodeClass.unreachableCount} unreachable tasks (not reachable from start)`;
            classificationDetails.appendChild(unreachableItem);

            if (unreachableNodes.length > 0) {
                const detailsItem = this.domRegistry.createElement('li');
                detailsItem.className = 'analysis-property-detail-item';
                detailsItem.innerHTML = `<strong>Unreachable Tasks:</strong> ${unreachableNodes.slice(0, 20).join(', ')}${unreachableNodes.length > 20 ? '...' : ''}`;
                classificationDetails.appendChild(detailsItem);
            }
        }

        // Reachability Coverage
        const coverage = reachabilityResult.bidirectionalReachability?.statistics?.reachabilityCoverage;
        if (coverage !== undefined) {
            const coverageItem = this.domRegistry.createElement('li');
            // Coverage is a decimal (0-1), multiply by 100 to get percentage
            coverageItem.innerHTML = `- Overall Reachability Coverage: ${(coverage * 100).toFixed(1)}%`;
            classificationDetails.appendChild(coverageItem);
        }

        classificationItem.appendChild(classificationDetails);
        reachabilityList.appendChild(classificationItem);

        // SCC Information (if available)
        const sccs = reachabilityResult.sccs;
        if (sccs && sccs.components && sccs.components.length > 0) {
            const sccItem = this.domRegistry.createElement('li');
            sccItem.className = 'analysis-property-item';
            sccItem.innerHTML = `<strong>Strongly Connected Components (SCCs)</strong>`;

            const sccDetails = this.domRegistry.createElement('ul');
            sccDetails.className = 'analysis-property-details';

            const sccCount = sccs.components.length;
            const cyclicComponents = sccs.cyclicComponents || [];
            const acyclicComponents = sccCount - cyclicComponents.length;
            const nodesInCycles = (sccs.nodesInCycles || []).length;

            const sccCountItem = this.domRegistry.createElement('li');
            sccCountItem.innerHTML = `- ${sccCount} strongly connected component(s) found`;
            sccDetails.appendChild(sccCountItem);

            if (cyclicComponents.length > 0) {
                const cyclicItem = this.domRegistry.createElement('li');
                cyclicItem.innerHTML = `- ${cyclicComponents.length} cyclic component(s) (contain cycles)`;
                sccDetails.appendChild(cyclicItem);
            }

            if (acyclicComponents > 0) {
                const acyclicItem = this.domRegistry.createElement('li');
                acyclicItem.innerHTML = `- ${acyclicComponents} acyclic component(s) (no cycles)`;
                sccDetails.appendChild(acyclicItem);
            }

            if (nodesInCycles > 0) {
                const cyclesItem = this.domRegistry.createElement('li');
                cyclesItem.innerHTML = `- ${nodesInCycles} node(s) involved in cycles`;
                sccDetails.appendChild(cyclesItem);
            }

            sccItem.appendChild(sccDetails);
            reachabilityList.appendChild(sccItem);
        }

        content.appendChild(reachabilityList);

        // Add toggle functionality to header
        traceHeader.addEventListener('click', () => this.toggleSection(reachabilitySection));
        traceHeader.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleSection(reachabilitySection);
            }
        });

        reachabilitySection.appendChild(traceHeader);
        reachabilitySection.appendChild(content);
        container.appendChild(reachabilitySection);
    }

    /**
     * Create property indicator element 
     * Creates a property status indicator with icon, name, and description
     * Used for individual soundness and boundedness properties
     * @param {string} propertyName - Property name (e.g., 'Option to Complete')
     * @param {boolean} status - Property status (true = pass, false = fail)
     * @param {string} description - Property description explaining what it means
     * @returns {HTMLElement} Property indicator element with pass/fail styling
     */
    createPropertyIndicator(propertyName, status, description) {
        const indicator = this.domRegistry.createElement('div');
        indicator.className = `property-indicator ${status ? 'property-pass' : 'property-fail'}`;
        
        const icon = this.domRegistry.createElement('span');
        icon.className = 'property-icon';
        icon.innerHTML = status ? ICONS.ISSUE_CLOSED : ICONS.ISSUE_OPEN;
        indicator.appendChild(icon);
        
        const content = this.domRegistry.createElement('div');
        content.className = 'property-content';
        
        const name = this.domRegistry.createElement('div');
        name.className = 'property-name';
        name.textContent = propertyName;
        content.appendChild(name);
        
        const desc = this.domRegistry.createElement('div');
        desc.className = 'property-description';
        desc.textContent = description;
        content.appendChild(desc);
        
        indicator.appendChild(content);
        
        return indicator;
    }

    /**
     * Render issues section with collapsible functionality 
     * Displays all issues and violations from soundness and boundedness checks
     * Shows issue count in header and list of issues in collapsible content
     * @param {HTMLElement} container - Container element
     * @param {Object} verificationResult - Verification result object
     * @returns {void}
     */
    renderIssuesSection(container, verificationResult) {
        const issuesSection = this.domRegistry.createElement('div');
        issuesSection.className = 'issues-section analysis-collapsible-section';
        
        // Collect all issues
        const allIssues = [
            ...(verificationResult.soundness?.issues || []),
            ...(verificationResult.boundedness?.issues || [])
        ];
        
        // Create collapsible header
        const header = this.domRegistry.createElement('div');
        header.className = 'analysis-section-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', allIssues.length > 0 ? 'true' : 'false');
        
        const title = this.domRegistry.createElement('h3');
        title.className = 'analysis-section-title';
        title.textContent = `Issues and Violations${allIssues.length > 0 ? ` (${allIssues.length})` : ''}`;
        header.appendChild(title);
        
        const toggleIcon = this.domRegistry.createElement('span');
        toggleIcon.className = 'section-toggle-icon';
        toggleIcon.innerHTML = allIssues.length > 0 ? ICONS.COLLAPSE_TRACE : ICONS.EXPAND_TRACE;
        header.appendChild(toggleIcon);
        
        // Create collapsible content
        const content = this.domRegistry.createElement('div');
        content.className = 'analysis-section-content';
        content.style.display = allIssues.length > 0 ? 'block' : 'none';
        
        const issuesList = this.domRegistry.createElement('ul');
        issuesList.className = 'issues-list';
        
        if (allIssues.length === 0) {
            const noIssues = this.domRegistry.createElement('li');
            noIssues.className = 'issue-item issue-none';
            noIssues.textContent = 'No issues found';
            issuesList.appendChild(noIssues);
        } else {
            allIssues.forEach(issue => {
                const issueItem = this.domRegistry.createElement('li');
                issueItem.className = 'issue-item';
                issueItem.textContent = issue;
                issuesList.appendChild(issueItem);
            });
        }
        
        content.appendChild(issuesList);
        
        // Add toggle functionality
        header.addEventListener('click', () => this.toggleSection(issuesSection));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleSection(issuesSection);
            }
        });
        
        issuesSection.appendChild(header);
        issuesSection.appendChild(content);
        container.appendChild(issuesSection);
    }

    /**
     * Create a collapsible details section for additional information 
     * Creates a nested collapsible section for detailed information (e.g., dead tasks, unbounded places)
     * Starts collapsed by default, can be expanded by clicking the header
     * @param {string} title - Section title (e.g., 'Dead Tasks Details')
     * @param {Function} contentFactory - Function that returns the content element to display
     * @returns {HTMLElement} Collapsible details section with header and content
     */
    createCollapsibleDetailsSection(title, contentFactory) {
        const detailsSection = this.domRegistry.createElement('div');
        detailsSection.className = 'analysis-details-section';
        
        const header = this.domRegistry.createElement('div');
        header.className = 'details-section-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        
        const headerTitle = this.domRegistry.createElement('h4');
        headerTitle.className = 'details-section-title';
        headerTitle.textContent = title;
        header.appendChild(headerTitle);
        
        const toggleIcon = this.domRegistry.createElement('span');
        toggleIcon.className = 'details-toggle-icon';
        toggleIcon.innerHTML = ICONS.EXPAND_TRACE;
        header.appendChild(toggleIcon);
        
        const content = this.domRegistry.createElement('div');
        content.className = 'details-section-content';
        content.style.display = 'none';
        content.appendChild(contentFactory());
        
        // Add toggle functionality
        header.addEventListener('click', () => this.toggleDetailsSection(detailsSection));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleDetailsSection(detailsSection);
            }
        });
        
        detailsSection.appendChild(header);
        detailsSection.appendChild(content);
        
        return detailsSection;
    }

    /**
     * Reattach event listeners to cloned content 
     * Event listeners are lost when cloning DOM nodes, so we need to reattach them
     * @param {HTMLElement} container - Container element with cloned content
     * @returns {void}
     */
    reattachEventListeners(container) {
        // Find all soundness, boundedness, and reachability sections
        const soundnessSection = container.querySelector('.soundness-section');
        const boundednessSection = container.querySelector('.boundedness-section');
        const reachabilitySection = container.querySelector('.reachability-section');
        
        // Reattach listeners for soundness section
        if (soundnessSection) {
            const traceHeader = soundnessSection.querySelector('.trace-header');
            
            if (traceHeader) {
                // Remove any existing listeners by cloning the header
                const newHeader = traceHeader.cloneNode(true);
                traceHeader.parentNode.replaceChild(newHeader, traceHeader);
                
                // Reattach event listeners
                newHeader.addEventListener('click', () => this.toggleSection(soundnessSection));
                newHeader.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.toggleSection(soundnessSection);
                    }
                });
                
                // Reattach expand button listener
                const newExpandBtn = newHeader.querySelector('.trace-expand-btn');
                if (newExpandBtn) {
                    newExpandBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleSection(soundnessSection);
                    });
                }
            }
        }
        
        // Reattach listeners for boundedness section
        if (boundednessSection) {
            const traceHeader = boundednessSection.querySelector('.trace-header');
            
            if (traceHeader) {
                // Remove any existing listeners by cloning the header
                const newHeader = traceHeader.cloneNode(true);
                traceHeader.parentNode.replaceChild(newHeader, traceHeader);
                
                // Reattach event listeners
                newHeader.addEventListener('click', () => this.toggleSection(boundednessSection));
                newHeader.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.toggleSection(boundednessSection);
                    }
                });
                
                // Reattach expand button listener
                const newExpandBtn = newHeader.querySelector('.trace-expand-btn');
                if (newExpandBtn) {
                    newExpandBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleSection(boundednessSection);
                    });
                }
            }
        }
        
        // Reattach listeners for reachability section
        if (reachabilitySection) {
            const traceHeader = reachabilitySection.querySelector('.trace-header');
            
            if (traceHeader) {
                // Remove any existing listeners by cloning the header
                const newHeader = traceHeader.cloneNode(true);
                traceHeader.parentNode.replaceChild(newHeader, traceHeader);
                
                // Reattach event listeners
                newHeader.addEventListener('click', () => this.toggleSection(reachabilitySection));
                newHeader.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.toggleSection(reachabilitySection);
                    }
                });
                
                // Reattach expand button listener
                const newExpandBtn = newHeader.querySelector('.trace-expand-btn');
                if (newExpandBtn) {
                    newExpandBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleSection(reachabilitySection);
                    });
                }
            }
        }
    }

    /**
     * Toggle section expand/collapse state 
     * Toggles the visibility of main analysis sections (soundness, boundedness, issues)
     * Updates ARIA attributes and icon state for accessibility
     * @param {HTMLElement} section - Section element to toggle
     * @returns {void}
     */
    toggleSection(section) {
        const traceHeader = section.querySelector('.trace-header');
        const expandBtn = section.querySelector('.trace-expand-btn');
        const content = section.querySelector('.analysis-section-content');
        
        if (!traceHeader || !content) {
            console.warn('[AnalysisContentRenderer] toggleSection: Missing traceHeader or content', { section, traceHeader, content });
            return;
        }
        
        const isExpanded = traceHeader.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        
        traceHeader.setAttribute('aria-expanded', newState.toString());
        if (expandBtn) {
            expandBtn.setAttribute('aria-expanded', newState.toString());
            expandBtn.innerHTML = newState ? ICONS.COLLAPSE_TRACE : ICONS.EXPAND_TRACE;
            // Ensure button remains clickable
            expandBtn.style.pointerEvents = 'auto';
        }
        // Ensure header remains clickable
        traceHeader.style.pointerEvents = 'auto';
        
        // Use max-height for expand/collapse
        if (newState) {
            // Expanding: set all properties at once
            content.classList.remove('collapsed');
            content.classList.add('expanded');
            content.style.maxHeight = '2000px';
            content.style.overflow = 'hidden';
            content.style.padding = 'var(--spacing-sm) var(--spacing-md)';
            content.style.visibility = 'visible';
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
        } else {
            // Collapsing: set all properties synchronously to hide immediately
            content.classList.remove('expanded');
            content.classList.add('collapsed');
            content.style.maxHeight = '0';
            content.style.overflow = 'hidden';
            content.style.paddingTop = '0';
            content.style.paddingBottom = '0';
            content.style.paddingLeft = 'var(--spacing-md)';
            content.style.paddingRight = 'var(--spacing-md)';
            content.style.visibility = 'hidden';
            content.style.opacity = '0';
            content.style.pointerEvents = 'none';
        }
        section.classList.toggle('collapsed', !newState);
    }

    /**
     * Toggle details section expand/collapse state 
     * Toggles the visibility of nested detail sections (dead tasks, unbounded places, etc.)
     * Updates ARIA attributes and icon state for accessibility
     * @param {HTMLElement} detailsSection - Details section element to toggle
     * @returns {void}
     */
    toggleDetailsSection(detailsSection) {
        const header = detailsSection.querySelector('.details-section-header');
        const content = detailsSection.querySelector('.details-section-content');
        const toggleIcon = header?.querySelector('.details-toggle-icon');
        
        if (!header || !content) {
            return;
        }
        
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        
        header.setAttribute('aria-expanded', newState.toString());
        content.style.display = newState ? 'block' : 'none';
        detailsSection.classList.toggle('collapsed', !newState);
        
        if (toggleIcon) {
            toggleIcon.innerHTML = newState ? ICONS.COLLAPSE_TRACE : ICONS.EXPAND_TRACE;
        }
    }

    /**
     * Hide analysis content in a container
     * @param {HTMLElement} container - Content container
     */
    hideAnalysisContent(container) {
        if (!container) {
            return;
        }

        const analysisContainer = container.querySelector('[data-content-type="analysis"]');
        if (analysisContainer) {
            analysisContainer.classList.add('analysis-container-hidden');
            analysisContainer.classList.remove('analysis-container');
        }
    }

    /**
     * Update analysis view when verification results change 
     * Invalidates cache and re-renders analysis content if currently displayed
     * Called programmatically when verification completes or results change
     * @param {string} sectionId - Section identifier
     * @param {Object} step - Current step object
     * @returns {void}
     */
    updateAnalysisView(sectionId, step) {
        if (!step) {
            console.warn('[AnalysisContentRenderer] Missing step for analysis view update');
            return;
        }

        const stepNumber = step.stepNumber || 'unknown';
        
        // Invalidate cache for this section
        this.invalidateCache(sectionId, stepNumber);
        
        // Check if analysis view is currently displayed
        const analysisDisplay = this.analysisDisplays.get(sectionId);
        if (analysisDisplay && analysisDisplay.parentElement) {
            // Re-render the analysis content
            const container = analysisDisplay.parentElement;
            this.renderAnalysisContent(sectionId, container, step);
            
            // Emit analysis view updated event 
            this.eventBus.emit('analysis:updated', {
                sectionId: sectionId,
                stepNumber: stepNumber,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Clear all analysis displays and cache 
     * Removes all analysis displays and clears verification cache
     * Called when navigating to a new step or clearing data
     * @returns {void}
     */
    clearAll() {
        this.analysisDisplays.clear();
        this.clearCache();
    }

    /**
     * Render message when no reachability results are available 
     * Handles cases where reachability analysis hasn't been performed yet or step has missing reachability data
     * @param {HTMLElement} container - Container element
     * @param {string} sectionId - Section identifier
     * @returns {HTMLElement} Message element
     */
    renderNoReachabilityMessage(container, _sectionId) {
        const message = this.domRegistry.createElement('div');
        message.className = 'analysis-no-reachability';
        
        const icon = this.domRegistry.createElement('div');
        icon.className = 'no-reachability-icon';
        icon.innerHTML = ICONS.INFO;
        message.appendChild(icon);
        
        const text = this.domRegistry.createElement('div');
        text.className = 'no-reachability-text';
        text.innerHTML = `
            <h3>No Reachability Analysis Available</h3>
            <p>Reachability analysis results are not yet available for this section.</p>
            <p>Reachability analysis is performed automatically after trace calculation. Please ensure traces have been calculated for this section.</p>
            <p>If this step has missing or incomplete reachability data, analysis may not have been performed yet.</p>
        `;
        message.appendChild(text);
        
        container.appendChild(message);
        return message;
    }

    /**
     * Render message when no verification results are available 
     * Handles cases where verification hasn't been performed yet or step has missing verification data
     * @param {HTMLElement} container - Container element
     * @param {string} sectionId - Section identifier
     * @returns {HTMLElement} Message element
     */
    renderNoVerificationMessage(container, _sectionId) {
        const message = this.domRegistry.createElement('div');
        message.className = 'analysis-no-verification';
        
        const icon = this.domRegistry.createElement('div');
        icon.className = 'no-verification-icon';
        icon.innerHTML = ICONS.INFO;
        message.appendChild(icon);
        
        const text = this.domRegistry.createElement('div');
        text.className = 'no-verification-text';
        text.innerHTML = `
            <h3>No Verification Results Available</h3>
            <p>Verification results are not yet available for this section.</p>
            <p>Verification is performed automatically after trace calculation. Please ensure traces have been calculated for this section.</p>
            <p>If this step has missing or incomplete verification data, verification may not have been performed yet.</p>
        `;
        message.appendChild(text);
        
        container.appendChild(message);
        
        return message;
    }

    /**
     * Render error message 
     * Displays appropriate message when verification failed or results are malformed
     * Provides fallback UI for error states
     * @param {HTMLElement} container - Container element
     * @param {string} errorMessage - Error message
     * @returns {HTMLElement} Error message element
     */
    renderErrorMessage(container, errorMessage) {
        console.error(`[AnalysisContentRenderer] Verification error: ${errorMessage}`);
        
        const error = this.domRegistry.createElement('div');
        error.className = 'analysis-error';
        
        const icon = this.domRegistry.createElement('div');
        icon.className = 'error-icon';
        icon.innerHTML = ICONS.ERROR;
        error.appendChild(icon);
        
        const text = this.domRegistry.createElement('div');
        text.className = 'error-text';
        const sanitizedMessage = this.sanitizeErrorMessage(errorMessage);
        text.innerHTML = `
            <h3>Verification Error</h3>
            <p>${sanitizedMessage}</p>
            <p><em>This may occur if the graph content is missing, malformed, or if verification encountered an unexpected error.</em></p>
        `;
        error.appendChild(text);
        
        container.appendChild(error);
        
        return error;
    }

    /**
     * Sanitize error message to prevent XSS 
     * @param {string} errorMessage - Error message to sanitize
     * @returns {string} Sanitized error message
     */
    sanitizeErrorMessage(errorMessage) {
        if (typeof errorMessage !== 'string') {
            return 'Unknown error occurred';
        }
        
        // Basic HTML escaping
        const div = document.createElement('div');
        div.textContent = errorMessage;
        return div.innerHTML;
    }
}

