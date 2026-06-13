import { NextRequest, NextResponse } from 'next/server';
import { approveInjuryPost } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import { revalidatePath } from 'next/cache';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { postId } = await params;

  try {
    const result = await approveInjuryPost(postId);

    // Notify agents backend for social publishing (awaited — admin action, latency acceptable)
    const agentsUrl = process.env.AGENTS_URL ?? 'https://sidelineiq-agents-production.up.railway.app';
    const socialUrl = `${agentsUrl}/admin/approve/${postId}`;
    console.log('[Approve] Sending social publish to:', socialUrl);
    try {
      const socialRes = await fetch(socialUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.AGENTS_API_SECRET}`,
        },
        body: JSON.stringify({ post: result.post ?? result }),
      });
      const socialBody = await socialRes.text();
      console.log(`[Approve] Social publish response: ${socialRes.status} ${socialBody}`);
    } catch (err) {
      console.error('[Approve] Failed to trigger social publish:', err);
    }

    revalidatePath('/post/[slug]', 'page');
    revalidatePath('/');
    return NextResponse.json(result);
  } catch (err) {
    console.error('approve error:', err);
    return NextResponse.json({ error: 'Failed to approve post' }, { status: 500 });
  }
}
