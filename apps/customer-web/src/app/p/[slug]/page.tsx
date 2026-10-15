'use client';

import { EmptyState, ErrorState, PageHeader, SkeletonText } from '@ck/ui';
import { useQuery } from '@tanstack/react-query';
import { FileQuestion } from 'lucide-react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { sanitizeCmsHtml } from '@/lib/sanitize';

/**
 * Campus CMS content: terms, privacy, refund policy, campus rules.
 *
 * The HTML is authored by admins, not by students, but it is still sanitised on the way
 * in — a stored-XSS payload in a policy page would run with the session's own origin.
 */
export default function CmsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: keys.cmsPage(slug),
    queryFn: () => api.discovery.page(slug),
    enabled: Boolean(slug),
    staleTime: 15 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonText lines={2} />
        <SkeletonText lines={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<FileQuestion aria-hidden className="h-6 w-6" />}
        title="Page not found"
        description="This page may have been renamed or unpublished."
      />
    );
  }

  if (!data) {
    return <ErrorState message="We could not load this page." onRetry={() => refetch()} />;
  }

  return (
    <article className="space-y-5">
      <PageHeader
        title={data.title}
        description={
          data.updatedAt
            ? `Updated ${new Date(data.updatedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}`
            : undefined
        }
      />
      <div
        className="ck-prose"
        dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(data.contentHtml) }}
      />
    </article>
  );
}
