/**
 * The ParatrOs mark: two clinical brackets holding a single reading.
 *
 * A thin React wrapper — the geometry, the size ramp and the 16px bone-bar rule
 * all live in lib/mark-geometry.ts, so the icon generator and the OG cards draw
 * the same shape from the same numbers.
 */
import {
  markBarColor,
  markBracketColor,
  markRects,
  markWeightFor,
  type MarkTone,
} from '@/lib/mark-geometry';

export function Mark({
  size = 64,
  tone = 'color',
  className,
}: {
  size?: number;
  tone?: MarkTone;
  className?: string;
}) {
  const rects = markRects(markWeightFor(size), markBracketColor(tone), markBarColor(size, tone));
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="ParatrOs"
      className={className}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} fill={r.fill} />
      ))}
    </svg>
  );
}
