"""Python reference simulator (Phase 1.7).

A lap-loop simulator that runs from the takeover lap to the flag. It reads the race-model
dict (the same input the TypeScript sim will consume) so it both validates the model and
produces golden outputs for the port. A run is fully defined by (model, seed, strategies).

Tuning constants live at the top; Gate G1 is reached by adjusting them until the sim
reproduces real races.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field

from .paths import GOLDEN_DIR

DIRTY_AIR_RANGE = 1.0  # within this gap (s) a car is in dirty air
CATCH_WINDOW = 1.0  # a close follower within this gap (s) can attempt a pass (DRS range)
BUNCH_GAP = 0.9  # safety-car train spacing per car
PACE_PASS_GAIN = 1.1  # how strongly a per-lap pace edge overrides overtake difficulty
SC_FALLBACK = 1.6  # SC lap = this x green if not supplied
VSC_FALLBACK = 1.35  # VSC lap = this x green if not supplied
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


def _clean_lap(car: Car, compounds: dict, fuel_per_lap: float, lap: int) -> float:
    c = compounds[car.compound]
    t = car.base_pace + c["offset"] + c["degPerLap"] * car.tyre_age - fuel_per_lap * lap
    if car.tyre_age > c["cliffLap"]:  # past the cliff: wear accelerates
        extra = c.get("cliffDegPerLap", CLIFF_FALLBACK * c["degPerLap"])
        t += extra * (car.tyre_age - c["cliffLap"])
    return t


def _car_ahead(order: list[str], code: str, cars: dict[str, Car]) -> str:
    live = [c for c in order if not cars[c].retired]
    i = live.index(code)
    return live[i - 1] if i > 0 else code


def _resolve_order(order, cars, clean, rng, overtake_diff):
    """Set green-flag race order. Natural time sort handles pit-driven moves; then a close,
    faster follower (within a lap's reach) gets a pass chance gated by overtake difficulty,
    modelling an on-track overtake rather than a pure cumulative-time crossover.
    """
    codes = [c for c in order if not cars[c].retired]
    codes.sort(key=lambda c: cars[c].total_time)
    improved = True
    guard = 0
    while improved and guard < len(codes) * 3:
        improved = False
        guard += 1
        for i in range(1, len(codes)):
            a, b = cars[codes[i - 1]], cars[codes[i]]  # a ahead, b behind (by time)
            if b.total_time - a.total_time > CATCH_WINDOW:
                continue
            advantage = clean.get(a.code, 0) - clean.get(b.code, 0)  # >0: b is faster
            if advantage <= 0:
                continue
            pprob = min(0.98, (1 - overtake_diff) + PACE_PASS_GAIN * advantage)
            if rng.random() < pprob:
                b.total_time = a.total_time - 0.05  # b completes the pass
                codes[i - 1], codes[i] = codes[i], codes[i - 1]
                improved = True
    order[:] = codes + [c for c in order if cars[c].retired]


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


def simulate(model: dict, seed: int, strategies: dict | None = None) -> dict:
    """Run one seeded simulation to the flag. Returns finishing order and gaps to winner."""
    rng = random.Random(seed)
    track = model["track"]
    compounds = model["compounds"]
    fuel = model["fuelEffectPerLap"]
    total_laps = int(model["race"]["laps"])
    takeover = int(model["race"]["takeoverLap"])
    overtake_diff = track["overtakeDifficulty"]
    dirty_air = track["dirtyAirPenalty"]
    pit_loss = track["pitLoss"]
    pit_loss_sc = track["pitLossUnderSC"]
    green = track.get("greenLapTime")
    sc_time = track.get("scLapTime") or (green * SC_FALLBACK if green else None)
    vsc_time = track.get("vscLapTime") or (green * VSC_FALLBACK if green else None)

    neutral: dict[int, str] = {}
    retire_at: dict[int, set[str]] = {}
    for e in model["events"]:
        if e["type"] in ("SC", "VSC", "RED"):
            for lap in range(e["lap"], e["lap"] + int(e.get("laps", 1))):
                neutral[lap] = e["type"]
        elif e["type"] == "RETIREMENT":
            retire_at.setdefault(e["lap"], set()).add(e["driver"])

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
        )

    order = [d["code"] for d in ordered]

    def active_codes() -> list[str]:
        return [c for c in order if not cars[c].retired]

    for lap in range(takeover + 1, total_laps + 1):
        flag = neutral.get(lap)
        prev_time = {c: cars[c].total_time for c in active_codes()}
        clean: dict[str, float] = {}

        for code in active_codes():
            car = cars[code]
            pit = next((st for st in car.strategy if st["lap"] == lap), None)
            pit_cost = 0.0
            if pit:
                car.strategy.remove(pit)
                car.compound = pit["to"]
                car.tyre_age = 0
                pit_cost = pit_loss_sc if flag in ("SC", "VSC") else pit_loss

            if flag == "SC" and sc_time:
                lt = sc_time
            elif flag == "VSC" and vsc_time:
                lt = vsc_time
            elif flag == "RED" and green:
                lt = green
            else:
                lt = _clean_lap(car, compounds, fuel, lap) + rng.gauss(0, car.noise)
                ahead = _car_ahead(order, code, cars)
                ahead_gap = car.total_time - prev_time.get(ahead, car.total_time)
                if 0 < ahead_gap < DIRTY_AIR_RANGE:
                    lt += dirty_air
            clean[code] = _clean_lap(car, compounds, fuel, lap)
            car.total_time += lt + pit_cost
            car.tyre_age += 1
            car.laps_done = lap

        for code in retire_at.get(lap, ()):
            if code in cars and not cars[code].retired:
                cars[code].retired = True
                cars[code].retired_lap = lap

        if flag == "SC":
            # No overtaking under a safety car: positions are frozen. Bunch the field
            # nose-to-tail in the EXISTING race order. A car that pitted this lap keeps its
            # place (rejoining the slow train), which is why SC stops are nearly free -
            # re-sorting by total time here would wrongly bury it by its pit loss.
            live = active_codes()
            for i in range(1, len(live)):
                cars[live[i]].total_time = cars[live[i - 1]].total_time + BUNCH_GAP
        elif not flag:
            _resolve_order(order, cars, clean, rng, overtake_diff)

    return _classify(order, cars)


def write_golden(model: dict, seeds: list[int]) -> None:
    """Write reference outputs for fixed seeds to data/golden/ for TS parity tests."""
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    out = {str(s): simulate(model, s) for s in seeds}
    path = GOLDEN_DIR / f"{model['race']['id']}.json"
    path.write_text(json.dumps(out, indent=2))
