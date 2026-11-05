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
  return (
    <section aria-label="Your driver" className="card flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <span className="disp flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--you)] text-[19px] leading-none text-[var(--you-ink)]">
          {info?.number ?? code}
        </span>
        <span className="min-w-0">
          <span className="disp block truncate text-[18px] leading-none">{info?.name ?? code}</span>
          <span className="block truncate text-[13px] text-[var(--muted)]">
            {car?.team} · {code}
          </span>
          {info && (
            <span className="block text-[13px] font-semibold text-[var(--you)]">
              {TIER_LABEL[info.tier]}
            </span>
          )}
        </span>
      </header>
      {eng && mood && (
        <div className="flex flex-col gap-1.5" aria-label={`${code}'s mood`}>
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Trust in the wall</span>
            <span className="text-[13px] font-bold" style={{ color: moodColor }}>
              <MoodLight color={MOOD_LABEL[mood].color} /> {MOOD_LABEL[mood].text}
            </span>
          </div>
          {(() => {
            const changes = notes.filter(
              (n) => n.kind === 'trust' && n.lap === race.lap && (n.value ?? 0) !== 0,
            );
            return changes.length ? (
              <div
                key={race.lap}
                className="trust-pop flex flex-wrap gap-1.5 text-[12px] font-bold"
              >
                {changes.map((n, i) => {
                  const v = Math.round(n.value ?? 0);
                  return (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a lap's changes, in order.
                      key={i}
                      className="rounded-full px-2 py-0.5"
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
            ) : null;
          })()}
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--card-2)]"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(eng.trust)}
            aria-label="Trust"
          >
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${eng.trust}%`, background: moodColor }}
            />
          </div>
          {(eng.damage > 0 || eng.strikes > 0 || eng.penalty > 0) && (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
              {eng.damage > 0 && (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--box)_18%,transparent)] px-2 py-0.5 text-[var(--box-ink)]">
                  Front wing damage · +{eng.damage.toFixed(1)}s/lap
                </span>
              )}
              {eng.strikes > 0 && (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--flag)_18%,transparent)] px-2 py-0.5 text-[var(--flag)]">
                  Track limits · {eng.strikes}
                </span>
              )}
              {eng.penalty > 0 && (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--box)_18%,transparent)] px-2 py-0.5 text-[var(--box-ink)]">
                  +{eng.penalty}s penalty
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <dl className="m-0 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="eyebrow">Place</dt>
          <dd className="m-0 disp text-[16px] leading-none">{car?.retired ? 'OUT' : `P${pos}`}</dd>
        </div>
        <div>
          <dt className="eyebrow">Tyres</dt>
          <dd className="m-0 flex justify-center pt-0.5">
            {car && !car.retired ? <TyreBadge compound={car.compound} age={car.tyreAge} /> : '-'}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Stops</dt>
          <dd className="m-0 disp text-[16px] leading-none">{stops.length}</dd>
        </div>
        <div>
          <dt className="eyebrow">Pace</dt>
          <dd className="m-0 text-[13px] font-semibold capitalize">{car?.modes.pace ?? '-'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Battle</dt>
          <dd className="m-0 text-[13px] font-semibold capitalize">{car?.modes.battle ?? '-'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Real</dt>
          <dd className="m-0 text-[13px] font-semibold">{realPos ? `P${realPos}` : '-'}</dd>
        </div>
      </dl>
    </section>
  );
}
