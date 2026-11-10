// The race's circuit on its real ground, dimmed behind a page (realistic UI spec): the result,
// versus and the gauntlet sit over the place the race was run. Fixed to the window, under
// everything, and hidden from assistive tech.

import { useMemo } from 'react';
import { groundFor } from '../track/ground.js';
import { outlineFor } from '../track/outlines.js';

export function GroundBackdrop({ raceId, dim = 0.32 }: { raceId: string; dim?: number }) {
  const outline = outlineFor(raceId);
  const ground = useMemo(() => groundFor(raceId), [raceId]);
  if (!outline) return null;
  const d = `M${outline.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <svg
        viewBox={`-60 -60 ${outline.width + 120} ${outline.height + 120}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden="true"
        style={{
          background: ground?.base ?? 'var(--ground)',
          filter: `brightness(${dim}) saturate(0.65)`,
        }}
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
          stroke="var(--track-line)"
          strokeWidth={24}
          strokeLinejoin="round"
        />
        <path
          d={d}
          fill="none"
          stroke="var(--tarmac-lane)"
          strokeWidth={21}
          strokeLinejoin="round"
        />
      </svg>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, transparent 40%, var(--paper) 100%)' }}
      />
    </div>
  );
}
