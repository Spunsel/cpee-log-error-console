/**
 * Application Entry Point
 * Initializes the CPEE Debug Console
 */

import { CPEEDebugConsole } from './core/CPEEDebugConsole.js';
import { ICONS } from './assets/icons.js';

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
