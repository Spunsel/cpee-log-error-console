# Test Infrastructure Quick Start

## Quick Commands

```bash
# Run all tests
npm test

# Run specific test file
npm run test:file tests/unit/core/StateManager.test.js
# Or directly:
node --test --import ./tests/setup.js tests/unit/core/StateManager.test.js

# Run specific test by name pattern (e.g., only "Edge Case 9")
node --test --test-name-pattern "Edge Case 9" --import ./tests/setup.js tests/unit/trace/TraceCalculationEdgeCases.test.js
# Or using npm:
npm run test:file tests/unit/trace/TraceCalculationEdgeCases.test.js -- --test-name-pattern "Edge Case 9"

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Run by category
npm run test:unit
npm run test:component
npm run test:integration
```

## Test File Template

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
        if (instance?.destroy) instance.destroy();
        localStorage.reset(); // Reset storage
    });

    test('should work correctly', () => {
        assert.strictEqual(instance.method(), expected);
    });
});
```

## Available Helpers

- `tests/helpers/test-helpers.js` - General utilities
- `tests/helpers/mock-helpers.js` - Mock and spy utilities
- `tests/helpers/mock-factory.js` - Mock creation
- `tests/helpers/dom-helpers.js` - DOM utilities

## Key Features

✅ Node.js built-in (no external test framework)  
✅ Runs in main process (perfect for WSL Windows mounts)  
✅ Functional localStorage mock  
✅ Automatic cleanup helpers  
✅ Native async/await support  

## Assertions

Use Node's built-in `assert`:

```javascript
import assert from 'node:assert';

assert.strictEqual(actual, expected);
assert.deepStrictEqual(actual, expected);
assert.ok(value);
assert.throws(() => { /* code */ });
```

See `tests/README.md` for full documentation.
