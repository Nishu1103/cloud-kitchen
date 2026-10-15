'use client';

import { ChefHat } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dishImageSrc } from '@/lib/media';

/**
 * Dish thumbnail that never goes through the Next image optimiser.
 *
 * The optimiser fetches on the server; a private or wrong-host Spaces object becomes
 * an HTTP 500 on `/_next/image` instead of a missing photo. A native img fails closed
 * to the placeholder.
 */
export function DishPhoto({
  src,
  alt = '',
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const resolved = dishImageSrc(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);
  const show = resolved && !failed;

  return (
    <div className={`relative overflow-hidden bg-brand-soft ${className ?? ''}`}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full items-center justify-center text-brand">
          <ChefHat aria-hidden className="h-8 w-8" />
        </span>
      )}
    </div>
  );
}
