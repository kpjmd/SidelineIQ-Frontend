import { NextRequest, NextResponse } from 'next/server';
import { listThreads } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';

// GET /api/admin/threads?view=active|date_review|closed
// Backs the MD dashboard "Threads" tab. Session-gated (requireMd) like every
// other /api/admin/* handler — proxy.ts does not match /api/*.
export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const view = request.nextUrl.searchParams.get('view') ?? 'active';
  try {
    let threads;
    if (view === 'date_review') {
      threads = await listThreads({ status: 'ACTIVE', needs_date_review: true });
    } else if (view === 'closed') {
      const [resolved, retired] = await Promise.all([
        listThreads({ status: 'RESOLVED' }),
        listThreads({ status: 'RETIRED' }),
      ]);
      threads = [...resolved, ...retired].sort(
        (a, b) => Date.parse(b.closed_at ?? b.last_updated_at) - Date.parse(a.closed_at ?? a.last_updated_at),
      );
    } else {
      threads = await listThreads({ status: 'ACTIVE' });
    }
    return NextResponse.json({ threads });
  } catch (err) {
    console.error('threads route error:', err);
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
  }
}
