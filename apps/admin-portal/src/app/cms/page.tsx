'use client';

import { PERMISSIONS } from '@ck/types';
import { ErrorState, PageHeader, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@ck/ui';
import { RequireAccess } from '@/components/require-access';
import { useBanners, usePages } from '@/hooks/use-admin';

function Cms() {
  const pages = usePages();
  const banners = useBanners();

  return (
    <>
      <PageHeader title="Content" description="Public pages and home banners for this campus." />

      <h2 className="mb-2 text-title text-ink">Pages</h2>
      {pages.isError ? (
        <ErrorState title="Could not load pages" onRetry={() => void pages.refetch()} />
      ) : (
        <TableWrap className="mb-8">
          <Table>
            <Thead>
              <Tr>
                <Th>Slug</Th>
                <Th>Title</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(pages.data ?? []).map((page) => (
                <Tr key={page.slug}>
                  <Td className="font-medium">/{page.slug}</Td>
                  <Td>{page.title}</Td>
                  <Td>{page.status}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}

      <h2 className="mb-2 text-title text-ink">Banners</h2>
      {banners.isError ? (
        <ErrorState title="Could not load banners" onRetry={() => void banners.refetch()} />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <Tr>
                <Th>Title</Th>
                <Th>Placement</Th>
                <Th>Active</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(banners.data ?? []).map((banner) => (
                <Tr key={banner.id}>
                  <Td>{banner.title}</Td>
                  <Td>{banner.placement}</Td>
                  <Td>{banner.isActive ? 'Yes' : 'No'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

export default function CmsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.CMS_MANAGE}>
      <Cms />
    </RequireAccess>
  );
}
