import { NextRequest, NextResponse } from 'next/server';
import { getPostBySlug } from '@/lib/mcp';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch (err) {
    console.error('post route error:', err);
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}
