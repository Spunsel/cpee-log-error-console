/**
 * PropertyStatusIndicator Component
 * Displays individual property status with icon, name, and description
 * Used for soundness and boundedness property indicators
 */

import { ICONS } from '../../assets/icons.js';

export class PropertyStatusIndicator {
    /**
     * Create a property status indicator element
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {string} propertyName - Property name
     * @param {boolean} status - Property status (true = pass, false = fail)
     * @param {string} description - Property description
     * @returns {HTMLElement} Property indicator element
     */
    static create(domRegistry, propertyName, status, description) {
        const indicator = domRegistry.createElement('div');
        indicator.className = `property-indicator ${status ? 'property-pass' : 'property-fail'}`;
        
        const icon = domRegistry.createElement('span');
        icon.className = 'property-icon';
        icon.innerHTML = status ? ICONS.ISSUE_CLOSED : ICONS.ISSUE_OPEN;
        indicator.appendChild(icon);
        
        const content = domRegistry.createElement('div');
        content.className = 'property-content';
        
        const name = domRegistry.createElement('div');
        name.className = 'property-name';
        name.textContent = propertyName;
        content.appendChild(name);
        
        const desc = domRegistry.createElement('div');
        desc.className = 'property-description';
        desc.textContent = description;
        content.appendChild(desc);
        
        indicator.appendChild(content);
        
        return indicator;
    }
}

