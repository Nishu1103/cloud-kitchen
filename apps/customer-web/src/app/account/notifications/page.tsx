'use client';

import { AccountSubhead } from '@/components/account-subhead';
import { NotificationSettings } from '@/components/notification-settings';
import { RequireAuth } from '@/components/require-auth';

export default function NotificationPreferencesPage() {
  return (
    <RequireAuth>
      <div>
        <AccountSubhead title="Notifications" subtitle="Order updates always arrive" />
        <div className="px-4">
          <NotificationSettings embedded />
        </div>
      </div>
    </RequireAuth>
  );
}
