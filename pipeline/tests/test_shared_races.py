"""Shared races (eras build plan, "Shared races"): a race in the Daily or Gauntlet pool keeps
its race file free of its Eras overlay, which the Worker merges in for Eras only
(apps/worker/src/erasOverlay.ts). The merge's parity vectors are
tests/fixtures/eras_overlay_parity.json, which the Worker's test replays; regenerate with
`REGEN_OVERLAY_VECTORS=1 uv run python -m pytest tests/test_shared_races.py`.
Everything written goes to tmp_path; data/ is read only.
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import pytest

from pipeline import build, export, paths

VECTORS = Path(__file__).parent / "fixtures" / "eras_overlay_parity.json"
# The races in both Eras and a Daily/Gauntlet pool (data/pools.json, Nov 7 2026).
SHARED = ("abu-dhabi-2021", "bahrain-2021", "france-2021", "hungary-2019", "russia-2021")
TOUCHED = ("eras", "provenance", "rules")


def _pools() -> dict:
    return json.loads(build.POOLS_PATH.read_text())


def _race(race_id: str) -> dict:
    return json.loads((paths.RACES_DIR / f"{race_id}.json").read_text())


def test_shared_races_are_the_daily_and_gauntlet_pools():
    pools = _pools()
    shared = build.shared_races()
    assert shared == {*pools["daily"], *pools["survivor"]}
    eras = {rid for ids in pools["eras"].values() for rid in ids}
    assert sorted(shared & eras) == list(SHARED)


@pytest.mark.parametrize("race_id", SHARED)
def test_shared_race_files_carry_no_overlay(race_id):
    """The committed Daily file has none of the overlay's keys, though the overlay exists."""
    assert build.load_overlay(race_id)  # the Eras content lives beside the file
    model = _race(race_id)
    assert not set(model) & set(build.OVERLAY_KEYS)
    assert not any(e.get("storylineEvent") for e in model["events"])


def test_a_shared_race_builds_without_its_overlay(tmp_path):
    """abu-dhabi-2021 with an overlay of all four keys builds exactly as with none."""
    plain = build.build_race("abu-dhabi-2021", eras_dir=tmp_path / "none")
    (tmp_path / "abu-dhabi-2021.json").write_text(json.dumps(_vector_overlays()[0]))
    shared = build.build_race("abu-dhabi-2021", eras_dir=tmp_path)
    assert json.dumps(shared.model) == json.dumps(plain.model)
    assert shared.estimates == [
        "overlay: eras, provenance, rules, storylineEvents "
        "(a Daily/Gauntlet race: served beside the race file, not in it)"
    ]
    # Out of the pools (as a non-pool Eras race), the same overlay is applied as before.
    pools = tmp_path / "pools.json"
    pools.write_text(json.dumps({"daily": [], "survivor": {}, "eras": {}}))
    alone = build.build_race("abu-dhabi-2021", eras_dir=tmp_path, pools_path=pools)
    assert alone.model["rules"] == {"vsc": True} and alone.model["eras"]["eraId"] == 1
    assert alone.estimates == ["overlay: eras, provenance, rules, storylineEvents"]


def test_a_shared_race_with_estimates_refuses_an_overlay_provenance(tmp_path, monkeypatch):
    """The Worker's merge replaces provenance, so it would drop the build's estimated fields."""
    monkeypatch.setattr(build, "lap_time_weather", lambda _records: True)
    (tmp_path / "abu-dhabi-2021.json").write_text(json.dumps({"provenance": {"kind": "real"}}))
    with pytest.raises(ValueError, match="estimated fields"):
        build.build_race("abu-dhabi-2021", eras_dir=tmp_path)


# --- the merge's parity vectors (the Worker's withErasOverlay replays these) ---------------


def _vector_overlays() -> list[dict]:
    """The synthetic overlay of all four keys (abu-dhabi-2021's lap-53 SC is its storyline)."""
    return [
        {
            "eras": {"eraId": 1, "order": 1, "userSide": "HAM"},
            "provenance": {"kind": "real", "estimated": ["weather"]},
            "rules": {"vsc": True},
            "storylineEvents": [[53, "SC"]],
        }
    ]


def merge(model: dict, overlay: dict) -> dict:
    """An overlay over a race model, exactly as `pipeline build` applies it to a non-pool race
    with nothing estimated: export.with_eras_fields."""
    storyline = [(int(lap), str(kind)) for lap, kind in overlay.get("storylineEvents", [])]
    return export.with_eras_fields(
        model,
        eras=overlay.get("eras"),
        provenance=overlay.get("provenance"),
        rules=overlay.get("rules"),
        storyline_events=storyline or None,
    )


def _cases() -> list[dict]:
    synthetic = _vector_overlays()[0]
    return [
        {"name": "abu-dhabi-2021 all four keys", "race": "abu-dhabi-2021", "overlays": [synthetic]},
        {
            # A second overlay replaces the rules in place and adds eras after them: key order
            # is part of the model's hash.
            "name": "abu-dhabi-2021 rules then eras",
            "race": "abu-dhabi-2021",
            "overlays": [
                {"rules": {"vsc": True}},
                {"eras": {"eraId": 9, "order": 10}, "rules": {"drs": False}},
            ],
        },
        *(
            {"name": f"{rid} overlay", "race": rid, "overlays": [build.load_overlay(rid)]}
            for rid in SHARED
        ),
    ]


def build_vectors() -> dict:
    """Each case's merged model, stored compactly: its top-level key order, the blocks the merge
    sets, and its events (where storylineEvent is flagged). Every other key is the race file's."""
    out = []
    for case in _cases():
        model = _race(case["race"])
        for overlay in case["overlays"]:
            model = merge(model, overlay)
        out.append(
            {
                **case,
                "keys": list(model),
                "blocks": {k: model[k] for k in TOUCHED if k in model},
                "events": model["events"],
            }
        )
    return {"cases": out}


def test_parity_vectors_are_current():
    want = build_vectors()
    if os.environ.get("REGEN_OVERLAY_VECTORS"):
        VECTORS.write_text(json.dumps(want, indent=1) + "\n")
    assert json.loads(VECTORS.read_text()) == json.loads(json.dumps(want))


def test_merge_leaves_the_race_file_and_other_keys_alone():
    base = _race("abu-dhabi-2021")
    before = copy.deepcopy(base)
    merged = merge(base, _vector_overlays()[0])
    assert base == before
    assert {k: v for k, v in merged.items() if k not in (*TOUCHED, "events")} == {
        k: v for k, v in base.items() if k != "events"
    }
