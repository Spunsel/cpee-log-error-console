/**
 * TracePlaybackCoordinator
 * Singleton coordinator for trace auto-play and highlighting functionality
 * 
 * Responsibilities:
 * - Manage trace auto-play state (play/pause, current task, interval)
 * - Handle trace row highlighting
 * - Coordinate with CrossGraphHighlightCoordinator for cross-graph highlighting
 * - Emit events for UI updates
 */

import { eventBus as defaultEventBus } from '../../core/EventBus.js';
import { ICONS } from '../../assets/icons.js';

// Singleton instance
let instance = null;

export class TracePlaybackCoordinator {
    /**
     * Get singleton instance
     * @param {Object} eventBus - Event bus instance (only used on first call)
     * @returns {TracePlaybackCoordinator}
     */
    static getInstance(eventBus = null) {
        if (!instance) {
            instance = new TracePlaybackCoordinator(eventBus || defaultEventBus);
        }
        return instance;
    }

    /**
     * Reset singleton instance (useful for testing)
     */
    static resetInstance() {
        if (instance) {
            instance.stopAutoPlay();
            instance.clearAllHighlights();
        }
        instance = null;
    }

    /**
     * Private constructor - use getInstance() instead
     * @param {Object} eventBus - Event bus instance
     */
    constructor(eventBus) {
        if (instance) {
            return instance;
        }

        this.eventBus = eventBus;

        // Auto-play state
        this.autoPlayState = {
            isPlaying: false,
            currentTraceKey: null, // Format: "sectionId:traceNumber"
            currentTaskIndex: 0,
            intervalId: null,
            trace: null,
            sectionId: null,
            playButton: null,
            traceElement: null,
            playbackSpeed: 1000 // milliseconds between tasks
        };

        // Highlight state
        this.highlightedTaskKey = null; // Format: "sectionId:alt_id"
        this.highlightedRows = new Set();

        // Setup event listeners
        this.setupEventListeners();

        instance = this;
    }

    /**
     * Setup event listeners for step changes and highlight coordination
     */
    setupEventListeners() {
        // Listen for cross-graph highlight clear events
        this.eventBus.on('crossGraph:highlightsCleared', () => {
            this.clearAllHighlights();
        });

        // Listen for step changes to stop playback and clear highlights
        this.eventBus.on('stepViewer:stepChanged', () => {
            this.stopAutoPlay();
            this.clearAllHighlights();
        });

        this.eventBus.on('stepNavigator:stepChanged', () => {
            this.stopAutoPlay();
            this.clearAllHighlights();
        });
    }

    // ========================================
    // AUTO-PLAY FUNCTIONALITY
    // ========================================

    /**
     * Toggle auto-play for a trace
     * @param {string} sectionId - Section identifier
     * @param {number} traceNumber - Trace number (1-based)
     * @param {Object} trace - Trace object with path array
     * @param {HTMLElement} playBtn - Play button element
     * @param {HTMLElement} traceElement - The trace item element containing the table
     */
    toggleAutoPlay(sectionId, traceNumber, trace, playBtn, traceElement) {
        const traceKey = `${sectionId}:${traceNumber}`;

        // If this trace is already playing, stop it
        if (this.autoPlayState.isPlaying && this.autoPlayState.currentTraceKey === traceKey) {
            this.stopAutoPlay();
            return;
        }

        // If a different trace is playing, stop it first
        if (this.autoPlayState.isPlaying) {
            this.stopAutoPlay();
        }

        // Start auto-play for this trace
        this.startAutoPlay(sectionId, traceNumber, trace, playBtn, traceElement);
    }

    /**
     * Start auto-play for a trace
     * @param {string} sectionId - Section identifier
     * @param {number} traceNumber - Trace number (1-based)
     * @param {Object} trace - Trace object with path array
     * @param {HTMLElement} playBtn - Play button element
     * @param {HTMLElement} traceElement - The trace item element containing the table
     */
    startAutoPlay(sectionId, traceNumber, trace, playBtn, traceElement) {
        if (!trace.path || trace.path.length === 0) {
            return;
        }

        const traceKey = `${sectionId}:${traceNumber}`;

        // Update state
        this.autoPlayState = {
            ...this.autoPlayState,
            isPlaying: true,
            currentTraceKey: traceKey,
            currentTaskIndex: 0,
            intervalId: null,
            trace: trace,
            sectionId: sectionId,
            playButton: playBtn,
            traceElement: traceElement
        };

        // Update button to show pause icon
        playBtn.innerHTML = ICONS.PAUSE_TRACE;
        playBtn.setAttribute('aria-label', 'Pause auto-play');
        playBtn.title = 'Pause auto-play';
        playBtn.classList.add('playing');

        // Highlight the first task immediately
        this.playCurrentTask();

        // Start interval for subsequent tasks
        this.autoPlayState.intervalId = setInterval(() => {
            this.playNextTask();
        }, this.autoPlayState.playbackSpeed);

        // Emit playback started event
        this.eventBus.emit('trace:playback:started', {
            sectionId,
            traceNumber,
            totalTasks: trace.path.length
        });
    }

    /**
     * Stop auto-play
     */
    stopAutoPlay() {
        if (this.autoPlayState.intervalId) {
            clearInterval(this.autoPlayState.intervalId);
        }

        // Reset button to play icon
        if (this.autoPlayState.playButton) {
            this.autoPlayState.playButton.innerHTML = ICONS.PLAY_TRACE;
            this.autoPlayState.playButton.setAttribute('aria-label', 'Auto-play trace');
            this.autoPlayState.playButton.title = 'Auto-play trace (1 second per task)';
            this.autoPlayState.playButton.classList.remove('playing');
        }

        const wasPlaying = this.autoPlayState.isPlaying;

        // Reset state
        this.autoPlayState = {
            isPlaying: false,
            currentTraceKey: null,
            currentTaskIndex: 0,
            intervalId: null,
            trace: null,
            sectionId: null,
            playButton: null,
            traceElement: null,
            playbackSpeed: this.autoPlayState.playbackSpeed // Preserve speed setting
        };

        // Emit playback stopped event
        if (wasPlaying) {
            this.eventBus.emit('trace:playback:stopped');
        }
    }

    /**
     * Highlight the current task in auto-play
     */
    playCurrentTask() {
        const { trace, sectionId, currentTaskIndex, traceElement } = this.autoPlayState;

        if (!trace || !trace.path || currentTaskIndex >= trace.path.length) {
            return;
        }

        const task = trace.path[currentTaskIndex];

        // Clear previous highlights first
        this.clearAllHighlights();
        this.eventBus.emit('trace:highlight:clear');

        // Emit highlight event for cross-graph highlighting
        const sourceFormat = this.getSectionFormat(sectionId);
        this.eventBus.emit('trace:highlight:task', {
            taskId: task.id,
            altId: task.alt_id,
            taskLabel: task.task,
            sourceFormat: sourceFormat,
            sectionId: sectionId
        });

        // Highlight only the specific row at the current index in this trace's table
        this.highlightAutoPlayRow(traceElement, currentTaskIndex);

        // Emit progress event
        this.eventBus.emit('trace:playback:progress', {
            currentIndex: currentTaskIndex,
            totalTasks: trace.path.length,
            task: task
        });
    }

    /**
     * Move to the next task in auto-play
     */
    playNextTask() {
        const { trace } = this.autoPlayState;

        if (!trace || !trace.path) {
            this.stopAutoPlay();
            return;
        }

        // Increment task index
        this.autoPlayState.currentTaskIndex++;

        // Check if we've reached the end
        if (this.autoPlayState.currentTaskIndex >= trace.path.length) {
            this.stopAutoPlay();
            return;
        }

        // Highlight the current task
        this.playCurrentTask();
    }

    /**
     * Set playback speed
     * @param {number} speedMs - Milliseconds between tasks
     */
    setPlaybackSpeed(speedMs) {
        this.autoPlayState.playbackSpeed = speedMs;

        // If currently playing, restart interval with new speed
        if (this.autoPlayState.isPlaying && this.autoPlayState.intervalId) {
            clearInterval(this.autoPlayState.intervalId);
            this.autoPlayState.intervalId = setInterval(() => {
                this.playNextTask();
            }, speedMs);
        }
    }

    /**
     * Get current playback state
     * @returns {Object} Current playback state
     */
    getPlaybackState() {
        return {
            isPlaying: this.autoPlayState.isPlaying,
            currentTraceKey: this.autoPlayState.currentTraceKey,
            currentTaskIndex: this.autoPlayState.currentTaskIndex,
            totalTasks: this.autoPlayState.trace?.path?.length || 0,
            playbackSpeed: this.autoPlayState.playbackSpeed
        };
    }

    /**
     * Check if a specific trace is currently playing
     * @param {string} sectionId - Section identifier
     * @param {number} traceNumber - Trace number
     * @returns {boolean}
     */
    isTracePlaying(sectionId, traceNumber) {
        const traceKey = `${sectionId}:${traceNumber}`;
        return this.autoPlayState.isPlaying && this.autoPlayState.currentTraceKey === traceKey;
    }

    // ========================================
    // HIGHLIGHT FUNCTIONALITY
    // ========================================

    /**
     * Handle click on trace row for highlighting
     * @param {string} sectionId - Section identifier
     * @param {Object} task - Task object with id, alt_id, task properties
     * @param {HTMLElement} row - The table row element
     */
    handleRowClick(sectionId, task, row) {
        // Use alt_id for visual row matching, id for task mapping lookup
        const visualKey = task.alt_id || task.id;
        const taskKey = `${sectionId}:${visualKey}`;

        // If clicking the same task, toggle off
        if (this.highlightedTaskKey === taskKey) {
            this.clearAllHighlights();
            this.eventBus.emit('trace:highlight:clear');
            return;
        }

        // Clear previous highlights
        this.clearAllHighlights();

        // Set new highlight
        this.highlightedTaskKey = taskKey;
        row.classList.add('trace-row-highlighted');
        this.highlightedRows.add(row);

        // Find and highlight all matching rows (same task in other traces)
        this.highlightMatchingRows(sectionId, visualKey, row);

        // Emit event for cross-graph highlighting
        const sourceFormat = this.getSectionFormat(sectionId);
        this.eventBus.emit('trace:highlight:task', {
            taskId: task.id,
            altId: task.alt_id,
            taskLabel: task.task,
            sourceFormat: sourceFormat,
            sectionId: sectionId
        });
    }

    /**
     * Highlight all matching rows with the same alt_id across all traces in a section
     * @param {string} sectionId - Section identifier
     * @param {string} altId - The alt_id to match
     * @param {HTMLElement} clickedRow - The originally clicked row (already highlighted)
     */
    highlightMatchingRows(sectionId, altId, clickedRow) {
        const sectionContainer = document.getElementById(sectionId);
        if (!sectionContainer) {
            return;
        }

        const allRows = sectionContainer.querySelectorAll('.traces-table tbody tr');
        allRows.forEach(row => {
            if (row === clickedRow) {
                return; // Skip the clicked row, already highlighted
            }

            const rowAltId = row.getAttribute('data-task-alt-id');
            if (rowAltId === altId) {
                row.classList.add('trace-row-highlighted');
                this.highlightedRows.add(row);
            }
        });
    }

    /**
     * Highlight only the specific row at the given index in the trace's table
     * Used for auto-play to highlight only the current row, not all matching rows
     * @param {HTMLElement} traceElement - The trace item element containing the table
     * @param {number} rowIndex - The index of the row to highlight (0-based)
     */
    highlightAutoPlayRow(traceElement, rowIndex) {
        if (!traceElement) {
            return;
        }

        const rows = traceElement.querySelectorAll('.traces-table tbody tr');

        if (rowIndex >= 0 && rowIndex < rows.length) {
            const row = rows[rowIndex];
            row.classList.add('trace-row-highlighted');
            this.highlightedRows.add(row);

            const altId = row.getAttribute('data-task-alt-id');
            this.highlightedTaskKey = `autoplay:${rowIndex}:${altId}`;
        }
    }

    /**
     * Clear all trace row highlights
     */
    clearAllHighlights() {
        this.highlightedTaskKey = null;
        this.highlightedRows.forEach(row => {
            row.classList.remove('trace-row-highlighted');
        });
        this.highlightedRows.clear();
    }

    /**
     * Get the currently highlighted task key
     * @returns {string|null}
     */
    getHighlightedTaskKey() {
        return this.highlightedTaskKey;
    }

    /**
     * Check if any rows are currently highlighted
     * @returns {boolean}
     */
    hasHighlights() {
        return this.highlightedRows.size > 0;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Get the format identifier for a section
     * @param {string} sectionId - Section identifier
     * @returns {string} Format identifier for cross-graph highlighting
     */
    getSectionFormat(sectionId) {
        const formatMap = {
            'input-cpee': 'input-cpee',
            'input-intermediate': 'input-intermediate',
            'output-cpee': 'output-cpee',
            'output-intermediate': 'output-intermediate'
        };
        return formatMap[sectionId] || sectionId;
    }
}

// Export singleton getter as default
export default TracePlaybackCoordinator;

