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
 * Log mode icon - Document/file icon
 * Represents log view mode - displays un-preprocessed Mermaid code - 16x16px for toggle buttons
 */
export const ICON_LOG = `
    <svg fill="currentColor" width="16" height="16" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 548.291 548.291" xml:space="preserve">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <g>
                <path d="M486.201,196.124h-13.166V132.59c0-0.396-0.062-0.795-0.115-1.196c-0.021-2.523-0.825-5-2.552-6.963L364.657,3.677 c-0.033-0.031-0.064-0.042-0.085-0.073c-0.63-0.707-1.364-1.292-2.143-1.795c-0.229-0.157-0.461-0.286-0.702-0.421 c-0.672-0.366-1.387-0.671-2.121-0.892c-0.2-0.055-0.379-0.136-0.577-0.188C358.23,0.118,357.401,0,356.562,0H96.757 C84.894,0,75.256,9.651,75.256,21.502v174.613H62.092c-16.971,0-30.732,13.756-30.732,30.733v159.812 c0,16.968,13.761,30.731,30.732,30.731h13.164V526.79c0,11.854,9.638,21.501,21.501,21.501h354.776 c11.853,0,21.501-9.647,21.501-21.501V417.392h13.166c16.966,0,30.729-13.764,30.729-30.731V226.854 C516.93,209.872,503.167,196.124,486.201,196.124z M96.757,21.502h249.054v110.009c0,5.939,4.817,10.75,10.751,10.75h94.972v53.861 H96.757V21.502z M317.816,303.427c0,47.77-28.973,76.746-71.558,76.746c-43.234,0-68.531-32.641-68.531-74.152 c0-43.679,27.887-76.319,70.906-76.319C293.389,229.702,317.816,263.213,317.816,303.427z M82.153,377.79V232.085h33.073v118.039 h57.944v27.66H82.153V377.79z M451.534,520.962H96.757v-103.57h354.776V520.962z M461.176,371.092 c-10.162,3.454-29.402,8.209-48.641,8.209c-26.589,0-45.833-6.698-59.24-19.664c-13.396-12.535-20.75-31.568-20.529-52.967 c0.214-48.436,35.448-76.108,83.229-76.108c18.814,0,33.292,3.688,40.431,7.139l-6.92,26.37 c-7.999-3.457-17.942-6.268-33.942-6.268c-27.449,0-48.209,15.567-48.209,47.134c0,30.049,18.807,47.771,45.831,47.771 c7.564,0,13.623-0.852,16.21-2.152v-30.488h-22.478v-25.723h54.258V371.092L461.176,371.092z"></path>
                <path d="M212.533,305.37c0,28.535,13.407,48.64,35.452,48.64c22.268,0,35.021-21.186,35.021-49.5 c0-26.153-12.539-48.655-35.237-48.655C225.504,255.854,212.533,277.047,212.533,305.37z"></path>
            </g>
        </g>
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
 * Graph Scale icon - Scale/resize graph
 * Represents scaling/resizing functionality for graphs - 24x24px
 * Design: Document with scaling arrows
 */
export const ICON_GRAPH_SCALE = `
    <svg viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" fill="currentColor">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>scale_line</title>
            <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                <g id="Design" transform="translate(-192.000000, -96.000000)" fill-rule="nonzero">
                    <g id="scale_line" transform="translate(192.000000, 96.000000)">
                        <path d="M24,0 L24,24 L0,24 L0,0 L24,0 Z M12.5934901,23.257841 L12.5819402,23.2595131 L12.5108777,23.2950439 L12.4918791,23.2987469 L12.4918791,23.2987469 L12.4767152,23.2950439 L12.4056548,23.2595131 C12.3958229,23.2563662 12.3870493,23.2590235 12.3821421,23.2649074 L12.3780323,23.275831 L12.360941,23.7031097 L12.3658947,23.7234994 L12.3769048,23.7357139 L12.4804777,23.8096931 L12.4953491,23.8136134 L12.4953491,23.8136134 L12.5071152,23.8096931 L12.6106902,23.7357139 L12.6232938,23.7196733 L12.6232938,23.7196733 L12.6266527,23.7031097 L12.609561,23.275831 C12.6075724,23.2657013 12.6010112,23.2592993 12.5934901,23.257841 L12.5934901,23.257841 Z M12.8583906,23.1452862 L12.8445485,23.1473072 L12.6598443,23.2396597 L12.6498822,23.2499052 L12.6498822,23.2499052 L12.6471943,23.2611114 L12.6650943,23.6906389 L12.6699349,23.7034178 L12.6699349,23.7034178 L12.678386,23.7104931 L12.8793402,23.8032389 C12.8914285,23.8068999 12.9022333,23.8029875 12.9078286,23.7952264 L12.9118235,23.7811639 L12.8776777,23.1665331 C12.8752882,23.1545897 12.8674102,23.1470016 12.8583906,23.1452862 L12.8583906,23.1452862 Z M12.1430473,23.1473072 C12.1332178,23.1423925 12.1221763,23.1452606 12.1156365,23.1525954 L12.1099173,23.1665331 L12.0757714,23.7811639 C12.0751323,23.7926639 12.0828099,23.8018602 12.0926481,23.8045676 L12.108256,23.8032389 L12.3092106,23.7104931 L12.3186497,23.7024347 L12.3186497,23.7024347 L12.3225043,23.6906389 L12.340401,23.2611114 L12.337245,23.2485176 L12.337245,23.2485176 L12.3277531,23.2396597 L12.1430473,23.1473072 Z" id="MingCute" fill-rule="nonzero"></path>
                        <path d="M11,3 C11.5523,3 12,3.44772 12,4 C12,4.51283143 11.613973,4.93550653 11.1166239,4.9932722 L11,5 L5,5 L5,19 L19,19 L19,13 C19,12.4477 19.4477,12 20,12 C20.51285,12 20.9355092,12.386027 20.9932725,12.8833761 L21,13 L21,19 C21,20.0543909 20.18415,20.9181678 19.1492661,20.9945144 L19,21 L5,21 C3.94563773,21 3.08183483,20.18415 3.00548573,19.1492661 L3,19 L3,5 C3,3.94563773 3.81587733,3.08183483 4.85073759,3.00548573 L5,3 L11,3 Z M19.75,3 C20.4404,3 21,3.55964 21,4.25 L21,8 C21,8.55228 20.5523,9 20,9 C19.4477,9 19,8.55228 19,8 L19,6.41421 L12.4142,13 L14,13 C14.5523,13 15,13.4477 15,14 C15,14.5523 14.5523,15 14,15 L10.25,15 C9.55964,15 9,14.4404 9,13.75 L9,10 C9,9.44772 9.44772,9 10,9 C10.5523,9 11,9.44772 11,10 L11,11.5858 L17.5858,5 L16,5 C15.4477,5 15,4.55228 15,4 C15,3.44772 15.4477,3 16,3 L19.75,3 Z" id="形状" fill="currentColor"></path>
                    </g>
                </g>
            </g>
        </g>
    </svg>
`;

/**
 * Theme icon - Book icon for theme selection
 * Represents theme selection functionality - 20x20px
 * Design: Blue book with "CSS" text
 */
export const ICON_THEME = `
    <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--twemoji" preserveAspectRatio="xMidYMid meet" fill="currentColor" width="20" height="20">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill="transparent" d="M36 32a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v28z"></path>
            <path d="M5.717 9.156c0-1.55.992-2.418 2.325-2.418s2.325.868 2.325 2.418v17.611c0 1.551-.992 2.418-2.325 2.418s-2.325-.867-2.325-2.418V9.156zm7.44.156c0-1.427.992-2.388 2.387-2.388h5.148c6.945 0 10.914 4.465 10.914 11.348C31.605 24.783 27.389 29 21.001 29h-5.395c-1.023 0-2.449-.559-2.449-2.325V9.312zm4.65 15.409h3.132c4 0 5.828-2.945 5.828-6.666c0-3.969-1.859-6.852-6.139-6.852h-2.822v13.518z" fill="currentColor"></path>
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
 * Simple Less Than icon - < symbol
 * Represents previous/left navigation - 16x16px
 */
export const ICON_LT = `
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 4L6 8L10 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
`;

/**
 * Simple Greater Than icon - > symbol
 * Represents next/right navigation - 16x16px
 */
export const ICON_GT = `
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
`;

/**
 * Warning Expand icon - Double chevrons pointing down
 * Represents expanding warning details - 16x16px for warning panel toggle
 */
export const ICON_WARNING_EXPAND = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" transform="matrix(1, 0, 0, -1, 0, 0)">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M5 19L11.2929 12.7071C11.6834 12.3166 12.3166 12.3166 12.7071 12.7071L19 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M5 11L11.2929 4.70711C11.6834 4.31658 12.3166 4.31658 12.7071 4.70711L19 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>
    </svg>
`;

/**
 * Warning Collapse icon - Double chevrons pointing up
 * Represents collapsing warning details - 16x16px for warning panel toggle
 */
export const ICON_WARNING_COLLAPSE = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" transform="matrix(-1, 0, 0, 1, 0, 0)">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M5 19L11.2929 12.7071C11.6834 12.3166 12.3166 12.3166 12.7071 12.7071L19 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M5 11L11.2929 4.70711C11.6834 4.31658 12.3166 4.31658 12.7071 4.70711L19 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>
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
 * Sidebar Collapse icon - Sidebar collapsing with double chevrons pointing inward
 * Represents collapsing/hiding the sidebar - 16x16px
 * Design: Double chevrons pointing inward representing sidebar collapse
 */
export const ICON_ACTIONBAR_EXPAND = `
    <svg viewBox="-32 0 512 512" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <path d="M223.7 239l136-136c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9L319.9 256l96.4 96.4c9.4 9.4 9.4 24.6 0 33.9L393.7 409c-9.4 9.4-24.6 9.4-33.9 0l-136-136c-9.5-9.4-9.5-24.6-.1-34zm-192 34l136 136c9.4 9.4 24.6 9.4 33.9 0l22.6-22.6c9.4-9.4 9.4-24.6 0-33.9L127.9 256l96.4-96.4c9.4-9.4 9.4-24.6 0-33.9L201.7 103c-9.4-9.4-24.6-9.4-33.9 0l-136 136c-9.5 9.4-9.5 24.6-.1 34z"></path>
    </svg>
`;

/**
 * Sidebar Expand icon - Sidebar expanding with double chevrons pointing outward
 * Represents expanding/showing the sidebar - 16x16px
 * Design: Double chevrons pointing outward representing sidebar expansion
 */
export const ICON_ACTIONBAR_COLLAPSE = `
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

/**
 * Error icon - Filled circle with X mark
 * Represents error/alert state - 24x24px for error indicators
 * Design: Filled circle with X inside
 */
export const ICON_ERROR = `
    <svg viewBox="0 0 512 512" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>error-filled</title>
            <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                <g id="add" fill="currentColor" transform="translate(42.666667, 42.666667)">
                    <path d="M213.333333,3.55271368e-14 C331.136,3.55271368e-14 426.666667,95.5306667 426.666667,213.333333 C426.666667,331.136 331.136,426.666667 213.333333,426.666667 C95.5306667,426.666667 3.55271368e-14,331.136 3.55271368e-14,213.333333 C3.55271368e-14,95.5306667 95.5306667,3.55271368e-14 213.333333,3.55271368e-14 Z M262.250667,134.250667 L213.333333,183.168 L164.416,134.250667 L134.250667,164.416 L183.168,213.333333 L134.250667,262.250667 L164.416,292.416 L213.333333,243.498667 L262.250667,292.416 L292.416,262.250667 L243.498667,213.333333 L292.416,164.416 L262.250667,134.250667 Z" id="Combined-Shape"></path>
                </g>
            </g>
        </g>
    </svg>
`;

/**
 * Warning icon - Triangle with exclamation mark
 * Represents warning/caution state - 24x24px for warning indicators
 * Design: Triangle with exclamation mark inside
 */
export const ICON_WARNING = `
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M22.25,17.55,14.63,3.71a3,3,0,0,0-5.26,0L1.75,17.55A3,3,0,0,0,4.38,22H19.62a3,3,0,0,0,2.63-4.45ZM12,18a1,1,0,1,1,1-1A1,1,0,0,1,12,18Zm1-5a1,1,0,0,1-2,0V9a1,1,0,0,1,2,0Z"></path>
        </g>
    </svg>
`;

/**
 * Moon icon - Dark mode icon
 * Represents dark mode/theme - 20x20px for dark mode toggle
 * Design: Crescent moon
 */
export const ICON_MOON = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </g>
    </svg>
`;

/**
 * Sun icon - Light mode icon
 * Represents light mode/theme - 20x20px for dark mode toggle
 * Design: Sun with rays
 */
export const ICON_SUN = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
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
    LOG: ICON_LOG,
    NAV_FORWARD: ICON_NAV_FORWARD,
    NAV_BACKWARD: ICON_NAV_BACKWARD,
    NAV_START: ICON_NAV_START,
    NAV_END: ICON_NAV_END,
    NAV_SKIP: ICON_NAV_SKIP,
    GRAPH_SCALE: ICON_GRAPH_SCALE,
    THEME: ICON_THEME,
    SIDEBAR_COLLAPSE: ICON_SIDEBAR_COLLAPSE,
    SIDEBAR_EXPAND: ICON_SIDEBAR_EXPAND,
    ACTIONBAR_COLLAPSE: ICON_ACTIONBAR_COLLAPSE,
    ACTIONBAR_EXPAND: ICON_ACTIONBAR_EXPAND,
    WARNING_EXPAND: ICON_WARNING_EXPAND,
    WARNING_COLLAPSE: ICON_WARNING_COLLAPSE,
    APP: ICON_APP,
    // Search functionality icons
    SEARCH: ICON_SEARCH,
    CLEAR_SEARCH: ICON_CLEAR_SEARCH,
    SEARCH_NEXT: ICON_SEARCH_NEXT,
    SEARCH_PREV: ICON_SEARCH_PREV,
    LT: ICON_LT,
    GT: ICON_GT,
    APP_FAVICON: ICON_APP_FAVICON,
    // Error and warning icons
    ERROR: ICON_ERROR,
    WARNING: ICON_WARNING,
    // Dark mode icons
    MOON: ICON_MOON,
    SUN: ICON_SUN
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
        'log': ICON_LOG,
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
        'search-prev': ICON_SEARCH_PREV,
        // Error and warning icons
        'error': ICON_ERROR,
        'warning': ICON_WARNING,
        // Theme icon
        'theme': ICON_THEME,
        // Dark mode icons
        'moon': ICON_MOON,
        'sun': ICON_SUN
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
    text.setAttribute('font-family', 'Adwaita Sans Regular');
    text.textContent = stepNumber.toString();
    
    svg.appendChild(text);
    
    return svg;
}

// Default export for convenience
export default ICONS;

