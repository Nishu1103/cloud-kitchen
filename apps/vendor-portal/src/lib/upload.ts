import type { UploadPurpose } from '@ck/sdk';
import { api } from './api';

/** Kept in step with the API's own allowlist, so a rejection happens before the upload. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const MAX_BYTES = 5 * 1024 * 1024;

export class UploadError extends Error {}

function assertImage(file: File): AllowedType {
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    throw new UploadError('Use a JPG, PNG or WebP image.');
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError('Images must be under 5 MB.');
  }
  return file.type as AllowedType;
}

/**
 * Uploads an image straight to object storage and returns its public URL.
 *
 * The file never passes through the API: it asks for a short-lived presigned PUT and
 * the browser uploads to storage directly, so a 4 MB dish photo does not occupy an API
 * worker. The signature covers the headers, which is why they are sent back verbatim -
 * letting the runtime pick its own `Content-Type` gets a 403 from storage.
 *
 * The key is scoped to the campus and the uploader server-side, and the API re-checks
 * ownership when the URL is persisted, so a returned URL cannot be swapped for someone
 * else's object.
 */
export async function uploadImage(file: File, purpose: UploadPurpose = 'menu'): Promise<string> {
  const contentType = assertImage(file);

  const presigned = await api.account.presignUpload({
    purpose,
    contentType,
    byteLength: file.size,
  });

  const response = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: presigned.requiredHeaders,
    body: file,
    // A presigned URL carries its own authorisation; sending cookies to storage would
    // be both useless and a needless credential leak to a third-party origin.
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new UploadError('The image could not be uploaded. Please try again.');
  }

  return presigned.publicUrl;
}
