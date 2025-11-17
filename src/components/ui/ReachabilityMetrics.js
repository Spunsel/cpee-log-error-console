/**
 * ReachabilityMetrics Component
 * Displays reachability statistics and metrics
 * Used for showing forward/backward reachability coverage and counts
 */

export class ReachabilityMetrics {
    /**
     * Create a reachability metrics display element
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} metrics - Metrics object
     * @param {number} metrics.reachableCount - Number of reachable nodes
     * @param {number} metrics.unreachableCount - Number of unreachable nodes
     * @param {number} metrics.coverage - Coverage percentage (0-1)
     * @param {string} label - Label for the metrics (e.g., 'Forward Reachability')
     * @param {Object} options - Display options
     * @returns {HTMLElement} Metrics display element
     */
    static create(domRegistry, metrics, label, options = {}) {
        const { showCoverage = true, showCounts = true, format = 'percentage' } = options;
        
        const metricsContainer = domRegistry.createElement('div');
        metricsContainer.className = 'reachability-metrics';
        
        if (label) {
            const labelElement = domRegistry.createElement('div');
            labelElement.className = 'reachability-metrics-label';
            labelElement.textContent = label;
            metricsContainer.appendChild(labelElement);
        }
        
        const statsContainer = domRegistry.createElement('div');
        statsContainer.className = 'reachability-metrics-stats';
        
        if (showCounts) {
            const reachableStat = this.createStatItem(
                domRegistry,
                'Reachable',
                metrics.reachableCount || 0,
                'reachable'
            );
            statsContainer.appendChild(reachableStat);
            
            if (metrics.unreachableCount > 0) {
                const unreachableStat = this.createStatItem(
                    domRegistry,
                    'Unreachable',
                    metrics.unreachableCount || 0,
                    'unreachable'
                );
                statsContainer.appendChild(unreachableStat);
            }
        }
        
        if (showCoverage && metrics.coverage !== undefined) {
            const coverageStat = this.createStatItem(
                domRegistry,
                'Coverage',
                this.formatCoverage(metrics.coverage, format),
                'coverage'
            );
            statsContainer.appendChild(coverageStat);
        }
        
        metricsContainer.appendChild(statsContainer);
        
        return metricsContainer;
    }

    /**
     * Create a single stat item
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {string} label - Stat label
     * @param {string|number} value - Stat value
     * @param {string} type - Stat type ('reachable', 'unreachable', 'coverage')
     * @returns {HTMLElement} Stat item element
     */
    static createStatItem(domRegistry, label, value, type) {
        const statItem = domRegistry.createElement('div');
        statItem.className = `reachability-stat-item reachability-stat-${type}`;
        
        const labelSpan = domRegistry.createElement('span');
        labelSpan.className = 'reachability-stat-label';
        labelSpan.textContent = `${label}:`;
        statItem.appendChild(labelSpan);
        
        const valueSpan = domRegistry.createElement('span');
        valueSpan.className = 'reachability-stat-value';
        valueSpan.textContent = value;
        statItem.appendChild(valueSpan);
        
        return statItem;
    }

    /**
     * Format coverage value
     * @param {number} coverage - Coverage value (0-100, percentage)
     * @param {string} format - Format type ('percentage' or 'decimal')
     * @returns {string} Formatted coverage string
     */
    static formatCoverage(coverage, format = 'percentage') {
        if (coverage === undefined || coverage === null) {
            return 'N/A';
        }
        
        if (format === 'percentage') {
            // Coverage is already a percentage (0-100), no need to multiply by 100
            return `${coverage.toFixed(1)}%`;
        } else {
            // Return as decimal (0-1) for decimal format
            return (coverage / 100).toFixed(3);
        }
    }

    /**
     * Create a summary metrics display
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} summary - Summary metrics object
     * @param {number} summary.totalNodes - Total number of nodes
     * @param {number} summary.usefulCount - Number of useful nodes
     * @param {number} summary.deadEndCount - Number of dead-end nodes
     * @param {number} summary.unreachableCount - Number of unreachable nodes
     * @param {number} summary.reachabilityCoverage - Overall reachability coverage
     * @returns {HTMLElement} Summary metrics element
     */
    static createSummary(domRegistry, summary) {
        const summaryContainer = domRegistry.createElement('div');
        summaryContainer.className = 'reachability-metrics-summary';
        
        const title = domRegistry.createElement('div');
        title.className = 'reachability-metrics-title';
        title.textContent = 'Reachability Summary';
        summaryContainer.appendChild(title);
        
        const statsGrid = domRegistry.createElement('div');
        statsGrid.className = 'reachability-metrics-grid';
        
        // Total nodes
        if (summary.totalNodes !== undefined) {
            statsGrid.appendChild(this.createStatItem(domRegistry, 'Total Nodes', summary.totalNodes, 'total'));
        }
        
        // Useful nodes
        if (summary.usefulCount !== undefined) {
            statsGrid.appendChild(this.createStatItem(domRegistry, 'Useful', summary.usefulCount, 'useful'));
        }
        
        // Dead-end nodes
        if (summary.deadEndCount !== undefined && summary.deadEndCount > 0) {
            statsGrid.appendChild(this.createStatItem(domRegistry, 'Dead-End', summary.deadEndCount, 'dead-end'));
        }
        
        // Unreachable nodes
        if (summary.unreachableCount !== undefined && summary.unreachableCount > 0) {
            statsGrid.appendChild(this.createStatItem(domRegistry, 'Unreachable', summary.unreachableCount, 'unreachable'));
        }
        
        // Overall coverage
        if (summary.reachabilityCoverage !== undefined) {
            statsGrid.appendChild(this.createStatItem(
                domRegistry,
                'Coverage',
                this.formatCoverage(summary.reachabilityCoverage),
                'coverage'
            ));
        }
        
        summaryContainer.appendChild(statsGrid);
        
        return summaryContainer;
    }
}

