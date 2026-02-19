# Test Timeout Configuration

## Overview
This project now has test timeout protection to prevent tests from hanging indefinitely.

## Configuration

### Global Timeout: 10 seconds
All tests will automatically timeout after 10 seconds if they don't complete.

### Files Modified

1. **`jest.config.js`** (NEW)
   - Sets global test timeout to 10 seconds
   - Enables `detectOpenHandles` in CI to identify what's keeping tests alive
   - Enables `forceExit` in CI to ensure Jest exits even if something is keeping Node alive
   - Enables `verbose` mode in CI to show which test is running when timeout occurs

2. **`src/setupTests.js`** (UPDATED)
   - Sets `jest.setTimeout(10000)` as a backup
   - Adds warning for tests that take longer than 8 seconds
   - Tracks test duration to help identify slow tests

3. **`package.json`** (UPDATED)
   - Added `test:ci` script for non-interactive test runs

## Running Tests

### Interactive watch mode (default):
```bash
npm test
```
This runs Jest in watch mode - it will wait for you to press keys to filter tests, run all tests, etc.

### Non-interactive mode (recommended for quick runs):
```bash
npm run test:ci
```
This runs all tests once and exits. Perfect for:
- Quick test runs
- CI/CD pipelines
- Verifying all tests pass

### Run specific test file (non-interactive):
```bash
npm test -- --testPathPattern=myTest --watchAll=false
```

## How It Works

### When a test hangs:
1. After 10 seconds, Jest will automatically fail the test with a timeout error
2. The error message will show which test was running
3. Jest will continue to the next test (unless `bail: true` is set)

### Example timeout error:
```
Timeout - Async callback was not invoked within the 10000 ms timeout 
specified by jest.setTimeout.
```

### Identifying slow tests:
Tests that take longer than 8 seconds will show a warning:
```
⚠️  Test took 8500ms - approaching timeout threshold
```

## Override Timeout for Specific Tests

### For a single test:
```javascript
test('my slow test', async () => {
  jest.setTimeout(20000); // 20 seconds for this test only
  // ... test code
}, 20000); // Also specify timeout here
```

### For an entire test file:
```javascript
// At the top of your test file
jest.setTimeout(20000);

describe('my test suite', () => {
  // All tests in this file will have 20 second timeout
});
```

## Troubleshooting

### If tests are timing out:
1. Run with `npm run test:ci` to see which test is hanging
2. Look for:
   - Async operations without proper await
   - Missing mock cleanup
   - Event listeners not being removed
   - Timers not being cleared
   - Open network connections

### Common causes of hanging tests:
- `setInterval` or `setTimeout` not being cleared
- Promises that never resolve
- Event listeners waiting for events that never fire
- Mock functions that don't return expected values
- Real API calls instead of mocked calls

## Configuration Options

You can adjust the timeout in `jest.config.js`:

```javascript
module.exports = {
  testTimeout: 10000, // Change this value (in milliseconds)
  // ...
};
```

Or in `src/setupTests.js`:

```javascript
jest.setTimeout(10000); // Change this value (in milliseconds)
```
