import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // An unused argument is often there to document a signature — Express
      // error handlers must take four, whether or not they use `next`. A
      // leading underscore says the omission is deliberate.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Catching an error and doing nothing hides real failures.
      'no-empty': ['error', { allowEmptyCatch: false }],

      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },

  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
