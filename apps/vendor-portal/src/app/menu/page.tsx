'use client';

import { DIET_TYPE, formatMoney, PERMISSIONS, type Product } from '@ck/types';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Pagination,
  Skeleton,
  Switch,
} from '@ck/ui';
import { ChefHat, MoreVertical, Plus, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DishForm } from '@/components/dish-form';
import { DishPhoto } from '@/components/dish-photo';
import { RequireAccess } from '@/components/require-access';
import { VendorScreen } from '@/components/vendor-screen';
import {
  useCreateProduct,
  useDeleteProduct,
  useMenuCategories,
  useMenuProducts,
  useSetStock,
  useUpdateProduct,
} from '@/hooks/use-menu';
import { useSession } from '@/lib/session';

const PAGE_SIZE = 40;

type Chip = { id: string; label: string };

function DishCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { can } = useSession();
  const setStock = useSetStock();
  const canStock = can(PERMISSIONS.INVENTORY_MANAGE);
  const canEdit = can(PERMISSIONS.PRODUCT_UPDATE);
  const canDelete = can(PERMISSIONS.PRODUCT_DELETE);

  return (
    <article className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="relative aspect-[4/3] bg-brand-soft">
        <DishPhoto src={product.imageUrl} className="absolute inset-0" />
        {canEdit || canStock || canDelete ? (
          <div className="absolute right-2 top-2">
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={`Actions for ${product.name}`}
                  className="h-8 w-8 rounded-full bg-white/90"
                >
                  <MoreVertical aria-hidden className="h-4 w-4" />
                </Button>
              </MenuTrigger>
              <MenuContent align="end">
                {canEdit ? <MenuItem onSelect={onEdit}>Edit dish</MenuItem> : null}
                {canStock ? (
                  <>
                    <MenuItem
                      onSelect={() =>
                        setStock.mutate({ id: product.id, stockQuantity: 0, isAvailable: false })
                      }
                    >
                      Mark sold out
                    </MenuItem>
                    <MenuItem
                      onSelect={() => setStock.mutate({ id: product.id, stockQuantity: null })}
                    >
                      Clear plate limit
                    </MenuItem>
                  </>
                ) : null}
                {canDelete ? (
                  <>
                    <MenuSeparator />
                    <MenuItem destructive onSelect={onDelete}>
                      Remove from menu
                    </MenuItem>
                  </>
                ) : null}
              </MenuContent>
            </Menu>
          </div>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <div>
          <p className="truncate text-caption font-semibold text-ink">{product.name}</p>
          <p className="tabular text-body font-semibold text-brand">
            {formatMoney(product.basePrice)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[11px] font-medium ${
              product.isAvailable ? 'text-success' : 'text-danger'
            }`}
          >
            {product.isAvailable ? 'Available' : 'Unavailable'}
          </span>
          <Switch
            checked={product.isAvailable}
            disabled={!canStock || setStock.isPending}
            aria-label={`${product.isAvailable ? 'Hide' : 'Show'} ${product.name}`}
            onCheckedChange={(checked) =>
              setStock.mutate({ id: product.id, isAvailable: checked })
            }
          />
        </div>
      </div>
    </article>
  );
}

function MenuScreen() {
  const { can } = useSession();
  const canCreate = can(PERMISSIONS.PRODUCT_CREATE);
  const router = useRouter();
  const params = useSearchParams();

  const [page, setPage] = useState(1);
  const [chip, setChip] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | undefined>();
  const [deleting, setDeleting] = useState<Product>();

  const { data: categories } = useMenuCategories();
  const { data, isLoading, isError, refetch } = useMenuProducts({
    page,
    limit: PAGE_SIZE,
    categoryId:
      chip.startsWith('cat:') ? chip.slice(4) : undefined,
  });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  useEffect(() => {
    if (params.get('new') === '1' && canCreate) {
      setEditing('new');
      router.replace('/menu');
    }
  }, [params, canCreate, router]);

  const chips: Chip[] = [
    { id: 'all', label: 'All Items' },
    { id: 'veg', label: 'Veg' },
    { id: 'non_veg', label: 'Non-Veg' },
    { id: 'bestseller', label: 'Bestseller' },
    ...(categories ?? []).map((category) => ({
      id: `cat:${category.id}`,
      label: category.name,
    })),
  ];

  const visible = useMemo(() => {
    const items = data?.items ?? [];
    const dietFiltered =
      chip === 'veg'
        ? items.filter(
            (product) =>
              product.diet === DIET_TYPE.VEG ||
              product.diet === DIET_TYPE.VEGAN ||
              product.diet === DIET_TYPE.JAIN,
          )
        : chip === 'non_veg'
          ? items.filter(
              (product) => product.diet === DIET_TYPE.NON_VEG || product.diet === DIET_TYPE.EGG,
            )
          : chip === 'bestseller'
            ? items.filter((product) => product.flags.includes('bestseller'))
            : items;
    const needle = query.trim().toLowerCase();
    if (!needle) return dietFiltered;
    return dietFiltered.filter((product) => product.name.toLowerCase().includes(needle));
  }, [data?.items, chip, query]);

  return (
    <>
      <VendorScreen title="Menu">
        <div className="mb-3">
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search dishes"
            aria-label="Search dishes"
            leading={<Search aria-hidden className="h-4 w-4" />}
          />
        </div>
        <div
          role="tablist"
          aria-label="Menu filters"
          className="mb-4 flex gap-1.5 overflow-x-auto pb-1"
        >
          {chips.map((item) => {
            const active = chip === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setChip(item.id);
                  setPage(1);
                }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-caption font-medium ${
                  active ? 'bg-brand text-brand-ink' : 'bg-surface text-ink-muted'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {isError ? (
          <ErrorState message="Could not load your menu." onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : !visible.length ? (
          <EmptyState
            icon={<ChefHat aria-hidden className="h-6 w-6" />}
            title={
              query.trim()
                ? 'No matching dishes'
                : chip === 'all'
                  ? 'Your menu is empty'
                  : 'Nothing in this filter'
            }
            description={
              query.trim()
                ? 'Try a different name or clear the search.'
                : chip === 'all'
                  ? 'Add your first dish and students can order it right away.'
                  : 'Try a different category.'
            }
            action={
              canCreate && chip === 'all' ? (
                <Button onClick={() => setEditing('new')}>Add your first dish</Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 pb-16">
              {visible.map((product) => (
                <DishCard
                  key={product.id}
                  product={product}
                  onEdit={() => setEditing(product)}
                  onDelete={() => setDeleting(product)}
                />
              ))}
            </div>
            {data ? (
              <Pagination
                page={data.page}
                limit={data.limit}
                total={data.total}
                onPageChange={setPage}
                className="mt-4"
              />
            ) : null}
          </>
        )}
      </VendorScreen>

      {canCreate ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(theme(spacing.tabbar)+0.75rem)] z-30">
          <div className="pointer-events-auto mx-auto max-w-lg px-4">
            <Button block size="lg" onClick={() => setEditing('new')}>
              <Plus aria-hidden className="h-4 w-4" />
              Add New Item
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <DishForm
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
          product={editing === 'new' ? undefined : editing}
          categories={categories ?? []}
          submitting={createProduct.isPending || updateProduct.isPending}
          onSubmit={(payload) =>
            editing === 'new'
              ? createProduct.mutateAsync(payload)
              : updateProduct.mutateAsync({ id: editing.id, payload })
          }
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Remove ${deleting?.name ?? 'this dish'}?`}
        description="It disappears from your menu. Past orders keep their record of it."
        confirmLabel="Remove"
        tone="danger"
        loading={deleteProduct.isPending}
        onConfirm={async () => {
          if (deleting) await deleteProduct.mutateAsync(deleting.id);
          setDeleting(undefined);
        }}
      />
    </>
  );
}

export default function MenuPage() {
  return (
    <RequireAccess permission={PERMISSIONS.PRODUCT_READ}>
      <MenuScreen />
    </RequireAccess>
  );
}
