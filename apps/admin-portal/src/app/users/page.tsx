'use client';

import { PERMISSIONS, USER_STATUS } from '@ck/types';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  TableSkeleton,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@ck/ui';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useUpdateUser, useUsers } from '@/hooks/use-admin';

function People() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);
  const users = useUsers({ page, limit: 20, search: search || undefined });
  const update = useUpdateUser();

  return (
    <>
      <PageHeader
        title="People"
        description="Students, kitchen staff and riders on this campus. Suspension revokes every session immediately."
      />
      <form
        className="mb-4 max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPage(1);
          setSearch(String(form.get('q') ?? '').trim());
        }}
      >
        <Field label="Search">
          <Input name="q" defaultValue={search} placeholder="Name, email or phone" />
        </Field>
      </form>

      {users.isError ? (
        <ErrorState
          title="Could not load people"
          message="Try again in a moment."
          onRetry={() => void users.refetch()}
        />
      ) : users.isLoading ? (
        <TableWrap>
          <Table>
            <TableSkeleton rows={8} cols={5} />
          </Table>
        </TableWrap>
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Roles</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(users.data?.items ?? []).map((person) => (
                  <Tr key={person.id}>
                    <Td className="font-medium">{person.name}</Td>
                    <Td className="text-ink-muted">{person.email}</Td>
                    <Td>
                      <StatusBadge status={person.status} />
                    </Td>
                    <Td className="text-caption text-ink-muted">
                      {(person.roles ?? []).join(', ') || '—'}
                    </Td>
                    <Td className="text-right">
                      {person.status === USER_STATUS.ACTIVE ? (
                        <Button size="xs" variant="danger-soft" onClick={() => setPending({ id: person.id, name: person.name })}>
                          Suspend
                        </Button>
                      ) : person.status === USER_STATUS.SUSPENDED ? (
                        <Button
                          size="xs"
                          variant="soft"
                          onClick={() => update.mutate({ id: person.id, status: USER_STATUS.ACTIVE })}
                          loading={update.isPending}
                        >
                          Reinstate
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination
            page={page}
            limit={20}
            total={users.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={`Suspend ${pending?.name}?`}
        description="They will be signed out of every device immediately and cannot place orders until reinstated."
        confirmLabel="Suspend account"
        onConfirm={() => {
          if (!pending) return;
          update.mutate(
            { id: pending.id, status: USER_STATUS.SUSPENDED, statusReason: 'Suspended by campus admin' },
            { onSettled: () => setPending(null) },
          );
        }}
        loading={update.isPending}
      />
    </>
  );
}

export default function PeoplePage() {
  return (
    <RequireAccess permission={PERMISSIONS.USER_READ}>
      <People />
    </RequireAccess>
  );
}
