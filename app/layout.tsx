import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { siteUrl } from '@/lib/site-url';
import { SiteAnalytics } from '@/components/SiteAnalytics';
import { BRAND_NAME } from '@/lib/brand';

// The kit's pair. Archivo is a variable font, so one file covers the 400-800
// range it asks for; IBM Plex Mono is static and needs its weights named.
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  // Absolute base for the generated og:image / twitter:image URLs.
  metadataBase: new URL(siteUrl()),
  title: `${BRAND_NAME} — Clinical Sports Injury Intelligence`,
  description:
    'Autonomous AI-powered sports injury analysis with return-to-play timelines, clinical breakdowns, and conflict detection across NFL, NBA, Premier League, and UFC.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased dark`}
    >
      {/* bg-background/text-foreground, not bg-slate-950/text-bone: the
          hardcoded pair overrode `@layer base { body { @apply bg-background
          text-foreground } }`, so globals.css's tokens governed nothing. */}
      <body className="min-h-full bg-background text-foreground flex flex-col">
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
