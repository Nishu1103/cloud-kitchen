/**
 * Kitchen dish / cover photos as stored on the product.
 *
 * Seeded Unsplash IDs 404, and `/_next/image` turns a Spaces 403 into a 500 on the
 * kitchen tablet. The browser loads the object itself (CSP already allows https images).
 */

/** AWS-shaped Spaces hosts often 404; the PUT host is `{bucket}.{region}.digitaloceanspaces.com`. */
export function rewriteSpacesPublicUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const nextHost = parsed.hostname.replace(
      /^([a-z0-9][a-z0-9.-]*)\.s3\.([a-z0-9-]+)\.digitaloceanspaces\.com$/i,
      '$1.$2.digitaloceanspaces.com',
    );
    if (nextHost !== parsed.hostname) {
      parsed.hostname = nextHost;
      return parsed.toString();
    }
  } catch {
    // Leave a malformed URL for the <img> onError path rather than throwing in render.
  }
  return url;
}

export function dishImageSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.includes('images.unsplash.com')) return undefined;
  return rewriteSpacesPublicUrl(url);
}
