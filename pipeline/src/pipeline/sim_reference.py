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
from pathlib import Path

from . import race_rules, redflag, refuel, restart, sc_queue
from .legend import legend_events, legend_loss, real_flags
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
# Eras overtake model (overtaking.py; a race file whose overtakeModel has trainCoef): the car
# ahead is in a train when it started the lap within this gap (s) of its own car ahead, and the
# roll's logit takes trainCoef. Same constant in packages/sim (TRAIN_GAP).
TRAIN_GAP = 1.0
BUNCH_GAP = 0.5  # SC train spacing per car (measured on the final SC lap, 2021 races)
# SC bunching (measured on the tuning races' SCs, 259 gaps): gaps are kept on the deployment
# lap (everyone runs the same delta), each middle SC lap keeps SC_GAP_KEEP of a gap's excess
# over BUNCH_GAP, and the last lap before the restart is nose-to-tail (race control restarts a
# bunched field).
SC_GAP_KEEP = 0.34
# An Eras race (one with an era `rules` block) closes its middle SC laps gap by gap instead,
# each gap over SC_QUEUE_SPACING keeping SC_QUEUE_KEEP of its excess (fitted on the 2018+ timed
# races' real queues: sc_queue.py). Daily/Gauntlet race files carry no rules block.
SC_QUEUE_SPACING = sc_queue.SC_QUEUE_SPACING
SC_QUEUE_KEEP = sc_queue.SC_QUEUE_KEEP
SC_FALLBACK = 1.6  # SC lap = this x green if not supplied
VSC_FALLBACK = 1.35  # VSC lap = this x green if not supplied
GOLDEN_SEEDS = list(range(1, 21))  # fixed seeds for the TS parity golden files
# Random streams per car, indexed by the car's position in model["drivers"]: lap noise uses
# stream i, the car's own pass attempts (as follower) use OVERTAKE_STREAM + i. Separate
# streams mean one car's strategy never shifts another car's draws (fair grading, and
# common random numbers across a decision's options).
OVERTAKE_STREAM = 1000
CLIFF_FALLBACK = 2.0  # extra wear past the cliff = this x degPerLap if not fitted
# Scripted team orders and let-bys (TEAM_ORDER events, Eras builds: data/incidents.json): on a
# green lap from the event's lap, for up to TEAM_ORDER_LAPS laps, a yielder still ahead of its
# passer and no more than TEAM_ORDER_WINDOW s clear of it lifts and drops TEAM_ORDER_GAP s
# behind it, and doesn't pass it back for the rest of the race. Same rule in packages/sim.
TEAM_ORDER_LAPS = 3
TEAM_ORDER_WINDOW = 10.0
TEAM_ORDER_GAP = 0.5


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
    # An Eras build's pace on a damp track (wetness under wet.DAMP_EDGE; wet.driver_band_pace),
    # where wet_pace is its pace on a wet one. None: wet_pace at any wetness.
    damp_pace: float | None = None
    # A stop-go owed for entering a closed pit lane (race_rules; 2007-08).
    stop_go: float = 0.0
    # A refuelling race (refuel.py): fuel on board in laps, and the race's laps.
    tank: float | None = None
    race_laps: int = 0
    # Stops with no tyre change (a repair, a stop-go, a drive-through): {lap, loss} each.
    service: list = field(default_factory=list)
    # Pace by stint (pace.stint_offsets; Eras builds): the offset of the stint the car is on,
    # and its offsets by the lap each real stint began (0: the takeover stint).
    stint_pace: float = 0.0
    stint_table: dict = field(default_factory=dict)

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


# Wetness below this is damp: a car's damp_pace applies there (wet.DAMP_EDGE).
DAMP_EDGE = 0.15


def driver_wet(car: Car, w: float) -> float:
    """The car's extra share of a lap at wetness w, before the fade-in (wet.wet_scale)."""
    if car.damp_pace is not None and w < DAMP_EDGE:
        return car.damp_pace
    return car.wet_pace


def _clean_lap(
    car: Car, compounds: dict, fuel_per_lap: float, lap: int, fresh=None, weather=None
) -> float:
    c = compounds[car.compound]
    wear = car.tyre_wear
    t = car.base_pace + car.stint_pace + c["offset"] + c["degPerLap"] * wear - fuel_per_lap * lap
    if "degQuad" in c:  # Eras model fix S4: wear that grows with the set's age (wear_shape.py)
        t += c["degQuad"] * wear * wear
    if fresh:
        t += fresh["bonus"] * fresh_weight_sim(car.tyre_age, fresh["laps"])
    if wear > c["cliffLap"]:  # past the cliff: wear accelerates
        extra = c.get("cliffDegPerLap", CLIFF_FALLBACK * c["degPerLap"])
        t += extra * (wear - c["cliffLap"])
    t += refuel.tank_weight_delta(car, fuel_per_lap, lap)  # refuelling: the weight resets
    if weather:
        w = wetness(weather, lap)
        t *= 1 + wet_penalty(weather, car.compound, lap) + driver_wet(car, w) * min(1.0, w / 0.1)
    return t


def _car_ahead(order: list[str], code: str, cars: dict[str, Car]) -> str:
    live = [c for c in order if not cars[c].retired]
    i = live.index(code)
    return live[i - 1] if i > 0 else code


def dirty_air_cost(track: dict, gap: float) -> float:
    """Seconds a car loses on a green lap it starts `gap` s behind the car ahead. An Eras build
    of a timed race (dirty_air.py) carries track.dirtyAirBands, the loss by start-of-lap gap
    band ([{upTo, penalty}], ascending); any other file the flat dirtyAirPenalty within
    DIRTY_AIR_RANGE."""
    if not gap > 0:
        return 0.0
    bands = track.get("dirtyAirBands")
    if bands is None:
        return track["dirtyAirPenalty"] if gap < DIRTY_AIR_RANGE else 0.0
    for band in bands:
        if gap < band["upTo"]:
            return band["penalty"]
    return 0.0


def pass_probability(overtake: dict, advantage: float, gap: float, train: bool = False) -> float:
    """Fitted logistic P(follower passes this lap) from pace advantage (s/lap) and gap (s).
    An Eras model (overtaking.py) adds trainCoef when the car ahead is in a train."""
    z = overtake["intercept"] + overtake["paceCoef"] * advantage + overtake["gapCoef"] * gap
    if train and "trainCoef" in overtake:
        z += overtake["trainCoef"]
    return 1.0 / (1.0 + math.exp(-z))


def _resolve_order(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent=None, lap=0):
    """Set green-flag race order after a lap.

    Walking the start-of-lap order front to back, each follower that started the lap within
    PASS_WINDOW of the car ahead gets ONE pass roll from the fitted overtake model. Success
    puts it ahead; failure holds it FOLLOW_GAP behind even if its lap was faster (it was
    stuck in traffic). Pairs involving a car that pitted this lap, or that started further
    apart, are left to the natural time order (pit-driven moves, or a gap closed in one lap).
    An Eras model (trainCoef set; overtaking.py) makes the car ahead harder to pass when it
    started the lap within TRAIN_GAP of its own car ahead (a DRS train).
    """
    live = [c for c in order if not cars[c].retired]
    trains = "trainCoef" in overtake
    # An Eras build (dirty_air.py) may hold a failed follower at its fitted heldGap instead.
    follow = overtake.get("heldGap", FOLLOW_GAP)
    roll_only = bool(overtake.get("rollOnly"))
    won: set[tuple[str, str]] = set()
    for i in range(1, len(live)):
        a, b = cars[live[i - 1]], cars[live[i]]
        if a.code in pitted or b.code in pitted:
            continue
        gap = prev_time[b.code] - prev_time[a.code]
        if not 0 <= gap < PASS_WINDOW:
            # rollOnly (dirty_air.py): from further back no roll, so no pass this lap.
            if roll_only and gap >= PASS_WINDOW and b.total_time < a.total_time + follow:
                b.total_time = a.total_time + follow
            continue
        advantage = clean[a.code] - clean[b.code]  # >0: b is faster on model pace
        cooling = (
            recent is not None
            and REPASS_COOLDOWN > 0
            and lap - recent.get((b.code, a.code), -(10**6)) <= REPASS_COOLDOWN
        )
        train = trains and i > 1 and 0 <= prev_time[a.code] - prev_time[live[i - 2]] < TRAIN_GAP
        p = pass_probability(overtake, advantage, gap, train)
        if not cooling and pass_rngs[b.code].next() < p:
            if recent is not None:
                recent[(a.code, b.code)] = lap  # a was passed by b on this lap
            won.add((a.code, b.code))
            if b.total_time >= a.total_time:
                b.total_time = a.total_time - PASS_MARGIN
        elif b.total_time < a.total_time + follow:
            b.total_time = a.total_time + follow
    if roll_only:
        _no_pass_without_roll(live, cars, pitted, won, follow)
    live.sort(key=lambda c: cars[c].total_time)
    order[:] = live + [c for c in order if cars[c].retired]


def _no_pass_without_roll(live, cars, pitted, won, follow) -> None:
    """rollOnly: a car that ends the lap ahead of one that started it ahead of it (neither
    pitting) without winning its roll against that car is held `follow` behind it, until no
    such pair is left (`live`: the start-of-lap order)."""
    start = {c: i for i, c in enumerate(live)}
    for _ in range(len(live) * len(live)):
        now = sorted(live, key=lambda c: cars[c].total_time)
        for y, x in zip(now, now[1:], strict=False):
            if start[y] > start[x] and x not in pitted and y not in pitted and (x, y) not in won:
                cars[y].total_time = cars[x].total_time + follow
                break
        else:
            return


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
    pit_loss = track["pitLoss"]
    pit_loss_sc = track["pitLossUnderSC"]
    pit_loss_vsc = track["pitLossUnderVSC"]
    green = track.get("greenLapTime")
    sc_time = track.get("scLapTime") or (green * SC_FALLBACK if green else None)
    vsc_time = track.get("vscLapTime") or (green * VSC_FALLBACK if green else None)

    neutral: dict[int, str] = {}
    retire_at: dict[int, set[str]] = {}
    real = real_flags(model) if legend else None  # Legend: stops pay the lap's conditions
    events = legend_events(model, seed) if legend else model["events"]
    pickup: dict[int, str] = {}  # an SC's first lap -> the car it picked up (sourced, Eras)
    for e in events:
        if e["type"] == "SC" and e.get("pickup"):
            pickup[int(e["lap"])] = e["pickup"]
        if e["type"] in ("SC", "VSC", "RED"):
            for lap in range(e["lap"], e["lap"] + int(e.get("laps", 1))):
                neutral[lap] = e["type"]
        elif e["type"] == "RETIREMENT":
            retire_at.setdefault(e["lap"], set()).add(e["driver"])
    faults = FaultState(model["events"])  # car faults (faults.py): frozen on their real laps
    orders = team_orders(model["events"])  # scripted team orders and let-bys (TEAM_ORDER)
    restart_block = track.get("restart")  # the SC restart's jump and spread (restart.py)
    # Free stops in the stoppage, gaps wiped at the restart (Eras: a standing one a lap later).
    red = redflag.plan(events, "rules" in model)
    # A no-unlapping race's SC and red-flag queues: the scripted cars' real laps down (job 1.5).
    known_down = redflag.real_laps_down(events, set(strategies or {}))

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
            damp_pace=d.get("dampPace"),
            service=list(d.get("serviceStops", [])),
            stint_table={int(e["lap"]): float(e["offset"]) for e in d.get("stintPace", [])},
        )
        cars[d["code"]].stint_pace = cars[d["code"]].stint_table.get(0, 0.0)

    refuel.init_tanks(model, cars)  # refuelling (refuel.py): every car's takeover tank
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
        queue = active_codes()
        restarting = restart_block is not None and is_restart_lap(neutral, red, lap)
        # An SC that picked up a car behind the leader (`pickup`): the cars ahead of it on the
        # road run a racing lap on the SC's first lap (they are ahead of the safety car).
        front = sc_front(queue, cars, pickup.get(lap)) if flag == "SC" else set()

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
                # Pace by stint: the stint begun on this lap runs at its real offset, if the
                # real car began one here (else 0).
                car.stint_pace = car.stint_table.get(lap, 0.0)
                # Era rules: with no tyre changes (2005) the stop keeps the set.
                if race_rules.stop_changes_tyres(model, car.compound, pit):
                    car.compound = pit["to"]
                    car.tyre_age = 0
                    car.tyre_wear = 0.0
                default = {"SC": pit_loss_sc, "VSC": pit_loss_vsc}.get(flag, pit_loss)
                loss = legend_loss(pit, lap, flag, real) if real is not None else pit.get("loss")
                # A red flag's stoppage: the tyre change there is free (redflag.py), the fill too.
                free = redflag.is_free(red, neutral, lap)
                if not free:
                    pit_cost += default if loss is None else loss
                # Refuelling (refuel.py): fill for the next stint; the fill time over the base.
                if car.tank is not None:
                    fill_time = refuel.refuel_at_stop(model, car, pit, lap)
                    if not free:
                        pit_cost += fill_time
                # Era rules: an added stop into a closed pit lane (2007-08) owes a stop-go.
                if pit.get("added") and race_rules.pit_lane_closed(model, neutral, lap, pit["to"]):
                    car.stop_go += race_rules.stop_go_cost(model)
                    if lap >= total_laps:
                        pit_cost += race_rules.serve_stop_go(car, flag, lap, total_laps)
            # A stop with no tyre change (a repair, a stop-go, a drive-through; assemble.py):
            # whatever the car's strategy, it pays its measured loss on its real lap.
            service = next((st for st in car.service if st["lap"] == lap), None)
            if service:
                pitted.add(code)
                car.service.remove(service)
                if not redflag.is_free(red, neutral, lap):
                    pit_cost += service["loss"]
            fault_pace, fault_extra = faults.cost(code, lap, bool(pit or service), flag is None)
            if faults.contact(code, lap):
                pitted.add(code)  # a spin or a trip off: out of the lap's pass rolls

            if code in front:
                lt = _clean_lap(car, compounds, fuel, lap, fresh_tyre, weather) + noise_rngs[
                    code
                ].normal(car.noise)
            elif flag == "SC" and sc_time:
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
                lt += dirty_air_cost(track, ahead_gap)
                if restarting:
                    # The restart lap (restart.py): the leader's jump, the queue's spread.
                    lt += restart.extra(restart_block, queue.index(code))
            lt += fault_pace + fault_extra
            clean[code] = _clean_lap(car, compounds, fuel, lap, fresh_tyre, weather) + fault_pace
            car.total_time += lt + pit_cost
            car.tyre_age += 1
            car.tyre_wear += weather_wear(weather, car.compound, lap)
            refuel.burn_tank(car)
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
                _bunch(
                    queue_behind(live, pickup.get(lap - 1)) if keep > 0.0 else live,
                    cars,
                    green,
                    keep,
                    race_rules.sc_queue(model),
                    "rules" in model,
                    known_down.get(lap),
                )
                live = sorted(live, key=lambda c: cars[c].total_time)
                order[:] = live + [c for c in order if cars[c].retired]
        else:
            _resolve_order(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent, lap)
            apply_team_orders(orders, order, cars, lap, total_laps, recent)
        wipe = red["wipes"].get(lap)
        if wipe and neutral.get(wipe[1]) == "RED":
            unlap = race_rules.sc_queue(model) != "none"
            redflag.line_up(
                active_codes(), cars, wipe[0], None if unlap else green, known_down.get(lap)
            )

    return _classify(order, cars)


def sc_front(queue: list[str], cars: dict[str, Car], picked: str | None) -> set[str]:
    """The cars on the road ahead of the car an SC picked up (`pickup`) on the SC's first lap:
    none if that car is out or leads."""
    if not picked or picked not in queue or cars[picked].retired:
        return set()
    return set(queue[: queue.index(picked)])


def queue_behind(live: list[str], picked: str | None) -> list[str]:
    """The lap after a pickup SC's first lap (its first middle lap): the queue closes up from
    the picked-up car back; the cars ahead of it are still ahead of the safety car and keep
    their gaps (Miami 2024: Norris's lead over Verstappen grew on both laps)."""
    if not picked or picked not in live:
        return live
    return live[live.index(picked) :]


def is_restart_lap(neutral: dict[int, str], red: dict, lap: int) -> bool:
    """A green lap straight after an SC lap: a safety car's restart (also a red flag's rolling
    restart behind it), not a standing restart's first lap (its own spread)."""
    if neutral.get(lap) or neutral.get(lap - 1) != "SC":
        return False
    # An Eras race spaces a standing restart at the end of its first racing lap (redflag.plan).
    standing = any(
        wipe is not None
        and wipe[0] == redflag.STANDING_RESTART_GAP
        and neutral.get(wipe[1]) == "RED"
        for wipe in (red["wipes"].get(lap - 1), red["wipes"].get(lap))
    )
    return not standing


def team_orders(events: list[dict]) -> list[dict]:
    """The race's scripted team orders (TEAM_ORDER events: `driver` lets `other` by), in lap
    order, each with the last lap it stays open."""
    return [
        {"lap": int(e["lap"]), "yielder": e["driver"], "passer": e["other"],
         "until": int(e["lap"]) + TEAM_ORDER_LAPS - 1}
        for e in sorted(events, key=lambda e: e["lap"])
        if e["type"] == "TEAM_ORDER"
    ]  # fmt: skip


def apply_team_orders(
    orders: list[dict], order: list[str], cars: dict, lap: int, total: int, recent: dict
) -> None:
    """A green lap's scripted team orders (TEAM_ORDER_* above), after the lap's passes. An
    order is done once the passer is ahead, or either car is out; it lapses after its laps."""
    swapped = False
    for o in list(orders):
        if lap < o["lap"]:
            continue
        y, p = cars.get(o["yielder"]), cars.get(o["passer"])
        if lap > o["until"] or y is None or p is None or y.retired or p.retired:
            orders.remove(o)
            continue
        if p.total_time < y.total_time:
            orders.remove(o)
            continue
        if p.total_time - y.total_time > TEAM_ORDER_WINDOW:
            continue
        y.total_time = p.total_time + TEAM_ORDER_GAP
        recent[(y.code, p.code)] = total  # no pass back for the rest of the race
        orders.remove(o)
        swapped = True
    if swapped:
        live = sorted((c for c in order if not cars[c].retired), key=lambda c: cars[c].total_time)
        order[:] = live + [c for c in order if cars[c].retired]


def _bunch(
    live: list[str],
    cars: dict[str, Car],
    lap_time: float | None,
    keep: float,
    duel: tuple[str, str] | str | None,
    eras: bool = False,
    known: dict[str, int] | None = None,
) -> None:
    """Close the SC queue: each gap keeps `keep` of its excess over BUNCH_GAP (nose-to-tail on
    the last lap). By the rules every lapped car unlaps and joins the back of the queue, so
    the whole field closes up in race order (duel None). A race with scUnlap "duel" follows
    Abu Dhabi 2021's call instead: only the lead lap closes up, the lapped cars stay where
    they are a lap down, and on the last lap (keep 0) the lapped cars sitting between the
    user's car and the rival are waved through to the back of the lead-lap queue.

    An Eras race (`eras`: it has a rules block) closes a middle lap gap by gap (_close_gaps,
    the fit of sc_queue.py). With scUnlap "none" (no unlapping: before 2007 and 2010-11) the
    lapped cars stay in the queue where they are on the road, a lap down (_bunch_road).
    `known` (redflag.real_laps_down): the scripted cars' real laps down, which win over their
    gaps (redflag.road_order)."""
    if not live:
        return
    if duel == "none" and lap_time:
        _bunch_road(live, cars, lap_time, keep, eras, known)
        return
    if duel is None and eras and keep > 0.0:
        _close_gaps(live, cars)
        return
    if duel is None:
        for i in range(1, len(live)):
            ahead, car = cars[live[i - 1]], cars[live[i]]
            excess = max(0.0, car.total_time - ahead.total_time - BUNCH_GAP)
            car.total_time = ahead.total_time + BUNCH_GAP + keep * excess
        return
    if lap_time:
        _, down, on_track = redflag.road_order(live, cars, lap_time, known)
    else:
        down, on_track = (
            dict.fromkeys(live, 0),
            {c: cars[c].total_time - cars[live[0]].total_time for c in live},
        )
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


def _close_gaps(live: list[str], cars: dict[str, Car]) -> None:
    """An Eras middle SC lap: each gap to the car ahead over SC_QUEUE_SPACING keeps
    SC_QUEUE_KEEP of its excess, measured on the queue as it stood (sc_queue.close_queue)."""
    old = [cars[c].total_time for c in live]
    for i in range(1, len(live)):
        gap = old[i] - old[i - 1]
        if gap > SC_QUEUE_SPACING:
            gap = SC_QUEUE_SPACING + SC_QUEUE_KEEP * (gap - SC_QUEUE_SPACING)
        cars[live[i]].total_time = cars[live[i - 1]].total_time + gap


def _bunch_road(
    live: list[str],
    cars: dict[str, Car],
    lap_time: float,
    keep: float,
    eras: bool,
    known: dict[str, int] | None = None,
) -> None:
    """No unlapping (scUnlap "none"): the whole queue closes up in road order, lapped cars
    where they are on the road, and each keeps its laps down. Middle laps close as the race's
    queue does (gap by gap for an Eras race, else `keep` car by car as in _bunch); the last
    lap (keep 0) is nose-to-tail."""
    lead = cars[live[0]].total_time
    road, down, on_road = redflag.road_order(live, cars, lap_time, known)
    placed = {road[0]: on_road[road[0]]}
    for i in range(1, len(road)):
        ahead, car = road[i - 1], road[i]
        gap = on_road[car] - on_road[ahead]
        if keep == 0.0:
            gap = BUNCH_GAP
        elif eras:
            if gap > SC_QUEUE_SPACING:
                gap = SC_QUEUE_SPACING + SC_QUEUE_KEEP * (gap - SC_QUEUE_SPACING)
        else:
            gap = BUNCH_GAP + keep * max(0.0, on_road[car] - placed[ahead] - BUNCH_GAP)
        placed[car] = placed[ahead] + gap
    for c in live:
        cars[c].total_time = lead + placed[c] + down[c] * lap_time


def write_golden(model: dict, seeds: list[int], golden_dir: Path | None = None) -> None:
    """Write reference outputs for fixed seeds to data/golden/ (or golden_dir) for TS parity
    tests."""
    golden_dir = Path(golden_dir) if golden_dir is not None else GOLDEN_DIR
    golden_dir.mkdir(parents=True, exist_ok=True)
    out = {str(s): simulate(model, s) for s in seeds}
    path = golden_dir / f"{model['race']['id']}.json"
    path.write_text(json.dumps(out, indent=2), encoding="utf-8", newline="\n")
