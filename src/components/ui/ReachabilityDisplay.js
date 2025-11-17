/**
 * ReachabilityDisplay Component
 * Main component for displaying reachability analysis results
 * Orchestrates the display of forward/backward reachability, node classifications, and SCC information
 */

import { NodeClassificationList } from './NodeClassificationList.js';
import { ReachabilityMetrics } from './ReachabilityMetrics.js';
import { SCCDisplay } from './SCCDisplay.js';
import { ICONS } from '../../assets/icons.js';

export class ReachabilityDisplay {
    /**
     * Create a reachability display section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} reachabilityResult - Reachability analysis result
     * @param {Object} options - Display options
     * @param {boolean} options.collapsible - Whether the section should be collapsible (default: true)
     * @param {boolean} options.showSCCDetails - Whether to show detailed SCC information (default: false)
     * @param {number} options.maxNodesDisplay - Maximum number of nodes to display in lists (default: 20)
     * @returns {HTMLElement} Reachability display section element
     */
    static create(domRegistry, reachabilityResult, options = {}) {
        if (!reachabilityResult) {
            return null;
        }

        // Handle error in reachability result
        if (reachabilityResult.error) {
            const errorContainer = domRegistry.createElement('div');
            errorContainer.className = 'reachability-display-error';
            errorContainer.innerHTML = `
                <span class="error-icon">${ICONS.ERROR}</span>
                <span class="error-message">Reachability analysis error: ${reachabilityResult.error}</span>
            `;
            return errorContainer;
        }

        const {
            collapsible = true,
            showSCCDetails = false,
            maxNodesDisplay = 20
        } = options;

        const reachabilitySection = domRegistry.createElement('div');
        reachabilitySection.className = 'reachability-section reachability-display';

        // Create header
        const header = this.createHeader(domRegistry, reachabilityResult, collapsible);
        reachabilitySection.appendChild(header);

        // Create content
        const content = domRegistry.createElement('div');
        content.className = 'reachability-content trace-details analysis-section-content';
        if (collapsible) {
            content.classList.add('collapsed');
        }

        // Forward Reachability
        const forwardSection = this.createForwardReachabilitySection(
            domRegistry,
            reachabilityResult.forwardReachability,
            maxNodesDisplay
        );
        content.appendChild(forwardSection);

        // Backward Reachability
        const backwardSection = this.createBackwardReachabilitySection(
            domRegistry,
            reachabilityResult.backwardReachability,
            maxNodesDisplay
        );
        content.appendChild(backwardSection);

        // Node Classification
        const classificationSection = this.createNodeClassificationSection(
            domRegistry,
            reachabilityResult,
            maxNodesDisplay
        );
        content.appendChild(classificationSection);

        // SCC Information (if available)
        if (reachabilityResult.sccs && reachabilityResult.sccs.components && reachabilityResult.sccs.components.length > 0) {
            const sccSection = this.createSCCSection(
                domRegistry,
                reachabilityResult.sccs,
                showSCCDetails
            );
            content.appendChild(sccSection);
        }

        reachabilitySection.appendChild(content);

        // Add toggle functionality if collapsible
        if (collapsible) {
            this.attachToggleFunctionality(domRegistry, header, content, reachabilitySection);
        }

        return reachabilitySection;
    }

    /**
     * Create header for reachability section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} reachabilityResult - Reachability analysis result
     * @param {boolean} collapsible - Whether the section is collapsible
     * @returns {HTMLElement} Header element
     */
    static createHeader(domRegistry, reachabilityResult, collapsible) {
        const header = domRegistry.createElement('div');
        header.className = 'trace-header';
        header.setAttribute('role', collapsible ? 'button' : 'none');
        header.setAttribute('tabindex', collapsible ? '0' : '-1');
        header.setAttribute('aria-expanded', 'false');

        if (collapsible) {
            const expandBtn = domRegistry.createElement('button');
            expandBtn.className = 'trace-expand-btn';
            expandBtn.setAttribute('aria-label', 'Toggle reachability details');
            expandBtn.setAttribute('aria-expanded', 'false');
            expandBtn.innerHTML = ICONS.EXPAND_TRACE;
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            header.appendChild(expandBtn);
        }

        // Determine overall status
        const nodeClass = reachabilityResult.nodeClassification || {};
        const totalNodes = nodeClass.usefulCount + nodeClass.deadEndCount + nodeClass.unreachableCount;
        const hasIssues = (nodeClass.deadEndCount > 0) || (nodeClass.unreachableCount > 0);
        const allReachable = totalNodes > 0 && nodeClass.unreachableCount === 0 && nodeClass.deadEndCount === 0;

        const statusIndicator = domRegistry.createElement('div');
        statusIndicator.className = `status-indicator analysis-status-indicator ${allReachable ? 'status-pass' : 'status-fail'}`;
        
        const labelSpan = domRegistry.createElement('span');
        labelSpan.className = 'status-label';
        labelSpan.textContent = allReachable ? 'All Nodes Reachable' : 'Reachability Issues Found';
        statusIndicator.appendChild(labelSpan);

        if (hasIssues) {
            const issueBadge = domRegistry.createElement('span');
            issueBadge.className = 'issue-badge';
            issueBadge.textContent = `${nodeClass.deadEndCount + nodeClass.unreachableCount} issue${(nodeClass.deadEndCount + nodeClass.unreachableCount) !== 1 ? 's' : ''}`;
            statusIndicator.appendChild(issueBadge);
        }

        header.appendChild(statusIndicator);

        return header;
    }

    /**
     * Create forward reachability section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} forwardReachability - Forward reachability data
     * @param {number} maxNodesDisplay - Maximum nodes to display
     * @returns {HTMLElement} Forward reachability section
     */
    static createForwardReachabilitySection(domRegistry, forwardReachability, maxNodesDisplay) {
        const section = domRegistry.createElement('div');
        section.className = 'reachability-subsection forward-reachability-section';

        const title = domRegistry.createElement('h4');
        title.className = 'reachability-subsection-title';
        title.textContent = 'Forward Reachability';
        title.setAttribute('title', 'Nodes reachable from start node(s)');
        section.appendChild(title);

        const metrics = ReachabilityMetrics.create(
            domRegistry,
            {
                reachableCount: forwardReachability?.count || 0,
                unreachableCount: (forwardReachability?.unreachableNodes || []).length,
                coverage: forwardReachability?.coverage
            },
            null,
            { showCoverage: true, showCounts: true }
        );
        section.appendChild(metrics);

        if (forwardReachability?.unreachableNodes && forwardReachability.unreachableNodes.length > 0) {
            const nodesList = NodeClassificationList.create(
                domRegistry,
                forwardReachability.unreachableNodes,
                'unreachable',
                { maxDisplay: maxNodesDisplay, showTooltip: true }
            );
            section.appendChild(nodesList);
        }

        return section;
    }

    /**
     * Create backward reachability section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} backwardReachability - Backward reachability data
     * @param {number} maxNodesDisplay - Maximum nodes to display
     * @returns {HTMLElement} Backward reachability section
     */
    static createBackwardReachabilitySection(domRegistry, backwardReachability, maxNodesDisplay) {
        const section = domRegistry.createElement('div');
        section.className = 'reachability-subsection backward-reachability-section';

        const title = domRegistry.createElement('h4');
        title.className = 'reachability-subsection-title';
        title.textContent = 'Backward Reachability';
        title.setAttribute('title', 'Nodes that can reach end node(s)');
        section.appendChild(title);

        const metrics = ReachabilityMetrics.create(
            domRegistry,
            {
                reachableCount: backwardReachability?.count || 0,
                unreachableCount: (backwardReachability?.unreachableNodes || []).length,
                coverage: backwardReachability?.coverage
            },
            null,
            { showCoverage: true, showCounts: true }
        );
        section.appendChild(metrics);

        if (backwardReachability?.unreachableNodes && backwardReachability.unreachableNodes.length > 0) {
            const nodesList = NodeClassificationList.create(
                domRegistry,
                backwardReachability.unreachableNodes,
                'dead-end',
                { maxDisplay: maxNodesDisplay, showTooltip: true }
            );
            section.appendChild(nodesList);
        }

        return section;
    }

    /**
     * Create node classification section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} reachabilityResult - Full reachability result
     * @param {number} maxNodesDisplay - Maximum nodes to display
     * @returns {HTMLElement} Node classification section
     */
    static createNodeClassificationSection(domRegistry, reachabilityResult, maxNodesDisplay) {
        const section = domRegistry.createElement('div');
        section.className = 'reachability-subsection node-classification-section';

        const title = domRegistry.createElement('h4');
        title.className = 'reachability-subsection-title';
        title.textContent = 'Node Classification';
        title.setAttribute('title', 'Classification of nodes based on forward and backward reachability');
        section.appendChild(title);

        const bidirectionalReach = reachabilityResult.bidirectionalReachability || {};
        const nodeClass = reachabilityResult.nodeClassification || {};

        const classificationList = domRegistry.createElement('ul');
        classificationList.className = 'analysis-property-list';

        // Useful nodes
        const usefulItem = NodeClassificationList.createItem(
            domRegistry,
            'Useful Nodes',
            nodeClass.usefulCount || 0,
            'useful',
            bidirectionalReach.usefulNodes || [],
            { showIcon: true, showNodes: true, maxDisplay: maxNodesDisplay }
        );
        usefulItem.classList.add('reachability-reachable');
        classificationList.appendChild(usefulItem);

        // Dead-end nodes
        if (nodeClass.deadEndCount > 0) {
            const deadEndItem = NodeClassificationList.createItem(
                domRegistry,
                'Dead-End Nodes',
                nodeClass.deadEndCount,
                'dead-end',
                bidirectionalReach.deadEndNodes || [],
                { showIcon: true, showNodes: true, maxDisplay: maxNodesDisplay }
            );
            deadEndItem.classList.add('reachability-dead-end');
            classificationList.appendChild(deadEndItem);
        }

        // Unreachable nodes
        if (nodeClass.unreachableCount > 0) {
            const unreachableItem = NodeClassificationList.createItem(
                domRegistry,
                'Unreachable Nodes',
                nodeClass.unreachableCount,
                'unreachable',
                bidirectionalReach.unreachableNodes || [],
                { showIcon: true, showNodes: true, maxDisplay: maxNodesDisplay }
            );
            unreachableItem.classList.add('reachability-unreachable');
            classificationList.appendChild(unreachableItem);
        }

        // Overall coverage
        const coverage = reachabilityResult.bidirectionalReachability?.statistics?.reachabilityCoverage;
        if (coverage !== undefined) {
            const coverageItem = domRegistry.createElement('li');
            coverageItem.className = 'analysis-property-item';
            coverageItem.innerHTML = `<strong>Overall Reachability Coverage:</strong> ${ReachabilityMetrics.formatCoverage(coverage)}`;
            classificationList.appendChild(coverageItem);
        }

        section.appendChild(classificationList);

        return section;
    }

    /**
     * Create SCC section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} sccs - SCC data
     * @param {boolean} showDetails - Whether to show detailed component lists
     * @returns {HTMLElement} SCC section
     */
    static createSCCSection(domRegistry, sccs, showDetails) {
        const section = domRegistry.createElement('div');
        section.className = 'reachability-subsection scc-section';

        const title = domRegistry.createElement('h4');
        title.className = 'reachability-subsection-title';
        title.textContent = 'Strongly Connected Components (SCCs)';
        title.setAttribute('title', 'Maximal subgraphs where every vertex is reachable from every other vertex');
        section.appendChild(title);

        const sccDisplay = SCCDisplay.create(domRegistry, sccs, {
            showDetails: showDetails,
            maxComponents: 10
        });
        section.appendChild(sccDisplay);

        return section;
    }

    /**
     * Attach toggle functionality to collapsible section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {HTMLElement} header - Header element
     * @param {HTMLElement} content - Content element
     * @param {HTMLElement} section - Section element
     * @returns {void}
     */
    static attachToggleFunctionality(domRegistry, header, content, section) {
        const toggleSection = () => {
            const isExpanded = content.classList.contains('expanded');
            const expandBtn = header.querySelector('.trace-expand-btn');
            
            if (isExpanded) {
                content.classList.remove('expanded');
                content.classList.add('collapsed');
                content.style.maxHeight = '0px';
                header.setAttribute('aria-expanded', 'false');
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'false');
                    expandBtn.innerHTML = ICONS.EXPAND_TRACE;
                }
            } else {
                content.classList.remove('collapsed');
                content.classList.add('expanded');
                content.style.maxHeight = `${content.scrollHeight}px`;
                header.setAttribute('aria-expanded', 'true');
                if (expandBtn) {
                    expandBtn.setAttribute('aria-expanded', 'true');
                    expandBtn.innerHTML = ICONS.COLLAPSE_TRACE;
                }
            }
        };

        header.addEventListener('click', toggleSection);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSection();
            }
        });

        const expandBtn = header.querySelector('.trace-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSection();
            });
        }
    }
}

