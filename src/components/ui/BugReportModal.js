/**
 * Bug Report Modal Component
 * Provides a modal form for users to submit bug reports and feature suggestions
 */

import { EmailService } from '../../services/EmailService.js';

export class BugReportModal {
    constructor() {
        this.modal = null;
        this.form = null;
        this.isOpen = false;
        this.emailService = new EmailService();
        this.init();
    }

    /**
     * Initialize the modal
     */
    init() {
        this.createModal();
        this.attachEventListeners();
    }

    /**
     * Create the modal HTML structure
     */
    createModal() {
        // Modal backdrop
        this.modal = document.createElement('div');
        this.modal.className = 'bug-report-modal';
        this.modal.id = 'bug-report-modal';
        this.modal.innerHTML = `
            <div class="bug-report-modal-content">
                <div class="bug-report-modal-header">
                    <h2>Report Bug / Suggest Changes</h2>
                    <button class="bug-report-close-btn" aria-label="Close modal">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <form class="bug-report-form" id="bug-report-form">
                    <div class="form-group">
                        <label for="bug-report-type">Type</label>
                        <select id="bug-report-type" name="type" required>
                            <option value="">Select type...</option>
                            <option value="bug">Bug</option>
                            <option value="feature-suggestion">Feature Suggestion</option>
                            <option value="ui-ux-issue">UI/UX Issue</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="bug-report-subject">Subject</label>
                        <input type="text" id="bug-report-subject" name="subject" placeholder="Brief description..." required>
                    </div>
                    <div class="form-group">
                        <label for="bug-report-message">Message</label>
                        <textarea id="bug-report-message" name="message" rows="6" placeholder="Please describe the bug or your suggestion in detail..." maxlength="1000" required></textarea>
                        <div class="character-counter">
                            <span id="bug-report-char-count">0</span> / 1000
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="bug-report-email">Your Email (optional)</label>
                        <input type="email" id="bug-report-email" name="email" placeholder="your.email@example.com">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="bug-report-cancel-btn">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="bug-report-submit-btn">
                            <span class="btn-text">Send</span>
                            <span class="btn-loading" style="display: none;">Sending...</span>
                        </button>
                    </div>
                </form>
                <div class="bug-report-message" id="bug-report-message-container" style="display: none;"></div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.form = this.modal.querySelector('#bug-report-form');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        const closeBtn = this.modal.querySelector('.bug-report-close-btn');
        closeBtn.addEventListener('click', () => this.close());

        // Cancel button
        const cancelBtn = this.modal.querySelector('#bug-report-cancel-btn');
        cancelBtn.addEventListener('click', () => this.close());

        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Character counter for message field
        const messageField = this.modal.querySelector('#bug-report-message');
        const charCount = this.modal.querySelector('#bug-report-char-count');
        if (messageField && charCount) {
            messageField.addEventListener('input', () => {
                const length = messageField.value.length;
                charCount.textContent = length;
                if (length >= 1000) {
                    charCount.parentElement.classList.add('at-limit');
                } else {
                    charCount.parentElement.classList.remove('at-limit');
                }
            });
            // Initialize counter
            charCount.textContent = messageField.value.length;
        }
    }

    /**
     * Handle form submission
     * @param {Event} e - Form submit event
     */
    async handleSubmit(e) {
        e.preventDefault();

        const submitBtn = this.modal.querySelector('#bug-report-submit-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-block';

        // Collect form data
        const formData = new FormData(this.form);
        const data = {
            type: formData.get('type'),
            subject: formData.get('subject'),
            message: formData.get('message'),
            email: formData.get('email') || 'Not provided',
            timestamp: new Date().toISOString()
        };

        try {
            await this.emailService.sendBugReport(data);
            this.showSuccess();
            this.form.reset();
        } catch (error) {
            console.error('Failed to send bug report:', error);
            this.showError(error.message || 'Failed to send message. Please try again later.');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            btnText.style.display = 'inline-block';
            btnLoading.style.display = 'none';
        }
    }

    /**
     * Show success message
     */
    showSuccess() {
        const messageContainer = this.modal.querySelector('#bug-report-message-container');
        messageContainer.className = 'bug-report-message bug-report-success';
        messageContainer.innerHTML = '<strong>✓ Success!</strong> Thank you for your feedback. Your message has been sent.';
        messageContainer.style.display = 'block';
        this.form.style.display = 'none';

        // Auto-close after 3 seconds
        setTimeout(() => {
            this.close();
        }, 3000);
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        const messageContainer = this.modal.querySelector('#bug-report-message-container');
        messageContainer.className = 'bug-report-message bug-report-error';
        messageContainer.innerHTML = `<strong>✗ Error:</strong> ${message}`;
        messageContainer.style.display = 'block';

        // Hide error after 5 seconds
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 5000);
    }

    /**
     * Open the modal
     */
    open() {
        if (this.modal) {
            this.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            this.isOpen = true;

            // Focus on first input
            const firstInput = this.modal.querySelector('input, textarea, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }

            // Reset form and messages
            this.form.reset();
            this.form.style.display = 'block';
            const messageContainer = this.modal.querySelector('#bug-report-message-container');
            messageContainer.style.display = 'none';

            // Reset character counter
            const charCount = this.modal.querySelector('#bug-report-char-count');
            if (charCount) {
                charCount.textContent = '0';
                charCount.parentElement.classList.remove('at-limit');
            }
        }
    }

    /**
     * Close the modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
            document.body.style.overflow = '';
            this.isOpen = false;
        }
    }
}
