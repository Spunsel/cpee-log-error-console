/**
 * NodeClassificationList Component
 * Displays lists of nodes classified by reachability (useful, dead-end, unreachable)
 * Used for displaying node classifications in reachability analysis
 */

import { ICONS } from '../../assets/icons.js';

export class NodeClassificationList {
    /**
     * Create a node classification list element
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Array<string>} nodes - Array of node IDs
     * @param {string} classification - Classification type ('useful', 'dead-end', 'unreachable')
     * @param {Object} options - Display options
     * @param {number} options.maxDisplay - Maximum number of nodes to display (default: 20)
     * @param {boolean} options.showTooltip - Whether to show tooltip (default: true)
     * @returns {HTMLElement} Node classification list element
     */
    static create(domRegistry, nodes, classification, options = {}) {
        const { maxDisplay = 20, showTooltip = true } = options;
        
        const listContainer = domRegistry.createElement('div');
        listContainer.className = `node-classification-list node-classification-${classification}`;
        
        if (!nodes || nodes.length === 0) {
            const emptyMessage = domRegistry.createElement('div');
            emptyMessage.className = 'node-classification-empty';
            emptyMessage.textContent = 'No nodes';
            listContainer.appendChild(emptyMessage);
            return listContainer;
        }
        
        const displayedNodes = nodes.slice(0, maxDisplay);
        const remainingCount = nodes.length - maxDisplay;
        
        const nodeList = domRegistry.createElement('ul');
        nodeList.className = 'node-list';
        
        displayedNodes.forEach(nodeId => {
            const nodeItem = domRegistry.createElement('li');
            nodeItem.className = `node-item node-${classification}`;
            nodeItem.textContent = nodeId;
            
            if (showTooltip) {
                nodeItem.setAttribute('title', this.getTooltipText(classification, nodeId));
            }
            
            nodeList.appendChild(nodeItem);
        });
        
        if (remainingCount > 0) {
            const moreItem = domRegistry.createElement('li');
            moreItem.className = 'node-item-more';
            moreItem.textContent = `... and ${remainingCount} more`;
            nodeList.appendChild(moreItem);
        }
        
        listContainer.appendChild(nodeList);
        
        return listContainer;
    }

    /**
     * Get tooltip text for a node classification
     * @param {string} classification - Classification type
     * @param {string} nodeId - Node ID
     * @returns {string} Tooltip text
     */
    static getTooltipText(classification, nodeId) {
        const tooltips = {
            'useful': `Node "${nodeId}" is useful: reachable from start AND can reach end`,
            'dead-end': `Node "${nodeId}" is a dead-end: reachable from start but cannot reach end`,
            'unreachable': `Node "${nodeId}" is unreachable: not reachable from start node(s)`
        };
        return tooltips[classification] || `Node "${nodeId}"`;
    }

    /**
     * Create a compact node list (comma-separated)
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Array<string>} nodes - Array of node IDs
     * @param {number} maxDisplay - Maximum number of nodes to display (default: 20)
     * @returns {HTMLElement} Compact node list element
     */
    static createCompact(domRegistry, nodes, maxDisplay = 20) {
        const container = domRegistry.createElement('span');
        container.className = 'node-list-compact';
        
        if (!nodes || nodes.length === 0) {
            container.textContent = 'None';
            return container;
        }
        
        const displayedNodes = nodes.slice(0, maxDisplay);
        const remainingCount = nodes.length - maxDisplay;
        
        container.textContent = displayedNodes.join(', ');
        
        if (remainingCount > 0) {
            const moreSpan = domRegistry.createElement('span');
            moreSpan.className = 'node-list-more';
            moreSpan.textContent = `... (${remainingCount} more)`;
            container.appendChild(moreSpan);
        }
        
        return container;
    }

    /**
     * Create a node classification item with icon
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {string} label - Label text
     * @param {number} count - Node count
     * @param {string} classification - Classification type
     * @param {Array<string>} nodes - Array of node IDs (optional)
     * @param {Object} options - Display options
     * @returns {HTMLElement} Classification item element
     */
    static createItem(domRegistry, label, count, classification, nodes = [], options = {}) {
        const { showIcon = true, showNodes = true, maxDisplay = 20 } = options;
        
        const item = domRegistry.createElement('li');
        item.className = `analysis-property-item node-classification-item`;
        
        const itemContent = domRegistry.createElement('div');
        itemContent.className = `node-classification-content node-${classification}`;
        
        if (showIcon) {
            const icon = domRegistry.createElement('span');
            icon.className = 'node-classification-icon';
            icon.innerHTML = this.getIconForClassification(classification);
            icon.setAttribute('aria-hidden', 'true');
            itemContent.appendChild(icon);
        }
        
        const labelSpan = domRegistry.createElement('span');
        labelSpan.className = 'node-classification-label';
        labelSpan.textContent = `${label}: ${count}`;
        itemContent.appendChild(labelSpan);
        
        item.appendChild(itemContent);
        
        if (showNodes && nodes && nodes.length > 0) {
            const nodesContainer = domRegistry.createElement('div');
            nodesContainer.className = 'node-classification-nodes';
            const nodeList = this.createCompact(domRegistry, nodes, maxDisplay);
            nodesContainer.appendChild(nodeList);
            item.appendChild(nodesContainer);
        }
        
        return item;
    }

    /**
     * Get icon for a classification type
     * @param {string} classification - Classification type
     * @returns {string} Icon SVG markup
     */
    static getIconForClassification(classification) {
        const iconMap = {
            'useful': ICONS.ISSUE_CLOSED, // Green checkmark
            'dead-end': ICONS.WARNING, // Yellow warning
            'unreachable': ICONS.ISSUE_OPEN // Red X
        };
        return iconMap[classification] || ICONS.INFO;
    }
}

