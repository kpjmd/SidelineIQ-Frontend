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
    revalidatePath('/post/[slug]', 'page');
    revalidatePath('/');
    return NextResponse.json(result);
  } catch (err) {
    console.error('approve error:', err);
    return NextResponse.json({ error: 'Failed to approve post' }, { status: 500 });
  }
}
