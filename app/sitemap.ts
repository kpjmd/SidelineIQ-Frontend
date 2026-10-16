import type { MetadataRoute } from 'next';
import { listPosts, exportLedger } from '@/lib/mcp';
import { entriesForRow, latestPerEntry, publicLedger, rowKeysWithEntries, versionsOf } from '@/lib/ledger-public';
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

  // The Prognosis Ledger, from the same public view every ledger page renders
  // (published rows only; drafts never have a URL). Loaded
  // independently so a mid-deploy MCP without the ledger tools cannot blank the
  // post entries.
  let ledgerEntries: MetadataRoute.Sitemap = [];
  try {
    const ledger = publicLedger(await exportLedger());
    const latest = latestPerEntry(ledger);
    ledgerEntries = [
      { url: `${siteUrl}/ledger`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
      { url: `${siteUrl}/ledger/scoreboard`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
      ...latest.map((f) => ({
        url: `${siteUrl}/ledger/${f.entry_id}`,
        lastModified: new Date(f.published_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...rowKeysWithEntries(ledger).map((k) => ({
        url: `${siteUrl}/ledger/injury/${k}`,
        lastModified: new Date(
          entriesForRow(ledger, k)
            .flatMap((id) => versionsOf(ledger, id).map((v) => v.published_at))
            .reduce((m, t) => (t > m ? t : m), ''),
        ),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
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
