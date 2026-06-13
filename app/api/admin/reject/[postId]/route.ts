import { NextRequest, NextResponse } from 'next/server';
import { deleteInjuryPost } from '@/lib/mcp';
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
    const result = await deleteInjuryPost(postId);
    revalidatePath('/');
    return NextResponse.json(result);
  } catch (err) {
    console.error('reject error:', err);
    return NextResponse.json({ error: 'Failed to reject post' }, { status: 500 });
  }
}
