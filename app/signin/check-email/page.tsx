import Link from 'next/link';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';

// Shown after a magic link is requested (auth.ts pages.verifyRequest).
export default function CheckEmailPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-slate-900 border border-slate-700 rounded-xl text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Mark size={22} />
          <Wordmark className="text-lg" />
          <span className="text-slate-700">·</span>
          <span className="font-mono text-xs tracking-[0.14em] text-slate-400">INJURY DESK</span>
        </div>
        <h1 className="text-base font-semibold text-bone mb-2">Check your email</h1>
        <p className="text-sm text-slate-500 mb-6">
          A sign-in link is on its way. Open it on this device to continue to the desk. The
          link is single-use and expires shortly.
        </p>
        <Link
          href="/signin"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Back to sign-in
        </Link>
      </div>
    </div>
  );
}
