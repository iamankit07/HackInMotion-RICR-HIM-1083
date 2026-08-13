import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,

      // The two long-standing hook rules. The plugin's "recommended" set now
      // also turns on the React Compiler rules, which reject ordinary patterns
      // like a data-fetching hook that loads inside an effect — not something
      // to restructure the app around this week.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // The new JSX transform means React does not need importing to use JSX.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      // Prop types are not used in this project; the components are small and
      // read alongside their only caller.
      'react/prop-types': 'off',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // An unused argument is often there to document the callback shape, so
      // allow a leading underscore to say "deliberately ignored".
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Build scripts run in Node, not the browser.
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // React Three Fiber turns three.js objects into JSX elements, so <mesh>,
  // <ambientLight> and their props are not DOM attributes and the rule cannot
  // know them. Scoped to the one file that renders a 3D scene.
  {
    files: ['src/components/AnatomyCanvas.jsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
];
