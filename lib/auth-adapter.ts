import type { Adapter, AdapterUser } from 'next-auth/adapters';
import type { DeskUser } from './types';
import {
  createVerificationToken,
  getUser,
  getUserByEmail,
  useVerificationToken,
} from './mcp';

// MCP-proxied Auth.js adapter. The frontend never touches Neon directly
// (CLAUDE.md invariant); every read/write goes through the web MCP server, whose
// users + verification_token tables are defined by mcp migration 012_auth.sql.
//
// We use a JWT session strategy, so the session methods (createSession /
// getSessionAndUser / updateSession / deleteSession) are never called and are
// intentionally omitted — all Adapter methods are optional. The Resend
// magic-link flow exercises only:
//   • createVerificationToken  (link requested)
//   • useVerificationToken     (link clicked — atomic single-use on the server)
//   • getUserByEmail / getUser (resolve the verified identity + role)
//
// createUser throws on purpose: identities are provisioned via web_upsert_user
// (and the seed in 012_auth.sql), not minted from the sign-in flow. Combined
// with the allowlist signIn callback in auth.ts, only the seeded MD can sign in.

// The mcp users row carries `role`; AdapterUser additionally requires
// `emailVerified`. We don't track emailVerified server-side (the magic-link click
// is the verification event), so we synthesize null — value is unused downstream.
function toAdapterUser(user: DeskUser): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: null,
    name: user.name ?? null,
    role: user.role,
  };
}

export function McpAdapter(): Adapter {
  return {
    async getUser(id) {
      const user = await getUser(id);
      return user ? toAdapterUser(user) : null;
    },

    async getUserByEmail(email) {
      const user = await getUserByEmail(email);
      return user ? toAdapterUser(user) : null;
    },

    async createUser() {
      // Single-MD model: users are seeded / provisioned via web_upsert_user.
      throw new Error(
        'McpAdapter.createUser is disabled — provision identities via web_upsert_user, not sign-in.',
      );
    },

    // Email provider may call this to stamp emailVerified after the first click.
    // We don't persist that field; return the current row so the flow proceeds.
    async updateUser(user) {
      const current = user.id ? await getUser(user.id) : null;
      if (!current) {
        throw new Error(`McpAdapter.updateUser: user ${user.id} not found`);
      }
      return toAdapterUser(current);
    },

    async createVerificationToken(verificationToken) {
      const saved = await createVerificationToken({
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: verificationToken.expires.toISOString(),
      });
      return {
        identifier: saved.identifier,
        token: saved.token,
        expires: new Date(saved.expires),
      };
    },

    async useVerificationToken({ identifier, token }) {
      const consumed = await useVerificationToken(identifier, token);
      if (!consumed) return null;
      return {
        identifier: consumed.identifier,
        token: consumed.token,
        expires: new Date(consumed.expires),
      };
    },
  };
}
