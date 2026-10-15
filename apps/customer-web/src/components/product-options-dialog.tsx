'use client';

import { formatMoney, type Product, type ProductOptionGroup } from '@ck/types';
import { Alert, Button, Checkbox, Modal, QuantityStepper, RadioGroup } from '@ck/ui';
import { useMemo, useState } from 'react';
import { useAddToCart } from '@/hooks/use-cart';

function isSingleChoice(group: ProductOptionGroup): boolean {
  return group.maxSelect === 1;
}

/**
 * Option picker for a customisable dish.
 *
 * Selections are validated here for immediate feedback, but the price shown is only a
 * preview: the authoritative total comes back from the server when the line is added,
 * because option prices can change between page load and checkout.
 */
export function ProductOptionsDialog({
  product,
  vendorId,
  open,
  onOpenChange,
}: {
  product: Product;
  vendorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addToCart = useAddToCart();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const choiceIds = useMemo(() => Object.values(selected).flat(), [selected]);

  const previewTotal = useMemo(() => {
    const extras = product.optionGroups
      .flatMap((group) => group.choices)
      .filter((choice) => choiceIds.includes(choice.id))
      .reduce((sum, choice) => sum + choice.priceDelta, 0);
    return (product.basePrice + extras) * quantity;
  }, [product, choiceIds, quantity]);

  const unmet = product.optionGroups.filter((group) => {
    const count = selected[group.id]?.length ?? 0;
    return count < group.minSelect || (group.required && count === 0);
  });

  const submit = () => {
    addToCart.mutate(
      { vendorId, productId: product.id, quantity, choiceIds, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelected({});
          setQuantity(1);
          setNotes('');
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={product.name}
      description={product.description}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <QuantityStepper value={quantity} min={1} max={20} onChange={setQuantity} />
          <Button
            onClick={submit}
            loading={addToCart.isPending}
            disabled={unmet.length > 0}
            className="flex-1 sm:flex-none"
          >
            Add · {formatMoney(previewTotal)}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {product.optionGroups.map((group) => {
          const single = isSingleChoice(group);
          const groupSelection = selected[group.id] ?? [];

          return (
            <fieldset key={group.id} className="space-y-2">
              <legend className="flex items-baseline justify-between gap-2 pb-1">
                <span className="text-body font-semibold text-ink">{group.name}</span>
                <span className="text-caption text-ink-subtle">
                  {group.required
                    ? 'Required'
                    : single
                      ? 'Pick one'
                      : `Pick up to ${group.maxSelect}`}
                </span>
              </legend>

              {single ? (
                <RadioGroup
                  value={groupSelection[0] ?? ''}
                  onValueChange={(value) =>
                    setSelected((prev) => ({ ...prev, [group.id]: [value] }))
                  }
                  options={group.choices.map((choice) => ({
                    value: choice.id,
                    label: choice.name,
                    hint: choice.priceDelta ? `+${formatMoney(choice.priceDelta)}` : undefined,
                    disabled: !choice.isAvailable,
                  }))}
                />
              ) : (
                <div className="space-y-1">
                  {group.choices.map((choice) => {
                    const checked = groupSelection.includes(choice.id);
                    // Enforced here so the control cannot exceed what the server allows.
                    const atLimit = !checked && groupSelection.length >= group.maxSelect;

                    return (
                      <Checkbox
                        key={choice.id}
                        checked={checked}
                        disabled={!choice.isAvailable || atLimit}
                        label={choice.name}
                        hint={choice.priceDelta ? `+${formatMoney(choice.priceDelta)}` : undefined}
                        onCheckedChange={(next) =>
                          setSelected((prev) => {
                            const current = prev[group.id] ?? [];
                            return {
                              ...prev,
                              [group.id]: next
                                ? [...current, choice.id]
                                : current.filter((id) => id !== choice.id),
                            };
                          })
                        }
                      />
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}

        <label className="block space-y-1">
          <span className="text-caption font-medium text-ink">Note for the kitchen</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Less spicy, no onion…"
            className="w-full rounded border border-line-strong bg-surface p-2 text-body placeholder:text-ink-subtle"
          />
        </label>

        {unmet.length > 0 ? (
          <Alert tone="info">Choose an option for {unmet.map((group) => group.name).join(', ')}.</Alert>
        ) : null}
      </div>
    </Modal>
  );
}
