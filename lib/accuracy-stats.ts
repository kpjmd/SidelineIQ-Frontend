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
import type { ThreadListItem, UnscoreableReason } from './types';

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
  /**
   * Why the excluded ones were excluded, when the record says so.
   *
   * mcp now writes `scoreable: false` plus a reason where it used to write a
   * record whose fields were all null (or no record at all), so "we got it
   * wrong" and "we never had the inputs" stopped being the same row. Empty for
   * a corpus of pre-2026-09-15 rows, which is why it supplements the two counts
   * above rather than replacing them.
   */
  unscoreableReasons: Partial<Record<UnscoreableReason, number>>;
}

export function computeAccuracyStats(threads: ThreadListItem[]): AccuracyStats {
  let withinCount = 0;
  let withinDenominator = 0;
  let errorSum = 0;
  let maeCount = 0;
  let retired = 0;
  let noRecord = 0;
  const unscoreableReasons: Partial<Record<UnscoreableReason, number>> = {};

  for (const t of threads) {
    const rec = t.accuracy_record;
    const verdict = rec?.within_range;

    if (verdict === true || verdict === false) {
      withinDenominator++;
      if (verdict) withinCount++;
    } else {
      // A named reason is better than a bucket, but the buckets stay: they are
      // the only thing a pre-2026-09-15 row can answer.
      const reason = rec?.unscoreable_reason;
      if (reason) unscoreableReasons[reason] = (unscoreableReasons[reason] ?? 0) + 1;
      if (t.status === 'RETIRED') retired++;
      else noRecord++;
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
    unscoreableReasons,
  };
}
