import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-slate-100 mb-4">404</p>
      <p className="text-xl text-slate-400 mb-2">OTM couldn&apos;t locate that injury report.</p>
      <p className="text-sm text-slate-500 mb-8">
        It may have been removed, the URL may be wrong, or this athlete is currently healthy.
      </p>
      <Link
        href="/"
        className="px-5 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
      >
        Back to the feed
      </Link>
      <p className="mt-10 text-xs text-slate-600">
        — OrthoTriage Master | AI-generated analysis. Physician-founded.
      </p>
    </main>
  );
}
