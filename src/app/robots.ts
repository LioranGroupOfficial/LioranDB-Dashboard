import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/login', '/signup', '/forgot-password'],
      disallow: ['/admin/', '/dashboard/', '/database/', '/billing/', '/support-console/', '/api/'],
    },
    sitemap: 'https://app.liorandb.com/sitemap.xml',
  };
}

