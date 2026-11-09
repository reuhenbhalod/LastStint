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
- safety cars only where a facts file sources them (none before 1993);
- the sourced running order (facts `lapLeaders`, `runningOrder`): who led each lap, and the
  order and gaps at the end of a lap, where a source gives them (see `order_marks`);
- a wet race's weather: the facts file's sourced timeline (track state per lap range) gives
  each lap's wetness, and each stint's tyre class (slick / inter / wet) is the sourced one
  where a stop or the start names it. Wet laps take wet pace by the weather model's own
  relationship (wet.penalty, data/wet.json: a dry lap x (1 + the tyre's penalty at that
  wetness), as both sims run it), and tyre wear runs at wet.wear_mult. The weather is written
  as the per-lap records the build reads for a wet race (<race-id>.weather.json).

Anything else is estimated and marked: the sidecar <race-id>.reconstruction.json carries the
race file's `reconstructed: true` and `provenance` (kind "reconstructed", `estimated`), the
estimates in words, the solver's parameters and the anchor report (each anchor's target,
what was achieved, pass or fail). <race-id>.anchors.md is the same report for people.

The solver. Each car's lap time is

    lap(l) = (b + w * wear(l) + FUEL * fuel laps on board) * (1 + wet(l)) + pit loss
             + sigma * z(l)

(wear(l): tyre age - 1, counted at wet.wear_mult on a wet race's laps; wet(l): the car's tyre
class's penalty at lap l's wetness, 0 on a dry race)

with z a seeded normal draw per car (deterministic: sha256 of race, seed and driver). The
cars decouple once each has a target for its time at its last lap:
- lead-lap finishers: their official race time;
- lapped finishers: just after the winner, in classification order, inside the window where
  they are exactly their laps down (cars running at the flag but not classified too, after
  them); classified retirements in classification order;
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
pinned at SC pace and the queue closes up, then the green laps are re-solved. A sourced
running order is then held by marking the cars' times at the end of its laps (one convex QP
over every sourced lap, `order_marks`) and re-solving each car's pace per segment between its
marks. An outer loop checks the anchors on the written frame and shrinks the noise until they
hold.
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
from scipy import sparse
from scipy.sparse import linalg as splinalg

from . import events, jolpica, wet
from .ingest import LAP_COLUMNS, raw_snapshot_path, save_weather, track_status_path, weather_path
from .paths import DATA_DIR, RAW_DIR

FIRST_YEAR, LAST_YEAR = 1983, 1995
FIRST_SC_YEAR = 1993  # no safety car is sourced in a race before 1993
REFUEL_FROM = 1994  # cars refuel at their stops (fuel laps reset); before, they start full
FACTS_DIR = DATA_DIR / "reconstruction"
F1DB_DIR = RAW_DIR / "f1db"
GREEN, SC = "1", "4"  # FastF1 track status codes
FINISHED = ("finished", "lapped")
# A facts file's track states and the wetness each stands for (docs/reconstruction-facts.md).
# Chosen from the weather model's own curves (data/wet.json) for the era's two tyres, slicks
# and wets, which cross over at w ~ 0.36: damp is clearly slick weather (slicks lose ~5%,
# wets ~20%), wet is wets weather (wets ~25%, slicks ~29%), heavy is standing water (wets
# ~38%, slicks ~54%), at the wettest the fitted modern races reach (0.64-0.65: Brazil 2012,
# Monaco 2023).
STATE_WETNESS = {"dry": 0.0, "damp": 0.15, "wet": 0.45, "heavy": 0.65}
TYRES = ("slick", "inter", "wet")
TYRE_COMPOUND = {"slick": None, "inter": "INTERMEDIATE", "wet": "WET"}  # slick: step 2.4's
# A lap counts as raining (wet.rain_laps) in the weather records from this wetness.
RAIN_FROM = 0.05
WEATHER_SOURCE = "reconstruction-facts"


# --- Anchors -----------------------------------------------------------------------------


@dataclass(frozen=True)
class Stop:
    lap: int  # the in-lap (official numbering)
    lane_time: float | None  # pit-lane seconds, None where the source has none
    source: str
    tyre: str | None = None  # the tyre class fitted (TYRES), where a source names it
    # A stop no source gives the lap of (weather.slickChange: the field's sourced change back
    # to slicks): its lap is the solver's estimate, its tyre an estimate too (not an anchor).
    estimated: bool = False


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
    start_tyre: str | None = None  # the tyre class it started on, where a source names it
    # A disqualified car a source places on the road (facts `roadPositions`): its place at the
    # flag (1 = first on the road) and the source. It runs to the flag there; its race time is
    # its sourced gap to the winner, else it sits between its road neighbours (an estimate).
    road_position: int | None = None
    road_source: str | None = None
    # A classified car that stopped on the last lap (facts `lastLapStops`: out of fuel), a lap
    # down in the result: it runs its last completed lap at its real road place (after the
    # leader's, before the flag), not as an early retirement. Its source; its sourced gap to the
    # leader at the start of the last lap, if one is given.
    last_lap_source: str | None = None
    last_lap_gap: float | None = None

    @property
    def finished(self) -> bool:
        """Ran to the flag: a finisher, or a disqualified car placed on the road."""
        return self.status in FINISHED or self.road_position is not None


@dataclass(frozen=True)
class SafetyCar:
    start: int  # first race lap (leader's lap) run behind the safety car
    end: int  # last
    source: str


@dataclass(frozen=True)
class LeaderSpan:
    """A sourced run of laps one car led (facts `lapLeaders`): it is first across the line at
    the end of each lap start..end (official numbering)."""

    driver: str
    start: int
    end: int
    source: str


@dataclass(frozen=True)
class Snapshot:
    """A sourced running order at the end of one lap (facts `runningOrder`): `order` holds
    places 1, 2, ... from the front; `gaps` (driver -> s behind the car in first place at the
    end of that lap) where the source gives them, within `tolerance` s."""

    lap: int
    order: tuple[str, ...]
    source: str
    gaps: tuple[tuple[str, float], ...] = ()
    tolerance: float | None = None


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
    # A wet race (facts file `weather`): the wetness on each lap 1..laps, the timeline it
    # came from (as entered) and the weather model's curves; None for a dry race.
    wetness: list[float] | None = None
    weather_timeline: list[dict] = field(default_factory=list)
    curves: dict | None = None
    # Sourced running order (facts `lapLeaders`, `runningOrder`): who led which laps, and
    # snapshots of the order (and gaps) at the end of a lap.
    leaders: list[LeaderSpan] = field(default_factory=list)
    snapshots: list[Snapshot] = field(default_factory=list)

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
    lead_margin: float = 1.0  # s a sourced running order is held by, at the end of its lap
    lap_gap_tolerance: float = 1.0  # a sourced gap at a lap, where the source sets none
    order_iterations: int = 6  # rounds of `order_marks` (each a QP over the sourced laps)
    pace_weight: float = 0.05  # `order_marks`: a segment's per-lap pace change, squared
    pack_weight: float = 1.0  # `order_marks`: keeping the cars behind at their spacing
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
    for i, s in enumerate(facts.get("stops", [])):
        if s.get("tyre") is not None and s["tyre"] not in TYRES:
            raise ValueError(f"{path}: stops[{i}] tyre {s['tyre']!r} is not one of {TYRES}")
    if facts.get("weather") is not None:
        check_weather(facts["weather"], str(path))
    for i, r in enumerate(facts.get("lastLapStops") or []):
        at = f"{path}: lastLapStops[{i}]"
        if not str(r.get("source") or "").strip():
            raise ValueError(f"{at} has no source")
        if not ("driver" in r or "number" in r):
            raise ValueError(f"{at} needs a driver or number")
        if r.get("gap") is not None and not (isinstance(r["gap"], int | float) and r["gap"] >= 0):
            raise ValueError(f"{at}: gap {r['gap']!r} is not seconds behind the leader")
    check_running_order(facts, str(path))
    for i, r in enumerate(facts.get("roadPositions") or []):
        at = f"{path}: roadPositions[{i}]"
        if not str(r.get("source") or "").strip():
            raise ValueError(f"{at} has no source")
        if not ("driver" in r or "number" in r):
            raise ValueError(f"{at} needs a driver or number")
        if not isinstance(r.get("position"), int) or r["position"] < 1:
            raise ValueError(
                f"{at}: position {r.get('position')!r} is not a road place (1, 2, ...)"
            )
        gap = r.get("gap")
        if gap is not None and (
            isinstance(gap, bool) or not isinstance(gap, int | float) or gap < 0
        ):
            raise ValueError(f"{at}: gap {gap!r} is not seconds behind the winner (or null)")
    return facts


def _is_car(ref) -> bool:
    """A car reference in a running order: a driver code (str) or a car number (int)."""
    return (isinstance(ref, str) and bool(ref.strip())) or (
        isinstance(ref, int) and not isinstance(ref, bool)
    )


def check_running_order(facts: dict, where: str) -> None:
    """`lapLeaders` and `runningOrder` (docs/reconstruction-facts.md): every entry sourced,
    laps 1, 2, ..., no lap led by two cars, an order of distinct cars, gaps in seconds (to
    the car listed first, so not for it)."""
    spans = facts.get("lapLeaders") or []
    led: dict[int, int] = {}
    for i, r in enumerate(spans):
        at = f"{where}: lapLeaders[{i}]"
        if not str(r.get("source") or "").strip():
            raise ValueError(f"{at} has no source")
        if not ("driver" in r or "number" in r):
            raise ValueError(f"{at} needs a driver or number")
        a, b = r.get("fromLap"), r.get("toLap")
        if not (isinstance(a, int) and isinstance(b, int) and 1 <= a <= b):
            raise ValueError(f"{at}: laps {a!r}-{b!r}")
        for lap in range(a, b + 1):
            if lap in led:
                raise ValueError(f"{at}: lap {lap} is already led in lapLeaders[{led[lap]}]")
            led[lap] = i
    for i, r in enumerate(facts.get("runningOrder") or []):
        at = f"{where}: runningOrder[{i}]"
        if not str(r.get("source") or "").strip():
            raise ValueError(f"{at} has no source")
        if not (isinstance(r.get("lap"), int) and r["lap"] >= 1):
            raise ValueError(f"{at}: lap {r.get('lap')!r}")
        order = r.get("order")
        if not (isinstance(order, list) and order and all(_is_car(x) for x in order)):
            raise ValueError(f"{at}: order must list cars (driver codes or numbers)")
        if len(set(map(str, order))) != len(order):
            raise ValueError(f"{at}: a car twice in the order")
        for key, gap in (r.get("gaps") or {}).items():
            if key == str(order[0]):
                raise ValueError(f"{at}: a gap for {key!r}, the car the gaps are to")
            if isinstance(gap, bool) or not isinstance(gap, int | float) or gap < 0:
                raise ValueError(f"{at}: gap {gap!r} for {key!r} is not seconds behind")
        tol = r.get("gapTolerance")
        bad = isinstance(tol, bool) or not isinstance(tol, int | float) or tol <= 0
        if tol is not None and bad:
            raise ValueError(f"{at}: gapTolerance {tol!r}")


def _state_wetness(entry: dict, key: str, where: str) -> float | None:
    """An entry's wetness at one end: `wetness` / `toWetness`, else its `state` / `toState`."""
    num, state = ("wetness", "state") if key == "from" else ("toWetness", "toState")
    if entry.get(num) is not None:
        w = float(entry[num])
        if not 0.0 <= w <= 1.0:
            raise ValueError(f"{where}: {num} {w} is not in 0..1")
        return w
    if entry.get(state) is not None:
        if entry[state] not in STATE_WETNESS:
            raise ValueError(
                f"{where}: {state} {entry[state]!r} is not one of {list(STATE_WETNESS)}"
            )
        return STATE_WETNESS[entry[state]]
    return None


def check_weather(weather: dict, where: str) -> None:
    """A facts file's `weather` block: a timeline of sourced, non-overlapping lap ranges from
    lap 1, each with a state (or wetness); sourced start tyres and tyre changes."""
    timeline = weather.get("timeline") or []
    if not timeline:
        raise ValueError(f"{where}: weather.timeline is empty")
    last = 0
    for i, e in enumerate(sorted(timeline, key=lambda e: int(e["fromLap"]))):
        at = f"{where}: weather.timeline (from lap {e.get('fromLap')})"
        if not str(e.get("source") or "").strip():
            raise ValueError(f"{at} has no source")
        lo, hi = int(e["fromLap"]), int(e["toLap"])
        if not 1 <= lo <= hi:
            raise ValueError(f"{at}: laps {lo}-{hi}")
        if lo != last + 1:
            raise ValueError(f"{at}: laps {last + 1}-{lo - 1} missing or overlapping (entry {i})")
        last = hi
        if _state_wetness(e, "from", at) is None:
            raise ValueError(f"{at}: needs a state or a wetness")
        _state_wetness(e, "to", at)
    st = weather.get("startTyre")
    if st is not None and (st.get("tyre") not in TYRES or not str(st.get("source") or "").strip()):
        raise ValueError(f"{where}: weather.startTyre needs a tyre in {TYRES} and a source")
    for kind in ("startTyres", "tyreChanges"):
        for i, t in enumerate(weather.get(kind) or []):
            if t.get("tyre") not in TYRES:
                raise ValueError(f"{where}: weather.{kind}[{i}] tyre {t.get('tyre')!r}")
            if not str(t.get("source") or "").strip():
                raise ValueError(f"{where}: weather.{kind}[{i}] has no source")
            if not ("driver" in t or "number" in t):
                raise ValueError(f"{where}: weather.{kind}[{i}] needs a driver or number")
            if kind == "tyreChanges" and "lap" not in t:
                raise ValueError(f"{where}: weather.{kind}[{i}] needs the stop's in-lap")
    sc = weather.get("slickChange")
    if sc is not None:
        at = f"{where}: weather.slickChange"
        if not str(sc.get("source") or "").strip():
            raise ValueError(f"{at} has no source")
        lo, hi = sc.get("fromLap"), sc.get("toLap")
        if not (isinstance(lo, int) and isinstance(hi, int) and 1 <= lo <= hi):
            raise ValueError(f"{at}: laps {lo}-{hi}")


def timeline_wetness(timeline: list[dict], laps: int) -> list[float]:
    """The wetness on each lap 1..laps: each entry's state (or wetness) over its laps, ramped
    linearly to its toState (toWetness) on its last lap where it has one. The timeline must
    reach the race's last lap; entries past it are cut."""
    out: list[float | None] = [None] * laps
    for e in timeline:
        lo, hi = int(e["fromLap"]), int(e["toLap"])
        a = _state_wetness(e, "from", "weather.timeline")
        b = _state_wetness(e, "to", "weather.timeline")
        b = a if b is None else b
        for lap in range(lo, min(hi, laps) + 1):
            f = 0.0 if hi == lo else (lap - lo) / (hi - lo)
            out[lap - 1] = round(a + (b - a) * f, 3)
    missing = [i + 1 for i, w in enumerate(out) if w is None]
    if missing:
        raise ValueError(f"weather.timeline doesn't cover laps {missing[0]}-{missing[-1]}")
    return [float(w) for w in out]


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
                Stop(
                    int(s["lap"]),
                    None if lane is None else float(lane),
                    s["source"],
                    s.get("tyre"),
                )
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
    wetness, timeline, curves = None, [], None
    if facts and facts.get("weather"):
        weather = facts["weather"]
        timeline = list(weather["timeline"])
        wetness = timeline_wetness(timeline, winner.laps)
        curves = wet.load_curves()
        notes += apply_tyres(cars, weather)
    leaders, snapshots, why = running_order(cars, facts or {}, winner.laps)
    notes += why
    notes += apply_road_positions(cars, (facts or {}).get("roadPositions") or [], winner)
    notes += apply_last_lap_stops(cars, (facts or {}).get("lastLapStops") or [], winner)
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
        wetness=wetness,
        weather_timeline=timeline,
        curves=curves,
        leaders=leaders,
        snapshots=snapshots,
        sources={
            "jolpica": f"Jolpica-F1 dump {jolpica.dump_version(dump_dir)} (CC BY-NC-SA 4.0)",
            "f1db": f"F1DB {f1db_version} (CC BY 4.0), {f1db_dir.name}/{race_id}.*.csv",
            "facts": str(facts_path(race_id, facts_dir).name) if facts else None,
            "jolpicaRound": race.round_number,
            "eventName": race.name,
        },
        notes=notes,
    )


def _car_for(cars: list[Car], item: dict) -> Car | None:
    if "driver" in item:
        return next((c for c in cars if c.driver == item["driver"]), None)
    hits = [c for c in cars if c.number == int(item["number"])]
    return hits[0] if len(hits) == 1 else None


def _ref_car(cars: list[Car], ref) -> Car | None:
    """A running order's car: a driver code, or a car number (int, or its digits)."""
    if isinstance(ref, str) and not ref.isdigit():
        return next((c for c in cars if c.driver == ref), None)
    hits = [c for c in cars if c.number == int(ref)]
    return hits[0] if len(hits) == 1 else None


def running_order(
    cars: list[Car], facts: dict, laps: int
) -> tuple[list[LeaderSpan], list[Snapshot], list[str]]:
    """The facts file's `lapLeaders` and `runningOrder` on the race's cars. A span or
    snapshot past the winner's laps is cut there; a car listed on a lap it didn't complete
    (Jolpica's laps) is a conflict between the sources, noted and left out."""
    notes: list[str] = []
    spans: list[LeaderSpan] = []
    for i, r in enumerate(facts.get("lapLeaders") or []):
        car = _car_for(cars, r)
        if car is None:
            raise ValueError(f"facts lapLeaders[{i}]: no car {r.get('driver', r.get('number'))}")
        a, b = int(r["fromLap"]), min(int(r["toLap"]), laps)
        if b < int(r["toLap"]):
            notes.append(f"lapLeaders[{i}]: laps past the winner's {laps} cut")
        if car.laps < b:
            notes.append(
                f"lapLeaders[{i}]: {car.driver} led to lap {b} but completed {car.laps} laps"
                f" (Jolpica); laps {max(a, car.laps + 1)}-{b} left out"
            )
            b = car.laps
        if a <= b:
            spans.append(LeaderSpan(car.driver, a, b, r["source"]))
    led = {lap: s.driver for s in spans for lap in range(s.start, s.end + 1)}
    snaps: list[Snapshot] = []
    for i, r in enumerate(facts.get("runningOrder") or []):
        lap = int(r["lap"])
        if lap > laps:
            notes.append(f"runningOrder[{i}]: lap {lap} is past the winner's {laps}; left out")
            continue
        order, gaps = [], []
        given = {str(k): float(v) for k, v in (r.get("gaps") or {}).items()}
        for ref in r["order"]:
            car = _ref_car(cars, ref)
            if car is None:
                raise ValueError(f"facts runningOrder[{i}]: no car {ref!r}")
            if car.laps < lap:
                notes.append(
                    f"runningOrder[{i}]: {car.driver} listed on lap {lap} but completed"
                    f" {car.laps} laps (Jolpica); the order is cut before it"
                )
                break
            order.append(car.driver)
        if not order:
            continue
        for ref, gap in given.items():
            car = _ref_car(cars, ref)
            if car is None:
                raise ValueError(f"facts runningOrder[{i}]: gap for no car {ref!r}")
            if car.laps < lap:
                notes.append(f"runningOrder[{i}]: gap for {car.driver}, out by lap {lap}; left out")
                continue
            gaps.append((car.driver, gap))
        if lap in led and led[lap] != order[0]:
            raise ValueError(
                f"facts runningOrder[{i}]: {order[0]} first on lap {lap}, but lapLeaders has"
                f" {led[lap]} leading it"
            )
        tol = r.get("gapTolerance")
        tol = None if tol is None else float(tol)
        snaps.append(Snapshot(lap, tuple(order), r["source"], tuple(gaps), tol))
    return spans, snaps, notes


def order_rules(anchors: Anchors) -> dict[int, tuple[list[str], dict[str, float], float | None]]:
    """Each lap with a sourced order: (the cars in places 1, 2, ... from the front, their
    gaps to the first, the gap tolerance). A snapshot extends its lap's leader."""
    rules: dict[int, tuple[list[str], dict[str, float], float | None]] = {}
    for s in anchors.leaders:
        for lap in range(s.start, s.end + 1):
            rules[lap] = ([s.driver], {}, None)
    for snap in anchors.snapshots:
        prev = rules.get(snap.lap)
        order = list(snap.order)
        if prev and len(prev[0]) > len(order):
            order = prev[0]
        gaps = {**(prev[1] if prev else {}), **dict(snap.gaps)}
        rules[snap.lap] = (order, gaps, snap.tolerance)
    return dict(sorted(rules.items()))


def apply_tyres(cars: list[Car], weather: dict) -> list[str]:
    """The facts file's sourced tyres onto the cars: the race's start tyre and each car's own,
    and `tyreChanges` onto the car's stop on that in-lap (an F1DB stop, 1994-95, or a facts
    stop). Returns notes on any that match no car or stop."""
    notes = []
    start = (weather.get("startTyre") or {}).get("tyre")
    for c in cars:
        c.start_tyre = start
    for t in weather.get("startTyres") or []:
        car = _car_for(cars, t)
        if car is None:
            notes.append(f"weather start tyre for {t.get('driver', t.get('number'))}: no such car")
            continue
        car.start_tyre = t["tyre"]
    for t in weather.get("tyreChanges") or []:
        car = _car_for(cars, t)
        who = t.get("driver", t.get("number"))
        if car is None:
            notes.append(f"weather tyre change for {who}: no such car")
            continue
        k = next((i for i, s in enumerate(car.stops) if s.lap == int(t["lap"])), None)
        if k is None:
            notes.append(
                f"weather tyre change: {car.driver} has no stop on lap {t['lap']}; not used"
            )
            continue
        car.stops[k] = replace(car.stops[k], tyre=t["tyre"])
    if weather.get("slickChange"):
        notes += apply_slick_change(cars, weather["slickChange"])
    return notes


def slick_change_lap(cars: list[Car], change: dict) -> int:
    """The estimated in-lap of an unsourced change back to slicks (weather.slickChange): the
    median of the race's sourced slick in-laps inside the window, else the window's middle."""
    lo, hi = int(change["fromLap"]), int(change["toLap"])
    laps = sorted(
        s.lap
        for c in cars
        for s in c.stops
        if s.tyre == "slick" and not s.estimated and lo <= s.lap <= hi
    )
    return laps[(len(laps) - 1) // 2] if laps else (lo + hi) // 2


def apply_slick_change(cars: list[Car], change: dict) -> list[str]:
    """The facts file's `weather.slickChange`: a source says the field changed back to slicks
    in laps fromLap..toLap (brazil-1993: 'everyone stopped for dry tyres') but gives the lap
    for only some cars. A car still on sourced wet tyres at fromLap, with no stop in the window
    (a stop there with no tyre named is left to the stint estimate), that runs past the
    estimated lap gets a slick stop on it (slick_change_lap), its lap and tyre marked
    estimated: the only stops the reconstruction adds, and only where a source says they
    happened. Returns notes."""
    lo, hi = int(change["fromLap"]), int(change["toLap"])
    lap = slick_change_lap(cars, change)
    notes = []
    for car in cars:
        if car.laps < lo:
            continue
        before = [s for s in car.stops if s.lap < lo]
        on = before[-1].tyre if before else car.start_tyre
        if on != "wet" or any(lo <= s.lap <= hi for s in car.stops):
            continue
        if car.laps <= lap:
            notes.append(
                f"{car.driver}: on wets at lap {lo}, out on lap {car.laps} before the estimated"
                f" slick stop (lap {lap})"
            )
            continue
        car.stops.append(
            Stop(
                lap,
                None,
                f"estimate (weather.slickChange, laps {lo}-{hi}): {change['source']}",
                "slick",
                estimated=True,
            )
        )
        car.stops.sort(key=lambda s: s.lap)
        notes.append(
            f"{car.driver}: slick stop on lap {lap} estimated (the field changed to slicks in laps"
            f" {lo}-{hi}; no source gives this car's lap)"
        )
    return notes


def apply_road_positions(cars: list[Car], items: list[dict], winner: Car) -> list[str]:
    """The facts file's `roadPositions` onto their cars: a disqualified car a source places on
    the road (san-marino-1985's Prost, monaco-1984's Bellof: excluded after the flag) runs to
    the flag at that place. With a sourced gap (lead lap only) its race time is the winner's
    plus the gap, a lead-lap anchor like any other; without one it is placed between its road
    neighbours (`targets`), an estimate. Its official result stays excluded (`classified`
    false). Returns notes; a road place for no car, or for a car that wasn't disqualified, is
    an error."""
    notes = []
    for i, item in enumerate(items):
        who = item.get("driver", item.get("number"))
        car = _car_for(cars, item)
        if car is None:
            raise ValueError(f"facts roadPositions[{i}]: no car {who}")
        if car.status != "disqualified":
            raise ValueError(
                f"facts roadPositions[{i}]: {car.driver} is {car.status}, not disqualified (a road"
                " place is for a car excluded from the result)"
            )
        car.road_position = int(item["position"])
        car.road_source = str(item["source"])
        gap = item.get("gap")
        if gap is not None:
            if car.laps != winner.laps:
                raise ValueError(
                    f"facts roadPositions[{i}]: {car.driver} has {car.laps} laps, the winner"
                    f" {winner.laps}: a gap to the winner is for a car on the lead lap"
                )
            car.time = float(winner.time) + float(gap)
            notes.append(
                f"{car.driver}: disqualified, placed P{car.road_position} on the road at"
                f" +{float(gap):.3f}s (sourced)"
            )
        else:
            notes.append(
                f"{car.driver}: disqualified, placed P{car.road_position} on the road between"
                " its road neighbours (no gap sourced: an estimate)"
            )
    return notes


def apply_last_lap_stops(cars: list[Car], items: list[dict], winner: Car) -> list[str]:
    """The facts file's `lastLapStops` onto their cars: a classified car a source says stopped
    on the last lap (germany-1986's Rosberg and Prost, out of fuel). It must be classified,
    not a finisher in Jolpica's words, and exactly one lap down (it never crossed the line on
    the last lap). `targets` puts its last completed lap at its road place, after the leader's
    and before the flag, instead of early enough to read as an early retirement; the build
    writes its RETIREMENT event on the last lap. Returns notes; a malformed item is an error."""
    notes = []
    for i, item in enumerate(items):
        who = item.get("driver", item.get("number"))
        car = _car_for(cars, item)
        if car is None:
            raise ValueError(f"facts lastLapStops[{i}]: no car {who}")
        if not car.classified or car.status in FINISHED or car.laps != winner.laps - 1:
            raise ValueError(
                f"facts lastLapStops[{i}]: {car.driver} is {car.status} with {car.laps} laps"
                f" (classified {car.classified}): a last-lap stop is a classified car that"
                f" stopped on lap {winner.laps}, {winner.laps - 1} laps completed"
            )
        car.last_lap_source = str(item["source"])
        gap = item.get("gap")
        car.last_lap_gap = None if gap is None else float(gap)
        notes.append(
            f"{car.driver}: stopped on the last lap (sourced), its lap {car.laps} at its road"
            + (f" place, {float(gap):.1f}s behind the leader (sourced)" if gap is not None else
               " place, after the leader's and before the flag")
        )  # fmt: skip
    return notes


def last_lap_stops(anchors: Anchors) -> list[dict]:
    """The sidecar's last-lap stops (the build writes each one's RETIREMENT on the last lap)."""
    return [
        {"driver": c.driver, "laps": c.laps, "gap": c.last_lap_gap, "source": c.last_lap_source}
        for c in anchors.cars
        if c.last_lap_source is not None
    ]


def road_order(anchors: Anchors) -> list[str]:
    """The order on the road at the flag as the sources give it: the classification, with
    each disqualified car placed on the road (`roadPositions`) at its road place."""
    order = [
        c.driver
        for c in sorted(anchors.cars, key=lambda c: c.position or 999)
        if c.classified and c.road_position is None
    ]
    placed = sorted(
        (c for c in anchors.cars if c.road_position is not None), key=lambda c: c.road_position
    )
    for c in placed:
        order.insert(min(c.road_position - 1, len(order)), c.driver)
    return order


def stint_tyres(car: Car, wetness: list[float], curves: dict) -> list[tuple[str, bool]]:
    """Each stint's tyre class and whether a source names it. A stint no source names (the
    start where no source gives it, a stop whose tyre isn't given) gets the class that loses
    the least time over its laps at their wetness: teams fit the tyre that suits the stint
    (wet_laps.py's rule), an estimate."""
    ends = [0, *[s.lap for s in car.stops], car.laps]
    named = [car.start_tyre, *[s.tyre for s in car.stops]]
    guessed = [False, *[s.estimated for s in car.stops]]
    out = []
    for k, (a, b) in enumerate(zip(ends, ends[1:], strict=False)):
        if named[k] is not None:
            out.append((named[k], not guessed[k]))
            continue
        ws = np.array(wetness[a:b] or [wetness[min(a, len(wetness) - 1)]])
        lost = {
            t: float(np.sum(wet.penalty(curves, TYRE_COMPOUND[t] or "SOFT", ws))) for t in TYRES
        }
        # The era's tyres are slicks and wets: an inter only where a source names one.
        out.append((min(("slick", "wet"), key=lambda t: lost[t]), False))
    return out


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
    # A wet race: each lap's dry lap multiplier (1 + the tyre's penalty at the lap's wetness)
    # and tyre wear in dry-lap units (wet.wear_mult along the stint). Dry: 1 and age - 1.
    mult: np.ndarray | None = None
    wear: np.ndarray | None = None
    tyre: list[str] | None = None  # the stint's tyre class on each lap (wet race only)

    def __post_init__(self) -> None:
        if self.mult is None:
            self.mult = np.ones(len(self.age))
        if self.wear is None:
            self.wear = self.age - 1


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
    wetness: list[float] | None = None,
    curves: dict | None = None,
) -> Features:
    """The car's lap features. With refuelling, each stint carries the fuel to the next stop;
    a retired car's last stint the fuel for a typical stint (its plan is unknown). With a
    wetness timeline, each lap's wet multiplier and wear at its stint's tyre class."""
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
    if wetness is None or curves is None:
        return Features(age, stint, fuel, pit, in_lap, out_lap, out_share)
    classes = [t for t, _ in stint_tyres(car, wetness, curves)]
    mult, wear, tyre = np.ones(n), np.zeros(n), []
    worn = 0.0
    for i in range(n):
        cls = classes[int(stint[i]) - 1]
        comp = TYRE_COMPOUND[cls] or "SOFT"
        w = wetness[min(i, len(wetness) - 1)]
        if age[i] == 1:
            worn = 0.0
        mult[i] = 1.0 + float(wet.penalty(curves, comp, w))
        wear[i] = worn  # as the sims count it: the wear before this lap (wet.sim_wear)
        worn += wet.wear_mult(comp, w)
        tyre.append(cls)
    return Features(age, stint, fuel, pit, in_lap, out_lap, out_share, mult, wear, tyre)


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
PACK_LAPS = 10  # `order_marks`: a car listed this near a lap isn't held to the pack there


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
    marks: dict[int, float] | None = None,
) -> Fit:
    """One car's laps. With `total`, the car's pace b, wear w and noise scale are solved from
    the total and the fastest lap (a grid search over w and the noise scale, b from the
    total; see SEARCH); without, `pace` (b, w) and `sigma` give the natural laps. Pinned laps
    (lap -> s) are kept; the rest are projected to the total, never faster than the fastest
    lap + margin.

    `marks` (lap -> s from the start at the end of that lap) are the car's times where the
    sourced running order puts it (`order_marks`). They cut its race into segments, and each
    segment's free laps are projected to the segment's time on their own: the car's pace
    moves by a constant per segment (x = max(model + lambda_k, floor)). Without a total, the
    laps after the last mark are its natural laps."""
    n = car.laps
    z = z.copy()
    f_time, f_lap = car.fastest_time, car.fastest_lap
    has_f = f_time is not None and f_lap is not None and 1 <= f_lap <= n
    if has_f:
        j = int(np.argmin(z))
        z[j], z[f_lap - 1] = z[f_lap - 1], z[j]
    a = feat.wear
    mult = feat.mult
    fixed = dict(pins)
    if has_f:
        fixed[f_lap] = f_time
    free = np.array([i for i in range(n) if i + 1 not in fixed], int)
    pinned_sum = sum(fixed.values())
    floor_base = f_time + p.fastest_margin if f_time is not None else -math.inf
    dry_c = p.fuel_per_lap * feat.fuel
    if pace is not None:
        b, w = pace
    elif total is not None and len(free):
        rest, m_sum = total - pinned_sum, mult[free].sum()
        best = None
        for w_try in np.linspace(0.0, p.wear_max, 11):
            for scale in SEARCH:
                s_try = sigma * scale
                c_try = (w_try * a + dry_c) * mult + feat.pit + s_try * z
                b_try = (rest - c_try[free].sum()) / m_sum
                m = b_try * mult + c_try
                cost = float((np.maximum(floor_base + feat.pit[free] - m[free], 0) ** 2).sum())
                if has_f:
                    cost += (m[f_lap - 1] - f_time) ** 2
                cost += 10 * (w_try - p.wear_prior) ** 2 + (s_try - sigma) ** 2
                if best is None or cost < best[0]:
                    best = (cost, b_try, w_try, s_try)
        _, b, w, sigma = best
    else:
        b, w = (f_time or 90.0), p.wear_prior
    model = (b + w * a + dry_c) * mult + feat.pit + sigma * z
    if f_time is not None and not has_f and len(free):
        k = int(free[np.argmin(model[free] - feat.pit[free])])
        fixed[k + 1] = f_time
        free = free[free != k]
        pinned_sum += f_time
    x = model.copy()
    for lap, value in fixed.items():
        x[lap - 1] = value
    if not math.isfinite(floor_base):
        floor_base = 0.5 * b
    if total is None and marks and n in marks:
        total = float(marks[n])  # a retirement marked on its last lap (`order_marks`)
    cuts = sorted(lap for lap in (marks or {}) if 1 <= lap < n)
    if not cuts:
        if total is None:
            total = float(x.sum())
        floor = floor_base + feat.pit[free]
        xf, ok = project(model[free], floor, total - pinned_sum)
        x[free] = xf
        if not len(free):
            ok = abs(x.sum() - total) < 1e-6
        return Fit(x, float(b), float(w), ok, float(sigma))
    ok = True
    is_free = np.zeros(n, bool)
    is_free[free] = True
    bounds = [0, *cuts, n]
    times = [0.0, *(float(marks[lap]) for lap in cuts)]
    for k in range(len(bounds) - 1):
        a, e = bounds[k], bounds[k + 1]
        idx = np.arange(a, e)
        fr = idx[is_free[idx]]
        pinned_k = float(x[idx[~is_free[idx]]].sum())
        if k < len(cuts):
            want = times[k + 1] - times[k]
        elif total is not None:
            want = total - times[k]
        else:
            want = float(x[idx].sum())  # natural laps after the last mark
        if not len(fr):
            ok = ok and abs(pinned_k - want) < 1e-6
            continue
        xf, good = project(model[fr], floor_base + feat.pit[fr], want - pinned_k)
        x[fr] = xf
        ok = ok and good
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


def lap1_retirement(c: Car) -> bool:
    """A car out after lap 1 whose one lap is its F1DB fastest lap: its lap-1 time is the
    source's, often a crawl back to the pits (monaco-1992's Moreno: 5:34.5), so it stands
    outside the grid ladder: it pushes no car back and the grid anchor doesn't place it."""
    return c.laps == 1 and c.fastest_lap == 1 and c.fastest_time is not None


def lap1_order(anchors: Anchors, cars: list[Car]) -> list[Car]:
    """The lap-1 order: the grid order, with the cars a source puts at the front at the end of
    lap 1 (the lap-1 leader of `lapLeaders`, a lap-1 `runningOrder`) moved there."""
    order = grid_order(cars)
    rule = order_rules(anchors).get(1)
    if not rule:
        return order
    by = {c.driver: c for c in order}
    front = [by[d] for d in rule[0] if d in by]
    return front + [c for c in order if c not in front]


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
    winner_code = min(lead, key=lambda c: c.time).driver
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
            elif car.last_lap_source is not None:
                # Stopped on the last lap: its last completed lap after the leader's, before
                # the flag (the leader's last lap taken as its estimated lap).
                lead_end = t_win - est_lap[winner_code]
                lo.append(lead_end + p.order_gap)
                hi.append(t_win - p.order_gap)
            elif car.finished:
                lapped = car.laps < anchors.laps
                lo.append(t_win + p.order_gap)
                hi.append(t_win + 0.75 * est_lap[car.driver] if lapped else math.inf)
            elif natural[car.driver] > seen and anchors.leaders:
                # A classified retirement (out of fuel near the end, say) that could only be
                # seen stopped by running faster than its own pace, which puts it among the
                # leaders: with a sourced running order it stops at its natural time, before
                # the flag (its retirement event may then go unseen; reported, not core).
                lo.append(-math.inf), hi.append(t_win - p.order_gap)
                notes.append(
                    f"{car.driver}: classified retirement stopped at its natural time, after"
                    " the point a retirement is seen"
                )
            else:
                lo.append(-math.inf), hi.append(seen)
            if car.last_lap_gap is not None:
                want.append(t_win - est_lap[winner_code] + car.last_lap_gap)
            else:
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
    # A disqualified car placed on the road: its sourced race time, else between its road
    # neighbours on its lap (the midpoint of the room between them: an estimate).
    road = road_order(anchors)
    for car in sorted(anchors.cars, key=lambda c: c.road_position or 0):
        if car.road_position is None or car.laps < 1:
            continue
        if car.time is not None:
            out[car.driver] = car.time
            continue
        k = road.index(car.driver)
        same = [d for d in road if anchors.car(d).laps == car.laps and d in out]
        ahead = [d for d in road[:k] if d in same]
        behind = [d for d in road[k + 1 :] if d in same]
        lapped = car.laps < anchors.laps
        lo = (
            out[ahead[-1]] + p.order_gap
            if ahead
            else (t_win + p.order_gap if lapped else -math.inf)
        )
        hi = (
            out[behind[0]] - p.order_gap
            if behind
            else (t_win + 0.75 * est_lap[car.driver] if lapped else math.inf)
        )
        if math.isfinite(lo) and math.isfinite(hi):
            v = (lo + hi) / 2
        else:
            v = min(max(natural[car.driver], lo), hi)
        if lo > hi:
            notes.append(f"{car.driver}: no room on the road between its road neighbours")
        out[car.driver] = v
    # Running at the flag but not classified (too few laps for the rules of the day, e.g.
    # australia-1986's Tambay and Berg): still lapped finishers, so they cross the line
    # after the winner's flag, exactly their laps down, and aren't seen as retirements.
    running = sorted(
        (c for c in anchors.cars if c.driver not in out and c.finished and c.laps >= 1),
        key=lambda c: (-c.laps, c.position or 999),
    )
    prev = -math.inf
    for car in running:
        lo, hi = t_win + p.order_gap, t_win + 0.75 * est_lap[car.driver]
        v = min(max(natural[car.driver], lo, prev + p.order_gap), hi)
        out[car.driver] = prev = v
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
    feats = {
        c.driver: features(c, total, refuel, lane, p, stint, anchors.wetness, anchors.curves)
        for c in running
    }

    def dry_fastest(c: Car) -> float | None:
        """The car's fastest lap as a dry lap (its time over the lap's wet multiplier)."""
        if c.fastest_time is None:
            return None
        if c.fastest_lap is None or not 1 <= c.fastest_lap <= c.laps:
            return c.fastest_time
        return c.fastest_time / float(feats[c.driver].mult[c.fastest_lap - 1])

    zs = {c.driver: noise(anchors.race_id, p.seed, c.driver, c.laps) for c in running}
    notes: list[str] = []

    # Pass 1: the lead-lap finishers' pace from their race times and fastest laps.
    lead = [c for c in running if c.time is not None]
    fits = {c.driver: fit_car(c, feats[c.driver], zs[c.driver], p, sigma, c.time, {}) for c in lead}
    offsets = [f.b - dry_fastest(c) for c in lead if (f := fits[c.driver]) and c.fastest_time]
    b_off = float(np.median(offsets)) if offsets else 2.0
    w_med = float(np.median([f.w for f in fits.values()]))
    b_med = float(np.median([f.b for f in fits.values()]))
    f_med = float(np.median([dry_fastest(c) for c in running if c.fastest_time] or [b_med]))

    # Lap 1 from the grid: the pole sitter's standing start, then grid_gap per slot (at the
    # winner's lap-1 wet multiplier on a wet race).
    first = feats[lead[0].driver]
    lap1 = (b_med + p.fuel_per_lap * first.fuel[0]) * float(first.mult[0]) + p.start_loss
    order = lap1_order(anchors, running)
    is_wet = anchors.wetness is not None
    if is_wet:
        # A wet race: a fastest lap set on lap 1 is lap 1's real pace (the track's state on
        # the first lap is the timeline's coarsest guess), so the grid ladder goes through it.
        on_one = [lap1] + [
            c.fastest_time - rank * p.grid_gap
            for rank, c in enumerate(order)
            if c.fastest_lap == 1 and c.fastest_time is not None
        ]
        lap1 = max(on_one)
    grid_pins: dict[str, dict[int, float]] = {}
    prev = -math.inf
    for rank, c in enumerate(order):
        if c.fastest_lap == 1:
            notes.append(f"{c.driver}: fastest lap on lap 1, its lap-1 time is the fastest lap's")
            grid_pins[c.driver] = {}
            if lap1_retirement(c):
                # Its sourced lap stands outside the ladder: the cars behind keep their slots.
                notes.append(f"{c.driver}: out after lap 1, its lap-1 place is its sourced time's")
            else:
                prev = max(prev, c.fastest_time or prev)
            continue
        pin = lap1 + rank * p.grid_gap
        if c.fastest_time is not None and pin < c.fastest_time + p.fastest_margin:
            pin = c.fastest_time + p.fastest_margin + 0.1  # may break the grid order (checked)
        if is_wet:
            # A wet fastest lap (slower than the ladder) pushes the cars behind it back
            # with it, so the lap-1 order stays the grid order.
            pin = max(pin, prev + 0.1)
        prev = pin
        grid_pins[c.driver] = {1: pin + feats[c.driver].pit[0]}

    # Natural times for everyone else (with the laps pinned so far), then the targets.
    est_lap = {
        c.driver: ((dry_fastest(c) or f_med) + b_off + p.fuel_per_lap * (total / 2))
        * float(np.mean(feats[c.driver].mult))
        for c in running
    }

    marks: dict[str, dict[int, float]] = {c.driver: {} for c in running}

    def goals(pins: dict[str, dict[int, float]]) -> dict[str, float]:
        natural = {}
        for c in running:
            if c.time is not None:
                natural[c.driver] = c.time
                continue
            pace = ((dry_fastest(c) or f_med) + b_off, w_med)
            nat = fit_car(
                c,
                feats[c.driver],
                zs[c.driver],
                p,
                sigma,
                None,
                pins[c.driver],
                pace,
                marks[c.driver],
            )
            natural[c.driver] = float(nat.laps.sum())
        goal, why = targets(anchors, natural, est_lap, p)
        notes.extend(why)
        return goal

    def run(pins: dict[str, dict[int, float]], goal: dict[str, float]) -> dict[str, np.ndarray]:
        out = {}
        for c in running:
            fit = fit_car(
                c,
                feats[c.driver],
                zs[c.driver],
                p,
                sigma,
                goal[c.driver],
                pins[c.driver],
                marks=marks[c.driver],
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
    current = {"pins": grid_pins}

    def pins_now() -> dict[str, dict[int, float]]:
        return current["pins"]

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

    def settle_sc() -> None:
        nonlocal laps, goal, under
        for _ in range(p.sc_iterations if anchors.safety_cars else 0):
            sc, under = sc_pins(anchors, laps, feats, b_med, p)
            pins = {d: {**grid_pins[d], **sc[d]} for d in grid_pins}
            current["pins"] = pins
            goal = goals(pins)
            laps = run(pins, goal)
            if sc_pins(anchors, laps, feats, b_med, p)[1] == under:
                return
        if anchors.safety_cars:
            notes.append("the laps behind the safety car did not settle")

    settle_sc()
    # The sourced running order (facts `lapLeaders`, `runningOrder`): repair the worst
    # breach of each run of laps by marking the cars' times there, re-solve, repeat. With a
    # safety car the SC laps are re-pinned after each round of repairs.
    rules = {lap: r for lap, r in order_rules(anchors).items() if lap >= 2}
    for round_ in range(3 if anchors.safety_cars else 1):
        if not rules:
            break
        if round_:
            settle_sc()  # the SC laps re-pinned on the marked laps, then the order again
        # Each round solves from the unmarked laps (`base`), with the cars and laps of the
        # rounds before as unknowns too and a wider window, until the order holds.
        for d in marks:
            marks[d] = {}
        base_goal = goals(pins_now())
        base = run(pins_now(), base_goal)
        laps, goal = base, base_goal
        for k in range(p.order_iterations):
            if not order_breaks(rules, laps, p):
                break
            window = (30.0, 90.0, 300.0, math.inf)[min(k, 3)]
            new = order_marks(anchors, base, rules, p, marks, base_goal, pins_now(), feats, window)
            for d in marks:
                marks[d] = new.get(d, {})
            goal = goals(pins_now())
            laps = run(pins_now(), goal)
        if not anchors.safety_cars:
            break
    if rules and order_breaks(rules, laps, p):
        notes.append("the sourced running order could not be held on every lap (see the report)")
    laps = _last_lap_stops(anchors, p, sigma, laps, goal, feats, zs, pins_now(), fitted, marks)
    notes = sorted(set(notes), key=notes.index)
    return Solution(laps, feats, under, goal, sigma, notes, fitted)


def _min_laps(car: Car, feat: Features, pins: dict[int, float], p: Params) -> np.ndarray:
    """The fastest each of the car's laps can be in the solver: its pinned time, else the
    fastest-lap floor plus the lap's pit loss (fit_car's floor), plus lead_margin of room."""
    base = (car.fastest_time or 0.0) + p.fastest_margin + p.lead_margin
    x = base + feat.pit
    for lap, v in pins.items():
        if 1 <= lap <= car.laps:
            x[lap - 1] = v
    if car.fastest_lap and 1 <= car.fastest_lap <= car.laps and car.fastest_time:
        x[car.fastest_lap - 1] = car.fastest_time
    return x


def order_breaks(
    rules: dict[int, tuple[list[str], dict[str, float], float | None]],
    laps: dict[str, np.ndarray],
    p: Params,
) -> list[int]:
    """The laps where the solved times break their sourced order (the listed cars not first,
    in order, at the end of the lap) or a sourced gap (beyond its tolerance)."""
    times = {d: _cum(x) for d, x in laps.items()}
    out = []
    for lap, (order, gaps, tol) in rules.items():
        t = {d: float(x[lap]) for d, x in times.items() if len(x) > lap}
        ranked = sorted(t, key=t.get)
        have = [d for d in order if d in t]
        bad = ranked[: len(have)] != have
        tol = tol or p.lap_gap_tolerance
        if have and not bad:
            bad = any(abs(t[d] - t[have[0]] - g) > tol for d, g in gaps.items() if d in t)
        if bad:
            out.append(lap)
    return out


def _admm_qp(
    P: sparse.csc_matrix,
    A: sparse.csc_matrix,
    lo: np.ndarray,
    hi: np.ndarray,
    iterations: int = 4000,
) -> np.ndarray:
    """min 1/2 x'Px s.t. lo <= Ax <= hi, by the ADMM splitting OSQP uses (one sparse LU,
    fixed step; equality rows take a stiffer step). Converges to the least-squares point of
    the constraints when they conflict, so a conflict shows in the anchor report."""
    n = P.shape[0]
    eq = np.isclose(lo, hi)
    rho = np.where(eq, 1e3, 1.0) * 0.5
    sigma, alpha = 1e-6, 1.6
    K = (P + sigma * sparse.identity(n) + A.T @ sparse.diags(rho) @ A).tocsc()
    solve_k = splinalg.factorized(K)
    x = np.zeros(n)
    z = np.clip(np.zeros(A.shape[0]), lo, hi)
    y = np.zeros(A.shape[0])
    for _ in range(iterations):
        xt = solve_k(sigma * x + A.T @ (rho * z - y))
        zt = A @ xt
        x = alpha * xt + (1 - alpha) * x
        zr = alpha * zt + (1 - alpha) * z
        z_new = np.clip(zr + y / rho, lo, hi)
        y = y + rho * (zr - z_new)
        if (
            np.max(np.abs(z_new - z), initial=0.0) < 1e-7
            and np.max(np.abs(A @ x - z_new), initial=0.0) < 1e-6
        ):
            z = z_new
            break
        z = z_new
    return x


def order_marks(
    anchors: Anchors,
    laps: dict[str, np.ndarray],
    rules: dict[int, tuple[list[str], dict[str, float], float | None]],
    p: Params,
    marks: dict[str, dict[int, float]],
    goal: dict[str, float],
    pins: dict[str, dict[int, float]],
    feats: dict[str, Features],
    window: float,
) -> dict[str, dict[int, float]]:
    """The cars' times at the sourced laps that hold the sourced running order, as close to
    the current solution as least squares allows (a convex QP).

    The unknowns are the times (s from the start) at the end of each sourced lap of every
    car near the front then (listed, or within `window` s of the last car listed), plus the
    laps the car is already marked at. The cost is the change of pace each implies: per
    segment between two of a car's marks, (change of the segment's time)^2 / its free laps,
    which is the sum of squares of the per-lap change fit_car makes (a constant per segment).
    The constraints: the listed cars first, in order, lead_margin apart, every other car
    behind them; sourced gaps within 40% of their tolerance; each segment no faster than the
    car's floor laps (`_min_laps`); a finisher still makes its target. Returns the marks
    (driver -> lap -> s), old ones moved where solved."""
    times = {d: _cum(x) for d, x in laps.items()}
    m = p.lead_margin
    keys: dict[tuple[str, int], int] = {}

    def has_target(car: Car) -> bool:
        return car.time is not None or car.finished

    def var(d: str, lap: int) -> int | None:
        car = anchors.car(d)
        # A finisher's last lap ends at its target, but a retirement's (whose target is its
        # natural time inside its window, `targets`) can be marked there too.
        if lap > car.laps or (lap == car.laps and has_target(car)):
            return None
        return keys.setdefault((d, lap), len(keys))

    for lap, (order, _, _) in rules.items():
        t = {d: float(x[lap]) for d, x in times.items() if len(x) > lap}
        have = [d for d in order if d in t]
        if not have:
            continue
        edge = max(t[d] for d in have) + window
        for d in have:
            var(d, lap)
        for d, v in t.items():
            if v <= edge:
                var(d, lap)
    for d, ms in marks.items():
        for lap in ms:
            if len(times.get(d, ())) > lap:
                var(d, lap)
    if not keys:
        return marks
    n = len(keys)
    rows, cols, vals, lo, hi = [], [], [], [], []

    def row(coef: dict[int, float], a: float, b: float) -> None:
        r = len(lo)
        for j, v in coef.items():
            rows.append(r), cols.append(j), vals.append(v)
        lo.append(a), hi.append(b)

    def cur(d: str, lap: int) -> float:
        return float(times[d][lap])

    # The cost, as weighted squares of linear terms (cost rows): per car, each segment's
    # per-lap pace change lambda (its change of time over its free laps), lightly, and the
    # step in lambda from one segment to the next, strongly, so a car moved at a sourced lap
    # takes a smooth change of pace that spreads over the laps around it.
    cost_rows: list[tuple[dict[int, float], float]] = []
    per_car: dict[str, list[int]] = {}
    for d, lap in keys:
        per_car.setdefault(d, []).append(lap)
    for d, laps_d in per_car.items():
        car = anchors.car(d)
        laps_d.sort()
        floor = _cum(_min_laps(car, feats[d], pins.get(d, {}), p))
        fixed = sorted(pins.get(d, {}))
        if car.fastest_lap:
            fixed.append(car.fastest_lap)

        def free(a: int, b: int, fixed=fixed) -> int:
            return (b - a) - sum(1 for f in set(fixed) if a < f <= b)

        lambdas: list[dict[int, float]] = []
        prev = 0
        for lap in laps_d:
            j = keys[(d, lap)]
            k = free(prev, lap)
            span_floor = float(floor[lap] - floor[prev])
            span_now = cur(d, lap) - (cur(d, prev) if prev else 0.0)
            coef = {j: 1.0}
            if prev:
                coef[keys[(d, prev)]] = -1.0
            if k == 0:
                row(coef, 0.0, 0.0)
            else:
                row(coef, span_floor - span_now, math.inf)
                lam = {i: v / k for i, v in coef.items()}
                cost_rows.append((lam, p.pace_weight * k))
                lambdas.append(lam)
            prev = lap
        if has_target(car) and d in goal and prev < car.laps:
            j = keys[(d, prev)]
            k = free(prev, car.laps)
            room = goal[d] - cur(d, prev) - float(floor[car.laps] - floor[prev])
            if k == 0:
                row({j: 1.0}, 0.0, 0.0)
            else:
                row({j: 1.0}, -math.inf, room)
                lam = {j: -1.0 / k}
                cost_rows.append((lam, p.pace_weight * k))
                lambdas.append(lam)
        for l0, l1 in zip(lambdas, lambdas[1:], strict=False):
            step = dict(l1)
            for i, v in l0.items():
                step[i] = step.get(i, 0.0) - v
            cost_rows.append((step, 1.0))
    listed = {lap: set(r[0][1:]) | set(r[1]) for lap, r in rules.items()}
    for lap, (order, gaps, tol) in rules.items():
        t = {d: cur(d, lap) for d in times if len(times[d]) > lap}
        have = [d for d in order if d in t]
        if not have:
            continue

        def before(a: str, b: str, gap: float, lap=lap, t=t) -> None:
            ja, jb = keys.get((a, lap)), keys.get((b, lap))
            if ja is None and jb is None:
                return
            coef = {}
            if ja is not None:
                coef[ja] = 1.0
            if jb is not None:
                coef[jb] = coef.get(jb, 0.0) - 1.0
            row(coef, -math.inf, t[b] - t[a] - gap)

        for a, b in zip(have, have[1:], strict=False):
            before(a, b, m)
        # The cars behind the listed ones keep their spacing: moving one back moves the cars
        # behind it too (pack_weight on each change of gap between road neighbours), so a pack
        # pushed behind a sourced leader isn't squeezed onto its tail.
        # (Only cars no sourced order lists within PACK_LAPS laps: a car the sources place
        # nearby follows them, not the pack.)
        near = {
            d for lap2 in range(lap - PACK_LAPS, lap + PACK_LAPS + 1) for d in listed.get(lap2, ())
        }
        pack = sorted(
            (d for d in t if d not in have and d not in near and (d, lap) in keys), key=t.get
        )
        for a, b in zip(pack, pack[1:], strict=False):
            cost_rows.append(({keys[(a, lap)]: 1.0, keys[(b, lap)]: -1.0}, p.pack_weight))
        last = have[-1]
        for d in t:
            if d not in have and (d, lap) in keys:
                before(last, d, m)
        h = 0.4 * (tol or p.lap_gap_tolerance)
        lead = have[0]
        for d, g in gaps.items():
            if d not in t or d == lead:
                continue
            jd, jl = keys.get((d, lap)), keys.get((lead, lap))
            coef = {}
            if jd is not None:
                coef[jd] = 1.0
            if jl is not None:
                coef[jl] = coef.get(jl, 0.0) - 1.0
            if coef:
                base = t[d] - t[lead]
                row(coef, g - h - base, g + h - base)
    A = sparse.csc_matrix((vals, (rows, cols)), shape=(len(lo), n))
    lr, lc, lv, lw = [], [], [], []
    for r, (coef, w) in enumerate(cost_rows):
        for j, v in coef.items():
            lr.append(r), lc.append(j), lv.append(v)
        lw.append(w)
    L = sparse.csc_matrix((lv, (lr, lc)), shape=(len(cost_rows), n))
    P = (2.0 * L.T @ sparse.diags(lw) @ L).tocsc()
    P = P + 1e-4 * sparse.identity(n, format="csc")  # keeps P definite
    dx = _admm_qp(P, A, np.array(lo, float), np.array(hi, float))
    out: dict[str, dict[int, float]] = {d: {} for d in marks}
    for (d, lap), j in keys.items():
        out.setdefault(d, {})[lap] = cur(d, lap) + float(dx[j])
    return out


def _last_lap_stops(
    anchors: Anchors,
    p: Params,
    sigma: float,
    laps: dict[str, np.ndarray],
    goal: dict[str, float],
    feats: dict[str, Features],
    zs: dict[str, np.ndarray],
    pins: dict[str, dict[int, float]],
    fitted: dict[str, dict],
    marks: dict[str, dict[int, float]] | None = None,
) -> dict[str, np.ndarray]:
    """Refit each last-lap stop (facts `lastLapStops`) against the leader's solved laps: its
    last completed lap ends its sourced gap behind the leader's (else its target, kept after the
    leader's and before the flag), in classification order. `targets` could only estimate the
    leader's last lap."""
    stops = sorted(
        (c for c in anchors.cars if c.last_lap_source is not None and c.driver in laps),
        key=lambda c: c.position or 999,
    )
    if not stops:
        return laps
    lead = min((c for c in anchors.cars if c.time is not None), key=lambda c: c.time)
    lead_laps = laps[lead.driver]
    lead_end = float(lead_laps[: anchors.laps - 1].sum())
    t_win = float(lead_laps.sum())
    prev = lead_end
    out = dict(laps)
    for c in stops:
        want = lead_end + c.last_lap_gap if c.last_lap_gap is not None else goal[c.driver]
        want = min(max(want, prev + p.order_gap), t_win - p.order_gap)
        fit = fit_car(
            c,
            feats[c.driver],
            zs[c.driver],
            p,
            sigma,
            want,
            pins[c.driver],
            marks=(marks or {}).get(c.driver),
        )
        out[c.driver] = fit.laps
        goal[c.driver] = want
        fitted[c.driver] = {**fitted.get(c.driver, {}), "target": round(want, 3)}
        prev = want
    return out


# --- The raw snapshot --------------------------------------------------------------------


def laps_frame(anchors: Anchors, sol: Solution) -> pd.DataFrame:
    """The solution as the raw parquet's rows (ingest.LAP_COLUMNS), as jolpica.laps_frame
    writes them: Time is seconds from the start; a car out on lap 1 has lap 1 untimed at 0."""
    rows = []
    for car in anchors.cars:
        if car.laps < 1:
            # On a wet race, the tyre it started on (as a car that ran a lap), so its untimed
            # lap doesn't read as a one-lap stint on the dry compound.
            start = (
                TYRE_COMPOUND[stint_tyres(car, anchors.wetness, anchors.curves)[0][0]]
                if anchors.wetness is not None
                else None
            )
            rows.append(
                {
                    **dict.fromkeys(LAP_COLUMNS),
                    "Driver": car.driver,
                    "Team": car.team,
                    "LapNumber": 1.0,
                    "Time": 0.0,
                    "Compound": start,
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
                    "Compound": TYRE_COMPOUND[feat.tyre[i]] if feat.tyre else None,
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


def weather_records(anchors: Anchors, df: pd.DataFrame) -> list[dict] | None:
    """A wet race's weather as the build reads it (wet.rain_laps, wet.dry_laps): one record a
    lap at the leader's lap end, `rain` where the track is wet (wetness >= RAIN_FROM), with the
    sourced wetness and its source; None for a dry race."""
    if anchors.wetness is None:
        return None
    lead = df[df["Position"] == 1].set_index("LapNumber")["Time"]
    out = []
    for lap, w in enumerate(anchors.wetness, 1):
        t = lead.get(float(lap))
        out.append(
            {
                "lap": lap,
                "time": None if t is None or t != t else round(float(t), 3),
                "rain": w >= RAIN_FROM,
                "source": WEATHER_SOURCE,
                "wetness": w,
            }
        )
    return out


def weather_summary(anchors: Anchors) -> dict | None:
    """The sidecar's weather: the sourced timeline, the wetness per lap and each car's stint
    tyres (sourced or estimated)."""
    if anchors.wetness is None:
        return None
    tyres = []
    for c in anchors.cars:
        if c.laps < 1:
            continue
        for k, (cls, sourced) in enumerate(stint_tyres(c, anchors.wetness, anchors.curves), 1):
            tyres.append(
                {
                    "driver": c.driver,
                    "stint": k,
                    "tyre": cls,
                    "by": "source" if sourced else "estimate",
                }
            )
    return {
        "source": WEATHER_SOURCE,
        "states": STATE_WETNESS,
        "timeline": anchors.weather_timeline,
        "wetness": anchors.wetness,
        "curves": anchors.curves,
        "tyres": tyres,
    }


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

    # A lap-1 retirement's place on lap 1 is its sourced time's (lap1_retirement): not checked.
    out_on_one = {c.driver for c in anchors.cars if lap1_retirement(c)}
    starters = [c.driver for c in lap1_order(anchors, anchors.cars) if c.driver not in out_on_one]
    lap1 = timed[timed["LapNumber"] == 1].sort_values("Time")["Driver"].tolist()
    lap1 = [d for d in lap1 if d not in out_on_one]
    moved = starters != [c.driver for c in grid_order(anchors.cars) if c.driver not in out_on_one]
    subject = "lap-1 order is the grid order" + (
        " (the sourced lap-1 order at the front)" if moved else ""
    )
    if out_on_one:
        subject += f" (out after lap 1, at its sourced time: {' '.join(sorted(out_on_one))})"
    out.append(_row("grid", subject, starters, lap1, lap1 == starters))

    # The classified cars head the road order (assemble.finishing_order): no unclassified car
    # (a disqualified one, say) ahead of them, except a disqualified car a source places on the
    # road, at its road place.
    road = road_order(anchors)
    order = finishing_order(df)[: len(road)]
    placed = [c.driver for c in anchors.cars if c.road_position is not None]
    subject = "classification" + (
        f" (road order: {', '.join(placed)} disqualified, at the sourced road place)"
        if placed
        else ""
    )
    out.append(_row("order", subject, road, order, order == road))

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
    # A last-lap stop's RETIREMENT is written by the build on the last lap: it must be running
    # when the leader starts it and stopped before the flag (no time over the line after it).
    for c in anchors.cars:
        if c.last_lap_source is not None and c.driver in end:
            leader_start = float(by_car[lead[0].driver]["Time"].iloc[-2])
            if leader_start < end[c.driver] < t_win:
                seen.add(c.driver)
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
            who = f"{c.driver} (estimated lap)" if s.estimated else c.driver
            out.append(_row("stop", who, s.lap, s.lap if ok else None, bool(ok)))

    if anchors.wetness is not None:
        # Each sourced stint tyre on its laps (the snapshot's Compound).
        for c in anchors.cars:
            g = by_car.get(c.driver)
            if g is None:
                continue
            for k, (cls, sourced) in enumerate(stint_tyres(c, anchors.wetness, anchors.curves), 1):
                if not sourced:
                    continue
                laps_k = g[g["Stint"] == float(k)]
                if laps_k.empty:
                    continue
                want = TYRE_COMPOUND[cls]
                got = {None if v != v or v is None else str(v) for v in laps_k["Compound"]}
                out.append(
                    _row("tyre", f"{c.driver} stint {k}", cls, sorted(map(str, got)), got == {want})
                )

    leader = timed[timed["Position"] == 1]
    got_sc = sorted(int(n) for n in leader[leader["TrackStatus"] == SC]["LapNumber"])
    want_sc = sorted({n for sc in anchors.safety_cars for n in range(sc.start, sc.end + 1)})
    note = "sourced" if anchors.safety_cars_complete else "sourced (others unknown)"
    out.append(_row("safety car", f"leader's SC laps, {note}", want_sc, got_sc, got_sc == want_sc))
    out += order_report(anchors, timed, p)
    return out


def order_report(anchors: Anchors, timed: pd.DataFrame, p: Params) -> list[dict]:
    """The sourced running order on the written frame: a `leader` row per lapLeaders span
    (the car first across the line at the end of each of its laps), a `running order` row
    per snapshot (its places from the front) and a `lap gap` row per sourced gap."""
    out: list[dict] = []
    if not anchors.leaders and not anchors.snapshots:
        return out
    ranked = {int(lap): g.sort_values("Time") for lap, g in timed.groupby("LapNumber")}
    first = {lap: str(g["Driver"].iloc[0]) for lap, g in ranked.items()}
    for s in anchors.leaders:
        want = s.end - s.start + 1
        off = [lap for lap in range(s.start, s.end + 1) if first.get(lap) != s.driver]
        got = f"{want - len(off)} of {want} laps" + (
            f"; not on {', '.join(map(str, off[:8]))}{' ...' if len(off) > 8 else ''}"
            f" ({', '.join(sorted({first.get(lap, '-') for lap in off}))} led)"
            if off
            else ""
        )
        out.append(
            _row("leader", f"{s.driver} laps {s.start}-{s.end}", f"{want} laps", got, not off)
        )
    for snap in anchors.snapshots:
        g = ranked.get(snap.lap)
        got = [] if g is None else g["Driver"].tolist()[: len(snap.order)]
        out.append(
            _row("running order", f"lap {snap.lap}", list(snap.order), got, got == list(snap.order))
        )
        if g is None:
            continue
        t = dict(zip(g["Driver"], g["Time"], strict=True))
        t0 = float(g["Time"].iloc[0])
        tol = snap.tolerance or p.lap_gap_tolerance
        for d, gap in snap.gaps:
            achieved = round(float(t[d]) - t0, 3) if d in t else None
            ok = achieved is not None and abs(achieved - gap) <= tol
            out.append(_row("lap gap", f"{d} at lap {snap.lap} (+/-{tol:g}s)", gap, achieved, ok))
    return out


def summary(report: list[dict]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for r in report:
        s = out.setdefault(r["anchor"], {"pass": 0, "total": 0})
        s["total"] += 1
        s["pass"] += bool(r["pass"])
    return out


CORE = (
    "grid",
    "order",
    "gap",
    "fastest",
    "retirement",
    "laps down",
    "stop",
    "safety car",
    "tyre",
    "leader",
    "running order",
    "lap gap",
)


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
        "Position each lap follows from the synthetic times; the lap-1 order is the grid order"
        + (
            ", with the sourced lap-1 order at the front; each lap's leader and the sourced"
            " snapshots of the order and gaps are anchors, the rest of the order is estimated"
            if anchors.leaders or anchors.snapshots
            else ""
        ),
        "Lap times in between the anchors: pace + tyre wear + fuel + seeded noise"
        + (
            ", the pace moved by a constant between the laps the sourced order marks"
            if anchors.leaders or anchors.snapshots
            else ""
        ),
        f"Fuel: {p.fuel_per_lap}s per lap of fuel on board;"
        + (" each stop refuels to the next stop" if refuel else " full tank at the start"),
        f"Stop loss: pit-lane time - {p.pit_bypass}s, {p.pit_in_share:.0%} on the in-lap",
        "PitInTime is the in-lap's end; PitOutTime adds the out-lap's share of the lane time",
    ]
    if anchors.wetness is None:
        words += [
            "Compound is left empty (one dry compound per race, estimated in step 2.4)",
            "No weather timeline: the race is assumed dry",
        ]
    else:
        words += [
            "Weather: each lap's wetness from the facts file's sourced timeline (track states"
            f" as wetness: {STATE_WETNESS}; ramps between sourced points are linear)",
            "Wet laps: the dry lap x (1 + the stint tyre's penalty at that wetness), the"
            " weather model's curves (data/wet.json); tyre wear at wet.wear_mult",
            "Compound: WET / INTERMEDIATE on wet-tyre stints, slick stints left empty (step"
            " 2.4's dry compound); a stint no source names gets the tyre that loses least"
            " over its laps",
        ]
    for r in road_positions(anchors):
        where = (
            f"at its sourced gap, +{r['gap']:.3f}s"
            if r["gapSourced"]
            else "between its road neighbours (no gap sourced: its time is an estimate)"
        )
        words.append(
            f"{r['driver']}: disqualified, run to the flag P{r['position']} on the road {where};"
            " the official result keeps it excluded"
        )
    guessed = sorted({(s.lap, c.driver) for c in anchors.cars for s in c.stops if s.estimated})
    if guessed:
        words.append(
            f"Slick stops on lap {guessed[0][0]} estimated for"
            f" {' '.join(d for _, d in guessed)}: a source says the field changed back to slicks"
            " (weather.slickChange) but not on which lap; the lap is the median of the sourced"
            " slick stops in that window"
        )
    if not anchors.stops_complete:
        words.append("Stops: only the sourced ones; cars may have stopped more (unknown)")
    if not anchors.safety_cars_complete:
        words.append("Safety cars: only the sourced ones (none found is not none run)")
    return words


def road_positions(anchors: Anchors) -> list[dict]:
    """The sidecar's disqualified cars placed on the road: each one's road place, race time
    gap to the winner on the road (sourced or estimated) and source. The build keeps them out
    of the race file's official result (`build.official_result`)."""
    winner = next(c for c in anchors.cars if c.position == 1)
    return [
        {
            "driver": c.driver,
            "position": c.road_position,
            "gap": None if c.time is None else round(c.time - float(winner.time), 3),
            "gapSourced": c.time is not None,
            "source": c.road_source,
        }
        for c in sorted(anchors.cars, key=lambda c: c.road_position or 0)
        if c.road_position is not None
    ]


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
    weather: list[dict] | None = None  # a wet race's per-lap records (<race-id>.weather.json)


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
        "classified": [
            c.driver for c in sorted(anchors.cars, key=lambda c: c.position or 999) if c.classified
        ],
        "roadPositions": road_positions(anchors),
        "lastLapStops": last_lap_stops(anchors),
        "stopsComplete": anchors.stops_complete,
        "safetyCarsComplete": anchors.safety_cars_complete,
        "params": asdict(replace(p, sigma=sol.sigma)),
        "solver": {"attempts": attempt, "sigma": round(sol.sigma, 4), "passed": not failed},
        "fitted": sol.fitted,
        "summary": summary(report),
        "anchors": report,
        "notes": anchors.notes + sol.notes,
    }
    weather = weather_summary(anchors)
    if weather is not None:
        sidecar["weather"] = weather
    return Result(df, track_status(anchors, df), sidecar, weather_records(anchors, df))


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
    """raw/<id>.parquet, .status.json, .reconstruction.json and .anchors.md, and a wet race's
    .weather.json (the per-lap records the build reads)."""
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
    if result.weather is not None:
        paths.append(save_weather(race_id, result.weather, raw_dir))
    else:
        # A rerun of a race whose facts no longer have weather leaves no stale records of
        # its own (records from anywhere else are left alone).
        old = weather_path(race_id, raw_dir)
        if old.exists() and any(
            r.get("source") == WEATHER_SOURCE for r in json.loads(old.read_text())
        ):
            old.unlink()
    return paths
