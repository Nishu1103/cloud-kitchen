'use client';

import { cn } from '@ck/ui';
import { Coffee, Cookie, Moon, Soup, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';

const MEALS = [
  { label: 'Breakfast', q: 'breakfast', icon: Coffee, start: 7 * 60 + 30, end: 11 * 60 + 30, hours: '07:30 – 11:30' },
  { label: 'Lunch', q: 'lunch', icon: Soup, start: 11 * 60 + 30, end: 15 * 60 + 30, hours: '11:30 – 15:30' },
  { label: 'Snacks', q: 'snacks', icon: Cookie, start: 15 * 60 + 30, end: 18 * 60 + 30, hours: '15:30 – 18:30' },
  { label: 'Dinner', q: 'dinner', icon: UtensilsCrossed, start: 18 * 60 + 30, end: 22 * 60 + 30, hours: '18:30 – 22:30' },
  { label: 'Late Night', q: 'momos', icon: Moon, start: 22 * 60 + 30, end: 26 * 60 + 30, hours: '22:30 – 02:30' },
] as const;

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isActive(start: number, end: number, now: number): boolean {
  if (end > 24 * 60) {
    return now >= start || now < end - 24 * 60;
  }
  return now >= start && now < end;
}

export function MealSlots() {
  const now = minutesNow();

  return (
    <section aria-label="Meal times" className="px-4 sm:px-0">
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {MEALS.map((meal) => {
          const Icon = meal.icon;
          const active = isActive(meal.start, meal.end, now);
          return (
            <Link
              key={meal.label}
              href={`/search?q=${encodeURIComponent(meal.q)}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-[5.15rem] shrink-0 flex-col items-center gap-1 rounded-[1.2rem] border px-1.5 py-3.5',
                active
                  ? 'border-gold bg-gold/12 text-gold shadow-[0_0_18px_hsl(var(--gold)/0.45)]'
                  : 'border-transparent bg-surface text-white',
              )}
            >
              <Icon
                aria-hidden
                className={cn('h-6 w-6', active ? 'text-gold' : 'text-white')}
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span className={cn('text-center text-[0.7rem] font-semibold', active ? 'text-gold' : 'text-white')}>
                {meal.label}
              </span>
              <span className={cn('text-center text-[0.55rem] leading-tight', active ? 'text-gold/80' : 'text-white/45')}>
                {meal.hours}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
