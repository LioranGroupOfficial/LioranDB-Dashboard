import type { Metadata, Viewport } from 'next';
import './globals.css';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://app.liorandb.com';

export const viewport: Viewport = {
  themeColor: '#090B0E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark',
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
