'use client';

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

/**
 * Mount once per app, inside the root layout.
 *
 * Toasts are styled through our tokens rather than sonner's own theme so light/dark
 * follows the same CSS variables as everything else. `richColors` is off for the same
 * reason.
 */
export function Toaster({ position = 'top-center' }: { position?: 'top-center' | 'bottom-right' }) {
  return (
    <SonnerToaster
      position={position}
      // Long enough to read a status change, short enough not to cover the cart bar.
      duration={4000}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            'group flex w-full items-start gap-3 rounded-md border border-line bg-surface-raised p-3 text-body text-ink shadow-md',
          title: 'font-semibold',
          description: 'text-caption text-ink-muted',
          actionButton:
            'rounded-sm bg-brand px-2.5 py-1 text-caption font-medium text-brand-ink',
          cancelButton:
            'rounded-sm bg-surface-muted px-2.5 py-1 text-caption font-medium text-ink-muted',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-danger',
          warning: '[&_[data-icon]]:text-warning',
          info: '[&_[data-icon]]:text-info',
        },
      }}
    />
  );
}

export const toast = sonnerToast;
