/**
 * The public ledger view (Stage 4) against the export RECORDED live in
 * ledger-csv-cases.json. The rule it exists for: nothing public may show a
 * draft or a proposal.
 */
import { describe, it, expect } from 'vitest';
import {
  asOfParam, entriesForRow, isRowKey, latestPerEntry, linkageSummary, publicLedger, resolutionEvidence, rowKeyOf,
  rowKeysWithEntries, scoringByField, statusCounts, summarizeFor, versionsOf, etDate, asOfLabel,
} from '../lib/ledger-public';
import type { LedgerExport } from '../lib/ledger-types';
import fixture from './fixtures/ledger-csv-cases.json' with { type: 'json' };

const cases = (fixture as unknown as { cases: Array<{ as_of: string | null; export: LedgerExport; expect: { initial: unknown; entries_scored: number; open_fields: number } }> }).cases;
const live = cases.find((c) => c.as_of === null)!;
const exp = live.export;
const strip = <T extends { kind: string }>({ kind: _k, ...rest }: T) => rest;

describe('publicLedger', () => {
  it('never carries a draft or a proposal, whatever the payload grows', () => {
    const draft = { ...exp.forecasts[0], id: 'draft-1', status: 'draft', entry_id: null, published_at: null, row_hash: null, confirmed_by: null };
    const leaky = { ...exp, forecasts: [...exp.forecasts, draft], proposals: [{ id: 'p', decision: 'pending' }] } as unknown as LedgerExport;
    const l = publicLedger(leaky);
    expect(l.forecasts).toHaveLength(exp.forecasts.length);
    expect(l.forecasts.every((f) => f.status === 'published' && f.entry_id && f.row_hash && f.confirmed_by)).toBe(true);
    expect(Object.keys(l).sort()).toEqual(['as_of', 'corrections', 'exported_at', 'forecasts', 'resolutions']);
    expect(JSON.stringify(l)).not.toContain('"proposals"');
    expect(JSON.stringify(l)).not.toContain('"draft"');
  });

  it('scores to the recorded boards, live and as_of', () => {
    for (const c of cases) {
      const s = summarizeFor(publicLedger(c.export, c.as_of));
      expect(strip(s.initial)).toEqual(c.expect.initial);
      expect(s.entries_scored).toBe(c.expect.entries_scored);
      expect(s.open_fields).toBe(c.expect.open_fields);
    }
  });

  it('as_of drops entries, resolutions and corrections that did not exist yet', () => {
    const before = publicLedger(exp, '2026-10-05');
    expect(before.forecasts).toHaveLength(0);
    expect(before.resolutions).toHaveLength(0);
    expect(before.corrections).toHaveLength(0);
    expect(asOfLabel(before)).toBe('2026-10-05');
    expect(() => publicLedger(exp, '2026-13-01')).toThrow();
  });
});

describe('per-entry and per-type helpers', () => {
  const l = publicLedger(exp);

  it('versions, latest per entry and status counts', () => {
    expect(versionsOf(l, 'PT-2026-001')[0].version).toBe(1);
    expect(new Set(latestPerEntry(l).map((f) => f.entry_id)).size).toBe(latestPerEntry(l).length);
    const c = statusCounts(l, 'PT-2026-001');
    expect(c.resolved + c.void + c.open).toBe(5);
    expect(c.resolved).toBeGreaterThanOrEqual(2);
  });

  it('an entry belongs to its v1 base-rate row, once', () => {
    const key = rowKeyOf(l, 'PT-2026-001')!;
    expect(isRowKey(key)).toBe(true);
    expect(entriesForRow(l, key)).toContain('PT-2026-001');
    const all = rowKeysWithEntries(l).flatMap((k) => entriesForRow(l, k));
    expect(all.length).toBe(new Set(all).size);
    expect(all.length).toBe(new Set(l.forecasts.map((f) => f.entry_id)).size);
  });

  it('says which version scores each resolved field', () => {
    const s = scoringByField(l, 'PT-2026-001');
    expect(s.F1).toEqual({ latest_version: 1 });
    expect(s.F2).toEqual({ latest_version: 1 });
  });

  it('linkage corrections read as ids; anything else is null', () => {
    const link = l.corrections.find((c) => c.entry_id === 'PT-2026-001' && c.field === 'linkage')!;
    expect(linkageSummary(link)).toBe('ESPN 3916387 · GSIS 00-0034796 · PFR JackLa00 · team BAL · season 2026');
    expect(linkageSummary({ ...link, field: 'player' })).toBeNull();
    expect(linkageSummary({ ...link, new_value: 'not json' })).toBeNull();
  });

  it('evidence shows links, the note and the sentence — never the ingest basis', () => {
    const r = l.resolutions.find((x) => x.entry_id === 'PT-2026-001' && x.field === 'F2')!;
    const ev = resolutionEvidence(r);
    expect(ev.urls).toEqual(['https://www.pro-football-reference.com/boxscores/202610110atl.htm']);
    expect(ev.note).toContain('2026_05_BAL_ATL');
    expect(ev.sentence).toBeNull();
    expect(JSON.stringify(ev)).not.toContain('basis');
  });
});

describe('params', () => {
  it('as_of: absent → live, malformed → undefined (the page 404s)', () => {
    expect(asOfParam(undefined)).toBeNull();
    expect(asOfParam('')).toBeNull();
    expect(asOfParam('2026-11-03')).toBe('2026-11-03');
    expect(asOfParam('2026-11-31')).toBeUndefined();
    expect(asOfParam(['2026-11-03', 'x'])).toBeUndefined();
  });

  it('row keys are lowercase snake case only', () => {
    expect(isRowKey('high_ankle_sprain')).toBe(true);
    for (const bad of ['High', '../x', 'a b', '', 'x'.repeat(65)]) expect(isRowKey(bad)).toBe(false);
  });

  it('etDate reads an instant on the New York calendar', () => {
    expect(etDate('2026-10-14T03:01:39.458Z')).toBe('2026-10-13');
    expect(etDate(null)).toBeNull();
  });
});
