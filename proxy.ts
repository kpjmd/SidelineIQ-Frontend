// Gate the Tier 2 Injury Desk and the /admin MD dashboard behind a NextAuth
// session. Unauthenticated requests to /desk/* or /admin/* are redirected to
// /signin (configured in auth.ts). Role enforcement beyond "has a session"
// lives in the pages/routes (md-only redirects + requireMd) and, for desk
// publishing, authoritatively in the MCP publish gate. The matcher patterns
// cover the PAGES only — /api/desk/* and /api/admin/* are NOT matched (they
// start with /api) and must return JSON 401/403 via requireMd, not a redirect.
//
// Next 16 renamed the `middleware` convention to `proxy` (file + export name);
// behavior, config.matcher, and NextRequest/NextResponse are identical.
export { auth as proxy } from '@/auth';

export const config = {
  matcher: ['/desk/:path*', '/admin/:path*'],
};
