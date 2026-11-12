// A race's circuit drawn on its real ground (track/ground.ts), at full brightness and true to
// its shape: the Eras race intro's picture of where the race is run. Nothing if the race has
// no outline; the plain map colour under the track if it has no ground image.

import { useMemo } from 'react';
import { groundFor } from '../track/ground.js';
import { outlineFor } from '../track/outlines.js';

export function CircuitCard({ raceId, className = '' }: { raceId: string; className?: string }) {
  const outline = outlineFor(raceId);
  const ground = useMemo(() => groundFor(raceId), [raceId]);
  if (!outline) return null;
  const d = `M${outline.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
  const pad = 70;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${outline.width + 2 * pad} ${outline.height + 2 * pad}`}
      className={`block h-auto w-full ${className}`}
      style={{ background: ground?.base ?? 'var(--ground)' }}
      aria-hidden="true"
    >
      {ground && (
        <image
          href={ground.src}
          x={0}
          y={0}
          width={ground.w}
          height={ground.h}
          preserveAspectRatio="none"
          transform={`matrix(${ground.matrix.join(' ')})`}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={20}
        strokeLinejoin="round"
        transform="translate(2 3)"
      />
      <path d={d} fill="none" stroke="var(--track-line)" strokeWidth={18} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--tarmac-lane)" strokeWidth={15} strokeLinejoin="round" />
    </svg>
  );
}
