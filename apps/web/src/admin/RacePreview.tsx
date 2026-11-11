// The race preview on the Schedule tab (docs/admin-v2-spec.md A5): a playable race's map on
// its real ground, how well it fits the ground (data/scenery: the median distance and the share
// on real tarmac), its moments and real calls, its seed and side, and its pools. Opens without
// starting a race. The scenery files are big, so each circuit's loads only when previewed; a
// race without a fit, or a fit without `cover` / `how`, just shows less.

import type { RaceModel } from '@laststint/sim';
import { useEffect, useState } from 'react';
import basemap from '../../../../data/basemap/index.json';
import pools from '../../../../data/pools.json';
import { CircuitCard } from '../components/CircuitCard.js';
import { btn } from './ui.js';
import { type Pools, fitText, poolsOf } from './v2.js';

interface Fit {
  err?: number;
  cover?: number;
  how?: string;
}

const SCENERY = import.meta.glob<Record<string, Fit>>('../../../../data/scenery/*.json', {
  import: 'races',
});

const BASEMAP = basemap as { races: Record<string, { circuit: string; err?: number }> };

/** The race's fit: the basemap index's median distance, and the scenery file's cover and how. */
function useFit(raceId: string): Fit | null {
  const base = BASEMAP.races[raceId];
  const [fit, setFit] = useState<Fit | null>(base ? { err: base.err } : null);
  useEffect(() => {
    const b = BASEMAP.races[raceId];
    setFit(b ? { err: b.err } : null);
    const load = b && SCENERY[`../../../../data/scenery/${b.circuit}.json`];
    if (!load) return;
    let alive = true;
    load().then(
      (races) => {
        const r = races?.[raceId];
        if (alive && r) setFit({ err: r.err ?? b.err, cover: r.cover, how: r.how });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [raceId]);
  return fit;
}

export function RacePreview({ model, onClose }: { model: RaceModel; onClose: () => void }) {
  const id = model.race.id;
  const fit = useFit(id);
  const inPools = poolsOf(id, pools as unknown as Pools);
  const driver = (code: string) => model.drivers.find((d) => d.code === code);
  return (
    <aside className="card flex flex-col gap-3 !p-4" aria-label="Race preview">
      <div className="flex items-start justify-between gap-2">
        <h3 className="disp m-0 text-[18px] leading-tight">{model.race.name ?? id}</h3>
        <button type="button" className={btn} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--rule)]">
        <CircuitCard raceId={id} />
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-[var(--muted)]">Ground fit</dt>
        <dd className="m-0">
          {fitText(fit)}
          {fit?.how ? ` (${fit.how})` : ''}
        </dd>
        <dt className="text-[var(--muted)]">Seed</dt>
        <dd className="m-0 tabular-nums">{model.race.seed}</dd>
        <dt className="text-[var(--muted)]">Side</dt>
        <dd className="m-0">
          {model.userSide} ({driver(model.userSide)?.team ?? '—'}) against {model.rival}
        </dd>
        <dt className="text-[var(--muted)]">Pools</dt>
        <dd className="m-0">{inPools.length ? inPools.join(', ') : 'None'}</dd>
        <dt className="text-[var(--muted)]">Laps</dt>
        <dd className="m-0">
          {model.race.laps}, taking over on lap {model.race.takeoverLap}
        </dd>
      </dl>
      <h4 className="m-0 text-[14px] font-semibold">Moments ({model.decisionMoments.length})</h4>
      <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
        {model.decisionMoments.map((m) => (
          <li key={m.id} className="rounded-md bg-[var(--card-2)] px-2.5 py-1.5">
            <div className="font-semibold">
              Lap {m.lap} · {m.trigger}
            </div>
            <div className="text-[var(--muted)]">
              {m.options
                .map((o) => (o.id === m.realOptionId ? `${o.label} (real call)` : o.label))
                .join(' · ')}
              {m.realOptionId === null ? ' · the real team made none of these calls' : ''}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
