/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  moduleFileExtensions: [
    'js',
    'mjs',
    'cjs',
    'jsx',
    'ts',
    'mts',
    'cts',
    'tsx',
    'json',
    'node',
  ],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1',
  },
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'babel-jest',
      { configFile: './babel.test.config.cjs' },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!lodash-es)'],
};

export default config;
