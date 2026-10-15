'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export const Tabs = TabsPrimitive.Root;
export const TabPanel = TabsPrimitive.Content;

export function TabList({
  children,
  className,
  /** Scrollable strip for long tab sets (order status filters on mobile). */
  scrollable = true,
}: {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex items-center gap-1 border-b border-line',
        scrollable && '-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function Tab({
  value,
  children,
  count,
}: {
  value: string;
  children: ReactNode;
  /** Optional badge, e.g. how many live orders are in this bucket. */
  count?: number;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-body font-medium text-ink-muted',
        'transition-colors hover:text-ink',
        'data-[state=active]:text-brand',
        // The indicator is a pseudo-element so switching tabs cannot shift layout.
        'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent',
        'data-[state=active]:after:bg-brand',
      )}
    >
      {children}
      {count !== undefined && count > 0 ? (
        <span className="tabular rounded-full bg-surface-muted px-1.5 py-0.5 text-micro text-ink-muted">
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}
