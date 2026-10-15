'use client';

import type { ProductPayload } from '@ck/sdk';
import {
  DIET_TYPE,
  paiseToRupees,
  rupeesToPaise,
  type DietType,
  type Product,
} from '@ck/types';
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
} from '@ck/ui';
import { useState, type FormEvent } from 'react';
import { ImagePicker } from './image-picker';

const DIET_OPTIONS = [
  { value: DIET_TYPE.VEG, label: 'Veg' },
  { value: DIET_TYPE.EGG, label: 'Contains egg' },
  { value: DIET_TYPE.NON_VEG, label: 'Non-veg' },
  { value: DIET_TYPE.VEGAN, label: 'Vegan' },
  { value: DIET_TYPE.JAIN, label: 'Jain' },
];

const SPICE_OPTIONS = [
  { value: '0', label: 'Not spicy' },
  { value: '1', label: 'Mild' },
  { value: '2', label: 'Spicy' },
  { value: '3', label: 'Very spicy' },
];

interface DraftState {
  name: string;
  description: string;
  /** Rupees as typed. Converted to paise only on submit. */
  price: string;
  compareAtPrice: string;
  diet: DietType;
  spiceLevel: string;
  prepMinutes: string;
  categoryId: string;
  imageUrl?: string;
  /** Empty string means untracked stock, which is the common case. */
  stockQuantity: string;
  isAvailable: boolean;
}

function toDraft(product?: Product): DraftState {
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? String(paiseToRupees(product.basePrice)) : '',
    compareAtPrice: product?.compareAtPrice ? String(paiseToRupees(product.compareAtPrice)) : '',
    diet: product?.diet ?? DIET_TYPE.VEG,
    spiceLevel: String(product?.spiceLevel ?? 0),
    prepMinutes: String(product?.prepMinutes ?? 15),
    categoryId: product?.categoryId ?? '',
    imageUrl: product?.imageUrl,
    stockQuantity:
      product?.stockQuantity === undefined || product.stockQuantity === null
        ? ''
        : String(product.stockQuantity),
    isAvailable: product?.isAvailable ?? true,
  };
}

type Errors = Partial<Record<'name' | 'price' | 'compareAtPrice' | 'prepMinutes', string>>;

/**
 * Validated here as well as on the API.
 *
 * Not as a security boundary - the API is the only authority - but because a kitchen
 * fixing a typo should not have to wait for a round trip to be told the price is blank.
 */
function validate(draft: DraftState): Errors {
  const errors: Errors = {};
  const price = Number(draft.price);
  const compareAt = draft.compareAtPrice ? Number(draft.compareAtPrice) : undefined;

  if (draft.name.trim().length < 2) errors.name = 'Give the dish a name.';
  if (!draft.price || Number.isNaN(price) || price <= 0) {
    errors.price = 'Enter a price above zero.';
  }
  if (compareAt !== undefined && (Number.isNaN(compareAt) || compareAt <= price)) {
    errors.compareAtPrice = 'The old price must be higher than the current price.';
  }
  const prep = Number(draft.prepMinutes);
  if (Number.isNaN(prep) || prep < 1 || prep > 180) {
    errors.prepMinutes = 'Between 1 and 180 minutes.';
  }
  return errors;
}

export function DishForm({
  open,
  onOpenChange,
  product,
  categories,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent for a new dish. */
  product?: Product;
  categories: { id: string; name: string }[];
  onSubmit: (payload: ProductPayload) => Promise<unknown>;
  submitting?: boolean;
}) {
  // Re-keyed by product id so opening a different dish resets the draft.
  const [draft, setDraft] = useState<DraftState>(() => toDraft(product));
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload: ProductPayload = {
      name: draft.name.trim(),
      diet: draft.diet,
      basePrice: rupeesToPaise(Number(draft.price)),
      description: draft.description.trim() || undefined,
      categoryId: draft.categoryId || undefined,
      imageUrl: draft.imageUrl,
      compareAtPrice: draft.compareAtPrice
        ? rupeesToPaise(Number(draft.compareAtPrice))
        : undefined,
      spiceLevel: Number(draft.spiceLevel),
      prepMinutes: Number(draft.prepMinutes),
      // `null` is meaningful: it clears a limit rather than leaving the old one.
      stockQuantity: draft.stockQuantity === '' ? null : Number(draft.stockQuantity),
      isAvailable: draft.isAvailable,
    };

    await onSubmit(payload);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={product ? `Edit ${product.name}` : 'Add a dish'}
      description="Students see this exactly as you write it."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="dish-form" loading={submitting}>
            {product ? 'Save changes' : 'Add to menu'}
          </Button>
        </>
      }
    >
      <form id="dish-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ImagePicker
          value={draft.imageUrl}
          onChange={(url) => set('imageUrl', url)}
          disabled={submitting}
          purpose="menu"
        />

        <Field label="Dish name" required error={errors.name}>
          <Input
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Paneer Butter Masala"
            autoComplete="off"
            maxLength={120}
          />
        </Field>

        <Field label="Description" hint="One line on what makes it good.">
          <Textarea
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            rows={2}
            maxLength={400}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price" required error={errors.price} hint="In rupees.">
            <Input
              value={draft.price}
              onChange={(event) => set('price', event.target.value)}
              inputMode="decimal"
              placeholder="180"
            />
          </Field>

          <Field
            label="Old price"
            error={errors.compareAtPrice}
            hint="Optional. Shown struck through."
          >
            <Input
              value={draft.compareAtPrice}
              onChange={(event) => set('compareAtPrice', event.target.value)}
              inputMode="decimal"
              placeholder="220"
            />
          </Field>

          <Field label="Diet" required>
            <Select
              value={draft.diet}
              onValueChange={(value) => set('diet', value as DietType)}
              options={DIET_OPTIONS}
            />
          </Field>

          <Field label="Spice">
            <Select
              value={draft.spiceLevel}
              onValueChange={(value) => set('spiceLevel', value)}
              options={SPICE_OPTIONS}
            />
          </Field>

          <Field label="Section" hint="Where it sits on your menu.">
            <Select
              value={draft.categoryId}
              onValueChange={(value) => set('categoryId', value)}
              placeholder="No section"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </Field>

          <Field
            label="Prep time"
            required
            error={errors.prepMinutes}
            hint="Minutes. Used for the student's ETA."
          >
            <Input
              value={draft.prepMinutes}
              onChange={(event) => set('prepMinutes', event.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field
          label="Plates available today"
          hint="Leave blank for unlimited. The counter drops with each order and the dish goes sold out at zero."
        >
          <Input
            value={draft.stockQuantity}
            onChange={(event) => set('stockQuantity', event.target.value)}
            inputMode="numeric"
            placeholder="Unlimited"
          />
        </Field>

        <Switch
          checked={draft.isAvailable}
          onCheckedChange={(checked) => set('isAvailable', checked)}
          label="Available to order"
          hint="Turn off to hide it from the menu without deleting it."
        />

        {product ? (
          <Alert tone="info">
            Price changes apply to new orders only. Orders already placed keep the price the
            student agreed to.
          </Alert>
        ) : null}
      </form>
    </Modal>
  );
}
