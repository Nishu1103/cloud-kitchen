'use client';

import { cn } from '@ck/ui';
import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';

/**
 * next/image will not render a URL whose host is not in `images.remotePatterns`.
 * Seed placeholders and non-S3 CMS URLs are not on that list, so this uses the
 * optimiser only when it is allowed and a plain <img> otherwise.
 *
 * Never add a wildcard host to next.config to "make it work": the optimiser fetches
 * the file on the server, and an open allowlist is an SSRF hole.
 */
function isAllowedImageHost(host: string): boolean {
  if (host === 'localhost') return true;
  if (host.endsWith('.cloudfront.net')) return true;
  return false;
}

function canOptimize(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) {
    return !src.split('?')[0]?.toLowerCase().endsWith('.svg');
  }
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
      return false;
    }
    return isAllowedImageHost(url.hostname);
  } catch {
    return false;
  }
}

function rewriteSpacesPublicUrl(src: string): string {
  try {
    const parsed = new URL(src);
    const nextHost = parsed.hostname.replace(
      /^([a-z0-9][a-z0-9.-]*)\.s3\.([a-z0-9-]+)\.digitaloceanspaces\.com$/i,
      '$1.$2.digitaloceanspaces.com',
    );
    if (nextHost !== parsed.hostname) {
      parsed.hostname = nextHost;
      return parsed.toString();
    }
  } catch {
    return src;
  }
  return src;
}

type Props = Omit<ImageProps, 'src'> & { src: string; fallback?: string };

export function RemoteImage({
  src,
  alt,
  className,
  fill,
  width,
  height,
  sizes,
  priority,
  fallback,
  ...rest
}: Props) {
  const incoming = rewriteSpacesPublicUrl(src);
  const [failed, setFailed] = useState(false);
  const resolved = failed && fallback && fallback !== incoming ? fallback : incoming;

  useEffect(() => {
    setFailed(false);
  }, [incoming]);

  const onError = () => {
    if (fallback && resolved !== fallback) setFailed(true);
  };

  if (!canOptimize(resolved)) {
    return (
      // CMS / seed URLs: CSP already limits img-src. Native img does not proxy the file.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={cn(fill && 'absolute inset-0 h-full w-full', className)}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onError={onError}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={onError}
      {...rest}
    />
  );
}
