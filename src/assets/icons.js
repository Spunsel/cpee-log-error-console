/**
 * SVG Icons Library
 * Centralized storage for all SVG icons used in the CPEE Log Error Console
 * 
 * All icons are stored as complete SVG elements with proper attributes:
 * - Dimensions (width, height)
 * - ViewBox for scalability
 * - currentColor for dynamic coloring
 * - Stroke-based design for clean rendering
 *
 * ALL ICONS ARE COPIED FROM https://www.svgrepo.com/

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
 * Visual/Graph mode icon - Network/Graph symbol
 * Represents visual/graphical view mode - 16x16px for toggle buttons
 * Network/graph icon representing visual connections and relationships
 */
export const ICON_VISUAL = `
    <svg fill="currentColor" viewBox="-1.28 -1.28 34.56 34.56" width="16" height="16" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="0.8640000000000001">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M29.5 7c-1.381 0-2.5 1.12-2.5 2.5 0 0.284 0.058 0.551 0.144 0.805l-6.094 5.247c-0.427-0.341-0.961-0.553-1.55-0.553-0.68 0-1.294 0.273-1.744 0.713l-4.774-2.39c-0.093-1.296-1.162-2.323-2.482-2.323-1.38 0-2.5 1.12-2.5 2.5 0 0.378 0.090 0.732 0.24 1.053l-4.867 5.612c-0.273-0.102-0.564-0.166-0.873-0.166-1.381 0-2.5 1.119-2.5 2.5s1.119 2.5 2.5 2.5c1.381 0 2.5-1.119 2.5-2.5 0-0.332-0.068-0.649-0.186-0.939l4.946-5.685c0.236 0.073 0.48 0.124 0.74 0.124 0.727 0 1.377-0.316 1.834-0.813l4.669 2.341c0.017 1.367 1.127 2.471 2.497 2.471 1.381 0 2.5-1.119 2.5-2.5 0-0.044-0.011-0.086-0.013-0.13l6.503-5.587c0.309 0.137 0.649 0.216 1.010 0.216 1.381 0 2.5-1.119 2.5-2.5s-1.119-2.5-2.5-2.5z"></path>
        </g>
    </svg>
`;

/**
 * Raw/Code mode icon - Angle brackets
 * Represents raw code/text view mode - 16x16px for toggle buttons
 * Thicker stroke (2.5) to match skip button style
 */
export const ICON_RAW = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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

/**
 * Navigation Skip icon - Jump to arbitrary step
 * Represents skipping/jumping to a specific step - 16x16px
 * Design: Forward arrow with location pin representing jump-to functionality
 */
export const ICON_NAV_SKIP = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M14.25 5.75v-4h-1.5v2.542c-1.145-1.359-2.911-2.209-4.84-2.209-3.177 0-5.92 2.307-6.16 5.398l-.02.269h1.501l.022-.226c.212-2.195 2.202-3.94 4.656-3.94 1.736 0 3.244.875 4.05 2.166h-2.83v1.5h4.163l.962-.975V5.75h-.004zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path>
        </g>
    </svg>
`;

/**
 * Search icon - Magnifying glass for search functionality
 * Represents search/find functionality - 16x16px
 * Design: Magnifying glass with search circle
 */
export const ICON_SEARCH = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M15.7955 15.8111L21 21M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"/>
        </g>
    </svg>
`;

/**
 * Clear Search icon - X mark to clear search
 * Represents clearing/canceling search - 16x16px
 * Design: Simple X mark
 */
export const ICON_CLEAR_SEARCH = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M8 8L16 16"/>
            <path d="M16 8L8 16"/>
        </g>
    </svg>
`;

/**
 * Search Next icon - Right arrow for next match
 * Represents navigating to next search result - 16x16px
 * Design: Right-pointing arrow
 */
export const ICON_SEARCH_NEXT = `
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4L10 8L6 12L4.5 10.5L7 8L4.5 5.5L6 4Z"/>
    </svg>
`;

/**
 * Search Previous icon - Left arrow for previous match
 * Represents navigating to previous search result - 16x16px
 * Design: Left-pointing arrow
 */
export const ICON_SEARCH_PREV = `
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 4L6 8L10 12L11.5 10.5L9 8L11.5 5.5L10 4Z"/>
    </svg>
`;

/**
 * Sidebar Collapse icon - Sidebar collapsing with double chevrons pointing inward
 * Represents collapsing/hiding the sidebar - 16x16px
 * Design: Double chevrons pointing inward representing sidebar collapse
 */
export const ICON_SIDEBAR_COLLAPSE = `
    <svg viewBox="-32 0 512 512" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <path d="M223.7 239l136-136c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9L319.9 256l96.4 96.4c9.4 9.4 9.4 24.6 0 33.9L393.7 409c-9.4 9.4-24.6 9.4-33.9 0l-136-136c-9.5-9.4-9.5-24.6-.1-34zm-192 34l136 136c9.4 9.4 24.6 9.4 33.9 0l22.6-22.6c9.4-9.4 9.4-24.6 0-33.9L127.9 256l96.4-96.4c9.4-9.4 9.4-24.6 0-33.9L201.7 103c-9.4-9.4-24.6-9.4-33.9 0l-136 136c-9.5 9.4-9.5 24.6-.1 34z"></path>
    </svg>
`;

/**
 * Sidebar Expand icon - Sidebar expanding with double chevrons pointing outward
 * Represents expanding/showing the sidebar - 16x16px
 * Design: Double chevrons pointing outward representing sidebar expansion
 */
export const ICON_SIDEBAR_EXPAND = `
    <svg viewBox="-32 0 512 512" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" transform="scale(-1, 1)">
        <path d="M223.7 239l136-136c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9L319.9 256l96.4 96.4c9.4 9.4 9.4 24.6 0 33.9L393.7 409c-9.4 9.4-24.6 9.4-33.9 0l-136-136c-9.5-9.4-9.5-24.6-.1-34zm-192 34l136 136c9.4 9.4 24.6 9.4 33.9 0l22.6-22.6c9.4-9.4 9.4-24.6 0-33.9L127.9 256l96.4-96.4c9.4-9.4 9.4-24.6 0-33.9L201.7 103c-9.4-9.4-24.6-9.4-33.9 0l-136 136c-9.5 9.4-9.5 24.6-.1 34z"></path>
    </svg>
`;

/**
 * App Console Debug Icon - Terminal with debugging symbols
 * Represents the debug console application - 64x64px (200% of original)
 */
export const ICON_APP = `
    <svg viewBox="-5.08 -5.08 60.96 60.96" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" fill="#000000" stroke="#000000" width="64" height="64">
        <g id="SVGRepo_bgCarrier" stroke-width="0" transform="translate(0,0), scale(1)">
            <rect x="-5.08" y="-5.08" width="60.96" height="60.96" rx="30.48" fill="#c2d1ff" strokewidth="0"></rect>
        </g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="1.6256"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill="none" stroke="#2563eb" stroke-width="3.175" d="M27.071 31.527a4.456 4.456 0 0 1 4.456-4.456h8.912a4.456 4.456 0 0 1 4.456 4.456v8.912a4.456 4.456 0 0 1-4.456 4.456h-8.912a4.456 4.456 0 0 1-4.456-4.456z"></path>
            <path fill-rule="evenodd" d="M19.686 11.658a3.163 3.163 0 0 1 3.134-2.783h2.932c1.595 0 2.946 1.2 3.134 2.783l.227 1.901c.035.296.278.693.778.99.508.304.972.321 1.264.196l1.767-.757a3.163 3.163 0 0 1 3.977 1.323l1.467 2.539a3.163 3.163 0 0 1-.844 4.106l-1.626 1.216h-3.693c.214-.987.73-1.958 1.65-2.645l1.536-1.15-1.302-2.253-1.613.692h-.002c-1.513.65-3.107.31-4.292-.395-1.143-.681-2.196-1.87-2.386-3.466l-.207-1.738h-2.602l-.169 1.415c-.205 1.728-1.383 2.99-2.63 3.692-1.223.69-2.85 1.023-4.395.36l-1.306-.56-1.301 2.254 1.006.753c1.403 1.049 1.926 2.703 1.926 4.154 0 1.452-.523 3.106-1.926 4.155l-1.006.753 1.3 2.254 1.307-.56c1.546-.664 3.172-.33 4.396.36 1.246.702 2.424 1.964 2.63 3.692l.168 1.415h.187v3.342h-.352a3.163 3.163 0 0 1-3.134-2.783l-.188-1.58c-.044-.368-.353-.837-.952-1.175-.572-.323-1.094-.347-1.438-.2l-1.457.625a3.163 3.163 0 0 1-3.978-1.323l-1.466-2.539a3.163 3.163 0 0 1 .844-4.106l1.138-.851c.326-.244.585-.765.585-1.478 0-.714-.259-1.235-.585-1.479l-1.138-.851a3.163 3.163 0 0 1-.844-4.106l1.466-2.54a3.163 3.163 0 0 1 3.978-1.322l1.457.625c.344.147.866.123 1.438-.2.6-.338.908-.807.952-1.176z" clip-rule="evenodd"></path>
            <path fill-rule="evenodd" d="M24.286 18.716a5.57 5.57 0 0 0-1.114 11.029v-.446a6.1 6.1 0 0 1 .689-2.825 2.229 2.229 0 1 1 2.613-2.613 6.1 6.1 0 0 1 2.825-.689h.446a5.572 5.572 0 0 0-5.459-4.456z" clip-rule="evenodd"></path>
            <path fill-rule="evenodd" d="M7.575 9.246c0-.922.749-1.67 1.671-1.67h30.08c.922 0 1.67.748 1.67 1.67v13.925h1.672c.579 0 1.14.08 1.67.231V9.246a5.013 5.013 0 0 0-5.012-5.013H9.246a5.013 5.013 0 0 0-5.013 5.013v30.08a5.013 5.013 0 0 0 5.014 5.012h14.156a6.132 6.132 0 0 1-.231-1.67v-1.672H9.247a1.671 1.671 0 0 1-1.671-1.671z" clip-rule="evenodd"></path>
            <path fill="none" stroke="#2563eb" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.117" d="M33.198 32.084h2.785a3.9 3.9 0 0 1 0 7.798h-2.785z"></path>
        </g>
    </svg>
`;

/**
 * App Favicon Icon - 32x32px version of app icon for browser tab
 * Same design as ICON_APP but optimized for small favicon sizes
 */
export const ICON_APP_FAVICON = `
    <svg viewBox="-5.08 -5.08 60.96 60.96" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" fill="#000000" stroke="#000000" width="32" height="32">
        <g id="SVGRepo_bgCarrier" stroke-width="0" transform="translate(0,0), scale(1)">
            <rect x="-5.08" y="-5.08" width="60.96" height="60.96" rx="30.48" fill="#c2d1ff" strokewidth="0"></rect>
        </g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="1.6256"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill="none" stroke="#2563eb" stroke-width="3.175" d="M27.071 31.527a4.456 4.456 0 0 1 4.456-4.456h8.912a4.456 4.456 0 0 1 4.456 4.456v8.912a4.456 4.456 0 0 1-4.456 4.456h-8.912a4.456 4.456 0 0 1-4.456-4.456z"></path>
            <path fill-rule="evenodd" d="M19.686 11.658a3.163 3.163 0 0 1 3.134-2.783h2.932c1.595 0 2.946 1.2 3.134 2.783l.227 1.901c.035.296.278.693.778.99.508.304.972.321 1.264.196l1.767-.757a3.163 3.163 0 0 1 3.977 1.323l1.467 2.539a3.163 3.163 0 0 1-.844 4.106l-1.626 1.216h-3.693c.214-.987.73-1.958 1.65-2.645l1.536-1.15-1.302-2.253-1.613.692h-.002c-1.513.65-3.107.31-4.292-.395-1.143-.681-2.196-1.87-2.386-3.466l-.207-1.738h-2.602l-.169 1.415c-.205 1.728-1.383 2.99-2.63 3.692-1.223.69-2.85 1.023-4.395.36l-1.306-.56-1.301 2.254 1.006.753c1.403 1.049 1.926 2.703 1.926 4.154 0 1.452-.523 3.106-1.926 4.155l-1.006.753 1.3 2.254 1.307-.56c1.546-.664 3.172-.33 4.396.36 1.246.702 2.424 1.964 2.63 3.692l.168 1.415h.187v3.342h-.352a3.163 3.163 0 0 1-3.134-2.783l-.188-1.58c-.044-.368-.353-.837-.952-1.175-.572-.323-1.094-.347-1.438-.2l-1.457.625a3.163 3.163 0 0 1-3.978-1.323l-1.466-2.539a3.163 3.163 0 0 1 .844-4.106l1.138-.851c.326-.244.585-.765.585-1.478 0-.714-.259-1.235-.585-1.479l-1.138-.851a3.163 3.163 0 0 1-.844-4.106l1.466-2.54a3.163 3.163 0 0 1 3.978-1.322l1.457.625c.344.147.866.123 1.438-.2.6-.338.908-.807.952-1.176z" clip-rule="evenodd"></path>
            <path fill-rule="evenodd" d="M24.286 18.716a5.57 5.57 0 0 0-1.114 11.029v-.446a6.1 6.1 0 0 1 .689-2.825 2.229 2.229 0 1 1 2.613-2.613 6.1 6.1 0 0 1 2.825-.689h.446a5.572 5.572 0 0 0-5.459-4.456z" clip-rule="evenodd"></path>
            <path fill-rule="evenodd" d="M7.575 9.246c0-.922.749-1.67 1.671-1.67h30.08c.922 0 1.67.748 1.67 1.67v13.925h1.672c.579 0 1.14.08 1.67.231V9.246a5.013 5.013 0 0 0-5.012-5.013H9.246a5.013 5.013 0 0 0-5.013 5.013v30.08a5.013 5.013 0 0 0 5.014 5.012h14.156a6.132 6.132 0 0 1-.231-1.67v-1.672H9.247a1.671 1.671 0 0 1-1.671-1.671z" clip-rule="evenodd"></path>
            <path fill="none" stroke="#2563eb" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.117" d="M33.198 32.084h2.785a3.9 3.9 0 0 1 0 7.798h-2.785z"></path>
        </g>
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
    NAV_END: ICON_NAV_END,
    NAV_SKIP: ICON_NAV_SKIP,
    SIDEBAR_COLLAPSE: ICON_SIDEBAR_COLLAPSE,
    SIDEBAR_EXPAND: ICON_SIDEBAR_EXPAND,
    APP: ICON_APP,
    // Search functionality icons
    SEARCH: ICON_SEARCH,
    CLEAR_SEARCH: ICON_CLEAR_SEARCH,
    SEARCH_NEXT: ICON_SEARCH_NEXT,
    SEARCH_PREV: ICON_SEARCH_PREV,
    APP_FAVICON: ICON_APP_FAVICON
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
        'nav-end': ICON_NAV_END,
        'nav-skip': ICON_NAV_SKIP,
        'sidebar-collapse': ICON_SIDEBAR_COLLAPSE,
        'sidebar-expand': ICON_SIDEBAR_EXPAND,
        'app': ICON_APP,
        'app-favicon': ICON_APP_FAVICON,
        // Search functionality icons
        'search': ICON_SEARCH,
        'clear-search': ICON_CLEAR_SEARCH,
        'search-next': ICON_SEARCH_NEXT,
        'search-prev': ICON_SEARCH_PREV
    };

    return iconMap[iconName.toLowerCase()] || '';
}

/**
 * Create step number icon SVG element
 * Generates a blue circular icon with white step number text
 * Supports unlimited step numbers (1, 2, 3, ..., 100, etc.)
 * @param {number} stepNumber - Step number to display
 * @returns {HTMLElement} SVG element with step number
 */
export function createStepNumberIcon(stepNumber) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'step-number-icon');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '28');
    svg.setAttribute('viewBox', '0 0 28 28');
    
    // Blue circle background
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '14');
    circle.setAttribute('cy', '14');
    circle.setAttribute('r', '14');
    circle.setAttribute('fill', 'var(--primary-color)');
    svg.appendChild(circle);
    
    // White text for step number
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '14');
    text.setAttribute('y', '15');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', '600');
    text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
    text.textContent = stepNumber.toString();
    
    svg.appendChild(text);
    
    return svg;
}

// Default export for convenience
export default ICONS;

