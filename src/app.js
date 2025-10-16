/**
 * Application Entry Point
 * Initializes the CPEE Debug Console
 */

import { CPEEDebugConsole } from './core/CPEEDebugConsole.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CPEEDebugConsole();
});
