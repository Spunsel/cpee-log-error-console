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
 * Graph mode icon - Network/Graph symbol
 * Represents graph/visual view mode - 16x16px for toggle buttons
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
 * Cleaned/Preprocessed mode icon - Broom/cleaning symbol
 * Represents cleaned/preprocessed code view mode - 16x16px for toggle buttons
 * Shows preprocessed content (same as what would be rendered visually)
 */
export const ICON_RAW = `
    <svg fill="currentColor" width="16" height="16" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 511.999 511.999" xml:space="preserve">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <g>
                <g>
                    <path d="M296.746,279.798c-4.668-13.065-8.542-23.919-11.204-31.369c-0.683-1.903-2.56-3.029-4.557-2.739 c-7.936,1.152-16.316,1.775-25.02,1.775c-8.653,0-16.998-0.606-24.9-1.758c-1.997-0.29-3.874,0.836-4.557,2.739l-11.221,31.411 c-0.836,2.33,0.435,4.932,2.825,5.572c10.923,2.918,23.697,4.702,37.854,4.702c14.208,0,27.034-1.792,37.973-4.736 C296.328,284.756,297.582,282.12,296.746,279.798z"></path>
                </g>
            </g>
            <g>
                <g>
                    <path d="M307.669,310.382l-2.313-6.468c-0.768-2.15-2.987-3.243-5.154-2.628c-13.116,3.763-28.117,5.914-44.237,5.914 c-16.077,0-31.036-2.133-44.126-5.871c-2.167-0.614-4.395,0.503-5.154,2.628l-2.321,6.502c-0.768,2.15,0.239,4.574,2.364,5.41 c12.954,5.06,29.807,8.397,49.237,8.397c19.49,0,36.386-3.354,49.357-8.448C307.447,314.981,308.437,312.532,307.669,310.382z"></path>
                </g>
            </g>
            <g>
                <g>
                    <path d="M255.078,0.016c-9.429,0.418-16.179,7.45-16.179,17.05v207.795c0,2.022,1.382,3.831,3.371,4.224 c4.284,0.836,8.849,1.314,13.653,1.314c4.838,0,9.429-0.486,13.747-1.331c1.98-0.401,3.362-2.21,3.362-4.232V17.962 C273.032,8.054,264.976-0.419,255.078,0.016z"></path>
                </g>
            </g>
            <g>
                <g>
                    <path d="M366.498,475.143c-0.009-0.026-26.778-74.991-50.244-140.732c-0.811-2.278-3.294-3.354-5.547-2.483 c-15.317,5.922-34.142,9.387-54.741,9.387c-20.557,0-39.339-3.456-54.639-9.353c-2.253-0.87-4.736,0.23-5.547,2.5l-50.185,140.536 c-0.324,0.913-0.495,1.886-0.495,2.867c0,17.596,26.539,25.6,51.2,25.6c3.234,0,6.187-1.826,7.637-4.719l0.896-1.801l0.247,0.503 c2.219,10.718,18.697,14.592,34.108,14.549c2.773-0.008,5.333-1.493,6.869-3.797l9.975-14.959l9.967,14.95 c1.536,2.304,4.096,3.789,6.869,3.797c15.42,0.043,31.898-3.831,34.108-14.549l0.256-0.495l0.896,1.801 c1.451,2.893,4.403,4.719,7.637,4.719c24.303,0,50.389-7.799,51.132-24.875C366.907,478.463,366.796,476.022,366.498,475.143z"></path>
                </g>
            </g>
        </g>
    </svg>
`;

/**
 * Log mode icon - Document/file icon
 * Represents raw view mode - displays un-preprocessed/original code - 16x16px for toggle buttons
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
 * Traces mode icon - Horizontal lines representing execution traces/paths
 * Represents traces view mode - displays all possible execution paths through workflow - 16x16px for toggle buttons
 * Design: Four horizontal lines of varying lengths representing different execution traces
 */
export const ICON_TRACES = `
    <svg fill="currentColor" width="16" height="16" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 463.59 463.59" xml:space="preserve">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <g>
                <g>
                    <path d="M26.775,52.02h201.96c14.364,0,26.01-11.646,26.01-26.01S243.099,0,228.735,0H26.775C12.411,0,0.765,11.646,0.765,26.01 S12.411,52.02,26.775,52.02z"></path>
                    <path d="M26.775,186.66h361.08c14.363,0,26.01-11.646,26.01-26.01c0-14.364-11.646-26.01-26.01-26.01H26.775 c-14.364,0-26.01,11.646-26.01,26.01C0.765,175.014,12.411,186.66,26.775,186.66z"></path>
                    <path d="M26.775,321.3h312.121c14.363,0,26.01-11.646,26.01-26.01c0-14.363-11.646-26.01-26.01-26.01H26.775 c-14.364,0-26.01,11.646-26.01,26.01C0.765,309.654,12.411,321.3,26.775,321.3z"></path>
                    <path d="M436.815,411.57H26.775c-14.364,0-26.01,11.646-26.01,26.01c0,14.364,11.646,26.01,26.01,26.01h410.041 c14.363,0,26.01-11.646,26.01-26.01C462.825,423.217,451.179,411.57,436.815,411.57z"></path>
                </g>
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

/**
 * Info icon - Information indicator
 * Represents information/help content - 20x20px for info buttons
 */
export const ICON_INFO = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </g>
    </svg>
`;

/**
 * Section Collapse icon - Arrow pointing down (rotated)
 * Represents collapsing a section - used when section is expanded (shows collapse icon)
 * 16x16px for section toggle buttons
 */
export const ICON_SECTION_COLLAPSE = `
    <svg viewBox="0 -4.5 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor" transform="matrix(1, 0, 0, -1, 0, 0)">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>arrow_down [#338]</title>
            <desc>Created with Sketch.</desc>
            <defs></defs>
            <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                <g id="Dribbble-Light-Preview" transform="translate(-220.000000, -6684.000000)" fill="currentColor">
                    <g id="icons" transform="translate(56.000000, 160.000000)">
                        <path d="M164.292308,6524.36583 L164.292308,6524.36583 C163.902564,6524.77071 163.902564,6525.42619 164.292308,6525.83004 L172.555873,6534.39267 C173.33636,6535.20244 174.602528,6535.20244 175.383014,6534.39267 L183.70754,6525.76791 C184.093286,6525.36716 184.098283,6524.71997 183.717533,6524.31405 C183.328789,6523.89985 182.68821,6523.89467 182.29347,6524.30266 L174.676479,6532.19636 C174.285736,6532.60124 173.653152,6532.60124 173.262409,6532.19636 L165.705379,6524.36583 C165.315635,6523.96094 164.683051,6523.96094 164.292308,6524.36583" id="arrow_down-[#338]"></path>
                    </g>
                </g>
            </g>
        </g>
    </svg>
`;

/**
 * Section Expand icon - Arrow pointing down
 * Represents expanding a section - used when section is collapsed (shows expand icon)
 * 16x16px for section toggle buttons
 */
export const ICON_SECTION_EXPAND = `
    <svg viewBox="0 -4.5 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor" transform="matrix(1, 0, 0, 1, 0, 0)">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>arrow_down [#338]</title>
            <desc>Created with Sketch.</desc>
            <defs></defs>
            <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                <g id="Dribbble-Light-Preview" transform="translate(-220.000000, -6684.000000)" fill="currentColor">
                    <g id="icons" transform="translate(56.000000, 160.000000)">
                        <path d="M164.292308,6524.36583 L164.292308,6524.36583 C163.902564,6524.77071 163.902564,6525.42619 164.292308,6525.83004 L172.555873,6534.39267 C173.33636,6535.20244 174.602528,6535.20244 175.383014,6534.39267 L183.70754,6525.76791 C184.093286,6525.36716 184.098283,6524.71997 183.717533,6524.31405 C183.328789,6523.89985 182.68821,6523.89467 182.29347,6524.30266 L174.676479,6532.19636 C174.285736,6532.60124 173.653152,6532.60124 173.262409,6532.19636 L165.705379,6524.36583 C165.315635,6523.96094 164.683051,6523.96094 164.292308,6524.36583" id="arrow_down-[#338]"></path>
                    </g>
                </g>
            </g>
        </g>
    </svg>
`;

/**
 * Trace Expand icon - Dropdown arrow pointing down
 * Represents expanding trace details - used when trace is collapsed (shows expand icon)
 * 16x16px for trace toggle buttons
 */
export const ICON_EXPAND_TRACE = `
    <svg fill="currentColor" viewBox="-6.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>dropdown</title>
            <path d="M18.813 11.406l-7.906 9.906c-0.75 0.906-1.906 0.906-2.625 0l-7.906-9.906c-0.75-0.938-0.375-1.656 0.781-1.656h16.875c1.188 0 1.531 0.719 0.781 1.656z"></path>
        </g>
    </svg>
`;

/**
 * Trace Collapse icon - Dropdown arrow pointing up
 * Represents collapsing trace details - used when trace is expanded (shows collapse icon)
 * 16x16px for trace toggle buttons
 */
export const ICON_COLLAPSE_TRACE = `
    <svg fill="currentColor" viewBox="-6.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" transform="matrix(1, 0, 0, -1, 0, 0)">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>dropdown</title>
            <path d="M18.813 11.406l-7.906 9.906c-0.75 0.906-1.906 0.906-2.625 0l-7.906-9.906c-0.75-0.938-0.375-1.656 0.781-1.656h16.875c1.188 0 1.531 0.719 0.781 1.656z"></path>
        </g>
    </svg>
`;

/**
 * Title Collapse icon
 * 16x16px for trace toggle buttons
 */
export const ICON_COLLAPSE_TITLE = `
    <svg fill="currentColor" viewBox="-6.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" transform="matrix(1, 0, 0, -1, 0, 0)">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>dropdown</title>
            <path d="M18.813 11.406l-7.906 9.906c-0.75 0.906-1.906 0.906-2.625 0l-7.906-9.906c-0.75-0.938-0.375-1.656 0.781-1.656h16.875c1.188 0 1.531 0.719 0.781 1.656z"></path>
        </g>
    </svg>
`;

/**
 * Expand Section icon - Vertical expand arrows
 * Represents expanding a section to fill browser height - 20x20px for section expand buttons
 */
export const ICON_EXPAND_SECTION = `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <title>expand-vertical</title>
            <g id="Layer_2" data-name="Layer 2">
                <g id="invisible_box" data-name="invisible box">
                    <rect width="48" height="48" fill="none" stroke="none" stroke-width="0"></rect>
                </g>
                <g id="icons_Q2" data-name="icons Q2">
                    <g>
                        <path d="M28.6,17.4a1.9,1.9,0,0,0,3-.2,2.1,2.1,0,0,0-.2-2.7l-6-5.9a1.9,1.9,0,0,0-2.8,0l-6,5.9a2.1,2.1,0,0,0-.2,2.7,1.9,1.9,0,0,0,3,.2L22,14.8V33.2l-2.6-2.6a1.9,1.9,0,0,0-3,.2,2.1,2.1,0,0,0,.2,2.7l6,5.9a1.9,1.9,0,0,0,2.8,0l6-5.9a2.1,2.1,0,0,0,.2-2.7,1.9,1.9,0,0,0-3-.2L26,33.2V14.8Z"></path>
                        <path d="M6,6H42a2,2,0,0,0,0-4H6A2,2,0,0,0,6,6Z"></path>
                        <path d="M42,42H6a2,2,0,0,0,0,4H42a2,2,0,0,0,0-4Z"></path>
                    </g>
                </g>
            </g>
        </g>
    </svg>
`;

/**
 * Collapse Section icon - Collapse arrows
 * Represents collapsing a section to restore previous size - 20x20px for section collapse buttons
 */
export const ICON_COLLAPSE_SECTION = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" stroke-width="0.352" width="20" height="20">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8zm7-8a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 1 1 .708-.708L7.5 4.293V.5A.5.5 0 0 1 8 0zm-.5 11.707-1.146 1.147a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 11.707V15.5a.5.5 0 0 1-1 0v-3.793z"></path>
        </g>
    </svg>
`;

/**
 * Issue Closed icon - Circle with checkmark
 * Represents a closed/fixed issue - 16x16px for issue status indicators
 * GitHub-style closed issue icon
 */
export const ICON_ISSUE_CLOSED = `
    <svg color="var(--fgColor-done)" aria-hidden="true" focusable="false" aria-label="" class="octicon octicon-issue-closed" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align: text-bottom;">
        <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"></path>
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"></path>
    </svg>
`;

/**
 * Issue Open icon - Circle outline with dot
 * Represents an open issue - 16x16px for issue status indicators
 * GitHub-style open issue icon
 */
export const ICON_ISSUE_OPEN = `
    <svg color="var(--fgColor-open)" aria-hidden="true" focusable="false" aria-label="" class="octicon octicon-issue-opened" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align: text-bottom;">
        <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
    </svg>
`;

/**
 * Comparison Info icon - Circle with exclamation mark
 * Represents trace comparison information/discrepancy - 20x20px for comparison info boxes
 * Design: Circle with exclamation mark (info symbol)
 */
export const ICON_COMPARISON_INFO = `
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill="currentColor" fill-rule="evenodd" d="M10 3a7 7 0 100 14 7 7 0 000-14zm-9 7a9 9 0 1118 0 9 9 0 01-18 0zm8-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm.01 8a1 1 0 102 0V9a1 1 0 10-2 0v5z"></path>
        </g>
    </svg>
`;

/**
 * Download icon - Document with download arrow
 * Represents file download functionality - 20x20px for download buttons
 * Design: Document with downward arrow
 */
export const ICON_DOWNLOAD = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H12M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M17.5 15V21M17.5 21L15 18.5M17.5 21L20 18.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>
    </svg>
`;

/**
 * Minimap icon - Code overview/minimap toggle
 * Represents minimap visibility toggle - 20x20px for action bar buttons
 * Design: Simplified code view with scroll indicator
 */
export const ICON_MINIMAP = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
            <line x1="17" y1="7" x2="17" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="7" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="7" y1="10" x2="11" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="7" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="7" y1="16" x2="10" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </g>
    </svg>
`;

/**
 * View Log icon - Document with "LOG" text for viewing original log on CPEE
 * Represents link to view the original log file on cpee.org - 20x20px for action bar buttons
 * Design: Document with LOG text
 */
export const ICON_VIEW_LOG = `
    <svg fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 548.291 548.291" xml:space="preserve" width="20" height="20">
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
 * Analysis mode icon - Magnifying glass with search circle
 * Represents analysis view mode - displays soundness and boundedness verification results - 16x16px for toggle buttons
 * Design: Magnifying glass with search circle representing analysis/verification
 */
export const ICON_ANALYSIS = `
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32" xml:space="preserve" width="16" height="16" fill="currentColor" aria-hidden="true">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill="currentColor" d="M21,13c0,0.339-0.028,0.672-0.069,1H11c-0.553,0-1-0.448-1-1s0.447-1,1-1h9.931 C20.972,12.328,21,12.661,21,13z M11,10h9.411c-0.295-0.726-0.692-1.398-1.176-2H11c-0.553,0-1,0.448-1,1S10.447,10,11,10z M10,17 c0,0.552,0.447,1,1,1h8.235c0.484-0.602,0.881-1.274,1.176-2H11C10.447,16,10,16.448,10,17z M29.414,29.414 c-0.812,0.812-2.047,0.781-2.828,0l-4-4c-0.522-0.522-0.687-1.259-0.511-1.925l-2.037-2.037C18.13,23.042,15.677,24,13,24 C6.925,24,2,19.075,2,13S6.925,2,13,2s11,4.925,11,11c0,2.677-0.958,5.13-2.549,7.037l2.037,2.037 c0.666-0.176,1.403-0.011,1.925,0.511l4,4C30.195,27.367,30.195,28.633,29.414,29.414z M22,13c0-4.971-4.029-9-9-9s-9,4.029-9,9 c0,4.971,4.029,9,9,9S22,17.971,22,13z"></path>
        </g>
    </svg>
`;

/**
 * Play Trace icon - Circle with play triangle
 * Used for auto-play trace functionality - 16x16px
 * Design: Circle outline with play triangle inside
 */
export const ICON_PLAY_TRACE = `
    <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path fill-rule="evenodd" d="M12,2 C17.5228475,2 22,6.4771525 22,12 C22,17.5228475 17.5228475,22 12,22 C6.4771525,22 2,17.5228475 2,12 C2,6.4771525 6.4771525,2 12,2 Z M12,4 C7.581722,4 4,7.581722 4,12 C4,16.418278 7.581722,20 12,20 C16.418278,20 20,16.418278 20,12 C20,7.581722 16.418278,4 12,4 Z M10.503871,7.1362211 L16.503871,11.1362211 C17.1264642,11.4994005 17.1630874,12.3674256 16.6137404,12.7899986 L10.503871,16.8637789 C9.83721439,17.2526619 9,16.7717908 9,16 L9,8 C9,7.22820917 9.83721439,6.74733806 10.503871,7.1362211 Z"></path>
        </g>
    </svg>
`;

/**
 * Pause Trace icon - Circle with pause bars
 * Used for auto-play trace functionality - 16x16px
 * Design: Circle outline with two pause bars inside
 */
export const ICON_PAUSE_TRACE = `
    <svg fill="currentColor" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M100,15a85,85,0,1,0,85,85A84.93,84.93,0,0,0,100,15Zm0,150a65,65,0,1,1,65-65A64.87,64.87,0,0,1,100,165ZM120,60a10,10,0,0,0-10,10v60a10,10,0,0,0,20,0V70A10,10,0,0,0,120,60ZM80,60A10,10,0,0,0,70,70v60a10,10,0,0,0,20,0V70A10,10,0,0,0,80,60Z"></path>
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
    TRACES: ICON_TRACES,
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
    ERROR: ICON_ERROR,
    WARNING: ICON_WARNING,
    // Dark mode icons
    MOON: ICON_MOON,
    SUN: ICON_SUN,
    INFO: ICON_INFO,
    SECTION_COLLAPSE: ICON_SECTION_COLLAPSE,
    SECTION_EXPAND: ICON_SECTION_EXPAND,
    EXPAND_TRACE: ICON_EXPAND_TRACE,
    COLLAPSE_TRACE: ICON_COLLAPSE_TRACE,
    EXPAND_SECTION: ICON_EXPAND_SECTION,
    COLLAPSE_SECTION: ICON_COLLAPSE_SECTION,
    COLLAPSE_TITLE: ICON_COLLAPSE_TITLE,
    ISSUE_CLOSED: ICON_ISSUE_CLOSED,
    ISSUE_OPEN: ICON_ISSUE_OPEN,
    COMPARISON_INFO: ICON_COMPARISON_INFO,
    ANALYSIS: ICON_ANALYSIS,
    DOWNLOAD: ICON_DOWNLOAD,
    VIEW_LOG: ICON_VIEW_LOG,
    MINIMAP: ICON_MINIMAP,
    PLAY_TRACE: ICON_PLAY_TRACE,
    PAUSE_TRACE: ICON_PAUSE_TRACE
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
        'traces': ICON_TRACES,
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
        'error': ICON_ERROR,
        'warning': ICON_WARNING,
        'theme': ICON_THEME,
        'moon': ICON_MOON,
        'sun': ICON_SUN,
        'info': ICON_INFO,
        'section-collapse': ICON_SECTION_COLLAPSE,
        'section-expand': ICON_SECTION_EXPAND,
        'expand-trace': ICON_EXPAND_TRACE,
        'collapse-trace': ICON_COLLAPSE_TRACE,
        'expand-section': ICON_EXPAND_SECTION,
        'collapse-section': ICON_COLLAPSE_SECTION,
        'issue-closed': ICON_ISSUE_CLOSED,
        'issue-open': ICON_ISSUE_OPEN,
        'comparison-info': ICON_COMPARISON_INFO,
        'analysis': ICON_ANALYSIS,
        'download': ICON_DOWNLOAD,
        'view-log': ICON_VIEW_LOG,
        'minimap': ICON_MINIMAP,
        'play-trace': ICON_PLAY_TRACE,
        'pause-trace': ICON_PAUSE_TRACE
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

