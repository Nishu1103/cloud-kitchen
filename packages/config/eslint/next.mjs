import next from '@next/eslint-plugin-next';
import globals from 'globals';
import base from './base.mjs';

/**
 * Baseline plus the Next.js rules, for the four portals.
 *
 * Worth having beyond style: `no-sync-scripts` and `no-html-link-for-pages` catch real
 * regressions in page performance and client-side routing that are invisible in review.
 */
export default [
  ...base,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { '@next/next': next },
    languageOptions: { globals: globals.browser },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  },
];
