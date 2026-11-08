"""Python reference simulator (Phase 1.7).

A lap-loop simulator that runs from the takeover lap to the flag. It reads the race-model
dict (the same input the TypeScript sim will consume) so it both validates the model and
produces golden outputs for the port. A run is fully defined by (model, seed, strategies).

Tuning constants live at the top; Gate G1 is reached by adjusting them until the sim
reproduces real races.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

from . import race_rules
from .legend import legend_events
from .paths import GOLDEN_DIR
from .rng import Mulberry32, derive_seed

DIRTY_AIR_RANGE = 1.0  # within this gap (s) a car is in dirty air
PASS_WINDOW = 2.0  # a follower within this gap (s) gets one pass roll (matches the fit)
FOLLOW_GAP = 0.3  # a follower that fails to pass is held this far (s) behind
PASS_MARGIN = 0.05  # a completed pass puts the follower this far (s) ahead
# A car that has just been passed gets no pass roll against the car that passed it for this
# many laps (real races: ~4% of passes are undone within 3 laps; without it the sim undid
# 25-60%). 0 = off. Model v3 spec stage 7 (E1). Same rule in packages/sim (parity).
REPASS_COOLDOWN = 3
BUNCH_GAP = 0.5  # SC train spacing per car (measured on the final SC lap, 2021 races)
# SC bunching (measured on the tuning races' SCs, 259 gaps): gaps are kept on the deployment
# lap (everyone runs the same delta), each middle SC lap keeps SC_GAP_KEEP of a gap's excess
# over BUNCH_GAP, and the last lap before the restart is nose-to-tail (race control restarts a
# bunched field).
SC_GAP_KEEP = 0.34
SC_FALLBACK = 1.6  # SC lap = this x green if not supplied
VSC_FALLBACK = 1.35  # VSC lap = this x green if not supplied
GOLDEN_SEEDS = list(range(1, 21))  # fixed seeds for the TS parity golden files
# Random streams per car, indexed by the car's position in model["drivers"]: lap noise uses
# stream i, the car's own pass attempts (as follower) use OVERTAKE_STREAM + i. Separate
# streams mean one car's strategy never shifts another car's draws (fair grading, and
# common random numbers across a decision's options).
OVERTAKE_STREAM = 1000
CLIFF_FALLBACK = 2.0  # extra wear past the cliff = this x degPerLap if not fitted


@dataclass
class Car:
    code: str
    base_pace: float
    noise: float
    compound: str
    tyre_age: int
    total_time: float
    strategy: list = field(default_factory=list)
    retired: bool = False
    retired_lap: int | None = None
    laps_done: int = 0
    # Tyre wear in dry-lap units (the weather changes how fast a set wears); None: tyre_age.
    tyre_wear: float | None = None
    # A wet race: the driver's extra share of a lap in the wet (wet.driver_wet_pace).
    wet_pace: float = 0.0
    # A stop-go owed for entering a closed pit lane (race_rules; 2007-08).
    stop_go: float = 0.0

    def __post_init__(self):
        if self.tyre_wear is None:
            self.tyre_wear = float(self.tyre_age)


def fresh_weight_sim(tyre_age: int, laps: int) -> float:
    """Fresh-tyre weight by sim tyre age (0 = the out-lap): 1 on the first lap after the out-lap,
    fading linearly over `laps` laps (FastF1 TyreLife = sim age + 1 on a new set)."""
    return min(1.0, max(0.0, (laps + 1 - tyre_age) / laps)) if tyre_age >= 1 else 0.0


def wetness(weather: dict | None, lap: int) -> float:
    """The track's wetness on `lap` (0 in a dry race)."""
    if not weather:
        return 0.0
    w = weather["wetness"]
    return float(w[min(len(w), max(1, lap)) - 1])


def wet_penalty(weather: dict | None, compound: str, lap: int) -> float:
    """The share of a dry lap the tyre loses on `lap` (weather spec; wet.py fits the curves)."""
    w = wetness(weather, lap)
    if not weather or w <= 0 and compound not in ("INTERMEDIATE", "WET"):
        return 0.0
    curves = weather["curves"]
    if compound == "INTERMEDIATE" or compound == "WET":
        c = curves["inter" if compound == "INTERMEDIATE" else "wet"]
        return c["min"] + c["dry"] * max(0.0, c["best"] - w) + c["wet"] * max(0.0, w - c["best"])
    c = curves["slick"]
    return c["a"] * w + c["b"] * w * w


def weather_wear(weather: dict | None, compound: str, lap: int) -> float:
    """Tyre wear on `lap` against a dry lap (wet.wear_mult)."""
    if not weather:
        return 1.0
    w = wetness(weather, lap)
    if compound == "INTERMEDIATE" or compound == "WET":
        edge = 0.15 if compound == "INTERMEDIATE" else 0.3
        return 1.0 + 2.0 * max(0.0, (edge - w) / edge)
    return 1.0 - 0.8 * min(1.0, w / 0.05)


def _clean_lap(
    car: Car, compounds: dict, fuel_per_lap: float, lap: int, fresh=None, weather=None
) -> float:
    c = compounds[car.compound]
    wear = car.tyre_wear
    t = car.base_pace + c["offset"] + c["degPerLap"] * wear - fuel_per_lap * lap
    if fresh:
        t += fresh["bonus"] * fresh_weight_sim(car.tyre_age, fresh["laps"])
    if wear > c["cliffLap"]:  # past the cliff: wear accelerates
        extra = c.get("cliffDegPerLap", CLIFF_FALLBACK * c["degPerLap"])
        t += extra * (wear - c["cliffLap"])
    if weather:
        w = wetness(weather, lap)
        t *= 1 + wet_penalty(weather, car.compound, lap) + car.wet_pace * min(1.0, w / 0.1)
    return t


def _car_ahead(order: list[str], code: str, cars: dict[str, Car]) -> str:
    live = [c for c in order if not cars[c].retired]
    i = live.index(code)
    return live[i - 1] if i > 0 else code


def pass_probability(overtake: dict, advantage: float, gap: float) -> float:
    """Fitted logistic P(follower passes this lap) from pace advantage (s/lap) and gap (s)."""
    z = overtake["intercept"] + overtake["paceCoef"] * advantage + overtake["gapCoef"] * gap
    return 1.0 / (1.0 + math.exp(-z))


def _resolve_order(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent=None, lap=0):
    """Set green-flag race order after a lap.

    Walking the start-of-lap order front to back, each follower that started the lap within
    PASS_WINDOW of the car ahead gets ONE pass roll from the fitted overtake model. Success
    puts it ahead; failure holds it FOLLOW_GAP behind even if its lap was faster (it was
    stuck in traffic). Pairs involving a car that pitted this lap, or that started further
    apart, are left to the natural time order (pit-driven moves, or a gap closed in one lap).
    """
    live = [c for c in order if not cars[c].retired]
    for i in range(1, len(live)):
        a, b = cars[live[i - 1]], cars[live[i]]
        if a.code in pitted or b.code in pitted:
            continue
        gap = prev_time[b.code] - prev_time[a.code]
        if not 0 <= gap < PASS_WINDOW:
            continue
        advantage = clean[a.code] - clean[b.code]  # >0: b is faster on model pace
        cooling = (
            recent is not None
            and REPASS_COOLDOWN > 0
            and lap - recent.get((b.code, a.code), -(10**6)) <= REPASS_COOLDOWN
        )
        if not cooling and pass_rngs[b.code].next() < pass_probability(overtake, advantage, gap):
            if recent is not None:
                recent[(a.code, b.code)] = lap  # a was passed by b on this lap
            if b.total_time >= a.total_time:
                b.total_time = a.total_time - PASS_MARGIN
        elif b.total_time < a.total_time + FOLLOW_GAP:
            b.total_time = a.total_time + FOLLOW_GAP
    live.sort(key=lambda c: cars[c].total_time)
    order[:] = live + [c for c in order if cars[c].retired]


def _classify(order, cars) -> dict:
    finishers = sorted((c for c in order if not cars[c].retired), key=lambda c: cars[c].total_time)
    retirees = sorted(
        (c for c in order if cars[c].retired),
        key=lambda c: cars[c].retired_lap or 0,
        reverse=True,
    )
    winner_time = cars[finishers[0]].total_time if finishers else 0.0
    gaps = {c: round(cars[c].total_time - winner_time, 3) for c in finishers}
    times = {c: round(cars[c].total_time, 3) for c in finishers}
    return {"order": finishers + retirees, "gaps": gaps, "times": times, "finishers": finishers}


def simulate(
    model: dict,
    seed: int,
    strategies: dict | None = None,
    rival_policy: str | None = None,
    legend: bool = False,
) -> dict:
    """Run one seeded simulation to the flag. Returns finishing order and gaps to winner.

    `rival_policy` (rival_policy.py; default "standard") is validated so both sims accept the
    same names; with no player-controlled car the rival never reacts, so it can't change the
    result. `legend`: Legend difficulty's random SC/VSC periods (legend.py)."""
    from .faults import FaultState  # here, not at the top: they import this module
    from .rival_policy import resolve_rival_policy

    resolve_rival_policy(rival_policy)
    track = model["track"]
    compounds = model["compounds"]
    fuel = model["fuelEffectPerLap"]
    fresh_tyre = model.get("freshTyre")
    weather = model.get("weather")
    total_laps = int(model["race"]["laps"])
    takeover = int(model["race"]["takeoverLap"])
    overtake = track["overtakeModel"]
    dirty_air = track["dirtyAirPenalty"]
    pit_loss = track["pitLoss"]
    pit_loss_sc = track["pitLossUnderSC"]
    pit_loss_vsc = track["pitLossUnderVSC"]
    green = track.get("greenLapTime")
    sc_time = track.get("scLapTime") or (green * SC_FALLBACK if green else None)
    vsc_time = track.get("vscLapTime") or (green * VSC_FALLBACK if green else None)

    neutral: dict[int, str] = {}
    retire_at: dict[int, set[str]] = {}
    for e in legend_events(model, seed) if legend else model["events"]:
        if e["type"] in ("SC", "VSC", "RED"):
            for lap in range(e["lap"], e["lap"] + int(e.get("laps", 1))):
                neutral[lap] = e["type"]
        elif e["type"] == "RETIREMENT":
            retire_at.setdefault(e["lap"], set()).add(e["driver"])
    faults = FaultState(model["events"])  # car faults (faults.py): frozen on their real laps

    ordered = sorted(model["drivers"], key=lambda d: d["stateAtTakeover"]["position"])
    cars: dict[str, Car] = {}
    cum = 0.0
    for d in ordered:
        s = d["stateAtTakeover"]
        cum += s["gapAhead"]
        strat = (strategies or {}).get(d["code"], d["realStrategy"])
        cars[d["code"]] = Car(
            code=d["code"],
            base_pace=d["basePace"],
            noise=d["noise"],
            compound=s["compound"],
            tyre_age=s["tyreAge"],
            total_time=cum,
            strategy=list(strat),
            laps_done=takeover,
            wet_pace=d.get("wetPace", 0.0),
        )

    order = [d["code"] for d in ordered]
    stream = {d["code"]: i for i, d in enumerate(model["drivers"])}
    noise_rngs = {c: Mulberry32(derive_seed(seed, stream[c])) for c in cars}
    pass_rngs = {c: Mulberry32(derive_seed(seed, OVERTAKE_STREAM + stream[c])) for c in cars}

    recent: dict[tuple[str, str], int] = {}

    def active_codes() -> list[str]:
        return [c for c in order if not cars[c].retired]

    for lap in range(takeover + 1, total_laps + 1):
        flag = neutral.get(lap)
        prev_time = {c: cars[c].total_time for c in active_codes()}
        clean: dict[str, float] = {}
        pitted: set[str] = set()

        for code in active_codes():
            car = cars[code]
            pit = next((st for st in car.strategy if st["lap"] == lap), None)
            pit_cost = 0.0
            # Era rules (race_rules): an owed stop-go is served on a green lap.
            if car.stop_go:
                served = race_rules.serve_stop_go(car, flag, lap, total_laps)
                if served:
                    pit_cost += served
                    pitted.add(code)
            if pit:
                pitted.add(code)
                car.strategy.remove(pit)
                # Era rules: with no tyre changes (2005) the stop keeps the set.
                if race_rules.stop_changes_tyres(model, car.compound, pit):
                    car.compound = pit["to"]
                    car.tyre_age = 0
                    car.tyre_wear = 0.0
                default = {"SC": pit_loss_sc, "VSC": pit_loss_vsc}.get(flag, pit_loss)
                pit_cost += pit.get("loss", default)
                # Era rules: an added stop into a closed pit lane (2007-08) owes a stop-go.
                if pit.get("added") and race_rules.pit_lane_closed(model, neutral, lap, pit["to"]):
                    car.stop_go += race_rules.stop_go_cost(model)
                    if lap >= total_laps:
                        pit_cost += race_rules.serve_stop_go(car, flag, lap, total_laps)
            fault_pace, fault_extra = faults.cost(code, lap, bool(pit), flag is None)

            if flag == "SC" and sc_time:
                lt = sc_time
            elif flag == "VSC" and vsc_time:
                lt = vsc_time
            elif flag == "RED" and green:
                lt = green
            else:
                lt = _clean_lap(car, compounds, fuel, lap, fresh_tyre, weather) + noise_rngs[
                    code
                ].normal(car.noise)
                ahead = _car_ahead(order, code, cars)
                ahead_gap = car.total_time - prev_time.get(ahead, car.total_time)
                if 0 < ahead_gap < DIRTY_AIR_RANGE:
                    lt += dirty_air
            lt += fault_pace + fault_extra
            clean[code] = _clean_lap(car, compounds, fuel, lap, fresh_tyre, weather) + fault_pace
            car.total_time += lt + pit_cost
            car.tyre_age += 1
            car.tyre_wear += weather_wear(weather, car.compound, lap)
            car.laps_done = lap

        for code in retire_at.get(lap, ()):
            if code in cars and not cars[code].retired:
                cars[code].retired = True
                cars[code].retired_lap = lap

        if flag:
            # No overtaking under neutralization: every car ran the same neutralized lap, so
            # sorting by total time moves only cars that pitted, by their pit loss against
            # the gaps on track. Under a SC the gaps then close (SC_GAP_KEEP), so an early SC
            # stop (gaps still open) is cheap while a stop into a bunched train drops places.
            live = sorted(active_codes(), key=lambda c: cars[c].total_time)
            order[:] = live + [c for c in order if cars[c].retired]
            if flag == "SC" and neutral.get(lap - 1) == "SC":
                # Deployment lap: gaps kept (delta time). Middle laps: each gap keeps
                # SC_GAP_KEEP of its excess. Last lap before the restart: nose-to-tail.
                keep = 0.0 if neutral.get(lap + 1) != "SC" else SC_GAP_KEEP
                _bunch(live, cars, green, keep, race_rules.sc_queue(model))
                live = sorted(live, key=lambda c: cars[c].total_time)
                order[:] = live + [c for c in order if cars[c].retired]
        else:
            _resolve_order(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent, lap)

    return _classify(order, cars)


def _bunch(
    live: list[str],
    cars: dict[str, Car],
    lap_time: float | None,
    keep: float,
    duel: tuple[str, str] | str | None,
) -> None:
    """Close the SC queue: each gap keeps `keep` of its excess over BUNCH_GAP (nose-to-tail on
    the last lap). By the rules every lapped car unlaps and joins the back of the queue, so
    the whole field closes up in race order (duel None). A race with scUnlap "duel" follows
    Abu Dhabi 2021's call instead: only the lead lap closes up, the lapped cars stay where
    they are a lap down, and on the last lap (keep 0) the lapped cars sitting between the
    user's car and the rival are waved through to the back of the lead-lap queue."""
    if not live:
        return
    if duel is None:
        for i in range(1, len(live)):
            ahead, car = cars[live[i - 1]], cars[live[i]]
            excess = max(0.0, car.total_time - ahead.total_time - BUNCH_GAP)
            car.total_time = ahead.total_time + BUNCH_GAP + keep * excess
        return
    lead = cars[live[0]].total_time
    down = {c: math.floor((cars[c].total_time - lead) / lap_time) if lap_time else 0 for c in live}
    on_track = {c: cars[c].total_time - lead - down[c] * (lap_time or 0.0) for c in live}
    lead_lap = [c for c in live if down[c] == 0]
    waved: list[str] = []
    # scUnlap "none" (race_rules.sc_queue): the lead lap closes up, nobody is waved through.
    a, b = ("", "") if duel == "none" else duel
    if duel != "none" and keep == 0.0 and a in lead_lap and b in lead_lap:
        lo, hi = sorted((on_track[a], on_track[b]))
        waved = sorted(
            (c for c in live if down[c] >= 1 and lo < on_track[c] < hi),
            key=lambda c: on_track[c],
        )
    for i in range(1, len(lead_lap)):
        ahead, car = cars[lead_lap[i - 1]], cars[lead_lap[i]]
        excess = max(0.0, car.total_time - ahead.total_time - BUNCH_GAP)
        car.total_time = ahead.total_time + BUNCH_GAP + keep * excess
    last = cars[lead_lap[-1]].total_time
    for c in waved:
        last += BUNCH_GAP
        cars[c].total_time = last


def write_golden(model: dict, seeds: list[int]) -> None:
    """Write reference outputs for fixed seeds to data/golden/ for TS parity tests."""
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    out = {str(s): simulate(model, s) for s in seeds}
    path = GOLDEN_DIR / f"{model['race']['id']}.json"
    path.write_text(json.dumps(out, indent=2))
