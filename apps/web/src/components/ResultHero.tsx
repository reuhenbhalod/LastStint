// The chequered flag moment: how your race ended against the real team's. A chequered band,
// your finishing place big, the verdict ("You beat Mercedes!"), then the three numbers that
// decide it side by side (you, the real pit wall, the rival) and the podium. Coloured by the
// outcome: teal when you beat the real team, white when you matched it, red when it did better.

import type { Verdict } from '../game/verdict.js';

const TONE: Record<Verdict['outcome'], { text: string; ring: string; glow: string; word: string }> =
  {
    beat: {
      text: 'text-[var(--you)]',
      ring: 'border-[var(--you)]',
      glow: 'shadow-[0_0_80px_-20px_var(--you)]',
      word: 'Better than the real team',
    },
    matched: {
      text: 'text-[var(--ink)]',
      ring: 'border-[var(--rule)]',
      glow: '',
      word: 'Level with the real team',
    },
    worse: {
      text: 'text-[var(--box)]',
      ring: 'border-[var(--box)]',
      glow: 'shadow-[0_0_80px_-30px_var(--box)]',
      word: 'Behind the real team',
    },
  };

function Chequer() {
  return (
    <div
      aria-hidden="true"
      className="h-3 w-full opacity-80"
      style={{
        backgroundImage:
          'conic-gradient(var(--ink) 25%, transparent 0 50%, var(--ink) 0 75%, transparent 0)',
        backgroundSize: '12px 12px',
      }}
    />
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[var(--card-2)] px-2 py-3">
      <span className="eyebrow">{label}</span>
      <span className={`disp wide text-[30px] leading-none ${tone ?? ''}`}>{value}</span>
      {sub && <span className="text-[12px] text-[var(--muted)]">{sub}</span>}
    </div>
  );
}

export function ResultHero({
  v,
  raceName,
  userSide,
  rival,
  pos,
  realPos,
  rivalPos,
  team,
  gapToRival,
  podium,
}: {
  v: Verdict;
  raceName: string;
  userSide: string;
  rival: string;
  pos: number;
  realPos: number;
  rivalPos: number;
  team: string;
  /** Seconds you finished ahead of the rival (< 0: behind), if both finished. */
  gapToRival: number | null;
  podium: string[];
}) {
  const tone = TONE[v.outcome];
  return (
    <section
      className={`overflow-hidden rounded-2xl border-2 bg-[var(--card)] ${tone.ring} ${tone.glow}`}
    >
      <Chequer />
      <div className="flex flex-col items-center gap-4 px-5 pb-6 pt-5 text-center">
        <p className="eyebrow m-0">Chequered flag · {raceName.split(':')[0]}</p>
        <div className="flex flex-col items-center gap-1">
          <span className={`disp wide text-[72px] leading-[0.9] ${tone.text}`}>
            {pos > 0 ? `P${pos}` : 'OUT'}
          </span>
          <span className="disp text-[15px] leading-none text-[var(--muted)]">
            {userSide} · {tone.word}
          </span>
        </div>
        <h1 className="disp m-0 text-[30px] leading-none">{v.headline}</h1>
        <div className="grid w-full grid-cols-3 gap-2">
          <Figure label="You" value={pos > 0 ? `P${pos}` : 'OUT'} tone={tone.text} />
          <Figure label={`Real ${team}`} value={realPos > 0 ? `P${realPos}` : '-'} />
          <Figure
            label={rival}
            value={rivalPos > 0 ? `P${rivalPos}` : 'OUT'}
            sub={
              gapToRival === null
                ? undefined
                : gapToRival >= 0
                  ? `you +${gapToRival.toFixed(1)}s ahead`
                  : `${(-gapToRival).toFixed(1)}s ahead of you`
            }
            tone="text-[var(--rival)]"
          />
        </div>
        {podium.length > 0 && (
          <ol className="m-0 flex list-none items-end justify-center gap-2 p-0">
            {[1, 0, 2].map((i) => {
              const code = podium[i];
              if (!code) return null;
              const mine = code === userSide;
              const theirs = code === rival;
              return (
                <li key={code} className="flex w-20 flex-col items-center gap-1">
                  <span
                    className={`disp text-[16px] leading-none ${mine ? 'text-[var(--you)]' : theirs ? 'text-[var(--rival)]' : ''}`}
                  >
                    {code}
                  </span>
                  <span
                    className={`flex w-full items-start justify-center rounded-t-md bg-[var(--card-2)] pt-1.5 text-[15px] font-bold text-[var(--muted)] ${i === 0 ? 'h-20' : i === 1 ? 'h-14' : 'h-10'}`}
                  >
                    {i + 1}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
