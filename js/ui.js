/**
 * CPEE Debug Console UI Manager
 * Handles all UI rendering and interactions
 */

class UI {
    /**
     * Show loading state
     * @param {string} message - Loading message
     */
    static showLoading(message = 'Loading...') {
        const stepDetails = document.getElementById('step-details');
        const stepAnalysis = document.getElementById('step-analysis');
        
        if (stepDetails) {
            stepDetails.innerHTML = `
                <div class="loading">
                    <p>${message}</p>
                    <div class="loading-spinner"></div>
                </div>
            `;
            stepDetails.classList.remove('hidden');
        }
        
        if (stepAnalysis) {
            stepAnalysis.classList.add('hidden');
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    static showError(message) {
        const stepDetails = document.getElementById('step-details');
        
        if (stepDetails) {
            stepDetails.innerHTML = `
                <div class="error-state">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button id="retry-load" class="retry-button">Try Again</button>
                </div>
            `;
            stepDetails.classList.remove('hidden');
            
            // Add retry functionality
            const retryButton = document.getElementById('retry-load');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    location.reload();
                });
            }
        }
    }

    /**
     * Display instance information and step overview
     * @param {string} uuid - Instance UUID
     * @param {Array} steps - Array of steps
     */
    static displayInstance(uuid, steps) {
        // Update instance UUID display
        const instanceUuidElement = document.getElementById('instance-uuid');
        if (instanceUuidElement) {
            instanceUuidElement.textContent = uuid;
        }

        // Update steps timeline
        UI.renderStepsTimeline(steps);

        // Update error summary
        UI.updateErrorSummary(steps);

        // Show step analysis interface
        const stepDetails = document.getElementById('step-details');
        const stepAnalysis = document.getElementById('step-analysis');
        
        if (stepDetails) {
            stepDetails.classList.add('hidden');
        }
        
        if (stepAnalysis) {
            stepAnalysis.classList.remove('hidden');
        }
    }

    /**
     * Render steps timeline in sidebar
     * @param {Array} steps - Array of steps
     */
    static renderStepsTimeline(steps) {
        const timeline = document.getElementById('steps-timeline');
        
        if (!timeline) return;

        if (steps.length === 0) {
            timeline.innerHTML = '<div class="no-steps">No steps found</div>';
            return;
        }

        const timelineHTML = steps.map(step => `
            <div class="step-item" data-step="${step.stepNumber}">
                <div class="step-number">Step ${step.stepNumber}</div>
                <div class="step-summary">
                    <div class="step-user-input">${UI.truncate(step.userInput || 'Unknown action', 30)}</div>
                    <div class="step-meta">
                        <span class="step-time">${UI.formatTime(step.timestamp)}</span>
                        <span class="step-status status-badge ${step.status}">${UI.getStatusIcon(step.status)}</span>
                    </div>
                </div>
            </div>
        `).join('');

        timeline.innerHTML = timelineHTML;

        // Add click handlers for step navigation
        timeline.querySelectorAll('.step-item').forEach(item => {
            item.addEventListener('click', () => {
                const stepNumber = parseInt(item.dataset.step);
                if (window.debugConsole) {
                    window.debugConsole.navigateToStep(stepNumber);
                }
            });
        });
    }

    /**
     * Display detailed information for a specific step
     * @param {Object} step - Step data
     * @param {number} stepNumber - Current step number
     * @param {number} totalSteps - Total number of steps
     */
    static displayStep(step, stepNumber, totalSteps) {
        // Update active step in timeline
        UI.updateActiveStep(stepNumber);

        // Update overview tab
        UI.updateOverviewTab(step);

        // Update input tab
        UI.updateInputTab(step);

        // Update output tab
        UI.updateOutputTab(step);

        // Update diff tab
        UI.updateDiffTab(step);

        console.log('Step displayed:', stepNumber);
    }

    /**
     * Update active step highlighting in timeline
     * @param {number} stepNumber - Active step number
     */
    static updateActiveStep(stepNumber) {
        const timeline = document.getElementById('steps-timeline');
        if (!timeline) return;

        // Remove active class from all steps
        timeline.querySelectorAll('.step-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to current step
        const activeStep = timeline.querySelector(`[data-step="${stepNumber}"]`);
        if (activeStep) {
            activeStep.classList.add('active');
        }
    }

    /**
     * Update overview tab content
     * @param {Object} step - Step data
     */
    static updateOverviewTab(step) {
        const userInputElement = document.getElementById('user-input');
        const llmModelElement = document.getElementById('llm-model');
        const timestampElement = document.getElementById('timestamp');
        const stepStatusElement = document.getElementById('step-status');

        if (userInputElement) {
            userInputElement.textContent = step.userInput || 'Unknown';
        }

        if (llmModelElement) {
            llmModelElement.textContent = step.llmModel || 'Unknown';
        }

        if (timestampElement) {
            timestampElement.textContent = UI.formatTimestamp(step.timestamp);
        }

        if (stepStatusElement) {
            stepStatusElement.textContent = step.status.toUpperCase();
            stepStatusElement.className = `status-badge ${step.status}`;
        }
    }

    /**
     * Update input tab content
     * @param {Object} step - Step data
     */
    static updateInputTab(step) {
        const inputCpeeElement = document.getElementById('input-cpee-tree');
        const inputMermaidElement = document.getElementById('input-mermaid');

        if (inputCpeeElement) {
            const code = inputCpeeElement.querySelector('code');
            if (code) {
                code.textContent = step.cpeeInput || 'No input CPEE tree available';
            }
        }

        if (inputMermaidElement) {
            if (step.mermaidInput) {
                UI.renderMermaidDiagram(inputMermaidElement, step.mermaidInput);
            } else {
                inputMermaidElement.innerHTML = '<p class="no-content">No input Mermaid diagram available</p>';
            }
        }
    }

    /**
     * Update output tab content
     * @param {Object} step - Step data
     */
    static updateOutputTab(step) {
        const outputCpeeElement = document.getElementById('output-cpee-tree');
        const outputMermaidElement = document.getElementById('output-mermaid');

        if (outputCpeeElement) {
            const code = outputCpeeElement.querySelector('code');
            if (code) {
                code.textContent = step.cpeeOutput || 'No output CPEE tree available';
            }
        }

        if (outputMermaidElement) {
            if (step.mermaidOutput) {
                UI.renderMermaidDiagram(outputMermaidElement, step.mermaidOutput);
            } else {
                outputMermaidElement.innerHTML = '<p class="no-content">No output Mermaid diagram available</p>';
            }
        }
    }

    /**
     * Update diff tab content
     * @param {Object} step - Step data
     */
    static updateDiffTab(step) {
        const processDiffElement = document.getElementById('process-diff');
        const detectedErrorsElement = document.getElementById('detected-errors');

        if (processDiffElement) {
            UI.renderProcessDiff(processDiffElement, step);
        }

        if (detectedErrorsElement) {
            UI.renderDetectedErrors(detectedErrorsElement, step);
        }
    }

    /**
     * Render Mermaid diagram
     * @param {HTMLElement} container - Container element
     * @param {string} mermaidCode - Mermaid diagram code
     */
    static renderMermaidDiagram(container, mermaidCode) {
        try {
            // For now, just display as code until Mermaid.js is integrated
            container.innerHTML = `
                <div class="mermaid-code">
                    <pre><code>${UI.escapeHtml(mermaidCode)}</code></pre>
                </div>
                <div class="mermaid-note">
                    <small>Note: Diagram rendering will be implemented in Phase 3</small>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<p class="error">Error rendering diagram: ${error.message}</p>`;
        }
    }

    /**
     * Render process differences
     * @param {HTMLElement} container - Container element
     * @param {Object} step - Step data
     */
    static renderProcessDiff(container, step) {
        const hasInput = step.mermaidInput;
        const hasOutput = step.mermaidOutput;

        if (!hasInput && !hasOutput) {
            container.innerHTML = '<p class="no-content">No diagrams available for comparison</p>';
            return;
        }

        container.innerHTML = `
            <div class="diff-comparison">
                <div class="diff-before">
                    <h5>Before</h5>
                    <pre><code>${UI.escapeHtml(hasInput ? step.mermaidInput : 'No input diagram')}</code></pre>
                </div>
                <div class="diff-after">
                    <h5>After</h5>
                    <pre><code>${UI.escapeHtml(hasOutput ? step.mermaidOutput : 'No output diagram')}</code></pre>
                </div>
            </div>
        `;
    }

    /**
     * Render detected errors and warnings
     * @param {HTMLElement} container - Container element
     * @param {Object} step - Step data
     */
    static renderDetectedErrors(container, step) {
        const allIssues = [
            ...step.errors.map(error => ({ type: 'error', message: error })),
            ...step.warnings.map(warning => ({ type: 'warning', message: warning }))
        ];

        if (allIssues.length === 0) {
            container.innerHTML = '<p class="success-message">✓ No issues detected in this step</p>';
            return;
        }

        const issuesHTML = allIssues.map(issue => `
            <div class="issue-item ${issue.type}">
                <span class="issue-icon">${issue.type === 'error' ? '❌' : '⚠️'}</span>
                <span class="issue-message">${UI.escapeHtml(issue.message)}</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="issues-list">
                ${issuesHTML}
            </div>
        `;
    }

    /**
     * Update error summary in sidebar
     * @param {Array} steps - Array of steps
     */
    static updateErrorSummary(steps) {
        const stats = StepAnalyzer.getStepStatistics(steps);
        
        const errorCount = document.getElementById('error-count');
        if (errorCount) {
            errorCount.innerHTML = `
                <span class="error-badge critical">${stats.totalErrors} Critical</span>
                <span class="error-badge warning">${stats.totalWarnings} Warnings</span>
            `;
        }
    }

    /**
     * Utility: Truncate text
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @returns {string} Truncated text
     */
    static truncate(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    /**
     * Utility: Format time from timestamp
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Formatted time
     */
    static formatTime(timestamp) {
        if (!timestamp) return 'Unknown';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString();
        } catch (error) {
            return 'Invalid time';
        }
    }

    /**
     * Utility: Format full timestamp
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Formatted timestamp
     */
    static formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (error) {
            return 'Invalid timestamp';
        }
    }

    /**
     * Utility: Get status icon
     * @param {string} status - Status string
     * @returns {string} Status icon
     */
    static getStatusIcon(status) {
        switch (status) {
            case 'success': return '✓';
            case 'warning': return '⚠';
            case 'error': return '✗';
            default: return '?';
        }
    }

    /**
     * Utility: Escape HTML
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
