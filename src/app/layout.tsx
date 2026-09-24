import type { Metadata, Viewport } from 'next';
import { Newsreader, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500'],
  style: ['normal', 'italic'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://app.liorandb.com';

import { ThemeProvider } from '@/components/theme/ThemeProvider';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#181715' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'LioranDB — Managed Hosting & Cloud Database Platform',
    template: '%s — LioranDB',
  },
  description:
    'High-performance managed cloud database platform. Sub-millisecond document retrieval, WAL-backed NVMe persistence, automatic backups, and dedicated developer support.',
  applicationName: 'LioranDB Dashboard',
  authors: [{ name: 'LioranDB Team', url: 'https://liorandb.com' }],
  generator: 'Next.js',
  keywords: [
    'LioranDB',
    'Managed Database',
    'NoSQL Cloud',
    'In-Memory Database',
    'High Throughput',
    'NVMe Storage',
    'Database Hosting',
    'Developer Platform',
  ],
  creator: 'LioranDB',
  publisher: 'LioranDB Inc.',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    siteName: 'LioranDB',
    title: 'LioranDB — Managed Hosting & Cloud Database Platform',
    description:
      'High-performance managed cloud database platform. Sub-millisecond document retrieval, WAL-backed NVMe persistence, and dedicated clusters.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LioranDB — Managed Hosting & Cloud Database Platform',
    description:
      'High-performance managed cloud database platform. Sub-millisecond document retrieval, WAL-backed NVMe persistence, and dedicated clusters.',
    creator: '@liorandb',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('lioran_theme') || 'light';
                if (t === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-sans antialiased transition-colors duration-150">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
