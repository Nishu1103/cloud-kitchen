const preset = require('@ck/ui/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  // The shared package's source is scanned too, otherwise classes used only inside
  // `@ck/ui` components would be purged from this app's stylesheet.
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
};
