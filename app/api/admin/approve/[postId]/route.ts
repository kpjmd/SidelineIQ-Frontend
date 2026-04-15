import { NextRequest, NextResponse } from 'next/server';
import { approveInjuryPost } from '@/lib/mcp';
import { revalidatePath } from 'next/cache';

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { postId } = await params;

  try {
    const result = await approveInjuryPost(postId);

    // Fire-and-forget to agents backend for social publishing
    // Don't await — approval is already done, social publish is best-effort
    const agentsUrl = process.env.AGENTS_URL ?? 'https://sidelineiq-agents-production.up.railway.app';
    fetch(`${agentsUrl}/admin/approve/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post: result.post }),
    }).catch((err) => console.error('[Approve] Failed to trigger social publish:', err));

    revalidatePath('/post/[slug]', 'page');
    revalidatePath('/');
    return NextResponse.json(result);
  } catch (err) {
    console.error('approve error:', err);
    return NextResponse.json({ error: 'Failed to approve post' }, { status: 500 });
  }
}
