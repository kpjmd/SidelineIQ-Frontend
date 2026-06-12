import type { UserRole } from '@/lib/types';
import type { DefaultSession } from 'next-auth';

// Surface our verified-identity fields (id + role) onto the NextAuth session and
// the adapter User. The desk routes read session.user.role to gate the publish
// action; the MCP gate independently re-derives role from the DB (web_get_user).
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser {
    role: UserRole;
  }
}

// JWT lives in @auth/core/jwt; next-auth/jwt only re-exports it (export *), so
// the augmentation must target the core module to reach the JWT interface.
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
