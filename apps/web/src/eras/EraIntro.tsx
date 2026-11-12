// The Eras race intro (build plan 8.4; eras spec §14 screen 3), shown before an Eras race in
// place of the Daily card: the dilemma, the three stars spelled out (★3 in full), and the
// attempt's difficulty (information level, rival policy, decision timer), with Legend,
// Reconstructed and Draft marked. The sentences come from raceIntro.ts; a race whose
// objectives aren't written yet shows a marked empty slot, never invented ones. A race built
// from TUM, Jolpica or F1DB data credits them in one line (data/credits.ts), as their
// licences ask.

import type { DifficultySettings, RaceModel } from '@laststint/sim';
import { CircuitCard } from '../components/CircuitCard.js';
import { Disclaimer } from '../components/Disclaimer.js';
import { GroundBackdrop } from '../components/GroundBackdrop.js';
import { MapCredit } from '../components/MapCredit.js';
import { TopBar } from '../components/TopBar.js';
import { raceCreditText } from '../data/credits.js';
import { surname } from '../data/names.js';
import { Badge } from './EraDetail.js';
import type { EraInfo, EraRaceInfo } from './catalog.js';
import { raceName } from './catalog.js';
import {
  INFORMATION_DETAIL,
  INFORMATION_NAME,
  RIVAL_POLICY_NAME,
  type StarLine,
  isReconstructed,
  starLines,
  strategistText,
  timerText,
} from './raceIntro.js';

function Star({ line }: { line: StarLine }) {
  return (
    <li className="glass flex min-w-0 gap-3 px-3 py-2.5">
      <span aria-hidden="true" className="text-[20px] leading-none text-[var(--flag)]">
        ★{line.star}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="eyebrow">
          <span className="sr-only">Star {line.star}: </span>
          {line.name}
        </span>
        {line.text ? (
          <span className="break-words text-[15px] leading-snug">{line.text}</span>
        ) : (
          // TODO(content 6.2): the race's eras.target / eras.mastery.
          <span data-todo="objective" className="text-[14px] text-[var(--muted)]">
            Not written yet.
          </span>
        )}
      </div>
    </li>
  );
}

function Objectives({ model, difficulty }: { model: RaceModel; difficulty: DifficultySettings }) {
  const lines = starLines(model, difficulty);
  return (
    <section aria-labelledby="intro-objectives" className="flex flex-col gap-2">
      <h2 id="intro-objectives" className="eyebrow m-0">
        Objectives
      </h2>
      {lines ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {lines.map((line) => (
            <Star key={line.star} line={line} />
          ))}
        </ol>
      ) : (
        // TODO(content 6.2): the race's eras block (target, mastery).
        <div
          data-todo="objectives"
          className="flex flex-col gap-1 rounded-lg border border-dashed border-[var(--rule)] px-3 py-2.5 text-[14px]"
        >
          <p className="m-0 font-semibold">Objectives not written yet</p>
          <p className="m-0 text-[var(--muted)]">
            This race’s target and mastery objective are still to come. ★2 Strategist:{' '}
            {strategistText(difficulty.accuracyThreshold).toLowerCase()}.
          </p>
        </div>
      )}
    </section>
  );
}

function Difficulty({
  difficulty,
  legend,
  timed,
}: {
  difficulty: DifficultySettings;
  legend: boolean;
  timed: boolean;
}) {
  const rows: Array<[string, string, string?]> = [
    [
      'Information',
      INFORMATION_NAME[difficulty.information],
      INFORMATION_DETAIL[difficulty.information],
    ],
    ['Rival policy', RIVAL_POLICY_NAME[difficulty.rivalPolicy]],
    [
      'Decision timer',
      timerText(difficulty.decisionTimerSeconds, timed),
      timed ? undefined : 'Turned off in your settings: this attempt’s stars are marked untimed.',
    ],
  ];
  return (
    <section aria-labelledby="intro-difficulty" className="flex flex-col gap-2">
      <h2 id="intro-difficulty" className="eyebrow m-0">
        {legend ? 'Difficulty · Legend' : 'Difficulty'}
      </h2>
      <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rows.map(([term, value, detail]) => (
          <div key={term} className="glass min-w-0 px-3 py-2">
            <dt className="eyebrow">{term}</dt>
            <dd className="m-0 font-semibold">{value}</dd>
            {detail && (
              <dd className="m-0 text-[13px] leading-snug text-[var(--muted)]">{detail}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EraIntro({
  era,
  race,
  model,
  difficulty,
  legend,
  draft,
  timed,
  onStart,
  onHelp,
  resume,
}: {
  era: EraInfo;
  race: EraRaceInfo;
  model: RaceModel;
  /** The attempt's difficulty: the era's row, or Legend's. */
  difficulty: DifficultySettings;
  legend: boolean;
  /** Not published (test only). */
  draft: boolean;
  /** The decision timer is on (the player's accessibility setting). */
  timed: boolean;
  onStart: () => void;
  onHelp: () => void;
  /** The start button's label, when not the default. */
  resume?: string;
}) {
  const { userSide, rival } = model;
  const team = model.drivers.find((d) => d.code === userSide)?.team;
  const { takeoverLap, laps } = model.race;
  const briefing = model.eras?.briefing;
  const credit = raceCreditText(model.race.id);
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      {/* The circuit on its real ground behind the page, dimmed (realistic UI spec). */}
      <GroundBackdrop raceId={model.race.id} dim={0.3} />
      <TopBar active="eras" />
      <main className="mx-auto grid w-full min-w-0 max-w-6xl flex-1 grid-cols-1 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <a
            href={`/eras/${era.id}`}
            className="w-fit text-[13px] text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)]"
          >
            Back to the era
          </a>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="eyebrow m-0 mr-auto !text-[var(--box-ink)]">
                Era {era.id} · {era.name} · Race {race.position}
              </p>
              {legend && (
                <span className="rounded border border-[var(--box-ink)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--box-ink)]">
                  Legend
                </span>
              )}
              {isReconstructed(model) && <Badge tone="muted">Reconstructed</Badge>}
              {draft && <Badge tone="flag">Draft</Badge>}
            </div>
            <h1 className="disp wide m-0 break-words text-[40px] leading-[0.95] sm:text-[60px]">
              {raceName(race.raceId)}
            </h1>
          </div>

          <section aria-labelledby="intro-dilemma" className="flex flex-col gap-2">
            <h2 id="intro-dilemma" className="eyebrow m-0">
              The dilemma
            </h2>
            <p className="m-0 break-words text-[22px] font-semibold leading-snug">{race.dilemma}</p>
            {briefing && <p className="m-0 text-[15px]">{briefing}</p>}
            <p className="m-0 text-[15px] text-[var(--muted)]">
              You’re {surname(userSide)}’s race engineer{team ? ` at ${team}` : ''} from lap{' '}
              {takeoverLap} of {laps}, against {surname(rival)}.
            </p>
          </section>

          <Objectives model={model} difficulty={difficulty} />
          <Difficulty difficulty={difficulty} legend={legend} timed={timed} />

          <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-fit">
            <button
              type="button"
              onClick={onStart}
              className="rounded-xl bg-[var(--you)] px-8 py-4 text-[18px] font-bold text-[var(--you-ink)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
            >
              {resume ?? (legend ? 'Start the race · Legend' : 'Start the race')}
            </button>
            <button
              type="button"
              onClick={onHelp}
              className="text-[13px] text-[var(--muted)] underline hover:text-[var(--ink)]"
            >
              How it works
            </button>
          </div>

          {credit && (
            <p data-credit="race" className="m-0 break-words text-[13px] text-[var(--muted)]">
              {credit}{' '}
              <a href="/credits" className="underline underline-offset-2 hover:text-[var(--ink)]">
                Credits
              </a>
            </p>
          )}
        </div>
        {/* Where it's run: the circuit on its ground, beside the briefing on a computer. */}
        <aside className="glass-strong overflow-hidden lg:sticky lg:top-6">
          <div className="relative">
            <CircuitCard raceId={model.race.id} />
            <MapCredit raceId={model.race.id} className="absolute right-2 bottom-1.5" />
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
            <span className="disp text-[18px]">{raceName(race.raceId)}</span>
            <span className="text-[13px] text-[var(--muted)]">
              {surname(userSide)} vs {surname(rival)} · from lap {takeoverLap} of {laps}
            </span>
          </div>
        </aside>
      </main>
      <Disclaimer />
    </div>
  );
}
