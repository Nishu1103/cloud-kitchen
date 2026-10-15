'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioPrimitive from '@radix-ui/react-radio-group';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check, Minus } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export const Checkbox = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    label?: ReactNode;
    /** Secondary text on the same row, e.g. a price delta for an add-on. */
    hint?: ReactNode;
  }
>(function Checkbox({ className, label, hint, id, ...props }, ref) {
  const control = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={id}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface',
        'transition-colors data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        'data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-brand-ink">
        {props.checked === 'indeterminate' ? (
          <Minus aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
        ) : (
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return control;
  return (
    // The whole row is the hit target: a 20px box alone is below the 44px touch minimum.
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-body text-ink">
      {control}
      <span className="flex-1">{label}</span>
      {hint ? <span className="tabular text-caption text-ink-subtle">{hint}</span> : null}
    </label>
  );
});

export const Switch = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { label?: ReactNode; hint?: ReactNode }
>(function Switch({ className, label, hint, ...props }, ref) {
  const control = (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent',
        'bg-line-strong transition-colors data-[state=checked]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm',
          'transition-transform duration-200 ease-out data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="flex flex-col">
        <span className="text-body font-medium text-ink">{label}</span>
        {hint ? <span className="text-caption text-ink-subtle">{hint}</span> : null}
      </span>
      {control}
    </label>
  );
});

export function RadioGroup({
  value,
  onValueChange,
  options,
  className,
  name,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  options: { value: string; label: ReactNode; hint?: ReactNode; disabled?: boolean }[];
  className?: string;
  name?: string;
}) {
  return (
    <RadioPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      name={name}
      className={cn('flex flex-col gap-2', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface p-3',
            'transition-colors hover:border-line-strong',
            'has-[button[data-state=checked]]:border-brand has-[button[data-state=checked]]:bg-brand-soft/40',
            option.disabled && 'pointer-events-none opacity-50',
          )}
        >
          <RadioPrimitive.Item
            value={option.value}
            disabled={option.disabled}
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface',
              'data-[state=checked]:border-brand',
            )}
          >
            <RadioPrimitive.Indicator className="h-2.5 w-2.5 rounded-full bg-brand" />
          </RadioPrimitive.Item>
          <span className="flex flex-col">
            <span className="text-body text-ink">{option.label}</span>
            {option.hint ? (
              <span className="text-caption text-ink-subtle">{option.hint}</span>
            ) : null}
          </span>
        </label>
      ))}
    </RadioPrimitive.Root>
  );
}
