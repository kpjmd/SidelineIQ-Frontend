/**
 * Production's NEXT_PUBLIC_SITE_URL is `sidelineiq.vercel.app` — no scheme —
 * so canonical links, sitemap <loc>s and the robots Sitemap line all shipped
 * scheme-less. The first test FAILS against the old `?? 'https://…'` pattern,
 * which passed the bare host straight through.
 */
import { describe, it, expect } from 'vitest';
import { resolveSiteUrl, DEFAULT_SITE_URL } from '../lib/site-url';

describe('resolveSiteUrl', () => {
  it('adds https to the bare host production actually sets', () => {
    expect(resolveSiteUrl('sidelineiq.vercel.app')).toBe('https://sidelineiq.vercel.app');
  });

  it('keeps an explicit scheme and drops a trailing slash', () => {
    expect(resolveSiteUrl('https://example.org/')).toBe('https://example.org');
    expect(resolveSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('keeps a base path', () => {
    expect(resolveSiteUrl('https://example.org/start/')).toBe('https://example.org/start');
  });

  it('falls back to the served host, never an unowned domain', () => {
    for (const raw of [undefined, null, '', '   ', 'ftp://x.org', 'https://']) {
      expect(resolveSiteUrl(raw)).toBe(DEFAULT_SITE_URL);
    }
    expect(DEFAULT_SITE_URL).not.toContain('sidelineiq.com');
  });

  it('always yields something new URL() accepts — metadataBase fails the build otherwise', () => {
    for (const raw of ['sidelineiq.vercel.app', 'https://a.b/', undefined, 'not a url at all']) {
      expect(() => new URL(resolveSiteUrl(raw))).not.toThrow();
    }
  });
});
