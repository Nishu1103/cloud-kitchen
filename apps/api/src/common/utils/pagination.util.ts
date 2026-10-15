import type { PaginatedResult } from '@ck/types';

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { items, page, limit, total, totalPages, hasNext: page < totalPages };
}

/**
 * Turns a `sort` query value into a Mongo sort object, refusing anything not on
 * the allowlist so a client cannot sort by an unindexed or sensitive field.
 */
export function buildSort(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: Record<string, 1 | -1>,
): Record<string, 1 | -1> {
  if (!sort) return fallback;
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  if (!allowed.includes(field)) return fallback;
  return { [field]: descending ? -1 : 1 };
}

/** Escapes user input before it reaches a `$regex`, preventing ReDoS and injection. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
