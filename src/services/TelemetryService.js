/**
 * TelemetryService
 * Client-side telemetry collector that captures user interactions, environment data,
 * and performance metrics. Batches events and sends them to the telemetry backend.
 * 
 * Subscribes to EventBus events across the application and logs them with timestamps,
 * session context, and environment fingerprinting for recurring user identification.
 *
 * Derived metrics (time-on-step, feature discovery, instance load perf, etc.) are
 * computed client-side so the backend receives pre-aggregated, analysis-ready data.
 */

import { eventBus as defaultEventBus } from '../core/EventBus.js';
import { configManager } from '../config/ConfigManager.js';

export class TelemetryService {
    constructor(eventBus = null) {
        this.eventBus = eventBus || defaultEventBus;
        this.buffer = [];
        this.sessionId = this._generateUUID();
        this.sessionStart = Date.now();
        this.environment = null;
        this.fingerprint = null;
        this.flushTimer = null;
        this.unsubscribers = [];
        this.pageLoadTime = null;
        this._initialized = false;

        // Derived-metric tracking state
        this._lastStepView = null;           // { uuid, stepIndex, timestamp }
        this._firstInteractionRecorded = false;
        this._pendingInstanceLoads = new Map(); // uuid -> timestamp
        this._featureFlags = {
            usedTracePlayback: false,
            usedReconciliation: false,
            usedDarkMode: false,
            usedViewModeToggle: false,
            usedKeyboardNav: false,
            usedScaleChange: false,
            usedStepDropdown: false
        };
    }

    /**
     * Initialize the telemetry service: collect environment, subscribe to events, start flush timer
     */
    initialize() {
        if (this._initialized) { return; }
        this._initialized = true;

        const config = configManager.get('telemetry') || {};
        if (config.enabled === false) { return; }

        this.endpoint = config.endpoint || '/api/telemetry';
        this.batchIntervalMs = config.batchIntervalMs || 10000;

        this.environment = this._collectEnvironment();
        this.fingerprint = this._generateFingerprint();
        this.pageLoadTime = this._getPageLoadTime();

        const urlParams = this._parseUrlParams();

        this._trackEvent('session:start', {
            environment: this.environment,
            fingerprint: this.fingerprint,
            pageLoadTime: this.pageLoadTime,
            urlParams
        }, 'session');

        this._subscribeToEvents();
        this._setupLifecycleListeners();
        this._startFlushTimer();
    }

    // -- Event subscriptions --------------------------------------------------

    _subscribeToEvents() {
        const eventMap = {
            // Navigation
            'sidebar:instanceSelected': 'navigation',
            'stepViewer:stepChanged': 'navigation',
            'stepNavigator:stepChanged': 'navigation',
            'stepDropdown:stepSelected': 'navigation',
            'header:click': 'navigation',

            // View modes
            'viewModeToggle:modeChanged': 'view_mode',
            'scaleDisplay:scaleChanged': 'view_mode',

            // Traces
            'traces:calculated': 'trace',
            'traces:error': 'trace',
            'trace:playback:started': 'trace',
            'trace:playback:stopped': 'trace',
            'trace:playback:progress': 'trace',
            'trace:playback:speedChanged': 'trace',
            'traceContentRenderer:requestReRender': 'trace',

            // Comparison & Reconciliation
            'traceComparison:compared': 'comparison',
            'traceComparison:match': 'comparison',
            'traceComparison:mismatch': 'comparison',
            'traceComparison:updated': 'comparison',
            'traceReconciliation:tracesAdded': 'reconciliation',
            'traceReconciliation:complete': 'reconciliation',
            'traceReconciliation:rerunAnalysis': 'reconciliation',
            'traceReconciliation:tryRunInMermaid': 'reconciliation',
            'traceReconciliation:tryRunInCPEE': 'reconciliation',

            // Highlighting
            'trace:highlight:task': 'highlight',
            'trace:highlight:clear': 'highlight',
            'crossGraph:highlightsCleared': 'highlight',

            // Instance loading
            'instance:loaded': 'instance',
            'instance:loadFailed': 'instance',
            'instanceLoader:loadInstance': 'instance',
            'instanceLoader:viewLog': 'instance',

            // UI
            'darkMode:toggled': 'ui',
            'themeSelector:themeChanged': 'ui',
            'keyboard:arrowLeft': 'ui',
            'keyboard:arrowRight': 'ui',

            // Analysis
            'verification:complete': 'analysis',
            'reachability:analyzed': 'analysis',

            // Step display
            'step:displayed': 'navigation',
            'step:displayFailed': 'error'
        };

        for (const [eventName, category] of Object.entries(eventMap)) {
            const unsub = this.eventBus.on(eventName, (data) => {
                this._recordDerivedMetrics(eventName, data);
                this._trackEvent(eventName, this._sanitizeEventData(eventName, data), category);
            });
            this.unsubscribers.push(unsub);
        }
    }

    // -- Derived metrics ------------------------------------------------------

    _recordDerivedMetrics(eventName, data) {
        const now = Date.now();

        // Time-to-first-interaction
        if (!this._firstInteractionRecorded && !eventName.startsWith('session:')) {
            this._firstInteractionRecorded = true;
            this._trackEvent('metric:timeToFirstInteraction', {
                firstEvent: eventName,
                delayMs: now - this.sessionStart
            }, 'metric');
        }

        // Time-on-step: emit duration of previous step view when a new step is displayed
        if (eventName === 'step:displayed' || eventName === 'sidebar:instanceSelected') {
            if (this._lastStepView) {
                this._trackEvent('metric:timeOnStep', {
                    uuid: this._lastStepView.uuid,
                    stepIndex: this._lastStepView.stepIndex,
                    durationMs: now - this._lastStepView.timestamp
                }, 'metric');
            }
            if (eventName === 'step:displayed') {
                this._lastStepView = {
                    uuid: data?.uuid || null,
                    stepIndex: data?.stepIndex ?? null,
                    timestamp: now
                };
            } else {
                this._lastStepView = null;
            }
        }

        // Instance load performance
        if (eventName === 'instanceLoader:loadInstance' && data?.uuid) {
            this._pendingInstanceLoads.set(data.uuid, now);
        }
        if (eventName === 'instance:loaded' && data?.uuid) {
            const startTs = this._pendingInstanceLoads.get(data.uuid);
            if (startTs) {
                this._pendingInstanceLoads.delete(data.uuid);
                this._trackEvent('metric:instanceLoadTime', {
                    uuid: data.uuid,
                    loadMs: now - startTs,
                    steps: data.steps || null
                }, 'metric');
            }
        }
        if (eventName === 'instance:loadFailed' && data?.uuid) {
            this._pendingInstanceLoads.delete(data.uuid);
        }

        // Feature usage flags
        if (eventName.startsWith('trace:playback:')) { this._featureFlags.usedTracePlayback = true; }
        if (eventName.startsWith('traceReconciliation:')) { this._featureFlags.usedReconciliation = true; }
        if (eventName === 'darkMode:toggled') { this._featureFlags.usedDarkMode = true; }
        if (eventName === 'viewModeToggle:modeChanged') { this._featureFlags.usedViewModeToggle = true; }
        if (eventName === 'keyboard:arrowLeft' || eventName === 'keyboard:arrowRight') { this._featureFlags.usedKeyboardNav = true; }
        if (eventName === 'scaleDisplay:scaleChanged') { this._featureFlags.usedScaleChange = true; }
        if (eventName === 'stepDropdown:stepSelected') { this._featureFlags.usedStepDropdown = true; }
    }

    // -- Lifecycle listeners --------------------------------------------------

    _setupLifecycleListeners() {
        this._onVisibilityChange = () => {
            this._trackEvent('session:visibilityChange', {
                hidden: document.hidden,
                visibilityState: document.visibilityState
            }, 'session');
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);

        this._onBeforeUnload = () => {
            // Emit final time-on-step for current view
            if (this._lastStepView) {
                this._trackEvent('metric:timeOnStep', {
                    uuid: this._lastStepView.uuid,
                    stepIndex: this._lastStepView.stepIndex,
                    durationMs: Date.now() - this._lastStepView.timestamp
                }, 'metric');
                this._lastStepView = null;
            }

            this._trackEvent('metric:featureUsage', { ...this._featureFlags }, 'metric');

            this._trackEvent('session:end', {
                duration: Date.now() - this.sessionStart
            }, 'session');
            this._flush(true);
        };
        window.addEventListener('beforeunload', this._onBeforeUnload);
    }

    // -- Event tracking -------------------------------------------------------

    _trackEvent(eventName, data = null, category = 'other') {
        this.buffer.push({
            event: eventName,
            category,
            data,
            timestamp: new Date().toISOString(),
            elapsedMs: Date.now() - this.sessionStart
        });
    }

    /**
     * Extract meaningful summaries from known analysis payloads instead of
     * blindly truncating them. Unknown/generic objects still go through the
     * default size-guard logic.
     */
    _sanitizeEventData(eventName, data) {
        if (data === null || data === undefined) { return null; }
        if (typeof data !== 'object') { return data; }

        // Extract compact summaries for known heavy payloads
        if (eventName === 'verification:complete') {
            return this._extractVerificationSummary(data);
        }
        if (eventName === 'reachability:analyzed') {
            return this._extractReachabilitySummary(data);
        }
        if (eventName.startsWith('traceComparison:')) {
            return this._extractComparisonSummary(data);
        }

        return this._sanitizeGeneric(data);
    }

    _extractVerificationSummary(data) {
        const r = data.verificationResult || {};
        return {
            sectionId: data.sectionId,
            stepNumber: data.stepNumber,
            afterReconciliation: data.afterReconciliation || false,
            sound: r.sound ?? null,
            bounded: r.bounded ?? null,
            traceCount: r.traceCount ?? null,
            taskCount: r.taskCount ?? null,
            format: r.format ?? null,
            deadTaskCount: r.soundness?.deadTasks?.length ?? 0,
            unboundedPlaceCount: r.boundedness?.unboundedPlaces?.length ?? 0
        };
    }

    _extractReachabilitySummary(data) {
        const r = data.reachabilityResult || {};
        const fwd = r.forwardReachability || {};
        const bwd = r.backwardReachability || {};
        const nc = r.nodeClassification || {};
        return {
            sectionId: data.sectionId,
            stepNumber: data.stepNumber,
            afterReconciliation: data.afterReconciliation || false,
            totalNodes: r.totalNodes ?? nc.usefulCount + nc.deadEndCount + nc.unreachableCount ?? null,
            forwardReachable: fwd.count ?? null,
            forwardUnreachable: (fwd.unreachableNodes || []).length,
            forwardCoverage: fwd.coverage ?? null,
            backwardReachable: bwd.count ?? null,
            backwardUnreachable: (bwd.unreachableNodes || []).length,
            backwardCoverage: bwd.coverage ?? null,
            usefulCount: nc.usefulCount ?? null,
            deadEndCount: nc.deadEndCount ?? null,
            unreachableCount: nc.unreachableCount ?? null
        };
    }

    _extractComparisonSummary(data) {
        const cr = data.comparisonResult || {};
        return {
            sectionPair: data.sectionPair,
            stepNumber: data.stepNumber,
            reconciliationDirection: data.reconciliationDirection || null,
            matchCount: cr.matchCount ?? null,
            totalCount: cr.totalCount ?? null,
            cpeeCount: cr.cpeeCount ?? null,
            mermaidCount: cr.mermaidCount ?? null,
            isMatch: cr.isMatch ?? null,
            traceCountMatch: cr.traceCountMatch ?? null,
            problematicCount: cr.problematicCount ?? null,
            uniqueCPEECount: (cr.uniqueCPEETraces || []).length,
            uniqueMermaidCount: (cr.uniqueMermaidTraces || []).length
        };
    }

    _sanitizeGeneric(data) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            if (key === 'traces' || key === 'errorObject' || key === 'step') {
                continue;
            }
            if (value instanceof HTMLElement || value instanceof Node) {
                continue;
            }
            if (typeof value === 'function') {
                continue;
            }
            if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                try {
                    const str = JSON.stringify(value);
                    sanitized[key] = str.length > 500 ? `[truncated, ${str.length} chars]` : value;
                } catch {
                    sanitized[key] = '[non-serializable]';
                }
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    // -- URL parameter capture ------------------------------------------------

    _parseUrlParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            const result = {};
            for (const [key, value] of params.entries()) {
                result[key] = value;
            }
            return Object.keys(result).length > 0 ? result : null;
        } catch {
            return null;
        }
    }

    // -- Flushing -------------------------------------------------------------

    _startFlushTimer() {
        this.flushTimer = setInterval(() => this._flush(), this.batchIntervalMs);
    }

    _flush(useBeacon = false) {
        if (this.buffer.length === 0) { return; }

        const payload = JSON.stringify({
            sessionId: this.sessionId,
            fingerprint: this.fingerprint,
            events: this.buffer.splice(0)
        });

        if (useBeacon && navigator.sendBeacon) {
            navigator.sendBeacon(this.endpoint, new Blob([payload], { type: 'application/json' }));
            return;
        }

        fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(() => {
            // Silently discard on network failure — telemetry must never disrupt the app
        });
    }

    // -- Environment & fingerprinting -----------------------------------------

    _collectEnvironment() {
        const nav = navigator;
        const screen = window.screen;
        return {
            userAgent: nav.userAgent,
            language: nav.language,
            languages: [...(nav.languages || [])],
            platform: nav.platform,
            hardwareConcurrency: nav.hardwareConcurrency || null,
            deviceMemory: nav.deviceMemory || null,
            screenWidth: screen.width,
            screenHeight: screen.height,
            screenColorDepth: screen.colorDepth,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            referrer: document.referrer || null,
            url: window.location.href,
            cookieEnabled: nav.cookieEnabled,
            online: nav.onLine,
            touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0
        };
    }

    /**
     * Generate a simple browser fingerprint from stable attributes.
     * This is not tracking-grade (no canvas/WebGL) but sufficient to identify
     * recurring visitors for thesis evaluation purposes.
     */
    _generateFingerprint() {
        const env = this.environment;
        const raw = [
            env.userAgent,
            env.language,
            env.platform,
            env.screenWidth,
            env.screenHeight,
            env.screenColorDepth,
            env.devicePixelRatio,
            env.timezone,
            env.hardwareConcurrency
        ].join('|');
        return this._hashString(raw);
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'fp_' + Math.abs(hash).toString(36);
    }

    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    _getPageLoadTime() {
        if (typeof performance !== 'undefined' && performance.timing) {
            const t = performance.timing;
            return {
                domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
                loadComplete: t.loadEventEnd - t.navigationStart || null
            };
        }
        return null;
    }

    // -- Cleanup --------------------------------------------------------------

    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this._flush(true);
        this.unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') { unsub(); }
        });
        this.unsubscribers = [];
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        window.removeEventListener('beforeunload', this._onBeforeUnload);
        this._initialized = false;
    }
}

let _instance = null;

/**
 * Get or create the singleton TelemetryService instance.
 */
export function getTelemetryService(eventBus = null) {
    if (!_instance) {
        _instance = new TelemetryService(eventBus);
    }
    return _instance;
}
