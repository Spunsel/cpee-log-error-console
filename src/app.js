/**
 * Application Entry Point
 * Initializes the CPEE Debug Console
 */

import { CPEEDebugConsole } from './core/CPEEDebugConsole.js';
import { ICONS } from './assets/icons.js';
import { stateManager } from './core/StateManager.js';
import { serviceFactory } from './core/ServiceFactory.js';

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
document.addEventListener('DOMContentLoaded', async () => {
    // Load app icon into header
    const appIconElement = document.getElementById('app-icon');
    if (appIconElement) {
        appIconElement.innerHTML = ICONS.APP;
    }

    // Ensure services are initialized before creating CPEEDebugConsole
    // This prevents race conditions where services are accessed before they're loaded
    try {
        await serviceFactory.initialize();
        console.log('[App] Services initialized, starting application');
    } catch (error) {
        console.error('[App] Failed to initialize services:', error);
        // Continue anyway - services will be loaded on-demand if needed
    }

    // Initialize the application
    window.app = new CPEEDebugConsole();
});
