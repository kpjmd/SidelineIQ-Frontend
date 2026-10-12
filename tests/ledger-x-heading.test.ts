import { describe, it, expect } from 'vitest';
import { isLedgerOnly, xCardHeading } from '../lib/ledger-x-heading';

const x = (reply_to_id: string | null) => ({ text: 't', reply_to_id, status: 'ok' });
const REPORT = 'https://x.com/AdamSchefter/status/1';

describe('xCardHeading (agents try the reply, fall back to standalone when X refuses)', () => {
  it('dry run with a reply target says the fallback may happen', () => {
    expect(xCardHeading({ dry_run: true, x: x('123') })).toBe('X CARD REPLY · replying to 123 · standalone if X refuses');
  });
  it('a live reply names its target without the caveat', () => {
    expect(xCardHeading({ dry_run: false, x: x('123') })).toBe('X CARD REPLY · replying to 123');
  });
  it('a refused reply that fell back says so, even though reply_to_id is now null', () => {
    expect(xCardHeading({ dry_run: false, x: x(null), standalone: { reason: 'reply_refused', report_url: REPORT, audited: true } }))
      .toMatch(/standalone \(X refused the reply/);
  });
  it('a requested standalone says by request', () => {
    expect(xCardHeading({ dry_run: true, x: x(null), standalone: { reason: 'force_standalone', report_url: REPORT, audited: false } }))
      .toMatch(/standalone \(by request/);
  });
  it('no report post at all is plain standalone', () => {
    expect(xCardHeading({ dry_run: false, x: x(null) })).toBe('X CARD · standalone');
  });
});

describe('Tier 2 is ledger-only (agents PR #79): no X card', () => {
  it('the heading says not posted, whatever the reply target', () => {
    expect(xCardHeading({ dry_run: true, tier: 2, x: { ...x(null), status: 'skipped' } })).toBe('X CARD · not posted (Tier 2, ledger only)');
  });
  it('a tier 1 outcome keeps the reply heading', () => {
    expect(xCardHeading({ dry_run: false, tier: 1, x: x('123') })).toBe('X CARD REPLY · replying to 123');
  });
  it("isLedgerOnly reads the outcome's tier, and the stored row's when an older agents build omits it", () => {
    expect(isLedgerOnly({ tier: 2 }, 1)).toBe(true);
    expect(isLedgerOnly({ tier: 1 }, 2)).toBe(false);
    expect(isLedgerOnly({}, 2)).toBe(true);
    expect(isLedgerOnly({}, 1)).toBe(false);
    expect(isLedgerOnly({}, undefined)).toBe(false);
  });
});
