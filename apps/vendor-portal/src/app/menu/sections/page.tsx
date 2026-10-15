'use client';

import { PERMISSIONS } from '@ck/types';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SkeletonText,
} from '@ck/ui';
import { Plus, Tags } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useCreateCategory, useMenuCategories, useMenuProducts } from '@/hooks/use-menu';

/** Mirrors the API's slug rule so a rejection happens before the request. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function NewSectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const createCategory = useCreateCategory();

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const slug = slugify(name);
    if (!slug) {
      setError('Use a name with at least one letter or number.');
      return;
    }

    await createCategory.mutateAsync({ name: name.trim(), slug });
    setName('');
    setError(undefined);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New section"
      description="Sections group your dishes on the storefront, like Starters or Thalis."
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createCategory.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="section-form" loading={createCategory.isPending}>
            Create section
          </Button>
        </>
      }
    >
      <form id="section-form" onSubmit={submit} noValidate>
        <Field label="Section name" required error={error} hint="Students see this heading.">
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            placeholder="Starters"
            autoComplete="off"
            maxLength={60}
          />
        </Field>
      </form>
    </Modal>
  );
}

function SectionsScreen() {
  const [creating, setCreating] = useState(false);
  const { data: categories, isLoading, isError, refetch } = useMenuCategories();

  // Dish counts come from the menu list rather than a dedicated endpoint; the first page
  // is enough to answer "is this section in use", which is all the count is for here.
  const { data: products } = useMenuProducts({ limit: 100 });
  const countFor = (categoryId: string) =>
    (products?.items ?? []).filter((product) => product.categoryId === categoryId).length;

  return (
    <>
      <PageHeader
        title="Menu sections"
        description="The order students scroll through. Dishes without a section appear at the end."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            New section
          </Button>
        }
      />

      {isError ? (
        <ErrorState message="Could not load your sections." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Card>
          <CardBody>
            <SkeletonText lines={4} />
          </CardBody>
        </Card>
      ) : !categories?.length ? (
        <EmptyState
          icon={<Tags aria-hidden className="h-6 w-6" />}
          title="No sections yet"
          description="Your menu works without them, but sections make a long menu much easier to scan."
          action={<Button onClick={() => setCreating(true)}>Create a section</Button>}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {categories.map((category) => {
              const count = countFor(category.id);
              return (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink">{category.name}</p>
                    <p className="text-caption text-ink-subtle">/{category.slug}</p>
                  </div>
                  <span className="tabular shrink-0 text-caption text-ink-muted">
                    {count} {count === 1 ? 'dish' : 'dishes'}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <NewSectionDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

export default function SectionsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.CATEGORY_MANAGE}>
      <SectionsScreen />
    </RequireAccess>
  );
}
