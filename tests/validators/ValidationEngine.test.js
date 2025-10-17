/**
 * Validation Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationEngine, ValidationResult } from '@validators/ValidationEngine.js';

describe('ValidationEngine', () => {
    let validator;

    beforeEach(() => {
        validator = new ValidationEngine();
    });

    describe('built-in rules', () => {
        describe('uuid rule', () => {
            it('should validate correct UUID', () => {
                const result = validator.validateValue('12345678-1234-1234-1234-123456789012', 'uuid');
                expect(result.isValid).toBe(true);
            });

            it('should reject invalid UUID format', () => {
                const result = validator.validateValue('invalid-uuid', 'uuid');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Must be a valid UUID format');
            });

            it('should reject empty UUID', () => {
                const result = validator.validateValue('', 'uuid');
                expect(result.isValid).toBe(false);
            });
        });

        describe('processNumber rule', () => {
            it('should validate positive integer', () => {
                const result = validator.validateValue(123, 'processNumber');
                expect(result.isValid).toBe(true);
            });

            it('should validate string number', () => {
                const result = validator.validateValue('456', 'processNumber');
                expect(result.isValid).toBe(true);
            });

            it('should reject negative number', () => {
                const result = validator.validateValue(-1, 'processNumber');
                expect(result.isValid).toBe(false);
            });

            it('should reject zero', () => {
                const result = validator.validateValue(0, 'processNumber');
                expect(result.isValid).toBe(false);
            });

            it('should reject non-integer', () => {
                const result = validator.validateValue(123.45, 'processNumber');
                expect(result.isValid).toBe(false);
            });

            it('should reject too large number', () => {
                const result = validator.validateValue(9999999, 'processNumber');
                expect(result.isValid).toBe(false);
            });
        });

        describe('required rule', () => {
            it('should accept non-empty string', () => {
                const result = validator.validateValue('test', 'required');
                expect(result.isValid).toBe(true);
            });

            it('should reject empty string', () => {
                const result = validator.validateValue('', 'required');
                expect(result.isValid).toBe(false);
            });

            it('should reject null', () => {
                const result = validator.validateValue(null, 'required');
                expect(result.isValid).toBe(false);
            });

            it('should reject undefined', () => {
                const result = validator.validateValue(undefined, 'required');
                expect(result.isValid).toBe(false);
            });
        });

        describe('minLength rule', () => {
            it('should validate string meeting minimum length', () => {
                const result = validator.validateValue('hello', { rule: 'minLength', params: [3] });
                expect(result.isValid).toBe(true);
            });

            it('should reject string below minimum length', () => {
                const result = validator.validateValue('hi', { rule: 'minLength', params: [5] });
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toBe('Must be at least 5 characters long');
            });
        });
    });

    describe('custom rule registration', () => {
        it('should register and use custom rule', () => {
            validator.registerRule('isEven', {
                validate: (value) => Number(value) % 2 === 0,
                message: 'Must be an even number'
            });

            expect(validator.validateValue(4, 'isEven').isValid).toBe(true);
            expect(validator.validateValue(3, 'isEven').isValid).toBe(false);
        });

        it('should throw error when registering rule without validate function', () => {
            expect(() => {
                validator.registerRule('invalid', { message: 'test' });
            }).toThrow('Rule must have a validate function');
        });
    });

    describe('schema validation', () => {
        beforeEach(() => {
            validator.registerSchema('testUser', {
                name: ['required', { rule: 'minLength', params: [2] }],
                email: ['required', 'email'],
                age: [{ rule: 'min', params: [0] }, { rule: 'max', params: [120] }]
            });
        });

        it('should validate object against schema', () => {
            const user = {
                name: 'John Doe',
                email: 'john@example.com',
                age: 30
            };

            const result = validator.validateObject(user, 'testUser');
            expect(result.isValid).toBe(true);
        });

        it('should collect multiple field errors', () => {
            const user = {
                name: 'J',
                email: 'invalid-email',
                age: -5
            };

            const result = validator.validateObject(user, 'testUser');
            expect(result.isValid).toBe(false);
            expect(result.errors.name).toContain('Must be at least 2 characters long');
            expect(result.errors.email).toContain('Must be a valid email address');
            expect(result.errors.age).toContain('Must be at least 0');
        });
    });

    describe('multiple rule validation', () => {
        it('should validate multiple rules on single value', () => {
            const rules = ['required', { rule: 'minLength', params: [5] }];
            const result = validator.validateValue('hello world', rules);
            expect(result.isValid).toBe(true);
        });

        it('should fail on first invalid rule', () => {
            const rules = ['required', { rule: 'minLength', params: [20] }];
            const result = validator.validateValue('short', rules);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
        });

        it('should collect all errors when multiple rules fail', () => {
            const rules = ['required', { rule: 'minLength', params: [10] }];
            const result = validator.validateValue('', rules);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);
        });
    });

    describe('createValidator', () => {
        it('should create reusable validator function', () => {
            validator.registerSchema('simpleTest', {
                value: ['required']
            });

            const validate = validator.createValidator('simpleTest');
            
            expect(validate({ value: 'test' }).isValid).toBe(true);
            expect(validate({ value: '' }).isValid).toBe(false);
        });
    });
});

describe('ValidationResult', () => {
    describe('getFirstError', () => {
        it('should return first error from array', () => {
            const result = new ValidationResult(false, ['Error 1', 'Error 2']);
            expect(result.getFirstError()).toBe('Error 1');
        });

        it('should return first field error from object', () => {
            const result = new ValidationResult(false, {
                field1: ['Error 1'],
                field2: ['Error 2']
            });
            expect(result.getFirstError()).toBe('Error 1');
        });

        it('should return null for valid result', () => {
            const result = new ValidationResult(true);
            expect(result.getFirstError()).toBe(null);
        });
    });

    describe('getAllErrors', () => {
        it('should return all errors from array', () => {
            const result = new ValidationResult(false, ['Error 1', 'Error 2']);
            expect(result.getAllErrors()).toEqual(['Error 1', 'Error 2']);
        });

        it('should flatten errors from object', () => {
            const result = new ValidationResult(false, {
                field1: ['Error 1', 'Error 2'],
                field2: ['Error 3']
            });
            expect(result.getAllErrors()).toEqual(['Error 1', 'Error 2', 'Error 3']);
        });
    });

    describe('getFieldErrors', () => {
        it('should return errors for specific field', () => {
            const result = new ValidationResult(false, {
                field1: ['Error 1'],
                field2: ['Error 2', 'Error 3']
            });
            expect(result.getFieldErrors('field2')).toEqual(['Error 2', 'Error 3']);
        });

        it('should return empty array for non-existent field', () => {
            const result = new ValidationResult(false, {
                field1: ['Error 1']
            });
            expect(result.getFieldErrors('field2')).toEqual([]);
        });
    });
});
