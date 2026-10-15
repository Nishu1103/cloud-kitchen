import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** Shared baseline. Security-relevant rules are errors, style is left to Prettier. */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    /**
     * Build and tooling config files run in Node, under CommonJS where the extension
     * says so. Without this they trip `no-undef` on `module` and `require`, which says
     * nothing about the code and trains everyone to ignore lint output.
     */
    files: ['**/*.config.{js,cjs,mjs}', '**/*.config.*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    /** Service workers have their own globals and no DOM. */
    files: ['**/public/*-sw.js', '**/public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker, importScripts: 'readonly' } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'error',
    },
  },
);
