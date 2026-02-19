module.exports = {
  // Use the default create-react-app Jest configuration
  ...require('react-scripts/config/jest/jest.config'),
  
  // Global test timeout (10 seconds)
  testTimeout: 10000,
  
  // Bail after first test failure to avoid wasting time on hanging tests
  // Set to false if you want all tests to run regardless
  bail: false,
  
  // Detect open handles that might cause tests to hang (only in CI)
  detectOpenHandles: process.env.CI === 'true',
  
  // Force exit after all tests complete (useful if something is keeping Node alive)
  forceExit: process.env.CI === 'true',
  
  // Verbose output only in CI to help identify which test is running when timeout occurs
  verbose: process.env.CI === 'true',
};
