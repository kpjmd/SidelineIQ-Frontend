import type { MetadataRoute } from 'next';
import { siteUrl as resolveSite } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSite();
  return {
    // /go/ is the counted AequOs redirect: never crawl it.
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/go/'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
