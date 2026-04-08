import type { MetadataRoute } from 'next';
import { listPosts } from '@/lib/mcp';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sidelineiq.com';

  // Fetch all published posts (paginate if needed)
  const first = await listPosts({ status: 'PUBLISHED', limit: 50, offset: 0 });
  const posts = [...first.posts];

  // Fetch additional pages if there are more
  if (first.has_more && first.next_offset !== null) {
    let offset: number = first.next_offset!;
    while (offset !== null) {
      const page = await listPosts({ status: 'PUBLISHED', limit: 50, offset });
      posts.push(...page.posts);
      if (!page.has_more || page.next_offset === null) break;
      offset = page.next_offset;
    }
  }

  const postEntries: MetadataRoute.Sitemap = posts
    .filter((post) => post.slug)
    .map((post) => ({
      url: `${siteUrl}/post/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: 'daily' as const,
      priority: post.content_type === 'DEEP_DIVE' ? 1.0 : 0.8,
    }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    ...postEntries,
  ];
}
