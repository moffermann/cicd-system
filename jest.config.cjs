module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test files patterns
  testMatch: [
    '**/tests/**/*.test.cjs',
    '**/__tests__/**/*.cjs',
    '**/*.(test|spec).cjs'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'cjs', 'json'],
  
  // Transform files
  transform: {},
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.cjs'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,cjs}',
    '!src/**/*.test.{js,cjs}',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  
  coverageDirectory: 'coverage',
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Verbose output
  verbose: true,
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true
};