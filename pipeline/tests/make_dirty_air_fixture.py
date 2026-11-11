"""Regenerate packages/sim/tests/fixtures/eras-dirty-air.json: Eras race models carrying the W3
fields (dirty_air.py) and the Python reference sim's results on them, for the TS parity test
(packages/sim/tests/eras-dirty-air.test.ts) and tests/test_dirty_air.py. Built with the model
switched on (dirty_air.IN_ERAS_BUILDS), whatever the committed switch: spain-2021 with its
dirtyAirBands, the same with heldGap 0.79 and rollOnly, and brazil-2006 (refuelling) with
its bands and rollOnly.

    uv run python tests/make_dirty_air_fixture.py
"""

from __future__ import annotations

import copy
import json

from pipeline import build, dirty_air
from pipeline.paths import REPO_ROOT
from pipeline.sim_reference import GOLDEN_SEEDS, simulate

FIXTURE = REPO_ROOT / "packages" / "sim" / "tests" / "fixtures" / "eras-dirty-air.json"


def golden(models: dict[str, dict]) -> dict[str, dict]:
    return {rid: {str(s): simulate(m, s) for s in GOLDEN_SEEDS} for rid, m in models.items()}


def models() -> dict[str, dict]:
    saved = dirty_air.IN_ERAS_BUILDS
    dirty_air.IN_ERAS_BUILDS = True
    try:
        spain = build.build_race("spain-2021").model
        brazil = build.build_race("brazil-2006").model
    finally:
        dirty_air.IN_ERAS_BUILDS = saved
    held = copy.deepcopy(spain)
    held["track"]["overtakeModel"].update(heldGap=0.79, rollOnly=True)
    brazil["track"]["overtakeModel"]["rollOnly"] = True
    return {"spain-2021": spain, "spain-2021-held-roll": held, "brazil-2006-roll": brazil}


if __name__ == "__main__":
    ms = models()
    doc = {"models": ms, "golden": golden(ms)}
    FIXTURE.write_text(json.dumps(doc, indent=1) + "\n")
    print(f"wrote {FIXTURE.relative_to(REPO_ROOT)}")
