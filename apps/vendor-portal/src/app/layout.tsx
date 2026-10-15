import '@ck/ui/styles.css';
import './theme.css';

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { CSSProperties, ReactNode } from 'react';
import { KitchenFrame } from '@/components/kitchen-frame';
import { env } from '@/lib/env';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: `Kitchen · ${env.appName}`,
    template: `%s · Kitchen`,
  },
  description: 'Run your campus kitchen: live orders, menu, pricing and analytics.',
  applicationName: `${env.appName} Kitchen`,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    // Installed-PWA mode is how an iPad on the counter receives new-order alerts at all.
    capable: true,
    statusBarStyle: 'default',
    title: 'Kitchen',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png' }],
  },
  // An operator console has no business in a search index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled: disabling it is an accessibility failure, not a design choice.
  maximumScale: 5,
  themeColor: '#6A5AE0',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-portal="vendor" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-dvh bg-canvas`}
        style={{ '--font-sans': 'var(--font-inter)' } as CSSProperties}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-md"
        >
          Skip to content
        </a>
        <Providers>
          <KitchenFrame>{children}</KitchenFrame>
        </Providers>
      </body>
    </html>
  );
}
