/**
 * /admin/ledger/resolutions (Stage 3): how a proposal reads, which entries
 * lack ids, the two form validators, and the routes' boundary as source text
 * (the reviewer is the session user; linkage ids are never taken from the body).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  entryIdStates,
  evidenceUrls,
  forecastLabel,
  outcomeLabel,
  proposalHeadline,
  validateCorrectionInput,
  validateLinkageInput,
} from '../lib/ledger-resolutions';
import type { LedgerForecast, LedgerProposal } from '../lib/ledger-types';
import hashFixture from './fixtures/ledger-hash-cases.json' with { type: 'json' };

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

function row(overrides: Partial<LedgerForecast> = {}): LedgerForecast {
  const input = hashFixture.cases[0].input as Record<string, unknown>;
  return { id: 'f1', status: 'published', ...input, gsis_id: null, pfr_id: null, espn_athlete_id: null, nflverse_team: null, season: 2026, ...overrides } as unknown as LedgerForecast;
}

const proposal = (o: Partial<LedgerProposal> = {}): LedgerProposal => ({
  id: 'p', entry_id: 'PT-2026-001', field: 'F2', proposed_status: 'resolved', proposed_outcome: '1.00', outcome_date: '2026-10-11', freeze_at: '2026-10-12T00:20:00.000Z',
  void_reason: null, evidence_url: 'https://www.pro-football-reference.com/boxscores/202610110atl.htm',
  evidence: { urls: ['https://www.pro-football-reference.com/boxscores/202610110atl.htm'], note: '33 snap(s)' },
  proposer: 'ingest', proposed_at: '2026-10-13T12:00:00Z', decision: 'pending', decided_by: null, decided_at: null, note: null, ...o,
});

describe('reading a proposal', () => {
  it('prints the forecast as the card does and the actual in words', () => {
    expect(forecastLabel('F2', row())).toBe('12%');
    expect(forecastLabel('F4', row())).toBe('3 (2–5)');
    expect(outcomeLabel('F2', '1.00')).toBe('played');
    expect(outcomeLabel('F4', '2.00')).toBe('2 games missed');
    expect(proposalHeadline(proposal())).toBe('F2 Next game: played on 2026-10-11');
    expect(proposalHeadline(proposal({ proposed_status: 'void', void_reason: 'traded', proposed_outcome: null }))).toBe('F2 Next game: void (traded)');
  });
  it('lists each evidence URL once and drops anything that is not http(s)', () => {
    expect(evidenceUrls(proposal({ evidence: { urls: ['https://www.pro-football-reference.com/boxscores/202610110atl.htm', 'nflverse:games.csv#x'] } }))).toEqual([
      'https://www.pro-football-reference.com/boxscores/202610110atl.htm',
    ]);
  });
});

describe('entries missing ids', () => {
  it('flags an entry until both gsis and pfr are present on some version', () => {
    const states = entryIdStates([row(), row({ id: 'f2', version: 2 } as Partial<LedgerForecast>)]);
    expect(states).toHaveLength(1);
    expect(states[0].missing).toBe(true);
    const linked = entryIdStates([row({ gsis_id: '00-0034796', pfr_id: 'JackLa00' })]);
    expect(linked[0].missing).toBe(false);
  });
  it('ignores drafts', () => {
    expect(entryIdStates([row({ status: 'draft', entry_id: null } as Partial<LedgerForecast>)])).toEqual([]);
  });
});

describe('validators', () => {
  it('a correction needs an entry, a field, a value and a note', () => {
    expect(validateCorrectionInput({ entry_id: 'PT-2026-001', field: 'injury_date', old_value: '2026-10-04', note: 'Reported date was the game date.' }).ok).toBe(true);
    const bad = validateCorrectionInput({ entry_id: 'PT-1', field: '', note: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThanOrEqual(3);
  });
  it('linkage takes an ESPN id, team and season, and refuses typed gsis/pfr ids', () => {
    const ok = validateLinkageInput({ entry_id: 'PT-2026-001', espn_athlete_id: '3916387', nflverse_team: 'bal', season: '2026' });
    expect(ok).toEqual({ ok: true, value: { entry_id: 'PT-2026-001', espn_athlete_id: '3916387', nflverse_team: 'BAL', season: 2026 } });
    expect(validateLinkageInput({ entry_id: 'PT-2026-001', espn_athlete_id: '3916387', gsis_id: '00-0034796' }).ok).toBe(false);
    expect(validateLinkageInput({ entry_id: 'PT-2026-001', espn_athlete_id: 'Lamar Jackson' }).ok).toBe(false);
    expect(validateLinkageInput({ entry_id: 'PT-2026-001', espn_athlete_id: '1', nflverse_team: 'Baltimore Ravens' }).ok).toBe(false);
  });
});

describe('route boundary (source)', () => {
  it('the decision route records the SESSION user and accepts only confirmed|rejected', () => {
    const src = read('../app/api/admin/ledger/resolutions/[id]/route.ts');
    expect(src).toContain('reviewer_user_id: gate.userId');
    expect(src).toMatch(/decision !== 'confirmed' && body\.decision !== 'rejected'/);
  });
  it('the linkage route takes gsis/pfr from the lookup, never the body', () => {
    const src = read('../app/api/admin/ledger/linkage/route.ts');
    expect(src).toContain('gsis_id: lookup.gsis_id');
    expect(src).toContain('pfr_id: lookup.pfr_id');
    expect(src).not.toMatch(/body\.(gsis_id|pfr_id)/);
  });
  it('this site only ever asks for a SHADOW ingest pass', () => {
    expect(read('../lib/ledger-publish.ts')).toMatch(/\/admin\/ledger\/ingest', \{ method: 'POST', body: \{ mode: 'shadow' \} \}/);
  });
  it('nothing on the resolutions page names a social tool', () => {
    for (const f of ['../components/ledger/ResolutionQueue.tsx', '../app/api/admin/ledger/resolutions/[id]/route.ts', '../app/api/admin/ledger/scoreboard/route.ts']) {
      expect(read(f)).not.toMatch(/twitter_|farcaster_|\/admin\/ledger\/publish/);
    }
  });
});
