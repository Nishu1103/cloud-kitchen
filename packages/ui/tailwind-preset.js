/**
 * The design system's single source of truth for tokens.
 *
 * Every colour resolves through a CSS variable rather than a literal, which is what
 * lets a campus ship its own palette at runtime (the API returns `themeColor` per
 * tenant) without a rebuild, and gives dark mode for free.
 *
 * Consumed by each app as `presets: [require('@ck/ui/tailwind-preset')]`.
 */

/** `<alpha-value>` keeps Tailwind's opacity modifiers (`bg-brand/40`) working. */
const withOpacity = (variable) => `hsl(var(${variable}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Surfaces, from the page background up to raised cards and overlays.
        canvas: withOpacity('--canvas'),
        surface: {
          DEFAULT: withOpacity('--surface'),
          muted: withOpacity('--surface-muted'),
          raised: withOpacity('--surface-raised'),
        },
        line: {
          DEFAULT: withOpacity('--line'),
          strong: withOpacity('--line-strong'),
        },
        ink: {
          DEFAULT: withOpacity('--ink'),
          muted: withOpacity('--ink-muted'),
          subtle: withOpacity('--ink-subtle'),
          inverted: withOpacity('--ink-inverted'),
        },

        // The tenant-controlled accent. Everything interactive keys off this.
        brand: {
          DEFAULT: withOpacity('--brand'),
          hover: withOpacity('--brand-hover'),
          soft: withOpacity('--brand-soft'),
          ring: withOpacity('--brand-ring'),
          ink: withOpacity('--brand-ink'),
        },

        // Semantic states. Named by meaning, never by colour, so a theme can move them.
        success: {
          DEFAULT: withOpacity('--success'),
          soft: withOpacity('--success-soft'),
          ink: withOpacity('--success-ink'),
        },
        warning: {
          DEFAULT: withOpacity('--warning'),
          soft: withOpacity('--warning-soft'),
          ink: withOpacity('--warning-ink'),
        },
        danger: {
          DEFAULT: withOpacity('--danger'),
          soft: withOpacity('--danger-soft'),
          ink: withOpacity('--danger-ink'),
        },
        info: {
          DEFAULT: withOpacity('--info'),
          soft: withOpacity('--info-soft'),
          ink: withOpacity('--info-ink'),
        },
        gold: {
          DEFAULT: withOpacity('--gold'),
          ink: withOpacity('--gold-ink'),
        },
        peach: {
          DEFAULT: withOpacity('--peach'),
          ink: withOpacity('--peach-ink'),
        },
      },

      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'ui-serif', 'serif'],
        script: ['var(--font-script)', 'cursive'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        // Tighter tracking as size grows keeps large headings from looking airy.
        'display-lg': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        display: ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
        'title-lg': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '650' }],
        title: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '650' }],
        body: ['0.9375rem', { lineHeight: '1.6' }],
        caption: ['0.8125rem', { lineHeight: '1.45' }],
        micro: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.04em' }],
      },

      borderRadius: {
        xs: '0.25rem',
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.75rem',
      },

      boxShadow: {
        // Layered, low-opacity shadows read as depth; a single hard shadow reads as a box.
        xs: '0 1px 2px 0 hsl(var(--shadow) / 0.06)',
        sm: '0 1px 3px 0 hsl(var(--shadow) / 0.08), 0 1px 2px -1px hsl(var(--shadow) / 0.06)',
        DEFAULT: '0 4px 12px -2px hsl(var(--shadow) / 0.10), 0 2px 4px -2px hsl(var(--shadow) / 0.06)',
        md: '0 10px 24px -6px hsl(var(--shadow) / 0.14), 0 4px 8px -4px hsl(var(--shadow) / 0.08)',
        lg: '0 24px 48px -12px hsl(var(--shadow) / 0.20), 0 8px 16px -8px hsl(var(--shadow) / 0.10)',
        brand: '0 8px 24px -8px hsl(var(--brand) / 0.45)',
        'inner-line': 'inset 0 0 0 1px hsl(var(--line) / 1)',
      },

      spacing: {
        // Named rhythm values, so page chrome stays consistent across four apps.
        gutter: '1.25rem',
        'gutter-lg': '2rem',
        header: '4rem',
        'tabbar': '4.5rem',
      },

      maxWidth: {
        content: '80rem',
        prose: '42rem',
      },

      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--brand) / 0.35)' },
          '70%': { boxShadow: '0 0 0 10px hsl(var(--brand) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--brand) / 0)' },
        },
      },

      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'fade-out': 'fade-out 120ms ease-in',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down-in': 'slide-down-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-in': 'sheet-in 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
