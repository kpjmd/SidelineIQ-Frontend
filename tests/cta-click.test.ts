/**
 * The /go/aequos redirect decides two things: where the reader goes (always the
 * same fixed URL) and whether the click counts (only a person clicking a real
 * post link). Posts are shared to X and Farcaster, whose preview fetchers hit
 * every link in a post — counting them would turn every share into a "click".
 */
import { describe, it, expect } from 'vitest';
import { aequosClickHref, aequosTarget, decideClick } from '../lib/cta-click';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

function req(query: string, opts: { method?: string; headers?: Record<string, string> } = {}) {
  return {
    method: opts.method ?? 'GET',
    searchParams: new URLSearchParams(query),
    headers: new Headers({ 'user-agent': BROWSER_UA, ...opts.headers }),
  };
}

describe('the redirect target', () => {
  it('is aequos.io with ref kept and utm tags naming the link', () => {
    const url = new URL(aequosTarget('cta'));
    expect(url.origin).toBe('https://aequos.io');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ref: 'sidelineiq',
      utm_source: 'sidelineiq',
      utm_medium: 'web',
      utm_campaign: 'deep_dive',
      utm_content: 'cta',
    });
  });

  it.each([
    ['a counted click', 'post=acl-tears-2026-09-13&from=cta', {}],
    ['a bot', 'post=acl-tears&from=cta', { headers: { 'user-agent': 'Twitterbot/1.0' } }],
    ['a bad slug', 'post=../../evil&from=cta', {}],
    ['a smuggled destination', 'post=acl&from=cta&url=https://evil.example&next=//evil.example', {}],
    ['a HEAD request', 'post=acl&from=cta', { method: 'HEAD' }],
  ])('never leaves aequos.io for %s', (_label, query, opts) => {
    const decision = decideClick(req(query, opts));
    expect(new URL(decision.target).origin).toBe('https://aequos.io');
  });

  it('still redirects, tagged unknown, when from is missing', () => {
    const decision = decideClick(req('post=acl'));
    expect(decision.count).toBe(false);
    expect(new URL(decision.target).searchParams.get('utm_content')).toBe('unknown');
  });
});

describe('what counts', () => {
  it('counts a browser GET on a slug-shaped post with a known link', () => {
    expect(decideClick(req('post=acl-tears-2026-09-13-2&from=byline'))).toEqual({
      count: true,
      postSlug: 'acl-tears-2026-09-13-2',
      from: 'byline',
      target: aequosTarget('byline'),
    });
  });

  it.each([
    ['Twitterbot', 'Twitterbot/1.0'],
    ['Facebook preview', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['Slack unfurler', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
    ['Discord', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['curl', 'curl/8.7.1'],
    ['an empty user agent', ''],
  ])('does not count %s', (_label, ua) => {
    expect(decideClick(req('post=acl&from=cta', { headers: { 'user-agent': ua } }))).toMatchObject({
      count: false,
      reason: 'user_agent',
    });
  });

  it.each([
    ['Purpose: prefetch', { purpose: 'prefetch' }],
    ['Sec-Purpose: prefetch;prerender', { 'sec-purpose': 'prefetch;prerender' }],
  ])('does not count a %s', (_label, headers) => {
    expect(decideClick(req('post=acl&from=cta', { headers }))).toMatchObject({ count: false, reason: 'prefetch' });
  });

  it.each([
    ['uppercase', 'ACL-Tears'],
    ['a trailing dash', 'acl-'],
    ['a path', 'acl/tears'],
    ['empty', ''],
    ['too long', 'a'.repeat(241)],
  ])('does not count a slug that is %s', (_label, slug) => {
    expect(decideClick(req(`post=${encodeURIComponent(slug)}&from=cta`))).toMatchObject({
      count: false,
      reason: 'slug',
    });
  });

  it('does not count an unknown link', () => {
    expect(decideClick(req('post=acl&from=footer'))).toMatchObject({ count: false, reason: 'from' });
  });

  it('does not count HEAD', () => {
    expect(decideClick(req('post=acl&from=cta', { method: 'HEAD' }))).toMatchObject({ count: false, reason: 'method' });
  });
});

describe('the link a post page emits', () => {
  it('goes through the counted redirect', () => {
    expect(aequosClickHref('acl-tears-2026-09-13', 'cta')).toBe('/go/aequos?post=acl-tears-2026-09-13&from=cta');
  });

  it('round-trips into a counted click', () => {
    const href = aequosClickHref('acl-tears-2026-09-13', 'byline');
    const query = new URL(href, 'https://sidelineiq.vercel.app').searchParams.toString();
    expect(decideClick(req(query))).toMatchObject({ count: true, postSlug: 'acl-tears-2026-09-13', from: 'byline' });
  });

  it('links straight to the tagged target when the post has no slug', () => {
    expect(aequosClickHref(null, 'cta')).toBe(aequosTarget('cta'));
  });
});
