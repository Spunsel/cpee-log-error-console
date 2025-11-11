/**
 * SectionExpandCollapse Component
 * Manages expand/collapse functionality for content sections
 * Expands sections to fill browser height and restores previous state on collapse
 */

import { ICONS } from '../../assets/icons.js';

export class SectionExpandCollapse {
    constructor(domRegistry = null) {
        this.domRegistry = domRegistry;
        this.expandedSections = new Map(); // Store previous state for each section
    }

    /**
     * Create expand/collapse button for a section
     * @param {string} sectionId - Section identifier (e.g., 'input-cpee')
     * @returns {HTMLElement} Button element
     */
    createExpandCollapseButton(sectionId) {
        const button = this.domRegistry.createElement('button', {
            className: 'section-expand-collapse-btn',
            'data-section-id': sectionId,
            'aria-label': 'Expand section to fill browser height',
            title: 'Expand section'
        });

        // Set initial icon (expand)
        button.innerHTML = ICONS.EXPAND_SECTION;

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleSection(sectionId);
        });

        return button;
    }

    /**
     * Toggle expand/collapse state for a section
     * @param {string} sectionId - Section identifier
     */
    toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) {
            console.warn(`[SectionExpandCollapse] Section ${sectionId} not found`);
            return;
        }

        const contentBox = section.querySelector('.content-box');
        if (!contentBox) {
            console.warn(`[SectionExpandCollapse] Content box not found for ${sectionId}`);
            return;
        }

        const button = document.querySelector(`.section-expand-collapse-btn[data-section-id="${sectionId}"]`);
        if (!button) {
            console.warn(`[SectionExpandCollapse] Button not found for ${sectionId}`);
            return;
        }

        const isExpanded = section.classList.contains('section-expanded');

        if (isExpanded) {
            this.collapseSection(sectionId, section, contentBox, button);
        } else {
            this.expandSection(sectionId, section, contentBox, button);
        }
    }

    /**
     * Expand section to fill browser height
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} section - Section element
     * @param {HTMLElement} contentBox - Content box element
     * @param {HTMLElement} button - Button element
     */
    expandSection(sectionId, section, contentBox, button) {
        // Store previous state
        const previousState = {
            scrollY: window.scrollY,
            contentBoxHeight: contentBox.style.height || '',
            contentBoxMaxHeight: contentBox.style.maxHeight || '',
            contentBoxMinHeight: contentBox.style.minHeight || '',
            contentBoxOverflow: contentBox.style.overflow || '',
            contentBoxOverflowX: contentBox.style.overflowX || '',
            contentBoxOverflowY: contentBox.style.overflowY || '',
            sectionHeight: section.style.height || ''
        };
        this.expandedSections.set(sectionId, previousState);

        // Get the header (h3) to calculate header height
        const header = section.querySelector('h3');
        if (!header) {
            console.warn(`[SectionExpandCollapse] Header not found for ${sectionId}`);
            return;
        }

        // First: Calculate and adjust content box height
        // Get header height to calculate available height
        const headerRect = header.getBoundingClientRect();
        const headerHeight = headerRect.height;
        const windowHeight = window.innerHeight;
        const availableHeight = windowHeight - headerHeight;

        // Set content box height to fill available space (browser height minus header)
        contentBox.style.height = `${availableHeight}px`;
        contentBox.style.maxHeight = `${availableHeight}px`;
        contentBox.style.minHeight = `${availableHeight}px`;
        
        // Check if section contains raw content - if so, prevent horizontal scrollbar on content-box
        // The raw content container will handle its own scrolling
        const hasRawContent = contentBox.querySelector('[data-content-type="raw"]');
        if (hasRawContent) {
            // For raw content sections, only allow vertical scrolling on content-box
            // Horizontal scrolling will be handled by the raw content container
            contentBox.style.overflowY = 'auto';
            contentBox.style.overflowX = 'hidden';
        } else {
            // For mermaid sections, explicitly set both overflow directions to preserve horizontal scrollbar
            const isMermaidSection = section.classList.contains('mermaid-section');
            if (isMermaidSection) {
                contentBox.style.overflowX = 'auto';
                contentBox.style.overflowY = 'auto';
            } else {
                // For other content types, allow both directions
                contentBox.style.overflow = 'auto';
            }
        }

        // Mark section as expanded
        section.classList.add('section-expanded');

        // Update button icon and aria-label
        button.innerHTML = ICONS.COLLAPSE_SECTION;
        button.setAttribute('aria-label', 'Collapse section to previous size');
        button.setAttribute('title', 'Collapse section');

        // Second: Wait for height adjustment to be applied, then scroll to position header at top
        // Use double requestAnimationFrame to ensure layout has fully updated
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Get the header's position after layout update
                const headerRect = header.getBoundingClientRect();
                const currentScrollY = window.scrollY;
                const headerTop = headerRect.top;
                
                // Calculate the exact scroll position needed to put header at top (0)
                const targetScrollY = currentScrollY + headerTop;
                
                // For bottom sections (like output-cpee), ensure document has enough height
                // by temporarily adding padding if needed
                const documentHeight = document.documentElement.scrollHeight;
                const requiredHeight = targetScrollY + window.innerHeight;
                
                if (requiredHeight > documentHeight) {
                    // Add temporary padding to body to allow scrolling
                    const body = document.body;
                    const originalPaddingBottom = body.style.paddingBottom || '';
                    body.style.paddingBottom = `${requiredHeight - documentHeight + 10}px`;
                    
                    // Scroll to position
                    window.scrollTo({
                        top: targetScrollY,
                        behavior: 'smooth'
                    });
                    
                    // Remove padding after scroll completes
                    setTimeout(() => {
                        body.style.paddingBottom = originalPaddingBottom;
                    }, 500);
                } else {
                    // Normal scroll
                    window.scrollTo({
                        top: targetScrollY,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    /**
     * Collapse section to previous state
     * @param {string} sectionId - Section identifier
     * @param {HTMLElement} section - Section element
     * @param {HTMLElement} contentBox - Content box element
     * @param {HTMLElement} button - Button element
     */
    collapseSection(sectionId, section, contentBox, button) {
        const previousState = this.expandedSections.get(sectionId);
        if (!previousState) {
            console.warn(`[SectionExpandCollapse] No previous state found for ${sectionId}`);
            return;
        }

        // Restore previous scroll position
        window.scrollTo({
            top: previousState.scrollY,
            behavior: 'smooth'
        });

        // Restore previous content box styles
        // If the original value was empty, remove the style property to let CSS take over
        if (previousState.contentBoxHeight) {
            contentBox.style.height = previousState.contentBoxHeight;
        } else {
            contentBox.style.removeProperty('height');
        }
        
        if (previousState.contentBoxMaxHeight) {
            contentBox.style.maxHeight = previousState.contentBoxMaxHeight;
        } else {
            contentBox.style.removeProperty('max-height');
        }
        
        if (previousState.contentBoxMinHeight) {
            contentBox.style.minHeight = previousState.contentBoxMinHeight;
        } else {
            contentBox.style.removeProperty('min-height');
        }
        
        // Restore overflow properties (handle both combined and separate properties)
        if (previousState.contentBoxOverflow) {
            contentBox.style.overflow = previousState.contentBoxOverflow;
            // Clear separate overflow properties if we're restoring combined overflow
            contentBox.style.removeProperty('overflow-x');
            contentBox.style.removeProperty('overflow-y');
        } else {
            contentBox.style.removeProperty('overflow');
            // Restore separate overflow properties if they were set
            if (previousState.contentBoxOverflowX) {
                contentBox.style.overflowX = previousState.contentBoxOverflowX;
            } else {
                contentBox.style.removeProperty('overflow-x');
            }
            if (previousState.contentBoxOverflowY) {
                contentBox.style.overflowY = previousState.contentBoxOverflowY;
            } else {
                contentBox.style.removeProperty('overflow-y');
            }
        }

        // Remove expanded class
        section.classList.remove('section-expanded');

        // Update button icon and aria-label
        button.innerHTML = ICONS.EXPAND_SECTION;
        button.setAttribute('aria-label', 'Expand section to fill browser height');
        button.setAttribute('title', 'Expand section');

        // Clean up stored state
        this.expandedSections.delete(sectionId);
    }

    /**
     * Attach expand/collapse buttons to all content sections
     * Should be called after sections are rendered in DOM
     */
    attachToSections() {
        const sections = [
            { id: 'input-cpee', title: 'Input CPEE-Tree' },
            { id: 'input-intermediate', title: 'Input Intermediate' },
            { id: 'output-intermediate', title: 'Output Intermediate' },
            { id: 'output-cpee', title: 'Output CPEE-Tree' }
        ];

        sections.forEach(section => {
            const sectionElement = document.getElementById(section.id);
            if (!sectionElement) {
                return;
            }

            const leftSide = sectionElement.querySelector('.left-title-side');
            if (!leftSide) {
                return;
            }

            // Check if button already exists
            if (leftSide.querySelector('.section-expand-collapse-btn')) {
                return;
            }

            // Create button
            const button = this.createExpandCollapseButton(section.id);

            // Insert button at the beginning of left-title-side (before title text)
            const titleSpan = leftSide.querySelector('.section-title');
            if (titleSpan) {
                leftSide.insertBefore(button, titleSpan);
            } else {
                leftSide.insertBefore(button, leftSide.firstChild);
            }
        });
    }

    /**
     * Remove all expand/collapse buttons from sections
     */
    detachFromSections() {
        const buttons = document.querySelectorAll('.section-expand-collapse-btn');
        buttons.forEach(button => {
            button.remove();
        });
        this.expandedSections.clear();
    }
}

