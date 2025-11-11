# Test Infrastructure Documentation

This document describes the test infrastructure for the CPEE Log Error Console project, using **Node.js Built-in Test Runner** optimized for WSL Windows mount compatibility.

## Overview

The test infrastructure is built with:
- **Node.js Test Runner** (built-in, Node 18+) - Fast, reliable, no external dependencies
- **jsdom** - DOM environment for browser API testing
- **@testing-library/dom** - DOM testing utilities

## Why Node.js Test Runner?

✅ **Perfect for WSL Windows Mounts** - Runs in main process, no forking  
✅ **No External Dependencies** - Built into Node.js 18+  
✅ **Fast and Reliable** - No worker thread timeouts  
✅ **Native Async Support** - Built-in async/await support  
✅ **Built-in Coverage** - Native test coverage support  

## Project Structure

```
tests/
├── unit/              # Unit tests (70-80% of test suite)
│   └── core/          # Core layer tests
├── component/         # Component tests (15-20% of test suite)
├── integration/       # Integration tests (10-15% of test suite)
├── e2e/              # End-to-end tests (optional, 5-10%)
├── fixtures/          # Test data fixtures
├── helpers/           # Test helper utilities
│   ├── test-helpers.js    # General test utilities
│   ├── mock-factory.js    # Mock creation factories
│   ├── mock-helpers.js    # Mock and spy utilities
│   └── dom-helpers.js     # DOM manipulation utilities
├── config/            # Config tests
├── setup.js           # Global test setup
└── README.md          # This file
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm run test:unit
npm run test:component
npm run test:integration

# Run specific test file
npm run test:file tests/unit/core/StateManager.test.js
# Or directly:
node --test --import ./tests/setup.js tests/unit/core/StateManager.test.js
```

## Writing Tests

### Basic Test Structure

```javascript
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MyClass } from '../../../src/path/MyClass.js';

describe('MyClass', () => {
    let instance;

    beforeEach(() => {
        instance = new MyClass();
    });

    afterEach(() => {
        if (instance?.destroy) {
            instance.destroy();
        }
        // Reset localStorage if needed
        localStorage.reset();
    });

    test('should work correctly', () => {
        assert.strictEqual(instance.method(), expected);
    });
});
```

### Using Assertions

Node.js test runner uses Node's built-in `assert` module:

```javascript
import assert from 'node:assert';

// Strict equality
assert.strictEqual(actual, expected);

// Deep equality
assert.deepStrictEqual(actual, expected);

// Truthy/falsy
assert.ok(value);
assert.strictEqual(value, true);

// Throws
assert.throws(() => {
    throw new Error('test');
});

// Does not throw
assert.doesNotThrow(() => {
    safeOperation();
});
```

### Using Test Helpers

```javascript
import { waitFor, createSpy, createMockService } from '../../helpers/test-helpers.js';
import { createMockFetch } from '../../helpers/mock-factory.js';
import { createElement, simulateClick } from '../../helpers/dom-helpers.js';

// Wait for async operations
await waitFor(100);

// Create spies
const spy = createSpy();
someFunction(spy);
assert.strictEqual(spy.callCount, 1);

// Create mock services
const mockService = createMockService({
    method: () => 'value'
});

// Create mock fetch
const mockFetch = createMockFetch();

// Create DOM elements
const button = createElement('button', { id: 'test-btn' });
simulateClick(button);
```

### Using Mocks

The global setup (`tests/setup.js`) provides:
- `localStorage` - Functional storage mock with `.reset()` method
- `sessionStorage` - Functional storage mock with `.reset()` method
- `fetch` - Mock fetch API
- `window.location` - Mock location object
- `window.history` - Mock history API

All mocks are automatically available. Reset localStorage in `afterEach`:

```javascript
afterEach(() => {
    localStorage.reset();
    sessionStorage.reset();
});
```

## Test Coverage

Node.js test runner has built-in coverage support:

```bash
# Run with coverage
npm run test:coverage

# This uses Node's experimental coverage
node --test --experimental-test-coverage --import ./tests/setup.js 'tests/**/*.test.js'
```

Coverage reports are generated automatically.

## Common Patterns

### Testing Async Code

```javascript
test('should handle async operations', async () => {
    const result = await asyncFunction();
    assert.strictEqual(result, expected);
});
```

### Testing Promises

```javascript
test('should reject on error', async () => {
    await assert.rejects(
        async () => {
            await failingFunction();
        },
        Error
    );
});
```

### Mocking Functions

```javascript
import { createSpy } from '../../helpers/mock-helpers.js';

test('should call callback', () => {
    const callback = createSpy();
    myFunction(callback);
    assert.strictEqual(callback.callCount, 1);
    assert.ok(callback.calledWith('expected-arg'));
});
```

## Best Practices

1. **Isolation**: Each test should be independent and runnable in any order
2. **Cleanup**: Always clean up resources in `afterEach` hooks
3. **Mocking**: Use the provided mock factories for consistency
4. **Async**: Use `async/await` for async operations
5. **DOM**: Use `createElement` and DOM helpers instead of manual DOM manipulation
6. **Naming**: Use descriptive test names that explain what is being tested
7. **Reset Storage**: Always reset localStorage/sessionStorage in afterEach

## Configuration

- **Setup File**: `tests/setup.js` - Global test setup and mocks
- **Helpers**: `tests/helpers/` - Reusable test utilities
- **Node Version**: Requires Node.js 18+ (for built-in test runner)

## Migration from Vitest

If you have existing Vitest tests, here's the migration pattern:

### Before (Vitest)
```javascript
import { test, expect, vi } from 'vitest';

test('example', () => {
    const mock = vi.fn();
    expect(value).toBe(5);
});
```

### After (Node.js Test Runner)
```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { createSpy } from '../../helpers/mock-helpers.js';

test('example', () => {
    const mock = createSpy();
    assert.strictEqual(value, 5);
});
```

## Additional Resources

- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [Node.js Assert Module](https://nodejs.org/api/assert.html)
- [JSDOM Documentation](https://github.com/jsdom/jsdom)
