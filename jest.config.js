module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/out/'],
  verbose: true,
  testMatch: ['**/test/**/*.test.ts', '**/*.(test|spec).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  // 配置覆盖率收集
  collectCoverage: false,
  // 暂时禁用覆盖率检查，以便更好地调试测试用例
  // collectCoverageFrom: [
  //   'src/**/*.{ts,tsx}',
  //   '!src/**/*.d.ts',
  //   '!src/test/**/*',
  //   '!**/node_modules/**'
  // ],
  // coverageDirectory: 'coverage',
  // coverageReporters: [
  //   'json',
  //   'lcov',
  //   'text',
  //   'clover',
  //   'html'
  // ],
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50
  //   }
  // },

  // 暂时注释掉jest-junit报告器
  // reporters: [
  //   'default',
  //   ['jest-junit', {
  //     outputDirectory: './coverage',
  //     outputName: 'junit.xml'
  //   }]
  // ],
  moduleDirectories: ['node_modules', 'src'],
  // 模拟VSCode API
  setupFilesAfterEnv: ['<rootDir>/test/setup-vscode-mocks.ts'],
  // 添加moduleNameMapper来解决'vscode'模块的解析问题
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^vscode$': '<rootDir>/test/setup-vscode-mocks.ts'
  }
};