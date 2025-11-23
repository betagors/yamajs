module.exports = {
  preset: '',
  testEnvironment: 'node',

  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
  },
  transform: {
    "^.+\\.(js)$": "babel-jest",
  },
}
