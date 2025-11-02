/**
 * MermaidWarningHandler - Handles preprocessing warnings for Mermaid.js rendering
 * 
 * Displays warning panels when preprocessing steps have been applied to Mermaid code.
 * Provides visual feedback by displaying collapsible warning indicators (yellow boxes)
 * in the affected graph sections.
 */

import { ICON_WARNING, ICON_WARNING_EXPAND, ICON_WARNING_COLLAPSE } from '../../assets/icons.js';

export class MermaidWarningHandler {
    /**
     * Display preprocessing warning indicator (yellow box) in the graph container
     * @param {HTMLElement} container - Container element where the graph should be rendered
     * @param {Array<{description: string, lineNumbers: Array<number>}>|Array<string>} appliedSteps - Array of preprocessing step objects with description and line numbers, or legacy array of strings
     */
    static displayWarningIndicator(container, appliedSteps) {
        if (!container) {
            console.error('MermaidWarningHandler: Cannot display warning - container is null');
            return;
        }

        if (!appliedSteps || appliedSteps.length === 0) {
            return;
        }

        // Remove any existing warning indicators
        this.removeWarningIndicator(container);

        // Create warning box
        const warningBox = document.createElement('div');
        warningBox.className = 'mermaid-warning-indicator';

        // Create warning icon
        const warningIcon = document.createElement('div');
        warningIcon.className = 'mermaid-warning-indicator__icon';
        warningIcon.innerHTML = ICON_WARNING;

        // Create expand/collapse button
        const toggleButton = document.createElement('button');
        toggleButton.className = 'mermaid-warning-indicator__toggle';
        toggleButton.setAttribute('aria-label', 'Expand warning details');
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.setAttribute('type', 'button');
        toggleButton.innerHTML = ICON_WARNING_EXPAND;
        
        // Track collapsed state (default: collapsed)
        let isCollapsed = true;
        
        // Create steps list container
        const stepsListContainer = document.createElement('div');
        stepsListContainer.className = 'mermaid-warning-indicator__steps-container';
        stepsListContainer.style.display = 'none'; // Default to hidden

        // Create steps list
        const stepsList = document.createElement('ul');
        stepsList.className = 'mermaid-warning-indicator__steps';
        appliedSteps.forEach(step => {
            const listItem = document.createElement('li');
            
            // Handle both new format (object with description and lineNumbers) and legacy format (string)
            if (typeof step === 'string') {
                listItem.textContent = step;
            } else {
                const stepText = document.createTextNode(step.description);
                listItem.appendChild(stepText);
                
                // Add line numbers if available
                if (step.lineNumbers && step.lineNumbers.length > 0) {
                    const lineNumbersText = step.lineNumbers.length === 1
                        ? ` (line ${step.lineNumbers[0]})`
                        : ` (lines ${step.lineNumbers.join(', ')})`;
                    const lineNumbersSpan = document.createElement('span');
                    lineNumbersSpan.className = 'mermaid-warning-indicator__line-numbers';
                    lineNumbersSpan.textContent = lineNumbersText;
                    listItem.appendChild(lineNumbersSpan);
                }
            }
            
            stepsList.appendChild(listItem);
        });
        
        stepsListContainer.appendChild(stepsList);

        // Toggle function
        const toggleExpand = () => {
            isCollapsed = !isCollapsed;
            
            if (isCollapsed) {
                // Collapse: hide steps, show expand icon
                stepsListContainer.style.display = 'none';
                toggleButton.innerHTML = ICON_WARNING_EXPAND;
                toggleButton.setAttribute('aria-label', 'Expand warning details');
                toggleButton.setAttribute('aria-expanded', 'false');
            } else {
                // Expand: show steps, show collapse icon
                stepsListContainer.style.display = 'block';
                toggleButton.innerHTML = ICON_WARNING_COLLAPSE;
                toggleButton.setAttribute('aria-label', 'Collapse warning details');
                toggleButton.setAttribute('aria-expanded', 'true');
            }
        };
        
        toggleButton.addEventListener('click', toggleExpand);

        // Create warning header
        const warningHeader = document.createElement('div');
        warningHeader.className = 'mermaid-warning-indicator__header';
        warningHeader.appendChild(toggleButton);
        warningHeader.appendChild(warningIcon);
        warningHeader.appendChild(document.createTextNode(' Preprocessing Applied'));

        // Assemble warning box
        warningBox.appendChild(warningHeader);
        warningBox.appendChild(stepsListContainer);

        // Insert at the beginning of container
        container.insertBefore(warningBox, container.firstChild);
    }

    /**
     * Remove warning indicator from container
     * @param {HTMLElement} container - Container element
     */
    static removeWarningIndicator(container) {
        if (!container) {
            return;
        }

        const existingWarning = container.querySelector('.mermaid-warning-indicator');
        if (existingWarning) {
            existingWarning.remove();
        }
    }
}

