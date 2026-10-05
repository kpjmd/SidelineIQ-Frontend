import type { MetadataRoute } from 'next';
import { listPosts, listLedgerEntries } from '@/lib/mcp';
import { siteUrl as resolveSite } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSite();

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

  // The Prognosis Ledger (published rows only; drafts never have a URL). Loaded
  // independently so a mid-deploy MCP without the ledger tools cannot blank the
  // post entries.
  let ledgerEntries: MetadataRoute.Sitemap = [];
  try {
    const rows = await listLedgerEntries({ limit: 200 });
    const latestByEntry = new Map<string, { updated: string }>();
    for (const r of rows) {
      if (!r.entry_id || !r.published_at) continue;
      const prev = latestByEntry.get(r.entry_id);
      if (!prev || prev.updated < r.published_at) latestByEntry.set(r.entry_id, { updated: r.published_at });
    }
    ledgerEntries = [
      { url: `${siteUrl}/ledger`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
      ...[...latestByEntry.entries()].map(([entryId, v]) => ({
        url: `${siteUrl}/ledger/${entryId}`,
        lastModified: new Date(v.updated),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];
  } catch (err) {
    console.error('sitemap ledger load error:', err);
  }

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    ...postEntries,
    ...ledgerEntries,
  ];
}
