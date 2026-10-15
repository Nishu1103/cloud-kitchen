'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';

/**
 * Modal dialog and bottom sheet.
 *
 * Radix supplies the parts that are easy to get wrong by hand: focus is trapped while
 * open, focus returns to the trigger on close, Escape and the overlay dismiss, and the
 * rest of the page is hidden from assistive tech.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  /** Bottom sheet on small screens; the default pattern for mobile web. */
  sheetOnMobile = true,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  sheetOnMobile?: boolean;
  className?: string;
}) {
  const widths = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  } as const;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-surface-raised shadow-lg',
            sheetOnMobile
              ? 'inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl animate-sheet-in sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:animate-scale-in'
              : 'left-1/2 top-1/2 max-h-[85vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg animate-scale-in',
            'sm:w-full',
            widths[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line p-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-title text-ink">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-caption text-ink-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X aria-hidden className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line p-4">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Confirmation for a destructive or irreversible action.
 *
 * Deliberately requires an explicit label for the action button: "Confirm" tells the
 * user nothing, "Cancel order" tells them exactly what is about to happen.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Keep it',
  onConfirm,
  loading,
  tone = 'danger',
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  tone?: 'danger' | 'primary';
  /**
   * Optional body, for a confirmation that also collects something - a cancellation
   * reason, a refund note. Keep it to one field: anything larger belongs in a `Modal`.
   */
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={() => void onConfirm()} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
