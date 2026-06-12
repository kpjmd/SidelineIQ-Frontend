'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

// Injury Desk (Tier 2) physician sign-in. Magic-link only — no password, no
// shared secret. Only the seeded MD address can complete sign-in (allowlist +
// seeded-user model in auth.ts); other addresses are silently refused.
export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn('resend', { email, redirectTo: '/desk' });
      // On success NextAuth redirects to the verifyRequest page; if we get here
      // without a redirect, surface a generic error.
    } catch {
      setError('Could not send the sign-in link. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-slate-900 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/" className="text-lg font-black text-white tracking-tight">
            SidelineIQ
          </Link>
          <span className="text-slate-700">·</span>
          <span className="text-sm text-emerald-400 font-medium">Injury Desk</span>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Physician sign-in. We&apos;ll email you a secure sign-in link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-600"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !email}
            className="w-full py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Sending link…' : 'Email me a sign-in link'}
          </button>
        </form>
      </div>
    </div>
  );
}
