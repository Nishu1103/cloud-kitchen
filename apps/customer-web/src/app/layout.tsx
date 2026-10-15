import '@ck/ui/styles.css';
import './theme.css';

import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, Great_Vibes } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AppFrame } from '@/components/app-frame';
import { env } from '@/lib/env';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

const script = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-script',
});

export const metadata: Metadata = {
  title: {
    default: `${env.appName} — food from your campus kitchens`,
    template: `%s · ${env.appName}`,
  },
  description:
    'Order from campus kitchens, track every order live, and pay by wallet, UPI or cash on delivery.',
  applicationName: env.appName,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: env.appName,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6B4CFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-portal="customer" data-theme="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} ${script.variable} min-h-dvh bg-canvas text-ink antialiased`}
        style={
          {
            '--font-sans': 'var(--font-inter)',
            '--font-display': 'var(--font-playfair)',
            '--font-serif': 'var(--font-playfair)',
          } as React.CSSProperties
        }
      >
        <Script src="/theme-boot.js" strategy="beforeInteractive" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-md"
        >
          Skip to content
        </a>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
