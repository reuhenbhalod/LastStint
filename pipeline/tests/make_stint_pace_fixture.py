"""Regenerate packages/sim/tests/fixtures/stint-pace-golden.json: the Python reference sim's
results on Spain 2021 (data/races, a pinned Daily file) with pace by stint
(drivers[].stintPace, Eras model fix M2) entered by hand, on the real strategies and on
strategies that leave the real ones, for the TS parity test
(packages/sim/tests/stint-pace.test.ts) and tests/test_stint_pace.py.

    uv run python tests/make_stint_pace_fixture.py
"""

from __future__ import annotations

import copy
import json

from pipeline.paths import RACES_DIR, REPO_ROOT
from pipeline.sim_reference import GOLDEN_SEEDS, simulate

MODEL = RACES_DIR / "spain-2021.json"
GOLDEN = REPO_ROOT / "packages" / "sim" / "tests" / "fixtures" / "stint-pace-golden.json"

# By car: the takeover stint (0) and stints begun on real out-laps (VER 25 and 61, HAM 29 and
# 43, OCO 24). Spain 2021 has no SC, so no queue closes the gaps the offsets make.
STINT_PACE = {
    "VER": [{"lap": 0, "offset": 0.1}, {"lap": 25, "offset": -0.2}, {"lap": 61, "offset": 0.3}],
    "HAM": [{"lap": 0, "offset": -0.1}, {"lap": 29, "offset": 0.15}, {"lap": 43, "offset": -0.4}],
    "OCO": [{"lap": 24, "offset": -0.3}],
    "RUS": [{"lap": 0, "offset": 0.2}],
}

# Strategies that leave the real ones: HAM skips his lap-43 stop (he keeps his lap-29 stint's
# offset to the flag); OCO stops on lap 27, not 24 (that stint runs at 0); VER's second stop
# comes on lap 55, not 61 (0 from then on).
DIVERGED = {
    "HAM": [{"lap": 29, "to": "MEDIUM", "loss": 22.778}],
    "OCO": [{"lap": 27, "to": "MEDIUM"}],
    "VER": [{"lap": 25, "to": "MEDIUM", "loss": 23.983}, {"lap": 55, "to": "SOFT"}],
}


def with_stint_pace(model: dict) -> dict:
    out = copy.deepcopy(model)
    for d in out["drivers"]:
        if d["code"] in STINT_PACE:
            d["stintPace"] = copy.deepcopy(STINT_PACE[d["code"]])
    return out


def golden(model: dict) -> dict:
    m = with_stint_pace(model)
    return {
        "real": {str(s): simulate(m, s) for s in GOLDEN_SEEDS},
        "diverged": {str(s): simulate(m, s, copy.deepcopy(DIVERGED)) for s in GOLDEN_SEEDS},
    }


if __name__ == "__main__":
    GOLDEN.write_text(json.dumps(golden(json.loads(MODEL.read_text())), indent=1) + "\n")
    print(f"wrote {GOLDEN.relative_to(REPO_ROOT)}")
