/**
 * The ledger card's content model (spec "Card content spec"): what the OG image
 * route draws, computed here so it can be tested without satori. Pure.
 *
 * The five numbers are the image; everything else makes them credible. Field
 * order and labels come from lib/ledger-fields.ts, every fixed string from
 * lib/ledger-copy.ts, and the tier colours are fixed (S2-5: A green, B amber,
 * C slate) so a tier reads the same on every card.
 *
 * WHY THIS CARD MAY CARRY NUMBERS when lib/og-card.ts forbids them: that rule
 * exists because an MD correction to an injury post would keep circulating in
 * every cached card. A ledger row is immutable and hash-stamped; a correction is
 * a NEW version with its own card. A cached card is the point.
 */
import { LEDGER_COPY, LEDGER_URL_DISPLAY } from './ledger-copy';
import { LEDGER_FIELD_SPECS } from './ledger-fields';
import type { LedgerSourceTier, PublishedLedgerForecast } from './ledger-types';

export const TIER_COLORS: Record<LedgerSourceTier, { fill: string; ink: string; label: string }> = {
  A: { fill: '#3FBF7F', ink: '#06251A', label: 'TIER A' },
  B: { fill: '#F0A02A', ink: '#2B1B03', label: 'TIER B' },
  C: { fill: '#8FA3B5', ink: '#0E1924', label: 'TIER C' },
};

export const LEDGER_CARD_SIZE = { width: 1200, height: 630 } as const;

/** Whole-number percentage, as the spec prints every probability. */
export function pct(p: number | string): string {
  const n = typeof p === 'string' ? Number(p) : p;
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`not a probability: ${String(p)}`);
  return `${Math.round(n * 100)}%`;
}

/** "3 (2–6)", the spec's F4 shape. */
export function f4Label(point: number, low: number, high: number): string {
  return `${point} (${low}–${high})`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function injuryDateLabel(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export interface CardTile {
  field: 'F1' | 'F2' | 'F3' | 'F4' | 'F5';
  label: string;
  value: string;
  /** F4 is the dominant tile (spec: "F4 must read in a feed thumbnail"). */
  dominant: boolean;
}

export interface LedgerCardModel {
  header: string;
  reported: string;
  revision: string | null;
  mechanism: string;
  tiles: CardTile[];
  whatMovesThis: string;
  provenance: string;
  tier: (typeof TIER_COLORS)[LedgerSourceTier];
  credit: string;
  publisher: string;
  aiDisclosure: string;
  disclaimer: string;
  url: string;
  seasonEnding: boolean;
}

export function cardModelFor(row: PublishedLedgerForecast): LedgerCardModel {
  const f5 = row.f5_reinjury == null ? 'n/a' : pct(row.f5_reinjury);
  return {
    header: `${row.player} · ${row.position} · ${row.team}`,
    reported: `Reported: ${row.reported_injury} · injury ${injuryDateLabel(row.injury_date)}`,
    revision: row.version > 1 && row.trigger ? `v${row.version} — ${row.trigger}` : null,
    mechanism: row.mechanism,
    tiles: [
      { field: 'F1', label: LEDGER_FIELD_SPECS.F1.label, value: pct(row.f1_ir), dominant: false },
      { field: 'F2', label: LEDGER_FIELD_SPECS.F2.label, value: pct(row.f2_next), dominant: false },
      { field: 'F3', label: LEDGER_FIELD_SPECS.F3.label, value: pct(row.f3_4wk), dominant: false },
      { field: 'F4', label: LEDGER_FIELD_SPECS.F4.label, value: f4Label(row.f4_point, row.f4_low, row.f4_high), dominant: true },
      { field: 'F5', label: LEDGER_FIELD_SPECS.F5.label, value: f5, dominant: false },
    ],
    whatMovesThis: `What would move this: ${row.what_moves_this}`,
    provenance: `${row.entry_id} · v${row.version} · ${row.row_hash.slice(0, 8)}`,
    tier: TIER_COLORS[row.source_tier],
    credit: LEDGER_COPY.credit,
    publisher: LEDGER_COPY.publisher,
    aiDisclosure: LEDGER_COPY.ai_disclosure,
    disclaimer: LEDGER_COPY.card_disclaimer,
    url: LEDGER_URL_DISPLAY,
    seasonEnding: row.season_ending === true,
  };
}
