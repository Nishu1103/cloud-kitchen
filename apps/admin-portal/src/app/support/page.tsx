'use client';

import { PERMISSIONS } from '@ck/types';
import { Button, ErrorState, Field, PageHeader, Pagination, Table, TableWrap, Tbody, Td, Textarea, Th, Thead, Tr } from '@ck/ui';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useReplyToTicket, useTickets } from '@/hooks/use-admin';

function Support() {
  const [page, setPage] = useState(1);
  const tickets = useTickets({ page, limit: 20 });
  const reply = useReplyToTicket();
  const [active, setActive] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Support" description="Campus tickets. A reply can also close the thread." />
      {tickets.isError ? (
        <ErrorState title="Could not load tickets" onRetry={() => void tickets.refetch()} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Subject</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Opened</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(tickets.data?.items ?? []).map((ticket) => (
                  <Tr key={ticket.id}>
                    <Td>
                      <button type="button" className="text-left font-medium text-brand hover:underline" onClick={() => setActive(ticket.id)}>
                        {ticket.subject}
                      </button>
                    </Td>
                    <Td>{ticket.category}</Td>
                    <Td>{ticket.status}</Td>
                    <Td className="text-caption text-ink-muted">
                      {new Date(ticket.createdAt).toLocaleString('en-IN')}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} limit={20} total={tickets.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}

      {active ? (
        <form
          className="mt-6 max-w-lg space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            reply.mutate({
              id: active,
              body: String(form.get('body') ?? ''),
              resolve: form.get('resolve') === 'on',
            });
          }}
        >
          <Field label="Reply" required>
            <Textarea name="body" required minLength={4} />
          </Field>
          <label className="flex items-center gap-2 text-caption">
            <input type="checkbox" name="resolve" />
            Close after sending
          </label>
          <Button type="submit" loading={reply.isPending}>
            Send reply
          </Button>
        </form>
      ) : null}
    </>
  );
}

export default function SupportPage() {
  return (
    <RequireAccess permission={PERMISSIONS.SUPPORT_TICKET_MANAGE}>
      <Support />
    </RequireAccess>
  );
}
