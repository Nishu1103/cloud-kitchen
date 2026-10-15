'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '../lib/cn';

/** First letters of the first and last word, e.g. "Aarav Sharma" -> "AS". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]![0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}

const SIZES = {
  xs: 'h-6 w-6 text-micro',
  sm: 'h-8 w-8 text-caption',
  md: 'h-10 w-10 text-body',
  lg: 'h-14 w-14 text-title',
  xl: 'h-20 w-20 text-title-lg',
} as const;

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  square,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  /** Kitchens and products read better as rounded squares than as circles. */
  square?: boolean;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-surface-muted',
        square ? 'rounded-md' : 'rounded-full',
        SIZES[size],
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          // Radix only swaps in the fallback after the image actually fails, so there is
          // no flash of initials for a cached image.
        />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 300 : 0}
        className="font-semibold text-ink-muted"
        aria-label={name}
      >
        {initialsOf(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/** Overlapping stack, used for "3 riders online" style summaries. */
export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          name={person.name}
          src={person.src}
          size={size}
          className="-ml-2 ring-2 ring-surface first:ml-0"
        />
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            '-ml-2 inline-flex items-center justify-center rounded-full bg-surface-muted font-semibold text-ink-muted ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
