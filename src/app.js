/**
 * Application Entry Point
 * Initializes the CPEE Debug Console
 */

import { CPEEDebugConsole } from './core/CPEEDebugConsole.js';
import { ICONS } from './assets/icons.js';
import { stateManager } from './core/StateManager.js';
import { serviceFactory } from './core/ServiceFactory.js';
import { CPEEWfAdaptorRenderer } from './components/renderers/CPEEWfAdaptorRenderer.js';

// Apply dark mode immediately to prevent flash of wrong theme
// Use StateManager to load persisted dark mode preference
(function applyInitialDarkMode() {
    try {
        const isDark = stateManager.getState('ui.darkMode') || false;
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
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

    // Preload non-critical libraries in a low-priority idle window so they're
    // already cached by the time the user first needs them.
    const preloadLibraries = () => {
        try {
            const syntaxService = serviceFactory.get('SyntaxHighlightingService');
            syntaxService.initialize();
        } catch (_) { /* non-critical */ }

        CPEEWfAdaptorRenderer.preloadDependencies().catch(() => { /* non-critical */ });
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(preloadLibraries);
    } else {
        setTimeout(preloadLibraries, 200);
    }
});
