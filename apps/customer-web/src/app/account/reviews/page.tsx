'use client';

import { EmptyState, SkeletonText } from '@ck/ui';
import { Star } from 'lucide-react';
import { AccountPanel, AccountSubhead } from '@/components/account-subhead';
import { RequireAuth } from '@/components/require-auth';
import { useMyReviews } from '@/hooks/use-account';

function ReviewsContents() {
  const reviews = useMyReviews(1);
  const items = reviews.data?.items ?? [];

  return (
    <div>
      <AccountSubhead title="Reviews" subtitle="Ratings you left after an order" />
      <div className="px-4">
        <AccountPanel>
          {reviews.isLoading ? (
            <div className="p-4">
              <SkeletonText lines={4} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              description="Rate a delivered order and it will show up here."
            />
          ) : (
            <ul>
              {items.map((review) => (
                <li key={review.id} className="border-b border-white/8 p-4 last:border-b-0">
                  <p className="inline-flex items-center gap-1 font-serif text-title text-gold">
                    <Star aria-hidden className="h-4 w-4 fill-current" />
                    {review.rating.toFixed(1)}
                  </p>
                  {review.comment ? (
                    <p className="mt-1 text-body text-ink">{review.comment}</p>
                  ) : (
                    <p className="mt-1 text-caption text-ink-muted">No written comment</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </AccountPanel>
      </div>
    </div>
  );
}

export default function AccountReviewsPage() {
  return (
    <RequireAuth>
      <ReviewsContents />
    </RequireAuth>
  );
}
