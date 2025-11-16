/**
 * BoundednessDisplay Component
 * Displays boundedness verification results with collapsible sections
 */

import { PropertyStatusIndicator } from './PropertyStatusIndicator.js';
import { ICONS } from '../../assets/icons.js';

export class BoundednessDisplay {
    /**
     * Create a boundedness display section
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} boundednessResult - Boundedness verification result
     * @returns {HTMLElement} Boundedness section element
     */
    static create(domRegistry, boundednessResult) {
        if (!boundednessResult) {
            return null;
        }
        
        const boundednessSection = domRegistry.createElement('div');
        boundednessSection.className = 'boundedness-section analysis-collapsible-section';
        
        // Create collapsible header
        const header = domRegistry.createElement('div');
        header.className = 'analysis-section-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'true');
        
        const title = domRegistry.createElement('h3');
        title.className = 'analysis-section-title';
        title.textContent = 'Boundedness Properties';
        header.appendChild(title);
        
        const toggleIcon = domRegistry.createElement('span');
        toggleIcon.className = 'section-toggle-icon';
        toggleIcon.innerHTML = ICONS.SECTION_COLLAPSE;
        header.appendChild(toggleIcon);
        
        // Create collapsible content
        const content = domRegistry.createElement('div');
        content.className = 'analysis-section-content';
        
        // Bounded Places
        const boundedPlaces = PropertyStatusIndicator.create(
            domRegistry,
            'Bounded Places',
            boundednessResult.boundedPlaces,
            `No place accumulates unbounded tokens${boundednessResult.unboundedPlaces?.length > 0 ? ` (${boundednessResult.unboundedPlaces.length} unbounded places found)` : ''}`
        );
        content.appendChild(boundedPlaces);
        
        // Bounded Loops
        const boundedLoops = PropertyStatusIndicator.create(
            domRegistry,
            'Bounded Loops',
            boundednessResult.boundedLoops,
            'Loops have bounded iteration limits'
        );
        content.appendChild(boundedLoops);
        
        // Bounded Parallelism
        const boundedParallelism = PropertyStatusIndicator.create(
            domRegistry,
            'Bounded Parallelism',
            boundednessResult.boundedParallelism,
            'Parallel branches do not create unbounded token accumulation'
        );
        content.appendChild(boundedParallelism);
        
        // Show unbounded places if any (in collapsible detail section)
        if (boundednessResult.unboundedPlaces && boundednessResult.unboundedPlaces.length > 0) {
            const detailsSection = this.createCollapsibleDetailsSection(
                domRegistry,
                'Unbounded Places Details',
                () => {
                    const unboundedPlacesList = domRegistry.createElement('div');
                    unboundedPlacesList.className = 'unbounded-places-list';
                    const placesInfo = boundednessResult.unboundedPlaces.map(p => 
                        `Place ${p.placeId}: ${this.formatNumber(p.tokenCount)} tokens (max: ${this.formatNumber(p.maxAllowed)})`
                    ).join('; ');
                    unboundedPlacesList.innerHTML = `<strong>Unbounded Places:</strong> ${placesInfo}`;
                    return unboundedPlacesList;
                }
            );
            content.appendChild(detailsSection);
        }
        
        // Show max place tokens if available (in collapsible detail section)
        if (boundednessResult.maxPlaceTokens && Object.keys(boundednessResult.maxPlaceTokens).length > 0) {
            const detailsSection = this.createCollapsibleDetailsSection(
                domRegistry,
                'Maximum Tokens per Place',
                () => {
                    const maxTokensInfo = domRegistry.createElement('div');
                    maxTokensInfo.className = 'max-tokens-info';
                    const tokensList = Object.entries(boundednessResult.maxPlaceTokens)
                        .map(([placeId, count]) => `${placeId}: ${this.formatNumber(count)}`)
                        .join(', ');
                    maxTokensInfo.innerHTML = `<strong>Maximum Tokens per Place:</strong> ${tokensList}`;
                    return maxTokensInfo;
                }
            );
            content.appendChild(detailsSection);
        }
        
        // Add toggle functionality
        header.addEventListener('click', () => this.toggleSection(boundednessSection));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleSection(boundednessSection);
            }
        });
        
        boundednessSection.appendChild(header);
        boundednessSection.appendChild(content);
        
        return boundednessSection;
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

