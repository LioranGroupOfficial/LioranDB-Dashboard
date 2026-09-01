import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LioranDB Managed Hosting Platform',
    short_name: 'LioranDB',
    description: 'High-Performance Managed Cloud Database Platform & Customer Dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#090B0E',
    theme_color: '#090B0E',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}

