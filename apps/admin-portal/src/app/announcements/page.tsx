'use client';

import { NOTIFICATION_AUDIENCE, PERMISSIONS } from '@ck/types';
import { Button, ErrorState, Field, Input, PageHeader, Pagination, Table, TableWrap, Tbody, Td, Textarea, Th, Thead, Tr } from '@ck/ui';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useAnnouncements, useCreateAnnouncement, useSendAnnouncement } from '@/hooks/use-admin';

function Announcements() {
  const [page, setPage] = useState(1);
  const list = useAnnouncements(page);
  const create = useCreateAnnouncement();
  const send = useSendAnnouncement();

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Campus-wide notices. Order updates stay unlimited; this is for broadcasts."
      />

      <form
        className="mb-8 max-w-lg space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          create.mutate({
            title: String(form.get('title') ?? ''),
            body: String(form.get('body') ?? ''),
            audiences: [NOTIFICATION_AUDIENCE.CUSTOMER],
            sendNow: form.get('sendNow') === 'on',
          });
          event.currentTarget.reset();
        }}
      >
        <Field label="Title" required>
          <Input name="title" required maxLength={120} />
        </Field>
        <Field label="Body" required>
          <Textarea name="body" required maxLength={400} />
        </Field>
        <label className="flex items-center gap-2 text-caption">
          <input type="checkbox" name="sendNow" />
          Send immediately
        </label>
        <Button type="submit" loading={create.isPending}>
          Save announcement
        </Button>
      </form>

      {list.isError ? (
        <ErrorState title="Could not load announcements" onRetry={() => void list.refetch()} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(list.data?.items ?? []).map((item) => (
                  <Tr key={item.id}>
                    <Td className="font-medium">{item.title}</Td>
                    <Td>{item.status}</Td>
                    <Td className="text-right">
                      {item.status === 'draft' ? (
                        <Button size="xs" loading={send.isPending} onClick={() => send.mutate(item.id)}>
                          Send
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} limit={20} total={list.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export default function AnnouncementsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.ANNOUNCEMENT_SEND}>
      <Announcements />
    </RequireAccess>
  );
}
