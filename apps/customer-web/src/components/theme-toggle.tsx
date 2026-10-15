'use client';

import { Button } from '@ck/ui';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'ck.theme';

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * Light/dark switch.
 *
 * Written to `data-theme` on the root element, which is what the design tokens key
 * off. The initial value is read in an effect rather than during render because the
 * server has no way to know it, and guessing causes a hydration mismatch.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const preferred: Theme = stored === 'light' ? 'light' : 'dark';
    setTheme(preferred);
    apply(preferred);
  }, []);

  if (!theme) {
    // Reserve the space so the header does not shift once the theme is known.
    return <div className="h-9 w-9" aria-hidden />;
  }

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        setTheme(next);
        apply(next);
        localStorage.setItem(STORAGE_KEY, next);
      }}
    >
      {theme === 'dark' ? (
        <Sun aria-hidden className="h-5 w-5" />
      ) : (
        <Moon aria-hidden className="h-5 w-5" />
      )}
    </Button>
  );
}
