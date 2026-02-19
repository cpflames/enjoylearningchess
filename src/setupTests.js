// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Set global test timeout to 10 seconds (10000ms)
// This prevents tests from hanging indefinitely
jest.setTimeout(10000);

// Add a global afterEach hook to help identify where tests might be hanging
let testStartTime;

beforeEach(() => {
  testStartTime = Date.now();
});

afterEach(() => {
  const testDuration = Date.now() - testStartTime;
  if (testDuration > 8000) {
    console.warn(`⚠️  Test took ${testDuration}ms - approaching timeout threshold`);
  }
});
