'use client';

import { PageHeader } from '@ck/ui';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useUnreadCount } from '@/hooks/use-admin';
import { adminSections, flattenNav, mobileTabs } from '@/lib/nav';
import { useSession } from '@/lib/session';

export default function MorePage() {
  const { can } = useSession();
  const { data: unread } = useUnreadCount();
  const extras = useMemo(() => {
    const items = flattenNav(adminSections(can, unread?.unread));
    const primary = new Set(mobileTabs(items).map((item) => item.href));
    return items.filter((item) => !primary.has(item.href));
  }, [can, unread?.unread]);

  return (
    <>
      <PageHeader title="More" description="The rest of campus operations." />
      <ul className="overflow-hidden rounded-[1.25rem] bg-surface">
        {extras.map((item) => (
          <li key={item.href} className="border-b border-line last:border-0">
            <Link href={item.href} className="flex items-center gap-3 px-4 py-3.5 text-body text-ink">
              <span className="text-brand">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="tabular rounded-full bg-brand px-1.5 py-0.5 text-micro font-semibold text-brand-ink">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
              <ChevronRight aria-hidden className="h-4 w-4 text-ink-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
