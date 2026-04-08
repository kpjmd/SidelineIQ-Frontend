import Link from 'next/link';

export function OTMSignature() {
  return (
    <div className="mt-4 pt-3 border-t border-slate-700/50">
      <Link href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
        <span className="font-medium">OrthoTriage Master</span>
        <span className="mx-1">|</span>
        <span>SidelineIQ</span>
      </Link>
      <p className="text-xs text-slate-600 mt-0.5">
        Clinical intelligence for the sports world. Not medical advice.
      </p>
    </div>
  );
}
