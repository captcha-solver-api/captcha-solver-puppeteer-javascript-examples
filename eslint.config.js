import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
  { ignores: ['artifacts/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    plugins: { jsdoc },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        Buffer: 'readonly', clearInterval: 'readonly', clearTimeout: 'readonly',
        console: 'readonly', document: 'readonly', Event: 'readonly',
        getComputedStyle: 'readonly', location: 'readonly', navigator: 'readonly', Node: 'readonly',
        process: 'readonly', setInterval: 'readonly', setTimeout: 'readonly',
        URL: 'readonly', WeakMap: 'readonly', WeakSet: 'readonly', window: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'jsdoc/require-jsdoc': ['error', {
        contexts: ['FunctionDeclaration'],
        require: { ArrowFunctionExpression: false, FunctionDeclaration: true, FunctionExpression: false },
      }],
    },
  },
];
