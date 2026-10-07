import { describe, it, expect } from 'vitest';
import { xCardHeading } from '../lib/ledger-x-heading';

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
