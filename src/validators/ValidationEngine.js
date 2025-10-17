/**
 * Validation Engine
 * Centralized validation system with rules, schemas, and custom validators
 */

export class ValidationEngine {
    constructor() {
        this.rules = new Map();
        this.schemas = new Map();
        this.customValidators = new Map();
        this.registerBuiltInRules();
    }

    /**
     * Register built-in validation rules
     */
    registerBuiltInRules() {
        // UUID validation
        this.registerRule('uuid', {
            validate: (value) => {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                return uuidRegex.test(value);
            },
            message: 'Must be a valid UUID format'
        });

        // Process number validation
        this.registerRule('processNumber', {
            validate: (value) => {
                const num = Number(value);
                return Number.isInteger(num) && num > 0 && num <= 999999;
            },
            message: 'Must be a positive integer between 1 and 999999'
        });

        // Required field validation
        this.registerRule('required', {
            validate: (value) => {
                return value !== null && value !== undefined && value !== '';
            },
            message: 'This field is required'
        });

        // String length validation
        this.registerRule('minLength', {
            validate: (value, min) => {
                return typeof value === 'string' && value.length >= min;
            },
            message: (min) => `Must be at least ${min} characters long`
        });

        this.registerRule('maxLength', {
            validate: (value, max) => {
                return typeof value === 'string' && value.length <= max;
            },
            message: (max) => `Must be no more than ${max} characters long`
        });

        // Number range validation
        this.registerRule('min', {
            validate: (value, min) => {
                const num = Number(value);
                return !isNaN(num) && num >= min;
            },
            message: (min) => `Must be at least ${min}`
        });

        this.registerRule('max', {
            validate: (value, max) => {
                const num = Number(value);
                return !isNaN(num) && num <= max;
            },
            message: (max) => `Must be no more than ${max}`
        });

        // Email validation
        this.registerRule('email', {
            validate: (value) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value);
            },
            message: 'Must be a valid email address'
        });

        // URL validation
        this.registerRule('url', {
            validate: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Must be a valid URL'
        });

        // JSON validation
        this.registerRule('json', {
            validate: (value) => {
                try {
                    JSON.parse(value);
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Must be valid JSON'
        });
    }

    /**
     * Register a validation rule
     * @param {string} name - Rule name
     * @param {Object} rule - Rule definition
     */
    registerRule(name, rule) {
        if (!rule.validate || typeof rule.validate !== 'function') {
            throw new Error('Rule must have a validate function');
        }
        
        this.rules.set(name, rule);
    }

    /**
     * Register a validation schema
     * @param {string} name - Schema name
     * @param {Object} schema - Schema definition
     */
    registerSchema(name, schema) {
        this.schemas.set(name, schema);
    }

    /**
     * Validate a single value against rules
     * @param {*} value - Value to validate
     * @param {Array|string} rules - Validation rules
     * @returns {ValidationResult} Validation result
     */
    validateValue(value, rules) {
        const ruleList = Array.isArray(rules) ? rules : [rules];
        const errors = [];

        for (const ruleConfig of ruleList) {
            const result = this.validateSingleRule(value, ruleConfig);
            if (!result.isValid) {
                errors.push(result.error);
            }
        }

        return new ValidationResult(errors.length === 0, errors);
    }

    /**
     * Validate a single rule
     * @param {*} value - Value to validate
     * @param {string|Object} ruleConfig - Rule configuration
     * @returns {Object} Validation result
     */
    validateSingleRule(value, ruleConfig) {
        let ruleName, ruleParams = [];
        
        if (typeof ruleConfig === 'string') {
            ruleName = ruleConfig;
        } else if (typeof ruleConfig === 'object') {
            ruleName = ruleConfig.rule;
            ruleParams = ruleConfig.params || [];
        } else {
            return { isValid: false, error: 'Invalid rule configuration' };
        }

        const rule = this.rules.get(ruleName);
        if (!rule) {
            return { isValid: false, error: `Unknown validation rule: ${ruleName}` };
        }

        try {
            const isValid = rule.validate(value, ...ruleParams);
            
            if (!isValid) {
                let message = rule.message;
                if (typeof message === 'function') {
                    message = message(...ruleParams);
                }
                return { isValid: false, error: message };
            }

            return { isValid: true };
        } catch (error) {
            return { isValid: false, error: `Validation error: ${error.message}` };
        }
    }

    /**
     * Validate an object against a schema
     * @param {Object} data - Data to validate
     * @param {string|Object} schema - Schema name or definition
     * @returns {ValidationResult} Validation result
     */
    validateObject(data, schema) {
        const schemaDefinition = typeof schema === 'string' 
            ? this.schemas.get(schema) 
            : schema;

        if (!schemaDefinition) {
            throw new Error(`Schema not found: ${schema}`);
        }

        const errors = {};
        let hasErrors = false;

        for (const [field, fieldRules] of Object.entries(schemaDefinition)) {
            const value = data[field];
            const result = this.validateValue(value, fieldRules);
            
            if (!result.isValid) {
                errors[field] = result.errors;
                hasErrors = true;
            }
        }

        return new ValidationResult(!hasErrors, errors);
    }

    /**
     * Create a validator function for a specific schema
     * @param {string|Object} schema - Schema name or definition
     * @returns {Function} Validator function
     */
    createValidator(schema) {
        return (data) => this.validateObject(data, schema);
    }
}

/**
 * Validation Result
 * Represents the result of a validation operation
 */
export class ValidationResult {
    constructor(isValid, errors = []) {
        this.isValid = isValid;
        this.errors = errors;
    }

    /**
     * Get first error message
     * @returns {string|null} First error or null
     */
    getFirstError() {
        if (Array.isArray(this.errors) && this.errors.length > 0) {
            return this.errors[0];
        }
        
        if (typeof this.errors === 'object') {
            const firstField = Object.keys(this.errors)[0];
            const fieldErrors = this.errors[firstField];
            return Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
        }
        
        return null;
    }

    /**
     * Get all error messages as flat array
     * @returns {Array<string>} All error messages
     */
    getAllErrors() {
        if (Array.isArray(this.errors)) {
            return this.errors;
        }
        
        if (typeof this.errors === 'object') {
            const allErrors = [];
            Object.values(this.errors).forEach(fieldErrors => {
                if (Array.isArray(fieldErrors)) {
                    allErrors.push(...fieldErrors);
                } else {
                    allErrors.push(fieldErrors);
                }
            });
            return allErrors;
        }
        
        return [];
    }

    /**
     * Get errors for specific field
     * @param {string} field - Field name
     * @returns {Array<string>} Field errors
     */
    getFieldErrors(field) {
        if (typeof this.errors === 'object' && this.errors[field]) {
            return Array.isArray(this.errors[field]) ? this.errors[field] : [this.errors[field]];
        }
        return [];
    }
}

// Predefined schemas for common validation scenarios
export const SCHEMAS = {
    UUID_INPUT: {
        uuid: ['required', 'uuid']
    },
    
    PROCESS_NUMBER_INPUT: {
        processNumber: ['required', 'processNumber']
    },
    
    CPEE_INSTANCE: {
        uuid: ['required', 'uuid'],
        processNumber: [{ rule: 'min', params: [1] }],
        steps: ['required']
    },
    
    STEP_CONTENT: {
        inputCpeeTree: [{ rule: 'maxLength', params: [1000000] }],
        inputIntermediate: [{ rule: 'maxLength', params: [1000000] }],
        userInput: ['required', { rule: 'maxLength', params: [10000] }],
        outputIntermediate: [{ rule: 'maxLength', params: [1000000] }],
        outputCpeeTree: [{ rule: 'maxLength', params: [1000000] }]
    }
};

// Global validation engine instance
export const validator = new ValidationEngine();

// Register predefined schemas
Object.entries(SCHEMAS).forEach(([name, schema]) => {
    validator.registerSchema(name, schema);
});

// Convenience functions
export const validateUUID = (uuid) => validator.validateValue(uuid, 'uuid');
export const validateProcessNumber = (number) => validator.validateValue(number, 'processNumber');
export const validateCPEEInstance = (instance) => validator.validateObject(instance, 'CPEE_INSTANCE');
