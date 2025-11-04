/**
 * Email Service
 * Handles sending emails for bug reports and feature suggestions
 * 
 * Supports multiple email services:
 * 1. Web3Forms (FREE, no signup required) - Recommended for quick setup
 *    - Get access key from https://web3forms.com/ (takes 30 seconds)
 *    - Just provide your email address and get an access key
 * 
 * 2. EmailJS (FREE tier: 200 emails/month, requires signup)
 *    - Sign up at https://www.emailjs.com/
 *    - Create an email service template
 *    - Configure serviceId, templateId, and publicKey
 * 
 * 3. Custom API endpoint
 *    - Use your own backend API for sending emails
 */

import { configManager } from '../config/ConfigManager.js';

export class EmailService {
    constructor() {
        this.config = this.loadConfig();
        this.emailjsLoaded = false;
    }

    /**
     * Load email service configuration
     * @returns {Object} Email service configuration
     */
    loadConfig() {
        // Try to load from ConfigManager first
        try {
            const emailConfig = configManager.get('email');
            if (emailConfig) {
                return emailConfig;
            }
        } catch (error) {
            console.warn('Email config not found in ConfigManager, using defaults');
        }

        // Default configuration (should be set via ConfigManager)
        return {
            enabled: false,
            service: 'web3forms', // 'web3forms', 'emailjs', or 'api'
            // Web3Forms - Free, no signup required
            web3forms: {
                accessKey: '',
                recipientEmail: ''
            },
            // EmailJS configuration
            emailjs: {
                serviceId: '',
                templateId: '',
                publicKey: ''
            },
            // API endpoint configuration (alternative)
            api: {
                endpoint: ''
            }
        };
    }

    /**
     * Load EmailJS library dynamically
     * @returns {Promise} Promise that resolves when EmailJS is loaded
     */
    loadEmailJS() {
        if (this.emailjsLoaded || window.emailjs) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = () => {
                window.emailjs.init(this.config.emailjs.publicKey);
                this.emailjsLoaded = true;
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load EmailJS library'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Send bug report using EmailJS
     * @param {Object} data - Bug report data
     * @returns {Promise} Promise that resolves when email is sent
     */
    async sendViaEmailJS(data) {
        if (!this.emailjsLoaded) {
            await this.loadEmailJS();
        }

        const templateParams = {
            type: data.type,
            subject: data.subject,
            message: data.message,
            email: data.email,
            timestamp: data.timestamp,
            user_agent: navigator.userAgent,
            url: window.location.href
        };

        return window.emailjs.send(
            this.config.emailjs.serviceId,
            this.config.emailjs.templateId,
            templateParams
        );
    }

    /**
     * Send bug report via Web3Forms (free, no signup required)
     * @param {Object} data - Bug report data
     * @returns {Promise} Promise that resolves when email is sent
     */
    async sendViaWeb3Forms(data) {
        if (!this.config.web3forms.accessKey || !this.config.web3forms.recipientEmail) {
            throw new Error('Web3Forms is not properly configured. Please set accessKey and recipientEmail in ConfigManager. Get your access key from https://web3forms.com/');
        }

        // Automatically include current URL
        const currentUrl = window.location.href;
        
        const formData = {
            access_key: this.config.web3forms.accessKey,
            subject: `[Bug Report] ${data.subject}`,
            from_name: data.email !== 'Not provided' ? data.email : 'Anonymous',
            email: this.config.web3forms.recipientEmail,
            url: currentUrl, // Automatically include URL as separate field
            message: `
Type: ${data.type}
Subject: ${data.subject}

Message:
${data.message}

---
User Email: ${data.email}
Timestamp: ${data.timestamp}
User Agent: ${navigator.userAgent}
URL: ${currentUrl}
            `.trim()
        };

        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to send email via Web3Forms');
        }

        return result;
    }

    /**
     * Send bug report via API endpoint
     * @param {Object} data - Bug report data
     * @returns {Promise} Promise that resolves when email is sent
     */
    async sendViaAPI(data) {
        if (!this.config.api.endpoint) {
            throw new Error('API endpoint is not configured. Please set api.endpoint in ConfigManager.');
        }

        const response = await fetch(this.config.api.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...data,
                user_agent: navigator.userAgent,
                url: window.location.href
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Send bug report
     * @param {Object} data - Bug report data containing type, subject, message, email
     * @returns {Promise} Promise that resolves when email is sent
     */
    async sendBugReport(data) {
        if (!this.config.enabled) {
            throw new Error('Email service is not enabled. Please configure it in ConfigManager.');
        }

        // Validate required fields
        if (!data.type || !data.subject || !data.message) {
            throw new Error('Missing required fields');
        }

        try {
            if (this.config.service === 'web3forms') {
                return await this.sendViaWeb3Forms(data);
            } else if (this.config.service === 'emailjs') {
                if (!this.config.emailjs.serviceId || !this.config.emailjs.templateId || !this.config.emailjs.publicKey) {
                    throw new Error('EmailJS is not properly configured. Please set serviceId, templateId, and publicKey in ConfigManager.');
                }
                return await this.sendViaEmailJS(data);
            } else if (this.config.service === 'api') {
                return await this.sendViaAPI(data);
            } else {
                throw new Error(`Unknown email service: ${this.config.service}. Supported services: 'web3forms', 'emailjs', 'api'`);
            }
        } catch (error) {
            console.error('EmailService error:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
}
