'use client';

import { NOTIFICATION_AUDIENCE, PERMISSIONS } from '@ck/types';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Skeleton,
  Textarea,
} from '@ck/ui';
import { Megaphone, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ImagePicker } from '@/components/image-picker';
import { RequireAccess } from '@/components/require-access';
import { VendorScreen } from '@/components/vendor-screen';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useSendAnnouncement,
} from '@/hooks/use-kitchen';

const STATUS_TONE = {
  draft: 'neutral',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  failed: 'danger',
} as const;

function ComposeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const createAnnouncement = useCreateAnnouncement();

  const submit = async (sendNow: boolean, event: FormEvent) => {
    event.preventDefault();

    const found: { title?: string; body?: string } = {};
    if (title.trim().length < 4) found.title = 'A few words students will see first.';
    if (body.trim().length < 10) found.body = 'Say what the offer is.';
    setErrors(found);
    if (Object.keys(found).length) return;

    await createAnnouncement.mutateAsync({
      title: title.trim(),
      body: body.trim(),
      imageUrl,
      // A kitchen can only ever address its own customers; the API rejects anything else.
      audiences: [NOTIFICATION_AUDIENCE.CUSTOMER],
      sendNow,
    });

    setTitle('');
    setBody('');
    setImageUrl(undefined);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New promotion"
      description="This goes out as a push notification to students who ordered from you."
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            disabled={createAnnouncement.isPending}
            onClick={(event) => void submit(false, event)}
          >
            Save as draft
          </Button>
          <Button
            loading={createAnnouncement.isPending}
            onClick={(event) => void submit(true, event)}
          >
            <Send aria-hidden className="h-4 w-4" />
            Send now
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void submit(true, event)} noValidate>
        <Field label="Headline" required error={errors.title}>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Today's special: Paneer Butter Masala"
            maxLength={80}
          />
        </Field>

        <Field label="Message" required error={errors.body} hint="Keep it to one sentence.">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Only 20 plates tonight, ₹40 off until 9pm."
            maxLength={240}
          />
        </Field>

        <Field label="Image" hint="Optional. Shown in the notification on most phones.">
          <ImagePicker value={imageUrl} onChange={setImageUrl} purpose="banner" />
        </Field>

        <Alert tone="warning" title="Two promotions a day">
          Order updates are unlimited, but marketing pushes are capped — students mute a
          kitchen that sends too many.
        </Alert>
      </form>
    </Modal>
  );
}

function PromotionsScreen() {
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState<'running' | 'upcoming'>('running');

  const { data, isLoading, isError, refetch } = useAnnouncements(page);
  const sendAnnouncement = useSendAnnouncement();

  const items = (data?.items ?? []).filter((announcement) =>
    tab === 'running'
      ? announcement.status === 'sent' || announcement.status === 'sending'
      : announcement.status === 'draft' || announcement.status === 'scheduled',
  );

  return (
    <>
      <VendorScreen
        title="Push to customers"
        backHref="/more"
        actions={
          <Button size="sm" onClick={() => setComposing(true)}>
            <Megaphone aria-hidden className="h-4 w-4" />
            New
          </Button>
        }
      >
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-brand to-brand-hover p-4 text-left text-brand-ink shadow-brand"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Megaphone aria-hidden className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-body font-semibold">Boost your sales!</span>
            <span className="block text-caption text-white/80">
              One well-timed push before dinner.
            </span>
          </span>
        </button>

        <div role="tablist" className="mb-4 flex gap-1.5">
          {(
            [
              { id: 'running', label: 'Running' },
              { id: 'upcoming', label: 'Upcoming' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-caption font-medium ${
                tab === item.id ? 'bg-brand text-brand-ink' : 'bg-surface text-ink-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isError ? (
          <ErrorState message="Could not load your promotions." onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : !items.length ? (
          <EmptyState
            icon={<Megaphone aria-hidden className="h-6 w-6" />}
            title={tab === 'upcoming' ? 'No drafts waiting' : 'No promotions sent yet'}
            description="A single well-timed message before dinner does more than five through the day."
            action={<Button onClick={() => setComposing(true)}>Write your first one</Button>}
          />
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((announcement) => (
                <li key={announcement.id} className="rounded-2xl bg-surface p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-body font-medium text-ink">{announcement.title}</p>
                        <Badge tone={STATUS_TONE[announcement.status]} size="sm">
                          {announcement.status}
                        </Badge>
                      </div>
                      <p className="text-caption text-ink-muted">{announcement.body}</p>
                      <p className="text-caption text-ink-subtle">
                        {announcement.sentAt
                          ? `Sent ${new Date(announcement.sentAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                            })} · reached ${announcement.recipientCount} ${
                              announcement.recipientCount === 1 ? 'student' : 'students'
                            }`
                          : `Created ${new Date(announcement.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}`}
                        {announcement.pushFailureCount > 0
                          ? ` · ${announcement.pushFailureCount} devices unreachable`
                          : ''}
                      </p>
                    </div>

                    {announcement.status === 'draft' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={
                          sendAnnouncement.isPending &&
                          sendAnnouncement.variables === announcement.id
                        }
                        onClick={() => sendAnnouncement.mutate(announcement.id)}
                      >
                        <Send aria-hidden className="h-4 w-4" />
                        Send
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

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

      <ComposeDialog open={composing} onOpenChange={setComposing} />
    </>
  );
}

export default function PromotionsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.ANNOUNCEMENT_SEND_VENDOR_SCOPE}>
      <PromotionsScreen />
    </RequireAccess>
  );
}
