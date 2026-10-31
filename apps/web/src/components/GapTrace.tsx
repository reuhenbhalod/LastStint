// Gap to the rival over the laps seen so far (above the line: we're ahead). A small SVG so
// the trend reads at a glance.

export function GapTrace({ points, rival }: { points: Array<[number, number]>; rival: string }) {
  if (points.length < 2) return null;
  const W = 320;
  const H = 56;
  const laps = points.map(([l]) => l);
  const gaps = points.map(([, g]) => g);
  const lo = Math.min(...laps);
  const hi = Math.max(...laps);
  const m = Math.max(1, ...gaps.map(Math.abs));
  const x = (l: number) => ((l - lo) / Math.max(1, hi - lo)) * (W - 8) + 4;
  const y = (g: number) => H / 2 - (g / m) * (H / 2 - 4);
  const path = points
    .map(([l, g], i) => `${i ? 'L' : 'M'}${x(l).toFixed(1)},${y(g).toFixed(1)}`)
    .join('');
  const last = gaps.at(-1) ?? 0;
  return (
    <figure className="flex flex-col gap-1" aria-label={`Gap to ${rival} over the last laps`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img">
        <title>{`Gap to ${rival}: ${last >= 0 ? '+' : ''}${last.toFixed(1)}s`}</title>
        <line
          x1="0"
          x2={W}
          y1={H / 2}
          y2={H / 2}
          className="stroke-[var(--rule)]"
          strokeDasharray="3 3"
        />
        <path
          d={path}
          fill="none"
          className={last >= 0 ? 'stroke-[var(--you)]' : 'stroke-[var(--rival)]'}
          strokeWidth="2"
        />
      </svg>
      <figcaption className="flex justify-between font-mono text-[10px] text-[var(--muted)]">
        <span>lap {lo}</span>
        <span>gap to {rival} · above the line: ahead</span>
        <span>lap {hi}</span>
      </figcaption>
    </figure>
  );
}
