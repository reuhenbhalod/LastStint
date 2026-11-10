// Your driver, in the stats column: who they are, their attitude (data/drivers.json), how
// they feel about the wall right now (trust, race engineer spec D4), any damage or track-limit
// trouble, and where they stand: place, tyres, stops, headset modes.

import {
  type RaceModel,
  type RaceNote,
  type RaceState,
  engineerConfig,
  moodOf,
} from '@boxthislap/sim';
import { TIER_LABEL, driverInfo } from '../data/drivers.js';
import { MOOD_LABEL } from '../game/engineerCalls.js';
import type { LapEvents } from '../game/raceLog.js';
import { MoodLight } from './Icons.js';
import { Bar, Stat, Stats } from './Panel.js';
import { TyreBadge } from './TyreBadge.js';

/** Why his trust moved, in a few words (battles and trust spec: the change shows). */
const TRUST_WHY: Record<string, string> = {
  'pass-called': 'pass you called',
  'pass-failed': 'move that failed',
  'held-called': 'held him off',
  'passed-anyway': 'passed anyway',
  'let-rival-go': 'told to let the rival go',
  contact: 'contact',
  undercut: 'undercut worked',
  'stop-lost': 'stop lost places',
  micromanaging: 'too many orders',
  'request-yes': 'you listened',
  'request-wrong': 'he was right',
  'request-right': 'you were right',
  penalty: 'penalty',
  strike: 'track limits',
  'let-car-go': 'let a car go',
  settled: 'settled down',
};

export function DriverProfile({
  code,
  race,
  model,
  log,
  notes = [],
}: {
  code: string;
  race: RaceState;
  model: RaceModel;
  log: LapEvents[];
  /** The race model's notes (the last lap's trust changes show as chips). */
  notes?: RaceNote[];
}) {
  const car = race.cars[code];
  const info = driverInfo(code);
  const pos = race.order.indexOf(code) + 1;
  const stops = log.flatMap((l) => l.pits.filter((p) => p.code === code));
  const realPos = model.realResult.indexOf(code) + 1;
  const eng = race.engineer;
  const cfg = engineerConfig(model);
  const mood = eng && cfg ? moodOf(cfg, eng.trust) : null;
  const moodColor =
    mood === 'calm' ? 'var(--good)' : mood === 'tense' ? 'var(--flag)' : 'var(--box)';
  const changes = notes.filter(
    (n) => n.kind === 'trust' && n.lap === race.lap && (n.value ?? 0) !== 0,
  );
  return (
    <section
      aria-label="Your driver"
      className="flex shrink-0 flex-col gap-3 overflow-hidden rounded-xl border border-[var(--glass-edge)] bg-[var(--glass)] backdrop-blur-[14px]"
    >
      {/* The name plate, as the TV shows a driver: number on the team colour, then the name. */}
      <header className="flex items-stretch">
        <span className="disp ml-3 mt-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--you)] text-[20px] leading-none text-[var(--you-ink)]">
          {info?.number ?? code}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5">
          <span className="disp truncate text-[17px] leading-none">{info?.name ?? code}</span>
          <span className="truncate text-[12px] text-[#9AA5A0]">
            {car?.team}
            {info && (
              <span className="font-semibold text-[var(--you)]"> · {TIER_LABEL[info.tier]}</span>
            )}
          </span>
        </span>
      </header>
      <div className="flex flex-col gap-3 px-3.5 pb-3.5">
        {eng && mood && (
          <div className="flex flex-col gap-1.5" aria-label={`${code}'s mood`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
                Trust in the wall
              </span>
              <span
                className="flex items-center gap-1 text-[12px] font-bold"
                style={{ color: moodColor }}
              >
                <MoodLight color={MOOD_LABEL[mood].color} /> {MOOD_LABEL[mood].text}
              </span>
            </div>
            <Bar value={eng.trust / 100} color={moodColor} label="Trust" />
            {changes.length > 0 && (
              <div
                key={race.lap}
                className="trust-pop flex flex-wrap gap-1.5 text-[11px] font-bold"
              >
                {changes.map((n, i) => {
                  const v = Math.round(n.value ?? 0);
                  return (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a lap's changes, in order.
                      key={i}
                      className="px-1.5 py-0.5"
                      style={{
                        background: v > 0 ? 'var(--good)' : 'var(--box)',
                        color: v > 0 ? 'var(--good-ink)' : '#ffffff',
                      }}
                    >
                      {v > 0 ? `+${v}` : `−${-v}`} {TRUST_WHY[n.detail ?? ''] ?? n.detail}
                    </span>
                  );
                })}
              </div>
            )}
            {(eng.damage > 0 || eng.strikes > 0 || eng.penalty > 0) && (
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                {eng.damage > 0 && (
                  <span className="bg-[color-mix(in_srgb,var(--box)_18%,transparent)] px-1.5 py-0.5 text-[var(--box-ink)]">
                    Front wing damage · +{eng.damage.toFixed(1)}s/lap
                  </span>
                )}
                {eng.strikes > 0 && (
                  <span className="bg-[color-mix(in_srgb,var(--flag)_18%,transparent)] px-1.5 py-0.5 text-[var(--flag)]">
                    Track limits · {eng.strikes}
                  </span>
                )}
                {eng.penalty > 0 && (
                  <span className="bg-[color-mix(in_srgb,var(--box)_18%,transparent)] px-1.5 py-0.5 text-[var(--box-ink)]">
                    +{eng.penalty}s penalty
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        <Stats>
          <Stat label="Place">{car?.retired ? 'OUT' : `P${pos}`}</Stat>
          <Stat label="Tyres">
            {car && !car.retired ? <TyreBadge compound={car.compound} age={car.tyreAge} /> : '-'}
          </Stat>
          <Stat label="Stops">{stops.length}</Stat>
          <Stat label="Pace">{car?.modes.pace ?? '-'}</Stat>
          <Stat label="Battle">{car?.modes.battle ?? '-'}</Stat>
          <Stat label="Real">{realPos ? `P${realPos}` : '-'}</Stat>
        </Stats>
      </div>
    </section>
  );
}
