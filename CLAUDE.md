# SidelineIQ Frontend — Claude Code Guide

## What This Repository Is

The public site and the physician's workbench for SidelineIQ: a Next.js app on
Vercel that renders published injury analysis, and behind a login, the MD review
queue, the injury-thread dashboard, the baseline metrics tab, and the Tier-2
**Injury Desk** authoring surface whose output ships to kpjmd.com.

It is one of four repos. `sidelineiq-agents` generates and publishes content,
`sidelineiq-mcp-servers` owns the database, and `KPJMD-website` renders the
Injury Desk. **This repo has no database access of its own** — see Data path.

> **Read `AGENTS.md` first.** This is Next **16.2.2** with React 19, not the
> Next.js in your training data. `middleware.ts` is now `proxy.ts`, route
> `params` are Promises, and the docs that match this version are in
> `node_modules/next/dist/docs/`. Read the relevant guide before writing code.

## Tech Stack

- Next.js **16.2.2** (App Router), React **19.2.4**, TypeScript, Tailwind
- Auth: **NextAuth / Auth.js v5** (`next-auth@5.0.0-beta.31`), magic link via Resend
- Data: **MCP over Streamable HTTP**, never SQL
- Tests: **vitest** (`npm test`), flat in `tests/`
- Hosting: Vercel (Hobby), with Vercel Web Analytics

## Data path

`lib/mcp.ts` is the only door. It opens a `StreamableHTTPClientTransport` to
`WEB_MCP_URL` with a `MCP_AUTH_SECRET` bearer token and calls `web_*` / `desk_*`
tools (~38 typed wrappers). There is **no ORM, no `lib/api.ts`, no Neon client,
and no REST proxy to the agents service for reads.**

Railway survives in exactly two places, neither of them a data path:
`app/api/admin/promote/[postId]` and `lib/social-publish.ts`, which call the
agents service (`AGENTS_URL`) to trigger social publishing.

**Migrations live in `sidelineiq-mcp-servers/src/shared/migrations/` and are
hand-applied.** This repo cannot run one and must never try.

### An unknown key fails the whole call

Every mcp tool input is `.strict()`, deeply. A key the server does not declare
is **a rejected call**, not a dropped field — and a rejection comes back as a
normal value carrying `isError`, not as a throw. After changing any payload,
grep the mcp service logs for `[MCP] INPUT REJECTED`; that line must never
appear. This bug class already cost two silent data losses (`md_review_confidence`
discarded on 183 rows, `status` stripped on every create).

## Auth

- `auth.ts` — NextAuth config. Magic link via Resend, JWT sessions, a
  **single-email allowlist** (`ALLOWED_MD_EMAIL`). `UserRole = 'md' | 'editor'`.
- `proxy.ts` — matches **`/desk/:path*` and `/admin/:path*` only**. `/api/*` is
  deliberately NOT matched: an API route must answer JSON 401/403, not a
  redirect to a sign-in page.
- **Pages** gate with `auth()` plus a role check and `redirect('/signin')`
  (`app/admin/page.tsx`, `app/desk/page.tsx`, `app/admin/preview/[slug]/page.tsx`).
- **API routes** gate with `requireMd()` from `lib/desk-auth.ts`, which returns
  `{ok:false, response}` carrying the 401/403. Every `/api/admin/*` and
  `/api/desk/*` handler calls it first.
- **Identity for a write comes from the session, never the request body.** The
  metrics POST and the thread-reopen route both take `gate.userId`.
- Desk publishing is gated **authoritatively in the MCP publish gate**, which
  re-derives the role from the database and never trusts `session.user.role`.

## What the public may fetch

`isPubliclyViewable(status)` in `lib/types.ts` — **PUBLISHED only** — and all
three public surfaces ask it: `app/post/[slug]/page.tsx`, its
`generateMetadata`, and `opengraph-image.tsx` (which `twitter-image.tsx`
re-exports rather than gating separately).

They used to gate on `isRetiredPostStatus`, which blocks REJECTED and SUPERSEDED
and **lets PENDING_REVIEW and DRAFT through** — so a post sitting in the
physician's queue precisely because nobody had approved it was readable, and
shareable as a rendered card, by anyone with the slug. `app/api/post/[slug]`
was worse: raw post JSON for any status, unauthenticated, with no caller
anywhere in the repo. It is deleted, and `tests/public-visibility.test.ts` is
what stops it coming back.

The MD reads a queued item at **`/admin/preview/[slug]`** — session-gated,
`force-dynamic`, `robots: noindex`, rendering the same `DeepDivePost`. It is a
separate route on purpose: reading the session makes a route dynamic, and
`/post/[slug]` is ISR (`revalidate = 60`), so gating the public page on a cookie
would drop that cache for every anonymous reader to serve one physician.

`isRetiredPostStatus` still exists and still means something narrower — "reached
an audience, then withdrawn" as opposed to "never approved".

## The AequOs CTA rule

`showsReferralCta(post)` (`lib/referral-cta.ts`) is the one predicate:
**`content_type === 'DEEP_DIVE' && subject_kind === 'INJURY_TYPE'`.** Never on
BREAKING, TRACKING or CONFLICT_FLAG, and never on a DEEP_DIVE about one named
athlete — a consult ask beside a non-patient's medical situation reads as
advertising under a physician byline. NULL / ATHLETE / unknown `subject_kind`
carries no CTA; that is the fail-closed direction.

Rendered by `components/post/AequOsCTA.tsx` at `DeepDivePost.tsx`, through
`/go/aequos?post=<slug>&from=cta` — a plain `<a>`, not `next/link`, so a
prefetch cannot reach the click counter. `lib/cta-click.ts` builds a **fixed**
aequos.io target (no user-supplied URL, so it cannot be an open redirect) and
`decideClick()` drops non-GET, bad slugs, unknown `from`, prefetch headers and
crawler/unfurler user agents. Counting is aggregate only — no IP, no user agent,
nothing about a visitor — and only for PUBLISHED slugs.

## Cross-repo helpers copied by hand

Two files exist in two repos and must be changed in both:

- **`lib/conflict-gap.ts`** ↔ agents `src/utils/conflict-gap.ts` — byte-identical
  apart from one doc paragraph, pinned by `tests/fixtures/conflict-gap-cases.json`
  (also byte-identical in both) and `CONFLICT_GAP_HELPER_VERSION`. Change the
  arithmetic there first, bump the version, re-record the fixture, copy both.
- **`lib/referral-cta.ts`** ↔ agents `carriesReferralCta` — identical body, held
  in sync by **comment only**, with no fixture and no version constant.

## Surfaces

| Route | What it is |
|---|---|
| `/` | Published feed |
| `/post/[slug]` | A published post. ISR `revalidate = 60`. OG + Twitter card routes beside it. |
| `/privacy` | What the site collects. **Every sentence must stay true of the code — change it in the same PR.** |
| `/go/aequos` | Counted redirect to aequos.io |
| `/sitemap.ts`, `/robots.ts` | PUBLISHED only; `/admin` and `/go/` disallowed |
| `/signin` | Magic link |
| `/admin` | MD dashboard — tabs: reviews, promote, candidates, threads, metrics |
| `/admin/preview/[slug]` | Session-gated read of a non-public post |
| `/desk`, `/desk/[deskPostId]` | Tier-2 Injury Desk authoring → kpjmd.com handoff |

`app/api/admin/*`: approve, reject, review(s), posts, promote, candidates,
threads (+ `[entityId]/reopen`), metrics. `app/api/desk/*`: drafts, posts,
candidates. `app/api/feed`: PUBLISHED only, ignores query params.

## The admin dashboard

`components/admin/AdminDashboard.tsx` is a dumb shell: `type Tab = 'reviews' |
'promote' | 'candidates' | 'threads' | 'metrics'`, a nav array, a render switch.
Gating is upstream in `app/admin/page.tsx`, whose two independent `try` blocks
stop a mid-deploy MCP missing one tool from blanking the whole dashboard. A 401
from any tab's fetch means the session expired → `router.push('/signin')`.

**`MetricsView.tsx` is the template for adding a tab**: `'use client'`, **no
props**, fetches its own data in `useEffect`, so it needed zero changes to the
shell or the server page. Pure display/validation logic goes in a `lib/*.ts`
with its own test (`lib/metrics-summary.ts`, `lib/accuracy-stats.ts`).

### Accuracy

`ThreadsQueue.tsx` has three sub-views; `AccuracyView` is the closed-thread one.
`computeAccuracyStats` (`lib/accuracy-stats.ts`) computes `within_range` and MAE
**over separate denominators** — `within` used to divide by every closed thread,
so a RETIRED career read as a missed projection.

**`within_range` is the headline the public page will inherit, not MAE.** An ACL
window is 91 days wide; MAE measures distance from a midpoint the model never
claimed and so punishes calls that were right. The definitions are pre-registered
in the agents repo at `docs/accuracy-preregistration.md` and must not be changed
after a number derived from them is published.

`accuracy_record.scoreable` (mcp, 2026-09-15) names why a thread could not be
scored. It is **absent on every earlier row**: treat `undefined` as "derive it"
(`within_range != null`), never as `false`.

**Reopen** is the MD's undo for a wrong close, which matters now that the agents'
return detector closes threads on a timer. `web_thread_reopen` was the first tool
in any repo that could set a thread back to ACTIVE; before it, a false positive
needed hand-written SQL against production with no audit row.

## Conventions

- **Server components by default.** `'use client'` only where interaction needs it.
- `params` is a **Promise** — `const { slug } = await params`.
- Never `process.env.X` in a client component. Site URL goes through
  `resolveSite()` (`lib/site-url.ts`), which repaired scheme-less canonicals.
- `lib/*.ts` helpers import **relatively** in test-covered modules (no `@/` alias
  under vitest).
- Show "no data", never `0`, for a value that could not be read. An unreadable
  number and zero are different facts.

## Environment

`WEB_MCP_URL`, `MCP_AUTH_SECRET`, `AGENTS_URL`, `AGENTS_API_SECRET`,
`AUTH_SECRET`, `AUTH_URL`, `ALLOWED_MD_EMAIL`, `AUTH_RESEND_KEY`, `EMAIL_FROM`,
`NEXT_PUBLIC_SITE_URL` (must include the scheme). See `.env.example`.
`RAILWAY_BACKEND_URL` and `ADMIN_SECRET` are gone; if you find a reference,
it is stale.

`npm run build` needs `WEB_MCP_URL` and `MCP_AUTH_SECRET` — they live in the
agents repo's `.env`.

## Relationship to Other Repos

- `sidelineiq-mcp-servers` — owns the DB and every tool. **Deploy it first.**
- `sidelineiq-agents` — generates, publishes, and now closes injury threads.
- `KPJMD-website` — renders the Injury Desk posts authored in `/desk`.
- `orthoiq-agents` / AequOs — separate platform. Do not import from it.
