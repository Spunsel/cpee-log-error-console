/**
 * StepSection Component
 * Manages collapsible functionality for process analysis sections
 * Currently used for User Input section, but can be extended to other sections
 */

import { ICON_SECTION_COLLAPSE, ICON_SECTION_EXPAND } from '../../assets/icons.js';

export class StepSection {
    /**
     * Initialize collapsible functionality for a section
     * @param {string} sectionId - ID of the section element (e.g., 'user-input')
     * @param {Object} options - Configuration options
     * @param {boolean} options.startCollapsed - Whether to start collapsed (default: false)
     */
    constructor(sectionId, options = {}) {
        this.sectionId = sectionId;
        this.isCollapsed = options.startCollapsed || false;
        
        this.init();
    }
    
    /**
     * Initialize the collapsible section
     */
    init() {
        const section = document.getElementById(this.sectionId);
        if (!section) {
            console.warn(`StepSection: Section with id "${this.sectionId}" not found`);
            return;
        }
        
        this.section = section;
        
        const header = section.querySelector('h3');
        if (!header) {
            console.warn(`StepSection: No h3 found in section "${this.sectionId}"`);
            return;
        }
        
        // Create toggle button
        this.toggleButton = this.createToggleButton();
        
        // Insert toggle button before the header text
        const headerText = header.firstChild;
        if (headerText && headerText.nodeType === Node.TEXT_NODE) {
            header.insertBefore(this.toggleButton, headerText);
        } else {
            header.insertBefore(this.toggleButton, header.firstChild);
        }
        
        // Get content element
        const contentBox = section.querySelector('.content-box');
        if (!contentBox) {
            console.warn(`StepSection: No .content-box found in section "${this.sectionId}"`);
            return;
        }
        
        this.contentBox = contentBox;
        // Try to find the content element (pre tag or code tag, or any direct child)
        this.contentElement = contentBox.querySelector('pre') || 
                             contentBox.querySelector('code') ||
                             contentBox.querySelector('.content-container') ||
                             contentBox.firstElementChild;
        
        // Set initial state
        this.updateCollapseState();
        
        // Add click handler
        this.toggleButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        // Observe content changes to update collapsed state
        this.observeContentChanges();
    }
    
    /**
     * Create the toggle button with SVG icons
     * @returns {HTMLElement} Toggle button element
     */
    createToggleButton() {
        const button = document.createElement('button');
        button.className = 'section-toggle-button';
        button.setAttribute('aria-label', 'Toggle section');
        button.setAttribute('aria-expanded', 'true');
        button.type = 'button';
        
        // Create icon container
        const iconContainer = document.createElement('span');
        iconContainer.className = 'section-toggle-icon';
        iconContainer.innerHTML = ICON_SECTION_COLLAPSE;
        
        button.appendChild(iconContainer);
        return button;
    }
    
    /**
     * Toggle the collapse state
     */
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.updateCollapseState();
    }
    
    /**
     * Update the visual state based on collapse status
     */
    updateCollapseState() {
        if (!this.toggleButton || !this.contentBox) {
            return;
        }
        
        const iconContainer = this.toggleButton.querySelector('.section-toggle-icon');
        if (iconContainer) {
            iconContainer.innerHTML = this.isCollapsed ? ICON_SECTION_EXPAND : ICON_SECTION_COLLAPSE;
        }
        
        this.toggleButton.setAttribute('aria-expanded', !this.isCollapsed);
        
        if (this.isCollapsed) {
            this.section.classList.add('collapsed');
            this.contentBox.classList.add('collapsed');
            this.hideContent();
        } else {
            this.section.classList.remove('collapsed');
            this.contentBox.classList.remove('collapsed');
            this.showContent();
        }
    }
    
    /**
     * Hide content completely when collapsed
     */
    hideContent() {
        if (!this.contentBox) {
            return;
        }
        
        // Hide the content box completely
        this.contentBox.style.display = 'none';
    }
    
    /**
     * Show content when expanded
     */
    showContent() {
        if (!this.contentBox) {
            return;
        }
        
        // Show the content box
        this.contentBox.style.display = '';
    }
    
    /**
     * Observe content changes to update collapsed state
     */
    observeContentChanges() {
        if (!this.contentBox || !window.MutationObserver) {
            return;
        }
        
        const observer = new MutationObserver(() => {
            // If collapsed, ensure content is hidden
            if (this.isCollapsed) {
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(() => {
                    this.hideContent();
                });
            }
        });
        
        observer.observe(this.contentBox, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        this.observer = observer;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        if (this.toggleButton && this.toggleButton.parentNode) {
            this.toggleButton.parentNode.removeChild(this.toggleButton);
        }
        
        this.showContent();
    }
}

