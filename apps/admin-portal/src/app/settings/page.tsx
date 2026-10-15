'use client';

import { PERMISSIONS } from '@ck/types';
import { ErrorState, PageHeader, Switch, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@ck/ui';
import { RequireAccess } from '@/components/require-access';
import { useFeatureFlags, useSettings, useUpsertFlag } from '@/hooks/use-admin';
import { useSession } from '@/lib/session';

function Settings() {
  const { can } = useSession();
  const flags = useFeatureFlags();
  const settings = useSettings();
  const upsert = useUpsertFlag();

  return (
    <>
      <PageHeader
        title="Platform settings"
        description="Feature flags turn capabilities on without a deploy. Settings are campus configuration."
      />

      {can(PERMISSIONS.FEATURE_FLAG_MANAGE) ? (
        <>
          <h2 className="mb-3 text-title text-ink">Feature flags</h2>
          {flags.isError ? (
            <ErrorState title="Could not load flags" onRetry={() => void flags.refetch()} />
          ) : (
            <TableWrap className="mb-8">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Flag</Th>
                    <Th>Description</Th>
                    <Th className="text-right">On</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(flags.data ?? []).map((flag) => (
                    <Tr key={flag.key}>
                      <Td className="font-medium">{flag.key}</Td>
                      <Td className="text-ink-muted">{flag.description ?? '—'}</Td>
                      <Td className="text-right">
                        <Switch
                          checked={flag.enabled}
                          disabled={upsert.isPending}
                          onCheckedChange={(enabled) =>
                            upsert.mutate({ key: flag.key, enabled, description: flag.description })
                          }
                          aria-label={`Toggle ${flag.key}`}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </>
      ) : null}

      {can(PERMISSIONS.PLATFORM_SETTINGS_MANAGE) ? (
        <>
          <h2 className="mb-3 text-title text-ink">Settings</h2>
          {settings.isError ? (
            <ErrorState title="Could not load settings" onRetry={() => void settings.refetch()} />
          ) : (
            <pre className="overflow-x-auto rounded border border-line bg-surface-muted p-4 text-caption">
              {JSON.stringify(settings.data ?? {}, null, 2)}
            </pre>
          )}
        </>
      ) : null}
    </>
  );
}

export default function SettingsPage() {
  return (
    <RequireAccess>
      <Settings />
    </RequireAccess>
  );
}
