"""Regenerate packages/sim/tests/fixtures/eras-overtaking.json: two Eras race models built with
the pooled overtake model (overtaking.py; spain-2021 with DRS, brazil-2006 refuelling, both
with trainCoef) and the Python reference sim's results on them, for the TS parity test
(packages/sim/tests/eras-overtaking.test.ts) and tests/test_overtaking.py.

    uv run python tests/make_overtaking_fixture.py
"""

from __future__ import annotations

import json

from pipeline import build
from pipeline.paths import REPO_ROOT
from pipeline.sim_reference import GOLDEN_SEEDS, simulate

FIXTURE = REPO_ROOT / "packages" / "sim" / "tests" / "fixtures" / "eras-overtaking.json"
RACES = ["spain-2021", "brazil-2006"]


def golden(models: dict[str, dict]) -> dict[str, dict]:
    return {rid: {str(s): simulate(m, s) for s in GOLDEN_SEEDS} for rid, m in models.items()}


if __name__ == "__main__":
    models = {rid: build.build_race(rid).model for rid in RACES}
    doc = {"models": models, "golden": golden(models)}
    FIXTURE.write_text(json.dumps(doc, indent=1) + "\n")
    print(f"wrote {FIXTURE.relative_to(REPO_ROOT)}")
