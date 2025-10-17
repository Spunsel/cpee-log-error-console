import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'happy-dom', // Faster than jsdom for most cases
    
    // Global test setup
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.js',
        '**/*.test.js',
        '**/*.spec.js',
        'src/libs/**', // Third-party libraries
        'coverage/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Test file patterns
    include: [
      'tests/**/*.{test,spec}.js',
      'src/**/*.{test,spec}.js'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'src/libs/**'
    ],
    
    // Setup files
    setupFiles: ['./tests/setup.js'],
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporter configuration
    reporter: ['verbose', 'html'],
    outputFile: {
      html: './coverage/test-report.html'
    },
    
    // Watch options
    watch: false,
    
    // Mocking
    mockReset: true,
    clearMocks: true,
    restoreMocks: true
  },
  
  // Path resolution (same as main config)
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@core': resolve(__dirname, 'src/core'),
      '@models': resolve(__dirname, 'src/models'),
      '@config': resolve(__dirname, 'src/config'),
      '@validators': resolve(__dirname, 'src/validators'),
      '@assets': resolve(__dirname, 'src/assets')
    }
  },
  
  // Define global constants for tests
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_DATE__: JSON.stringify('2024-01-01T00:00:00.000Z'),
    __DEV__: JSON.stringify(true)
  }
});
