"""Reconstruct a 1983-1995 race lap by lap from its real anchors (eras build plan 4.6, roadmap P3).

No lap times exist before 1996, so a race from those years is rebuilt: a synthetic raw parquet
(ingest.LAP_COLUMNS) and status JSON, so cleaning, fitting and assembly run unchanged, that
hits every fact the sources do give:

- the grid order (Jolpica): the lap-1 order is the grid order (no first-lap passes invented);
- the exact classification (Jolpica): finishing_order() on the parquet is Jolpica's order;
- lead-lap gaps within 2 s (Jolpica's race times; in practice they come out exact);
- each driver's fastest lap, its time on the right lap (F1DB);
- each retirement's laps completed (Jolpica), on a lap events.retirement_events can see;
- each lapped car's laps behind (it crosses the line after the winner on its last lap);
- real stops: F1DB's (1994-95) or a sourced facts file (docs/reconstruction-facts.md);
- safety cars only where a facts file sources them (none before 1993).

Anything else is estimated and marked: the sidecar <race-id>.reconstruction.json carries the
race file's `reconstructed: true` and `provenance` (kind "reconstructed", `estimated`), the
estimates in words, the solver's parameters and the anchor report (each anchor's target,
what was achieved, pass or fail). <race-id>.anchors.md is the same report for people.

The solver. Each car's lap time is

    lap(l) = b + w * (tyre age - 1) + FUEL * fuel laps on board + pit loss + sigma * z(l)

with z a seeded normal draw per car (deterministic: sha256 of race, seed and driver). The
cars decouple once each has a target for its time at its last lap:
- lead-lap finishers: their official race time;
- lapped finishers: just after the winner, in classification order, inside the window where
  they are exactly their laps down; classified retirements in classification order;
- retirements: their natural time at the field's pace (F1DB fastest lap + the lead-lap
  finishers' median pace offset), early enough to be seen as a retirement.
Then per car: the noise's lowest draw is moved onto the fastest-lap lap; the wear w and the
car's noise scale are searched on a grid (w in [0, wear_max], noise x SEARCH), b following
from the total, for the laps that best fit both anchors (the fewest laps forced up to the
fastest-lap floor, the fastest lap closest to the model, w and the noise near their priors);
and the laps are pinned where the anchors fix them (lap 1 from the grid, the fastest lap,
SC laps).
A projection then finds the closest laps (least squares) that keep the total exactly, every
other lap at least FASTEST_MARGIN slower than the fastest lap, and pit losses in place
(x = max(model + lambda, floor), lambda by bisection). Safety cars are iterated: SC laps are
pinned at SC pace and the queue closes up, then the green laps are re-solved. An outer loop
checks the anchors on the written frame and shrinks the noise until they hold.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path

import numpy as np
import pandas as pd

from . import events, jolpica
from .ingest import LAP_COLUMNS, raw_snapshot_path, track_status_path
from .paths import DATA_DIR, RAW_DIR

FIRST_YEAR, LAST_YEAR = 1983, 1995
FIRST_SC_YEAR = 1993  # no safety car is sourced in a race before 1993
REFUEL_FROM = 1994  # cars refuel at their stops (fuel laps reset); before, they start full
FACTS_DIR = DATA_DIR / "reconstruction"
F1DB_DIR = RAW_DIR / "f1db"
GREEN, SC = "1", "4"  # FastF1 track status codes
FINISHED = ("finished", "lapped")


# --- Anchors -----------------------------------------------------------------------------


@dataclass(frozen=True)
class Stop:
    lap: int  # the in-lap (official numbering)
    lane_time: float | None  # pit-lane seconds, None where the source has none
    source: str


@dataclass
class Car:
    driver: str
    team: str
    number: int | None
    grid: int | None  # 0 or None: from the pit lane
    position: int | None
    classified: bool
    status: str  # jolpica.STATUS names: finished, lapped, accident, retired, disqualified
    laps: int  # laps completed
    time: float | None  # race time (s), lead-lap finishers only
    fastest_time: float | None = None
    fastest_lap: int | None = None
    stops: list[Stop] = field(default_factory=list)

    @property
    def finished(self) -> bool:
        return self.status in FINISHED


@dataclass(frozen=True)
class SafetyCar:
    start: int  # first race lap (leader's lap) run behind the safety car
    end: int  # last
    source: str


@dataclass
class Anchors:
    race_id: str
    year: int
    laps: int  # the winner's laps
    cars: list[Car]
    safety_cars: list[SafetyCar] = field(default_factory=list)
    stops_complete: bool = False  # every car's stops are known
    safety_cars_complete: bool = False  # every safety car is known
    sources: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def car(self, driver: str) -> Car:
        return next(c for c in self.cars if c.driver == driver)


@dataclass(frozen=True)
class Params:
    """The solver's estimated constants (all reported in the sidecar)."""

    seed: int = 0
    sigma: float = 0.35  # lap-time noise (s), shrunk by the outer loop if an anchor fails
    fuel_per_lap: float = 0.06  # s per lap of fuel on board
    wear_prior: float = 0.04  # s per lap of tyre age, when the anchors can't fix it
    wear_max: float = 0.25
    start_loss: float = 4.0  # the pole sitter's standing start (s over a flying lap)
    grid_gap: float = 0.6  # lap-1 time per grid slot behind the pole sitter
    fastest_margin: float = 0.05  # every other lap at least this much slower
    pit_bypass: float = 5.0  # track time the pit lane replaces: loss = lane time - bypass
    pit_in_share: float = 0.35  # share of the stop's loss on the in-lap (rest on the out-lap)
    default_lane_time: float = 25.0  # a stop with no lane time, when the race has none
    sc_factor: float = 1.4  # SC lap = sc_factor x the field's median pace
    sc_gap: float = 0.8  # s between cars in the SC queue
    sc_iterations: int = 12
    order_gap: float = 0.5  # s between classified cars on the same lap at the flag
    gap_tolerance: float = 2.0  # lead-lap gap anchor
    attempts: int = 6  # outer loop: noise x0.7 per failed attempt
    refuel: bool | None = None  # None: by year (REFUEL_FROM)


# --- Loading the anchors -------------------------------------------------------------------


def race_year(race_id: str) -> int:
    match = re.fullmatch(r"(.+)-(\d{4})", race_id)
    if not match:
        raise ValueError(f"can't read a year from '{race_id}'")
    return int(match.group(2))


def facts_path(race_id: str, facts_dir: Path = FACTS_DIR) -> Path:
    return facts_dir / f"{race_id}.json"


def load_facts(race_id: str, facts_dir: Path = FACTS_DIR) -> dict | None:
    """The race's hand-entered facts file (docs/reconstruction-facts.md), checked: every stop
    and safety car names its source, and no safety car before 1993."""
    path = facts_path(race_id, facts_dir)
    if not path.exists():
        return None
    facts = json.loads(path.read_text())
    if facts.get("raceId") not in (None, race_id):
        raise ValueError(f"{path}: raceId {facts['raceId']!r} is not {race_id!r}")
    for kind in ("stops", "safetyCars"):
        for i, item in enumerate(facts.get(kind, [])):
            if not str(item.get("source") or "").strip():
                raise ValueError(f"{path}: {kind}[{i}] has no source")
    for i, s in enumerate(facts.get("stops", [])):
        if "lap" not in s or not ("driver" in s or "number" in s):
            raise ValueError(f"{path}: stops[{i}] needs a lap and a driver or number")
    for i, sc in enumerate(facts.get("safetyCars", [])):
        if not 1 <= int(sc["startLap"]) <= int(sc["endLap"]):
            raise ValueError(f"{path}: safetyCars[{i}] laps {sc['startLap']}-{sc['endLap']}")
    if facts.get("safetyCars") and race_year(race_id) < FIRST_SC_YEAR:
        raise ValueError(f"{path}: safety cars sourced before {FIRST_SC_YEAR}")
    return facts


def _norm(text: str) -> str:
    return jolpica._norm(str(text).replace("-", " ").replace("_", " "))


def _f1db_rows(path: Path, cars: list[Car], names: dict[str, str]) -> tuple[dict, list[str]]:
    """F1DB rows keyed by our driver code: by car number, else by name (F1DB driver id)."""
    if not path.exists():
        return {}, []
    df = pd.read_csv(path, dtype={"number": str})
    by_number: dict[int, list[Car]] = {}
    for c in cars:
        if c.number is not None:
            by_number.setdefault(c.number, []).append(c)
    by_name = {names[c.driver]: c for c in cars}
    out: dict[str, list[dict]] = {}
    missing = []
    for r in df.to_dict("records"):
        num = int(r["number"]) if pd.notna(r["number"]) else None
        hit = by_number.get(num, []) if num is not None else []
        car = hit[0] if len(hit) == 1 else by_name.get(_norm(r["driver_id"]))
        if car is None:
            missing.append(f"{path.name}: no car for F1DB {r['driver_id']} (#{r['number']})")
            continue
        out.setdefault(car.driver, []).append(r)
    return out, missing


def load_anchors(
    race_id: str,
    dump_dir: Path | None = None,
    f1db_dir: Path = F1DB_DIR,
    facts_dir: Path = FACTS_DIR,
    drivers_path: Path = jolpica.DRIVERS_PATH,
    event: str | None = None,
    round_number: int | None = None,
) -> Anchors:
    """A 1983-1995 race's anchors from the Jolpica dump, F1DB's committed CSVs
    (data/raw/f1db/) and the race's facts file, if any."""
    from . import f1db

    year = race_year(race_id)
    if not FIRST_YEAR <= year <= LAST_YEAR:
        raise ValueError(f"{race_id}: reconstruction is for {FIRST_YEAR}-{LAST_YEAR} races")
    if dump_dir is None:
        dump_dir = jolpica.latest_dump(f1db.eras_cache_dir() / "jolpica")
    dump_dir = Path(dump_dir)
    dump = jolpica.Dump(dump_dir)
    if event is None and round_number is None:
        event = race_id.rsplit("-", 1)[0].replace("-", " ")
    race = jolpica.find_race(dump, year, event, round_number)
    ents = jolpica.entries(dump, race.session_id)
    codes = jolpica.driver_codes(ents, jolpica.repo_codes(drivers_path))
    notes: list[str] = []
    cars: list[Car] = []
    names: dict[str, str] = {}
    for e in ents.itertuples():
        if pd.isna(e.status) or int(e.status) >= jolpica.DID_NOT_START:
            continue
        status = jolpica.STATUS.get(int(e.status), str(e.status))
        laps = int(e.laps) if pd.notna(e.laps) else 0
        code = codes.by_entry[e.entry_id]
        if status == "disqualified" and laps == 0:
            notes.append(f"{code}: disqualified without a lap ({e.detail}); left out")
            continue
        names[code] = _norm(f"{e.forename} {e.surname}")
        cars.append(
            Car(
                driver=code,
                team=str(e.team),
                number=int(e.number) if pd.notna(e.number) else None,
                grid=int(e.grid) if pd.notna(e.grid) else None,
                position=int(e.position) if pd.notna(e.position) else None,
                classified=bool(e.classified),
                status=status,
                laps=laps,
                time=float(e.time) if pd.notna(e.time) and status in FINISHED else None,
            )
        )
    winner = next((c for c in cars if c.position == 1), None)
    if winner is None or not winner.laps or winner.time is None:
        raise jolpica.IncompleteDataError(f"{race_id}: no winner with a race time in Jolpica")
    for c in cars:
        if c.time is not None and c.laps != winner.laps:
            c.time = None  # a race time is only an anchor on the lead lap
    for d in codes.no_code:
        notes.append(f"no driver code for {d['name']}: '{d['reference']}' used ({d['why']})")

    fastest, missing = _f1db_rows(f1db_dir / f"{race_id}.fastest-laps.csv", cars, names)
    notes += missing
    for code, rows in fastest.items():
        r = rows[0]
        car = next(c for c in cars if c.driver == code)
        car.fastest_time = float(r["time"])
        car.fastest_lap = int(r["lap"]) if pd.notna(r["lap"]) else None
    f1db_stops, missing = _f1db_rows(f1db_dir / f"{race_id}.stops.csv", cars, names)
    notes += missing
    source_meta = f1db_dir / "source.json"
    f1db_version = (
        json.loads(source_meta.read_text()).get("version") if source_meta.exists() else None
    )
    f1db_source = f"F1DB {f1db_version or ''}".strip() + f" ({f1db_dir.name}/{race_id}.stops.csv)"

    facts = load_facts(race_id, facts_dir)
    stops_complete = False
    if f1db_stops:
        for code, rows in f1db_stops.items():
            car = next(c for c in cars if c.driver == code)
            car.stops = [
                Stop(
                    int(r["lap"]),
                    float(r["lane_time"]) if pd.notna(r["lane_time"]) else None,
                    f1db_source,
                )
                for r in sorted(rows, key=lambda r: int(r["stop"]))
            ]
        stops_complete = True
        if facts and facts.get("stops"):
            notes.append("facts file stops ignored: F1DB has this race's stops")
    elif facts:
        by_number = {c.number: c for c in cars if c.number is not None}
        for i, s in enumerate(facts.get("stops", [])):
            car = (
                next((c for c in cars if c.driver == s["driver"]), None)
                if "driver" in s
                else by_number.get(int(s["number"]))
            )
            if car is None:
                raise ValueError(f"facts stops[{i}]: no car {s.get('driver', s.get('number'))}")
            lane = s.get("laneTime")
            car.stops.append(
                Stop(int(s["lap"]), None if lane is None else float(lane), s["source"])
            )
        for car in cars:
            car.stops.sort(key=lambda s: s.lap)
        stops_complete = bool(facts.get("complete", {}).get("stops", False))
    safety_cars = [
        SafetyCar(int(sc["startLap"]), int(sc["endLap"]), sc["source"])
        for sc in (facts or {}).get("safetyCars", [])
    ]
    sc_complete = year < FIRST_SC_YEAR or bool(
        (facts or {}).get("complete", {}).get("safetyCars", False)
    )
    for car in cars:
        kept = [s for s in car.stops if s.lap <= car.laps]
        for s in car.stops:
            if s.lap > car.laps:
                notes.append(f"{car.driver}: stop on lap {s.lap}, the lap it retired on; not run")
        car.stops = kept
    incidents = DATA_DIR / "incidents.json"
    if incidents.exists():
        for item in json.loads(incidents.read_text()).get(race_id) or []:
            notes.append(
                f"incident (not modelled): lap {item.get('lap')} {item.get('type')}"
                f" {item.get('driver')}: {item.get('detail') or item.get('status')}"
            )
    return Anchors(
        race_id=race_id,
        year=year,
        laps=winner.laps,
        cars=cars,
        safety_cars=safety_cars,
        stops_complete=stops_complete,
        safety_cars_complete=sc_complete,
        sources={
            "jolpica": f"Jolpica-F1 dump {jolpica.dump_version(dump_dir)} (CC BY-NC-SA 4.0)",
            "f1db": f"F1DB {f1db_version} (CC BY 4.0), {f1db_dir.name}/{race_id}.*.csv",
            "facts": str(facts_path(race_id, facts_dir).name) if facts else None,
            "jolpicaRound": race.round_number,
            "eventName": race.name,
        },
        notes=notes,
    )


# --- The per-car lap model -----------------------------------------------------------------


@dataclass
class Features:
    """Per lap of one car (index 0 = lap 1)."""

    age: np.ndarray  # tyre age, 1 on lap 1 and on each out-lap
    stint: np.ndarray
    fuel: np.ndarray  # laps of fuel on board at the lap's start
    pit: np.ndarray  # stop loss on the in- and out-laps (s)
    in_lap: np.ndarray  # bool
    out_lap: np.ndarray  # bool
    out_share: dict[int, float]  # out-lap number -> s from PitInTime to PitOutTime


def lane_times(anchors: Anchors, p: Params) -> float:
    known = [s.lane_time for c in anchors.cars for s in c.stops if s.lane_time is not None]
    # Repairs (minutes in the pits) aren't typical stops.
    known = [t for t in known if t < 3 * p.default_lane_time]
    return float(np.median(known)) if known else p.default_lane_time


def features(
    car: Car,
    total: int,
    refuel: bool,
    typical_lane: float,
    p: Params,
    typical_stint: int | None = None,
) -> Features:
    """The car's lap features. With refuelling, each stint carries the fuel to the next stop;
    a retired car's last stint the fuel for a typical stint (its plan is unknown)."""
    n = car.laps
    stop_at = {s.lap: s for s in car.stops}
    age, stint, fuel, pit = (np.zeros(n) for _ in range(4))
    in_lap, out_lap = np.zeros(n, bool), np.zeros(n, bool)
    out_share: dict[int, float] = {}
    last, s = 0, 1
    ends = sorted(stop_at)
    for i in range(n):
        lap = i + 1
        if lap - 1 in stop_at:
            stop = stop_at[lap - 1]
            lane = stop.lane_time if stop.lane_time is not None else typical_lane
            loss = max(lane - p.pit_bypass, 0.0)
            pit[i] += (1 - p.pit_in_share) * loss
            out_lap[i] = True
            out_share[lap] = (1 - p.pit_in_share) * lane
            last, s = lap - 1, s + 1
        if lap in stop_at:
            stop = stop_at[lap]
            lane = stop.lane_time if stop.lane_time is not None else typical_lane
            pit[i] += p.pit_in_share * max(lane - p.pit_bypass, 0.0)
            in_lap[i] = True
        age[i] = lap - last
        stint[i] = s
        if refuel:
            nxt = next((e for e in ends if e >= lap), None)
            if nxt is None:
                nxt = total
                if not car.finished and typical_stint:
                    nxt = min(total, last + typical_stint)
            fuel[i] = max(nxt - lap + 1, 1)
        else:
            fuel[i] = total - lap + 1
    return Features(age, stint, fuel, pit, in_lap, out_lap, out_share)


def typical_stint(anchors: Anchors) -> int | None:
    """The finishers' median stint length (laps), from their stops; None without stops."""
    lengths = []
    for c in anchors.cars:
        if c.finished and c.stops:
            ends = [0, *sorted(s.lap for s in c.stops), c.laps]
            lengths += [b - a for a, b in zip(ends, ends[1:], strict=False) if b > a]
    return int(np.median(lengths)) if lengths else None


def noise(race_id: str, seed: int, driver: str, n: int) -> np.ndarray:
    """The car's seeded standard-normal draws, clipped at 2.5 sd (deterministic)."""
    digest = hashlib.sha256(f"{race_id}:{seed}:{driver}".encode()).digest()
    rng = np.random.default_rng(int.from_bytes(digest[:8], "little"))
    return np.clip(rng.standard_normal(n), -2.5, 2.5)


SEARCH = (0.5, 0.75, 1.0, 1.5, 2.0, 3.0)  # noise scales tried, x the race's sigma


@dataclass
class Fit:
    laps: np.ndarray
    b: float
    w: float
    feasible: bool = True
    sigma: float = 0.0


def project(model: np.ndarray, floor: np.ndarray, total: float) -> tuple[np.ndarray, bool]:
    """The laps closest to `model` (least squares) summing to `total` with each lap at least
    its floor: x = max(model + lam, floor), lam by bisection. False if the floors exceed it."""
    if len(model) == 0:
        return model.copy(), abs(total) < 1e-6
    if floor.sum() > total + 1e-9:
        return floor.copy(), False
    lo, hi = float((floor - model).min()) - 1.0, float(total - model.sum()) / len(model) + 1.0
    hi = max(hi, lo + 1.0)
    while np.maximum(model + hi, floor).sum() < total:
        hi += abs(hi) + 1.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if np.maximum(model + mid, floor).sum() < total:
            lo = mid
        else:
            hi = mid
    x = np.maximum(model + hi, floor)
    x[np.argmax(x - floor)] += total - x.sum()  # exact to the float
    return x, True


def fit_car(
    car: Car,
    feat: Features,
    z: np.ndarray,
    p: Params,
    sigma: float,
    total: float | None,
    pins: dict[int, float],
    pace: tuple[float, float] | None = None,
) -> Fit:
    """One car's laps. With `total`, the car's pace b, wear w and noise scale are solved from
    the total and the fastest lap (a grid search over w and the noise scale, b from the
    total; see SEARCH); without, `pace` (b, w) and `sigma` give the natural laps. Pinned laps
    (lap -> s) are kept; the rest are projected to the total, never faster than the fastest
    lap + margin."""
    n = car.laps
    z = z.copy()
    f_time, f_lap = car.fastest_time, car.fastest_lap
    has_f = f_time is not None and f_lap is not None and 1 <= f_lap <= n
    if has_f:
        j = int(np.argmin(z))
        z[j], z[f_lap - 1] = z[f_lap - 1], z[j]
    a = feat.age - 1
    fixed = dict(pins)
    if has_f:
        fixed[f_lap] = f_time
    free = np.array([i for i in range(n) if i + 1 not in fixed], int)
    pinned_sum = sum(fixed.values())
    floor_base = f_time + p.fastest_margin if f_time is not None else -math.inf
    base_c = p.fuel_per_lap * feat.fuel + feat.pit
    if pace is not None:
        b, w = pace
    elif total is not None and len(free):
        rest, nf = total - pinned_sum, len(free)
        best = None
        for w_try in np.linspace(0.0, p.wear_max, 11):
            for scale in SEARCH:
                s_try = sigma * scale
                c_try = base_c + s_try * z
                b_try = (rest - w_try * a[free].sum() - c_try[free].sum()) / nf
                m = b_try + w_try * a + c_try
                cost = float((np.maximum(floor_base + feat.pit[free] - m[free], 0) ** 2).sum())
                if has_f:
                    cost += (m[f_lap - 1] - f_time) ** 2
                cost += 10 * (w_try - p.wear_prior) ** 2 + (s_try - sigma) ** 2
                if best is None or cost < best[0]:
                    best = (cost, b_try, w_try, s_try)
        _, b, w, sigma = best
    else:
        b, w = (f_time or 90.0), p.wear_prior
    c = base_c + sigma * z
    model = b + w * a + c
    if f_time is not None and not has_f and len(free):
        k = int(free[np.argmin(model[free] - feat.pit[free])])
        fixed[k + 1] = f_time
        free = free[free != k]
        pinned_sum += f_time
    x = model.copy()
    for lap, value in fixed.items():
        x[lap - 1] = value
    if total is None:
        total = float(x.sum())
    if not math.isfinite(floor_base):
        floor_base = 0.5 * b
    floor = floor_base + feat.pit[free]
    xf, ok = project(model[free], floor, total - pinned_sum)
    x[free] = xf
    if not len(free):
        ok = abs(x.sum() - total) < 1e-6
    return Fit(x, float(b), float(w), ok, float(sigma))


# --- The solver ------------------------------------------------------------------------------


@dataclass
class Solution:
    laps: dict[str, np.ndarray]  # driver -> lap times
    feats: dict[str, Features]
    sc_laps: dict[str, set[int]]  # driver -> own laps run behind the SC
    targets: dict[str, float]
    sigma: float
    notes: list[str]
    fitted: dict[str, dict] = field(default_factory=dict)  # driver -> pace, wear, noise


def grid_order(cars: list[Car]) -> list[Car]:
    """Starters in grid order, pit-lane starters (grid 0 or none) last."""
    starters = [c for c in cars if c.laps >= 1]
    return sorted(starters, key=lambda c: (not c.grid, c.grid or 0, c.position or 99))


def _cum(x: np.ndarray) -> np.ndarray:
    return np.concatenate([[0.0], np.cumsum(x)])


def targets(
    anchors: Anchors, natural: dict[str, float], est_lap: dict[str, float], p: Params
) -> tuple[dict[str, float], list[str]]:
    """Each car's time at its last lap: the official time on the lead lap; for the rest,
    its natural time moved into the window its anchors allow (see the module docstring).

    Classified cars on the same lap keep their classification order, order_gap apart (a
    forward then a backward pass inside their windows). A lapped finisher's window is from
    just after the winner's flag to 3/4 of a lap later (so it's exactly its laps down); a
    retirement's ends early enough for events.retirement_events to see it."""
    lead = [c for c in anchors.cars if c.time is not None]
    t_win = min(c.time for c in lead)
    t_last = max(c.time for c in lead)
    typical = float(np.median([c.time / c.laps for c in lead]))
    # retirement_events sees a car stopped 1.5 median laps before the flag; the median over
    # every car's laps is slower than the lead-lap average, hence the 20% margin.
    seen = t_last - 1.8 * typical - 2.0
    notes = []
    out: dict[str, float] = {}
    classified = sorted(
        (c for c in anchors.cars if c.classified and c.position and c.laps >= 1),
        key=lambda c: c.position,
    )
    groups: list[list[Car]] = []
    for car in classified:
        if groups and groups[-1][0].laps == car.laps:
            groups[-1].append(car)
        else:
            groups.append([car])
    for group in groups:
        lo, hi, want = [], [], []
        for car in group:
            if car.time is not None:
                lo.append(car.time), hi.append(car.time)
            elif car.finished:
                lapped = car.laps < anchors.laps
                lo.append(t_win + p.order_gap)
                hi.append(t_win + 0.75 * est_lap[car.driver] if lapped else math.inf)
            else:
                lo.append(-math.inf), hi.append(seen)
            want.append(car.time if car.time is not None else natural[car.driver])
        s = [min(max(w, a), b) for w, a, b in zip(want, lo, hi, strict=True)]
        # Cars slower than their window allows are spread over its rest, not piled at its end.
        capped = [
            k
            for k, (w, a, b) in enumerate(zip(want, lo, hi, strict=True))
            if w > b and math.isfinite(a) and group[k].time is None
        ]
        if capped:
            first = capped[0]
            base = max(s[first - 1] if first else lo[first], lo[first])
            top = min(hi[k] for k in capped)
            for j, k in enumerate(capped, 1):
                s[k] = base + (top - base) * j / (len(capped) + 1)
        # Classification order: forward (keeping each car after the one ahead), then backward
        # (keeping each under its window's end).
        for k in range(1, len(s)):
            if group[k].time is None:
                s[k] = max(s[k], s[k - 1] + p.order_gap)
        for k in range(len(s) - 2, -1, -1):
            if group[k].time is None:
                s[k] = min(s[k], hi[k], s[k + 1] - p.order_gap)
        for car, v, a, b in zip(group, s, lo, hi, strict=True):
            if car.time is None and not a - 1e-9 <= v <= b + 1e-9:
                notes.append(f"{car.driver}: no time fits both its classification and its window")
            out[car.driver] = v
    for car in anchors.cars:
        if car.driver not in out and car.laps >= 1:
            out[car.driver] = min(natural[car.driver], seen)
    return out, notes


def _leader_times(times: dict[str, np.ndarray], upto: int) -> np.ndarray:
    """The leader's time at the end of each lap 0..upto (min over cars)."""
    lead = np.full(upto + 1, np.inf)
    lead[0] = 0.0
    for t in times.values():
        m = min(len(t) - 1, upto)
        lead[: m + 1] = np.minimum(lead[: m + 1], t[: m + 1])
    return lead


def sc_pins(
    anchors: Anchors,
    laps: dict[str, np.ndarray],
    feats: dict[str, Features],
    pace: float,
    p: Params,
) -> tuple[dict[str, dict[int, float]], dict[str, set[int]]]:
    """SC laps pinned at SC pace, the queue closed up to sc_gap on each car's last SC lap.
    A car's own lap runs behind the SC when it starts between the leader starting race lap
    `start` and finishing race lap `end`."""
    times = {d: _cum(x) for d, x in laps.items()}
    lead = _leader_times(times, anchors.laps)
    pins: dict[str, dict[int, float]] = {d: {} for d in laps}
    under: dict[str, set[int]] = {d: set() for d in laps}
    sc_lap = p.sc_factor * pace
    for sc in anchors.safety_cars:
        t0, t1 = lead[sc.start - 1], lead[min(sc.end, anchors.laps)]
        ends = []
        for d, t in times.items():
            car = anchors.car(d)
            mine = [lap for lap in range(1, len(t)) if t0 - 1e-6 <= t[lap - 1] < t1]
            mine = [lap for lap in mine if lap != car.fastest_lap]
            if not mine:
                continue
            floor = (car.fastest_time or 0.0) + p.fastest_margin
            for lap in mine:
                pins[d][lap] = max(sc_lap, floor) + feats[d].pit[lap - 1]
            under[d].update(mine)
            end = t[mine[0] - 1] + sum(pins[d][lap] for lap in mine)
            room = sum(pins[d][lap] - floor - feats[d].pit[lap - 1] for lap in mine)
            ends.append((end, d, mine, room))
        ends.sort()
        prev_end = None
        for end, d, mine, room in ends:
            new = end if prev_end is None else max(prev_end + p.sc_gap, end - room)
            close = (end - new) / len(mine)
            for lap in mine:
                pins[d][lap] -= close
            prev_end = new
    return pins, under


def solve(anchors: Anchors, p: Params, sigma: float | None = None) -> Solution:
    sigma = p.sigma if sigma is None else sigma
    total = anchors.laps
    refuel = p.refuel if p.refuel is not None else anchors.year >= REFUEL_FROM
    lane = lane_times(anchors, p)
    running = [c for c in anchors.cars if c.laps >= 1]
    stint = typical_stint(anchors)
    feats = {c.driver: features(c, total, refuel, lane, p, stint) for c in running}
    zs = {c.driver: noise(anchors.race_id, p.seed, c.driver, c.laps) for c in running}
    notes: list[str] = []

    # Pass 1: the lead-lap finishers' pace from their race times and fastest laps.
    lead = [c for c in running if c.time is not None]
    fits = {c.driver: fit_car(c, feats[c.driver], zs[c.driver], p, sigma, c.time, {}) for c in lead}
    offsets = [f.b - c.fastest_time for c in lead if (f := fits[c.driver]) and c.fastest_time]
    b_off = float(np.median(offsets)) if offsets else 2.0
    w_med = float(np.median([f.w for f in fits.values()]))
    b_med = float(np.median([f.b for f in fits.values()]))
    f_med = float(np.median([c.fastest_time for c in running if c.fastest_time] or [b_med]))

    # Lap 1 from the grid: the pole sitter's standing start, then grid_gap per slot.
    lap1 = b_med + p.fuel_per_lap * feats[lead[0].driver].fuel[0] + p.start_loss
    grid_pins: dict[str, dict[int, float]] = {}
    for rank, c in enumerate(grid_order(running)):
        if c.fastest_lap == 1:
            notes.append(f"{c.driver}: fastest lap on lap 1, its lap-1 time is the fastest lap's")
            grid_pins[c.driver] = {}
            continue
        pin = lap1 + rank * p.grid_gap
        if c.fastest_time is not None and pin < c.fastest_time + p.fastest_margin:
            pin = c.fastest_time + p.fastest_margin + 0.1  # may break the grid order (checked)
        grid_pins[c.driver] = {1: pin + feats[c.driver].pit[0]}

    # Natural times for everyone else (with the laps pinned so far), then the targets.
    est_lap = {
        c.driver: (c.fastest_time or f_med) + b_off + p.fuel_per_lap * (total / 2) for c in running
    }

    def goals(pins: dict[str, dict[int, float]]) -> dict[str, float]:
        natural = {}
        for c in running:
            if c.time is not None:
                natural[c.driver] = c.time
                continue
            pace = ((c.fastest_time or f_med) + b_off, w_med)
            nat = fit_car(c, feats[c.driver], zs[c.driver], p, sigma, None, pins[c.driver], pace)
            natural[c.driver] = float(nat.laps.sum())
        goal, why = targets(anchors, natural, est_lap, p)
        notes.extend(why)
        return goal

    def run(pins: dict[str, dict[int, float]], goal: dict[str, float]) -> dict[str, np.ndarray]:
        out = {}
        for c in running:
            fit = fit_car(
                c, feats[c.driver], zs[c.driver], p, sigma, goal[c.driver], pins[c.driver]
            )
            if not fit.feasible and (c.time is not None or c.classified):
                notes.append(f"{c.driver}: target {goal[c.driver]:.1f}s not reachable")
            out[c.driver] = fit.laps
            fitted[c.driver] = {
                "pace": round(fit.b, 3),
                "wear": round(fit.w, 4),
                "noise": round(fit.sigma, 3),
                "target": round(goal[c.driver], 3),
            }
        return out

    fitted: dict[str, dict] = {}
    goal = goals(grid_pins)
    laps = run(grid_pins, goal)
    under: dict[str, set[int]] = {c.driver: set() for c in running}
    # Safety cars: pin the laps behind it, re-solve, until the laps behind it settle (the
    # laps pinned are the laps the final times put behind it).
    for sc in anchors.safety_cars:
        for c in running:
            if c.fastest_lap is not None and sc.start <= c.fastest_lap <= sc.end:
                notes.append(
                    f"{c.driver}: fastest lap (lap {c.fastest_lap}) in the safety car's laps"
                    f" {sc.start}-{sc.end}; kept at racing speed"
                )
    for _ in range(p.sc_iterations if anchors.safety_cars else 0):
        sc, under = sc_pins(anchors, laps, feats, b_med, p)
        pins = {d: {**grid_pins[d], **sc[d]} for d in grid_pins}
        goal = goals(pins)
        laps = run(pins, goal)
        if sc_pins(anchors, laps, feats, b_med, p)[1] == under:
            break
    else:
        if anchors.safety_cars:
            notes.append("the laps behind the safety car did not settle")
    notes = sorted(set(notes), key=notes.index)
    return Solution(laps, feats, under, goal, sigma, notes, fitted)


# --- The raw snapshot --------------------------------------------------------------------


def laps_frame(anchors: Anchors, sol: Solution) -> pd.DataFrame:
    """The solution as the raw parquet's rows (ingest.LAP_COLUMNS), as jolpica.laps_frame
    writes them: Time is seconds from the start; a car out on lap 1 has lap 1 untimed at 0."""
    rows = []
    for car in anchors.cars:
        if car.laps < 1:
            rows.append(
                {
                    **dict.fromkeys(LAP_COLUMNS),
                    "Driver": car.driver,
                    "Team": car.team,
                    "LapNumber": 1.0,
                    "Time": 0.0,
                    "Stint": 1.0,
                    "TyreLife": 1.0,
                    "TrackStatus": GREEN,
                    "IsAccurate": False,
                }
            )
            continue
        feat = sol.feats[car.driver]
        x = np.round(sol.laps[car.driver], 3)
        t = np.round(_cum(x), 3)  # LapTime sums to Time exactly, as in jolpica.py
        for i in range(car.laps):
            lap = i + 1
            under = lap in sol.sc_laps.get(car.driver, ())
            pit_in = float(t[lap]) if feat.in_lap[i] else None
            pit_out = round(float(t[lap - 1] + feat.out_share[lap]), 3) if feat.out_lap[i] else None
            rows.append(
                {
                    "Driver": car.driver,
                    "Team": car.team,
                    "LapNumber": float(lap),
                    "LapTime": float(x[i]),
                    "Time": float(t[lap]),
                    "Compound": None,
                    "TyreLife": float(feat.age[i]),
                    "Stint": float(feat.stint[i]),
                    "PitInTime": pit_in,
                    "PitOutTime": pit_out,
                    "TrackStatus": SC if under else GREEN,
                    "Position": None,
                    "IsAccurate": not (lap == 1 or feat.in_lap[i] or feat.out_lap[i] or under),
                }
            )
    df = pd.DataFrame(rows, columns=LAP_COLUMNS)
    timed = df["LapTime"].notna()
    for col in ("LapNumber", "LapTime", "Time", "TyreLife", "Stint", "PitInTime", "PitOutTime"):
        df[col] = df[col].astype("float64")
    pos = df[timed].groupby("LapNumber")["Time"].rank(method="first")
    df["Position"] = pos.reindex(df.index).astype("float64")
    df["IsAccurate"] = df["IsAccurate"].astype(bool)
    df["TrackStatus"] = df["TrackStatus"].astype(str)
    return df.sort_values(["LapNumber", "Time"]).reset_index(drop=True)


def track_status(anchors: Anchors, df: pd.DataFrame) -> list[dict]:
    """[{time, status}]: green from the start, each sourced SC from the leader's lap before it
    to the end of its last lap."""
    out = [{"time": 0.0, "status": GREEN}]
    lead = df[df["Position"] == 1].set_index("LapNumber")["Time"]
    for sc in anchors.safety_cars:
        start = float(lead.get(float(sc.start - 1), 0.0)) if sc.start > 1 else 0.0
        end = float(lead.get(float(min(sc.end, anchors.laps)), lead.max()))
        out += [{"time": round(start, 3), "status": SC}, {"time": round(end, 3), "status": GREEN}]
    return out


# --- The anchor report ----------------------------------------------------------------------


def _row(anchor: str, subject: str, target, achieved, passed: bool | None) -> dict:
    return {
        "anchor": anchor,
        "subject": subject,
        "target": target,
        "achieved": achieved,
        "pass": passed,
    }


def check_anchors(anchors: Anchors, df: pd.DataFrame, p: Params) -> list[dict]:
    """Every anchor against the written frame: target, achieved, pass (None: not checkable)."""
    from .assemble import finishing_order

    out: list[dict] = []
    timed = df[df["LapTime"].notna()]
    by_car = {d: g.sort_values("LapNumber") for d, g in timed.groupby("Driver")}

    starters = [c.driver for c in grid_order(anchors.cars)]
    lap1 = timed[timed["LapNumber"] == 1].sort_values("Time")["Driver"].tolist()
    out.append(_row("grid", "lap-1 order is the grid order", starters, lap1, lap1 == starters))

    classified = [
        c.driver for c in sorted(anchors.cars, key=lambda c: c.position or 999) if c.classified
    ]
    order = [d for d in finishing_order(df) if d in set(classified)]
    out.append(_row("order", "classification", classified, order, order == classified))

    lead = sorted((c for c in anchors.cars if c.time is not None), key=lambda c: c.time)
    total = anchors.laps
    end = {d: float(g["Time"].iloc[-1]) for d, g in by_car.items()}
    t_win = end[lead[0].driver]
    for c in lead[1:]:
        want = round(c.time - lead[0].time, 3)
        got = round(end[c.driver] - t_win, 3) if c.driver in end else None
        ok = got is not None and abs(got - want) <= p.gap_tolerance
        out.append(_row("gap", c.driver, want, got, ok))

    for c in anchors.cars:
        if c.fastest_time is None:
            continue
        g = by_car.get(c.driver)
        if g is None:
            out.append(_row("fastest", c.driver, [c.fastest_time, c.fastest_lap], None, False))
            continue
        best = g.loc[g["LapTime"].idxmin()]
        slower = (g["LapTime"] > best["LapTime"]).sum() == len(g) - 1
        got = [round(float(best["LapTime"]), 3), int(best["LapNumber"])]
        ok = abs(got[0] - c.fastest_time) < 5e-4 and slower
        if c.fastest_lap is not None:
            ok = ok and got[1] == c.fastest_lap
        out.append(_row("fastest", c.driver, [c.fastest_time, c.fastest_lap], got, bool(ok)))

    seen = {e["driver"] for e in events.retirement_events(df, total)}
    for c in anchors.cars:
        if c.finished:
            continue
        done = len(by_car.get(c.driver, ()))
        out.append(_row("retirement", c.driver, c.laps, done, done == c.laps))
        out.append(_row("retirement event", c.driver, True, c.driver in seen, c.driver in seen))

    for c in anchors.cars:
        if not c.finished or c.laps >= total:
            continue
        g = by_car.get(c.driver)
        t = g["Time"].to_numpy() if g is not None else np.array([])
        before = int((t < t_win).sum())
        got = total - (before + 1) if len(t) == c.laps else None
        out.append(_row("laps down", c.driver, total - c.laps, got, got == total - c.laps))

    for c in anchors.cars:
        g = by_car.get(c.driver)
        for s in c.stops:
            if g is None:
                out.append(_row("stop", c.driver, s.lap, None, False))
                continue
            row = g[g["LapNumber"] == s.lap]
            nxt = g[g["LapNumber"] == s.lap + 1]
            ok = len(row) == 1 and pd.notna(row["PitInTime"].iloc[0])
            if len(nxt):
                ok = ok and float(nxt["Stint"].iloc[0]) == float(row["Stint"].iloc[0]) + 1
            out.append(_row("stop", c.driver, s.lap, s.lap if ok else None, bool(ok)))

    leader = timed[timed["Position"] == 1]
    got_sc = sorted(int(n) for n in leader[leader["TrackStatus"] == SC]["LapNumber"])
    want_sc = sorted({n for sc in anchors.safety_cars for n in range(sc.start, sc.end + 1)})
    note = "sourced" if anchors.safety_cars_complete else "sourced (others unknown)"
    out.append(_row("safety car", f"leader's SC laps, {note}", want_sc, got_sc, got_sc == want_sc))
    return out


def summary(report: list[dict]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for r in report:
        s = out.setdefault(r["anchor"], {"pass": 0, "total": 0})
        s["total"] += 1
        s["pass"] += bool(r["pass"])
    return out


CORE = ("grid", "order", "gap", "fastest", "retirement", "laps down", "stop", "safety car")


def failures(report: list[dict]) -> list[dict]:
    """Failed anchors the solver must fix (the retirement event is reported, not required:
    a car that stops on its last lap can't be told from a finisher)."""
    return [r for r in report if r["anchor"] in CORE and r["pass"] is False]


# --- Provenance ----------------------------------------------------------------------------


def estimated(anchors: Anchors) -> list[str]:
    """The schema's provenance.estimated for the race file (race-model.schema.json)."""
    out = ["compounds", "fuelLoads", "weather"]
    if not anchors.safety_cars_complete:
        out.insert(1, "safetyCars")
    return out


def estimates_in_words(anchors: Anchors, p: Params) -> list[str]:
    refuel = p.refuel if p.refuel is not None else anchors.year >= REFUEL_FROM
    words = [
        "Every lap time and lap-end Time is synthetic: solved to the anchors, not measured",
        "Position each lap follows from the synthetic times; the lap-1 order is the grid order",
        "Lap times in between the anchors: pace + tyre wear + fuel + seeded noise",
        f"Fuel: {p.fuel_per_lap}s per lap of fuel on board;"
        + (" each stop refuels to the next stop" if refuel else " full tank at the start"),
        f"Stop loss: pit-lane time - {p.pit_bypass}s, {p.pit_in_share:.0%} on the in-lap",
        "PitInTime is the in-lap's end; PitOutTime adds the out-lap's share of the lane time",
        "Compound is left empty (one dry compound per race, estimated in step 2.4)",
        "No weather timeline: the race is assumed dry",
    ]
    if not anchors.stops_complete:
        words.append("Stops: only the sourced ones; cars may have stopped more (unknown)")
    if not anchors.safety_cars_complete:
        words.append("Safety cars: only the sourced ones (none found is not none run)")
    return words


def model_blocks(sidecar: dict) -> dict:
    """The race file's blocks for a reconstructed race: `reconstructed` and `provenance`."""
    return {"reconstructed": True, "provenance": dict(sidecar["provenance"])}


def mark_model(model: dict, sidecar: dict) -> dict:
    """A validated copy of an assembled race model marked reconstructed."""
    from . import export

    blocks = model_blocks(sidecar)
    out = export.with_eras_fields(model, provenance=blocks["provenance"])
    out["reconstructed"] = True
    export.validate_model(out)
    return out


# --- Running it ----------------------------------------------------------------------------


@dataclass
class Result:
    laps: pd.DataFrame
    status: list[dict]
    sidecar: dict


def reconstruct(anchors: Anchors, p: Params | None = None) -> Result:
    """Solve, check, and retry with less noise until the anchors hold (best attempt kept)."""
    p = p or Params()
    best = None
    sigma = p.sigma
    for attempt in range(1, p.attempts + 1):
        sol = solve(anchors, p, sigma)
        df = laps_frame(anchors, sol)
        report = check_anchors(anchors, df, p)
        failed = failures(report)
        if best is None or len(failed) < len(best[3]):
            best = (sol, df, report, failed, attempt)
        if not failed:
            break
        sigma *= 0.7
    sol, df, report, failed, attempt = best
    sidecar = {
        "raceId": anchors.race_id,
        "year": anchors.year,
        "laps": anchors.laps,
        "reconstructed": True,
        "provenance": {"kind": "reconstructed", "estimated": estimated(anchors)},
        "estimates": estimates_in_words(anchors, p),
        "sources": anchors.sources,
        "stopsComplete": anchors.stops_complete,
        "safetyCarsComplete": anchors.safety_cars_complete,
        "params": asdict(replace(p, sigma=sol.sigma)),
        "solver": {"attempts": attempt, "sigma": round(sol.sigma, 4), "passed": not failed},
        "fitted": sol.fitted,
        "summary": summary(report),
        "anchors": report,
        "notes": anchors.notes + sol.notes,
    }
    return Result(df, track_status(anchors, df), sidecar)


def sidecar_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    return raw_dir / f"{race_id}.reconstruction.json"


def report_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    return raw_dir / f"{race_id}.anchors.md"


def _fmt(value) -> str:
    if isinstance(value, list) and len(value) > 6:
        return f"{len(value)} cars: " + " ".join(map(str, value))
    return json.dumps(value) if isinstance(value, list | bool) or value is None else str(value)


def report_markdown(sidecar: dict) -> str:
    lines = [
        f"# Anchor report: {sidecar['raceId']} (reconstructed)",
        "",
        f"Solver: {sidecar['solver']['attempts']} attempt(s), noise sigma"
        f" {sidecar['solver']['sigma']}s; all anchors pass: {sidecar['solver']['passed']}.",
        "",
        "| Anchor | Pass | Total |",
        "|---|---|---|",
    ]
    lines += [f"| {k} | {v['pass']} | {v['total']} |" for k, v in sidecar["summary"].items()]
    lines += ["", "| Anchor | Subject | Target | Achieved | Pass |", "|---|---|---|---|---|"]
    for r in sidecar["anchors"]:
        mark = {True: "pass", False: "FAIL", None: "n/a"}[r["pass"]]
        lines.append(
            f"| {r['anchor']} | {r['subject']} | {_fmt(r['target'])} | {_fmt(r['achieved'])}"
            f" | {mark} |"
        )
    lines += ["", "## Estimated", ""] + [f"- {e}" for e in sidecar["estimates"]]
    if sidecar["notes"]:
        lines += ["", "## Notes", ""] + [f"- {n}" for n in sidecar["notes"]]
    return "\n".join(lines) + "\n"


def write(race_id: str, result: Result, raw_dir: Path = RAW_DIR) -> list[Path]:
    """raw/<id>.parquet, .status.json, .reconstruction.json and .anchors.md."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        raw_snapshot_path(race_id, raw_dir),
        track_status_path(race_id, raw_dir),
        sidecar_path(race_id, raw_dir),
        report_path(race_id, raw_dir),
    ]
    result.laps.to_parquet(paths[0])
    paths[1].write_text(json.dumps(result.status, indent=1) + "\n")
    paths[2].write_text(json.dumps(result.sidecar, indent=1) + "\n")
    paths[3].write_text(report_markdown(result.sidecar))
    return paths
