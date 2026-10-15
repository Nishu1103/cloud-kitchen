'use client';

import type { NavItem } from '@ck/ui';
import { Input, Modal } from '@ck/ui';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

/**
 * Jump to a screen the operator can already see.
 *
 * This is not a campus-wide search: querying users or orders from a keystroke would
 * need its own permissioned endpoint. The palette only lists navigation the session
 * already has.
 */
export function AdminJump({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.label.toLowerCase().includes(needle));
  }, [items, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 min-w-[16rem] items-center gap-2 rounded-full border border-line bg-surface px-3 text-left text-caption text-ink-muted lg:flex"
      >
        <Search aria-hidden className="h-4 w-4" />
        <span className="flex-1">Jump to a page</span>
        <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle">
          Ctrl K
        </kbd>
      </button>

      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
        title="Jump to"
        description="Screens you already have permission to open."
      >
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Orders, kitchens, users…"
          aria-label="Filter pages"
          leading={<Search aria-hidden className="h-4 w-4" />}
        />
        <ul className="mt-3 max-h-72 overflow-y-auto">
          {matches.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-body text-ink hover:bg-surface-muted"
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  router.push(item.href);
                }}
              >
                <span className="text-ink-subtle">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="px-3 py-6 text-center text-caption text-ink-subtle">No matching page.</li>
          ) : null}
        </ul>
      </Modal>
    </>
  );
}
