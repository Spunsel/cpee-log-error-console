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
 * - "Try run in" buttons to validate mismatched traces against the other graph
 * 
 * Display Behavior:
 * - Info boxes are only shown when comparisonResult.isMatch is false or traceCountMatch is false
 * - If all traces match perfectly, no info box is displayed
 * - Info boxes are automatically removed when traces match or when cleared
 * 
 * @class ComparisonInfoBox
 */

import { ICON_COMPARISON_INFO, ICON_WARNING_COLLAPSE, ICON_WARNING_EXPAND } from '../../assets/icons.js';
import { eventBus as defaultEventBus } from '../../core/EventBus.js';

export class ComparisonInfoBox {
    // Store references to buttons for updating after validation
    static reconcileButtons = new Map();
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
        this.removeInfoBox(container);

        // Only show info box if there are discrepancies
        if (comparisonResult.isMatch && comparisonResult.traceCountMatch) {
            return null;
        }

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

        // Store button references for this section pair
        const buttonRefs = {
            cpeeToMermaid: null,
            mermaidToCPEE: null
        };
        this.reconcileButtons.set(sectionPair, buttonRefs);

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
        
        // Create message container with inline buttons
        const messageContainer = document.createElement('span');
        messageContainer.className = 'comparison-info-box__message';
        
        // "Possible Conversion Error - Matching Traces: X | "
        const prefixText = document.createElement('span');
        prefixText.textContent = `Possible Conversion Error - Matching Traces: ${matchingCount} | `;
        messageContainer.appendChild(prefixText);
        
        // "Mismatch CPEE: X" with button
        const cpeeMismatchSpan = document.createElement('span');
        cpeeMismatchSpan.className = 'comparison-info-box__mismatch-group';
        cpeeMismatchSpan.textContent = `Mismatch CPEE: ${problematicCPEECount}`;
        messageContainer.appendChild(cpeeMismatchSpan);
        
        // "Try run in Mermaid" button (only if there are CPEE mismatches)
        if (problematicCPEECount > 0) {
            const tryRunInMermaidBtn = document.createElement('button');
            tryRunInMermaidBtn.className = 'comparison-info-box__reconcile-btn';
            tryRunInMermaidBtn.setAttribute('type', 'button');
            tryRunInMermaidBtn.setAttribute('data-action', 'try-run-in-mermaid');
            tryRunInMermaidBtn.setAttribute('data-section-pair', sectionPair);
            tryRunInMermaidBtn.textContent = 'Try run in Mermaid';
            tryRunInMermaidBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                defaultEventBus.emit('traceReconciliation:tryRunInMermaid', {
                    sectionPair,
                    uniqueCPEETraces: comparisonResult.uniqueCPEETraces,
                    totalCount: problematicCPEECount
                });
            });
            buttonRefs.cpeeToMermaid = tryRunInMermaidBtn;
            messageContainer.appendChild(tryRunInMermaidBtn);
        }
        
        // Separator
        const separator1 = document.createElement('span');
        separator1.textContent = ' | ';
        messageContainer.appendChild(separator1);
        
        // "Mismatch Mermaid: X" with button
        const mermaidMismatchSpan = document.createElement('span');
        mermaidMismatchSpan.className = 'comparison-info-box__mismatch-group';
        mermaidMismatchSpan.textContent = `Mismatch Mermaid: ${problematicMermaidCount}`;
        messageContainer.appendChild(mermaidMismatchSpan);
        
        // "Try run in CPEE" button (only if there are Mermaid mismatches)
        if (problematicMermaidCount > 0) {
            const tryRunInCPEEBtn = document.createElement('button');
            tryRunInCPEEBtn.className = 'comparison-info-box__reconcile-btn';
            tryRunInCPEEBtn.setAttribute('type', 'button');
            tryRunInCPEEBtn.setAttribute('data-action', 'try-run-in-cpee');
            tryRunInCPEEBtn.setAttribute('data-section-pair', sectionPair);
            tryRunInCPEEBtn.textContent = 'Try run in CPEE';
            tryRunInCPEEBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                defaultEventBus.emit('traceReconciliation:tryRunInCPEE', {
                    sectionPair,
                    uniqueMermaidTraces: comparisonResult.uniqueMermaidTraces,
                    totalCount: problematicMermaidCount
                });
            });
            buttonRefs.mermaidToCPEE = tryRunInCPEEBtn;
            messageContainer.appendChild(tryRunInCPEEBtn);
        }
        
        infoHeader.appendChild(messageContainer);

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
    static removeInfoBox(container) {
        if (!container) {
            return;
        }

        // Clear all children and hide container
        container.innerHTML = '';
        container.style.display = 'none';
        container.setAttribute('aria-hidden', 'true');
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
        this.removeInfoBox(container);
        return this.createInfoBox(comparisonResult, sectionPair, container);
    }

    /**
     * Update reconciliation button state after validation
     * Changes button text and color based on validation results
     * 
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {string} direction - Validation direction: 'cpeeToMermaid' or 'mermaidToCPEE'
     * @param {number} validCount - Number of traces that validated successfully
     * @param {number} totalCount - Total number of traces that were validated
     */
    static updateReconcileButtonState(sectionPair, direction, validCount, totalCount) {
        const buttonRefs = this.reconcileButtons.get(sectionPair);
        if (!buttonRefs) {
            console.warn(`[ComparisonInfoBox] No button refs found for section pair: ${sectionPair}`);
            return;
        }

        const button = buttonRefs[direction];
        if (!button) {
            console.warn(`[ComparisonInfoBox] No button found for direction: ${direction} in ${sectionPair}`);
            return;
        }

        // Update button text with result
        button.textContent = `${validCount}/${totalCount}`;

        // Remove existing state classes
        button.classList.remove(
            'comparison-info-box__reconcile-btn--success',
            'comparison-info-box__reconcile-btn--partial',
            'comparison-info-box__reconcile-btn--failure'
        );

        // Add appropriate state class
        if (totalCount === 0) {
            button.classList.add('comparison-info-box__reconcile-btn--success');
        } else if (validCount === totalCount) {
            button.classList.add('comparison-info-box__reconcile-btn--success');
        } else if (validCount === 0) {
            button.classList.add('comparison-info-box__reconcile-btn--failure');
        } else {
            button.classList.add('comparison-info-box__reconcile-btn--partial');
        }

        // Disable button after validation (prevent re-running)
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
    }

    /**
     * Update the unique trace counts in the info box after reconciliation
     * 
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {number} newUniqueCPEECount - New count of unique CPEE traces
     * @param {number} newUniqueMermaidCount - New count of unique Mermaid traces
     */
    static updateUniqueCounts(sectionPair, newUniqueCPEECount, newUniqueMermaidCount) {
        const container = document.querySelector(
            `.comparison-info-box-container[data-section-pair="${sectionPair}"]`
        );
        if (!container) {
            return;
        }

        // Find the mismatch group spans and update their text
        const mismatchGroups = container.querySelectorAll('.comparison-info-box__mismatch-group');
        mismatchGroups.forEach(group => {
            const text = group.textContent;
            if (text.includes('Mismatch CPEE:')) {
                group.textContent = `Mismatch CPEE: ${newUniqueCPEECount}`;
            } else if (text.includes('Mismatch Mermaid:')) {
                group.textContent = `Mismatch Mermaid: ${newUniqueMermaidCount}`;
            }
        });
    }

    /**
     * Update the unique trace lists in the info box after reconciliation
     * Updates both the titles and the actual list content
     * 
     * @param {string} sectionPair - Section pair identifier ('input' or 'output')
     * @param {Array} uniqueCPEETraces - Array of unique CPEE trace objects
     * @param {Array} uniqueMermaidTraces - Array of unique Mermaid trace objects
     */
    static updateUniqueTraceLists(sectionPair, uniqueCPEETraces, uniqueMermaidTraces) {
        const container = document.querySelector(
            `.comparison-info-box-container[data-section-pair="${sectionPair}"]`
        );
        if (!container) {
            return;
        }

        // Find the details content container
        const detailsContent = container.querySelector('.comparison-info-box__details-content');
        if (!detailsContent) {
            return;
        }

        // Find the unique sections
        const uniqueSections = detailsContent.querySelectorAll('.comparison-info-box__unique-section');
        
        uniqueSections.forEach(section => {
            const title = section.querySelector('.comparison-info-box__unique-title');
            const list = section.querySelector('.comparison-info-box__unique-list');
            
            if (!title || !list) {
                return;
            }
            
            const titleText = title.textContent;
            const isCPEESection = titleText.includes('CPEE');
            const isMermaidSection = titleText.includes('Mermaid');
            
            if (isCPEESection) {
                // Update CPEE section
                title.textContent = `Traces unique to CPEE: ${uniqueCPEETraces.length}`;
                list.innerHTML = ''; // Clear existing items
                
                if (uniqueCPEETraces.length === 0) {
                    // Hide section if no unique traces
                    section.style.display = 'none';
                } else {
                    section.style.display = '';
                    uniqueCPEETraces.forEach(uniqueTrace => {
                        const listItem = ComparisonInfoBox.createUniqueTraceListItem(uniqueTrace);
                        list.appendChild(listItem);
                    });
                }
            } else if (isMermaidSection) {
                // Update Mermaid section
                title.textContent = `Traces unique to Mermaid: ${uniqueMermaidTraces.length}`;
                list.innerHTML = ''; // Clear existing items
                
                if (uniqueMermaidTraces.length === 0) {
                    // Hide section if no unique traces
                    section.style.display = 'none';
                } else {
                    section.style.display = '';
                    uniqueMermaidTraces.forEach(uniqueTrace => {
                        const listItem = ComparisonInfoBox.createUniqueTraceListItem(uniqueTrace);
                        list.appendChild(listItem);
                    });
                }
            }
        });
    }

    /**
     * Create a list item for a unique trace
     * 
     * @param {Object} uniqueTrace - Unique trace object with traceIndex and sequence
     * @returns {HTMLElement} List item element
     */
    static createUniqueTraceListItem(uniqueTrace) {
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
        
        return listItem;
    }
}

