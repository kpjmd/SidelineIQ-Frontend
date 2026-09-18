# Vendored fonts

These three files exist for ONE reason: `next/og` (satori) cannot read a font
from `next/font/google`. It needs a buffer, so a card rendered without an
explicit `fonts` array falls back to satori's bundled default — which is how
every ParatrOs OG image was rendered off-brand until now.

The rest of the site loads Archivo and IBM Plex Mono through `next/font/google`
in `app/layout.tsx`. Do not add a fourth file to serve the site; only the image
routes read these.

| File | Family | Weight | Used for |
|---|---|---|---|
| `Archivo-Bold.ttf` | Archivo | 700 | headlines, the wordmark's `Paratr` |
| `Archivo-Medium.ttf` | Archivo | 500 | the wordmark's `Os` — one weight lighter, per the kit |
| `IBMPlexMono-Regular.ttf` | IBM Plex Mono | 400 | eyebrow, stat labels, footer |

Fetched 2026-09-17 from the Google Fonts css2 API (resolved URL, not a guessed
axis suffix — the guessed one returned an HTML error page that `file` reported as
"HTML document text"). Declared `usWeightClass` verified as 700 / 500 / 400.

## Licence

Both families are licensed under the SIL Open Font License 1.1, reproduced in
`OFL.txt`. Archivo: Omnibus-Type. IBM Plex Mono: IBM Corp. The OFL permits
bundling and redistribution; it requires the licence travel with the fonts, which
is what this directory does.
