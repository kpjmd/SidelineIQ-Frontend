import { NextRequest, NextResponse } from 'next/server';
import { approveInjuryPost } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import { triggerSocialPublish } from '@/lib/social-publish';
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
    const social = await triggerSocialPublish(postId, result.post ?? result);

    revalidatePath('/post/[slug]', 'page');
    revalidatePath('/');
    // The post IS approved and live on the site either way, so this stays a
    // 200 — but the response now says whether it reached an audience, instead
    // of showing the MD a green checkmark regardless.
    return NextResponse.json({ ...result, social });
  } catch (err) {
    console.error('approve error:', err);
    return NextResponse.json({ error: 'Failed to approve post' }, { status: 500 });
  }
}
