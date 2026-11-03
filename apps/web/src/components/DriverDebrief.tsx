// The driver after the flag (race engineer spec D6): how he feels about the wall, what he says
// on the cool-down lap, the best and worst calls in his eyes, and the battles in numbers.

import {
  type RaceModel,
  type RaceNote,
  type RaceState,
  type TrustReason,
  engineerConfig,
  moodOf,
} from '@boxthislap/sim';
import { MOOD_LABEL } from '../game/engineerCalls.js';
import { postRaceRadio } from '../game/engineerRadio.js';
import { MoodLight } from './Icons.js';

const REASON: Partial<Record<TrustReason, string>> = {
  'pass-called': 'The attack you called worked',
  'pass-failed': 'An attack that went nowhere',
  'held-called': 'The defence you called held',
  'passed-anyway': 'A defence that didn’t hold',
  'let-rival-go': 'Letting the rival through',
  'let-car-go': 'Waving a car through',
  contact: 'A move that ended in contact',
  undercut: 'The stop that got him ahead',
  'stop-lost': 'The stop that dropped him behind',
  micromanaging: 'Too many orders at once',
  'request-yes': 'Saying yes when he asked',
  'request-wrong': 'Saying no when he was right',
  'request-right': 'Saying no, and being right',
  penalty: 'The track-limits penalty',
};

export function DriverDebrief({
  race,
  model,
  notes,
  won,
}: {
  race: RaceState;
  model: RaceModel;
  notes: RaceNote[];
  won: boolean;
}) {
  const eng = race.engineer;
  const cfg = engineerConfig(model);
  if (!eng || !cfg) return null;
  const side = model.userSide;
  const mood = moodOf(cfg, eng.trust);
  const mine = notes.filter((n) => n.driver === side);
  const trust = mine.filter(
    (n) => n.kind === 'trust' && n.detail !== 'settled' && REASON[n.detail as TrustReason],
  );
  const best = trust.reduce<RaceNote | null>(
    (b, n) => ((n.value ?? 0) > (b?.value ?? 0) ? n : b),
    null,
  );
  const worst = trust.reduce<RaceNote | null>(
    (w, n) => ((n.value ?? 0) < (w?.value ?? 0) ? n : w),
    null,
  );
  const battles = mine.filter((n) => n.kind === 'battle');
  const won_ = battles.filter((n) => n.detail === 'passed' || n.detail === 'held').length;
  const contact = mine.filter((n) => n.kind === 'contact').length;
  const color = mood === 'calm' ? 'var(--you)' : mood === 'tense' ? 'var(--flag)' : 'var(--box)';
  return (
    <section aria-label="Your driver" className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{side} after the flag</span>
        <span className="text-[14px] font-bold" style={{ color }}>
          <MoodLight color={MOOD_LABEL[mood].color} /> {MOOD_LABEL[mood].text} ·{' '}
          {Math.round(eng.trust)}% trust
        </span>
      </div>
      <blockquote className="m-0 border-l-2 pl-3 text-[15px] italic" style={{ borderColor: color }}>
        “{postRaceRadio(mood, won, side)}”
      </blockquote>
      {(best || worst) && (
        <dl className="m-0 grid gap-1.5 text-[13px]">
          {best && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">Best call · lap {best.lap}</dt>
              <dd className="m-0 text-right font-semibold text-[var(--you)]">
                {REASON[best.detail as TrustReason]}
              </dd>
            </div>
          )}
          {worst && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">Worst call · lap {worst.lap}</dt>
              <dd className="m-0 text-right font-semibold text-[var(--box-ink)]">
                {REASON[worst.detail as TrustReason]}
              </dd>
            </div>
          )}
        </dl>
      )}
      <p className="m-0 text-[13px] text-[var(--muted)]">
        {battles.length
          ? `${battles.length} battle lap${battles.length === 1 ? '' : 's'}, ${won_} won`
          : 'No wheel-to-wheel battles'}
        {contact ? ` · ${contact} contact` : ''}
        {eng.penalty ? ` · ${eng.penalty} s track-limits penalty` : ''}
      </p>
    </section>
  );
}
