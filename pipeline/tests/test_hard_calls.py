"""Hard-call counter (eras build plan 1.5): the overlay writer, the result check and the CLI.

The counting and tie rule are tested in packages/sim/tests/hard-calls.test.ts; here one test
runs the real TS counter on abu-dhabi-2021, writing to a temp directory only.
"""

from __future__ import annotations

import json
import shutil

import pytest
from typer.testing import CliRunner

from pipeline import cli, hard_calls, paths

runner = CliRunner()

RESULT = {
    "hardCalls": {"HAM": 1, "VER": 2},
    "gaveUp": {"HAM": 25.7, "VER": 0.0},
    "userSide": "VER",
    "decidedBy": "hard-calls",
    "samples": 300,
}


def test_write_overlay_creates_the_file(tmp_path):
    path = hard_calls.write_overlay("abu-dhabi-2021", RESULT, tmp_path / "eras")
    assert json.loads(path.read_text()) == {
        "eras": {"hardCalls": {"HAM": 1, "VER": 2}, "userSide": "VER"}
    }


def test_write_overlay_touches_only_its_two_keys(tmp_path):
    existing = {
        "eras": {"eraId": 9, "order": 3, "userSide": "HAM", "hardCalls": {"HAM": 5, "BOT": 1}},
        "provenance": {"source": "fastf1"},
        "storylineEvents": [[53, "SC"]],
    }
    (tmp_path / "abu-dhabi-2021.json").write_text(json.dumps(existing))
    path = hard_calls.write_overlay("abu-dhabi-2021", RESULT, tmp_path)
    assert json.loads(path.read_text()) == {
        "eras": {"eraId": 9, "order": 3, "userSide": "VER", "hardCalls": {"HAM": 1, "VER": 2}},
        "provenance": {"source": "fastf1"},
        "storylineEvents": [[53, "SC"]],
    }


@pytest.mark.parametrize("bad", ["[]", '{"eras": 3}'])
def test_write_overlay_rejects_a_malformed_overlay(tmp_path, bad):
    (tmp_path / "x-2021.json").write_text(bad)
    with pytest.raises(ValueError):
        hard_calls.write_overlay("x-2021", RESULT, tmp_path)


@pytest.mark.parametrize(
    "line",
    [
        "not json",
        '{"userSide": "HAM"}',
        '{"hardCalls": {"HAM": -1, "VER": 0}, "userSide": "HAM"}',
        '{"hardCalls": {"HAM": 1, "VER": 0}, "userSide": "BOT"}',
    ],
)
def test_parse_result_rejects_bad_output(line):
    with pytest.raises(RuntimeError):
        hard_calls.parse_result(line)


def test_run_counter_needs_a_race_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        hard_calls.run_counter(tmp_path / "missing.json")


def test_cli_writes_the_overlay(tmp_path, monkeypatch):
    monkeypatch.setattr(hard_calls, "run_counter", lambda race_file, samples: RESULT)
    result = runner.invoke(cli.app, ["hard-calls", "abu-dhabi-2021", "--out", str(tmp_path)])
    assert result.exit_code == 0, result.output
    assert "HAM 1, VER 2" in result.output and "userSide VER" in result.output
    overlay = json.loads((tmp_path / "abu-dhabi-2021.json").read_text())
    assert overlay["eras"]["userSide"] == "VER"


def test_cli_fails_cleanly_on_an_unknown_race(tmp_path):
    result = runner.invoke(cli.app, ["hard-calls", "monaco-1950", "--out", str(tmp_path)])
    assert result.exit_code == 1
    assert not list(tmp_path.iterdir())


@pytest.mark.skipif(shutil.which("pnpm") is None, reason="needs pnpm to run the TS sim")
def test_real_counter_on_abu_dhabi(tmp_path):
    result = hard_calls.run_counter(paths.RACES_DIR / "abu-dhabi-2021.json")
    assert result["hardCalls"] == {"HAM": 1, "VER": 2}
    assert result["userSide"] == "VER"
    path = hard_calls.write_overlay("abu-dhabi-2021", result, tmp_path)
    assert json.loads(path.read_text())["eras"]["userSide"] == "VER"
