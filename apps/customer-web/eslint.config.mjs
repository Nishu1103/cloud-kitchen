import base from '@ck/config/eslint/next.mjs';

export default [
  ...base,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
