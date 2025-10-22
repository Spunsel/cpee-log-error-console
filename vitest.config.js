import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Test environment
        environment: 'jsdom',
        
        // Test file patterns
        include: ['tests/unit/**/*.test.js', 'tests/unit/**/*.spec.js'],
        exclude: ['node_modules', 'dist', 'tests/manual'],
        
        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage',
            exclude: [
                'node_modules/',
                'tests/',
                'src/libs/',
                '**/*.config.js',
                '**/dist/**',
            ],
            all: true,
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80,
        },
        
        // Global setup
        globals: true,
        
        // Test timeout
        testTimeout: 10000,
        
        // Reporters
        reporters: ['verbose'],
        
        // Mock configuration
        mockReset: true,
        restoreMocks: true,
    },
});

