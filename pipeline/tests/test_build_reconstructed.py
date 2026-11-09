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
# Era 1 (step 5.2a). san-marino-1985 was replaced by germany-1986 (its winner on the road was
# disqualified; owner decision Nov 7).
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
    result = CliRunner().invoke(cli.app, ["ingest", "mexico-1990", "--force"])
    assert result.exit_code == 0, result.output
    assert "reconstructed race, skipped" in result.output


def test_era_1_races_carry_their_fuel_limit_and_no_safety_car():
    for race_id in ERA_1:
        model = json.loads((paths.RACES_DIR / f"{race_id}.json").read_text())
        assert model["rules"]["fuelLimit"] > 0 and model["rules"]["refuelling"] is False
        assert not [e for e in model["events"] if e["type"] in ("SC", "VSC")], race_id


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


def test_reconstructed_wet_stints_keep_their_tyres():
    """A wet reconstruction leaves slick stints empty for step 2.4 and labels its wet-tyre
    stints (reconstruct.py, facts-file weather); the build fills only the empty ones."""
    laps = pd.DataFrame(
        {
            "Driver": ["A"] * 4,
            "LapNumber": [1.0, 2.0, 3.0, 4.0],
            "Stint": [1.0, 1.0, 2.0, 2.0],
            "TyreLife": [1.0, 2.0, 1.0, 2.0],
            "Compound": [None, None, "WET", "WET"],
        }
    )
    out = build.reconstructed_laps(laps, 1992)
    assert list(out["Compound"].iloc[2:]) == ["WET", "WET"]
    assert out["Compound"].iloc[:2].notna().all()
    assert "WET" not in set(out["Compound"].iloc[:2])


# Eras build plan 5.5: the wet reconstructed races (facts-file weather). brazil-1993 is
# built from Nov 8 2026 (its unsourced slick stops estimated: weather.slickChange).
WET_BUILT = [
    "monaco-1984",
    "portugal-1985",
    "belgium-1992",
    "brazil-1993",
    "europe-1993",
    "belgium-1995",
]
ALL_WET = WET_BUILT
WET_EVERY_LAP = ["monaco-1984", "portugal-1985", "europe-1993"]


@pytest.mark.parametrize("race_id", ALL_WET)
def test_wet_reconstructions_are_registered_and_pass_their_anchors(race_id):
    meta = build.RACES[race_id]
    assert meta["source"] == "reconstruct" and meta["split"] == "eras" and meta["seed"] == 1
    assert meta["score_positions"] == 6
    side = build.load_reconstruction(race_id)
    assert side["solver"]["passed"] and rc.failures(side["anchors"]) == []
    assert "weather" in side and (paths.RAW_DIR / f"{race_id}.weather.json").exists()
    built = (paths.RACES_DIR / f"{race_id}.json").exists()
    assert built == (race_id in WET_BUILT) == (not meta.get("data_issue"))


@pytest.mark.parametrize("race_id", WET_BUILT)
def test_wet_race_files_carry_weather_rules_and_the_duel(race_id):
    model = json.loads((paths.RACES_DIR / f"{race_id}.json").read_text())
    meta = build.RACES[race_id]
    assert model["reconstructed"] is True and model["provenance"]["kind"] == "reconstructed"
    assert "weather" in model["provenance"]["estimated"]
    assert len(model["weather"]["wetness"]) == model["race"]["laps"]
    assert {meta["user_side"], meta["rival"]} <= {d["code"] for d in model["drivers"]}
    year = meta["year"]
    assert model["rules"]["refuelling"] is (year >= 1994)
    assert ("fuelLimit" in model["rules"]) is (year <= 1985)
    if year < 1993:
        assert not [e for e in model["events"] if e["type"] in ("SC", "VSC")]


@pytest.fixture(scope="module")
def monaco() -> build.BuildResult:
    return build.build_race("monaco-1984")


def test_a_race_wet_on_every_lap_takes_the_solvers_dry_pace(monaco):
    side = build.load_reconstruction("monaco-1984")
    fuel, laps = side["params"]["fuel_per_lap"], side["laps"]
    model = monaco.model
    assert model["fuelEffectPerLap"] == fuel
    # basePace is the solver's pace in the sims' terms plus the shrunk post-takeover offset.
    for d in model["drivers"]:
        assert d["basePace"] == pytest.approx(
            side["fitted"][d["code"]]["pace"] + fuel * (laps + 1), abs=1.0
        )
        assert d["noise"] == pytest.approx(side["fitted"][d["code"]]["noise"], abs=1e-4)
    assert any(line.startswith("  dry pace: wet on every lap") for line in monaco.estimates)
    assert any(n.startswith("dry pace: wet on every lap") for n in monaco.notes)


@pytest.mark.parametrize("race_id", WET_EVERY_LAP)
def test_wet_on_every_lap_and_solver_paced(race_id):
    side = build.load_reconstruction(race_id)
    assert min(side["weather"]["wetness"]) >= rc.RAIN_FROM  # no dry lap anywhere
    model = json.loads((paths.RACES_DIR / f"{race_id}.json").read_text())
    wear = sorted(f["wear"] for f in side["fitted"].values())[len(side["fitted"]) // 2]
    assert model["compounds"]["MEDIUM"]["degPerLap"] == pytest.approx(wear, abs=0.02)
    assert model["compounds"]["WET"]["degPerLap"] == model["compounds"]["MEDIUM"]["degPerLap"]


def test_solver_dry_fit_reads_the_sidecar():
    side = {
        "raceId": "toy-1990",
        "year": 1990,
        "laps": 50,
        "params": {"fuel_per_lap": 0.06, "refuel": None},
        "fitted": {
            "AAA": {"pace": 85.0, "wear": 0.02, "noise": 0.35},
            "BBB": {"pace": 86.0, "wear": 0.04, "noise": 0.7},
            "CCC": {"pace": 87.0, "wear": 0.0, "noise": 1.05},
        },
    }
    laps = pd.DataFrame({"Compound": ["WET", "MEDIUM", None]})
    got = build.solver_dry_fit(side, laps)
    assert got.driver_pace == pytest.approx({"AAA": 88.06, "BBB": 89.06, "CCC": 90.06})
    assert got.driver_noise == {"AAA": 0.35, "BBB": 0.7, "CCC": 1.05}
    assert got.reference_compound == "MEDIUM" and got.fuel_per_lap == 0.06
    assert got.compound_wear == {"MEDIUM": 0.02, "WET": 0.02}  # the field's median
    assert got.compound_offset == {"MEDIUM": 0.0, "WET": 0.0}
    with pytest.raises(ValueError, match="refuelling"):
        build.solver_dry_fit({**side, "year": 1995}, laps)
    with pytest.raises(ValueError, match="no solved pace"):
        build.solver_dry_fit({**side, "fitted": {}}, laps)


def test_real_timing_wet_on_every_lap_still_cannot_be_built(tmp_path):
    rows = []
    for d in ("AAA", "BBB"):
        t = 0.0
        for lap in range(1, 9):
            t += 100.0 + lap * 0.1
            rows.append(
                {
                    **dict.fromkeys(ingest.LAP_COLUMNS),
                    "Driver": d,
                    "Team": "T",
                    "LapNumber": float(lap),
                    "LapTime": 100.0 + lap * 0.1,
                    "Time": t,
                    "Compound": "WET",
                    "TyreLife": float(lap),
                    "Stint": 1.0,
                    "TrackStatus": "1",
                    "IsAccurate": True,
                    "Position": 1.0 if d == "AAA" else 2.0,
                }
            )
    laps = pd.DataFrame(rows, columns=ingest.LAP_COLUMNS)
    with pytest.raises(ValueError, match="no dry lap"):
        build.dry_fit("toy-2016", laps, "2014-2025", raw_dir=tmp_path)


def test_a_disqualified_car_on_the_road_stays_out_of_the_official_result(monaco):
    side = build.load_reconstruction("monaco-1984")
    (bel,) = side["roadPositions"]
    assert bel["driver"] == "BEL" and bel["position"] == 3 and bel["gap"] == 21.141
    assert bel["gapSourced"] and "motorsportmagazine.com" in bel["source"]
    raw = pd.read_parquet(ingest.raw_snapshot_path("monaco-1984"))
    road = build.assemble.finishing_order(raw)
    assert road[:4] == ["PRO", "SENA", "BEL", "ARN"]  # run third on the road
    real = monaco.model["realResult"]
    classified = side["classified"]
    assert real[: len(classified)] == classified and real[len(classified)] == "BEL"
    assert "BEL" in {d["code"] for d in monaco.model["drivers"]}  # it still races
    assert any("realResult: BEL disqualified, P3 on the road" in x for x in monaco.estimates)


def test_official_result_moves_road_placed_cars_behind_the_classified():
    model = {"realResult": ["A", "D", "B", "C", "E", "R"]}
    recon = {
        "classified": ["A", "B", "C", "E"],
        "roadPositions": [{"driver": "D", "position": 2, "gap": 3.0, "gapSourced": True}],
    }
    out, lines = build.official_result(model, recon)
    assert out["realResult"] == ["A", "B", "C", "E", "D", "R"]
    assert lines == [
        "  realResult: D disqualified, P2 on the road at +3.000s; listed P5, behind the"
        " classified cars"
    ]


def test_monaco_1984_ends_at_its_results_lap(monaco):
    assert monaco.model["race"]["laps"] == 31  # red flag on lap 32, results from lap 31
    assert not [e for e in monaco.model["events"] if e["type"] == "RED"]


@pytest.mark.parametrize("race_id", WET_BUILT)
def test_wet_builds_match_the_committed_race_files(race_id):
    committed = json.loads((paths.RACES_DIR / f"{race_id}.json").read_text())
    assert json.loads(json.dumps(build.build_race(race_id).model)) == committed
