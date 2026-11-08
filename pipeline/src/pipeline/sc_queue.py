"""How the queue behind a safety car closes up, fitted from timed races (Eras sim fix 2).

The sims' SC queue (sim_reference._bunch, packages/sim/src/sim.ts `bunch`) runs three rules:
gaps are kept on the deployment lap (every car runs the same delta), each middle SC lap closes
the gaps, and the last lap before the restart is nose-to-tail (BUNCH_GAP apart). The middle-lap
rule of the Daily/Gauntlet races (SC_GAP_KEEP, 0.34) is applied car by car against the car
ahead's already-closed position, so a queue's tail closes slowly: at Monza 2020 the sim's queue
was still 41 s long two SC laps in, where the real field was within 17.4 s.

This module fits the middle-lap rule on the real queues instead. Each adjacent gap (lead-lap
cars, in race order, cars that pitted on either lap left out) closes on its own toward a
relaxed queue spacing:

    gap' = SPACING + KEEP * (gap - SPACING)   if gap > SPACING, else gap

and the queue is the sum of its gaps. (SPACING, KEEP) minimise the squared error of every
car's predicted gap to the leader at the end of each middle SC lap, from the real gaps at the
end of the lap before, over the timed races of FIT_RACES (FastF1 / OpenF1, 2018+: the only
sources whose track status is timed, so their SC laps are real). Grid search on SPACING_GRID x
KEEP_GRID, so the fit is exact and reproducible (test_sc_queue.py refits it on the committed
snapshots).

Fit (Nov 7 2026, 79 middle SC laps, 921 car-laps over the 25 races of FIT_RACES): SPACING
1.7 s, KEEP 0.34. RMS error of the gaps to the leader 8.00 s, against 10.12 s for the old rule
(0.34 car by car toward BUNCH_GAP) and 9.61 s for 0.34 per gap toward BUNCH_GAP; median error
of the queue's tail (the last car's gap) -0.1 s, against +2.7 s for the old rule.

The rule is Eras-only: the sims use it for a race with an era `rules` block (Eras races), so
every Daily and Gauntlet race file, which never carries one, replays exactly as before.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from . import events as events_mod
from .paths import RAW_DIR

BUNCH_GAP = 0.5  # sim_reference.BUNCH_GAP: the queue's spacing on the last SC lap
# The committed fit (see the module docstring). sim_reference / sim.ts read these.
SC_QUEUE_SPACING = 1.7
SC_QUEUE_KEEP = 0.34
SPACING_GRID = [round(0.5 + 0.1 * i, 1) for i in range(26)]  # 0.5 .. 3.0 s
KEEP_GRID = [round(0.02 * i, 2) for i in range(41)]  # 0 .. 0.8
FIRST_YEAR = 2018
# The timed races the committed fit was made on: timed_races() with a middle SC lap (a SC of
# three or more laps). A fixed list, so ingesting a race doesn't silently move the fit.
FIT_RACES = [
    "abu-dhabi-2018",
    "abu-dhabi-2021",
    "australia-2025",
    "austria-2025",
    "bahrain-2021",
    "bahrain-2022",
    "brazil-2024",
    "canada-2022",
    "canada-2024",
    "china-2024",
    "italy-2022",
    "japan-2023",
    "mexico-2021",
    "mexico-2024",
    "miami-2022",
    "miami-2024",
    "netherlands-2022",
    "netherlands-2023",
    "russia-2020",
    "saudi-arabia-2022",
    "saudi-arabia-2025",
    "singapore-2019",
    "spain-2021",
    "styria-2020",
    "united-states-2022",
]


def timed_races(raw_dir: Path = RAW_DIR) -> list[str]:
    """Races in raw_dir with timed track status: no Jolpica sidecar (estimated SC laps), no
    TUM provenance and no reconstruction, from FIRST_YEAR."""
    out = []
    for p in sorted(Path(raw_dir).glob("*.parquet")):
        rid = p.stem
        year = rid.rsplit("-", 1)[-1]
        if not year.isdigit() or int(year) < FIRST_YEAR:
            continue
        if any(
            (Path(raw_dir) / f"{rid}.{kind}.json").exists()
            for kind in ("jolpica", "provenance", "reconstruction")
        ):
            continue
        out.append(rid)
    return out


def middle_lap_queues(laps: pd.DataFrame) -> list[tuple[np.ndarray, np.ndarray]]:
    """Per middle SC lap (not its first or last lap): the lead-lap cars' gaps to the leader at
    the end of the lap before and at the end of the lap, in the order of the lap before. Cars
    that pitted on either lap are left out."""
    lead = events_mod.leader_laps(laps).set_index("LapNumber")["Time"].astype(float)
    green = float(lead.diff().median())
    end = {
        (str(r.Driver), int(r.LapNumber)): float(r.Time)
        for r in laps.itertuples()
        if not pd.isna(r.Time) and not pd.isna(r.LapNumber)
    }
    pitting = set()
    for r in laps.itertuples():
        if not pd.isna(r.PitInTime):
            pitting |= {(str(r.Driver), int(r.LapNumber)), (str(r.Driver), int(r.LapNumber) + 1)}
    drivers = list(laps["Driver"].astype(str).unique())
    out = []
    for e in events_mod.neutralization_events(laps):
        if e["type"] != "SC":
            continue
        first, n = int(e["lap"]), int(e["laps"])
        for lap in range(first + 1, first + n - 1):
            before = {
                d: end[(d, lap - 1)]
                for d in drivers
                if (d, lap - 1) in end
                and (d, lap) in end
                and (d, lap) not in pitting
                and (d, lap - 1) not in pitting
            }
            if len(before) < 6:
                continue
            order = sorted(before, key=before.get)
            g0 = np.array([before[d] - before[order[0]] for d in order])
            g1 = np.array([end[(d, lap)] - end[(order[0], lap)] for d in order])
            on_lead_lap = g0 < 0.9 * green
            out.append((g0[on_lead_lap], g1[on_lead_lap]))
    return out


def close_queue(gaps: np.ndarray, spacing: float, keep: float) -> np.ndarray:
    """A middle SC lap: each adjacent gap over `spacing` keeps `keep` of its excess."""
    d = np.diff(gaps)
    closed = np.where(d > spacing, spacing + keep * (d - spacing), d)
    return np.concatenate([[0.0], np.cumsum(closed)])


def fit(race_ids: list[str] | None = None, raw_dir: Path = RAW_DIR) -> dict:
    """The least-squares (spacing, keep) on the races' middle SC laps (FIT_RACES by default),
    with the RMS error and the sample sizes."""
    queues = []
    for rid in race_ids or FIT_RACES:
        queues += middle_lap_queues(pd.read_parquet(Path(raw_dir) / f"{rid}.parquet"))
    best = None
    for spacing in SPACING_GRID:
        for keep in KEEP_GRID:
            err = np.concatenate([(close_queue(g0, spacing, keep) - g1)[1:] for g0, g1 in queues])
            sse = float((err**2).sum())
            if best is None or sse < best[0] - 1e-9:
                best = (sse, spacing, keep, err)
    sse, spacing, keep, err = best
    return {
        "spacing": spacing,
        "keep": keep,
        "rms": round(float(np.sqrt((err**2).mean())), 3),
        "laps": len(queues),
        "carLaps": int(len(err)),
    }


if __name__ == "__main__":  # python -m pipeline.sc_queue: refit and print
    print("timed races with data:", timed_races())
    print(fit())
