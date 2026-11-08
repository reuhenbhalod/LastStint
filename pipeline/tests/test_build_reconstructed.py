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
    "japan-1989",
    "united-states-1990",
    "mexico-1990",
    "brazil-1991",
    "monaco-1992",
    "hungary-1992",
    "australia-1993",
]
# Era 1 (step 5.2a). san-marino-1985 is registered but has no race file: its disqualified
# Prost fails the order anchor (a data issue, docs/g1-report.md).
ERA_1 = [
    "portugal-1984",
    "mexico-1986",
    "hungary-1986",
    "australia-1986",
    "great-britain-1987",
    "monaco-1988",
]


@pytest.fixture(scope="module")
def hungary() -> build.BuildResult:
    # Mansell's lap-61 tyre fault is a FAULT fact in data/incidents.json.
    return build.build_race("hungary-1992")


@pytest.mark.parametrize("race_id", ERA_2 + ERA_1)
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
    result = CliRunner().invoke(cli.app, ["ingest", "japan-1989", "--force"])
    assert result.exit_code == 0, result.output
    assert "reconstructed race, skipped" in result.output


def test_era_1_races_carry_their_fuel_limit_and_no_safety_car():
    for race_id in ERA_1:
        model = json.loads((paths.RACES_DIR / f"{race_id}.json").read_text())
        assert model["rules"]["fuelLimit"] > 0 and model["rules"]["refuelling"] is False
        assert not [e for e in model["events"] if e["type"] in ("SC", "VSC")], race_id


def test_san_marino_1985_is_a_data_issue_with_no_race_file():
    assert build.RACES["san-marino-1985"]["data_issue"]
    assert not (paths.RACES_DIR / "san-marino-1985.json").exists()
    side = build.load_reconstruction("san-marino-1985")
    assert [r["anchor"] for r in rc.failures(side["anchors"])] == ["order"]


def test_a_race_with_no_sourced_stop_takes_the_reconstructions_pit_loss():
    # portugal-1984: no stop has a source, so none can be measured; the stop loss the
    # reconstruction assumes (lane time 25 s less the 5 s bypassed) stands in.
    result = build.build_race("portugal-1984")
    assert result.model["track"]["pitLoss"] == 20.0
    assert any("pitLoss: no stop in the reconstruction" in n for n in result.notes)
    side = build.load_reconstruction("portugal-1984")
    params = build.track.TrackParams(None, None, None, 0.0, 0.5, 90.0, None, None, 0, 0)
    got = build.reconstructed_pit_loss(params, side)
    assert got.pit_loss == 20.0 and got.pit_loss_under_sc == 20.0 * build.track.SC_PIT_LOSS_FACTOR
    measured = build.track.TrackParams(18.0, 9.9, 12.4, 0.0, 0.5, 90.0, None, None, 0, 0)
    assert build.reconstructed_pit_loss(measured, side) is measured
