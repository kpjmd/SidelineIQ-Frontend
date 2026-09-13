/**
 * The two numbers on the MD dashboard's accuracy tab, each over its own
 * denominator.
 *
 * `within` used to divide by every closed thread, RETIRED and record-less rows
 * included. A retirement can never be inside an RTP window and a thread with no
 * accuracy record was never scored, so each one read as a miss: the more
 * careers ended, the worse the projections looked. MAE already divided by the
 * threads that carried an error, so the two figures on one card measured
 * different populations.
 *
 * The public accuracy page will headline `within_range` (monetization plan,
 * Phase 2), so this is the denominator that number inherits.
 *
 * Pure, and imported relatively for the same no-alias-under-vitest reason as
 * lib/reject.ts.
 */
import type { ThreadListItem } from './types';

export interface AccuracyStats {
  /** Threads whose record says within_range === true. */
  withinCount: number;
  /** Threads whose record answers within_range at all (true or false). */
  withinDenominator: number;
  /** Mean absolute error_days, rounded, or null when no thread carries one. */
  mae: number | null;
  /** Threads carrying a non-null error_days. */
  maeCount: number;
  /** Closed threads no within_range verdict was computed for. */
  excluded: { retired: number; noRecord: number };
}

export function computeAccuracyStats(threads: ThreadListItem[]): AccuracyStats {
  let withinCount = 0;
  let withinDenominator = 0;
  let errorSum = 0;
  let maeCount = 0;
  let retired = 0;
  let noRecord = 0;

  for (const t of threads) {
    const rec = t.accuracy_record;
    const verdict = rec?.within_range;

    if (verdict === true || verdict === false) {
      withinDenominator++;
      if (verdict) withinCount++;
    } else if (t.status === 'RETIRED') {
      retired++;
    } else {
      noRecord++;
    }

    const err = rec?.error_days;
    if (typeof err === 'number' && Number.isFinite(err)) {
      errorSum += Math.abs(err);
      maeCount++;
    }
  }

  return {
    withinCount,
    withinDenominator,
    mae: maeCount > 0 ? Math.round(errorSum / maeCount) : null,
    maeCount,
    excluded: { retired, noRecord },
  };
}
