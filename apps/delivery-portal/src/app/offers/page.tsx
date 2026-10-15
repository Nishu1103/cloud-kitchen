import { redirect } from 'next/navigation';

/** Alias of `/jobs`. Kept so older bookmarks and the PWA shortcut still work. */
export default function OffersPage() {
  redirect('/jobs');
}
