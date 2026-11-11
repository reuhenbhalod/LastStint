"""Regenerate packages/sim/tests/fixtures/wear-shape-golden.json: the Python reference sim's
results on Spain 2021 (data/races, a pinned Daily file) with quadratic wear (compounds[].degQuad,
Eras model fix S4) entered by hand, on the real strategies and on strategies that leave the
real ones, and each compound's tyre life (rival_policy.tyre_life), for the TS parity test
(packages/sim/tests/wear-shape.test.ts) and tests/test_wear_shape.py.

    uv run python tests/make_wear_shape_fixture.py
"""

from __future__ import annotations

import copy
import json

from pipeline.paths import RACES_DIR, REPO_ROOT
from pipeline.rival_policy import tyre_life
from pipeline.sim_reference import GOLDEN_SEEDS, simulate

MODEL = RACES_DIR / "spain-2021.json"
GOLDEN = REPO_ROOT / "packages" / "sim" / "tests" / "fixtures" / "wear-shape-golden.json"

# s per lap^2: the SOFT (no fitted cliff) and the MEDIUM (a fitted cliff at 23) both bend.
DEG_QUAD = {"SOFT": 0.0011, "MEDIUM": 0.0004}

# Strategies that leave the real ones: HAM runs his mediums to lap 50 (well past their life),
# VER stops a lap early on lap 24.
DIVERGED = {
    "HAM": [{"lap": 29, "to": "MEDIUM", "loss": 22.778}, {"lap": 50, "to": "SOFT"}],
    "VER": [{"lap": 24, "to": "MEDIUM", "loss": 23.983}, {"lap": 61, "to": "SOFT"}],
}


def with_quad(model: dict) -> dict:
    out = copy.deepcopy(model)
    for c, q in DEG_QUAD.items():
        out["compounds"][c]["degQuad"] = q
    return out


def golden(model: dict) -> dict:
    m = with_quad(model)
    return {
        "life": {c: tyre_life(m["compounds"][c]) for c in sorted(m["compounds"])},
        # Without the proven laps' floor: the quadratic roots themselves.
        "lifeUnproven": {
            c: tyre_life({k: v for k, v in m["compounds"][c].items() if k != "provenLaps"})
            for c in sorted(m["compounds"])
        },
        "real": {str(s): simulate(m, s) for s in GOLDEN_SEEDS},
        "diverged": {str(s): simulate(m, s, copy.deepcopy(DIVERGED)) for s in GOLDEN_SEEDS},
    }


if __name__ == "__main__":
    GOLDEN.write_text(json.dumps(golden(json.loads(MODEL.read_text())), indent=1) + "\n")
    print(f"wrote {GOLDEN.relative_to(REPO_ROOT)}")
