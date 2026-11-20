// The Versus lobby (/versus): the garage. The whole page is the garage (wall, lights, epoxy floor,
// the painted pit box); your car stands in it (GarageCar.tsx), with the start tyres below it.
// You pick one of the four Versus cars and a start tyre, pick the circuit, and roll out to
// create a race, or join one with its code.
// The setup is remembered (versus/setup.ts) and the match's pick screen starts from it; picks
// stay blind until both are locked in. It has its own look, as Eras has its own: the `gp-`
// classes in index.css.

import { VERSUS_CARS, VERSUS_LAPS, VERSUS_TRACKS, versusTrack } from '@laststint/sim';
import { useMemo, useState } from 'react';
import { ApiError, apiPost } from '../api.js';
import { CAR_SHAPES, CarIcon, type Shape } from '../components/CarIcon.js';
import { outlineFor } from '../track/outlines.js';
import { GarageCar } from './GarageCar.js';
import {
  STAT_NAME,
  type Setup,
  type StartTyre,
  TYRES,
  lapEdge,
  loadSetup,
  markFromGarage,
  saveSetup,
} from './setup.js';

const MONO = 'mono font-bold';
const TYRE_NAME: Record<StartTyre, string> = { SOFT: 'Soft', MEDIUM: 'Medium', HARD: 'Hard' };
const TYRE_COLOUR: Record<StartTyre, string> = {
  SOFT: 'var(--soft)',
  MEDIUM: 'var(--medium)',
  HARD: 'var(--hard)',
};
/** What each circuit rewards, in a word. */
const TRACK_TAG: Record<string, string> = {
  monza: 'Power',
  spa: 'Power',
  bahrain: 'Tyres',
  suzuka: 'Corners',
  hungaroring: 'Corners',
};

/** A choice drawn as a card around a real radio button (keyboard arrows move between them). */
const CHOICE =
  'relative flex cursor-pointer rounded-lg border-2 border-[#26292D] bg-[#131417] hover:border-[#5A5E64] has-[:checked]:border-[var(--gp-red)] has-[:checked]:bg-[#2A0C0A] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white';

/** A panel standing in the garage: dark glass over the scene. */
const PANEL =
  'flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-[#0E0F11]/85 p-5 backdrop-blur-md';

/** What each start tyre is for, in a line. */
const TYRE_NOTE: Record<StartTyre, string> = {
  SOFT: 'Most grip, wears out fastest',
  MEDIUM: 'The middle ground',
  HARD: 'Least grip, lasts longest',
};

export function Lobby({ name, onRename }: { name: string; onRename: () => void }) {
  const [setup, setSetup] = useState<Setup>(loadSetup);
  const [track, setTrack] = useState(VERSUS_TRACKS[0]?.id ?? 'monza');
  const [join, setJoin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = join.trim().toUpperCase();
  const picked = versusTrack(track);
  const car = VERSUS_CARS.find((c) => c.id === setup.car) ?? VERSUS_CARS[0];

  const change = (next: Partial<Setup>) => {
    const s = { ...setup, ...next };
    setSetup(s);
    saveSetup(s);
  };
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = await apiPost<{ code: string }>('/api/versus', { track });
      markFromGarage(room.code);
      location.assign(`/versus/${room.code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="gp gp-body gp-scene flex flex-1 flex-col text-[#EDEDED]">
      <div className="gp-led" aria-hidden="true" />
      <div className="relative z-[1] mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-5 px-4 pt-8 pb-12 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)_340px] xl:grid-cols-[380px_minmax(0,1fr)_380px]">
        {/* The bay: your name on the garage wall, the car in its painted pit box, the tyres. */}
        <section
          aria-label="Your garage"
          className="flex min-w-0 flex-col items-center gap-4 lg:col-start-2 lg:row-start-1"
        >
          <div className="flex max-w-full flex-col items-center justify-center text-center lg:h-[162px]">
            <span className={`${MONO} text-[12px] tracking-[0.24em] text-[#FF5A50]`}>
              VERSUS · GARAGE 1
            </span>
            <span className="gp-display max-w-full px-[0.06em] text-[36px] leading-none break-words sm:text-[52px]">
              {name}
            </span>
            <button
              type="button"
              onClick={onRename}
              className="py-2 text-[14px] text-[#C9CBCF] underline"
            >
              change name
            </button>
          </div>

          <div className="relative flex w-full items-center justify-center py-4">
            <div className="gp-box relative flex flex-col items-center justify-center gap-2 px-6 pt-6 pb-3 sm:px-10">
              <GarageCar
                shape={CAR_SHAPES[setup.car] ?? (CAR_SHAPES.balanced as Shape)}
                tyre={TYRE_COLOUR[setup.tyre]}
                label={`Your car, the ${car?.name ?? ''}, on ${TYRE_NAME[setup.tyre].toLowerCase()} tyres, seen from above in its pit box`}
                className="relative h-[340px] w-auto max-w-full sm:h-[480px] xl:h-[560px]"
              />
              <span
                aria-hidden="true"
                className="gp-display pointer-events-none text-[40px] leading-none text-[#E8B500]/30 sm:text-[60px]"
              >
                {car?.name}
              </span>
            </div>
          </div>

          <fieldset className="m-0 grid w-full max-w-[640px] grid-cols-3 gap-2 border-0 p-0">
            <legend className="mb-2 w-full text-center text-[14px] font-semibold text-[#C9CBCF]">
              Start tyre
            </legend>
            {TYRES.map((t) => (
              <label
                key={t}
                className={`${CHOICE} flex-col items-center gap-2 bg-[#0E0F11]/85 px-2 pt-3 pb-2.5 text-center`}
              >
                <input
                  type="radio"
                  name="gp-tyre"
                  value={t}
                  checked={setup.tyre === t}
                  onChange={() => change({ tyre: t })}
                  className="sr-only"
                />
                <TyreIcon id={t} colour={TYRE_COLOUR[t]} />
                <span className="text-[16px] font-bold leading-tight">{TYRE_NAME[t]}</span>
                <span className="text-[12px] leading-tight text-[#B4B7BC]">{TYRE_NOTE[t]}</span>
              </label>
            ))}
          </fieldset>
        </section>

        {/* The car. */}
        <section
          aria-labelledby="gp-car"
          className={`${PANEL} lg:col-start-1 lg:row-start-1 lg:mt-[194px] lg:self-start`}
        >
          <span className={`${MONO} text-[12px] tracking-[0.18em] text-[#FF5A50]`}>
            1 · THE CAR · {VERSUS_LAPS} LAPS, 1 V 1
          </span>
          <h1 id="gp-car" className="gp-display m-0 px-[0.04em] text-[30px] leading-none">
            Pick your machine
          </h1>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Car</legend>
            {VERSUS_CARS.map((c) => (
              <label key={c.id} className={`${CHOICE} items-center gap-3 px-3 py-2.5`}>
                <input
                  type="radio"
                  name="gp-car"
                  value={c.id}
                  checked={setup.car === c.id}
                  onChange={() => change({ car: c.id })}
                  className="sr-only"
                />
                <svg viewBox="-15 -26 30 52" aria-hidden="true" className="h-12 w-7 shrink-0">
                  <g transform="rotate(-90)">
                    <CarIcon
                      color={setup.car === c.id ? 'var(--gp-red)' : '#8E9196'}
                      tyre={TYRE_COLOUR[setup.tyre]}
                      shape={c.id}
                    />
                  </g>
                </svg>
                <span className="flex min-w-0 flex-col">
                  <span className="gp-display text-[19px] leading-none">{c.name}</span>
                  <span className="text-[13px] leading-tight text-[#B4B7BC]">{c.blurb}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {car && (
            <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
              <dl className="m-0 flex flex-col gap-2">
                {Object.entries(car.stats).map(([k, v]) => (
                  <Stat key={k} label={STAT_NAME[k] ?? k} value={v} />
                ))}
              </dl>
              <p className="m-0 pt-1 text-[14px] text-[#B4B7BC]">
                At {picked?.name}:{' '}
                <strong className="text-[#EDEDED]">{lapEdge(picked, car.stats)}</strong>
              </p>
            </div>
          )}
          <p className="m-0 text-[13px] text-[#9A9DA3]">
            Your rival can't see your car until you're both locked in on the grid.
          </p>
        </section>

        {/* The race. */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-3 lg:row-start-1 lg:mt-[194px] lg:self-start">
          <section aria-labelledby="gp-race" className={PANEL}>
            <span className={`${MONO} text-[12px] tracking-[0.18em] text-[#FF5A50]`}>
              2 · THE RACE
            </span>
            <h2 id="gp-race" className="gp-display m-0 text-[30px] leading-none">
              Create a race
            </h2>
            <fieldset className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
              <legend className="mb-2 text-[14px] font-semibold text-[#C9CBCF]">
                Pick the circuit
              </legend>
              {VERSUS_TRACKS.map((t) => (
                <Circuit
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  raceFile={t.raceFile}
                  checked={t.id === track}
                  onPick={() => setTrack(t.id)}
                />
              ))}
            </fieldset>
            <p className="m-0 text-[14px] text-[#B4B7BC]">
              {picked?.character} · first past the flag wins
            </p>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="gp-display h-[60px] rounded-md bg-[var(--gp-red)] px-6 text-[22px] text-white shadow-[0_8px_24px_rgba(225,6,0,0.35)] hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Creating…' : `Create race at ${picked?.name ?? ''}`}
            </button>
            <p className="m-0 text-[14px] text-[#B4B7BC]">
              You get a four-letter code to send your rival.
            </p>
            {error && (
              <p className="m-0 text-[14px] text-[#FF8A80]">Couldn't create the race: {error}</p>
            )}
            <form
              className="flex flex-col gap-2.5 border-t border-white/10 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^[A-Z]{4}$/.test(code)) return;
                markFromGarage(code);
                location.assign(`/versus/${code}`);
              }}
            >
              <span className="gp-display text-[22px] leading-none">Or join a race</span>
              <label htmlFor="gp-code" className="text-[14px] font-semibold text-[#C9CBCF]">
                Got a code from your rival? Type it here
              </label>
              <div className="flex gap-2">
                <input
                  id="gp-code"
                  value={join}
                  onChange={(e) => setJoin(e.target.value)}
                  maxLength={4}
                  placeholder="ABCD"
                  autoComplete="off"
                  className={`${MONO} h-14 min-w-0 flex-1 rounded-md border-2 border-[#3A3D43] bg-black text-center text-[24px] tracking-[0.35em] text-white uppercase placeholder:text-[#4A4D53]`}
                />
                <button
                  type="submit"
                  disabled={!/^[A-Z]{4}$/.test(code)}
                  className="gp-display h-14 rounded-md bg-[#EDEDED] px-5 text-[19px] text-[#0B0C0D] disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </form>
          </section>
          <section
            aria-label="Your rival's garage"
            className="gp-shutter flex flex-col gap-1 rounded-2xl border border-white/10 px-5 py-4"
          >
            <span className={`${MONO} text-[12px] tracking-[0.2em] text-[#D5D7DA]`}>GARAGE 2</span>
            <span className="gp-display text-[22px] leading-tight">Shutter down</span>
            <span className="text-[14px] text-[#D5D7DA]">
              Opens when your rival joins with your code
            </span>
          </section>
        </div>
      </div>
    </div>
  );
}

/** An F1 tyre side-on: the black sidewall with its compound-coloured ring, the tread's edge,
 * and the wheel cover with its centre nut. */
function TyreIcon({ id, colour }: { id: string; colour: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-16 w-16">
      <defs>
        <radialGradient id={`gp-wall-${id}`} cx="0.42" cy="0.38" r="0.62">
          <stop offset="0.55" stopColor="#2A2B2F" />
          <stop offset="1" stopColor="#0B0B0C" />
        </radialGradient>
        <radialGradient id={`gp-cover-${id}`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#4A4D53" />
          <stop offset="1" stopColor="#141518" />
        </radialGradient>
      </defs>
      <ellipse cx={32} cy={61} rx={22} ry={2.5} fill="#000" opacity={0.5} />
      <circle cx={32} cy={31} r={29} fill={`url(#gp-wall-${id})`} />
      <circle
        cx={32}
        cy={31}
        r={28}
        fill="none"
        stroke="#000"
        strokeOpacity={0.6}
        strokeWidth={1.5}
      />
      <circle cx={32} cy={31} r={21.5} fill="none" stroke={colour} strokeWidth={3} />
      <circle cx={32} cy={31} r={16} fill={`url(#gp-cover-${id})`} />
      <circle cx={32} cy={31} r={16} fill="none" stroke="#0B0B0C" strokeWidth={1} />
      <circle cx={32} cy={31} r={4} fill="#9A9DA3" />
      <circle cx={32} cy={31} r={1.6} fill="#2A2B2F" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const shown = value > 0 ? `+${value}` : String(value);
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)_26px] items-center gap-2.5">
      <dt className="text-[14px] font-semibold">{label}</dt>
      <dd className="m-0 grid grid-cols-5 gap-1" aria-label={shown}>
        {[-2, -1, 0, 1, 2].map((n) => (
          <span
            key={n}
            className="h-2.5 rounded-sm"
            style={{
              background:
                n === 0
                  ? '#5A5E64'
                  : value > 0 && n > 0 && n <= value
                    ? '#4ADE80'
                    : value < 0 && n < 0 && n >= value
                      ? '#FF5A50'
                      : '#25282C',
            }}
          />
        ))}
      </dd>
      <dd
        aria-hidden="true"
        className={`${MONO} m-0 text-right text-[13px]`}
        style={{ color: value > 0 ? '#4ADE80' : value < 0 ? '#FF5A50' : '#8E9196' }}
      >
        {shown}
      </dd>
    </div>
  );
}

function Circuit({
  id,
  name,
  raceFile,
  checked,
  onPick,
}: {
  id: string;
  name: string;
  raceFile: string;
  checked: boolean;
  onPick: () => void;
}) {
  const outline = outlineFor(raceFile);
  const d = useMemo(
    () =>
      outline
        ? `M${outline.points.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join('L')}Z`
        : null,
    [outline],
  );
  return (
    <label className={`${CHOICE} min-w-0 flex-col gap-1.5 p-2.5 last:col-span-2`}>
      <input
        type="radio"
        name="gp-track"
        value={id}
        checked={checked}
        onChange={onPick}
        className="sr-only"
      />
      <span className="flex items-center justify-between gap-2">
        <span className="gp-display truncate text-[17px] leading-none">{name}</span>
        <span className={`${MONO} text-[10px] tracking-[0.1em] text-[#B4B7BC] uppercase`}>
          {TRACK_TAG[id]}
        </span>
      </span>
      {outline && d && (
        <svg
          viewBox={`${-outline.width * 0.05} ${-outline.height * 0.05} ${outline.width * 1.1} ${outline.height * 1.1}`}
          aria-hidden="true"
          className="h-14 w-full"
        >
          <path
            d={d}
            fill="none"
            stroke={checked ? '#FFFFFF' : '#6A6E75'}
            strokeWidth={Math.max(outline.width, outline.height) * 0.035}
            strokeLinejoin="round"
          />
        </svg>
      )}
    </label>
  );
}
