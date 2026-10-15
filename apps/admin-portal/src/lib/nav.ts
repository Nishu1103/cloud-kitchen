import { PERMISSIONS, type Permission } from '@ck/types';
import type { NavItem, NavSection } from '@ck/ui';
import {
  BarChart3,
  Bell,
  Bike,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Megaphone,
  ReceiptText,
  ScrollText,
  Settings,
  Shield,
  Star,
  Store,
  Tags,
  Users,
} from 'lucide-react';
import { createElement, type ReactNode } from 'react';

function icon(Component: typeof LayoutDashboard): ReactNode {
  return createElement(Component, { 'aria-hidden': true, className: 'h-5 w-5' });
}

export function adminSections(
  can: (permission: Permission) => boolean,
  unread?: number,
): NavSection[] {
  return [
    {
      items: [{ href: '/', label: 'Dashboard', icon: icon(LayoutDashboard) }],
    },
    {
      heading: 'Campus',
      items: [
        ...(can(PERMISSIONS.ORDER_READ_ALL)
          ? [{ href: '/orders', label: 'Orders', icon: icon(ReceiptText) }]
          : []),
        ...(can(PERMISSIONS.VENDOR_READ)
          ? [{ href: '/vendors', label: 'Kitchens', icon: icon(Store) }]
          : []),
        ...(can(PERMISSIONS.USER_READ)
          ? [{ href: '/users', label: 'Users', icon: icon(Users) }]
          : []),
        ...(can(PERMISSIONS.DELIVERY_READ_ALL)
          ? [{ href: '/delivery', label: 'Delivery partners', icon: icon(Bike) }]
          : []),
      ],
    },
    {
      heading: 'Growth',
      items: [
        ...(can(PERMISSIONS.COUPON_MANAGE)
          ? [{ href: '/coupons', label: 'Offers & coupons', icon: icon(Tags) }]
          : []),
        ...(can(PERMISSIONS.ANNOUNCEMENT_SEND)
          ? [{ href: '/announcements', label: 'Announcements', icon: icon(Megaphone) }]
          : []),
        ...(can(PERMISSIONS.REVIEW_MODERATE)
          ? [{ href: '/reviews', label: 'Reviews', icon: icon(Star) }]
          : []),
        ...(can(PERMISSIONS.SUPPORT_TICKET_MANAGE)
          ? [{ href: '/support', label: 'Support', icon: icon(ClipboardList) }]
          : []),
        ...(can(PERMISSIONS.CMS_MANAGE) || can(PERMISSIONS.BANNER_MANAGE)
          ? [{ href: '/cms', label: 'CMS & pages', icon: icon(FileText) }]
          : []),
        ...(can(PERMISSIONS.ANALYTICS_VIEW_ALL)
          ? [{ href: '/analytics', label: 'Reports & analytics', icon: icon(BarChart3) }]
          : []),
      ],
    },
    {
      heading: 'Platform',
      items: [
        ...(can(PERMISSIONS.CAMPUS_READ) || can(PERMISSIONS.CAMPUS_READ_ALL)
          ? [{ href: '/campuses', label: 'Campuses', icon: icon(Building2) }]
          : []),
        ...(can(PERMISSIONS.ROLE_MANAGE)
          ? [{ href: '/roles', label: 'Roles', icon: icon(Shield) }]
          : []),
        ...(can(PERMISSIONS.FEATURE_FLAG_MANAGE) || can(PERMISSIONS.PLATFORM_SETTINGS_MANAGE)
          ? [{ href: '/settings', label: 'Settings', icon: icon(Settings) }]
          : []),
        ...(can(PERMISSIONS.AUDIT_LOG_READ)
          ? [{ href: '/audit', label: 'Audit logs', icon: icon(ScrollText) }]
          : []),
        {
          href: '/notifications',
          label: 'Notifications',
          icon: icon(Bell),
          badge: unread,
        },
      ],
    },
  ];
}

export function flattenNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap((section) => section.items);
}

export function mobileTabs(items: NavItem[]): NavItem[] {
  const pick = (href: string) => items.find((item) => item.href === href);
  const tabs = [pick('/'), pick('/orders'), pick('/vendors'), pick('/users')].filter(
    (item): item is NavItem => Boolean(item),
  );
  return tabs;
}
