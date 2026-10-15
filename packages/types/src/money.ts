import type { Paise } from './entities';

/**
 * Currency helpers shared by API and every portal so a price is formatted and
 * rounded identically everywhere. Integer paise in, string out.
 */
export const rupeesToPaise = (rupees: number): Paise => Math.round(rupees * 100);

export const paiseToRupees = (paise: Paise): number => paise / 100;

export function formatMoney(paise: Paise, options: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = options;
  const value = (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `₹${value}` : value;
}

/** Percentage of an amount, rounded half-up to the nearest paisa. */
export const percentOf = (paise: Paise, percent: number): Paise =>
  Math.round((paise * percent) / 100);

export const clampPaise = (value: number, min: Paise, max: Paise): Paise =>
  Math.min(Math.max(Math.round(value), min), max);
