'use client';

import { Button, Spinner } from '@ck/ui';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadImage, UploadError } from '@/lib/upload';
import type { UploadPurpose } from '@ck/sdk';

/**
 * Kitchen / dish / promo photo picker.
 *
 * Uploads on selection rather than on form submit, so the kitchen sees the photo it is
 * about to publish and a slow campus connection does not turn "Save" into a
 * thirty-second wait. The parent only ever holds a URL string. The `purpose` chooses
 * the S3 folder (`kitchen`, `menus`, `banners`, …).
 */
export function ImagePicker({
  value,
  onChange,
  disabled,
  purpose = 'menu',
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  disabled?: boolean;
  purpose?: UploadPurpose;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // A local object URL previews the file while the upload is still in flight.
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;

    setError(undefined);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);

    try {
      onChange(await uploadImage(file, purpose));
    } catch (cause) {
      setError(
        cause instanceof UploadError ? cause.message : 'Upload failed. Please try again.',
      );
      setPreview(undefined);
      URL.revokeObjectURL(localUrl);
    } finally {
      setBusy(false);
      // Allows re-selecting the same file after a failure.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const shown = preview ?? value;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-line bg-surface-muted">
          {shown ? (
            // The preview is a `blob:` URL for a file that has not been uploaded yet,
            // which next/image cannot load at all.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ink-subtle">
              <ImagePlus aria-hidden className="h-6 w-6" />
            </span>
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
              <Spinner className="h-5 w-5" />
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {shown ? 'Replace photo' : 'Add photo'}
          </Button>
          {shown ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || busy}
              onClick={() => {
                setPreview(undefined);
                onChange(undefined);
              }}
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Remove
            </Button>
          ) : (
            <p className="text-caption text-ink-subtle">JPG, PNG or WebP · up to 5 MB</p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void pick(event.target.files?.[0])}
      />

      {error ? (
        <p role="alert" className="text-caption text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
