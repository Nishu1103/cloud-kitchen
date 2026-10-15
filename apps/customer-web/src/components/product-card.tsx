'use client';

import { formatMoney, type Product } from '@ck/types';
import { Badge, Button, QuantityStepper, cn } from '@ck/ui';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { RemoteImage } from '@/components/remote-image';
import { useAddToCart, useCart, useUpdateCartLine } from '@/hooks/use-cart';
import { useSaved } from '@/lib/saved';
import { useSession } from '@/lib/session';
import { DEFAULT_COVER } from '@/lib/media';

function DietMark({ diet }: { diet: Product['diet'] }) {
  const veg = diet === 'veg' || diet === 'vegan';
  return (
    <span
      aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
        veg ? 'border-success' : 'border-danger',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', veg ? 'bg-success' : 'bg-danger')} />
    </span>
  );
}

export function ProductCard({
  product,
  vendorId,
  vendorSlug,
  vendorOpen,
}: {
  product: Product;
  vendorId: string;
  vendorSlug: string;
  vendorOpen: boolean;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { data: cart } = useCart();
  const addToCart = useAddToCart();
  const updateLine = useUpdateCartLine();
  const { user } = useSession();
  const saved = useSaved(user?.id);

  const lines = cart?.lines.filter((line) => line.productId === product.id) ?? [];
  const singleLine = lines.length === 1 ? lines[0] : undefined;
  const hasOptions = (product.optionGroups?.length ?? 0) > 0;

  const soldOut =
    !product.isAvailable || (product.stockQuantity !== undefined && product.stockQuantity === 0);
  const disabled = soldOut || !vendorOpen;
  const busy = addToCart.isPending || updateLine.isPending;
  const isSaved = saved.isProductSaved(product.id);

  const add = () => {
    if (hasOptions) {
      setOptionsOpen(true);
      return;
    }
    addToCart.mutate({ vendorId, productId: product.id, quantity: 1 });
  };

  return (
    <>
      <article className="flex items-center gap-3 border-b border-line/60 py-4 last:border-b-0">
        <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl bg-surface-muted">
          {product.imageUrl ? (
            <RemoteImage
              src={product.imageUrl}
              fallback={DEFAULT_COVER}
              alt=""
              fill
              sizes="84px"
              className={cn('object-cover', disabled && 'opacity-50 saturate-50')}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <DietMark diet={product.diet} />
            {product.flags?.includes('bestseller') ? (
              <Badge tone="warning" size="sm">
                Bestseller
              </Badge>
            ) : null}
          </div>

          <h3 className="font-serif text-body font-semibold text-ink">{product.name}</h3>
          {product.description ? (
            <p className="line-clamp-1 text-caption text-ink-muted">{product.description}</p>
          ) : null}

          <p className="flex flex-wrap items-center gap-2">
            <span className="tabular text-body font-semibold text-ink">
              {formatMoney(product.basePrice)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.basePrice ? (
              <>
                <span className="tabular text-caption text-ink-subtle line-through">
                  {formatMoney(product.compareAtPrice)}
                </span>
                <span className="text-micro font-semibold text-danger">
                  {Math.round(
                    ((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100,
                  )}
                  % OFF
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex w-[4.75rem] shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            aria-pressed={isSaved}
            aria-label={isSaved ? 'Unsave dish' : 'Save dish'}
            className="text-ink-subtle"
            onClick={() =>
              saved.toggleProduct({
                id: product.id,
                vendorSlug,
                name: product.name,
                imageUrl: product.imageUrl,
                basePrice: product.basePrice,
              })
            }
          >
            <Heart aria-hidden className={cn('h-4 w-4', isSaved && 'fill-danger text-danger')} />
          </button>

          {disabled ? (
            <span className="text-center text-micro font-semibold uppercase tracking-wide text-ink-subtle">
              {soldOut ? 'Sold out' : 'Closed'}
            </span>
          ) : singleLine ? (
            <QuantityStepper
              size="sm"
              value={singleLine.quantity}
              disabled={busy}
              onChange={(quantity) => updateLine.mutate({ lineId: singleLine.id, quantity })}
            />
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full border-brand px-4 text-brand"
              loading={busy}
              onClick={add}
            >
              ADD
            </Button>
          )}
        </div>
      </article>

      {hasOptions ? (
        <ProductOptionsDialog
          product={product}
          vendorId={vendorId}
          open={optionsOpen}
          onOpenChange={setOptionsOpen}
        />
      ) : null}
    </>
  );
}
