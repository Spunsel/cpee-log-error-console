/**
 * Application Entry Point
 * Initializes the CPEE Debug Console
 */

import { CPEEDebugConsole } from './core/CPEEDebugConsole.js';
import { ICONS } from './assets/icons.js';

// Apply dark mode immediately to prevent flash of wrong theme
(function applyInitialDarkMode() {
    try {
        const stored = localStorage.getItem('cpee-debug-console-dark-mode');
        if (stored === 'true') {
            document.documentElement.setAttribute('data-theme', 'dark');
            // Update Prism theme
            const prismThemeLink = document.getElementById('prism-theme');
            if (prismThemeLink) {
                prismThemeLink.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
            }
        }
    } catch (error) {
        console.warn('Failed to apply initial dark mode:', error);
    }
})();

// Load the app icon
document.addEventListener('DOMContentLoaded', () => {
    // Load app icon into header
    const appIconElement = document.getElementById('app-icon');
    if (appIconElement) {
        appIconElement.innerHTML = ICONS.APP;
    }

    // Initialize the application
    window.app = new CPEEDebugConsole();
});
