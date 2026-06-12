import Link from 'next/link';

// Shown after a magic link is requested (auth.ts pages.verifyRequest).
export default function CheckEmailPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-slate-900 border border-slate-700 rounded-xl text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-lg font-black text-white tracking-tight">SidelineIQ</span>
          <span className="text-slate-700">·</span>
          <span className="text-sm text-emerald-400 font-medium">Injury Desk</span>
        </div>
        <h1 className="text-base font-semibold text-white mb-2">Check your email</h1>
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
