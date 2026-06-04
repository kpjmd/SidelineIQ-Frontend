import { NextRequest, NextResponse } from 'next/server';

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

/**
 * Promote a post to the Injury Desk candidate queue. The promotion score is
 * computed by the agents backend (it owns computePromotionScore + the athlete
 * tiers + source-tier data), which then upserts the desk_candidate. This route
 * is a thin authenticated proxy. Additive — does NOT touch the post's MD review.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { postId } = await params;
  const agentsUrl = process.env.AGENTS_URL ?? 'https://sidelineiq-agents-production.up.railway.app';

  try {
    const res = await fetch(`${agentsUrl}/admin/promote/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    // Pass the agents status through (404 not found, 409 no entity, 503, 500).
    const data = await res.json().catch(() => ({ error: 'Invalid response from agents backend' }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('promote route error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to reach agents backend for promotion' },
      { status: 502 },
    );
  }
}
