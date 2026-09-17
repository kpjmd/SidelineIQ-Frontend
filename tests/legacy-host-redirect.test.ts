/**
 * Every post published before the ParatrOs cutover links to
 * sidelineiq.vercel.app. Those links must keep resolving, to the same path.
 */
import { describe, it, expect } from 'vitest';
import { legacyHostRedirects } from '../lib/legacy-host-redirect';
import { DEFAULT_SITE_URL, LEGACY_SITE_HOST } from '../lib/site-url';
import nextConfig from '../next.config';

describe('legacy host redirect', () => {
  const [rule] = legacyHostRedirects;

  it('is one permanent (308) rule keyed on the exact legacy host', () => {
    expect(legacyHostRedirects).toHaveLength(1);
    expect(rule.permanent).toBe(true);
    expect(rule.has).toEqual([{ type: 'host', value: 'sidelineiq.vercel.app' }]);
    expect(LEGACY_SITE_HOST).toBe('sidelineiq.vercel.app');
  });

  it('keeps the path and lands on the canonical host', () => {
    expect(rule.source).toBe('/:path*');
    expect(rule.destination).toBe('https://www.paratros.com/:path*');
  });

  it('cannot redirect to itself', () => {
    expect(new URL(DEFAULT_SITE_URL).host).not.toBe(LEGACY_SITE_HOST);
  });

  it('is what next.config serves', async () => {
    expect(await nextConfig.redirects?.()).toEqual(legacyHostRedirects);
  });
});
