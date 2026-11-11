"""Legend difficulty's safety cars (eras build plan 9.2, eras spec 8 "Legend difficulty").

In Legend the race's real SC/VSC periods after the takeover are replaced by ones drawn from the
attempt's seed at the track's historical rate (data/sc_rates.json, sc_rates.py), so memorizing
the race doesn't help. Kept exactly as real: periods flagged `storylineEvent`, periods that
started on or before the takeover lap (already on screen), red flags (with the SC laps of
their resumption) and retirements.

The draw (bit-identical to packages/sim/src/legend.ts):
- One stream, derive_seed(seed, LEGEND_STREAM); one draw per lap from takeover + 1 to the flag,
  whatever happens, so the stream never depends on the outcome.
- Per lap: u < scPerRace / laps is a SC, else u < (scPerRace + vscPerRace) / laps a VSC (the
  VSC share is 0 when the race's rules.vsc is false; absent = allowed).
- A drawn period starts only if the lap before is green (no merging into a kept period), runs
  the all-track mean length, stops at the flag, and ends a lap before the next kept period (a
  green lap in between); a period that can't get one lap is dropped.
- A race before the safety car (race_rules.safety_car: before 1993) draws none.

Scripted stops pay the lap's Legend conditions (legend_loss): a real stop's measured loss was
taken under the real flag, so on a lap whose flag Legend changed it pays the track's figure for
the flag it now runs under (green, SC or VSC).
"""

from __future__ import annotations

import json
import re
from functools import cache

from . import race_rules
from .paths import DATA_DIR
from .rng import Mulberry32, derive_seed

SC_RATES_PATH = DATA_DIR / "sc_rates.json"
LEGEND_STREAM = 15000
NEUTRAL = ("SC", "VSC", "RED")
_RACE_ID = re.compile(r"^(.+?)-(\d{4})(?:-.*)?$")


def parse_race_id(race_id: str) -> tuple[str, int]:
    """'abu-dhabi-2021' -> ('abu-dhabi', 2021); a variant suffix is ignored ('spain-1994-pits')."""
    m = _RACE_ID.match(race_id)
    if not m:
        raise ValueError(f"race id '{race_id}' is not <event-slug>-<year>")
    return m.group(1), int(m.group(2))


@cache
def load_rates() -> dict:
    return json.loads(SC_RATES_PATH.read_text())


def circuit_for(race_id: str, rates: dict | None = None) -> str | None:
    """The circuit a race ran at, from the rates file's events table (None: unknown)."""
    rates = rates or load_rates()
    slug, year = parse_race_id(race_id)
    found = None
    for from_year, circuit in rates["events"].get(slug, []):
        if from_year <= year:
            found = circuit
    return found


def legend_rates(model: dict, rates: dict | None = None) -> dict:
    """The rates a race's Legend draws use: its circuit's, or the all-track rate (flagged)."""
    rates = rates or load_rates()
    circuit = circuit_for(model["race"]["id"], rates)
    row = rates["circuits"].get(circuit) if circuit else None
    all_tracks = rates["allTracks"]
    return {
        "circuit": circuit,
        "scPerRace": row["scPerRace"] if row else all_tracks["scPerRace"],
        "vscPerRace": row["vscPerRace"] if row else all_tracks["vscPerRace"],
        "scFallback": row["scFallback"] if row else True,
        "vscFallback": row["vscFallback"] if row else True,
        "scLaps": rates["lengths"]["scLaps"],
        "vscLaps": rates["lengths"]["vscLaps"],
    }


def is_kept(event: dict, takeover: int, events: list[dict] | None = None) -> bool:
    """A real event Legend leaves alone: anything but an SC/VSC after the takeover that isn't a
    storyline event. The SC laps of a red flag's resumption (an SC straight after a RED in
    `events`) are part of the red flag, which is real: kept too (eras build plan 4.3)."""
    if event["type"] not in ("SC", "VSC"):
        return True
    if event.get("storylineEvent") or event["lap"] <= takeover:
        return True
    return event["type"] == "SC" and any(
        e["type"] == "RED" and e["lap"] + int(e.get("laps", 1)) == event["lap"]
        for e in events or []
    )


def legend_events(model: dict, seed: int, rates: dict | None = None) -> list[dict]:
    """The race's events as a Legend attempt with `seed` runs them (sorted by lap)."""
    laps = int(model["race"]["laps"])
    takeover = int(model["race"]["takeoverLap"])
    r = legend_rates(model, rates)
    sc_ok = race_rules.safety_car(model)  # no SC (so no VSC) before 1993
    vsc_ok = sc_ok and (model.get("rules") or {}).get("vsc") is not False
    kept = [e for e in model["events"] if is_kept(e, takeover, model["events"])]
    busy: set[int] = set()
    for e in kept:
        if e["type"] in NEUTRAL:
            busy.update(range(e["lap"], e["lap"] + int(e.get("laps", 1))))
    p_sc = r["scPerRace"] / laps if sc_ok else 0.0
    p_any = p_sc + (r["vscPerRace"] / laps if vsc_ok else 0.0)
    rng = Mulberry32(derive_seed(seed, LEGEND_STREAM))
    drawn: list[dict] = []
    for lap in range(takeover + 1, laps + 1):
        u = rng.next()  # one draw per lap
        kind = "SC" if u < p_sc else "VSC" if u < p_any else None
        if kind is None or lap in busy or lap - 1 in busy:
            continue
        want = r["scLaps"] if kind == "SC" else r["vscLaps"]
        n = 0
        while n < want and lap + n <= laps and lap + n not in busy and lap + n + 1 not in busy:
            n += 1
        if n == 0:
            continue
        drawn.append({"lap": lap, "type": kind, "laps": n})
        busy.update(range(lap, lap + n))
    return sorted(kept + drawn, key=lambda e: e["lap"])


def real_flags(model: dict) -> dict[int, str]:
    """The real race's flag per lap ("SC", "VSC", "RED"; absent: green)."""
    flags: dict[int, str] = {}
    for e in model["events"]:
        if e["type"] in NEUTRAL:
            for lap in range(e["lap"], e["lap"] + int(e.get("laps", 1))):
                flags[lap] = e["type"]
    return flags


def legend_loss(stop: dict, lap: int, flag: str | None, real: dict[int, str]) -> float | None:
    """A stop's loss in a Legend run: its measured loss while lap `lap` runs under the flag it
    was measured under (`real`), else None (the track's figure for `flag`)."""
    loss = stop.get("loss")
    return loss if loss is not None and real.get(lap) == flag else None


# Parity vectors (pipeline/tests/fixtures/legend_parity.json, read by packages/sim's
# tests/legend.test.ts): (case name, race file, variant). Variants patch the model the same way
# on both sides: "storyline" flags every real SC/VSC as a storyline event, "no-vsc" sets
# rules.vsc false, "1990" moves the race to 1990 (before the safety car: no draws).
PARITY_CASES = [
    ("abu-dhabi-2021", "abu-dhabi-2021", None),
    ("abu-dhabi-2021+storyline", "abu-dhabi-2021", "storyline"),
    ("abu-dhabi-2021+no-vsc", "abu-dhabi-2021", "no-vsc"),
    ("spain-2021", "spain-2021", None),
    ("russia-2021", "russia-2021", None),
    ("canada-2024", "canada-2024", None),
    ("monaco-2023", "monaco-2023", None),
    ("bahrain-2023", "bahrain-2023", None),
    ("abu-dhabi-2021+1990", "abu-dhabi-2021", "1990"),
]
PARITY_SEEDS = list(range(1, 21))


def variant(model: dict, name: str | None) -> dict:
    """A copy of `model` patched as a parity case's variant says."""
    out = json.loads(json.dumps(model))
    if name == "storyline":
        for e in out["events"]:
            if e["type"] in ("SC", "VSC"):
                e["storylineEvent"] = True
    elif name == "no-vsc":
        out["rules"] = {**(out.get("rules") or {}), "vsc": False}
    elif name == "1990":
        slug, _ = parse_race_id(out["race"]["id"])
        out["race"]["id"] = f"{slug}-1990"
    elif name is not None:
        raise ValueError(f"unknown parity variant '{name}'")
    return out


def _result(result: dict) -> dict:
    """The classification and times (gaps follow from the times)."""
    return {k: result[k] for k in ("order", "finishers", "times")}


def parity_vectors() -> dict:
    """Each case's Legend events and Legend result (the reference sim) per seed."""
    from .paths import RACES_DIR
    from .sim_reference import simulate  # here: sim_reference imports this module

    cases = {}
    for name, race_id, kind in PARITY_CASES:
        model = variant(json.loads((RACES_DIR / f"{race_id}.json").read_text()), kind)
        cases[name] = {
            "race": race_id,
            "variant": kind,
            "seeds": {
                str(s): {
                    "events": legend_events(model, s),
                    "result": _result(simulate(model, s, legend=True)),
                }
                for s in PARITY_SEEDS
            },
        }
    return {"_comment": "Generated by `python -m pipeline.legend`; do not edit.", "cases": cases}


def main() -> None:
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "legend_parity.json"
    path.write_text(json.dumps(parity_vectors(), indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
