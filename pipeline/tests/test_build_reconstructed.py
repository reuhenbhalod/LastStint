"""Building a reconstructed race (eras build plan 5.1): a 1983-1995 race rebuilt from its
anchors by `pipeline reconstruct` (step 4.6) builds like any other race, from the committed
synthetic snapshot in data/raw/, and its file is marked reconstructed.

Offline, against the committed Era 2 races (docs/g1-report.md, step 5.1 reconstructed).
"""

from __future__ import annotations

import json

import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import build, cli, ingest, paths
from pipeline import reconstruct as rc

ERA_2 = [
    "united-states-1990",
    "mexico-1990",
    "brazil-1991",
    "monaco-1992",
    "hungary-1992",
    "australia-1993",
]


@pytest.fixture(scope="module")
def hungary() -> build.BuildResult:
    # Mansell's lap-61 tyre fault is a FAULT fact in data/incidents.json.
    return build.build_race("hungary-1992")


@pytest.mark.parametrize("race_id", ERA_2)
def test_registered_as_reconstructed_eras_races(race_id):
    meta = build.RACES[race_id]
    assert meta["source"] == "reconstruct" and meta["split"] == "eras"
    assert meta["era"] == "1988-1993" and meta["seed"] == 1 and meta["score_positions"] == 6
    assert build.load_reconstruction(race_id) is not None
    model = json.loads((paths.RACES_DIR / f"{race_id}.json").read_text())
    codes = {d["code"] for d in model["drivers"]}
    assert {meta["user_side"], meta["rival"]} <= codes
    assert model["reconstructed"] is True and model["provenance"]["kind"] == "reconstructed"
    assert model["rules"]["vsc"] is False and model["rules"]["drs"] is False


def test_build_marks_the_race_reconstructed(hungary):
    model = hungary.model
    side = build.load_reconstruction("hungary-1992")
    assert model["reconstructed"] is True
    assert model["provenance"] == side["provenance"]  # no overlay provenance to merge
    assert model["provenance"]["kind"] == "reconstructed"
    assert any(line.startswith("reconstructed (step 4.6)") for line in hungary.estimates)


def test_build_fills_the_single_dry_compound(hungary):
    raw = pd.read_parquet(ingest.raw_snapshot_path("hungary-1992"))
    assert raw["Compound"].isna().all()  # the reconstruction leaves it empty
    assert set(hungary.laps["Compound"].dropna()) == {"MEDIUM"}
    assert set(hungary.model["compounds"]) == {"MEDIUM"}


def test_fault_on_synthetic_laps_is_reported_not_fitted(hungary):
    # Synthetic laps carry no fault loss, so a fit would read back solver noise.
    assert [e for e in hungary.model["events"] if e["type"] == "FAULT"] == []
    assert any("fault not modelled: lap 61 MAN" in line for line in hungary.estimates)


def test_build_matches_the_committed_race_file(hungary):
    committed = json.loads((paths.RACES_DIR / "hungary-1992.json").read_text())
    assert json.loads(json.dumps(hungary.model)) == committed


def test_a_real_race_is_not_marked():
    assert build.load_reconstruction("abu-dhabi-2021") is None
    assert not rc.sidecar_path("abu-dhabi-2021").exists()


def test_reconstructed_laps_keeps_real_compounds():
    laps = pd.DataFrame({"Compound": ["SOFT", None], "Stint": [1.0, 1.0]})
    assert build.reconstructed_laps(laps, 1992)["Compound"].tolist() == ["SOFT", None]
    empty = pd.DataFrame({"Compound": [None, None], "Stint": [1.0, 2.0]})
    assert build.reconstructed_laps(empty, 1992)["Compound"].tolist() == ["MEDIUM", "MEDIUM"]


def test_ingest_skips_reconstructed_races(monkeypatch):
    def no_network(*_args, **_kwargs):
        raise AssertionError("reconstructed races are rebuilt with `pipeline reconstruct`")

    monkeypatch.setattr(cli.ingest, "ingest_race", no_network)
    monkeypatch.setattr(cli.ingest, "ingest_openf1", no_network)
    result = CliRunner().invoke(cli.app, ["ingest", "mexico-1990", "--force"])
    assert result.exit_code == 0, result.output
    assert "reconstructed race, skipped" in result.output
