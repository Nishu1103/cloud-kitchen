import '@ck/ui/styles.css';
import './theme.css';

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { CSSProperties, ReactNode } from 'react';
import { AdminFrame } from '@/components/admin-frame';
import { env } from '@/lib/env';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: `Admin · ${env.appName}`,
    template: `%s · Admin`,
  },
  description: 'Campus operations: vendors, orders, delivery, roles and platform settings.',
  applicationName: `${env.appName} Admin`,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Admin',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#7F3DFF',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-portal="admin" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-dvh`}
        style={{ '--font-sans': 'var(--font-inter)' } as CSSProperties}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-md"
        >
          Skip to content
        </a>
        <Providers>
          <AdminFrame>{children}</AdminFrame>
        </Providers>
      </body>
    </html>
  );
}
