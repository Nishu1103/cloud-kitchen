import { redirect } from 'next/navigation';

/** Bookmark alias of Explore (`/kitchens`). */
export default function ExploreAliasPage() {
  redirect('/kitchens');
}
