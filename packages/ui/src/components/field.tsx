'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import { AlertCircle } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/cn';

interface FieldContextValue {
  inputId: string;
  hintId: string;
  errorId: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Wires a control to its label, hint and error message.
 *
 * Doing this in one place is what makes every form in every portal accessible by
 * default: the ids are generated here and the control reads them from context, so no
 * screen-reader association can be forgotten at a call site.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  /** A string renders the message; `true` marks the control invalid without prose. */
  error?: string | boolean;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const base = useId();
  const context: FieldContextValue = {
    inputId: `${base}-control`,
    hintId: `${base}-hint`,
    errorId: `${base}-error`,
    invalid: Boolean(error),
  };
  const message = typeof error === 'string' ? error : undefined;

  return (
    <FieldContext.Provider value={context}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label ? (
          <LabelPrimitive.Root
            htmlFor={context.inputId}
            className="text-caption font-medium text-ink"
          >
            {label}
            {required ? (
              <>
                <span aria-hidden className="ml-0.5 text-danger">
                  *
                </span>
                <span className="ck-sr-only">(required)</span>
              </>
            ) : null}
          </LabelPrimitive.Root>
        ) : null}

        {children}

        {hint && !message ? (
          <p id={context.hintId} className="text-caption text-ink-subtle">
            {hint}
          </p>
        ) : null}

        {message ? (
          // `role="alert"` announces validation results that appear after submit.
          <p
            id={context.errorId}
            role="alert"
            className="flex items-start gap-1.5 text-caption text-danger"
          >
            <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {message}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldWiring(explicitId?: string) {
  const field = useContext(FieldContext);
  if (!field) return { id: explicitId, describedBy: undefined, invalid: undefined };
  return {
    id: explicitId ?? field.inputId,
    describedBy: field.invalid ? field.errorId : field.hintId,
    invalid: field.invalid || undefined,
  };
}

const controlClasses = cn(
  'w-full rounded border border-line-strong bg-surface px-3 text-body text-ink shadow-xs',
  'placeholder:text-ink-subtle',
  'transition-colors focus:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40 focus-visible:ring-offset-0',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30',
);

// Named `leading`/`trailing` rather than `prefix`/`suffix` because `prefix` is a real
// HTML attribute typed as a string, and shadowing it with a ReactNode breaks the
// interface extension.
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the control on the leading edge (currency symbol, search icon). */
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, id, leading: prefix, trailing: suffix, ...props },
  ref,
) {
  const wiring = useFieldWiring(id);

  const control = (
    <input
      ref={ref}
      id={wiring.id}
      aria-describedby={wiring.describedBy}
      aria-invalid={wiring.invalid}
      className={cn(controlClasses, 'h-10', prefix && 'pl-9', suffix && 'pr-9', className)}
      {...props}
    />
  );

  if (!prefix && !suffix) return control;

  return (
    <div className="relative">
      {prefix ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
        >
          {prefix}
        </span>
      ) : null}
      {control}
      {suffix ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle">{suffix}</span>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, id, rows = 4, ...props }, ref) {
    const wiring = useFieldWiring(id);
    return (
      <textarea
        ref={ref}
        id={wiring.id}
        rows={rows}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid}
        className={cn(controlClasses, 'resize-y py-2 leading-relaxed', className)}
        {...props}
      />
    );
  },
);

export { controlClasses as fieldControlClasses, useFieldWiring };
