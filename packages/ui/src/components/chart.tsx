'use client';

import { useId } from 'react';
import { cn } from '../lib/cn';

export interface ChartPoint {
  /** Axis label, e.g. a date or an hour. */
  label: string;
  value: number;
  /** Optional pre-formatted value for the tooltip and screen readers. */
  display?: string;
}

/**
 * Small charts, drawn as SVG with no charting dependency.
 *
 * A dashboard needs a shape, not a plotting library: two components covering "how did
 * this change over time" and "how does this compare" avoid ~100 kB of JavaScript on a
 * screen that is read for five seconds. Both are keyboard- and screen-reader-accessible
 * through a table equivalent rather than an interactive canvas.
 */
function niceMax(values: number[]): number {
  const max = Math.max(0, ...values);
  if (max === 0) return 1;
  // Round up to a single significant figure so the top gridline reads cleanly.
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

/** Screen-reader equivalent: the same numbers, as a table. */
function DataTable({ points, caption }: { points: ChartPoint[]; caption: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.label}>
            <th scope="row">{point.label}</th>
            <td>{point.display ?? point.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Sparkline({
  points,
  caption,
  height = 72,
  className,
}: {
  points: ChartPoint[];
  caption: string;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();
  const max = niceMax(points.map((point) => point.value));

  // A single point has no line to draw; two are enough for a trend.
  if (points.length < 2) {
    return (
      <p className={cn('text-caption text-ink-subtle', className)}>
        Not enough data yet to show a trend.
      </p>
    );
  }

  const step = 100 / (points.length - 1);
  const coords = points.map((point, index) => ({
    x: index * step,
    // SVG y grows downward, so the value is inverted. 4% headroom keeps the peak's
    // stroke from being clipped by the viewBox.
    y: 96 - (point.value / max) * 92,
  }));

  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const area = `${line} L100 100 L0 100 Z`;

  return (
    <div className={cn('text-brand', className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={caption}
        style={{ height }}
        className="w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          // Stroke width is in user units, which `preserveAspectRatio="none"` would
          // stretch horizontally; this keeps it an even 2px on screen.
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <DataTable points={points} caption={caption} />
    </div>
  );
}

export function BarChart({
  points,
  caption,
  className,
  barClassName,
  labelClassName,
  heightClassName = 'h-32',
  labelEvery = 1,
  emphasisIndex,
}: {
  points: ChartPoint[];
  caption: string;
  className?: string;
  barClassName?: string;
  labelClassName?: string;
  heightClassName?: string;
  /** Show every Nth axis label. Hourly charts use 3 so the axis stays readable. */
  labelEvery?: number;
  /** One bar drawn at full brand strength (e.g. today on a weekly chart). */
  emphasisIndex?: number;
}) {
  const max = niceMax(points.map((point) => point.value));

  return (
    <div className={className}>
      <div aria-hidden className={cn('flex items-end gap-1.5', heightClassName)}>
        {points.map((point, index) => (
          <div key={point.label} className="group flex h-full flex-1 flex-col justify-end">
            <div
              className={cn(
                'rounded-t-md bg-brand/80 transition-colors group-hover:bg-brand',
                barClassName,
                emphasisIndex === index && 'bg-brand',
              )}
              style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
              title={`${point.label}: ${point.display ?? point.value}`}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-2 flex gap-1">
        {points.map((point, index) => (
          <span
            key={point.label}
            className={cn(
              'flex-1 truncate text-center text-micro text-ink-subtle',
              labelClassName,
            )}
          >
            {index % labelEvery === 0 ? point.label : ''}
          </span>
        ))}
      </div>
      <DataTable points={points} caption={caption} />
    </div>
  );
}

const DONUT_TONES = [
  'stroke-brand',
  'stroke-info',
  'stroke-warning',
  'stroke-success',
  'stroke-danger',
  'stroke-ink-muted',
] as const;

const DONUT_DOTS = [
  'bg-brand',
  'bg-info',
  'bg-warning',
  'bg-success',
  'bg-danger',
  'bg-ink-muted',
] as const;

/** Categorical mix (payment methods, kitchen statuses). Not a plotting library. */
export function DonutChart({
  points,
  caption,
  className,
}: {
  points: ChartPoint[];
  caption: string;
  className?: string;
}) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row', className)}>
      <svg viewBox="0 0 88 88" className="h-40 w-40 shrink-0" role="img" aria-label={caption}>
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          className="stroke-line"
          strokeWidth="10"
        />
        {total > 0
          ? points.map((point, index) => {
              const length = (point.value / total) * circumference;
              const circle = (
                <circle
                  key={point.label}
                  cx="44"
                  cy="44"
                  r={radius}
                  fill="none"
                  strokeWidth="10"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  className={DONUT_TONES[index % DONUT_TONES.length]}
                  transform="rotate(-90 44 44)"
                />
              );
              offset += length;
              return circle;
            })
          : null}
      </svg>
      <ul className="w-full space-y-2">
        {points.map((point, index) => (
          <li key={point.label} className="flex items-center justify-between gap-3 text-caption">
            <span className="flex min-w-0 items-center gap-2 text-ink">
              <span
                aria-hidden
                className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DONUT_DOTS[index % DONUT_DOTS.length])}
              />
              <span className="truncate">{point.label}</span>
            </span>
            <span className="tabular shrink-0 text-ink-muted">
              {point.display ?? point.value}
              {total > 0 ? ` · ${Math.round((point.value / total) * 100)}%` : ''}
            </span>
          </li>
        ))}
      </ul>
      <DataTable points={points} caption={caption} />
    </div>
  );
}
