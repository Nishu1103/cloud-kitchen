'use client';

import { cn } from '@ck/ui';
import { Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

type SpeechEngine = {
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
};

function speechEngine(): SpeechEngine | undefined {
  if (typeof window === 'undefined') return undefined;
  const Ctor =
    (
      window as Window & {
        SpeechRecognition?: new () => SpeechEngine;
        webkitSpeechRecognition?: new () => SpeechEngine;
      }
    ).SpeechRecognition ??
    (window as Window & { webkitSpeechRecognition?: new () => SpeechEngine }).webkitSpeechRecognition;
  if (!Ctor) return undefined;
  const engine = new Ctor();
  engine.lang = 'en-IN';
  return engine;
}

export function SearchField({
  defaultValue = '',
  placeholder = 'What are you craving today?',
  autoFocus,
  className,
  tone = 'muted',
}: {
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  tone?: 'light' | 'muted';
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  };

  const listen = () => {
    const engine = speechEngine();
    if (!engine) {
      inputRef.current?.focus();
      return;
    }
    engine.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript?.trim();
      if (spoken && inputRef.current) {
        inputRef.current.value = spoken;
        router.push(`/search?q=${encodeURIComponent(spoken)}`);
      }
    };
    engine.onend = () => setListening(false);
    setListening(true);
    engine.start();
  };

  return (
    <form role="search" onSubmit={submit} className={className}>
      <label className="relative block">
        <span className="sr-only">Search dishes and kitchens</span>
        <input
          ref={inputRef}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'h-12 w-full rounded-full px-5 pr-12 text-body shadow-sm',
            tone === 'light'
              ? 'bg-white text-ink placeholder:text-ink-subtle'
              : 'border border-line bg-surface text-ink placeholder:text-ink-subtle',
          )}
        />
        <button
          type="button"
          onClick={listen}
          aria-pressed={listening}
          aria-label={listening ? 'Listening' : 'Search by voice'}
          className={cn(
            'absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full',
            listening ? 'bg-brand text-brand-ink' : 'text-ink-subtle hover:text-ink',
          )}
        >
          <Mic aria-hidden className="h-4 w-4" />
        </button>
      </label>
    </form>
  );
}
