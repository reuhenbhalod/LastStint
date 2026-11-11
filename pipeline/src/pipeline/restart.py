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

The refit (job 1.5, Nov 8 2026). That baseline was wrong: the sims' restart lap is not
nose-to-tail plus dirty air. Their lap noise sorted into a running order, the 0.3 s hold of a
failed pass and the dirty air already spread the queue, by SIM_RESTART_SPREAD below: P2 0.82 s
behind the leader more than at the end of the last SC lap, P6 2.18 s, P11 3.04 s (the sims with
no restart term, 60 seeds, over the 45 SC restarts after the takeover of the 30 Eras races that
have one). Against the real restarts' extra over the end of the last SC lap (P2 0.98 s, P6 3.21
s, P11 4.19 s) M4's term doubled the spread from P5 back (P11 +6.6 s against the real +4.2 s),
and a car restarting from the back of the queue paid most (sakhir-2020's Russell and Perez,
canada-2022's Leclerc). Refitted the same way on that baseline (`fit(baseline="sim")`, the
default): JUMP -0.25 s, SPREAD 0.14 s a place, PLACES 10; Huber loss 2.60 against 2.77 with no
term, median error +0.07 s against -0.35 s. So the sims' own restart is nearly right, and the
term is small: -0.11 s for P2, +0.45 s for P6, +1.15 s from P11. M4's fit is kept as
`fit(baseline="analytic")` (M4_JUMP, M4_SPREAD, M4_PLACES).

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
JUMP = -0.25
SPREAD = 0.14
PLACES = 10
# M4's fit, on the analytic baseline (nose-to-tail plus dirty air): fit(baseline="analytic").
M4_JUMP = 0.15
M4_SPREAD = 0.44
M4_PLACES = 8
# The sims' own restart lap with no restart term: the mean gap to the leader at the end of the
# restart lap less that at the end of the last SC lap, by place k = 0 .. FIT_PLACES (see the
# module docstring; experiments/restart_ab.py measures it).
SIM_RESTART_SPREAD = [0.0, 0.82, 1.25, 1.69, 1.97, 2.18, 2.44, 2.48, 3.06, 2.76, 3.04]
# Eras builds write `track.restart` (build.scripted_blocks). One switch, since G1 at the flag
# moves both ways under it (docs/g1-report.md, Eras model fixes M4 and job 1.5). Off: over the
# 32 timed Eras races it touches (robust G1, with the real laps down on) the refitted term gives
# 3 passes and 130.7 s of summed gap error against 3 and 130.1 s without (better on 8, worse on
# 10); M4's term gave 2 and 148.2 s against 3 and 139.0 s. The sims' finishing gaps behind the
# leader are already too wide in those races (median +1.2 to +2.4 s at P2-P4), so any term that
# widens the restart widens them further.
IN_ERAS_BUILDS = False
# Eras builds of a no-unlapping race (scUnlap "none") write each SC and RED event's real laps
# down (`lapsDown`, laps_down below); the sims then take a scripted car's lapped status at that
# event from it instead of from their own gaps. One switch (job 1.5): False builds without it.
LAPS_DOWN_IN_ERAS_BUILDS = True
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


def laps_down(laps: pd.DataFrame, lap: int) -> dict[str, int]:
    """Each car's real laps down at the end of race lap `lap` (the leader's lap): when the
    leader crossed the line to finish it, a car that had completed lap - 1 laps was on the lead
    lap, one that had completed lap - 2 a lap down, and so on. Counted from the lap counts, not
    from a gap over a lap time (a car 83 s behind under an SC, as Hamilton at Monaco 2011 on lap
    68, is on the lead lap). Every car with a timed lap ending at or after that moment (still in
    the race)."""
    lead = events_mod.leader_laps(laps).set_index("LapNumber")["Time"].astype(float)
    if lap not in lead.index:
        return {}
    t = float(lead[lap])
    out = {}
    for d, g in laps.dropna(subset=["Time"]).groupby("Driver"):
        times = g["Time"].astype(float)
        if not (times >= t - 1e-6).any():
            continue  # out of the race before the leader finished the lap
        out[str(d)] = max(0, lap - 1 - int((times <= t + 1e-6).sum()))
    return out


def with_laps_down(model: dict, laps: pd.DataFrame) -> tuple[dict, list[str]]:
    """An Eras build of a no-unlapping race: every SC and RED event after the takeover with its
    real laps down (`lapsDown` {car: laps}, every car still running at the event's last lap):
    the most laps down the car was at the end of any of the event's laps (laps_down). With no
    unlapping a car the leader lapped as the queue formed stays lapped (Monaco 2011's first SC:
    Heidfeld and Buemi, lapped on its second lap); the most, not the last, also keeps a car
    lapped when the leader it was lapped by stopped (Monaco 2004 lap 45: Montoya, lapped by
    Schumacher, then 0 laps down to Trulli on lap 46). Returns the model and report lines."""
    if model["race"].get("scUnlap") != "none":
        return model, []
    takeover = int(model["race"]["takeoverLap"])
    codes = {d["code"] for d in model["drivers"]}
    events, lines = [], []
    for e in model["events"]:
        first, last = int(e["lap"]), int(e["lap"]) + int(e.get("laps", 1)) - 1
        if e["type"] in ("SC", "RED") and last > takeover:
            by_lap = [laps_down(laps, lap) for lap in range(first, last + 1)]
            down = {c: max(d.get(c, 0) for d in by_lap) for c in sorted(by_lap[-1]) if c in codes}
            if down:
                e = {**e, "lapsDown": down}
                lapped = ", ".join(f"{c} {n}" for c, n in down.items() if n > 0) or "none"
                lines.append(f"  {e['type']} laps {first}-{last}: real laps down {lapped}")
        events.append(e)
    return {**model, "events": events}, lines


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
    race_ids: list[str] | None = None,
    raw_dir: Path = RAW_DIR,
    races_dir: Path = RACES_DIR,
    baseline: str = "sim",
) -> dict:
    """The (jump, spread, places) of least Huber loss over the races' restarts (FIT_RACES by
    default), with the loss, today's rule's loss, the median errors and the sample sizes.
    `baseline`: what the sims' restart lap gives with no term, "sim" (BUNCH_GAP x k plus the
    measured SIM_RESTART_SPREAD; the committed fit) or "analytic" (BUNCH_GAP x k plus the
    race's dirty air behind the leader; M4's fit)."""
    samples = []
    for rid in race_ids or FIT_RACES:
        laps = pd.read_parquet(Path(raw_dir) / f"{rid}.parquet")
        for _g0, g1 in restart_queues(laps):
            samples.append((rid, g1[: FIT_PLACES + 1]))
    known = [d for d in (dirty_air(r, races_dir) for r in {r for r, _ in samples}) if d is not None]
    fallback = float(np.median(known)) if known else 0.0
    dirty = {r: dirty_air(r, races_dir) for r, _ in samples}
    k_of = [np.arange(len(g1)) for _, g1 in samples]
    if baseline == "sim":
        sim = np.array(SIM_RESTART_SPREAD)
        base = [BUNCH_GAP * k + sim[k] for k in k_of]
    else:
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
