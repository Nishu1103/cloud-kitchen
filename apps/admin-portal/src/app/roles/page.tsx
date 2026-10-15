'use client';

import { PERMISSIONS } from '@ck/types';
import { Badge, ErrorState, PageHeader } from '@ck/ui';
import { RequireAccess } from '@/components/require-access';
import { usePermissionsCatalogue, useRoles } from '@/hooks/use-admin';

function Roles() {
  const roles = useRoles();
  const catalogue = usePermissionsCatalogue();

  return (
    <>
      <PageHeader
        title="Roles"
        description="Roles are named bundles of permissions. Code never checks a role name."
      />
      {roles.isError ? (
        <ErrorState title="Could not load roles" onRetry={() => void roles.refetch()} />
      ) : (
        <div className="space-y-6">
          {(roles.data ?? []).map((role) => (
            <div key={role.id}>
              <h2 className="text-title text-ink">
                {role.name}{' '}
                {role.isSystem ? (
                  <Badge size="sm" tone="neutral">
                    system
                  </Badge>
                ) : null}
              </h2>
              <p className="mb-2 text-caption text-ink-muted">{role.slug}</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((permission) => (
                  <Badge key={permission} size="sm">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {catalogue.data ? (
        <p className="mt-8 text-caption text-ink-muted">{catalogue.data.length} permissions in the catalogue.</p>
      ) : null}
    </>
  );
}

export default function RolesPage() {
  return (
    <RequireAccess permission={PERMISSIONS.ROLE_MANAGE}>
      <Roles />
    </RequireAccess>
  );
}
