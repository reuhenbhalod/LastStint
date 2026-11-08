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


def variants(model: dict) -> dict[str, dict]:
    """The real race (a rolling restart), and the same red flag as a standing restart, with
    an added stop in the stoppage for ALO (free, no measured loss)."""
    standing = copy.deepcopy(model)
    for e in standing["events"]:
        if e["type"] == "RED":
            e["restart"] = "standing"
    extra = copy.deepcopy(standing)
    alo = next(d for d in extra["drivers"] if d["code"] == "ALO")
    alo["realStrategy"].append({"lap": 65, "to": "INTERMEDIATE"})
    return {"rolling": model, "standing": standing, "standing-free-stop": extra}


def golden(model: dict) -> dict:
    return {
        name: {str(s): simulate(m, s) for s in GOLDEN_SEEDS} for name, m in variants(model).items()
    }


if __name__ == "__main__":
    GOLDEN.write_text(json.dumps(golden(json.loads(MODEL.read_text())), indent=1) + "\n")
    print(f"wrote {GOLDEN.relative_to(REPO_ROOT)}")
