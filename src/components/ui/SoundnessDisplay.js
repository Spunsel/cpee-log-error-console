/**
 * SoundnessDisplay Component
 * Displays soundness verification results with collapsible sections
 */

import { PropertyStatusIndicator } from './PropertyStatusIndicator.js';
import { ICONS } from '../../assets/icons.js';

export class SoundnessDisplay {
    /**
     * Create a soundness display section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} soundnessResult - Soundness verification result
     * @returns {HTMLElement} Soundness section element
     */
    static create(domRegistry, soundnessResult) {
        if (!soundnessResult) {
            return null;
        }
        
        const soundnessSection = domRegistry.createElement('div');
        soundnessSection.className = 'soundness-section analysis-collapsible-section';
        
        // Create collapsible header
        const header = domRegistry.createElement('div');
        header.className = 'analysis-section-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'true');
        
        const title = domRegistry.createElement('h3');
        title.className = 'analysis-section-title';
        title.textContent = 'Soundness Properties';
        header.appendChild(title);
        
        const toggleIcon = domRegistry.createElement('span');
        toggleIcon.className = 'section-toggle-icon';
        toggleIcon.innerHTML = ICONS.SECTION_COLLAPSE;
        header.appendChild(toggleIcon);
        
        // Create collapsible content
        const content = domRegistry.createElement('div');
        content.className = 'analysis-section-content';
        
        // Option to Complete
        const optionToComplete = PropertyStatusIndicator.create(
            domRegistry,
            'Option to Complete',
            soundnessResult.optionToComplete,
            'All traces can reach end nodes'
        );
        content.appendChild(optionToComplete);
        
        // Proper Completion
        const properCompletion = PropertyStatusIndicator.create(
            domRegistry,
            'Proper Completion',
            soundnessResult.properCompletion,
            'Traces end properly without residual tasks'
        );
        content.appendChild(properCompletion);
        
        // No Dead Transitions
        const noDeadTransitions = PropertyStatusIndicator.create(
            domRegistry,
            'No Dead Transitions',
            soundnessResult.noDeadTransitions,
            `All tasks appear in at least one trace${soundnessResult.deadTasks?.length > 0 ? ` (${soundnessResult.deadTasks.length} dead tasks found)` : ''}`
        );
        content.appendChild(noDeadTransitions);
        
        // Show dead tasks if any (in collapsible detail section)
        if (soundnessResult.deadTasks && soundnessResult.deadTasks.length > 0) {
            const detailsSection = this.createCollapsibleDetailsSection(
                domRegistry,
                'Dead Tasks Details',
                () => {
                    const deadTasksList = domRegistry.createElement('div');
                    deadTasksList.className = 'dead-tasks-list';
                    deadTasksList.innerHTML = `<strong>Dead Tasks:</strong> ${soundnessResult.deadTasks.join(', ')}`;
                    return deadTasksList;
                }
            );
            content.appendChild(detailsSection);
        }
        
        // Show incomplete traces if any (in collapsible detail section)
        if (soundnessResult.incompleteTraces && soundnessResult.incompleteTraces.length > 0) {
            const detailsSection = this.createCollapsibleDetailsSection(
                domRegistry,
                'Incomplete Traces Details',
                () => {
                    const incompleteTracesList = domRegistry.createElement('div');
                    incompleteTracesList.className = 'incomplete-traces-list';
                    const tracesInfo = soundnessResult.incompleteTraces.map(t => 
                        `Trace ${t.traceIndex}: ${t.reason}`
                    ).join('; ');
                    incompleteTracesList.innerHTML = `<strong>Incomplete Traces:</strong> ${tracesInfo}`;
                    return incompleteTracesList;
                }
            );
            content.appendChild(detailsSection);
        }
        
        // Add toggle functionality
        header.addEventListener('click', () => this.toggleSection(soundnessSection));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleSection(soundnessSection);
            }
        });
        
        soundnessSection.appendChild(header);
        soundnessSection.appendChild(content);
        
        return soundnessSection;
    }

    /**
     * Create a collapsible details section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {string} title - Section title
     * @param {Function} contentFactory - Function that returns the content element
     * @returns {HTMLElement} Collapsible details section
     */
    static createCollapsibleDetailsSection(domRegistry, title, contentFactory) {
        const detailsSection = domRegistry.createElement('div');
        detailsSection.className = 'analysis-details-section';
        
        const header = domRegistry.createElement('div');
        header.className = 'details-section-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        
        const headerTitle = domRegistry.createElement('h4');
        headerTitle.className = 'details-section-title';
        headerTitle.textContent = title;
        header.appendChild(headerTitle);
        
        const toggleIcon = domRegistry.createElement('span');
        toggleIcon.className = 'details-toggle-icon';
        toggleIcon.innerHTML = ICONS.SECTION_EXPAND;
        header.appendChild(toggleIcon);
        
        const content = domRegistry.createElement('div');
        content.className = 'details-section-content';
        content.style.display = 'none';
        content.appendChild(contentFactory());
        
        // Add toggle functionality
        header.addEventListener('click', () => this.toggleDetailsSection(detailsSection));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleDetailsSection(detailsSection);
            }
        });
        
        detailsSection.appendChild(header);
        detailsSection.appendChild(content);
        
        return detailsSection;
    }

    /**
     * Toggle section expand/collapse state
     * @param {HTMLElement} section - Section element to toggle
     */
    static toggleSection(section) {
        const header = section.querySelector('.analysis-section-header');
        const content = section.querySelector('.analysis-section-content');
        const toggleIcon = header?.querySelector('.section-toggle-icon');
        
        if (!header || !content) {
            return;
        }
        
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        
        header.setAttribute('aria-expanded', newState.toString());
        content.style.display = newState ? 'block' : 'none';
        section.classList.toggle('collapsed', !newState);
        
        if (toggleIcon) {
            toggleIcon.innerHTML = newState ? ICONS.SECTION_COLLAPSE : ICONS.SECTION_EXPAND;
        }
    }

    /**
     * Toggle details section expand/collapse state
     * @param {HTMLElement} detailsSection - Details section element to toggle
     */
    static toggleDetailsSection(detailsSection) {
        const header = detailsSection.querySelector('.details-section-header');
        const content = detailsSection.querySelector('.details-section-content');
        const toggleIcon = header?.querySelector('.details-toggle-icon');
        
        if (!header || !content) {
            return;
        }
        
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        
        header.setAttribute('aria-expanded', newState.toString());
        content.style.display = newState ? 'block' : 'none';
        detailsSection.classList.toggle('collapsed', !newState);
        
        if (toggleIcon) {
            toggleIcon.innerHTML = newState ? ICONS.SECTION_COLLAPSE : ICONS.SECTION_EXPAND;
        }
    }
}

