'use client';

import { PERMISSIONS, type Review } from '@ck/types';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Pagination,
  SkeletonText,
  Textarea,
} from '@ck/ui';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useReplyToReview, useReviews } from '@/hooks/use-kitchen';

const RATING_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 5, label: '5' },
  { value: 4, label: '4' },
  { value: 3, label: '3' },
  { value: 2, label: '2' },
  { value: 1, label: '1' },
] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden
          className={
            value <= rating ? 'h-4 w-4 fill-warning text-warning' : 'h-4 w-4 text-line-strong'
          }
        />
      ))}
    </span>
  );
}

function ReplyDialog({
  review,
  onClose,
}: {
  review: Review | undefined;
  onClose: () => void;
}) {
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string>();
  const replyToReview = useReplyToReview();

  const submit = async () => {
    if (reply.trim().length < 5) {
      setError('Write at least a short reply.');
      return;
    }
    if (review) await replyToReview.mutateAsync({ id: review.id, reply: reply.trim() });
    setReply('');
    setError(undefined);
    onClose();
  };

  return (
    <Modal
      open={Boolean(review)}
      onOpenChange={(open) => !open && onClose()}
      title="Reply publicly"
      description="Your reply appears under the review on your storefront, with your kitchen's name."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={replyToReview.isPending}>
            Cancel
          </Button>
          <Button loading={replyToReview.isPending} onClick={() => void submit()}>
            Post reply
          </Button>
        </>
      }
    >
      {review ? (
        <div className="space-y-4">
          <div className="rounded border border-line bg-surface-muted p-3">
            <Stars rating={review.rating} />
            {review.comment ? (
              <p className="mt-1.5 text-body text-ink">{review.comment}</p>
            ) : (
              <p className="mt-1.5 text-caption text-ink-subtle">No comment left.</p>
            )}
          </div>

          <Field label="Your reply" required error={error}>
            <Textarea
              value={reply}
              onChange={(event) => {
                setReply(event.target.value);
                setError(undefined);
              }}
              rows={4}
              maxLength={500}
              placeholder="Thanks for the feedback — we've fixed the packaging on this dish."
            />
          </Field>

          <p className="text-caption text-ink-subtle">
            A calm, specific reply reads better to the next student than an apology. It cannot
            be edited once posted.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

function ReviewsScreen() {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState<number | undefined>();
  const [replying, setReplying] = useState<Review>();

  const { data, isLoading, isError, refetch } = useReviews({ page, rating });

  return (
    <>
      <PageHeader
        title="Reviews"
        description="What students say after eating. Replies are public."
      />

      <div role="group" aria-label="Filter by rating" className="mb-4 flex flex-wrap gap-1">
        {RATING_FILTERS.map((filter) => (
          <Button
            key={filter.label}
            size="sm"
            variant={rating === filter.value ? 'primary' : 'ghost'}
            aria-pressed={rating === filter.value}
            onClick={() => {
              setRating(filter.value);
              setPage(1);
            }}
          >
            {filter.value ? (
              <>
                {filter.label}
                <Star aria-hidden className="h-3.5 w-3.5" />
              </>
            ) : (
              filter.label
            )}
          </Button>
        ))}
      </div>

      {isError ? (
        <ErrorState message="Could not load your reviews." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Card>
          <CardBody>
            <SkeletonText lines={6} />
          </CardBody>
        </Card>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Star aria-hidden className="h-6 w-6" />}
          title={rating ? `No ${rating}-star reviews` : 'No reviews yet'}
          description={
            rating
              ? 'Try another rating.'
              : 'Students can review once an order is delivered. They arrive here as they come in.'
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((review) => (
              <li key={review.id}>
                <Card>
                  <CardBody className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Stars rating={review.rating} />
                        <span className="text-caption text-ink-muted">
                          {review.customerName}
                        </span>
                      </div>
                      <span className="text-caption text-ink-subtle">
                        {new Date(review.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>

                    {review.comment ? (
                      <p className="text-body text-ink">{review.comment}</p>
                    ) : null}

                    {review.vendorReply ? (
                      <div className="rounded border-l-2 border-brand bg-brand-soft/40 px-3 py-2">
                        <p className="text-caption font-medium text-brand">Your reply</p>
                        <p className="text-body text-ink">{review.vendorReply}</p>
                      </div>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => setReplying(review)}>
                        Reply
                      </Button>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>

          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
            className="mt-4"
          />
        </>
      )}

      <ReplyDialog
        // Re-keyed so the textarea is empty for each review.
        key={replying?.id ?? 'none'}
        review={replying}
        onClose={() => setReplying(undefined)}
      />
    </>
  );
}

export default function ReviewsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.REVIEW_REPLY}>
      <ReviewsScreen />
    </RequireAccess>
  );
}
