"""The restart after a safety car: the leader's jump and the field's spread, fitted from timed
races (Eras model fixes M4, task 1).

Both sims run the last SC lap nose-to-tail (BUNCH_GAP apart) and the restart lap as an
ordinary green lap, so the queue comes out of the restart still ~0.5 s a car apart plus dirty
air. Real queues don't: the leader picks the moment and pulls clear, and each car behind gets
on the throttle a little later than the one ahead, so the field spreads ~1 s a car on the
restart lap (2018+ timed races: P2 1.05 s behind at the end of the restart lap, P3 2.3 s,
P6 5.2 s, against 0.5 s a car at the end of the last SC lap).

The rule. On the restart lap (a green lap straight after an SC lap: a safety-car period's
first green lap, or a red flag's rolling restart behind the safety car) the car k places
behind the leader in the queue (the start-of-lap order of the running cars, k = 0 the leader)
loses

    extra(k) = JUMP + SPREAD * min(k, PLACES)      for k >= 1 (0 for the leader)

on top of its lap. A standing restart (its own fitted spread, redflag.STANDING_RESTART_GAP)
takes none.

The fit. (JUMP, SPREAD, PLACES) minimise the Huber loss (HUBER_DELTA, so a car that passed or
was passed on the lap doesn't dominate) of the gaps to the leader at the end of the restart lap
predicted from the sims' state at the end of the last SC lap (BUNCH_GAP x k, plus the race's
dirty-air penalty for every car behind the leader, which the sims also add there) against the
real gaps. Cars: the first FIT_PLACES cars of the lead-lap queue at the end of the last SC lap
(in that order), those that pitted on either lap left out; restarts with fewer than 6 such cars
are skipped. Grid search on JUMP_GRID x SPREAD_GRID x PLACES_GRID, so the fit is exact and
reproducible (test_restart.py refits it on the committed snapshots).

Fit (Nov 8 2026, the 31 restarts of FIT_RACES, 310 car-laps): JUMP 0.15 s, SPREAD 0.44 s a
place, PLACES 8. Huber loss 2.53 against 4.99 for today's rule (no restart term); median error
of the predicted gaps +0.09 s against -2.17 s (today's queue comes out of a restart about 2 s
too tight by P10).

Eras-only: an Eras build writes the fit into the race file (`track.restart`), and the sims
apply it only where a race file carries it, so every Daily and Gauntlet race file (and every
committed file not yet rebuilt) replays exactly as before.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import events as events_mod
from .paths import RACES_DIR, RAW_DIR

BUNCH_GAP = 0.5  # sim_reference.BUNCH_GAP: the queue's spacing at the end of the last SC lap
# The committed fit (see the module docstring); `track_block` writes it into Eras race files.
JUMP = 0.15
SPREAD = 0.44
PLACES = 8
# Eras builds write `track.restart` (build.scripted_blocks). One switch, since G1 at the flag
# moves both ways under it (docs/g1-report.md, Eras model fixes M4): False builds without it.
# Off since integration 6 (docs/eras-races-report.md): robust G1 over the 71 timed non-pool
# Eras races gives 17 passes and 346.5 s of mean gap error with it off, 16 and 354.4 s on.
IN_ERAS_BUILDS = False
FIT_PLACES = 10
HUBER_DELTA = 2.0
MIN_CARS = 6
JUMP_GRID = [round(-0.5 + 0.05 * i, 2) for i in range(41)]  # -0.5 .. 1.5 s
SPREAD_GRID = [round(0.02 * i, 2) for i in range(51)]  # 0 .. 1.0 s a place
PLACES_GRID = [3, 5, 8, 10, 20]
# The timed 2018+ races (sc_queue.timed_races) with an SC restart, as committed: a fixed list,
# so ingesting a race doesn't silently move the fit.
FIT_RACES = [
    "abu-dhabi-2018",
    "abu-dhabi-2020",
    "abu-dhabi-2021",
    "australia-2025",
    "austria-2025",
    "bahrain-2021",
    "bahrain-2022",
    "canada-2022",
    "canada-2024",
    "china-2024",
    "japan-2023",
    "mexico-2021",
    "mexico-2024",
    "miami-2022",
    "miami-2024",
    "netherlands-2022",
    "netherlands-2023",
    "portugal-2021",
    "russia-2020",
    "saudi-arabia-2022",
    "saudi-arabia-2025",
    "singapore-2019",
    "singapore-2023",
    "spain-2021",
    "styria-2020",
    "united-states-2022",
]


def track_block() -> dict:
    """The race file's `track.restart` block (Eras builds)."""
    return {"jump": JUMP, "spread": SPREAD, "places": PLACES}


def extra(block: dict, k: int) -> float:
    """Seconds the car k places behind the leader loses on the restart lap (both sims)."""
    if k <= 0:
        return 0.0
    return block["jump"] + block["spread"] * min(k, block["places"])


def restart_queues(laps: pd.DataFrame) -> list[tuple[np.ndarray, np.ndarray]]:
    """Per SC restart: the lead-lap queue's gaps to the leader at the end of the last SC lap and
    at the end of the restart lap, in the order of the last SC lap (cars that pitted on either
    lap left out)."""
    total = int(laps["LapNumber"].max())
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
        if not pd.isna(r.PitOutTime):
            pitting.add((str(r.Driver), int(r.LapNumber)))
    drivers = list(laps["Driver"].astype(str).unique())
    out = []
    for e in events_mod.neutralization_events(laps):
        if e["type"] != "SC":
            continue
        last = int(e["lap"]) + int(e["laps"]) - 1
        restart = last + 1
        if restart > total:
            continue
        before = {
            d: end[(d, last)]
            for d in drivers
            if (d, last) in end
            and (d, restart) in end
            and (d, last) not in pitting
            and (d, restart) not in pitting
        }
        if len(before) < MIN_CARS:
            continue
        order = sorted(before, key=before.get)
        g0 = np.array([before[d] - before[order[0]] for d in order])
        g1 = np.array([end[(d, restart)] - end[(order[0], restart)] for d in order])
        on_lead_lap = g0 < 0.9 * green
        out.append((g0[on_lead_lap], g1[on_lead_lap]))
    return out


def _huber(e: np.ndarray, delta: float = HUBER_DELTA) -> float:
    a = np.abs(e)
    return float(np.where(a < delta, 0.5 * a * a, delta * (a - 0.5 * delta)).mean())


def dirty_air(race_id: str, races_dir: Path = RACES_DIR) -> float | None:
    """The race file's fitted dirty-air penalty (the sims add it to every car in the queue)."""
    path = Path(races_dir) / f"{race_id}.json"
    return (
        float(json.loads(path.read_text())["track"]["dirtyAirPenalty"]) if path.exists() else None
    )


def fit(
    race_ids: list[str] | None = None, raw_dir: Path = RAW_DIR, races_dir: Path = RACES_DIR
) -> dict:
    """The (jump, spread, places) of least Huber loss over the races' restarts (FIT_RACES by
    default), with the loss, today's rule's loss, the median errors and the sample sizes."""
    samples = []
    for rid in race_ids or FIT_RACES:
        laps = pd.read_parquet(Path(raw_dir) / f"{rid}.parquet")
        for _g0, g1 in restart_queues(laps):
            samples.append((rid, g1[: FIT_PLACES + 1]))
    known = [d for d in (dirty_air(r, races_dir) for r in {r for r, _ in samples}) if d is not None]
    fallback = float(np.median(known)) if known else 0.0
    dirty = {r: dirty_air(r, races_dir) for r, _ in samples}
    k_of = [np.arange(len(g1)) for _, g1 in samples]
    base = [
        BUNCH_GAP * k + (k >= 1) * (dirty[r] if dirty[r] is not None else fallback)
        for (r, _), k in zip(samples, k_of, strict=True)
    ]

    def errors(jump: float, spread: float, places: int) -> np.ndarray:
        return np.concatenate(
            [
                (b + (k >= 1) * (jump + spread * np.minimum(k, places)) - g1)[1:]
                for (_, g1), k, b in zip(samples, k_of, base, strict=True)
            ]
        )

    best = None
    for places in PLACES_GRID:
        for jump in JUMP_GRID:
            for spread in SPREAD_GRID:
                loss = _huber(errors(jump, spread, places))
                if best is None or loss < best[0] - 1e-12:
                    best = (loss, jump, spread, places)
    loss, jump, spread, places = best
    today = errors(0.0, 0.0, 1)
    return {
        "jump": jump,
        "spread": spread,
        "places": places,
        "loss": round(loss, 3),
        "todayLoss": round(_huber(today), 3),
        "medianError": round(float(np.median(errors(jump, spread, places))), 3),
        "todayMedianError": round(float(np.median(today)), 3),
        "restarts": len(samples),
        "carLaps": int(len(today)),
    }


if __name__ == "__main__":  # python -m pipeline.restart: refit and print
    print(fit())
