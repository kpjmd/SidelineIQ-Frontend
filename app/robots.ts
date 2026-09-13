import type { MetadataRoute } from 'next';
import { siteUrl as resolveSite } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSite();
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/admin' },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
