'use client';

import { formatMoney, PERMISSIONS } from '@ck/types';
import { ErrorState, PageHeader, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@ck/ui';
import { RequireAccess } from '@/components/require-access';
import { useCampuses, useCurrentCampus, useZones } from '@/hooks/use-admin';
import { useSession } from '@/lib/session';

function Campuses() {
  const { can } = useSession();
  const current = useCurrentCampus();
  const all = useCampuses();
  const zones = useZones();

  return (
    <>
      <PageHeader
        title="Campuses"
        description="A campus is a tenant. Adding one is configuration, not a new deployment."
      />

      {current.isError ? (
        <ErrorState title="Could not load this campus" onRetry={() => void current.refetch()} />
      ) : current.data ? (
        <div className="mb-8">
          <h2 className="text-title text-ink">{current.data.name}</h2>
          <p className="text-caption text-ink-muted">{current.data.slug}</p>
        </div>
      ) : null}

      <h3 className="mb-2 text-title text-ink">Delivery zones</h3>
      <TableWrap className="mb-8">
        <Table>
          <Thead>
            <Tr>
              <Th>Zone</Th>
              <Th>Fee</Th>
              <Th>ETA</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(zones.data ?? []).map((zone) => (
              <Tr key={zone.id}>
                <Td>{zone.name}</Td>
                <Td className="tabular">{formatMoney(zone.deliveryFee)}</Td>
                <Td>{zone.etaMinutes} min</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      {can(PERMISSIONS.CAMPUS_READ_ALL) ? (
        <>
          <h3 className="mb-2 text-title text-ink">All campuses</h3>
          {all.isError ? (
            <ErrorState title="Could not list campuses" onRetry={() => void all.refetch()} />
          ) : (
            <ul className="space-y-1">
              {(all.data ?? []).map((campus) => (
                <li key={campus.id} className="text-body">
                  {campus.name} <span className="text-caption text-ink-muted">({campus.slug})</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </>
  );
}

export default function CampusesPage() {
  return (
    <RequireAccess permission={PERMISSIONS.CAMPUS_READ}>
      <Campuses />
    </RequireAccess>
  );
}
