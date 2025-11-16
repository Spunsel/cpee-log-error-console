/**
 * VerificationStatusCard Component
 * Displays overall verification status with sound/bounded indicators and statistics
 */

import { ICONS } from '../../assets/icons.js';

export class VerificationStatusCard {
    /**
     * Create a verification status card element
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} verificationResult - Verification result object
     * @returns {HTMLElement} Status card element
     */
    static create(domRegistry, verificationResult) {
        const card = domRegistry.createElement('div');
        card.className = 'verification-status-card';
        
        const title = domRegistry.createElement('h3');
        title.className = 'analysis-section-title';
        title.textContent = 'Verification Summary';
        card.appendChild(title);
        
        const statusContainer = domRegistry.createElement('div');
        statusContainer.className = 'verification-status-container';
        
        // Sound status
        const soundStatus = this.createStatusIndicator(
            domRegistry,
            'Sound',
            verificationResult.sound,
            verificationResult.soundness?.issues?.length || 0
        );
        statusContainer.appendChild(soundStatus);
        
        // Bounded status
        const boundedStatus = this.createStatusIndicator(
            domRegistry,
            'Bounded',
            verificationResult.bounded,
            verificationResult.boundedness?.issues?.length || 0
        );
        statusContainer.appendChild(boundedStatus);
        
        // Statistics
        const stats = this.createStatistics(domRegistry, verificationResult);
        statusContainer.appendChild(stats);
        
        card.appendChild(statusContainer);
        
        return card;
    }

    /**
     * Create a status indicator element
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {string} label - Status label
     * @param {boolean} status - Status value (true = pass, false = fail)
     * @param {number} issueCount - Number of issues
     * @returns {HTMLElement} Status indicator element
     */
    static createStatusIndicator(domRegistry, label, status, issueCount) {
        const indicator = domRegistry.createElement('div');
        indicator.className = `status-indicator ${status ? 'status-pass' : 'status-fail'}`;
        
        const icon = domRegistry.createElement('span');
        icon.className = 'status-icon';
        icon.innerHTML = status ? ICONS.ISSUE_CLOSED : ICONS.ISSUE_OPEN;
        indicator.appendChild(icon);
        
        const labelSpan = domRegistry.createElement('span');
        labelSpan.className = 'status-label';
        labelSpan.textContent = label;
        indicator.appendChild(labelSpan);
        
        if (issueCount > 0) {
            const issueBadge = domRegistry.createElement('span');
            issueBadge.className = 'issue-badge';
            issueBadge.textContent = `${issueCount} issue${issueCount !== 1 ? 's' : ''}`;
            indicator.appendChild(issueBadge);
        }
        
        return indicator;
    }

    /**
     * Create statistics display
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} verificationResult - Verification result object
     * @returns {HTMLElement} Statistics element
     */
    static createStatistics(domRegistry, verificationResult) {
        const stats = domRegistry.createElement('div');
        stats.className = 'verification-stats';
        
        const traceCount = this.formatNumber(verificationResult.traceCount || 0);
        const taskCount = this.formatNumber(verificationResult.taskCount || 0);
        const format = verificationResult.format || 'unknown';
        
        stats.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Traces:</span>
                <span class="stat-value">${traceCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tasks:</span>
                <span class="stat-value">${taskCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Format:</span>
                <span class="stat-value">${format}</span>
            </div>
        `;
        
        return stats;
    }

    /**
     * Format number with thousand separators
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    static formatNumber(num) {
        if (typeof num !== 'number') {
            return String(num || 0);
        }
        return num.toLocaleString();
    }
}

