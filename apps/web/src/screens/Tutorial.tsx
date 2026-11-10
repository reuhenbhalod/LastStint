// The tutorial race (docs/feedback-round-3-spec.md R3): Canada 2022, Sainz chasing Verstappen,
// played like any race but with a coach card that stops at each control the first time it
// matters: the map and leaders, the race plan, team radio, stats and fuel, a quick call, a
// battle, the big calls (VSC, tyres, a rival's stop, the safety car), a tip on rain, and the
// results. Between steps the race fast-forwards. Calls never time out. It's practice: never
// scored or saved, started fresh each visit, skippable at any step.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brand } from '../components/Brand.js';
import { surname } from '../data/names.js';
import { RaceFileProvider } from '../data/provider.js';
import { useTeamTheme } from '../game/teamTheme.js';
import { useGame } from '../game/useGame.js';
import { clearRun } from '../state/storage.js';
import { RaceScreen, type TutorialCall } from './RaceScreen.js';
import { ResultScreen } from './ResultScreen.js';

const RACE = 'canada-2022';
const RUN_KEY = 'laststint:tutorial-run';
const DONE_KEY = 'laststint:tutorial-done';

/** The tutorial was finished or skipped (How to play stops offering it first). */
export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function markDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // storage blocked: offered again next time
  }
}

interface Ctx {
  phase: string;
  lap: number;
  call: TutorialCall | null;
  seen: Set<string>;
  resultsShown: boolean;
}

interface Step {
  id: string;
  /** The control to highlight (a data-tour name in the race screen), if any. */
  target?: string;
  title: string;
  body: string;
  /** Hold the race while the card shows (the race isn't already stopped for a call). */
  hold?: boolean;
  when: (c: Ctx) => boolean;
}

const decision = (c: Ctx, trigger: string) =>
  c.call?.kind === 'decision' && c.call.trigger === trigger;

function steps(me: string, rival: string): Step[] {
  const planning = (c: Ctx) => c.phase === 'planning';
  const after = (id: string, f: (c: Ctx) => boolean) => (c: Ctx) => c.seen.has(id) && f(c);
  const racing = (c: Ctx) => c.phase === 'racing';
  return [
    {
      id: 'welcome',
      target: 'map',
      title: 'Welcome to the pit wall',
      body: `You’re ${me}’s race engineer for the rest of the Canadian Grand Prix. The goal: finish ahead of ${rival}. The map shows every car live; yours and ${rival}’s are the big dots. Tap any car for its details.`,
      when: planning,
    },
    {
      id: 'leaders',
      target: 'leaders',
      title: 'The leaders',
      body: 'The top ten as on TV, with gaps to the leader. Your car and the rival are highlighted, and join the list wherever they are.',
      when: after('welcome', planning),
    },
    {
      id: 'score',
      target: 'score',
      title: 'The fight',
      body: `${me} against ${rival}: the number in the middle is the gap (+ means you’re ahead). On the right, the lap, the race speed (1× or 2×) and the radio sound.`,
      when: after('leaders', planning),
    },
    {
      id: 'plan',
      target: 'call',
      title: 'Pick a race plan',
      body: 'First, the strategy. The engineer offers a few plans, each with its chance of beating the rival, and marks his pick. Choose one, or build your own. The car runs to it, and you can change it any time. Pick one to start the race.',
      when: after('score', planning),
    },
    {
      id: 'radio',
      target: 'radio',
      hold: true,
      title: 'Team radio',
      body: 'Every order, any time: push or manage the pace, how to race the car next to you, the battery (ERS), fuel saving, and BOX for a stop right now. Open it whenever you want to change something.',
      when: racing,
    },
    {
      id: 'stats',
      target: 'stats',
      hold: true,
      title: 'Show stats',
      body: 'The full timing tower, your driver’s mood, the car (tyre life, lap times, battery and the fuel gauge), the gap trace and your graded calls. If you’re short of fuel, the gauge says how many laps of lift and coast make it up.',
      when: after('radio', racing),
    },
    {
      id: 'quick',
      target: 'call',
      hold: true,
      title: 'Quick calls',
      body: 'Between the big moments, the engineer or the driver asks something: push, defend, look after the tyres. In a real race you have a few seconds before the race decides for you; here it waits.',
      when: (c) => c.call?.kind === 'quick',
    },
    {
      id: 'battle',
      target: 'call',
      hold: true,
      title: 'A battle',
      body: 'Wheel to wheel. The bar shows how the fight stands if you do nothing special. Each move says how risky it is, not how it will turn out: risky moves can win the place, or end in contact. The race waits at the braking zone for your call.',
      when: (c) => c.call?.kind === 'battle',
    },
    {
      id: 'vsc',
      target: 'call',
      title: 'A big call: virtual safety car',
      body: 'The race stops for the big decisions. A VSC slows everyone, so a pit stop costs less time. Read the facts along the top, then choose: Box opens the tyre choice. The call is graded after the race against every other option, and against what the real team did.',
      when: (c) => decision(c, 'VSC'),
    },
    {
      id: 'cliff',
      target: 'call',
      title: 'Tyre calls',
      body: 'The tyres are wearing out. Box now for fresh ones and lose time in the pits, or run them longer. If you’ve just fitted fresh tyres, the wall won’t ask: it stays out by itself.',
      when: (c) => decision(c, 'cliff'),
    },
    {
      id: 'rivalPit',
      target: 'call',
      title: 'The rival stops',
      body: `${rival} has boxed. Cover him (stop now too), or stay out and go long. Stopping first to jump a car on fresh tyres is the undercut; staying out longer is the overcut.`,
      when: (c) => decision(c, 'rivalPit'),
    },
    {
      id: 'sc',
      target: 'call',
      title: 'Safety car',
      body: 'A safety car bunches the field and makes a stop cheap. Fresh tyres for the restart, or keep track position? This is often the call that decides the race.',
      when: (c) => decision(c, 'SC'),
    },
    {
      id: 'rain',
      hold: true,
      title: 'One more: rain',
      body: 'Some races turn wet. The weather chip over the map shows how wet it is and what the radar says. When it rains, the engineer asks whether to box for intermediates; when it dries, whether to go back to slicks.',
      when: (c) => racing(c) && c.seen.has('sc'),
    },
    {
      id: 'flag',
      title: 'The flag',
      body: 'That’s the race. Press “See how you did” for your result and every call graded.',
      when: (c) => c.phase === 'finished',
    },
    {
      id: 'results',
      title: 'How you did',
      body: 'Your place against the real team’s, a score out of 100, and each call on a timeline: what you chose, its chance, the best call and the real team’s. That’s the tutorial. Today’s race is waiting.',
      when: (c) => c.resultsShown,
    },
  ];
}

export function Tutorial() {
  // Fresh every visit: the tutorial isn't resumed.
  const provider = useMemo(() => {
    clearRun(RUN_KEY);
    return new RaceFileProvider(RACE);
  }, []);
  const game = useGame(provider, undefined, RUN_KEY);
  useTeamTheme(game.model);
  const [flagDone, setFlagDone] = useState(false);
  const [call, setCall] = useState<TutorialCall | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [current, setCurrent] = useState<Step | null>(null);

  const model = game.model;
  const all = useMemo(
    () => (model ? steps(surname(model.userSide), surname(model.rival)) : []),
    [model],
  );
  const phase = game.state?.phase ?? 'intro';
  const lap = game.state?.race.lap ?? 0;
  const resultsShown = flagDone && phase !== 'finished' && phase !== 'submitting';

  // The next step whose moment has come.
  useEffect(() => {
    if (current) return;
    const ctx: Ctx = { phase, lap, call, seen, resultsShown };
    const next = all.find((s) => !seen.has(s.id) && s.when(ctx));
    if (next) setCurrent(next);
  }, [current, all, phase, lap, call, seen, resultsShown]);

  // Hold the race under a step that needs it; fast-forward when there's nothing to show.
  const { setHold, setFastForward } = game;
  useEffect(() => {
    setHold(!!current?.hold);
  }, [current, setHold]);
  useEffect(() => {
    setFastForward(phase === 'racing' && !current && !call && seen.has('stats'));
  }, [phase, current, call, seen, setFastForward]);

  // Light up the control the step is about.
  useEffect(() => {
    if (!current?.target) return;
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    el?.classList.add('tour-target');
    return () => el?.classList.remove('tour-target');
  }, [current]);

  const next = useCallback(() => {
    if (!current) return;
    setSeen((s) => new Set(s).add(current.id));
    setCurrent(null);
    if (current.id === 'results') {
      markDone();
      location.href = '/';
    }
  }, [current]);
  const skip = useCallback(() => {
    markDone();
    location.href = '/';
  }, []);

  const hooks = useMemo(
    () => ({ quick: !seen.has('quick'), battle: !seen.has('battle'), onCall: setCall }),
    [seen],
  );

  if (game.error) return <p className="p-8 text-center text-[#9AA5A0]">{game.error}</p>;
  if (!game.state || !model) {
    return (
      <p className="p-8 text-center font-mono text-sm text-[#9AA5A0]">Loading the tutorial…</p>
    );
  }

  const coach = current && (
    <Coach
      step={current}
      index={all.findIndex((s) => s.id === current.id) + 1}
      total={all.length}
      onNext={next}
      onSkip={skip}
    />
  );

  if (phase === 'intro') {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-6">
        <Brand className="text-[20px]" />
        <section className="call-plate !gap-3 !p-5">
          <span className="call-tag">Tutorial race · not scored</span>
          <h1 className="disp m-0 text-[26px] leading-none">Canada 2022</h1>
          <p className="m-0 text-[15px] leading-relaxed text-[#D5DBD7]">
            Take Sainz’s pit wall for the last {model.race.laps - model.race.takeoverLap} laps,
            chasing Verstappen. The race stops to explain each control the first time it matters,
            and skips ahead in between. Takes about five minutes.
          </p>
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={skip}
              className="text-[13px] font-semibold text-[#9AA5A0] underline hover:text-white"
            >
              Skip the tutorial
            </button>
            <button
              type="button"
              onClick={game.start}
              className="disp rounded-md bg-[var(--you)] px-6 py-3 text-[15px] tracking-wide text-[var(--you-ink)] hover:brightness-110"
            >
              Start the tutorial
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (phase === 'planning' || phase === 'racing' || phase === 'decision' || !flagDone) {
    return (
      <>
        <RaceScreen
          game={game}
          state={game.state}
          model={model}
          tutorial={hooks}
          onFinished={() => setFlagDone(true)}
          onHome={skip}
        />
        {coach}
      </>
    );
  }
  return (
    <>
      <ResultScreen state={game.state} game={game} onHome={skip} />
      {coach}
    </>
  );
}

function Coach({
  step,
  index,
  total,
  onNext,
  onSkip,
}: {
  step: Step;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <aside
      aria-live="polite"
      aria-label="Tutorial"
      className="call-plate fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[420px] !gap-2.5 md:inset-x-auto md:bottom-auto md:right-4 md:top-20"
      style={{ '--accent': 'var(--flag)' } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="call-tag">
          Tutorial · {index} of {total}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="text-[12px] font-semibold text-[#9AA5A0] underline hover:text-white"
        >
          Skip tutorial
        </button>
      </div>
      <h2 className="disp m-0 text-[18px] leading-tight">{step.title}</h2>
      <p className="m-0 text-[14px] leading-relaxed text-[#D5DBD7]">{step.body}</p>
      <button
        type="button"
        onClick={onNext}
        className="disp self-end rounded-md bg-[#EEF1EE] px-5 py-2 text-[14px] text-[#0E1214] hover:bg-white"
      >
        {step.id === 'results' ? 'Finish' : 'Got it'}
      </button>
    </aside>
  );
}
