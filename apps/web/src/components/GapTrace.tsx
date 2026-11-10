// Gap to the rival over the laps seen so far, as a TV graphic: above the line (our colour)
// we're ahead, below (theirs) they are. A small SVG so the trend reads at a glance.

import { surname } from '../data/names.js';

export function GapTrace({ points, rival }: { points: Array<[number, number]>; rival: string }) {
  if (points.length < 2) return null;
  const W = 320;
  const H = 72;
  const laps = points.map(([l]) => l);
  const gaps = points.map(([, g]) => g);
  const lo = Math.min(...laps);
  const hi = Math.max(...laps);
  const m = Math.max(1, ...gaps.map(Math.abs));
  const x = (l: number) => ((l - lo) / Math.max(1, hi - lo)) * (W - 12) + 4;
  const y = (g: number) => H / 2 - (g / m) * (H / 2 - 6);
  const line = points
    .map(([l, g], i) => `${i ? 'L' : 'M'}${x(l).toFixed(1)},${y(g).toFixed(1)}`)
    .join('');
  const area = `${line}L${x(hi).toFixed(1)},${H / 2}L${x(lo).toFixed(1)},${H / 2}Z`;
  const last = gaps.at(-1) ?? 0;
  const id = `gap-${rival}`;
  return (
    <figure className="m-0 flex flex-col gap-1" aria-label={`Gap to ${rival} over the last laps`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full" role="img">
        <title>{`Gap to ${surname(rival)}: ${last >= 0 ? '+' : ''}${last.toFixed(1)}s`}</title>
        <defs>
          <clipPath id={`${id}-up`}>
            <rect x="0" y="0" width={W} height={H / 2} />
          </clipPath>
          <clipPath id={`${id}-down`}>
            <rect x="0" y={H / 2} width={W} height={H / 2} />
          </clipPath>
        </defs>
        <path d={area} clipPath={`url(#${id}-up)`} style={{ fill: 'var(--you)', opacity: 0.18 }} />
        <path
          d={area}
          clipPath={`url(#${id}-down)`}
          style={{ fill: 'var(--rival)', opacity: 0.18 }}
        />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#3B454A" strokeDasharray="2 3" />
        <path
          d={line}
          fill="none"
          clipPath={`url(#${id}-up)`}
          style={{ stroke: 'var(--you)' }}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={line}
          fill="none"
          clipPath={`url(#${id}-down)`}
          style={{ stroke: 'var(--rival)' }}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle
          cx={x(hi)}
          cy={y(last)}
          r="3.5"
          style={{ fill: last >= 0 ? 'var(--you)' : 'var(--rival)' }}
          stroke="#12171A"
          strokeWidth="1.5"
        />
      </svg>
      <figcaption className="mono flex justify-between text-[10px] text-[#9AA5A0]">
        <span>L{lo}</span>
        <span>above: you lead · below: {surname(rival)} leads</span>
        <span>L{hi}</span>
      </figcaption>
    </figure>
  );
}
