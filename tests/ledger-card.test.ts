import { describe, it, expect } from 'vitest';
import { cardModelFor, pct, f4Label, injuryDateLabel, TIER_COLORS } from '../lib/ledger-card';
import { LEDGER_COPY } from '../lib/ledger-copy';
import { ledgerRowHash } from '../lib/ledger-row-hash';
import type { PublishedLedgerForecast } from '../lib/ledger-types';
import hashFixture from './fixtures/ledger-hash-cases.json' with { type: 'json' };

function row(overrides: Partial<PublishedLedgerForecast> = {}): PublishedLedgerForecast {
  const input = hashFixture.cases[0].input as Record<string, unknown>;
  const base = { id: 'f1', status: 'published', ...input, confirmed_by: 'u', confirmed_at: '2026-10-06T18:04:05.123Z', ...overrides } as unknown as PublishedLedgerForecast;
  if (!overrides.row_hash) base.row_hash = ledgerRowHash(base);
  return base;
}

describe('cardModelFor (spec: Card content spec)', () => {
  it('puts the five fields in order with F4 dominant and prints id · version · hash8', () => {
    const r = row();
    const m = cardModelFor(r);
    expect(m.tiles.map((t) => t.field)).toEqual(['F1', 'F2', 'F3', 'F4', 'F5']);
    expect(m.tiles.map((t) => t.value)).toEqual(['18%', '12%', '61%', '3 (2–5)', '22%']);
    expect(m.tiles.filter((t) => t.dominant).map((t) => t.field)).toEqual(['F4']);
    expect(m.provenance).toBe(`PT-2026-001 · v1 · ${r.row_hash.slice(0, 8)}`);
    expect(m.header).toBe('Example Player · WR · BUF');
    expect(m.reported).toBe('Reported: Grade 2 hamstring strain · injury Oct 4, 2026');
    expect(m.revision).toBeNull();
  });

  it('carries the fixed copy: credit, publisher, AI line, card disclaimer, ledger URL', () => {
    const m = cardModelFor(row());
    expect(m.credit).toBe(LEDGER_COPY.credit);
    expect(m.publisher).toBe(LEDGER_COPY.publisher);
    expect(m.aiDisclosure).toBe(LEDGER_COPY.ai_disclosure);
    expect(m.disclaimer).toBe(LEDGER_COPY.card_disclaimer);
    expect(m.url).toBe('paratros.com/ledger');
  });

  it('fixed tier colours; a revision names its trigger; a null F5 prints n/a', () => {
    expect(cardModelFor(row({ source_tier: 'A' })).tier).toBe(TIER_COLORS.A);
    expect(cardModelFor(row({ source_tier: 'C' })).tier.label).toBe('TIER C');
    expect(cardModelFor(row({ version: 2, trigger: 'Placed on IR' })).revision).toBe('v2 — Placed on IR');
    expect(cardModelFor(row({ f5_reinjury: null })).tiles[4].value).toBe('n/a');
  });

  it('helpers', () => {
    expect(pct('0.1849')).toBe('18%');
    expect(() => pct(1.2)).toThrow();
    expect(f4Label(3, 2, 6)).toBe('3 (2–6)');
    expect(injuryDateLabel('2026-12-15')).toBe('Dec 15, 2026');
  });
});
