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
                proxy: 'https://corsproxy.io/?',  // Default proxy for CPEE graph/rendering/UUID requests
                logProxy: 'https://api.codetabs.com/v1/proxy?quest=',  // Separate proxy for log fetching
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
                    // active instances
                    98615, 88803, 88782, 88781, 88753, 88741, 88740, 88719, 88503, 85514, 85513, 
                    84963, 84957, 84954, 84953, 84950, 84949, 84946, 84945, 84882, 84747, 84687, 83316, 83313, 
                    /*83270,*/ 83268, 83265, 83264, 83260, 83258, 83256, 83254, 83252, 83242, 83241, 83213, 83199,
                    83193, 83170, 83162, 83131, 83129, 83125, 83124, 82868, 82862, 82268, 82267, 82264, 
                    82263, 82226, 82187, 82151, 82143, 82141, 82120, 82118, 82117, 82116, 82115, 82114, 82072, 
                    82060, 82050, 82025, 82019, 81951, 77655, 77526, 77275, 77237, 77235, 77228, 77050, 77013, 
                    76934, 76762, 76600, 76461, 76403, 76400, 76397, 76385, 75608, 75605, 75050, 75048, 75015, 
                    75001, 75000, 74996, 74992, 74976, 74974, 74971, 74966, 73589, 73557, 73373, 73227, 73190,  
                    // archivated instances
                    // 70783, 65138, 65082, 64998, 64992, 
                    // 64331, 64307, 64300, 64207, 64206, 50800, 50634, 50423, 50217, 42023, 41229, 41220, 38354, 
                    // 37435, 25802, 25741, 25733, 25298, 19044, 18195, 18184, 14972, 12919, 12505, 12377, 12376, 
                    // 12328, 12319, 12318, 12317, 12316, 12315, 12314, 12312, 11540, 10741, 9934, 9808, 9802, 9785, 
                    // 9784, 9779, 7676, 7567, 7491, 7414, 7402, 7401, 7400, 6909, 6775, 6770, 6561, 6560, 6554, 
                    // 6552, 6550, 6548, 6547, 6269, 6098, 5919, 5898, 5820, 5814, 5693, 5130, 5128, 5055, 5053, 
                    // 5050, 5049, 5045, 5044, 5040, 5035, 4913, 4908, 4906, 4807, 3833, 2181, 1606, 1574, 1568, 
                    // 1567, 1529, 1528, 1527, 1524, 1523, 1510, 1467, 1465, 1393, 1388, 1317, 1314, 1266, 1258, 
                    // 1134, 1133, 1132, 1126, 1124, 1123, 1118, 1098, 1091, 1087, 1086, 1069, 1055, 1047, 1046, 
                    // 1039, 1021, 975, 972, 967, 930, 926, 920, 914, 890, 860, 853, 852, 850, 849, 845, 694, 665, 
                    // 664, 561, 559, 558, 461, 460, 457, 449, 424, 384, 378, 377, 361, 266, 262, 260, 259, 214, 193
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
            interRequestDelay: 1000,  // Delay between consecutive log fetch requests (in milliseconds) - 200ms = 5 requests/second
            scanConcurrency: 5  // Number of concurrent instance checks during scanning - set to 1 for rate limiting
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
                // Theme resources loaded from cpee.org - CORS proxy handles rngs/*.rng and symbols/*.svg
                themeBaseUrl: 'https://cpee.org/flow/themes',
                themePath: 'https://cpee.org/flow/themes/presetaltid/theme.js',
                cssPath: 'https://cpee.org/flow/css/wfadaptor.css',
                baseThemePath: 'https://cpee.org/flow/themes/base.js',
                wfadaptorPath: 'https://cpee.org/flow/js/wfadaptor.js'
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
                loadInstance: 'load-instance',
                scanStartInput: 'scan-start-input',
                scanEndInput: 'scan-end-input',
                scanInstances: 'scan-instances',
                loadAllInstances: 'load-all-instances',
                loadAllKnownInstances: 'load-all-known-instances',
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
                
                
                // UI elements
                darkModeToggleContainer: 'dark-mode-toggle-container',
                hideTitleButtonContainer: 'hide-title-button-container',
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
            // themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-coldark-cold.min.css',
            // themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-base16-ateliersulphurpool.light.min.css',
            themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-duotone-light.min.css',

            autoloaderPath: 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/',
            languages: ['xml', 'mermaid'],
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
            codeBlockBackground: 'var(--surface-color)',
            colors: {
                tag: '#374151',
                attrName: '#2563eb',
                attrValue: '#b91c1c',
                punctuation: '#9ca3af',
                textContent: '#008000',
                dark: {
                    tag: '#a8b8d0',
                    attrName: '#6ba3f5',
                    attrValue: '#f5a5a5',
                    punctuation: '#94a3b8',
                    textContent: '#86efac'
                }
            },
            mermaid: {
                id: '#b91c1c',
                punctuation: '#9ca3af',
                parentheses: '#008000',
                condition: '#2563eb',
                default: '#374151',
                dark: {
                    id: '#f5a5a5',
                    punctuation: '#94a3b8',
                    parentheses: '#86efac',
                    condition: '#6ba3f5',
                    default: '#a8b8d0'
                }
            },
            trace: {
                punctuation: '#9ca3af',
                keys: '#000000',
                ids: '#b91c1c',
                tasks: '#008000',
                dark: {
                    punctuation: '#94a3b8',
                    keys: '#b8c5d8',
                    ids: '#f5a5a5',
                    tasks: '#86efac'
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
        try {
            const keys = path.split('.');
            let current = this.config;
            
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.warn(`ConfigManager: Error checking path '${path}':`, error);
            return false;
        }
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
            if (!config.api.cors?.proxy) {
                result.warnings.push('No CORS proxy configured');
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
                    title: 'Filter duplicate control flow arrows in Mermaid Graphs',
                    status: 'closed',
                    labels: ['mermaid preprocessing', 'feature'],
                    date: '2025-11-11',
                    description: 'Made control flow arrows unique, e.g.: "gw40s:exclusivegateway:{x}-->gw40e:exclusivegateway:{x}" appears 20+ times in 1465. Resolved "Too many edges" mermaid rendering error (1465)'
                },
                {
                    title: 'Fix faulty Mermaid Trace calculation',
                    status: 'closed',
                    labels: ['mermaid preprocessing', 'traces', 'bug'],
                    date: '2025-11-11',
                    description: '"{AND}" was missing after ":parallelgateway:" edges, causing edges not to be recognized as parallel AND-join or AND-split (5040)'
                },
                {
                    title: 'Add logic for reachability + bounds structure',
                    status: 'closed',
                    labels: ['traces', 'feature'],
                    date: null,
                    description: null
                },
                {
                    title: 'Improve cross-sectional highlighting',
                    status: 'closed',
                    labels: ['cross sectional highlighting', 'feature'],
                    date: null,
                    description: 'Include script tasks, message events, and other non-standard node types (6548)'
                },


            
                {
                    title: 'Task/Gateway hover functionality',
                    status: 'open',
                    labels: ['feature'],
                    date: null,
                    description: 'On Task/Gateway hover: show alt_id, id, (confidence of match)'
                }
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
