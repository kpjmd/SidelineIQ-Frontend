# SidelineIQ Frontend — Session 4 

## Project Overview

SidelineIQ is an autonomous AI sports injury intelligence platform. The web frontend
is the authoritative publishing surface — it receives the best version of every
OTM (OrthoTriage Master) post, supports an optional physician MD Review block
(web-only, DEEP_DIVE only), and drives SEO traffic that converts to OrthoIQ.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Vercel (new project: `sidelineiq-frontend`) |
| Data source | sidelineiq-agents (Railway) — frontend NEVER talks to Neon directly |
| Markdown rendering | `react-markdown` + `remark-gfm` |

---

## Repository Setup

New repo: `sidelineiq-frontend`

```
sidelineiq-frontend/
├── app/
│   ├── page.tsx                    # Feed page (default: DEEP_DIVE + CONFLICT_FLAG)
│   ├── post/[slug]/page.tsx        # Full post page
│   ├── admin/page.tsx              # MD Review queue (protected)
│   └── api/
│       ├── feed/route.ts           # Proxy → Railway /posts
│       ├── post/[slug]/route.ts    # Proxy → Railway /posts/:slug
│       ├── admin/review/route.ts   # POST → Railway /admin/review
│       └── admin/approve/route.ts  # POST → Railway /admin/approve
├── components/
│   ├── feed/
│   │   ├── FilterBar.tsx
│   │   ├── PostFeed.tsx
│   │   ├── BreakingCard.tsx
│   │   ├── TrackingCard.tsx
│   │   ├── DeepDiveCard.tsx        # Feed preview version (collapsed)
│   │   └── ConflictFlagCard.tsx
│   ├── post/
│   │   ├── DeepDivePost.tsx        # Full expanded version
│   │   ├── MDReviewBlock.tsx
│   │   ├── ConflictGapDisplay.tsx
│   │   └── OrthoIQCTA.tsx
│   ├── admin/
│   │   ├── ReviewQueue.tsx
│   │   └── MDReviewForm.tsx
│   └── shared/
│       ├── SportBadge.tsx
│       ├── ContentTypeBadge.tsx
│       └── OTMSignature.tsx
├── lib/
│   ├── api.ts                      # Typed fetch helpers
│   └── types.ts                    # Shared TypeScript types
└── next.config.ts
```

---

## Database Schema (Neon PostgreSQL)

Claude Code must verify these exist and run migrations if needed.

### `posts` table — required columns

```sql
id                 UUID PRIMARY KEY DEFAULT gen_random_uuid()
content_type       TEXT NOT NULL  -- 'BREAKING' | 'TRACKING' | 'DEEP_DIVE' | 'CONFLICT_FLAG'
sport              TEXT NOT NULL  -- 'NFL' | 'NBA' | 'PREMIER_LEAGUE' | 'UFC'
player_name        TEXT
injury_type        TEXT
body               TEXT NOT NULL  -- Full markdown content
slug               TEXT UNIQUE    -- /post/[slug] — generate as player-name-injury-date if absent
published_at       TIMESTAMPTZ DEFAULT NOW()
farcaster_hash     TEXT
twitter_thread_ids TEXT[]
conflict_reason    TEXT           -- Clinical basis for CONFLICT_FLAG (pipeline sends this)
team_timeline_weeks INTEGER       -- Team's disclosed weeks (pipeline sends this)
parent_post_id     UUID REFERENCES posts(id)  -- TRACKING → BREAKING linkage (NOT YET IN PIPELINE — add as nullable)
created_at         TIMESTAMPTZ DEFAULT NOW()
```

### `md_reviews` table — create if not exists

```sql
CREATE TABLE IF NOT EXISTS md_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               UUID REFERENCES posts(id) ON DELETE CASCADE,
  reviewer_note         TEXT NOT NULL,
  is_approved           BOOLEAN DEFAULT FALSE,
  is_flagged_for_revision BOOLEAN DEFAULT FALSE,
  reviewed_at           TIMESTAMPTZ DEFAULT NOW(),
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_md_reviews_post_id ON md_reviews(post_id);
CREATE INDEX IF NOT EXISTS idx_md_reviews_approved ON md_reviews(is_approved);
```

### Feed query (joins md_review for DeepDive)

```sql
SELECT
  p.*,
  mr.reviewer_note,
  mr.is_approved,
  mr.approved_at
FROM posts p
LEFT JOIN md_reviews mr ON mr.post_id = p.id AND mr.is_approved = TRUE
WHERE p.content_type = ANY($1)
  AND ($2::text IS NULL OR p.sport = $2)
ORDER BY p.published_at DESC
LIMIT $3 OFFSET $4;
```

---

## TypeScript Types (`lib/types.ts`)

```typescript
export type ContentType = 'BREAKING' | 'TRACKING' | 'DEEP_DIVE' | 'CONFLICT_FLAG';
export type Sport = 'NFL' | 'NBA' | 'PREMIER_LEAGUE' | 'UFC';

export interface Post {
  id: string;
  content_type: ContentType;
  sport: Sport;
  player_name: string | null;
  injury_type: string | null;
  body: string;
  slug: string;
  published_at: string;
  farcaster_hash: string | null;
  twitter_thread_ids: string[] | null;
  conflict_reason: string | null;
  team_timeline_weeks: number | null;
  parent_post_id: string | null;
  // Joined from md_reviews when is_approved = true
  reviewer_note: string | null;
  is_approved: boolean | null;
  approved_at: string | null;
}

export interface MDReviewPayload {
  post_id: string;
  reviewer_note: string;
  is_flagged_for_revision?: boolean;
}
```

---

## Environment Variables

### Vercel project (sidelineiq-frontend)
```
RAILWAY_BACKEND_URL=https://[sidelineiq-agents-url].railway.app
ADMIN_SECRET=                     # Shared secret for /admin route protection
NEXT_PUBLIC_SITE_URL=https://sidelineiq.com
```

---

## Page Specifications

### 1. Feed Page (`app/page.tsx`)

**Default state:** Show DEEP_DIVE + CONFLICT_FLAG, all sports, most recent first.

**ISR:** `export const revalidate = 60;`

**Components:**
- `FilterBar` — sport tabs (NFL / NBA / PL / UFC / All) × content type pills (All / Breaking / Tracking / Deep Dive / Conflict Flag). Default: All sports, DEEP_DIVE + CONFLICT_FLAG selected.
- `PostFeed` — maps posts to the correct card component by `content_type`.

**URL state:** Sync filter state to query params so shared links preserve the view.
`/?sport=NFL&type=DEEP_DIVE,CONFLICT_FLAG`

---

### 2. Post Page (`app/post/[slug]/page.tsx`)

**ISR:** `export const revalidate = 60;`

**For DEEP_DIVE posts:**
- Full markdown render of `body` using `react-markdown` + `remark-gfm`
- Renders the classification table as a real HTML table
- `ConflictGapDisplay` if `conflict_reason` is present
- `MDReviewBlock` if `is_approved === true` (renders at bottom, before OrthoIQ CTA)
- `OrthoIQCTA` section always present at the bottom of DEEP_DIVE

**For CONFLICT_FLAG posts:**
- Full markdown render with `ConflictGapDisplay` prominently featured
- OrthoIQ CTA present

**SEO metadata** (`generateMetadata`):
```typescript
title: `${player_name} ${injury_type} Injury Update | SidelineIQ`
description: First 160 chars of the clinical summary extracted from body
canonical: ${NEXT_PUBLIC_SITE_URL}/post/${slug}
```

**JSON-LD** (NewsArticle schema, inline in `<head>`):
```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "${title}",
  "datePublished": "${published_at}",
  "dateModified": "${approved_at ?? published_at}",
  "author": { "@type": "Organization", "name": "OrthoTriage Master / SidelineIQ" },
  "publisher": { "@type": "Organization", "name": "SidelineIQ" }
}
```

---

### 3. Admin Page (`app/admin/page.tsx`)

**Protection:** Check `Authorization: Bearer ${ADMIN_SECRET}` header, or implement HTTP basic auth via middleware. Simple is correct — this is a single-user surface.

**Layout:**
- List of all DEEP_DIVE posts (published + pending), newest first
- Each row: player name, sport badge, published date, MD review status badge (Pending / Approved / Flagged)
- Expand to read full `body`
- `MDReviewForm`: textarea (max 3 sentences per spec), submit button (saves as `is_approved: false`)
- Separate "Approve" button that sets `is_approved: true` and triggers ISR revalidation
- "Flag for revision" toggle

**Admin flow:**
1. Physician writes review → `POST /api/admin/review` → saves to `md_reviews` with `is_approved: false`
2. Physician reads it back, confirms → "Approve" → `POST /api/admin/approve` → sets `is_approved: true`, sets `approved_at`
3. Next ISR cycle (≤60s) → `MDReviewBlock` appears on the live post page

---

## Component Specifications

### `BreakingCard`

Visual: High contrast. Red/urgency accent left border (4px). Dark background card option.

Fields rendered:
- `BREAKING` badge (red) + sport badge
- `player_name` — large headline
- `injury_type` — subhead
- `published_at` — relative timestamp
- Truncated `body` preview (first 200 chars of "What Happened" section)
- Link to `/post/[slug]`

---

### `TrackingCard`

Visual: Amber accent. "UPDATE" framing. Slightly quieter than BREAKING.

Fields rendered:
- `TRACKING` badge (amber) + sport badge
- `player_name` + "Week N" from body title if present
- `published_at`
- Truncated body preview ("Current Signal" section)
- If `parent_post_id` is set: "See original report →" link to parent post
- Link to `/post/[slug]`

---

### `DeepDiveCard` (feed preview)

Visual: Blue accent. Longer card, more content visible. Collapsed on feed; full render on `/post/[slug]`.

Fields rendered:
- `DEEP DIVE` badge (blue) + sport badge
- `player_name` — headline
- `injury_type` — subhead
- `published_at`
- RTP probability if present (extracted from body: "RTP Probability Estimate" section)
- Truncated body preview (~300 chars)
- If `is_approved === true`: small "MD Reviewed" indicator (physician icon + "MD Reviewed")
- Link to `/post/[slug]`

---

### `ConflictFlagCard`

Visual: Coral/red accent. 🚩 emoji prominent. Most visually distinctive card type.

Fields rendered:
- 🚩 `OTM CONFLICT FLAG` header in large type
- `player_name` + `sport` badge
- Gap display block:
  ```
  Team timeline:    [team_timeline_weeks] weeks
  OTM estimate:     [extracted from body]
  Discrepancy:      >2 weeks — conflict threshold met
  ```
- `conflict_reason` — 1–2 sentence excerpt
- `published_at`
- Link to `/post/[slug]`

---

### `MDReviewBlock` (sub-component, DEEP_DIVE post page only)

Renders only when `is_approved === true`.

Visual specification:
- Full-width horizontal rule above (styled, not `<hr>`)
- Warm left-border accent (amber or warm gold — distinct from the clinical blue of OTM content above)
- "MD REVIEW" label in small caps / all-caps tracking
- `reviewer_note` text (1–3 sentences)
- Byline: "Keith Kenter, MD · Physician Founder" with small OrthoIQ wordmark/link
- Full-width horizontal rule below
- Background: slightly warm tint (off-white / very light amber in light mode; slightly warm dark in dark mode)

The visual break must be unmistakable — a reader scrolling through should immediately understand that what follows the rule is from a different voice than the AI analysis above it.

---

### `ConflictGapDisplay` (sub-component)

Renders within CONFLICT_FLAG cards and DEEP_DIVE posts when `conflict_reason` is present.

```
┌─────────────────────────────────────────┐
│ 🚩 OTM — Off The Mark                  │
│                                         │
│ Team timeline     2 weeks               │
│ OTM clinical      6–8 weeks             │
│ Gap               4–6 weeks             │
│                                         │
│ [conflict_reason text]                  │
└─────────────────────────────────────────┘
```

Gap calculation: derive from `team_timeline_weeks` and OTM estimate extracted from body.
Display as a styled card with coral/red border.

---

### `OrthoIQCTA` (sub-component, bottom of all DEEP_DIVE post pages)

Visual: Clean separator section. Not intrusive.

Content:
```
Have a musculoskeletal injury or question?

OrthoIQ brings the same clinical intelligence to your situation.
Consult with AI trained on orthopedic expertise — built by the
same physician behind SidelineIQ.

[Get Clinical Guidance →]   →  links to OrthoIQ
```

The physician founder connection is visible here — "built by the same physician behind SidelineIQ" — without making it the headline.

---

### `OTMSignature` (shared, bottom of all cards)

Rendered from the OTM_SIGNATURE_BLOCK section in post body, or as a hardcoded fallback:

```
OrthoTriage Master | SidelineIQ
Clinical intelligence for the sports world.
Not medical advice.
```

Small, muted. Links to `/about` or homepage.

---

## Markdown Rendering Notes

Use `react-markdown` with `remark-gfm` for all body content.

**Custom component overrides needed:**
- `table` → styled with Tailwind (the injury classification table in DEEP_DIVE)
- `hr` → styled divider (appears before CONFLICT_FLAG block when embedded in DEEP_DIVE)
- `h1`, `h2`, `h3` → size/weight mapping to design system
- `strong` → preserve bold for field labels in classification blocks

**Do not** attempt to parse the body markdown to extract sections (RTP estimate, conflict block, etc.) using regex on the feed cards — extract only what is available as a structured field in the database (`conflict_reason`, `team_timeline_weeks`, `player_name`, `injury_type`). Display truncated body preview as plain text.

---

## SEO Infrastructure

### `sitemap.xml` (`app/sitemap.ts`)
```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts(); // fetch all slugs
  return posts.map(post => ({
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/post/${post.slug}`,
    lastModified: post.approved_at ?? post.published_at,
    changeFrequency: 'daily',
    priority: post.content_type === 'DEEP_DIVE' ? 1.0 : 0.8,
  }));
}
```

### IndexNow on publish
When the sidelineiq-agents backend publishes a new post, it should ping:
`https://api.indexnow.org/IndexNow?url=https://sidelineiq.com/post/[slug]&key=[INDEXNOW_KEY]`

This can be added to the Railway backend's publish pipeline — note for that service.

### Target query patterns for DEEP_DIVE post titles and meta:
- `[player name] injury update`
- `[player name] return to play timeline`
- `[player name] injury how long out`
- `[player name] [injury type] recovery`

---

## Branding Notes

SidelineIQ is visually independent from OrthoIQ. No shared design tokens, no OrthoIQ header/footer chrome.

Design direction: **clinical sports intelligence** — not a sports blog, not a medical journal. Think:
- Dark/near-dark default palette (sports media convention)
- Strong typographic hierarchy
- Sport badges use team-sport color conventions (not OrthoIQ's palette)
- The 🚩 emoji is a recurring brand signal — it should be visually prominent in `ConflictFlagCard`
- "OrthoTriage Master" and "OTM" are the AI voice — never "Claude" or "AI"

OrthoIQ connection:
- Visible only in the `OrthoIQCTA` block at the bottom of DEEP_DIVE post pages
- The `MDReviewBlock` byline references "Physician Founder" with OrthoIQ link
- No OrthoIQ branding in header, nav, or feed

---

## Build Order for This Session

1. **Schema verification** — confirm all columns exist, run `md_reviews` migration
2. **Next.js scaffold** — `npx create-next-app@latest sidelineiq-frontend --typescript --tailwind --app`
3. **Install dependencies** — `shadcn/ui init`, `react-markdown`, `remark-gfm`, `date-fns`
4. **`lib/types.ts`** — all TypeScript types
5. **`lib/api.ts`** — typed fetch helpers for all Railway API calls
6. **API routes** — proxy routes in `app/api/`
7. **Shared components** — `SportBadge`, `ContentTypeBadge`, `OTMSignature`
8. **Four card components** — `BreakingCard`, `TrackingCard`, `DeepDiveCard`, `ConflictFlagCard`
9. **`FilterBar` + `PostFeed`** — feed orchestration
10. **Feed page (`app/page.tsx`)** — wired up with ISR
11. **Post page (`app/post/[slug]/page.tsx`)** — full render with `MDReviewBlock`, `OrthoIQCTA`, SEO metadata
12. **`ConflictGapDisplay`** — standalone sub-component
13. **Admin page** — `ReviewQueue` + `MDReviewForm` + approve flow
14. **`sitemap.ts`** + `robots.ts`
15. **JSON-LD** on post pages
16. **Vercel deployment** — connect repo, set env vars, verify ISR behavior

---

## Key Clinical Conventions to Preserve in UI

These are locked decisions from the OTM SKILL.md — the UI must not contradict them:

- Numeric RTP probability estimates appear **only on DEEP_DIVE** content (T1/T2 evidence tier)
- CONCUSSION and SYSTEMIC events: the body will say "OTM does not generate RTP probability estimates for this event" — render this text faithfully, do not replace with a placeholder percentage
- CONFLICT_FLAG threshold: >2 weeks discrepancy. The gap display should say "conflict threshold met" not just show the numbers
- MD Review block: maximum 3 sentences per spec. The `MDReviewForm` textarea should enforce this with a soft warning (not a hard character limit)
- `parent_post_id` is not yet sent by the pipeline — the TRACKING card's "See original report →" link should render only when `parent_post_id` is non-null. Do not show a broken link.
