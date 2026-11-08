"""Committed race files are current with a fresh build (rebuild sweep).

Every race file outside the Daily and Gauntlet pools is rebuilt whenever the build changes,
so it carries the schema version a fresh build writes and its Eras overlay's blocks
(data/eras/<race-id>.json). A pool race's file is pinned in production and never rebuilt
(build.shared_races), so it is skipped: the worker serves its overlay beside it.
"""

from __future__ import annotations

import json

import pytest

from pipeline import SCHEMA_VERSION, build, paths

POOL = build.shared_races()
RACE_FILES = sorted(paths.RACES_DIR.glob("*.json"))
NOT_POOLED = [p for p in RACE_FILES if p.stem not in POOL]


def test_the_sweep_sees_both_kinds_of_race():
    assert NOT_POOLED and len(NOT_POOLED) < len(RACE_FILES)


@pytest.mark.parametrize("path", NOT_POOLED, ids=lambda p: p.stem)
def test_a_non_pool_race_file_is_at_the_fresh_build_schema_version(path):
    assert json.loads(path.read_text())["schemaVersion"] == SCHEMA_VERSION


@pytest.mark.parametrize("path", NOT_POOLED, ids=lambda p: p.stem)
def test_a_non_pool_race_file_carries_its_overlay(path):
    overlay = build.load_overlay(path.stem)
    if overlay is None:
        pytest.skip("no Eras overlay")
    model = json.loads(path.read_text())
    for key in ("eras", "rules"):
        assert model.get(key) == overlay.get(key), f"{path.stem}: {key} differs from its overlay"
    if "provenance" in overlay:
        assert model["provenance"]["kind"] == overlay["provenance"]["kind"]


def test_pool_races_keep_their_committed_schema_version():
    """A Daily/Gauntlet pool race's file is pinned in production: the build keeps its stamp."""
    from pipeline import SCHEMA_VERSION, build

    pool = sorted(build.shared_races())
    assert pool
    race_id = pool[0]
    committed = json.loads((build.RACES_DIR / f"{race_id}.json").read_text())["schemaVersion"]
    stamped = build.pinned_schema_version(race_id, {"schemaVersion": SCHEMA_VERSION})
    assert stamped["schemaVersion"] == committed
    assert build.pinned_schema_version("not-a-race-1900", {"schemaVersion": 7}) == {
        "schemaVersion": 7
    }
