import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// The identity→gate contract: every /api/desk/* handler resolves the acting user
// from the NextAuth session SERVER-SIDE. reviewer_user_id / author_id / edited_by
// passed to the desk_* MCP tools are ALWAYS this `userId` (a UUID), never a role
// string and never a client-supplied value. proxy.ts gates the /desk/* pages but
// NOT /api/desk/*, so each handler must call this independently.
export type DeskGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireMd(): Promise<DeskGate> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'md') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: session.user.id };
}
