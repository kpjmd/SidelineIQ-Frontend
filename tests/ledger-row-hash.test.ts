/**
 * lib/ledger-row-hash.ts is a byte-identical twin of sidelineiq-agents
 * src/ledger/row-hash.ts (and the mcp's ledger-hash.ts). The card re-verifies a
 * row's hash with this copy before rendering, so this copy must produce the
 * recorded fixture's answers exactly.
 */
import { describe, it, expect } from 'vitest';
import {
  LEDGER_HASH_VERSION,
  LEDGER_HASH_FIELDS,
  ledgerHashInput,
  ledgerRowHash,
  canonicalize,
  shortHash,
  type HashableForecastRow,
} from '../lib/ledger-row-hash';
import fixture from './fixtures/ledger-hash-cases.json' with { type: 'json' };

interface Case {
  name: string;
  rule: string;
  input: Record<string, unknown>;
  equivalent?: Record<string, unknown>;
  normalized: Record<string, unknown>;
  row_hash: string;
}

function revive(input: Record<string, unknown>): HashableForecastRow {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v && typeof v === 'object' && '$date' in (v as object)) out[k] = new Date((v as { $date: string }).$date);
    else if (v && typeof v === 'object' && '$undefined' in (v as object)) continue;
    else out[k] = v;
  }
  return out as unknown as HashableForecastRow;
}

const CASES = (fixture as unknown as { cases: Case[] }).cases;

describe('ledger row hash fixture (twin)', () => {
  it('was recorded against this hash version', () => {
    expect((fixture as unknown as { hash_version: number }).hash_version).toBe(LEDGER_HASH_VERSION);
  });

  for (const c of CASES) {
    it(`${c.name} — ${c.rule}`, () => {
      const row = revive(c.input);
      expect(ledgerHashInput(row)).toEqual(c.normalized);
      expect(ledgerRowHash(row)).toBe(c.row_hash);
      if (c.equivalent) expect(ledgerRowHash(revive(c.equivalent))).toBe(c.row_hash);
    });
  }

  it('covers exactly the spec fields plus published_at, and hash_version; provenance stays out', () => {
    const base = revive(CASES[0].input);
    expect(Object.keys(ledgerHashInput(base)).sort()).toEqual([...LEDGER_HASH_FIELDS, 'hash_version'].sort());
    expect(ledgerRowHash({ ...base, commit_sha: 'abc', x_post_id: '1' } as HashableForecastRow)).toBe(ledgerRowHash(base));
    expect(canonicalize({ b: 1, a: [2, { d: 0, c: null }] })).toBe('{"a":[2,{"c":null,"d":0}],"b":1}');
    expect(shortHash(ledgerRowHash(base))).toHaveLength(8);
  });
});
