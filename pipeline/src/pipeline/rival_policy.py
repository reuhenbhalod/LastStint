"""Rival policies (eras build plan 9.1, eras spec §7, decided Nov 7), mirrored from
packages/sim/src/rivals.

Which policy a run's rival follows, and the rule functions the policies are built from:
- standard: today's rival and the default; standard-plus: green-flag cover window 7 (4 + 3);
- smart: Standard+, plus the overcut (overcut_lap) and the wet crossover (wet_switch, lead 0);
- expert: Smart a lap earlier (same_lap_cover, wet_switch lead 1), plus its own grader at its
  decision points (decision_reasons) over its options (box_now_compound, rival_options).

The reference sim replays real strategies only (no player-controlled car, so no rival
reactions), so a policy can't change its output; it validates the name so the two sims accept
the same values. Parity with the TS sim is at the rule-function level, on shared vectors:
tests/fixtures/rival_wet_crossover.json and tests/fixtures/rival_rules.json (written by
`python -m pipeline.rival_policy`; read by pipeline/tests/test_rival_policy.py and
packages/sim/tests/rival-policy.test.ts).
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import replace
from pathlib import Path

from .sim_reference import CLIFF_FALLBACK, Car, _clean_lap, weather_wear

# The same names, in the same order, as packages/sim/src/eras/config.ts RIVAL_POLICIES.
RIVAL_POLICIES = ("standard", "standard-plus", "smart", "expert")
DEFAULT_RIVAL_POLICY = "standard"
IMPLEMENTED_RIVAL_POLICIES = RIVAL_POLICIES

# rivals/policy.ts COVER_WINDOWS: the green-flag cover window per policy (sim.ts COVER_WINDOW).
COVER_WINDOW = 4
COVER_WINDOWS = {"standard": 4, "standard-plus": 7, "smart": 7, "expert": 7}
EXPERT_SAMPLES = 100
GO_LONG_MARGIN = 3  # sim.ts: laps of life a rival keeps in hand when it stretches a stint
LIFE_LOSS = 2.0  # sim.ts: a tyre is worn out once it's this much slower than new (s/lap)
DRY_COMPOUNDS = ("SOFT", "MEDIUM", "HARD")
RIVAL_OPTION_IDS = ("smart", "stay-out", "box-now")
WET_TYRES = ("INTERMEDIATE", "WET")  # the TS sim's WET_TYRES order (ties go to the first)

RULE_VECTORS = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "rival_rules.json"


class RivalPolicyError(ValueError):
    """A policy name was asked for that doesn't exist."""


def resolve_rival_policy(value: object = None) -> str:
    """The policy a run uses: `standard` when none is given. Raises RivalPolicyError on an
    unknown name."""
    if value is None:
        return DEFAULT_RIVAL_POLICY
    if not isinstance(value, str) or value not in RIVAL_POLICIES:
        raise RivalPolicyError(
            f"unknown rival policy {value!r} (expected one of {', '.join(RIVAL_POLICIES)})"
        )
    return value


def cover_window(policy: str) -> int:
    """The policy's green-flag cover window (rivals/policy.ts coverWindow)."""
    return COVER_WINDOWS[resolve_rival_policy(policy)]


def has_smart_rules(policy: str) -> bool:
    """Policies with Smart's rules (the overcut and the wet crossover)."""
    return policy in ("smart", "expert")


def playout_policy(policy: str) -> str:
    """The rival inside a grader playout: Expert's use Smart (no grading inside grading)."""
    return "smart" if policy == "expert" else policy


def wet_crossover(model: dict, car: Car, lap: int) -> str | None:
    """Smart's wet-tyre rule (eras spec §7, "switches to wet tyres at the sim's crossover lap"):
    the wet tyre a car on slicks should switch to on `lap`, or None to stay on slicks. The
    crossover is the first lap on which a fresh set of a wet tyre has a faster model lap than
    the car's slicks as they are, at that lap's wetness on the race's timeline. Model laps
    only, no pit loss. Ties keep the slicks; between two faster wet tyres the faster wins
    (inters on an exact tie). None in a dry race, on wet tyres already, or with no wet tyre in
    the model. Mirrors wetCrossover in packages/sim/src/rivals/wet.ts."""
    weather = model.get("weather")
    if not weather or car.compound in WET_TYRES:
        return None
    compounds = model["compounds"]
    fuel = model["fuelEffectPerLap"]
    fresh = model.get("freshTyre")
    best = None
    best_time = _clean_lap(car, compounds, fuel, lap, fresh, weather)
    for wet in WET_TYRES:
        if wet not in compounds:
            continue
        on_wets = replace(car, compound=wet, tyre_age=0, tyre_wear=0.0)
        t = _clean_lap(on_wets, compounds, fuel, lap, fresh, weather)
        if t < best_time:
            best, best_time = wet, t
    return best


def lap_time_gap(model: dict, car: Car, lap: int, compound: str) -> float:
    """A fresh set of `compound`'s model lap minus the car's current tyres' on `lap` (s; <0:
    the fresh set is faster). The parity vectors compare it to catch near-ties."""
    compounds = model["compounds"]
    fuel = model["fuelEffectPerLap"]
    fresh = model.get("freshTyre")
    weather = model.get("weather")
    on_set = replace(car, compound=compound, tyre_age=0, tyre_wear=0.0)
    return _clean_lap(on_set, compounds, fuel, lap, fresh, weather) - _clean_lap(
        car, compounds, fuel, lap, fresh, weather
    )


# --- the rule functions (rivals/rules.ts) ---------------------------------------------------


def tyre_life(c: dict) -> int:
    """sim.ts tyreLife: the tyre age at which a compound is LIFE_LOSS s a lap slower than new."""
    deg = c["degPerLap"]
    cliff = c["cliffLap"]
    extra = c.get("cliffDegPerLap", CLIFF_FALLBACK * deg)
    if deg * cliff >= LIFE_LOSS:
        loss = LIFE_LOSS / deg
    else:
        loss = (LIFE_LOSS + extra * cliff) / (deg + extra)
    life = loss if "cliffDegPerLap" in c else min(loss, cliff)
    return min(99, max(math.floor(life), c.get("provenLaps", 0)))


def life_of(model: dict, compound: str) -> float:
    """sim.ts lifeOf: a compound's usable life in this race (inf without a model for it)."""
    c = model["compounds"].get(compound)
    return tyre_life(c) if c else math.inf


def planned_after(stops: list[dict], lap: int) -> list[dict]:
    """A car's planned stops after `lap`, in lap order."""
    return sorted((s for s in stops if s["lap"] > lap), key=lambda s: s["lap"])


def _pit_loss(model: dict, flag: str | None) -> float:
    track = model["track"]
    if flag == "sc":
        return track["pitLossUnderSC"]
    if flag == "vsc":
        return track["pitLossUnderVSC"]
    return track["pitLoss"]


def plan_time(
    model: dict, car: Car, from_lap: int, stops: list[dict], known: dict | None = None
) -> float:
    """rules.ts planTime: the lap-time model's time for laps (from_lap, laps] on the plan
    `stops`. `known`: neutralized laps (lap -> flag), which add no lap time and price a stop.
    Wear advances as for a car on default modes."""
    known = known or {}
    by_lap: dict[int, dict] = {}
    for s in stops:
        if s["lap"] > from_lap and s["lap"] not in by_lap:
            by_lap[s["lap"]] = s
    weather = model.get("weather")
    compounds, fuel, fresh = model["compounds"], model["fuelEffectPerLap"], model.get("freshTyre")
    cur = replace(car)
    total = 0.0
    for lap in range(from_lap + 1, model["race"]["laps"] + 1):
        flag = known.get(lap)
        stop = by_lap.get(lap)
        if stop:
            cur = replace(cur, compound=stop["to"], tyre_wear=0.0, tyre_age=0)
            total += _pit_loss(model, flag)
        if not flag:
            total += _clean_lap(cur, compounds, fuel, lap, fresh, weather)
        cur.tyre_wear += weather_wear(weather, cur.compound, lap)
        cur.tyre_age += 1
    return total


def latest_stop(model: dict, car: Car, lap: int) -> int:
    """rules.ts latestStop: the last out-lap a stretched stint may stop on (tyre life minus
    GO_LONG_MARGIN; the next lap is always allowed)."""
    life = life_of(model, car.compound)
    if not math.isfinite(life):
        return model["race"]["laps"]
    return lap + 1 + max(0, math.floor(life - GO_LONG_MARGIN - car.tyre_wear))


def overcut_lap(
    model: dict, car: Car, strategy: list[dict], lap: int, known: dict | None = None
) -> int | None:
    """rules.ts overcutLap: Smart's overcut, the out-lap its next planned stop moves to (the
    lowest predicted remaining time, earliest on a tie), or None when it stays put."""
    plan = planned_after(strategy, lap)
    if not plan:
        return None
    nxt = plan[0]
    following = plan[1]["lap"] if len(plan) > 1 else math.inf
    hi = min(latest_stop(model, car, lap), following - 1, model["race"]["laps"] - 1)
    best, best_time = None, math.inf
    at = lap + 1
    while at <= hi:
        t = plan_time(model, car, lap, [{**nxt, "lap": at}, *plan[1:]], known)
        if t < best_time:
            best, best_time = at, t
        at += 1
    return None if best is None or best == nxt["lap"] else best


def wet_switch(model: dict, car: Car, lap: int, lead: int) -> str | None:
    """rules.ts wetSwitch: decided after `lap`, the wet tyre a car on slicks boxes for on
    lap + 1: on the crossover lap (lead 0, Smart), or one lap before it too (lead 1, Expert)."""
    if not model.get("weather") or car.compound in WET_TYRES:
        return None
    for k in range(1, 2 + lead):
        at = lap + k
        if at > model["race"]["laps"]:
            break
        wet = wet_crossover(model, car, at)
        if wet:
            return wet
    return None


def is_real_user_stop(model: dict, out_lap: int, compound: str) -> bool:
    """The user's stop on `out_lap` is the real team's call."""
    user = next((d for d in model["drivers"] if d["code"] == model["userSide"]), None)
    return bool(user) and any(
        s["lap"] == out_lap and s["to"] == compound for s in user["realStrategy"]
    )


def same_lap_cover(
    model: dict,
    strategy: list[dict],
    lap: int,
    gap: float,
    user_to: str,
    next_flag: str | None,
    window: int = COVER_WINDOW,
) -> str | None:
    """rules.ts sameLapCover: Expert's green-flag cover on the lap the player stops."""
    out_lap = lap + 1
    if next_flag and next_flag != "green":
        return None
    if out_lap > model["race"]["laps"] or is_real_user_stop(model, out_lap, user_to):
        return None
    if any(s["lap"] == out_lap for s in strategy):
        return None
    plan = planned_after(strategy, lap)
    if not plan or abs(gap) >= model["track"]["pitLoss"]:
        return None
    return plan[0]["to"] if plan[0]["lap"] - out_lap <= window else None


def rule_satisfied(compound: str, compounds_used: list[str]) -> bool:
    """sim.ts ruleSatisfied: two dry compounds used, or any wet tyre (weather spec W6)."""
    if compound in WET_TYRES or any(c in WET_TYRES for c in compounds_used):
        return True
    return len({c for c in compounds_used if c in DRY_COMPOUNDS}) >= 2


def box_now_compound(
    model: dict,
    car: Car,
    strategy: list[dict],
    compounds_used: list[str],
    lap: int,
    wet: str | None,
    known: dict | None = None,
) -> str | None:
    """rules.ts boxNowCompound: the tyre of Expert's "box now" option."""
    if wet:
        return wet
    plan = planned_after(strategy, lap)
    if plan:
        return plan[0]["to"]
    must_change = not rule_satisfied(car.compound, compounds_used)
    best, best_time = None, math.inf
    for to in model["compounds"]:
        if must_change and (to in compounds_used or to in WET_TYRES):
            continue
        t = plan_time(model, car, lap, [{"lap": lap + 1, "to": to}], known)
        if t < best_time:
            best, best_time = to, t
    return best


def decision_reasons(
    lap: int,
    laps: int,
    user_stops_next: bool,
    flag_now: str | None,
    flag_next: str | None,
    rival_stops_next: bool,
    wet_switch: bool,
) -> list[str]:
    """rules.ts decisionReasons: why the end of `lap` is one of Expert's decision points."""
    if lap > laps - 2:
        return []
    neutral = ("sc", "vsc")
    out = []
    if user_stops_next:
        out.append("player-stop")
    if flag_next in neutral and flag_now not in neutral:
        out.append("neutral-next")
    if rival_stops_next:
        out.append("own-stop")
    if wet_switch:
        out.append("wet-crossover")
    return out


def _js_number(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else repr(float(x))


def _stop_key(stops: list[dict]) -> str:
    parts = []
    for s in sorted(stops, key=lambda s: s["lap"]):
        loss = "" if s.get("loss") is None else _js_number(s["loss"])
        added = 1 if s.get("added") else 0
        optional = 1 if s.get("optional") else 0
        parts.append(f"{s['lap']}:{s['to']}:{added}:{optional}:{loss}")
    return "|".join(parts)


def rival_options(
    lap: int, laps: int, before: list[dict], after: list[dict], box_to: str | None
) -> list[dict]:
    """rules.ts rivalOptions: Expert's options (smart, stay-out, box-now) as plans after `lap`,
    leaving out any whose plan is the same as an earlier one's."""
    smart = [dict(s) for s in planned_after(after, lap)]
    prior = [dict(s) for s in planned_after(before, lap)]
    stay = [s for s in prior if s["lap"] != lap + 1]
    deferred = next((s for s in prior if s["lap"] == lap + 1), None)
    if deferred and lap + 2 < laps and not any(s["lap"] == lap + 2 for s in stay):
        stay.append({"lap": lap + 2, "to": deferred["to"], "added": True})
    options = [
        {"id": "smart", "stops": smart},
        {"id": "stay-out", "stops": sorted(stay, key=lambda s: s["lap"])},
    ]
    if box_to and lap + 1 < laps:
        due = (
            smart[0] if smart and smart[0]["lap"] == lap + 1 and smart[0]["to"] == box_to else None
        )
        box = smart if due else [{"lap": lap + 1, "to": box_to, "added": True}, *smart[1:]]
        options.append({"id": "box-now", "stops": box})
    seen: set[str] = set()
    out = []
    for o in options:
        key = _stop_key(o["stops"])
        if key not in seen:
            seen.add(key)
            out.append(o)
    return out


# --- the shared vectors ---------------------------------------------------------------------

VECTOR_RACES = ("abu-dhabi-2021", "spain-2021", "russia-2021", "great-britain-2024")


def _vector_car(model: dict, code: str, compound: str, tyre_age: int) -> Car:
    d = next(x for x in model["drivers"] if x["code"] == code)
    return Car(
        code=code,
        base_pace=d["basePace"],
        noise=d["noise"],
        compound=compound,
        tyre_age=tyre_age,
        total_time=0.0,
        wet_pace=d.get("wetPace", 0.0),
        damp_pace=d.get("dampPace"),
    )


def _known(model: dict, upto: int) -> dict:
    """The race's neutralizations that have started by lap `upto` (lap -> flag)."""
    out: dict[int, str] = {}
    for e in model.get("events", []):
        if e["type"] in ("SC", "VSC", "RED") and e["lap"] <= upto:
            flag = e["type"].lower()
            for lap in range(e["lap"], e["lap"] + e.get("laps", 1)):
                out[lap] = flag
    return out


def rule_vectors(races_dir: Path) -> dict:
    """The vectors both sims check every rule function against (rival_rules.json)."""
    races: dict[str, dict] = {}
    for race in VECTOR_RACES:
        model = json.loads((races_dir / f"{race}.json").read_text())
        laps, first = model["race"]["laps"], model["race"]["takeoverLap"]
        rival = next(d for d in model["drivers"] if d["code"] == model["rival"])
        dry = [c for c in model["compounds"] if c not in WET_TYRES]
        cases = []
        for lap in range(first, laps - 1, 3):
            real = planned_after([dict(s) for s in rival["realStrategy"]], lap)
            strategy = real or [{"lap": min(laps - 1, lap + 8), "to": dry[-1]}]
            for compound in dry:
                for age in (3, 14, 26):
                    car = _vector_car(model, rival["code"], compound, age)
                    known = _known(model, lap + 1)
                    used = [compound]
                    case = {
                        "lap": lap,
                        "compound": compound,
                        "tyreAge": age,
                        "strategy": strategy,
                        "known": {str(k): v for k, v in sorted(known.items())},
                        "planTime": plan_time(model, car, lap, strategy, known),
                        "latestStop": latest_stop(model, car, lap),
                        "overcutLap": overcut_lap(model, car, strategy, lap, known),
                        "wetSwitch": [wet_switch(model, car, lap, k) for k in (0, 1)],
                        "boxNow": box_now_compound(model, car, [], used, lap, None, known),
                        "boxNowPlanned": box_now_compound(model, car, strategy, used, lap, None),
                    }
                    cases.append(case)
            for gap in (-30.0, -5.0, 3.0, 25.0):
                for nxt in (2, 7, 9):
                    plan = [{"lap": lap + nxt, "to": dry[0]}]
                    user_to = dry[-1]
                    cases.append(
                        {
                            "lap": lap,
                            "cover": {
                                "strategy": plan,
                                "gap": gap,
                                "userTo": user_to,
                                "window": [
                                    same_lap_cover(model, plan, lap, gap, user_to, None, w)
                                    for w in (4, 7)
                                ],
                                "underSc": same_lap_cover(model, plan, lap, gap, user_to, "sc", 7),
                            },
                        }
                    )
        # Every lap, so Expert's lead (a lap before the crossover) is caught.
        wet = [
            {
                "lap": lap,
                "compound": compound,
                "tyreAge": 14,
                "switch": [
                    wet_switch(model, _vector_car(model, rival["code"], compound, 14), lap, k)
                    for k in (0, 1)
                ],
            }
            for lap in range(first, laps)
            for compound in dry
        ]
        races[race] = {
            "life": {c: tyre_life(m) for c, m in model["compounds"].items()},
            "cases": cases,
            "wet": wet,
        }
    return {
        "coverWindows": COVER_WINDOWS,
        "races": races,
        "reasons": _reason_vectors(),
        "options": _option_vectors(),
    }


def _reason_vectors() -> list[dict]:
    out = []
    flags = (None, "sc", "vsc")
    for lap in (10, 56, 57):
        for user in (False, True):
            for now in flags:
                for nxt in flags:
                    for own in (False, True):
                        for wet in (False, True):
                            args = [lap, 58, user, now, nxt, own, wet]
                            out.append({"args": args, "reasons": decision_reasons(*args)})
    return out


def _option_vectors() -> list[dict]:
    a = {"lap": 21, "to": "HARD"}
    b = {"lap": 35, "to": "MEDIUM"}
    real = {"lap": 21, "to": "HARD", "loss": 21.5}
    cover = {"lap": 21, "to": "HARD", "added": True}
    plans = (
        [],
        [a],
        [a, b],
        [real],
        [b],
        [cover, b],
        [{"lap": 22, "to": "SOFT"}, a],
        [{"lap": 57, "to": "SOFT"}],
    )
    out = []
    for lap in (20, 56):
        for before in plans:
            for after in plans:
                for box_to in (None, "HARD", "INTERMEDIATE"):
                    args = [lap, 58, before, after, box_to]
                    out.append({"args": args, "options": rival_options(*args)})
    return out


def write_rule_vectors(races_dir: Path, out: Path = RULE_VECTORS) -> None:
    out.write_text(json.dumps(rule_vectors(races_dir), indent=1) + "\n")


if __name__ == "__main__":  # python -m pipeline.rival_policy: rewrite rival_rules.json
    from .paths import RACES_DIR

    write_rule_vectors(RACES_DIR)
    print(f"wrote {RULE_VECTORS}", file=sys.stderr)
