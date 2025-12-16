/**
 * Recent Additions and Fixes Component
 * Manages the display of recent bug fixes and additions in GitHub-style format
 * Supports filtering by open/closed status and category labels
 */

import { ICONS } from '../../assets/icons.js';
import { configManager } from '../../config/ConfigManager.js';

export class RecentAdditionsAndFixes {
    constructor(domRegistry = null, configManagerInstance = null) {
        this.domRegistry = domRegistry;
        this.configManager = configManagerInstance || configManager;
        this.sectionClass = 'recent-additions-and-fixes-section';
        this.isCollapsed = true;
        this.showOpen = true; // Default to showing open issues
        this.showClosed = false; // Default to hiding closed issues
        
        // Load issues from ConfigManager
        this.loadIssuesFromConfig();
        
        this.init();
    }
    
    /**
     * Load issues from ConfigManager
     */
    loadIssuesFromConfig() {
        const recentAdditionsConfig = this.configManager.get('recentAdditions');
        if (recentAdditionsConfig && recentAdditionsConfig.issues) {
            this.issues = recentAdditionsConfig.issues;
        } else {
            // Fallback to empty array if config not found
            this.issues = [];
        }
    }
    
    /**
     * Initialize the component
     */
    init() {
        const section = document.querySelector(`.${this.sectionClass}`);
        if (!section) {
            console.warn(`[RecentAdditionsAndFixes] Section .${this.sectionClass} not found`);
            return;
        }
        
        this.section = section;
        this.toggleButton = section.querySelector('.section-toggle-button');
        this.leftTitleSide = section.querySelector('.left-title-side');
        this.contentBox = section.querySelector('.recent-additions-content');
        this.listContainer = section.querySelector('#recent-additions-list');
        this.openTab = section.querySelector('.issue-status-tab-open');
        this.closedTab = section.querySelector('.issue-status-tab-closed');
        this.openCount = section.querySelector('.issue-status-tab-open .issue-status-tab-count');
        this.closedCount = section.querySelector('.issue-status-tab-closed .issue-status-tab-count');
        
        // Make the entire left side (icon + title) clickable to toggle
        if (this.leftTitleSide) {
            this.leftTitleSide.addEventListener('click', () => this.toggle());
        }
        
        if (this.openTab) {
            this.openTab.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleStatusFilter('open');
            });
        }
        
        if (this.closedTab) {
            this.closedTab.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleStatusFilter('closed');
            });
        }
        
        // Set initial icons
        this.updateIcons();
        
        // Set initial tab states (open active by default)
        if (this.openTab) {
            this.openTab.classList.add('active');
            this.openTab.setAttribute('aria-current', 'true');
        }
        if (this.closedTab) {
            this.closedTab.classList.remove('active');
            this.closedTab.setAttribute('aria-current', 'false');
        }
        
        // Update counts
        this.updateCounts();
        
        // Render initial issues
        this.render();
    }
    
    /**
     * Update icons for toggle buttons
     */
    updateIcons() {
        if (this.toggleButton) {
            const iconContainer = this.toggleButton.querySelector('.section-toggle-icon');
            if (iconContainer) {
                iconContainer.innerHTML = this.isCollapsed ? ICONS.SECTION_EXPAND : ICONS.SECTION_COLLAPSE;
            }
        }
    }
    
    /**
     * Update counts for open and closed issues
     */
    updateCounts() {
        const openCount = this.issues.filter(issue => issue.status === 'open').length;
        const closedCount = this.issues.filter(issue => issue.status === 'closed').length;
        
        if (this.openCount) {
            this.openCount.textContent = openCount.toString();
            const srOnly = this.openTab?.querySelector('.sr-only');
            if (srOnly) {
                srOnly.textContent = ` (${openCount})`;
            }
        }
        
        if (this.closedCount) {
            this.closedCount.textContent = closedCount.toString();
            const srOnly = this.closedTab?.querySelector('.sr-only');
            if (srOnly) {
                srOnly.textContent = ` (${closedCount})`;
            }
        }
    }
    
    /**
     * Toggle collapse/expand state
     */
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.updateCollapseState();
    }
    
    /**
     * Expand the section if it's collapsed
     */
    expand() {
        if (this.isCollapsed) {
            this.isCollapsed = false;
            this.updateCollapseState();
        }
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
            iconContainer.innerHTML = this.isCollapsed ? ICONS.SECTION_EXPAND : ICONS.SECTION_COLLAPSE;
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
        this.contentBox.style.display = 'none';
    }
    
    /**
     * Show content when expanded
     */
    showContent() {
        if (!this.contentBox) {
            return;
        }
        this.contentBox.style.display = 'block';
    }
    
    /**
     * Toggle status filter (open/closed)
     * Mutually exclusive: only one can be active at a time
     * Expands the section if it's collapsed
     * @param {string} status - 'open' or 'closed'
     */
    toggleStatusFilter(status) {
        // Expand section if it's collapsed
        if (this.isCollapsed) {
            this.expand();
        }
        
        if (status === 'open') {
            // If open is already active, don't toggle off (one must always be active)
            if (this.showOpen) {
                return; // Already active, do nothing
            }
            // Switch to open
            this.showOpen = true;
            this.showClosed = false;
            
            if (this.openTab) {
                this.openTab.classList.add('active');
                this.openTab.setAttribute('aria-current', 'true');
            }
            if (this.closedTab) {
                this.closedTab.classList.remove('active');
                this.closedTab.setAttribute('aria-current', 'false');
            }
        } else if (status === 'closed') {
            // If closed is already active, don't toggle off (one must always be active)
            if (this.showClosed) {
                return; // Already active, do nothing
            }
            // Switch to closed
            this.showOpen = false;
            this.showClosed = true;
            
            if (this.closedTab) {
                this.closedTab.classList.add('active');
                this.closedTab.setAttribute('aria-current', 'true');
            }
            if (this.openTab) {
                this.openTab.classList.remove('active');
                this.openTab.setAttribute('aria-current', 'false');
            }
        }
        
        this.render();
    }
    
    /**
     * Render the issues list
     */
    render() {
        if (!this.listContainer) {
            return;
        }
        
        // Filter issues based on status filters
        const filteredIssues = this.issues.filter(issue => {
            if (issue.status === 'open' && !this.showOpen) {
                return false;
            }
            if (issue.status === 'closed' && !this.showClosed) {
                return false;
            }
            return true;
        });
        
        // Clear existing content
        this.listContainer.innerHTML = '';
        
        if (filteredIssues.length === 0) {
            const noIssuesMsg = document.createElement('div');
            noIssuesMsg.className = 'no-issues-message';
            noIssuesMsg.textContent = 'No issues to display';
            this.listContainer.appendChild(noIssuesMsg);
            return;
        }
        
        // Create issue items
        filteredIssues.forEach(issue => {
            const issueItem = this.createIssueItem(issue);
            this.listContainer.appendChild(issueItem);
        });
    }
    
    /**
     * Create an issue item element
     * @param {Object} issue - Issue data object
     * @returns {HTMLElement} Issue item element
     */
    createIssueItem(issue) {
        const item = document.createElement('div');
        item.className = `issue-item issue-item-${issue.status}`;
        
        const header = document.createElement('div');
        header.className = 'issue-header';
        
        // Status icon
        const statusIcon = document.createElement('div');
        statusIcon.className = 'issue-status-icon';
        statusIcon.innerHTML = issue.status === 'open' ? ICONS.ISSUE_OPEN : ICONS.ISSUE_CLOSED;
        header.appendChild(statusIcon);
        
        // Title
        const title = document.createElement('div');
        title.className = 'issue-title';
        title.textContent = issue.title;
        header.appendChild(title);
        
        // Labels
        const labelsContainer = document.createElement('div');
        labelsContainer.className = 'issue-labels';
        issue.labels.forEach(label => {
            const labelElement = document.createElement('span');
            labelElement.className = 'issue-label';
            
            // Add specific class for bug and feature labels
            const labelLower = label.toLowerCase();
            if (labelLower === 'bug') {
                labelElement.classList.add('issue-label-bug');
            } else if (labelLower === 'feature') {
                labelElement.classList.add('issue-label-feature');
            }
            
            labelElement.textContent = label;
            labelsContainer.appendChild(labelElement);
        });
        header.appendChild(labelsContainer);
        
        // Date
        const date = document.createElement('div');
        date.className = 'issue-date';
        date.textContent = issue.date;
        header.appendChild(date);
        
        item.appendChild(header);
        
        // Description
        if (issue.description) {
            const description = document.createElement('div');
            description.className = 'issue-description';
            description.textContent = issue.description;
            item.appendChild(description);
        }
        
        return item;
    }
    
    /**
     * Add a new issue
     * @param {Object} issue - Issue data object
     */
    addIssue(issue) {
        this.issues.unshift(issue); // Add to beginning
        this.updateCounts();
        this.render();
    }
    
    /**
     * Update issues list
     * @param {Array} issues - Array of issue objects
     */
    setIssues(issues) {
        this.issues = issues;
        this.updateCounts();
        this.render();
    }
}

