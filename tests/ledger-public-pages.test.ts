/**
 * Structural guarantees of the public ledger pages (Stage 4), read from source
 * like tests/ledger-resolutions.test.ts does:
 *  - the full disclaimer has ONE home, app/ledger/layout.tsx, which wraps
 *    every page under app/ledger (spec "Public site": on every page);
 *  - no public ledger page or route reads a tool that can return a draft or a
 *    proposal. web_export_ledger (published only, no proposals) is the read.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const ledgerFiles = walk(join(ROOT, 'app/ledger')).filter((p) => /\.(tsx?|ts)$/.test(p));
const src = (p: string) => readFileSync(p, 'utf8');

describe('public ledger pages', () => {
  it('the layout renders the AI line, the full disclaimer and the reliance line', () => {
    const layout = src(join(ROOT, 'app/ledger/layout.tsx'));
    for (const key of ['ai_disclosure', 'full_disclaimer', 'reliance']) expect(layout).toContain(`LEDGER_COPY.${key}`);
  });

  it('no page re-renders the disclaimer (one source)', () => {
    const pages = ledgerFiles.filter((p) => p.endsWith('page.tsx'));
    expect(pages.length).toBeGreaterThanOrEqual(4);
    for (const p of pages) expect(src(p), p).not.toContain('full_disclaimer');
  });

  it('no public file reads proposals, drafts or a single unfiltered forecast', () => {
    for (const p of ledgerFiles) {
      const s = src(p);
      for (const banned of ['listLedgerProposals', 'getLedgerForecast', 'include_drafts', '.proposals', 'listReplyProposals']) {
        expect(s, `${p} uses ${banned}`).not.toContain(banned);
      }
    }
  });

  it('pages and the CSV build from exportLedger through publicLedger', () => {
    for (const rel of ['app/ledger/page.tsx', 'app/ledger/[entryId]/page.tsx', 'app/ledger/scoreboard/page.tsx', 'app/ledger/injury/[rowKey]/page.tsx', 'app/ledger/export.csv/route.ts']) {
      const s = src(join(ROOT, rel));
      expect(s, rel).toContain('exportLedger');
      expect(s, rel).toContain('publicLedger(');
    }
  });
});
