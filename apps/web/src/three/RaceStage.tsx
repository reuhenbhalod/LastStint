// The race's stage (docs/3d-spec.md): on a computer at a circuit with scenery, the 3D view is
// the main one and the 2D map sits in the corner; click the small one to swap them (the choice
// is remembered). Anywhere else (phones, tablets, circuits without scenery, SCENE_3D off) it's
// the 2D map alone, as before.

import {
  type MutableRefObject,
  type ReactNode,
  Suspense,
  lazy,
  useCallback,
  useState,
} from 'react';
import type { CameraMode } from './Scene3D.js';
import { SCENE_3D, saveView, savedView, use3D } from './enabled.js';
import { type MapFeed, circuitFor } from './scenery.js';

// Behind the switch, so with SCENE_3D off the 3D code isn't built at all.
const Scene3D = SCENE_3D ? lazy(() => import('./Scene3D.js')) : null;

const MAIN = 'absolute inset-0 z-0';
const CORNER =
  'absolute right-2 top-2 z-20 overflow-hidden rounded-lg border-2 border-[#2f3835] bg-[#0F1312] shadow-[0_10px_30px_#000a] w-[min(30%,320px)]';

const CAMERAS: Array<[CameraMode, string]> = [
  ['overview', 'Overview'],
  ['follow', 'Chase'],
  ['tv', 'TV'],
];

export function RaceStage({
  raceId,
  feedRef,
  mapAspect,
  onSelect,
  children,
}: {
  raceId: string;
  feedRef: MutableRefObject<MapFeed | null>;
  /** The 2D map's width over height (its corner box keeps the shape). */
  mapAspect: number;
  onSelect?: (code: string) => void;
  /** The 2D track map. */
  children: ReactNode;
}) {
  const on = use3D(raceId);
  const circuit = circuitFor(raceId);
  const [view, setView] = useState<'3d' | '2d'>(savedView);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [camera, setCamera] = useState<CameraMode>('overview');
  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);
  if (!Scene3D || !on || failed || !circuit) return <>{children}</>;
  // Until the 3D view has built, the 2D map stays the main view.
  const main3D = view === '3d' && ready;
  const swap = () => {
    const next = view === '3d' ? '2d' : '3d';
    setView(next);
    saveView(next);
  };
  return (
    <div className="absolute inset-0">
      <div
        className={`${main3D ? MAIN : CORNER} transition-[width,top,right] duration-300`}
        style={main3D ? undefined : { aspectRatio: '16 / 10' }}
      >
        <Suspense fallback={null}>
          <Scene3D
            circuit={circuit}
            raceId={raceId}
            feedRef={feedRef}
            main={main3D}
            camera={camera}
            onSelect={onSelect}
            onReady={onReady}
            onFail={onFail}
          />
        </Suspense>
        {!main3D && ready && (
          <button
            type="button"
            onClick={swap}
            className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--flag)]"
            aria-label="Make the 3D view the main view"
          >
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.12em] text-[var(--ink)]">
              3D VIEW
            </span>
          </button>
        )}
      </div>
      <div
        className={main3D ? CORNER : MAIN}
        style={main3D ? { aspectRatio: String(mapAspect) } : undefined}
      >
        {children}
        {main3D && (
          <button
            type="button"
            onClick={swap}
            className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--flag)]"
            aria-label="Make the 2D map the main view"
          >
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.12em] text-[var(--ink)]">
              2D MAP
            </span>
          </button>
        )}
      </div>
      {main3D && (
        <fieldset className="absolute bottom-2 left-2 z-20 m-0 flex gap-1 border-0 p-0">
          <legend className="sr-only">Camera</legend>
          {CAMERAS.map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={camera === m}
              onClick={() => setCamera(m)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${camera === m ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_22%,#0f1312)] text-[var(--ink)]' : 'border-[#2f3835] bg-black/70 text-[var(--ink)]'}`}
            >
              {label}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
