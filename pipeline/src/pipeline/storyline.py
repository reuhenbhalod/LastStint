"""Avoidable storyline retirements (owner decision, Nov 8 2026; Eras model fixes M4, task 3).

A race's storyline can end with the player's own car retiring: Senna's crash at Monaco 1988,
Mansell's tyre at Adelaide 1986, Rosberg out of fuel at Hockenheim 1986, Schumacher and Hill's
collision at Adelaide 1994. Frozen, they make the race unwinnable whatever the player does. So
the player's car retires on its real lap only if the player repeats the real call. The call is
authored per race in its Eras overlay (`eras.storylineRetirements`, data/eras/<race-id>.json),
from cited sources (docs/eras-checks/m4-scripted-events.md):

    {"driver": "SENA", "condition": {"type": "mode", "key": "pace", "value": "push",
     "fromLap": 55}, "real": "...", "source": "https://..."}

Conditions (packages/sim/src/scripted.ts conditionMet is the twin; parity vectors in
pipeline/tests/fixtures/scripted_parity.json):
- `mode`: the standing mode `key` was `value` on every lap from `fromLap` (or the first lap run,
  if later) to the retirement lap;
- `tyre_age`: the car started the retirement lap on tyres at least `minLaps` laps old;
- `pressure`: `driver` started the retirement lap behind the player's car, within `seconds`;
- `fuel`: the fuel model decides (the frozen retirement is dropped; the car stops if its tank
  runs dry). A fuel-limit race only.

`alsoRetires` lists cars whose real retirement is the same incident (a collision): they retire
with the player's car, or not at all. The retirement lap is the driver's RETIREMENT event.

Only live play is conditional (packages/sim: the player's car). A replay, and so the Python
reference sim, G1 and every golden file, runs the real calls, so every real retirement stays.
"""

from __future__ import annotations

MODE_KEYS = ("pace", "fuel", "battle", "ers")


def retirement_lap(model: dict, code: str) -> int | None:
    """The car's RETIREMENT event lap in the race model, or None."""
    return next(
        (e["lap"] for e in model["events"] if e["type"] == "RETIREMENT" and e["driver"] == code),
        None,
    )


def check(model: dict, items: list[dict] | None) -> list[str]:
    """Check a race's storyline retirements against its model; report lines. Raises on an item
    the sims can't play (no such retirement, a fuel call outside a fuel-limit race...)."""
    rid = model["race"]["id"]
    codes = {d["code"] for d in model["drivers"]}
    lines = []
    for i, item in enumerate(items or []):
        where = f"{rid}: eras.storylineRetirements[{i}]"
        code = item["driver"]
        lap = retirement_lap(model, code)
        if lap is None:
            raise ValueError(f"{where}: {code} has no RETIREMENT event to make conditional")
        cond = item["condition"]
        kind = cond["type"]
        if kind == "fuel" and not (model.get("rules") or {}).get("fuelLimit"):
            raise ValueError(f"{where}: a fuel call needs a fuel-limit race (rules.fuelLimit)")
        if kind == "pressure" and cond["driver"] not in codes:
            raise ValueError(f"{where}: no car {cond['driver']}")
        if kind == "mode" and cond["fromLap"] > lap:
            raise ValueError(
                f"{where}: fromLap {cond['fromLap']} is after the retirement lap {lap}"
            )
        for other in item.get("alsoRetires", []):
            if retirement_lap(model, other) is None:
                raise ValueError(f"{where}: {other} has no RETIREMENT event to link")
        lines.append(
            f"storyline retirement: {code} lap {lap} only on the real call ({kind})"
            + (f", with {', '.join(item['alsoRetires'])}" if item.get("alsoRetires") else "")
        )
    return lines


def condition_met(cond: dict, laps: list[dict], retire_lap: int) -> bool:
    """Whether the player repeated the real call, judged at the start of `retire_lap` from the
    laps run so far: each {lap, modes, tyreAge, gaps} (the player's car at the start of the lap;
    gaps: each running car's start-of-lap time minus the player's)."""
    at = next((lap for lap in laps if lap["lap"] == retire_lap), None)
    kind = cond["type"]
    if kind == "mode":
        start = max(cond["fromLap"], laps[0]["lap"] if laps else cond["fromLap"])
        span = [lap for lap in laps if start <= lap["lap"] <= retire_lap]
        return len(span) == retire_lap - start + 1 and all(
            lap["modes"][cond["key"]] == cond["value"] for lap in span
        )
    if kind == "tyre_age":
        return at is not None and at["tyreAge"] >= cond["minLaps"]
    if kind == "pressure":
        gap = None if at is None else at["gaps"].get(cond["driver"])
        return gap is not None and 0 <= gap <= cond["seconds"]
    if kind == "fuel":
        return False
    raise ValueError(f"unknown storyline condition {kind!r}")
