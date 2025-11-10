/**
 * Application Entry Point
 * Initializes the CPEE Debug Console
 */

import { CPEEDebugConsole } from './core/CPEEDebugConsole.js';
import { ICONS } from './assets/icons.js';
import { stateManager } from './core/StateManager.js';

// Apply dark mode immediately to prevent flash of wrong theme
// Use StateManager to load persisted dark mode preference
(function applyInitialDarkMode() {
    try {
        // StateManager loads persisted state in constructor, so we can read it immediately
        const isDark = stateManager.getState('ui.darkMode') || false;
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            // Update Prism theme - use direct DOM access here since DOMRegistry may not be initialized yet
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
