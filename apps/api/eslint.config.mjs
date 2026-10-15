import base from '@ck/config/eslint/base.mjs';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      // Nest relies on parameter decorators and DI metadata on empty constructors.
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
