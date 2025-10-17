/**
 * Centralized Error Handling System
 * Provides consistent error handling and user feedback
 */

export class ErrorHandler {
    static ERROR_TYPES = {
        NETWORK: 'network',
        PARSING: 'parsing',
        VALIDATION: 'validation',
        USER_INPUT: 'user_input',
        SYSTEM: 'system'
    };

    static SEVERITY = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };

    /**
     * Handle error with appropriate user feedback
     */
    static handle(error, type = this.ERROR_TYPES.SYSTEM, severity = this.SEVERITY.MEDIUM) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            type,
            severity,
            message: error.message,
            stack: error.stack,
            context: this.getContext()
        };

        // Log error
        this.logError(errorInfo);

        // Show user feedback
        this.showUserFeedback(errorInfo);

        // Report to monitoring (if enabled)
        this.reportError(errorInfo);

        return errorInfo;
    }

    /**
     * Create user-friendly error messages
     */
    static getUserFriendlyMessage(type, originalMessage) {
        const messages = {
            [this.ERROR_TYPES.NETWORK]: 'Connection problem. Please check your internet connection and try again.',
            [this.ERROR_TYPES.PARSING]: 'Unable to process the log data. The file may be corrupted or in an unexpected format.',
            [this.ERROR_TYPES.VALIDATION]: 'Invalid input provided. Please check your input and try again.',
            [this.ERROR_TYPES.USER_INPUT]: 'Please provide valid information in the required format.',
            [this.ERROR_TYPES.SYSTEM]: 'An unexpected error occurred. Please try again or contact support.'
        };

        return messages[type] || originalMessage;
    }

    /**
     * Show visual feedback to user
     */
    static showUserFeedback(errorInfo) {
        const message = this.getUserFriendlyMessage(errorInfo.type, errorInfo.message);
        
        // Create or update error display
        const existingError = document.getElementById('error-display');
        if (existingError) {
            existingError.remove();
        }

        const errorElement = document.createElement('div');
        errorElement.id = 'error-display';
        errorElement.className = `error-message severity-${errorInfo.severity}`;
        errorElement.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-text">${message}</span>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        document.body.appendChild(errorElement);

        // Auto-remove after delay (except critical errors)
        if (errorInfo.severity !== this.SEVERITY.CRITICAL) {
            setTimeout(() => {
                errorElement?.remove();
            }, 5000);
        }
    }

    static logError(errorInfo) {
        console.group(`🚨 ${errorInfo.type.toUpperCase()} ERROR (${errorInfo.severity})`);
        console.error('Message:', errorInfo.message);
        console.error('Stack:', errorInfo.stack);
        console.error('Context:', errorInfo.context);
        console.groupEnd();
    }

    static getContext() {
        return {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };
    }

    static reportError(errorInfo) {
        // Implementation for error reporting service
        // Could integrate with Sentry, LogRocket, etc.
        console.log('Error reported:', errorInfo);
    }
}
