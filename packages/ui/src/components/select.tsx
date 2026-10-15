'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';
import { useFieldWiring } from './field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  id,
  name,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}) {
  const wiring = useFieldWiring(id);

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
      <SelectPrimitive.Trigger
        id={wiring.id}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded border border-line-strong bg-surface px-3',
          'text-body text-ink shadow-xs transition-colors',
          'data-[placeholder]:text-ink-subtle',
          'focus:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
          'aria-[invalid=true]:border-danger',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown aria-hidden className="h-4 w-4 text-ink-subtle" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          // "popper" keeps the list from covering the trigger, which matters on
          // mobile where the keyboard already eats half the viewport.
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-72 min-w-[--radix-select-trigger-width] overflow-hidden rounded-md border border-line',
            'bg-surface-raised shadow-md animate-slide-down-in',
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pl-8 pr-3 text-body outline-none',
                  'data-[highlighted]:bg-surface-muted data-[state=checked]:font-medium',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5">
                  <Check aria-hidden className="h-4 w-4 text-brand" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
