import { NextRequest, NextResponse } from 'next/server';
import { listPosts } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import type { ContentType, PostStatus, Sport } from '@/lib/types';

// Post browser for the admin Promote tab. Filterable list of posts (defaults to
// CONFLICT_FLAG client-side) so the MD can promote auto-published posts that
// never entered the review queue.
export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const sp = request.nextUrl.searchParams;
  const limit = Number(sp.get('limit')) || 20;
  const offset = Number(sp.get('offset')) || 0;

  try {
    const result = await listPosts({
      content_type: (sp.get('content_type') as ContentType) ?? undefined,
      sport: (sp.get('sport') as Sport) ?? undefined,
      status: (sp.get('status') as PostStatus) ?? undefined,
      athlete_name: sp.get('athlete_name') ?? undefined,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('posts route error:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
