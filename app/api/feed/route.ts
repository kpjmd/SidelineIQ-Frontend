import { NextRequest, NextResponse } from 'next/server';
import { listPosts } from '@/lib/mcp';
import type { ContentType, Sport } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const sport = searchParams.get('sport') as Sport | null;
  const contentType = searchParams.get('content_type') as ContentType | null;
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const result = await listPosts({
      status: 'PUBLISHED',
      ...(sport ? { sport } : {}),
      ...(contentType ? { content_type: contentType } : {}),
      limit: Math.min(limit, 50),
      offset,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('feed route error:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
