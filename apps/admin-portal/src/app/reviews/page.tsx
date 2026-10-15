'use client';

import { PERMISSIONS } from '@ck/types';
import { Button, ErrorState, PageHeader, Pagination, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@ck/ui';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useModerateReview, useReviews } from '@/hooks/use-admin';

function Reviews() {
  const [page, setPage] = useState(1);
  const reviews = useReviews({ page, limit: 20 });
  const moderate = useModerateReview();

  return (
    <>
      <PageHeader title="Reviews" description="Hide a review that breaks campus rules. The rating is recomputed." />
      {reviews.isError ? (
        <ErrorState title="Could not load reviews" onRetry={() => void reviews.refetch()} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Rating</Th>
                  <Th>Body</Th>
                  <Th>Hidden</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(reviews.data?.items ?? []).map((review) => (
                  <Tr key={review.id}>
                    <Td className="tabular">{review.rating}/5</Td>
                    <Td className="max-w-md truncate">{review.comment ?? '—'}</Td>
                    <Td>{review.isHidden ? 'Yes' : 'No'}</Td>
                    <Td className="text-right">
                      <Button
                        size="xs"
                        variant={review.isHidden ? 'soft' : 'danger-soft'}
                        loading={moderate.isPending}
                        onClick={() =>
                          moderate.mutate({
                            id: review.id,
                            isHidden: !review.isHidden,
                            reason: review.isHidden ? 'Restored by moderator' : 'Hidden by moderator',
                          })
                        }
                      >
                        {review.isHidden ? 'Restore' : 'Hide'}
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} limit={20} total={reviews.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export default function ReviewsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.REVIEW_MODERATE}>
      <Reviews />
    </RequireAccess>
  );
}
