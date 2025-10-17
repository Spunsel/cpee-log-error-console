module.exports = {
  // Basic formatting
  printWidth: 100,
  tabWidth: 4,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  
  // Trailing commas
  trailingComma: 'none',
  
  // Brackets and spacing
  bracketSpacing: true,
  bracketSameLine: false,
  
  // Arrow functions
  arrowParens: 'avoid',
  
  // HTML/CSS
  htmlWhitespaceSensitivity: 'css',
  
  // Line endings
  endOfLine: 'lf',
  
  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.html',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: '*.css',
      options: {
        tabWidth: 2
      }
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2
      }
    }
  ]
};
