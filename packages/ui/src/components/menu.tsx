'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export const Menu = DropdownPrimitive.Root;
export const MenuTrigger = DropdownPrimitive.Trigger;

export function MenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-md border border-line bg-surface-raised p-1 shadow-md',
          'animate-slide-down-in',
          className,
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  destructive,
  disabled,
  asChild,
}: {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  /**
   * Renders the child element instead of a div, for a menu entry that is a real link.
   * A navigation item has to be an anchor: middle-click, "open in new tab" and the
   * status bar preview all come from the element, not from an onSelect handler.
   */
  asChild?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      asChild={asChild}
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-2 text-body outline-none',
        'data-[highlighted]:bg-surface-muted',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-ink',
      )}
    >
      {asChild ? children : <>{icon}{children}</>}
    </DropdownPrimitive.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownPrimitive.Label className="px-2.5 py-1.5 text-micro uppercase tracking-wide text-ink-subtle">
      {children}
    </DropdownPrimitive.Label>
  );
}

export function MenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;
}
