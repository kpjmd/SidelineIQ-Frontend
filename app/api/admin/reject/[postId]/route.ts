import { NextRequest, NextResponse } from 'next/server';
import { rejectPost } from '@/lib/reject';
import { requireMd } from '@/lib/desk-auth';
import { revalidatePath } from 'next/cache';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { postId } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    // The post is no longer deleted — it survives as REJECTED so the agent
    // stops re-filing the same review item every poll cycle. See lib/reject.ts
    // for why the thread is still voided first.
    const result = await rejectPost({
      postId,
      mdUserId: gate.userId,
      ...(body.reason ? { reason: body.reason } : {}),
    });
    revalidatePath('/');
    revalidatePath('/post/[slug]', 'page');
    return NextResponse.json(result);
  } catch (err) {
    console.error('reject error:', err);
    return NextResponse.json({ error: 'Failed to reject post' }, { status: 500 });
  }
}
