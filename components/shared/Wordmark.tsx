/**
 * The ParatrOs wordmark: "Paratr" in Archivo 700 bone, "Os" one weight lighter
 * (500) in Signal Cyan. From the kit — "weight and hue do the work, so the unit
 * still reads as one word at 14px".
 *
 * It SPLITS BRAND_NAME rather than hardcoding the halves, so the name has
 * exactly one source of truth (lib/brand.ts, mirrored in the agents repo). If
 * the brand were ever renamed again, this degrades to plain text rather than
 * rendering a stale "Paratr".
 *
 * Tracking opens up as the mark shrinks: -0.035em at display sizes, -0.02em at
 * 14-17px. The kit is explicit that the Os is never set in small caps or a
 * second typeface, and that where colour is unavailable, opacity substitutes.
 */
import { BRAND_NAME } from '@/lib/brand';

const OS_SUFFIX = 'Os';

export type WordmarkTone = 'color' | 'mono-bone' | 'mono-navy';

export function Wordmark({
  className = 'text-xl',
  tone = 'color',
}: {
  className?: string;
  tone?: WordmarkTone;
}) {
  const endsWithOs = BRAND_NAME.endsWith(OS_SUFFIX);
  const stem = endsWithOs ? BRAND_NAME.slice(0, -OS_SUFFIX.length) : BRAND_NAME;
  const tail = endsWithOs ? OS_SUFFIX : '';

  const stemColor = tone === 'mono-navy' ? 'text-panel' : 'text-bone';
  // Opacity, not a second hue, is the kit's substitute on a single-colour ground.
  const tailClass =
    tone === 'color'
      ? 'font-medium text-signal-cyan'
      : `font-medium ${stemColor} opacity-55`;

  return (
    <span
      className={`inline-flex items-baseline font-bold tracking-[-0.03em] ${stemColor} ${className}`}
    >
      <span>{stem}</span>
      {tail ? <span className={tailClass}>{tail}</span> : null}
    </span>
  );
}
