'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

const button = cva(
  cn(
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  ),
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-ink shadow-brand hover:bg-brand-hover',
        secondary: 'border border-line-strong bg-surface text-ink shadow-xs hover:bg-surface-muted',
        soft: 'bg-brand-soft text-brand hover:bg-brand-soft/70',
        ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        danger: 'bg-danger text-white hover:bg-danger/90',
        'danger-soft': 'bg-danger-soft text-danger-ink hover:bg-danger-soft/70',
        success: 'bg-success text-white hover:bg-success/90',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 px-2 text-caption',
        sm: 'h-9 px-3 text-caption',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-body',
        // Square variants for icon-only buttons; the caller must supply an aria-label.
        'icon-sm': 'h-9 w-9',
        icon: 'h-10 w-10',
        'icon-lg': 'h-12 w-12',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Renders the child element instead of a `<button>` (for links styled as buttons). */
  asChild?: boolean;
  /**
   * Shows a spinner and blocks interaction. Kept separate from `disabled` so a busy
   * button still announces itself as busy rather than merely unavailable.
   */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    block,
    asChild,
    loading = false,
    leadingIcon,
    trailingIcon,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  if (asChild) {
    return (
      <Slot className={cn(button({ variant, size, block }), className)} ref={ref} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      // Defaulting to "button" prevents accidental form submits, the most common
      // cause of a page reloading when a handler was intended.
      type={type}
      className={cn(button({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

export { button as buttonVariants };
