// The chequered flag moment, as a TV graphic: a chequered band, your finishing place big beside
// the verdict ("You beat Mercedes!"), the three numbers that decide it (you, the real pit wall,
// the rival) and the podium in team colours. Toned by the outcome: the good colour when you
// beat the real team, white when you matched it, red when it did better.

import { surname } from '../data/names.js';
import type { Verdict } from '../game/verdict.js';
import { Stat, Stats } from './Panel.js';

const TONE: Record<Verdict['outcome'], { color: string; word: string }> = {
  beat: { color: 'var(--good)', word: 'Better than the real team' },
  matched: { color: '#EEF1EE', word: 'Level with the real team' },
  worse: { color: 'var(--box-ink)', word: 'Behind the real team' },
};

function Chequer() {
  return (
    <div
      aria-hidden="true"
      className="h-2.5 w-full opacity-90"
      style={{
        backgroundImage:
          'conic-gradient(#EEF1EE 25%, transparent 0 50%, #EEF1EE 0 75%, transparent 0)',
        backgroundSize: '10px 10px',
      }}
    />
  );
}

export function ResultHero({
  v,
  raceName,
  userSide,
  rival,
  pos,
  dsq = false,
  realPos,
  rivalPos,
  team,
  gapToRival,
  podium,
  teamOf,
}: {
  v: Verdict;
  raceName: string;
  userSide: string;
  rival: string;
  pos: number;
  /** Disqualified (two-compound rule): shown as DSQ, not OUT. */
  dsq?: boolean;
  realPos: number;
  rivalPos: number;
  team: string;
  /** Seconds you finished ahead of the rival (< 0: behind), if both finished. */
  gapToRival: number | null;
  podium: string[];
  /** A driver's team colour (the podium). */
  teamOf?: (code: string) => string;
}) {
  const tone = TONE[v.outcome];
  const place = pos > 0 ? `P${pos}` : dsq ? 'DSQ' : 'OUT';
  return (
    <section
      aria-label="Result"
      className="glass-strong overflow-hidden"
      style={{ borderTop: `3px solid ${tone.color}` }}
    >
      <Chequer />
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-5">
          <span
            className="disp wide shrink-0 text-[56px] leading-[0.85] sm:text-[76px]"
            style={{ color: tone.color }}
          >
            {place}
          </span>
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9AA5A0]">
              Chequered flag · {raceName.split(':')[0]}
            </span>
            <h1 className="disp m-0 text-balance text-[26px] leading-[1.05]">{v.headline}</h1>
            <span className="text-[13px] font-semibold" style={{ color: tone.color }}>
              {surname(userSide)} · {tone.word}
            </span>
          </span>
        </div>
        <Stats>
          <Stat label="You" tone={tone.color}>
            <span className="text-[24px]">{place}</span>
          </Stat>
          <Stat label={`Real ${team}`}>
            <span className="text-[24px]">{realPos > 0 ? `P${realPos}` : '-'}</span>
          </Stat>
          <Stat label={surname(rival)} tone="var(--rival)">
            <span className="flex flex-col gap-1">
              <span className="text-[24px]">{rivalPos > 0 ? `P${rivalPos}` : 'OUT'}</span>
              {gapToRival !== null && (
                <span className="mono text-[11px] font-semibold normal-case text-[#9AA5A0]">
                  {gapToRival >= 0
                    ? `you +${gapToRival.toFixed(1)}s ahead`
                    : `${(-gapToRival).toFixed(1)}s ahead of you`}
                </span>
              )}
            </span>
          </Stat>
        </Stats>
        {podium.length > 0 && (
          <ol className="m-0 flex list-none items-end justify-center gap-1.5 border-t border-[#252D31] p-0 pt-4">
            {[1, 0, 2].map((i) => {
              const code = podium[i];
              if (!code) return null;
              const mine = code === userSide;
              const theirs = code === rival;
              return (
                <li key={code} className="flex w-[84px] flex-col items-center gap-1.5">
                  <span
                    className="disp text-[15px] leading-none"
                    style={{ color: mine ? 'var(--you)' : theirs ? 'var(--rival)' : undefined }}
                  >
                    {code}
                  </span>
                  <span
                    className={`disp flex w-full items-start justify-center bg-[#1A2124] pt-2 text-[18px] leading-none text-[#9AA5A0] ${i === 0 ? 'h-[72px]' : i === 1 ? 'h-[52px]' : 'h-[38px]'}`}
                    style={{ borderTop: `3px solid ${teamOf?.(code) ?? '#3B454A'}` }}
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
