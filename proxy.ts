// Gate the Tier 2 Injury Desk behind a NextAuth session. Unauthenticated
// requests to /desk/* are redirected to /signin (configured in auth.ts).
// Role enforcement beyond "has a session" lives in the desk pages/routes and,
// authoritatively, in the MCP publish gate. /admin stays on ADMIN_SECRET for now.
//
// Next 16 renamed the `middleware` convention to `proxy` (file + export name);
// behavior, config.matcher, and NextRequest/NextResponse are identical.
export { auth as proxy } from '@/auth';

export const config = {
  matcher: ['/desk/:path*'],
};
