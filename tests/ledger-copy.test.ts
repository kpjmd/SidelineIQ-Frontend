/**
 * lib/ledger-copy.ts is a byte-identical twin of sidelineiq-agents
 * src/ledger/copy.ts, pinned by the recorded fixture both repos load. The
 * agents repo owns the text; counsel's edits land there, get re-recorded, and
 * are copied here with the fixture. This test fails on a one-sided edit.
 */
import { describe, it, expect } from 'vitest';
import {
  LEDGER_COPY,
  LEDGER_COPY_VERSION,
  PHYSICIAN_CREDENTIAL,
  LEDGER_BRAND,
  FORBIDDEN_PUBLIC_WORDS,
  findForbiddenWords,
} from '../lib/ledger-copy';
import { BRAND_NAME, BRAND_SIGNATURE_NAME, BRAND_SIGNATURE_TAIL } from '../lib/brand';
import fixture from './fixtures/ledger-copy.json' with { type: 'json' };

describe('ledger copy fixture (twin of the agents module)', () => {
  it('was recorded against this copy version and these strings', () => {
    expect(fixture.copy_version).toBe(LEDGER_COPY_VERSION);
    expect(fixture.copy).toEqual(LEDGER_COPY);
    expect(fixture.constants.PHYSICIAN_CREDENTIAL).toBe(PHYSICIAN_CREDENTIAL);
    expect(fixture.forbidden_public_words).toEqual(FORBIDDEN_PUBLIC_WORDS);
  });

  it('spells the brand the way the site does and keeps the credential to name and degree', () => {
    expect(LEDGER_BRAND).toBe(BRAND_NAME);
    expect(PHYSICIAN_CREDENTIAL).toBe('Keith P. Johnson, MD');
  });

  it('is a different line from the autonomous posts\' signature, by construction', () => {
    const signature = `${BRAND_SIGNATURE_NAME}${BRAND_SIGNATURE_TAIL}`;
    expect(Object.values(LEDGER_COPY).filter((v) => typeof v === 'string')).not.toContain(signature);
    expect(signature).not.toContain(PHYSICIAN_CREDENTIAL);
    expect(LEDGER_COPY.ai_disclosure).toContain(PHYSICIAN_CREDENTIAL);
  });

  it('flags the banned vocabulary as whole words', () => {
    expect(findForbiddenWords('Our assessment: he should sit. Lock it in.')).toEqual(['assessment', 'should', 'lock']);
    expect(findForbiddenWords('shoulder, locker room, widespread')).toEqual([]);
  });
});
