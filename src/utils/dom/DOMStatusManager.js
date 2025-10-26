/**
 * Status Manager
 * Simplified status message display for renderers
 * Provides standardized status states and auto-hide functionality
 */

export class DOMStatusManager {
    constructor(statusElement = null) {
        this.statusElement = statusElement;
        this.hideTimeout = null;
    }

    /**
     * Set status element
     * @param {HTMLElement} element - Status display element
     */
    setStatusElement(element) {
        this.statusElement = element;
    }

    /**
     * Show status message
     * @param {string} message - Status message
     * @param {string} type - Message type (loading, success, error, info)
     * @param {boolean} autoHide - Whether to auto-hide after delay
     * @param {number} hideDelay - Delay in milliseconds before hiding
     */
    showStatus(message, type = 'info', autoHide = false, hideDelay = 3000) {
        if (!this.statusElement) { 
            return;
        }

        // Clear any existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Update content and styling
        this.statusElement.textContent = message;
        this.statusElement.className = this.getStatusClass(type);
        this.statusElement.style.display = 'block';

        // Auto-hide if requested
        if (autoHide && (type === 'success' || type === 'info')) {
            this.hideTimeout = setTimeout(() => {
                this.hide();
            }, hideDelay);
        }
    }

    /**
     * Show loading status
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading...') {
        this.showStatus(message, 'loading');
    }

    /**
     * Show success status
     * @param {string} message - Success message
     * @param {boolean} autoHide - Whether to auto-hide (default: true)
     */
    showSuccess(message, autoHide = true) {
        this.showStatus(message, 'success', autoHide);
    }

    /**
     * Show error status
     * @param {string} message - Error message
     */
    showError(message) {
        this.showStatus(message, 'error', false);
    }

    /**
     * Show info status
     * @param {string} message - Info message
     * @param {boolean} autoHide - Whether to auto-hide (default: true)
     */
    showInfo(message, autoHide = true) {
        this.showStatus(message, 'info', autoHide);
    }

    /**
     * Hide status display
     */
    hide() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        if (this.statusElement) {
            this.statusElement.style.display = 'none';
        }
    }

    /**
     * Get CSS class for status type
     * @param {string} type - Status type
     * @returns {string} CSS class name
     */
    getStatusClass(type) {
        switch (type) {
            case 'loading':
                return 'alert alert-info';
            case 'success':
                return 'alert alert-success';
            case 'error':
                return 'alert alert-danger';
            case 'info':
            default:
                return 'alert alert-info';
        }
    }
}
