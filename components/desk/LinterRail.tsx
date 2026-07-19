'use client';

import { useEffect, useRef, useState } from 'react';
import type { LintFinding, LintResult } from '@/lib/types';

interface Props {
  deskPostId: string;
  // Re-lint trigger only — the lint itself reads the PERSISTED post server-side.
  // Pass the SAVED post's markdown_body (not the editor's in-progress state) so
  // this fires when a save lands instead of racing it on every keystroke.
  markdown: string;
  onBlockersChange: (hasBlockers: boolean) => void;
}

function Finding({ finding }: { finding: LintFinding }) {
  const isBlocker = finding.severity === 'blocker';
  return (
    <li
      className={`rounded border px-3 py-2 text-xs ${
        isBlocker
          ? 'bg-red-950/60 border-red-800 text-red-200'
          : 'bg-amber-950/40 border-amber-900 text-amber-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`font-semibold uppercase tracking-wide ${isBlocker ? 'text-red-400' : 'text-amber-400'}`}>
          {isBlocker ? 'Blocker' : 'Warning'}
        </span>
        <code className="text-[11px] text-slate-400">{finding.code}</code>
      </div>
      <p className="mt-1 leading-snug">{finding.message}</p>
    </li>
  );
}

// Live content linter. Blockers gate publish (server-enforced); warnings are
// advisory. `classifier_unavailable` is a fail-open warning (the Haiku classifier
// couldn't run) — never treated as a blocker. Blockers include the kpjmd contract
// rules (incomplete_sections, markdown_in_section) alongside the framing rules.
export function LinterRail({ deskPostId, markdown, onBlockersChange }: Props) {
  const [result, setResult] = useState<LintResult | null>(null);
  const [linting, setLinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(0);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const requestId = inFlight.current + 1;
      inFlight.current = requestId;
      setLinting(true);
      setError(null);
      try {
        const res = await fetch(`/api/desk/posts/${deskPostId}/lint`, { method: 'POST' });
        const data = (await res.json().catch(() => ({}))) as LintResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Lint failed');
        if (requestId !== inFlight.current) return;
        const lint: LintResult = { warnings: data.warnings ?? [], blockers: data.blockers ?? [] };
        setResult(lint);
        onBlockersChange(lint.blockers.length > 0);
      } catch (err) {
        if (requestId !== inFlight.current) return;
        setError(err instanceof Error ? err.message : 'Lint failed');
      } finally {
        if (requestId === inFlight.current) setLinting(false);
      }
    }, 1000);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  const blockers = result?.blockers ?? [];
  const warnings = result?.warnings ?? [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Content linter</h3>
        {linting && <span className="text-[11px] text-amber-400">Checking…</span>}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {!error && result && blockers.length === 0 && warnings.length === 0 && (
        <p className="text-xs text-emerald-400">No issues found.</p>
      )}

      {(blockers.length > 0 || warnings.length > 0) && (
        <ul className="space-y-2">
          {blockers.map((f, i) => (
            <Finding key={`b-${i}`} finding={f} />
          ))}
          {warnings.map((f, i) => (
            <Finding key={`w-${i}`} finding={f} />
          ))}
        </ul>
      )}

      {blockers.length > 0 && (
        <p className="mt-3 text-[11px] text-red-400">
          {blockers.length} blocker{blockers.length > 1 ? 's' : ''} must be resolved before publishing.
        </p>
      )}
    </div>
  );
}
