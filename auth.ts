import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { McpAdapter } from '@/lib/auth-adapter';
import type { UserRole } from '@/lib/types';

// Phase 2 auth foundation. Physician attestation (built in a later session) must
// bind to a real verified identity, not the shared ADMIN_SECRET. This wires
// NextAuth (Auth.js v5) magic-link sign-in, bound to the single seeded MD.
//
// Session strategy is JWT (not database): the Resend magic-link flow still needs
// the adapter's verification-token persistence, but we avoid sessions/accounts
// tables and keep middleware working. Identity reaches the MCP publish gate as a
// user id; the gate re-derives role from the DB (web_get_user) — it never trusts
// session.user.role, which is for frontend gating/UX only.

const ALLOWED_MD_EMAIL = (process.env.ALLOWED_MD_EMAIL ?? '').toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: McpAdapter(),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/signin',
    verifyRequest: '/signin/check-email',
    error: '/signin',
  },
  providers: [
    Resend({
      // apiKey defaults to AUTH_RESEND_KEY; from must be a verified Resend domain.
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    // Allowlist gate: only Dr. Johnson's address may sign in. Belt-and-suspenders
    // with the seeded-user-only model (McpAdapter.createUser throws), so a link is
    // never even sent to any other address.
    signIn({ user }) {
      const email = (user?.email ?? '').toLowerCase();
      return email !== '' && email === ALLOWED_MD_EMAIL;
    },
    // JWT strategy: persist id + role on the token on first sign-in (when `user`
    // is present), then expose them on the session.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: UserRole }).role ?? 'editor';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
