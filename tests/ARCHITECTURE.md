# Test Architecture Overview

## Framework: Node.js Built-in Test Runner

The project uses **Node.js Built-in Test Runner** (Node 18+) as the primary testing framework. This choice was made specifically for WSL Windows mount compatibility.

## Architecture Decisions

### Why Node.js Test Runner?

1. **WSL Compatibility**: Runs in main process, no forking = no timeout issues
2. **Zero Dependencies**: Built into Node.js, no external test framework needed
3. **Performance**: Faster execution without worker thread overhead
4. **Simplicity**: Less configuration, easier to maintain
5. **Native Support**: Built-in async/await and coverage support

### Test Structure

```
tests/
├── unit/              # Unit tests (isolated, fast)
│   ├── core/          # Core layer (StateManager, EventBus, etc.)
│   ├── services/      # Service layer
│   ├── models/        # Model layer
│   └── utils/         # Utility layer
├── component/         # Component tests (DOM interactions)
│   ├── ui/            # UI components
│   ├── views/         # View components
│   └── renderers/     # Renderer components
├── integration/       # Integration tests (multiple components)
│   ├── coordinators/  # Coordinator tests
│   └── cross-view/    # Cross-view coordination
├── helpers/           # Test utilities
│   ├── test-helpers.js    # General utilities
│   ├── mock-helpers.js    # Mock/spy utilities
│   ├── mock-factory.js    # Mock factories
│   └── dom-helpers.js     # DOM utilities
├── fixtures/          # Test data
├── setup.js           # Global test setup
└── [docs]             # Documentation files
```

## Test Execution Model

### Single Process Execution

- All tests run in the main Node.js process
- No worker threads or process forking
- Sequential test execution (fast enough for unit tests)
- Perfect for WSL Windows mounts

### Test Lifecycle

1. **Setup** (`tests/setup.js`) - Runs once before all tests
   - Sets up JSDOM environment
   - Configures global mocks (localStorage, fetch, etc.)
   - Provides global test utilities

2. **Test File** - Each test file is independent
   - `beforeEach` - Runs before each test
   - `test()` - Individual test case
   - `afterEach` - Runs after each test (cleanup)

3. **Cleanup** - Handled per test file
   - Reset localStorage/sessionStorage
   - Destroy instances
   - Clear DOM

## Mocking Strategy

### Global Mocks (setup.js)
- `localStorage` - Functional storage with `.reset()` method
- `sessionStorage` - Functional storage with `.reset()` method
- `fetch` - Mock fetch API
- `window.location` - Mock location object
- `window.history` - Mock history API
- DOM Observers (ResizeObserver, IntersectionObserver, etc.)

### Helper-Based Mocks
- `createSpy()` - Function spies
- `createMockFetch()` - Fetch mocks
- `createMockService()` - Service mocks
- `createMockEventBus()` - Event bus mocks

## Assertion Strategy

Uses Node.js built-in `assert` module:

```javascript
import assert from 'node:assert';

// Strict equality (preferred)
assert.strictEqual(actual, expected);

// Deep equality
assert.deepStrictEqual(actual, expected);

// Truthy/falsy
assert.ok(value);
assert.strictEqual(value, true);

// Error handling
assert.throws(() => { /* code */ });
assert.doesNotThrow(() => { /* code */ });
```

## Coverage

Node.js test runner has built-in coverage support:

```bash
npm run test:coverage
# Uses: node --test --experimental-test-coverage
```

Coverage reports are generated automatically.

## Best Practices

1. **Isolation**: Each test is independent
2. **Cleanup**: Always reset state in `afterEach`
3. **Naming**: Descriptive test names
4. **Structure**: Group related tests in `describe` blocks
5. **Async**: Use `async/await` for async operations
6. **Mocks**: Use helper functions for consistency

## Performance Characteristics

- **Fast**: No worker thread overhead
- **Reliable**: No fork timeouts
- **Scalable**: Handles hundreds of tests easily
- **WSL-Friendly**: Works perfectly on Windows mounts

## Migration Notes

See `tests/MIGRATION.md` for details on migrating from Vitest.

## Future Considerations

- If test suite grows very large (>1000 tests), consider test sharding
- For E2E tests, consider Playwright (separate from unit tests)
- Coverage reporting can be enhanced with external tools if needed

