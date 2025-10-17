module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  plugins: [
    'import'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Code quality rules
    'no-console': 'off', // Allow console for now, will be replaced by logger
    'no-debugger': 'error',
    'no-alert': 'warn',
    'no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-duplicate-imports': 'error',
    
    // ES6+ rules
    'prefer-const': 'error',
    'prefer-arrow-callback': 'warn',
    'arrow-spacing': 'error',
    'object-shorthand': 'warn',
    'template-curly-spacing': 'error',
    
    // Import rules
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external', 
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always'
    }],
    'import/no-unresolved': 'off', // Disable for ES modules
    'import/no-duplicates': 'error',
    
    // Style rules (handled by Prettier mostly)
    'indent': 'off', // Handled by Prettier
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    'semi': ['error', 'always'],
    
    // Best practices
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'error',
    
    // Documentation
    'valid-jsdoc': ['warn', {
      'requireReturn': false,
      'requireReturnDescription': false,
      'requireParamDescription': true
    }],
    
    // Complexity
    'complexity': ['warn', 15],
    'max-depth': ['warn', 4],
    'max-nested-callbacks': ['warn', 4],
    'max-params': ['warn', 6],
    
    // Security
    'no-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error'
  },
  
  // Override rules for specific files
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
        vitest: true
      },
      rules: {
        'no-unused-expressions': 'off'
      }
    },
    {
      files: ['vite.config.js', '.eslintrc.js'],
      env: {
        node: true
      },
      rules: {
        'no-undef': 'off'
      }
    }
  ],
  
  // Global variables
  globals: {
    // Browser globals
    'window': 'readonly',
    'document': 'readonly',
    'console': 'readonly',
    'localStorage': 'readonly',
    'sessionStorage': 'readonly',
    'fetch': 'readonly',
    'URL': 'readonly',
    'URLSearchParams': 'readonly',
    'performance': 'readonly',
    'PerformanceObserver': 'readonly',
    'AbortController': 'readonly',
    
    // Vite globals
    '__APP_VERSION__': 'readonly',
    '__BUILD_DATE__': 'readonly',
    '__DEV__': 'readonly'
  },
  
  // Ignore patterns
  ignorePatterns: [
    'dist/',
    'coverage/',
    'node_modules/',
    '*.min.js',
    'src/libs/**' // Third-party libraries
  ]
};
