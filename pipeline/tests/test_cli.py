"""CLI tests (Phase 1.8): offline, against the committed snapshots."""

from __future__ import annotations

import json

import pytest
from typer.testing import CliRunner

from pipeline import cli, paths, sim_reference

runner = CliRunner()


def test_list_shows_registered_races():
    result = runner.invoke(cli.app, ["list"])
    assert result.exit_code == 0
    assert "abu-dhabi-2021" in result.output and "HAM vs VER" in result.output


def test_build_writes_model_and_golden(tmp_path, monkeypatch):
    monkeypatch.setattr(paths, "RACES_DIR", tmp_path / "races")
    monkeypatch.setattr(paths, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(sim_reference, "GOLDEN_DIR", tmp_path / "golden")
    result = runner.invoke(cli.app, ["build", "abu-dhabi-2021"])
    assert result.exit_code == 0, result.output
    model = json.loads((tmp_path / "races" / "abu-dhabi-2021.json").read_text())
    golden = json.loads((tmp_path / "golden" / "abu-dhabi-2021.json").read_text())
    assert model["race"]["id"] == "abu-dhabi-2021"
    assert list(golden) == [str(s) for s in sim_reference.GOLDEN_SEEDS]
    assert "note:" in result.output  # prior/fallback notes are surfaced


def test_build_rejects_unknown_race():
    result = runner.invoke(cli.app, ["build", "monaco-1950"])
    assert result.exit_code != 0


@pytest.mark.parametrize(("race_id", "code"), [("abu-dhabi-2021", 0), ("spain-2021", 1)])
def test_validate_exit_code_reflects_g1(race_id, code):
    # The G1 gate's own run count (fewer runs can tip a borderline race either way).
    result = runner.invoke(cli.app, ["validate", race_id])
    assert result.exit_code == code, result.output
    assert "podium order rate" in result.output
