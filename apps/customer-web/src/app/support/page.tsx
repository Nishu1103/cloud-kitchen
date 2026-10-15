'use client';

import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonText,
  StatusBadge,
  Textarea,
  cn,
} from '@ck/ui';
import { LifeBuoy, Plus, Send } from 'lucide-react';
import { useState } from 'react';
import { AccountPanel, AccountSubhead } from '@/components/account-subhead';
import { RequireAuth } from '@/components/require-auth';
import {
  useCreateSupportTicket,
  useReplyToTicket,
  useSupportTicket,
  useSupportTickets,
} from '@/hooks/use-account';
import { useCampus } from '@/hooks/use-catalog';

const CATEGORIES = [
  { value: 'order', label: 'Problem with an order' },
  { value: 'payment', label: 'Payment or refund' },
  { value: 'delivery', label: 'Delivery issue' },
  { value: 'account', label: 'My account' },
  { value: 'other', label: 'Something else' },
];

function NewTicketDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateSupportTicket();
  const [category, setCategory] = useState('order');

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Raise a ticket" size="sm">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          create.mutate(
            {
              category,
              subject: String(form.get('subject') ?? '').trim(),
              message: String(form.get('message') ?? '').trim(),
            },
            { onSuccess: () => onOpenChange(false) },
          );
        }}
      >
        <Field label="What is this about?" required>
          <Select value={category} onValueChange={setCategory} options={CATEGORIES} />
        </Field>
        <Field label="Subject" required>
          <Input name="subject" required maxLength={120} placeholder="Order arrived cold" />
        </Field>
        <Field label="Details" hint="Order number helps us move faster." required>
          <Textarea name="message" required rows={5} maxLength={2000} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TicketThread({ id }: { id: string }) {
  const { data, isLoading } = useSupportTicket(id);
  const reply = useReplyToTicket(id);
  const [body, setBody] = useState('');

  if (isLoading) return <SkeletonText lines={4} />;
  if (!data) return null;

  const closed = data.status === 'closed' || data.status === 'resolved';

  return (
    <div className="space-y-3 border-t border-white/8 p-4">
      <ul className="space-y-2">
        {data.messages.map((message) => (
          <li
            key={message.id}
            className={cn(
              'max-w-[85%] rounded-lg px-3 py-2 text-body',
              message.authorRole === 'customer'
                ? 'ml-auto bg-brand-soft text-ink'
                : 'bg-surface-muted text-ink',
            )}
          >
            <p>{message.body}</p>
            <p className="tabular mt-1 text-caption text-ink-subtle">
              {new Date(message.createdAt).toLocaleString('en-IN')}
            </p>
          </li>
        ))}
      </ul>

      {closed ? (
        <p className="text-caption text-ink-muted">
          This ticket is closed. Raise a new one if it happens again.
        </p>
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const text = body.trim();
            if (!text) return;
            reply.mutate(text, { onSuccess: () => setBody('') });
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Add a reply"
            aria-label="Reply to this ticket"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send reply"
            loading={reply.isPending}
            disabled={body.trim().length === 0}
          >
            <Send aria-hidden className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

function SupportContents() {
  const campus = useCampus();
  const tickets = useSupportTickets();
  const [newOpen, setNewOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = tickets.data?.items ?? [];

  return (
    <div>
      <AccountSubhead title="Help & Support" subtitle="Campus team replies in this thread" />
      <div className="space-y-4 px-4">
      <AccountPanel className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-serif text-title text-ink">Campus support</p>
            <p className="text-caption text-ink-muted">
              {campus.data?.supportEmail ?? 'Replies land in your notifications.'}
              {campus.data?.supportPhone ? ` · ${campus.data.supportPhone}` : ''}
            </p>
          </div>
          <Button className="rounded-full" onClick={() => setNewOpen(true)} leadingIcon={<Plus aria-hidden className="h-4 w-4" />}>
            New ticket
          </Button>
      </AccountPanel>

      {tickets.isLoading ? (
        <AccountPanel className="p-4">
          <SkeletonText lines={4} />
        </AccountPanel>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy aria-hidden className="h-6 w-6" />}
          title="No tickets"
          description="If an order goes wrong, raise a ticket and we will sort it out."
          action={<Button className="rounded-full" onClick={() => setNewOpen(true)}>Raise a ticket</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((ticket) => (
            <li key={ticket.id}>
              <AccountPanel>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-serif text-body font-semibold text-ink">{ticket.subject}</p>
                    <p className="mt-0.5 text-caption text-ink-muted">
                      {ticket.category} ·{' '}
                      {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpanded((current) => (current === ticket.id ? null : ticket.id))
                      }
                    >
                      {expanded === ticket.id ? 'Hide' : 'Open'}
                    </Button>
                  </div>
                </div>
                {expanded === ticket.id ? <TicketThread id={ticket.id} /> : null}
              </AccountPanel>
            </li>
          ))}
        </ul>
      )}

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} />
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <RequireAuth message="Sign in to raise a support ticket.">
      <SupportContents />
    </RequireAuth>
  );
}
