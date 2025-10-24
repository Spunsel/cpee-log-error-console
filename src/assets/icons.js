/**
 * SVG Icons Library
 * Centralized storage for all SVG icons used in the CPEE Log Error Console
 * 
 * All icons are stored as complete SVG elements with proper attributes:
 * - Dimensions (width, height)
 * - ViewBox for scalability
 * - currentColor for dynamic coloring
 * - Stroke-based design for clean rendering
 */

// ============================================
// SVG ICONS (Ready to use)
// ============================================

/**
 * Copy icon - Overlapping rectangles representing clipboard/copy action
 * ChatGPT style - 20x20px for copy buttons
 */
export const ICON_COPY = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2.5"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
`;

/**
 * Checkmark icon - Success/copied state indicator
 * ChatGPT style - 20x20px for copy buttons
 */
export const ICON_CHECK = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12.5l5 5L20 7.5"></path>
    </svg>
`;

/**
 * Visual/Graph mode icon - Eye symbol
 * Represents visual/graphical view mode - 16x16px for toggle buttons
 */
export const ICON_VISUAL = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
`;

/**
 * Raw/Code mode icon - Angle brackets
 * Represents raw code/text view mode - 16x16px for toggle buttons
 */
export const ICON_RAW = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
`;

/**
 * Navigation Forward icon - Triangle pointing right
 * For next/forward step navigation - 16x16px
 */
export const ICON_NAV_FORWARD = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <path d="M4.25 3l1.166-.624 8 5.333v1.248l-8 5.334-1.166-.624V3z"></path>
    </svg>
`;

/**
 * Navigation Backward icon - Triangle pointing left
 * For previous/back step navigation - 16x16px
 */
export const ICON_NAV_BACKWARD = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" transform="matrix(-1, 0, 0, 1, 0, 0)">
        <path d="M4.25 3l1.166-.624 8 5.333v1.248l-8 5.334-1.166-.624V3z"></path>
    </svg>
`;

/**
 * Navigation Start icon - Skip to beginning
 * For jump to first step - 16x16px
 */
export const ICON_NAV_START = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" transform="matrix(-1, 0, 0, 1, 0, 0)">
        <path d="M2.125 2H4.375v12H2.125V2z"></path>
        <path d="M6.25 3l1.186-.61 7 5v1.22l-7 5L6.25 13V3z"></path>
    </svg>
`;

/**
 * Navigation End icon - Skip to end
 * For jump to last step - 16x16px
 */
export const ICON_NAV_END = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <path d="M2.125 2H4.375v12H2.125V2z"></path>
        <path d="M6.25 3l1.186-.61 7 5v1.22l-7 5L6.25 13V3z"></path>
    </svg>
`;

// ============================================
// ICON REGISTRY
// ============================================

/**
 * Icon registry for easy access
 * All icons are complete SVG elements ready to use
 */
export const ICONS = {
    COPY: ICON_COPY,
    CHECK: ICON_CHECK,
    VISUAL: ICON_VISUAL,
    RAW: ICON_RAW,
    NAV_FORWARD: ICON_NAV_FORWARD,
    NAV_BACKWARD: ICON_NAV_BACKWARD,
    NAV_START: ICON_NAV_START,
    NAV_END: ICON_NAV_END
};

/**
 * Get icon by name (string-based access)
 * @param {string} iconName - Name of the icon
 * @returns {string} Complete SVG markup
 */
export function getIcon(iconName) {
    const iconMap = {
        'copy': ICON_COPY,
        'check': ICON_CHECK,
        'visual': ICON_VISUAL,
        'raw': ICON_RAW,
        'nav-forward': ICON_NAV_FORWARD,
        'nav-backward': ICON_NAV_BACKWARD,
        'nav-start': ICON_NAV_START,
        'nav-end': ICON_NAV_END
    };

    return iconMap[iconName.toLowerCase()] || '';
}

// Default export for convenience
export default ICONS;

