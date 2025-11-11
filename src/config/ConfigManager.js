/**
 * Centralized Configuration Manager
 * Consolidates all configuration settings from scattered files and hardcoded values
 * Provides a single source of truth for all application configuration
 */

export class ConfigManager {
    constructor() {
        this.config = this.loadAllConfigurations();
        this.observers = new Map(); // For configuration change notifications
    }

    /**
     * Load and consolidate all configuration from various sources
     * @returns {Object} Complete configuration object
     */
    loadAllConfigurations() {
        return {
            api: this.loadAPIConfig(),
            ui: this.loadUIConfig(),
            rendering: this.loadRenderingConfig(),
            network: this.loadNetworkConfig(),
            mermaid: this.loadMermaidConfig(),
            cpee: this.loadCPEEConfig(),
            dom: this.loadDOMConfig(),
            timing: this.loadTimingConfig(),
            styling: this.loadStylingConfig(),
            syntaxHighlighting: this.loadSyntaxHighlightingConfig(),
            email: this.loadEmailConfig(),
            recentAdditions: this.loadRecentAdditionsConfig()
        };
    }

    /**
     * Load API configuration
     * @returns {Object} API configuration
     */
    loadAPIConfig() {
        return {
            endpoints: {
                cpeeBase: 'https://cpee.org/flow/engine',
                cpeeLogs: 'https://cpee.org/logs',
                cpeeGraph: 'https://cpee.org/flow/graph.html'
            },
            cors: {
                proxies: [
                    'https://corsproxy.io/?',
                    'https://api.cors.lol/?url=',
                    'https://api.codetabs.com/v1/proxy?quest='
                ],
                timeout: 15000,
                retryCount: 3
            },
            headers: {
                yamlAccept: 'text/plain, application/x-yaml, text/yaml',
                jsonAccept: 'text/plain, application/json, */*'
            }
        };
    }

    /**
     * Load UI configuration
     * @returns {Object} UI configuration
     */
    loadUIConfig() {
        return {
            layout: {
                minHeight: '100vh',
                maxWidth: '1200px',
                containerPadding: '20px',
                sectionSpacing: '20px'
            },
            forms: {
                uuidInput: {
                    maxWidth: '400px',
                    minWidth: '300px',
                    flex: 1
                },
                processNumberInput: {
                    width: '120px'
                }
            },
            navigation: {
                stepControls: {
                    buttonSpacing: '10px',
                    fontSize: '0.9rem'
                },
                sidebar: {
                    width: '250px',
                    minWidth: '200px'
                }
            },
            notifications: {
                successDuration: 2000,
                errorDuration: 3000,
                warningDuration: 2500,
                autoHideDelay: 100
            },
            instances: {
                // Predefined list of CPEE LLM instance process numbers for "Load All CPEE Instances" button
                processNumbers: [
                    7676, 7567, 6775, 6770, 6561, 6560, 6554, 6552, 6550, 6548, 6547, 6098, 5919, 5898, 5820, 5814, 
                    5130, 5128, 5055, 5053, 5050, 5049, 5045, 5044, 5040, 5035, 4913, 4908, 4906, 4807, 3833, 
                    1606, 1529, 1528, 1527, 1524, 1523, 1510, 1467, 1465, 1393, 1388, 1317, 1314, 1266, 1258, 
                    1134, 1133, 1132, 1126, 1124, 1123, 1118, 1098, 1091, 1087, 1086, 1069, 1055, 1047, 1046, 
                    1039, 1021, 975, 972, 967, 930, 926, 920, 914, 890, 860, 853, 852, 850, 849, 845, 694, 665, 
                    664, 561, 559, 558, 461, 460, 457, 449, 424, 384, 378, 377, 361, 266, 262, 260, 259, 214, 193
                ]
            }
        };
    }

    /**
     * Load rendering configuration
     * @returns {Object} Rendering configuration
     */
    loadRenderingConfig() {
        return {
            containers: {
                graphContainer: {
                    minHeight: '100px',
                    width: '100%',
                    height: 'auto',
                    border: 'none',
                    borderRadius: '0',
                    background: 'white',
                    position: 'relative',
                    margin: '0',
                    padding: '0'
                },
                cpeeSection: {
                    height: '400px',
                    maxHeight: '400px',
                    minHeight: '400px',
                    overflowY: 'auto',
                    overflowX: 'auto'
                },
                mermaidSection: {
                    maxHeight: '400px',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    padding: '0'
                }
            },
            svg: {
                defaultHeight: '400px',
                minHeight: '100px',
                padding: '20px',
                namespace: 'http://www.w3.org/2000/svg',
                version: '1.1',
                xmlnsX: 'http://www.w3.org/1999/xlink'
            },
            scaling: {
                // Graph scaling levels - can be any positive numbers
                // Values represent multiplier (e.g., 0.25 = 25%, 1.0 = 100%, 1.5 = 150%)
                levels: [0.4, 0.5, 0.7, 0.8, 1.0],
                // Default scale when no scale is stored
                default: 1.0
            },
            fallback: {
                errorMessage: {
                    margin: '20px',
                    padding: '15px',
                    border: '1px solid #ffc107',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    borderRadius: '4px'
                }
            }
        };
    }

    /**
     * Load network configuration
     * @returns {Object} Network configuration
     */
    loadNetworkConfig() {
        return {
            timeouts: {
                default: 15000,
                libraryLoad: 10000,
                uiAutoHide: 3000,
                transitionDelay: 100
            },
            retries: {
                maxAttempts: 3,
                backoffMultiplier: 1.5,
                initialDelay: 1000
            },
            interRequestDelay: 0.1,  // Delay between consecutive log fetch requests (in milliseconds)
            scanConcurrency: 50  // Number of concurrent instance checks during scanning (default: 50)
        };
    }

    /**
     * Load Mermaid configuration
     * @returns {Object} Mermaid configuration
     */
    loadMermaidConfig() {
        return {
            default: {
                startOnLoad: false,
                theme: 'base',
                securityLevel: 'loose',
                fontFamily: 'Adwaita Sans Regular',
                fontSize: 14,
                maxEdges: 5000,  // Increase edge limit (default is 500)
                suppressErrorRendering: true  // Prevent Mermaid from automatically appending error messages to DOM
            },
            // css: {
            //     textFontSize: '30px',
            //     tspanFontSize: '30px'
            // },
            themeVariables: {
                fontSize: '14px',
                primaryColor: '#ffffff',
                primaryBorderColor: '#000000',
                primaryTextColor: '#000000',
                mainBkg: '#ffffff',
                secondBkg: '#ffffff',
                tertiaryColor: '#ffffff',
                altBackground: '#ffffff',
                nodeBorder: '#000000',
                secondaryBorderColor: '#000000',
                tertiaryBorderColor: '#000000',
                secondaryTextColor: '#000000',
                tertiaryTextColor: '#000000',
                clusterBkg: 'none',
                clusterBorder: '#000000'
            },
            flowchart: {
                htmlLabels: true,
                curve: 'basis',
                padding: 15,
                nodeSpacing: 25,
                rankSpacing: 35,
                useMaxWidth: false
            },
            sequence: {
                diagramMarginX: 25,
                diagramMarginY: 6,
                actorMargin: 25,
                width: 100,
                height: 40,
                boxMargin: 6,
                boxTextMargin: 3,
                noteMargin: 6,
                messageMargin: 20,
                useMaxWidth: false
            },
            gantt: {
                titleTopMargin: 15,
                barHeight: 12,
                fontSize: 8,
                fontFamily: 'Adwaita Sans Regular',
                numberSectionStyles: 4,
                axisFormat: '%Y-%m-%d',
                useMaxWidth: false
            },
            availableThemes: ['base', 'default', 'dark', 'forest', 'neutral']
        };
    }

    /**
     * Load CPEE-specific configuration
     * @returns {Object} CPEE configuration
     */
    loadCPEEConfig() {
        return {
            wfadaptor: {
                themePath: 'src/libs/cpee-layout/themes/presetid/theme.js',
                cssPath: 'https://cpee.org/flow/css/wfadaptor.css', // replaced: 'src/libs/cpee-layout/wfadaptor.css'
                baseThemePath: 'https://cpee.org/flow/themes/base.js', // replaced: 'src/libs/cpee-layout/themes/base.js'
                wfadaptorPath: 'https://cpee.org/flow/js/wfadaptor.js' // replaced: 'src/libs/cpee-layout/wfadaptor.js'
            },
            rendering: {
                minHeight: '100px',
                defaultHeight: '400px',
                padding: '20px',
                backgroundColor: '#ffffff'
            },
            validation: {
                requireDescription: true,
                validateXMLStructure: true,
                checkElementExistence: true
            }
        };
    }

    /**
     * Load DOM-related configuration
     * @returns {Object} DOM configuration
     */
    loadDOMConfig() {
        return {
            elementIds: {
                // Content sections
                processAnalysis: 'process-analysis',
                inputCpeeContent: 'input-cpee-content',
                outputCpeeContent: 'output-cpee-content',
                inputIntermediateContent: 'input-intermediate-content',
                outputIntermediateContent: 'output-intermediate-content',
                userInputContent: 'user-input-content',
                
                // Log display
                rawLogSection: 'raw-log-section',
                rawLogContent: 'raw-log-content',
                viewLog: 'view-log',
                
                // Form elements
                uuidInput: 'uuid-input',
                processNumberInput: 'process-number-input',
                fetchUuid: 'fetch-uuid',
                loadInstance: 'load-instance',
                scanStartInput: 'scan-start-input',
                scanEndInput: 'scan-end-input',
                scanInstances: 'scan-instances',
                loadAllInstances: 'load-all-instances',
                instanceListContainer: 'instance-list-container',
                instanceList: 'instance-list',
                loadAllInstancesListContainer: 'load-all-instances-list-container',
                loadAllInstancesList: 'load-all-instances-list',
                
                // Instance management
                instanceTabs: 'instance-tabs',
                
                // Main app structure
                app: 'app',
                appTitle: 'app-title',
                headerContent: 'header-content',
                
                // Prism theme (static element in HTML)
                prismTheme: 'prism-theme',
                
                // Section IDs (for dynamic access)
                inputCpee: 'input-cpee',
                inputIntermediate: 'input-intermediate',
                outputIntermediate: 'output-intermediate',
                outputCpee: 'output-cpee',
                
                // Instance loader (now has ID in HTML)
                loadSingleInstanceSection: 'load-single-instance-section',
                advancedInstanceLoading: 'advanced-instance-loading',
                
                // UI elements
                darkModeToggleContainer: 'dark-mode-toggle-container',
                bugReportLink: 'bug-report-link',
                
                // Note: The following elements are dynamically created and registered by their components:
                // - themeDropdownTrigger, themeDropdownMenu, themeDropdownContainer (registered by ThemeSelector.initialize())
                // - darkModeToggleBtn, darkModeToggle (registered by DarkModeToggle.initialize())
            },
            classes: {
                hidden: 'hidden',
                transitioning: 'transitioning',
                noContent: 'no-content',
                contentError: 'content-error',
                userInputSection: 'user-input-section',
                rawContentActions: 'raw-content-actions'
            },
            attributes: {
                contentType: 'data-content-type',
                processNumber: 'data-process-number'
            }
        };
    }

    /**
     * Load timing configuration
     * @returns {Object} Timing configuration
     */
    loadTimingConfig() {
        return {
            transitions: {
                fadeIn: 150,
                fadeOut: 100,
                slideIn: 200,
                slideOut: 150
            },
            delays: {
                successMessage: 2000,
                errorMessage: 3000,
                warningMessage: 2500,
                autoHide: 100,
                heightPreservation: 100
            },
            intervals: {
                statusCheck: 1000,
                progressUpdate: 500,
                cacheCleanup: 300000 // 5 minutes
            }
        };
    }

    /**
     * Load styling configuration
     * @returns {Object} Styling configuration
     */
    loadStylingConfig() {
        return {
            colors: {
                primary: '#007bff',
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                background: '#ffffff',
                surface: '#f8f9fa',
                border: '#dee2e6',
                textPrimary: '#212529',
                textSecondary: '#6c757d'
            },
            spacing: {
                xs: '4px',
                sm: '8px',
                md: '16px',
                lg: '24px',
                xl: '32px'
            },
            borderRadius: {
                sm: '4px',
                md: '8px',
                lg: '12px'
            },
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.1)',
                md: '0 2px 4px rgba(0,0,0,0.1)',
                lg: '0 4px 8px rgba(0,0,0,0.1)'
            },
            typography: {
                fontFamily: {
                    primary: 'Adwaita Sans Regular',
                    monospace: 'Adwaita Mono Regular'
                },
                fontSize: {
                    xs: '0.75rem',
                    sm: '0.875rem',
                    md: '1rem',
                    lg: '1.125rem',
                    xl: '1.25rem'
                },
                fontWeight: {
                    normal: '400',
                    medium: '500',
                    semibold: '600',
                    bold: '700'
                }
            }
        };
    }

    /**
     * Load email service configuration
     * @returns {Object} Email service configuration
     */
    loadEmailConfig() {
        return {
            enabled: true, // Set to true to enable email service
            service: 'web3forms', // 'web3forms' (free, no signup), 'emailjs', or 'api'
            // Web3Forms - Free, no signup required (https://web3forms.com/)
            web3forms: {
                accessKey: 'a8d2090e-38eb-4c65-8461-14e6406f181b',
                recipientEmail: 'christian.horne@tum.de'
            }
        };
    }

    /**
     * Load syntax highlighting (Prism.js) configuration
     * @returns {Object} Syntax highlighting configuration
     */
    loadSyntaxHighlightingConfig() {
        return {
            enabled: true,
            highlightOnRender: true,
            // Theme handling (light theme only)
            // themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-coldark-cold.min.css',
            // themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-base16-ateliersulphurpool.light.min.css',
            themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-duotone-light.min.css',

            // Autoloader path for languages
            autoloaderPath: 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/',
            // Explicit languages to ensure are available (informational)
            languages: ['xml', 'mermaid'],
            // Typography overrides for code blocks
            typography: {
                fontSize: '13px',
                fontFamily: 'Adwaita Mono Regular',
                fontFace: {
                    enabled: true,
                    name: 'Adwaita Mono Regular',
                    src: 'src/assets/fonts/adwaita-mono-regular.ttf',
                    weight: '400',
                    style: 'normal'
                }
            },
            // Code block background (entire block background, not individual token backgrounds)
            codeBlockBackground: 'var(--surface-color)', // Background of entire code block (pre element) - null = use theme default
            // Color overrides for syntax highlighting tokens
            colors: {
                // XML/HTML specific - Light mode
                tag: '#374151', // XML tags (e.g., <process>, <task>) - null = use theme default
                attrName: '#2563eb', // Attribute names (e.g., name="value") - modern cyan-teal for crisp readability
                attrValue: '#b91c1c', // Attribute values - vibrant coral-pink that pops beautifully against light background
                punctuation: '#9ca3af', // Punctuation like < > = " - neutral gray-blue, keeps structure subtle
                textContent: '#008000', // Text content inside tags (e.g., "Task X" in <label>Task X</label>) - warm amber focal accent
                // Dark mode colors
                dark: {
                    tag: '#a8b8d0', // Softer light gray for tags
                    attrName: '#6ba3f5', // Softer blue for attribute names
                    attrValue: '#f5a5a5', // Softer red/pink for attribute values
                    punctuation: '#94a3b8', // Softer gray for punctuation
                    textContent: '#86efac' // Softer green for text content
                }
            },
            // Mermaid-specific syntax highlighting colors
            mermaid: {
                // Light mode
                id: '#b91c1c', // Node IDs (e.g., "se", "a2", "gw1s") - red
                punctuation: '#9ca3af', // Punctuation (., :, (, ), -, >, etc.) - gray
                parentheses: '#008000', // Text in parentheses (e.g., "startevent", "Task X") - orange
                condition: '#2563eb', // Conditions in pipes (e.g., |"true"|, |"Results Require"|) - blue
                default: '#374151', // Everything else (keywords, node types) - black
                // Dark mode colors
                dark: {
                    id: '#f5a5a5', // Softer red for node IDs
                    punctuation: '#94a3b8', // Softer gray for punctuation
                    parentheses: '#86efac', // Softer green for parentheses content
                    condition: '#6ba3f5', // Softer blue for conditions
                    default: '#a8b8d0' // Softer light gray for default text
                }
            },
            // Trace JSON-specific syntax highlighting colors
            trace: {
                // JSON specific - Light mode
                punctuation: '#9ca3af', // Punctuation ({, }, ,) - same as colors.punctuation
                keys: '#000000', // JSON keys (id, alt_id, task) - black
                ids: '#b91c1c', // IDs (id, alt_id values) - same as colors.attrValue
                tasks: '#008000', // Tasks (task values) - same as colors.textContent
                // Dark mode colors
                dark: {
                    punctuation: '#94a3b8', // Punctuation ({, }, ,) - same as colors.dark.punctuation
                    keys: '#b8c5d8', // JSON keys (id, alt_id, task) - lighter than punctuation (#94a3b8)
                    ids: '#f5a5a5', // IDs (id, alt_id values) - same as colors.dark.attrValue
                    tasks: '#86efac' // Tasks (task values) - same as colors.dark.textContent
                }
            }             
        };
    }

    /**
     * Get configuration value by path
     * @param {string} path - Dot-separated path to configuration value
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Configuration value or default
     */
    get(path, defaultValue = null) {
        try {
            return path.split('.').reduce((obj, key) => {
                if (obj && typeof obj === 'object' && key in obj) {
                    return obj[key];
                }
                return defaultValue;
            }, this.config);
        } catch (error) {
            console.warn(`ConfigManager: Error accessing path '${path}':`, error);
            return defaultValue;
        }
    }

    /**
     * Set configuration value by path
     * @param {string} path - Dot-separated path to configuration value
     * @param {*} value - Value to set
     */
    set(path, value) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => {
                if (!obj[key] || typeof obj[key] !== 'object') {
                    obj[key] = {};
                }
                return obj[key];
            }, this.config);
            
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // Notify observers of the change
            this.notifyObservers(path, value, oldValue);
            
        } catch (error) {
            console.error(`ConfigManager: Error setting path '${path}':`, error);
        }
    }

    /**
     * Check if configuration path exists
     * @param {string} path - Dot-separated path to check
     * @returns {boolean} True if path exists
     */
    has(path) {
        return this.get(path, undefined) !== undefined;
    }

    /**
     * Get entire configuration object
     * @returns {Object} Complete configuration
     */
    getAll() {
        return JSON.parse(JSON.stringify(this.config)); // Deep clone
    }

    /**
     * Get configuration section
     * @param {string} section - Section name (api, ui, rendering, etc.)
     * @returns {Object} Configuration section
     */
    getSection(section) {
        return this.get(section, {});
    }

    /**
     * Merge configuration with existing values
     * @param {string} path - Dot-separated path to merge into
     * @param {Object} values - Values to merge
     */
    merge(path, values) {
        const existing = this.get(path, {});
        const merged = this.deepMerge(existing, values);
        this.set(path, merged);
    }

    /**
     * Subscribe to configuration changes
     * @param {string} path - Path to watch (supports wildcards with *)
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.observers.has(path)) {
            this.observers.set(path, new Set());
        }
        
        this.observers.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const observers = this.observers.get(path);
            if (observers) {
                observers.delete(callback);
                if (observers.size === 0) {
                    this.observers.delete(path);
                }
            }
        };
    }

    /**
     * Notify observers of configuration changes
     * @param {string} path - Changed path
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    notifyObservers(path, newValue, oldValue) {
        // Notify exact path matches
        const exactObservers = this.observers.get(path);
        if (exactObservers) {
            exactObservers.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('ConfigManager: Observer callback error:', error);
                }
            });
        }

        // Notify wildcard matches
        this.observers.forEach((observers, observerPath) => {
            if (observerPath.includes('*')) {
                const pattern = observerPath.replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(path)) {
                    observers.forEach(callback => {
                        try {
                            callback(newValue, oldValue, path);
                        } catch (error) {
                            console.error('ConfigManager: Observer callback error:', error);
                        }
                    });
                }
            }
        });
    }

    /**
     * Deep merge utility for configuration objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result with errors and warnings
     */
    validate(config = this.config) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Validate required sections
        const requiredSections = ['api', 'ui', 'rendering', 'network'];
        requiredSections.forEach(section => {
            if (!config[section]) {
                result.errors.push(`Missing required section: ${section}`);
                result.valid = false;
            }
        });

        // Validate API configuration
        if (config.api) {
            if (!config.api.endpoints?.cpeeBase) {
                result.errors.push('Missing API endpoint: cpeeBase');
                result.valid = false;
            }
            if (!config.api.cors?.proxies?.length) {
                result.warnings.push('No CORS proxies configured');
            }
        }

        // Validate timing configuration
        if (config.timing) {
            Object.entries(config.timing).forEach(([category, timings]) => {
                Object.entries(timings).forEach(([key, value]) => {
                    if (typeof value === 'number' && value < 0) {
                        result.errors.push(`Invalid timing value: ${category}.${key} = ${value}`);
                        result.valid = false;
                    }
                });
            });
        }

        return result;
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.config = this.loadAllConfigurations();
        this.notifyObservers('*', this.config, null);
    }

    /**
     * Export configuration to JSON string
     * @returns {string} JSON string representation
     */
    export() {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON string
     * @param {string} jsonString - JSON string to import
     * @returns {boolean} True if import successful
     */
    import(jsonString) {
        try {
            const importedConfig = JSON.parse(jsonString);
            const validation = this.validate(importedConfig);
            
            if (validation.valid) {
                this.config = this.deepMerge(this.config, importedConfig);
                this.notifyObservers('*', this.config, null);
                return true;
            } else {
                console.error('ConfigManager: Import validation failed:', validation.errors);
                return false;
            }
        } catch (error) {
            console.error('ConfigManager: Import failed:', error);
            return false;
        }
    }

    /**
     * Load Recent Additions and Fixes configuration
     * @returns {Object} Recent additions and fixes configuration
     */
    loadRecentAdditionsConfig() {
        return {
            issues: [
                {
                    title: 'Fixed CPEE SVG task rendering issue',
                    status: 'closed',
                    labels: ['cpee rendering', 'bug'],
                    date: '2025-11-10',
                    description: 'SVG reference attributes resolve globally -> solved by using namespace IDs for each graph, to avoid clipPath ID collisions (4913)'
                },
                {
                    title: 'Handle CPEE/Mermaid graphs with 6+ parallel branches',
                    status: 'open',
                    labels: ['traces', 'bug'],
                    date: null,
                    description: 'Trace calculation too computationally expensive (maybe reduce number of permutation calculations?) (5055)'
                },
                {
                    title: 'Add CPEE pre-processing (double quotation marks)',
                    status: 'open',
                    labels: ['cpee preprocessing', 'bug'],
                    date: null,
                    description: 'replace double quotation marks inside condition with safe alternative (currently this breaks syntax highlighting and trace calculations) (6547)'
                },
                {
                    title: 'Improve cross-sectional highlighting',
                    status: 'open',
                    labels: ['cross sectional highlighting', 'feature'],
                    date: null,
                    description: 'Extend graph highlighting to gateways and start/endnode'
                },
                {
                    title: 'Improve cross-sectional highlighting',
                    status: 'open',
                    labels: ['cross sectional highlighting', 'feature'],
                    date: null,
                    description: 'Include script tasks, message events, and other non-standard node types (6548)'
                },
                {
                    title: 'Fix faulty Mermaid Trace calculation',
                    status: 'open',
                    labels: ['traces', 'bug'],
                    date: null,
                    description: 'Merm traces not calculated correctly for "AND" gateway? (5040)'
                },
                {
                    title: 'Fix Mermadid Empty Task Parse Error',
                    status: 'open',
                    labels: ['mermaid preprocessing', 'feature'],
                    date: null,
                    description: 'Replace empty tasks with task-placeholder, so mermaid graph renders even if parse error? (6554)'
                },
                {
                    title: 'Filter duplicate control flow arrows in Mermaid Graphs',
                    status: 'open',
                    labels: ['mermaid preprocessing', 'feature'],
                    date: null,
                    description: 'unique control flow arrows, e.g.: "gw40s:exclusivegateway:{x}-->gw40e:exclusivegateway:{x}" appears 20+ times in 1465.This would also resolve "Too many edges" mermaid rendering error (1465)'
                },
                {
                    title: 'Add logic for reachability + bounds structure',
                    status: 'open',
                    labels: ['traces', 'feature'],
                    date: null,
                    description: null
                },
            ]
        };
    }

    /**
     * Get configuration summary for debugging
     * @returns {Object} Configuration summary
     */
    getSummary() {
        return {
            sections: Object.keys(this.config),
            totalKeys: this.countKeys(this.config),
            observers: this.observers.size,
            validation: this.validate()
        };
    }

    /**
     * Count total configuration keys recursively
     * @param {Object} obj - Object to count keys in
     * @returns {number} Total key count
     */
    countKeys(obj) {
        let count = 0;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                count++;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    count += this.countKeys(obj[key]);
                }
            }
        }
        return count;
    }
}

// Create singleton instance
export const configManager = new ConfigManager();

// Export for backward compatibility
export default configManager;
