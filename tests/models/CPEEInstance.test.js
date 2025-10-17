/**
 * CPEEInstance Model Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CPEEInstance } from '@models/CPEEInstance.js';

describe('CPEEInstance', () => {
    let validInstanceData;

    beforeEach(() => {
        validInstanceData = {
            uuid: '12345678-1234-1234-1234-123456789012',
            processNumber: 123,
            steps: [],
            metadata: { test: 'value' }
        };
    });

    describe('constructor', () => {
        it('should create instance with valid data', () => {
            const instance = new CPEEInstance(validInstanceData);
            
            expect(instance.uuid).toBe(validInstanceData.uuid);
            expect(instance.processNumber).toBe(validInstanceData.processNumber);
            expect(instance.steps).toEqual([]);
            expect(instance.currentStepIndex).toBe(0);
        });

        it('should throw error with invalid UUID', () => {
            const invalidData = { ...validInstanceData, uuid: 'invalid-uuid' };
            
            expect(() => new CPEEInstance(invalidData)).toThrow('UUID format is invalid');
        });

        it('should throw error with invalid process number', () => {
            const invalidData = { ...validInstanceData, processNumber: -1 };
            
            expect(() => new CPEEInstance(invalidData)).toThrow('Process number must be a positive integer');
        });

        it('should accept null process number', () => {
            const data = { ...validInstanceData, processNumber: null };
            
            expect(() => new CPEEInstance(data)).not.toThrow();
        });
    });

    describe('navigation methods', () => {
        let instance;

        beforeEach(() => {
            const data = {
                ...validInstanceData,
                steps: [
                    { stepNumber: 1 },
                    { stepNumber: 2 },
                    { stepNumber: 3 }
                ]
            };
            instance = new CPEEInstance(data);
        });

        describe('nextStep', () => {
            it('should navigate to next step', () => {
                expect(instance.nextStep()).toBe(true);
                expect(instance.currentStepIndex).toBe(1);
            });

            it('should not navigate beyond last step', () => {
                instance.currentStepIndex = 2; // Last step
                expect(instance.nextStep()).toBe(false);
                expect(instance.currentStepIndex).toBe(2);
            });
        });

        describe('previousStep', () => {
            it('should navigate to previous step', () => {
                instance.currentStepIndex = 1;
                expect(instance.previousStep()).toBe(true);
                expect(instance.currentStepIndex).toBe(0);
            });

            it('should not navigate before first step', () => {
                expect(instance.previousStep()).toBe(false);
                expect(instance.currentStepIndex).toBe(0);
            });
        });

        describe('goToStep', () => {
            it('should navigate to valid step index', () => {
                expect(instance.goToStep(2)).toBe(true);
                expect(instance.currentStepIndex).toBe(2);
            });

            it('should not navigate to invalid step index', () => {
                expect(instance.goToStep(10)).toBe(false);
                expect(instance.currentStepIndex).toBe(0);
            });

            it('should not navigate to negative step index', () => {
                expect(instance.goToStep(-1)).toBe(false);
                expect(instance.currentStepIndex).toBe(0);
            });
        });
    });

    describe('utility methods', () => {
        let instance;

        beforeEach(() => {
            instance = new CPEEInstance(validInstanceData);
        });

        it('should get display name with process number', () => {
            expect(instance.getDisplayName()).toBe('Process 123');
        });

        it('should get display name without process number', () => {
            instance.processNumber = null;
            expect(instance.getDisplayName()).toBe('12345678...');
        });

        it('should get short UUID', () => {
            expect(instance.getShortUUID()).toBe('12345678');
        });

        it('should manage metadata', () => {
            instance.addMetadata('key1', 'value1');
            expect(instance.getMetadata('key1')).toBe('value1');
        });
    });

    describe('getNavigationInfo', () => {
        it('should return correct navigation info', () => {
            const data = {
                ...validInstanceData,
                steps: [{ stepNumber: 1 }, { stepNumber: 2 }]
            };
            const instance = new CPEEInstance(data);
            instance.currentStepIndex = 1;

            const navInfo = instance.getNavigationInfo();

            expect(navInfo).toEqual({
                currentStep: 2,
                totalSteps: 2,
                canGoNext: false,
                canGoPrevious: true,
                hasSteps: true
            });
        });
    });

    describe('serialization', () => {
        it('should serialize to JSON', () => {
            const instance = new CPEEInstance(validInstanceData);
            const json = instance.toJSON();

            expect(json).toMatchObject({
                uuid: validInstanceData.uuid,
                processNumber: validInstanceData.processNumber,
                steps: [],
                status: 'loaded'
            });
            expect(json.loadedAt).toBeInstanceOf(Date);
        });

        it('should deserialize from JSON', () => {
            const instance = new CPEEInstance(validInstanceData);
            const json = instance.toJSON();
            const restored = CPEEInstance.fromJSON(json);

            expect(restored.uuid).toBe(instance.uuid);
            expect(restored.processNumber).toBe(instance.processNumber);
            expect(restored.loadedAt).toBeInstanceOf(Date);
        });
    });
});
