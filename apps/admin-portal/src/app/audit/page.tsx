'use client';

import { PERMISSIONS } from '@ck/types';
import { ErrorState, PageHeader, Pagination, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@ck/ui';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useAuditLogs } from '@/hooks/use-admin';

function Audit() {
  const [page, setPage] = useState(1);
  const logs = useAuditLogs({ page, limit: 30 });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who did what. Sensitive fields are never stored here."
      />
      {logs.isError ? (
        <ErrorState title="Could not load the audit log" onRetry={() => void logs.refetch()} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Resource</Th>
                  <Th>Outcome</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(logs.data?.items ?? []).map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="text-caption text-ink-muted">
                      {new Date(entry.createdAt).toLocaleString('en-IN')}
                    </Td>
                    <Td>{entry.actorEmail ?? 'system'}</Td>
                    <Td className="font-medium">{entry.action}</Td>
                    <Td className="text-caption">
                      {entry.resource}
                      {entry.resourceId ? ` · ${entry.resourceId.slice(-6)}` : ''}
                    </Td>
                    <Td>{entry.outcome}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} limit={30} total={logs.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export default function AuditPage() {
  return (
    <RequireAccess permission={PERMISSIONS.AUDIT_LOG_READ}>
      <Audit />
    </RequireAccess>
  );
}
