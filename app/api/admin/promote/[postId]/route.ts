import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';

/**
 * Promote a post to the Injury Desk candidate queue. The promotion score is
 * computed by the agents backend (it owns computePromotionScore + the athlete
 * tiers + source-tier data), which then upserts the desk_candidate. This route
 * is a thin authenticated proxy. Additive — does NOT touch the post's MD review.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { postId } = await params;
  const agentsUrl = process.env.AGENTS_URL ?? 'https://sidelineiq-agents-production.up.railway.app';

  try {
    const res = await fetch(`${agentsUrl}/admin/promote/${postId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AGENTS_API_SECRET}`,
      },
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
