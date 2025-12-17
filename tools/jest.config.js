module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000, // 10 seconds
  maxWorkers: 1, // Run tests serially
  collectCoverageFrom: [
    '**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/tests/**',
  ],
};
