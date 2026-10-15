'use client';

import { errorMessage } from '@ck/sdk';
import { Button, Checkbox, Modal, cn, toast } from '@ck/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(star)}
          className="rounded p-1"
        >
          <Star
            aria-hidden
            className={cn(
              'h-7 w-7 transition-colors',
              star <= value ? 'fill-warning text-warning' : 'text-line-strong',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewDialog({
  open,
  onOpenChange,
  orderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      api.account.submitReview({
        orderId,
        rating,
        foodRating: foodRating || undefined,
        deliveryRating: deliveryRating || undefined,
        comment: comment.trim() || undefined,
        anonymous,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Thanks — the kitchen will see this.');
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="How was it?"
      description="Ratings are what push good kitchens up the list."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Later
          </Button>
          <Button
            // A review with no overall rating is not a review.
            disabled={rating === 0}
            loading={submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-caption font-medium text-ink">Overall</p>
          <StarPicker value={rating} onChange={setRating} label="Overall rating" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-caption font-medium text-ink">Food</p>
            <StarPicker value={foodRating} onChange={setFoodRating} label="Food rating" />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-ink">Delivery</p>
            <StarPicker value={deliveryRating} onChange={setDeliveryRating} label="Delivery rating" />
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-caption font-medium text-ink">Anything to add?</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Hot, fast, and the paneer was excellent."
            className="w-full rounded border border-line-strong bg-surface p-2 text-body placeholder:text-ink-subtle"
          />
        </label>

        <Checkbox
          checked={anonymous}
          onCheckedChange={(checked) => setAnonymous(checked === true)}
          label="Post without my name"
        />
      </div>
    </Modal>
  );
}
