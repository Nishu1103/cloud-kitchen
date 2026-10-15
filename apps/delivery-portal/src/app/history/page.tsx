import { redirect } from 'next/navigation';

/** History now lives under Orders → Completed. */
export default function HistoryPage() {
  redirect('/jobs?tab=completed');
}
