/**
 * The site's absolute origin, whatever shape NEXT_PUBLIC_SITE_URL arrives in.
 *
 * Production sets it to `sidelineiq.vercel.app` — no scheme. Every use was a
 * template string, so that shipped as-is: the canonical link on every post was
 * `href="sidelineiq.vercel.app/post/…"`, which a crawler resolves RELATIVE to
 * the page (a canonical pointing at a 404), and every sitemap <loc> and the
 * robots.txt Sitemap line were not URLs at all. Measured live 2026-09-13.
 *
 * It also has to survive `new URL()` for metadataBase, which throws on a bare
 * host — and a throw there fails the build, not one request.
 *
 * The fallback is the host production actually serves (and the agents' own
 * SITE_URL default). Since the ParatrOs domain cutover (2026-09-17) that is
 * www.paratros.com — Vercel 308s the apex to www, so www is canonical. Never
 * sidelineiq.com: we do not own that domain.
 */
export const DEFAULT_SITE_URL = 'https://www.paratros.com';

/**
 * The host every post published before the cutover links to. It stays attached
 * to the project and 308s to DEFAULT_SITE_URL (next.config.ts), so those links
 * keep resolving.
 */
export const LEGACY_SITE_HOST = 'sidelineiq.vercel.app';

export function resolveSiteUrl(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return DEFAULT_SITE_URL;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return DEFAULT_SITE_URL;
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const siteUrl = (): string => resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/**
 * The bare host for display — `paratros.com`, not `https://www.paratros.com`.
 *
 * Used on the OG cards, where the kit prints the domain as plain text. The `www.`
 * is stripped because it is a serving detail, not the brand: the canonical origin
 * is www (the apex 308s to it) but nobody writes it that way. Derived from
 * siteUrl() so a future origin change cannot leave a stale literal on every
 * cached card image.
 */
export function siteHost(): string {
  return new URL(siteUrl()).host.replace(/^www\./, '');
}
