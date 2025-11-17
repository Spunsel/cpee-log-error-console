/**
 * SCCDisplay Component
 * Displays strongly connected components (SCCs) information
 * Used for showing cycle detection and SCC analysis results
 */

import { ICONS } from '../../assets/icons.js';

export class SCCDisplay {
    /**
     * Create an SCC display element
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} sccData - SCC data object
     * @param {Array<Array<string>>} sccData.components - Array of SCC components (each component is an array of node IDs)
     * @param {Array<Array<string>>} sccData.cyclicComponents - Array of cyclic components
     * @param {Array<string>} sccData.nodesInCycles - Array of node IDs that are in cycles
     * @param {Array<string>} sccData.acyclicNodes - Array of node IDs that are not in cycles
     * @param {Object} options - Display options
     * @param {boolean} options.showDetails - Whether to show detailed component lists (default: false)
     * @param {number} options.maxComponents - Maximum number of components to display (default: 10)
     * @returns {HTMLElement} SCC display element
     */
    static create(domRegistry, sccData, options = {}) {
        const { showDetails = false, maxComponents = 10 } = options;
        
        if (!sccData || !sccData.components || sccData.components.length === 0) {
            const emptyMessage = domRegistry.createElement('div');
            emptyMessage.className = 'scc-display-empty';
            emptyMessage.textContent = 'No strongly connected components found';
            return emptyMessage;
        }
        
        const sccContainer = domRegistry.createElement('div');
        sccContainer.className = 'scc-display';
        
        // Summary statistics
        const summary = this.createSummary(domRegistry, sccData);
        sccContainer.appendChild(summary);
        
        // Detailed component lists (if requested)
        if (showDetails) {
            const details = this.createDetails(domRegistry, sccData, maxComponents);
            sccContainer.appendChild(details);
        }
        
        return sccContainer;
    }

    /**
     * Create summary statistics for SCCs
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} sccData - SCC data object
     * @returns {HTMLElement} Summary element
     */
    static createSummary(domRegistry, sccData) {
        const summary = domRegistry.createElement('div');
        summary.className = 'scc-display-summary';
        
        const components = sccData.components || [];
        const cyclicComponents = sccData.cyclicComponents || [];
        const acyclicComponents = components.length - cyclicComponents.length;
        const nodesInCycles = (sccData.nodesInCycles || []).length;
        
        const statsList = domRegistry.createElement('ul');
        statsList.className = 'scc-stats-list';
        
        // Total SCCs
        const totalItem = domRegistry.createElement('li');
        totalItem.className = 'scc-stat-item';
        totalItem.innerHTML = `<strong>Total SCCs:</strong> ${components.length}`;
        statsList.appendChild(totalItem);
        
        // Cyclic components
        if (cyclicComponents.length > 0) {
            const cyclicItem = domRegistry.createElement('li');
            cyclicItem.className = 'scc-stat-item scc-stat-cyclic';
            cyclicItem.innerHTML = `<strong>Cyclic Components:</strong> ${cyclicComponents.length} (contain cycles)`;
            statsList.appendChild(cyclicItem);
        }
        
        // Acyclic components
        if (acyclicComponents > 0) {
            const acyclicItem = domRegistry.createElement('li');
            acyclicItem.className = 'scc-stat-item scc-stat-acyclic';
            acyclicItem.innerHTML = `<strong>Acyclic Components:</strong> ${acyclicComponents} (no cycles)`;
            statsList.appendChild(acyclicItem);
        }
        
        // Nodes in cycles
        if (nodesInCycles > 0) {
            const nodesItem = domRegistry.createElement('li');
            nodesItem.className = 'scc-stat-item';
            nodesItem.innerHTML = `<strong>Nodes in Cycles:</strong> ${nodesInCycles}`;
            statsList.appendChild(nodesItem);
        }
        
        summary.appendChild(statsList);
        
        return summary;
    }

    /**
     * Create detailed component lists
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} sccData - SCC data object
     * @param {number} maxComponents - Maximum number of components to display
     * @returns {HTMLElement} Details element
     */
    static createDetails(domRegistry, sccData, maxComponents = 10) {
        const details = domRegistry.createElement('div');
        details.className = 'scc-display-details';
        
        const components = sccData.components || [];
        const cyclicComponents = sccData.cyclicComponents || [];
        const displayedComponents = components.slice(0, maxComponents);
        const remainingCount = components.length - maxComponents;
        
        const componentsList = domRegistry.createElement('ul');
        componentsList.className = 'scc-components-list';
        
        displayedComponents.forEach((component, index) => {
            const isCyclic = cyclicComponents.some(cyclic => 
                cyclic.length === component.length && 
                cyclic.every(node => component.includes(node))
            );
            
            const componentItem = domRegistry.createElement('li');
            componentItem.className = `scc-component-item ${isCyclic ? 'scc-component-cyclic' : 'scc-component-acyclic'}`;
            
            const componentHeader = domRegistry.createElement('div');
            componentHeader.className = 'scc-component-header';
            
            const icon = domRegistry.createElement('span');
            icon.className = 'scc-component-icon';
            icon.innerHTML = isCyclic ? ICONS.WARNING : ICONS.ISSUE_CLOSED;
            icon.setAttribute('aria-hidden', 'true');
            componentHeader.appendChild(icon);
            
            const label = domRegistry.createElement('span');
            label.className = 'scc-component-label';
            label.textContent = `Component ${index + 1} (${component.length} node${component.length !== 1 ? 's' : ''})${isCyclic ? ' - Cyclic' : ' - Acyclic'}`;
            componentHeader.appendChild(label);
            
            componentItem.appendChild(componentHeader);
            
            const nodesList = domRegistry.createElement('div');
            nodesList.className = 'scc-component-nodes';
            nodesList.textContent = component.join(', ');
            componentItem.appendChild(nodesList);
            
            componentsList.appendChild(componentItem);
        });
        
        if (remainingCount > 0) {
            const moreItem = domRegistry.createElement('li');
            moreItem.className = 'scc-component-more';
            moreItem.textContent = `... and ${remainingCount} more component${remainingCount !== 1 ? 's' : ''}`;
            componentsList.appendChild(moreItem);
        }
        
        details.appendChild(componentsList);
        
        return details;
    }

    /**
     * Create a compact SCC summary (for inline display)
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} sccData - SCC data object
     * @returns {HTMLElement} Compact summary element
     */
    static createCompact(domRegistry, sccData) {
        const compact = domRegistry.createElement('div');
        compact.className = 'scc-display-compact';
        
        const components = sccData.components || [];
        const cyclicComponents = sccData.cyclicComponents || [];
        const nodesInCycles = (sccData.nodesInCycles || []).length;
        
        const parts = [];
        parts.push(`${components.length} SCC${components.length !== 1 ? 's' : ''}`);
        
        if (cyclicComponents.length > 0) {
            parts.push(`${cyclicComponents.length} cyclic`);
        }
        
        if (nodesInCycles > 0) {
            parts.push(`${nodesInCycles} node${nodesInCycles !== 1 ? 's' : ''} in cycles`);
        }
        
        compact.textContent = parts.join(', ');
        
        return compact;
    }
}

