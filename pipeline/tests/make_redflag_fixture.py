"""Regenerate packages/sim/tests/fixtures/redflag-golden.json: the Python reference sim's
results on the red-flag fixture race (Zandvoort 2023 from lap 61, built from OpenF1 by
`pipeline build` with eras build plan 4.3) and its variants, for the TS parity test
(packages/sim/tests/redflag.test.ts) and tests/test_redflag.py.

    uv run python tests/make_redflag_fixture.py
"""

from __future__ import annotations

import copy
import json

from pipeline.paths import REPO_ROOT
from pipeline.sim_reference import GOLDEN_SEEDS, simulate

FIXTURES = REPO_ROOT / "packages" / "sim" / "tests" / "fixtures"
MODEL = FIXTURES / "redflag-netherlands-2023.json"
GOLDEN = FIXTURES / "redflag-golden.json"


# Car faults (faults.py) around the red flag: VER loses pace from lap 62 to the flag (green
# laps only: none on the red laps), PER punctures on lap 63, fixed by his stop on the red lap.
FAULTS = [
    {"lap": 62, "type": "FAULT", "driver": "VER", "fault": "power-loss", "paceLoss": 1.5},
    {
        "lap": 63,
        "type": "FAULT",
        "driver": "PER",
        "fault": "puncture",
        "paceLoss": 3.0,
        "untilStop": True,
        "slowLap": 5.0,
    },
]


# An Eras race's rules block (netherlands-2023's): the sims' Eras-only rules apply with it.
ERAS_RULES = {
    "twoCompound": True,
    "tyreChanges": True,
    "pitLaneClosedUnderSC": False,
    "vsc": True,
    "drs": True,
    "ers": "hybrid",
    "refuelling": False,
}
# A made-up SC on laps 68-70 that picked up ALO (P3): VER and PER run on ahead of it.
PICKUP_SC = {"lap": 68, "type": "SC", "laps": 3, "pickup": "ALO"}


def variants(model: dict) -> dict[str, dict]:
    """The real race (a rolling restart), and the same red flag as a standing restart, with
    an added stop in the stoppage for ALO (free, no measured loss), and with car faults. As an
    Eras race (a rules block): the standing restart (spaced at the end of its first racing
    lap), and an SC with a pickup (sim_reference.sc_front / queue_behind)."""
    standing = copy.deepcopy(model)
    for e in standing["events"]:
        if e["type"] == "RED":
            e["restart"] = "standing"
    extra = copy.deepcopy(standing)
    alo = next(d for d in extra["drivers"] if d["code"] == "ALO")
    alo["realStrategy"].append({"lap": 65, "to": "INTERMEDIATE"})
    faulted = copy.deepcopy(model)
    faulted["events"] = sorted(
        [*faulted["events"], *copy.deepcopy(FAULTS)], key=lambda e: (e["lap"], e["type"])
    )
    standing_eras = {**copy.deepcopy(standing), "rules": dict(ERAS_RULES)}
    pickup = {**copy.deepcopy(model), "rules": dict(ERAS_RULES)}
    pickup["events"] = sorted(
        [*pickup["events"], dict(PICKUP_SC)], key=lambda e: (e["lap"], e["type"])
    )
    return {
        "rolling": model,
        "standing": standing,
        "standing-free-stop": extra,
        "faults": faulted,
        "standing-eras": standing_eras,
        "sc-pickup": pickup,
    }


LEGEND_SEEDS = list(range(1, 11))


def golden(model: dict) -> dict:
    out = {
        name: {str(s): simulate(m, s) for s in GOLDEN_SEEDS} for name, m in variants(model).items()
    }
    # Legend (legend.py): the red flag and its restart SC lap stay real.
    out["legend"] = {str(s): simulate(model, s, legend=True) for s in LEGEND_SEEDS}
    return out


if __name__ == "__main__":
    GOLDEN.write_text(json.dumps(golden(json.loads(MODEL.read_text())), indent=1) + "\n")
    print(f"wrote {GOLDEN.relative_to(REPO_ROOT)}")
