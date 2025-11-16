/**
 * Comparison Info Box Component
 * 
 * Displays trace comparison discrepancies between CPEE and Mermaid formats.
 * Creates collapsible info boxes that show comparison results when discrepancies are detected.
 * 
 * Features:
 * - Displays summary of trace count comparison
 * - Shows detailed per-trace comparison results
 * - Highlights mismatched traces with visual indicators
 * - Expandable/collapsible details section
 * - Only displays when discrepancies are found (hidden if all traces match)
 * 
 * Display Behavior:
 * - Info boxes are only shown when comparisonResult.isMatch is false or traceCountMatch is false
 * - If all traces match perfectly, no info box is displayed
 * - Info boxes are automatically removed when traces match or when cleared
 * 
 * @class ComparisonInfoBox
 */

import { ICON_COMPARISON_INFO, ICON_WARNING_COLLAPSE, ICON_WARNING_EXPAND } from '../../assets/icons.js';

export class ComparisonInfoBox {
    /**
     * Create and display a comparison info box
     * 
     * Creates a new info box element and inserts it into the specified container.
     * The info box displays comparison results including trace counts, match statistics,
     * and detailed per-trace comparison information.
     * 
     * The info box includes:
     * - Header with icon, toggle button, and summary message
     * - Collapsible details section with:
     *   - Summary statistics
     *   - Per-trace comparison results
     *   - Sequence details for mismatched traces
     * 
     * @param {Object} comparisonResult - Comparison result from TraceComparison.compareTraces()
     *   Must contain: isMatch, traceCountMatch, matchCount, totalCount, cpeeCount, mermaidCount, discrepancies, details
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {HTMLElement} container - Container element where info box should be inserted
     * @returns {HTMLElement|null} Created info box element or null if not displayed
     * 
     * @example
     * const result = compareTraces(cpeeTraces, mermaidTraces);
     * const container = document.querySelector('.comparison-info-box-container[data-section-pair="input"]');
     * ComparisonInfoBox.createInfoBox(result, 'input', container);
     */
    static createInfoBox(comparisonResult, sectionPair, container) {
        if (!container) {
            console.error('[ComparisonInfoBox] Cannot create info box - container is null');
            return null;
        }

        if (!comparisonResult) {
            console.error('[ComparisonInfoBox] Cannot create info box - comparison result is null');
            return null;
        }

        // Remove any existing info box for this section pair
        this.removeInfoBox(container, sectionPair);

        // Only show info box if there are discrepancies
        if (comparisonResult.isMatch && comparisonResult.traceCountMatch) {
            console.log('[ComparisonInfoBox] No discrepancies found, not showing info box');
            return null;
        }

        console.log('[ComparisonInfoBox] Creating info box for section pair:', sectionPair);
        console.log('[ComparisonInfoBox] Comparison result:', comparisonResult);

        // Create info box
        const infoBox = document.createElement('div');
        infoBox.className = 'comparison-info-box';
        infoBox.setAttribute('data-section-pair', sectionPair);
        infoBox.setAttribute('role', 'alert');
        infoBox.setAttribute('aria-live', 'polite');

        // Create info icon
        const infoIcon = document.createElement('div');
        infoIcon.className = 'comparison-info-box__icon';
        infoIcon.innerHTML = ICON_COMPARISON_INFO;

        // Calculate matching and problematic counts
        const matchingCount = comparisonResult.matchCount || 0;
        const problematicCPEECount = comparisonResult.uniqueCPEETraces?.length || 0;
        const problematicMermaidCount = comparisonResult.uniqueMermaidTraces?.length || 0;

        // Create message text with matching and problematic counts
        const messageText = `Possible Conversion Error - Matching Traces: ${matchingCount} | Mismatch CPEE: ${problematicCPEECount} | Mismatch Mermaid: ${problematicMermaidCount}`;

        // Create expand/collapse button
        const toggleButton = document.createElement('button');
        toggleButton.className = 'comparison-info-box__toggle';
        toggleButton.setAttribute('aria-label', 'Expand comparison details');
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.setAttribute('type', 'button');
        toggleButton.innerHTML = ICON_WARNING_EXPAND;

        // Track collapsed state (default: collapsed)
        let isCollapsed = true;

        // Create details container (collapsed by default)
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'comparison-info-box__details';
        detailsContainer.style.display = 'none'; // Default to hidden

        // Create info header with toggle button
        const infoHeader = document.createElement('div');
        infoHeader.className = 'comparison-info-box__header';
        infoHeader.appendChild(toggleButton);
        infoHeader.appendChild(infoIcon);
        const messageSpan = document.createElement('span');
        messageSpan.className = 'comparison-info-box__message';
        messageSpan.textContent = messageText;
        infoHeader.appendChild(messageSpan);

        // Create details content
        const detailsContent = document.createElement('div');
        detailsContent.className = 'comparison-info-box__details-content';

        // Add unique CPEE traces section
        if (comparisonResult.uniqueCPEETraces && comparisonResult.uniqueCPEETraces.length > 0) {
            const uniqueCPEESection = document.createElement('div');
            uniqueCPEESection.className = 'comparison-info-box__unique-section';

            const uniqueCPEETitle = document.createElement('div');
            uniqueCPEETitle.className = 'comparison-info-box__unique-title';
            uniqueCPEETitle.textContent = `Traces unique to CPEE: ${comparisonResult.uniqueCPEETraces.length}`;
            uniqueCPEESection.appendChild(uniqueCPEETitle);

            const uniqueCPEEList = document.createElement('ul');
            uniqueCPEEList.className = 'comparison-info-box__unique-list';

            comparisonResult.uniqueCPEETraces.forEach(uniqueTrace => {
                const listItem = document.createElement('li');
                listItem.className = 'comparison-info-box__unique-item';
                const traceIndexSpan = document.createElement('span');
                traceIndexSpan.className = 'comparison-info-box__trace-index';
                traceIndexSpan.textContent = `Trace ${uniqueTrace.traceIndex + 1}: `;
                const sequenceSpan = document.createElement('span');
                sequenceSpan.className = 'comparison-info-box__sequence-display';
                sequenceSpan.textContent = `[${uniqueTrace.sequence.map(s => s || 'null').join(', ')}]`;
                listItem.appendChild(traceIndexSpan);
                listItem.appendChild(sequenceSpan);
                uniqueCPEEList.appendChild(listItem);
            });

            uniqueCPEESection.appendChild(uniqueCPEEList);
            detailsContent.appendChild(uniqueCPEESection);
        }

        // Add unique Mermaid traces section
        if (comparisonResult.uniqueMermaidTraces && comparisonResult.uniqueMermaidTraces.length > 0) {
            const uniqueMermaidSection = document.createElement('div');
            uniqueMermaidSection.className = 'comparison-info-box__unique-section';

            const uniqueMermaidTitle = document.createElement('div');
            uniqueMermaidTitle.className = 'comparison-info-box__unique-title';
            uniqueMermaidTitle.textContent = `Traces unique to Mermaid: ${comparisonResult.uniqueMermaidTraces.length}`;
            uniqueMermaidSection.appendChild(uniqueMermaidTitle);

            const uniqueMermaidList = document.createElement('ul');
            uniqueMermaidList.className = 'comparison-info-box__unique-list';

            comparisonResult.uniqueMermaidTraces.forEach(uniqueTrace => {
                const listItem = document.createElement('li');
                listItem.className = 'comparison-info-box__unique-item';
                const traceIndexSpan = document.createElement('span');
                traceIndexSpan.className = 'comparison-info-box__trace-index';
                traceIndexSpan.textContent = `Trace ${uniqueTrace.traceIndex + 1}: `;
                const sequenceSpan = document.createElement('span');
                sequenceSpan.className = 'comparison-info-box__sequence-display';
                sequenceSpan.textContent = `[${uniqueTrace.sequence.map(s => s || 'null').join(', ')}]`;
                listItem.appendChild(traceIndexSpan);
                listItem.appendChild(sequenceSpan);
                uniqueMermaidList.appendChild(listItem);
            });

            uniqueMermaidSection.appendChild(uniqueMermaidList);
            detailsContent.appendChild(uniqueMermaidSection);
        }

        detailsContainer.appendChild(detailsContent);

        // Toggle function
        const toggleExpand = () => {
            isCollapsed = !isCollapsed;

            if (isCollapsed) {
                // Collapse: hide details, show expand icon
                detailsContainer.style.display = 'none';
                toggleButton.innerHTML = ICON_WARNING_EXPAND;
                toggleButton.setAttribute('aria-label', 'Expand comparison details');
                toggleButton.setAttribute('aria-expanded', 'false');
            } else {
                // Expand: show details, show collapse icon
                detailsContainer.style.display = 'block';
                toggleButton.innerHTML = ICON_WARNING_COLLAPSE;
                toggleButton.setAttribute('aria-label', 'Collapse comparison details');
                toggleButton.setAttribute('aria-expanded', 'true');
            }
        };

        toggleButton.addEventListener('click', toggleExpand);

        // Assemble info box
        infoBox.appendChild(infoHeader);
        infoBox.appendChild(detailsContainer);

        // Insert into container (container is the comparison-info-box-container div)
        container.appendChild(infoBox);
        container.style.display = 'block';
        container.setAttribute('aria-hidden', 'false');

        console.log('[ComparisonInfoBox] Info box created and displayed');

        return infoBox;
    }

    /**
     * Remove info box for a specific section pair
     * 
     * Clears the info box content and hides the container element.
     * This is called when traces match perfectly or when clearing comparison state.
     * 
     * @param {HTMLElement} container - Container element (comparison-info-box-container)
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @returns {void}
     */
    static removeInfoBox(container, sectionPair) {
        if (!container) {
            return;
        }

        // Clear all children and hide container
        container.innerHTML = '';
        container.style.display = 'none';
        container.setAttribute('aria-hidden', 'true');
        console.log('[ComparisonInfoBox] Removed info box for section pair:', sectionPair);
    }

    /**
     * Remove all info boxes from all containers
     * 
     * Finds all comparison info box containers and clears them.
     * Used when clearing comparison state (e.g., on step navigation).
     * 
     * @param {HTMLElement} parentContainer - Parent container (section-container) to search within
     * @returns {void}
     */
    static removeAllInfoBoxes(parentContainer) {
        if (!parentContainer) {
            return;
        }

        const allContainers = parentContainer.querySelectorAll('.comparison-info-box-container');
        allContainers.forEach(container => {
            container.innerHTML = '';
            container.style.display = 'none';
            container.setAttribute('aria-hidden', 'true');
        });
        console.log('[ComparisonInfoBox] Removed all info boxes');
    }

    /**
     * Update existing info box with new comparison result
     * 
     * Removes any existing info box and creates a new one with updated comparison results.
     * This is useful when comparison results change (e.g., after trace recalculation).
     * 
     * @param {Object} comparisonResult - New comparison result from TraceComparison.compareTraces()
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {HTMLElement} container - Container element where info box should be displayed
     * @returns {HTMLElement|null} Updated info box element or null if not displayed
     */
    static updateInfoBox(comparisonResult, sectionPair, container) {
        // Remove existing and create new
        this.removeInfoBox(container, sectionPair);
        return this.createInfoBox(comparisonResult, sectionPair, container);
    }
}

