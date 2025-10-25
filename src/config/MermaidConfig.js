/**
 * Mermaid Configuration
 * Handles Mermaid.js configuration and theme management
 * Provides consistent configuration settings for Mermaid diagrams
 */

export class MermaidConfig {
    
    /**
     * Get default Mermaid configuration
     * @returns {Object} Default configuration object
     */
    static getDefaultConfig() {
        return {
            startOnLoad: false,
            theme: 'base',
            themeVariables: this.getDefaultThemeVariables(),
            securityLevel: 'loose',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 11,
            flowchart: this.getFlowchartConfig(),
            sequence: this.getSequenceConfig(),
            gantt: this.getGanttConfig()
        };
    }

    /**
     * Get default theme variables for consistent CPEE styling
     * @returns {Object} Theme variables object
     */
    static getDefaultThemeVariables() {
        return {
            // Event (circle) styling - white background, black border
            primaryColor: '#ffffff',
            primaryBorderColor: '#000000',
            primaryTextColor: '#000000',
            // Start/End event styling
            cScale0: '#ffffff',
            cScale1: '#ffffff',
            cScale2: '#ffffff',
            // Task (rectangle) styling - white background, black border
            mainBkg: '#ffffff',
            secondBkg: '#ffffff',
            tertiaryColor: '#ffffff',
            // Gateway/decision styling - white background, black border
            altBackground: '#ffffff',
            // Border colors - all black
            nodeBorder: '#000000',
            secondaryBorderColor: '#000000',
            tertiaryBorderColor: '#000000',
            // Text colors
            secondaryTextColor: '#000000',
            tertiaryTextColor: '#000000',
            // Cluster styling
            clusterBkg: 'none',
            clusterBorder: '#000000'
        };
    }

    /**
     * Get flowchart-specific configuration
     * @returns {Object} Flowchart configuration
     */
    static getFlowchartConfig() {
        return {
            htmlLabels: true,
            curve: 'basis',
            padding: 15,
            nodeSpacing: 25,
            rankSpacing: 35,
            useMaxWidth: false
        };
    }

    /**
     * Get sequence diagram configuration
     * @returns {Object} Sequence diagram configuration
     */
    static getSequenceConfig() {
        return {
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
        };
    }

    /**
     * Get Gantt chart configuration
     * @returns {Object} Gantt configuration
     */
    static getGanttConfig() {
        return {
            titleTopMargin: 15,
            barHeight: 12,
            fontSize: 8,
            fontFamily: '"Open Sans", sans-serif',
            numberSectionStyles: 4,
            axisFormat: '%Y-%m-%d',
            useMaxWidth: false
        };
    }

    /**
     * Create configuration with optional overrides
     * @param {Object} overrides - Configuration overrides
     * @returns {Object} Merged configuration
     */
    static createConfig(overrides = {}) {
        const defaultConfig = this.getDefaultConfig();
        
        // Deep merge configuration objects
        return this.deepMerge(defaultConfig, overrides);
    }

    /**
     * Get theme configuration for specific diagram type
     * @param {string} diagramType - Type of diagram (flowchart, sequence, etc.)
     * @param {Object} customTheme - Custom theme overrides
     * @returns {Object} Theme-specific configuration
     */
    static getThemeConfig(diagramType, customTheme = {}) {
        const baseConfig = this.getDefaultConfig();
        
        // Apply diagram-type specific optimizations
        switch (diagramType.toLowerCase()) {
            case 'flowchart':
            case 'graph':
                baseConfig.flowchart.useMaxWidth = true;
                break;
            case 'sequencediagram':
                baseConfig.sequence.useMaxWidth = true;
                break;
            case 'gantt':
                baseConfig.gantt.useMaxWidth = true;
                break;
        }

        // Merge with custom theme
        if (Object.keys(customTheme).length > 0) {
            baseConfig.themeVariables = this.deepMerge(baseConfig.themeVariables, customTheme);
        }

        return baseConfig;
    }

    /**
     * Get configuration for specific container type (intermediate vs regular)
     * @param {boolean} isIntermediate - Whether this is an intermediate graph
     * @returns {Object} Container-specific configuration
     */
    static getContainerConfig(isIntermediate = false) {
        const config = this.getDefaultConfig();
        
        if (isIntermediate) {
            // Optimize for intermediate graphs - tighter spacing
            config.flowchart.padding = 10;
            config.flowchart.nodeSpacing = 20;
            config.flowchart.rankSpacing = 25;
            config.fontSize = 10;
        }

        return config;
    }

    /**
     * Deep merge utility for configuration objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    static deepMerge(target, source) {
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
     * @returns {boolean} True if valid
     */
    static isValidConfig(config) {
        if (!config || typeof config !== 'object') {
            return false;
        }

        // Check required properties
        const requiredProps = ['startOnLoad', 'theme', 'securityLevel'];
        return requiredProps.every(prop => Object.prototype.hasOwnProperty.call(config, prop));
    }

    /**
     * Get available themes
     * @returns {string[]} Array of available theme names
     */
    static getAvailableThemes() {
        return ['base', 'default', 'dark', 'forest', 'neutral'];
    }

    /**
     * Create minimal configuration for testing
     * @returns {Object} Minimal test configuration
     */
    static getTestConfig() {
        return {
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            fontFamily: 'Arial, sans-serif',
            fontSize: 12
        };
    }
}
