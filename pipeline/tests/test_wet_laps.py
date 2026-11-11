"""Wet races before 2018 (wet_laps.py): the wet laps, safety cars and tyre classes from the
lap times, and the weather records wet.py reads.

Fixtures (tests/fixtures/wet_laps/): Hungary 2014 from the TUM f1-timing-database (CC BY-NC-SA
3.0, Institute of Automotive Technology, TU Munich, commit 9eaad9c; `pipeline tum-ingest`) and
Brazil 2012 from the Jolpica-F1 CSV dump of 2026-10-24 (CC BY-NC-SA 4.0; `pipeline jolpica`),
as their raw snapshots.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import ingest, wet, wet_laps
from pipeline.cli import app

FIX = Path(__file__).parent / "fixtures" / "wet_laps"
CURVES = wet.load_curves()


def synthetic(rain=range(20, 31), sc=range(36, 40), n_laps=50, drivers=16, status=False):
    """A dry race with a rain spell (slicks ~8% off) and a safety car (30-45% off, the field
    bunched up), no compounds; TrackStatus only with `status`."""
    rng = np.random.default_rng(1)
    rows, t, sc_lap = [], {d: 0.0 for d in range(drivers)}, 0.0
    for lap in range(1, n_laps + 1):
        lead = None
        for d in range(drivers):
            lt = 90 + 0.3 * d + 0.056 * (n_laps - lap) + rng.normal(0, 0.15)
            if lap in rain:
                lt *= 1.08
            if lap == 1:
                lt += 6
            if lap in sc:
                # The leader behind the SC; the rest close up on it, at no less than 90% of
                # its lap.
                lt = lt * 1.45 if d == 0 else max(lead + 0.8 * d - t[d], 0.9 * sc_lap)
            t[d] += lt
            if d == 0:
                lead, sc_lap = t[d], lt
            rows.append(
                {
                    "Driver": f"D{d:02d}",
                    "Team": "T",
                    "LapNumber": float(lap),
                    "LapTime": lt,
                    "Time": t[d],
                    "Compound": None,
                    "TyreLife": None,
                    "Stint": 1.0,
                    "PitInTime": np.nan,
                    "PitOutTime": np.nan,
                    "TrackStatus": ("4" if lap in sc else "1") if status else None,
                    "Position": float(d + 1),
                    "IsAccurate": lap > 1,
                }
            )
    return pd.DataFrame(rows)


def calls_of(est):
    return {c.lap: c for c in est.calls}


def test_rain_and_a_safety_car_are_told_apart_from_the_lap_times():
    est = wet_laps.estimate(synthetic())
    assert est.neutral_source == "lap-times"
    c = calls_of(est)
    neutral = {lap for lap, x in c.items() if x.neutral}
    assert neutral == set(range(36, 40)) or neutral == set(range(37, 40))
    assert est.wet_laps == set(range(20, 31))
    # The safety car between dry laps isn't rain; its edges are flagged.
    assert not any(c[lap].wet for lap in range(36, 40))
    assert c[40].ambiguous and "after a neutralisation" in c[40].ambiguous
    # Filled for the build: the SC laps' status and a class for every stint.
    assert set(est.laps.loc[est.laps.LapNumber.isin(neutral), "TrackStatus"]) == {"4"}
    assert set(est.laps["Compound"]) == {wet_laps.DRY_PLACEHOLDER}
    assert len(est.filled) == 2


def test_the_status_timeline_wins_where_the_source_has_one():
    est = wet_laps.estimate(synthetic(status=True))
    assert est.neutral_source == "status"
    assert {c.lap for c in est.calls if c.neutral} == set(range(36, 40))
    assert len(est.filled) == 1  # compounds only
    assert list(est.laps["TrackStatus"]) == list(synthetic(status=True)["TrackStatus"])


def test_a_dry_race_has_no_wet_laps():
    est = wet_laps.estimate(synthetic(rain=(), sc=()))
    assert est.wet_laps == set()
    assert not wet.rain_laps(est.laps, est.records())


def test_a_neutralisation_inside_a_wet_spell_is_wet():
    est = wet_laps.estimate(synthetic(rain=range(15, 45), sc=range(25, 29)))
    c = calls_of(est)
    assert all(c[lap].wet for lap in range(25, 29))
    assert not any(c[lap].ambiguous and "between a wet and a dry" in c[lap].ambiguous for lap in c)


def test_records_are_what_wet_py_reads():
    est = wet_laps.estimate(synthetic())
    rec = est.records()
    assert [r["lap"] for r in rec] == list(range(1, 51))
    assert all(r["source"] == "lap-times" for r in rec)
    assert wet.rain_laps(est.laps, rec) == est.wet_laps
    dry = wet.dry_laps(rec)
    assert not dry & est.wet_laps
    assert not dry & {c.lap for c in est.calls if c.ambiguous}
    assert wet.is_wet_race(est.laps, rec)


def test_rain_gauge_records_behave_as_before():
    laps = pd.DataFrame({"LapNumber": [1.0, 2.0, 3.0], "Time": [100.0, 200.0, 300.0]})
    gauge = [{"time": 150.0, "rain": True, "track": 30.0, "air": 20.0}]
    assert wet.rain_laps(laps, gauge) == {2, 3}
    assert wet.dry_laps(gauge) == set()
    assert wet.dry_laps(None) == set()


def test_the_timeline_is_unchanged_without_dry_laps():
    rows = [(lap, "slick", 0.01 * (lap > 5), 10) for lap in range(1, 12)]
    obs = pd.DataFrame(rows, columns=["lap", "cls", "median", "count"])
    base = wet.timeline(obs, 11, set(), CURVES)
    assert wet.timeline(obs, 11, set(), CURVES, set()) == base
    assert wet.timeline(obs, 11, set(), CURVES, None) == base
    firm = wet.timeline(obs, 11, set(), CURVES, set(range(1, 12)))
    assert max(firm) <= max(base)


@pytest.fixture(scope="module")
def hungary():
    return pd.read_parquet(FIX / "hungary-2014.tum.parquet")


def test_hungary_2014_starts_wet_and_dries_by_lap_17(hungary):
    est = wet_laps.estimate(hungary)
    assert est.neutral_source == "status" and est.filled == []
    spells = wet_laps.runs(est.wet_laps)
    # Wikipedia: wet at the start (all on inters), dry tyres from the lap-9 SC, "the track
    # was drying" by Button's lap-16 stop; SCs from lap 9 (ERI) and lap 23 (PER).
    assert spells[0][0] == 1 and 15 <= spells[0][1] <= 18
    assert all(a > 40 for a, _ in spells[1:])  # nothing wet mid-race
    neutral = wet_laps.runs({c.lap for c in est.calls if c.neutral})
    assert neutral == [(8, 13), (23, 26)]


def test_hungary_2014_without_its_status_and_compounds(hungary):
    """TUM's own SC laps and compounds, hidden: the lap-time estimate recovers them."""
    blank = hungary.assign(Compound=None, TrackStatus=None)
    est = wet_laps.estimate(blank)
    neutral = {c.lap for c in est.calls if c.neutral}
    assert set(range(9, 14)) <= neutral <= set(range(8, 14)) | set(range(23, 27))
    assert set(range(23, 27)) <= neutral
    cls = {"INTERMEDIATE": "inter", "WET": "wet"}
    truth = hungary["Compound"].map(lambda c: cls.get(c, "slick"))
    got = est.laps["Compound"].map(lambda c: cls.get(c, "slick"))
    assert (truth == got).mean() > 0.97
    # Everyone started on inters; Button's second set of inters (lap 9-15) is the miss.
    assert all(est.classes[(d, 1)] == "inter" for d in hungary["Driver"].unique())


def test_brazil_2012_rain_comes_and_goes_and_the_race_ends_under_the_sc():
    laps = pd.read_parquet(FIX / "brazil-2012.jolpica.parquet")
    est = wet_laps.estimate(laps)
    assert est.neutral_source == "lap-times"
    spells = wet_laps.runs(est.wet_laps)
    # Reports: slicks at the start in drizzle, inters by lap 9, back to slicks ~lap 18-19;
    # SC from lap 23 (debris) to the lap-29 restart; heavier drizzle from ~lap 48, inters
    # for the final stint; di Resta's crash on lap 69/70 ends it under the SC.
    assert 4 <= spells[0][0] <= 8 and 17 <= spells[0][1] <= 21
    assert 48 <= spells[-1][0] <= 56 and spells[-1][1] == 71
    assert not est.wet_laps & set(range(33, 43))
    neutral = wet_laps.runs({c.lap for c in est.calls if c.neutral})
    assert (25, 29) in neutral and neutral[-1][1] == 71
    # Button and Hulkenberg stayed out on slicks early; Alonso and Hamilton took inters.
    assert est.classes[("BUT", 1)] == "slick" and est.classes[("HUL", 1)] == "slick"
    assert est.classes[("ALO", 2)] == "inter" and est.classes[("HAM", 2)] == "inter"


def test_cli_writes_the_records_report_and_filled_snapshot(tmp_path):
    rid = "brazil-2012"
    synthetic().to_parquet(ingest.raw_snapshot_path(rid, tmp_path))
    run = CliRunner().invoke(app, ["wet-laps", rid, "--raw-dir", str(tmp_path)])
    assert run.exit_code == 0, run.output
    assert "wet laps 20-30" in run.output
    rec = ingest.load_weather(rid, tmp_path)
    assert wet.rain_laps(pd.read_parquet(tmp_path / f"{rid}.parquet"), rec) == set(range(20, 31))
    report = json.loads(wet_laps.report_path(rid, tmp_path).read_text())
    assert report["wetSpells"] == ["20-30"] and report["filled"]
    filled = pd.read_parquet(tmp_path / f"{rid}.parquet")
    assert filled["Compound"].notna().all() and filled["TrackStatus"].notna().all()
    again = CliRunner().invoke(app, ["wet-laps", rid, "--raw-dir", str(tmp_path)])
    assert "skipped" in again.output


def test_estimated_dry_labels_are_refitted_and_kept_on_slick_stints(hungary):
    """A Jolpica race ingested with step 2.4's estimates: every stint carries a dry label (2.4
    never labels a wet tyre). With the labels given, the wet classes are refitted anyway and
    the slick stints keep 2.4's label instead of the placeholder."""
    stint = wet_laps.stints(hungary)
    labels = {
        (d, s): "HARD" if s % 2 else "SOFT"
        for d, s in zip(hungary["Driver"].astype(str), stint, strict=True)
    }
    as_24 = hungary.assign(Compound=[labels[k] for k in zip(hungary["Driver"], stint, strict=True)])
    assert wet_laps.estimate(as_24).classes == {}  # without the labels: taken as real
    est = wet_laps.estimate(as_24, dry_labels=labels)
    assert all(est.classes[(d, 1)] == "inter" for d in hungary["Driver"].unique())
    pairs = zip(est.laps["Driver"], stint, strict=True)
    got = dict(zip(pairs, est.laps["Compound"], strict=True))
    for k, cls in est.classes.items():
        assert got[k] == (labels[k] if cls == "slick" else wet_laps.CLASS_COMPOUND[cls])
    assert any("2.4" in f for f in est.filled)


def test_estimated_dry_labels_come_from_a_sidecar_that_estimated_compounds():
    stints = [
        {"driver": "HAM", "stint": 1, "compound": "SOFT"},
        {"driver": "HAM", "stint": 2, "compound": "HARD"},
    ]
    side = {"estimates": {"estimated": ["compounds"], "compounds": {"stints": stints}}}
    assert wet_laps.estimated_dry_labels(side) == {("HAM", 1): "SOFT", ("HAM", 2): "HARD"}
    real = {"estimates": {"estimated": ["safetyCars"], "compounds": {"stints": []}}}
    assert wet_laps.estimated_dry_labels(real) is None
    assert wet_laps.estimated_dry_labels(None) is None


def test_cli_refits_a_jolpica_race_with_estimated_compounds(tmp_path):
    rid = "turkey-2020"
    laps = synthetic(rain=range(1, 16), sc=())
    laps["Compound"] = "HARD"  # what step 2.4 wrote: dry labels only
    laps.to_parquet(ingest.raw_snapshot_path(rid, tmp_path))
    stints = [{"driver": d, "stint": 1, "compound": "HARD"} for d in laps["Driver"].unique()]
    side = {"estimates": {"estimated": ["compounds"], "compounds": {"stints": stints}}}
    (tmp_path / f"{rid}.jolpica.json").write_text(json.dumps(side))
    for _ in range(2):  # a forced re-run replaces its note, it doesn't add another
        run = CliRunner().invoke(app, ["wet-laps", rid, "--raw-dir", str(tmp_path), "--force"])
        assert run.exit_code == 0, run.output
    notes = json.loads((tmp_path / f"{rid}.jolpica.json").read_text())["estimates"]["compounds"]
    assert sum(n.startswith(wet_laps.SIDECAR_NOTE) for n in notes["notes"]) == 1
    assert not set(pd.read_parquet(tmp_path / f"{rid}.parquet")["Compound"]) - {
        "HARD",
        "INTERMEDIATE",
        "WET",
    }


def test_a_jolpica_race_with_step_2_4_estimates_refits_the_classes_and_keeps_its_labels(
    tmp_path,
):
    """Step 2.4 labels every Jolpica stint dry: wet-laps sets the labels aside to fit the tyre
    classes, gives the slick stints their 2.4 label back, keeps 2.4's SC laps, and lists the
    weather as estimated in the sidecar (the race file's provenance)."""
    rid = "brazil-2012"
    laps = synthetic(status=True).assign(Compound="SOFT")
    laps.to_parquet(ingest.raw_snapshot_path(rid, tmp_path))
    drivers = sorted(laps["Driver"].unique())
    sidecar = {
        "year": 2012,
        "estimates": {
            "estimated": ["compounds", "safetyCars"],
            "compounds": {
                "stints": [{"driver": d, "stint": 1, "compound": "HARD"} for d in drivers]
            },
        },
    }
    (tmp_path / f"{rid}.jolpica.json").write_text(json.dumps(sidecar))
    run = CliRunner().invoke(app, ["wet-laps", rid, "--raw-dir", str(tmp_path)])
    assert run.exit_code == 0, run.output
    filled = pd.read_parquet(tmp_path / f"{rid}.parquet")
    assert set(filled["Compound"]) == {"HARD"}  # all slick here: 2.4's label, not SOFT/MEDIUM
    assert filled["TrackStatus"].tolist() == laps["TrackStatus"].tolist()
    side = json.loads((tmp_path / f"{rid}.jolpica.json").read_text())["estimates"]
    assert side["estimated"] == ["compounds", "safetyCars", "weather"]


def test_wet_stints_replace_their_dry_label_in_the_sidecar():
    est = wet_laps.Estimate(
        pd.DataFrame(), [], "status", {("AAA", 1): "inter", ("AAA", 2): "slick"}
    )
    side = {
        "estimates": {
            "estimated": ["compounds"],
            "compounds": {
                "stints": [
                    {"driver": "AAA", "stint": 1, "compound": "SOFT", "by": "pace"},
                    {"driver": "AAA", "stint": 2, "compound": "HARD", "by": "pace"},
                ]
            },
        }
    }
    out = wet_laps.update_sidecar(side, est)["estimates"]
    assert [(s["compound"], s["by"]) for s in out["compounds"]["stints"]] == [
        ("INTERMEDIATE", "wet-laps"),
        ("HARD", "pace"),
    ]
    assert out["estimated"] == ["compounds", "weather"]
    assert wet_laps.estimated_dry_labels(None) is None
    assert wet_laps.estimated_dry_labels({"estimates": {"estimated": ["safetyCars"]}}) is None


def test_a_rerun_starts_again_from_the_step_2_4_labels():
    """update_sidecar keeps each relabelled stint's 2.4 label (`dry`): the next run's labels
    come from it, and a stint fitted slick this time gets it back."""
    stint = {"driver": "AAA", "stint": 1, "compound": "SOFT", "by": "pace"}
    side = {"estimates": {"estimated": ["compounds"], "compounds": {"stints": [stint]}}}
    wet = wet_laps.Estimate(pd.DataFrame(), [], "status", {("AAA", 1): "inter"})
    wet_laps.update_sidecar(side, wet)
    assert wet_laps.estimated_dry_labels(side) == {("AAA", 1): "SOFT"}
    dry = wet_laps.Estimate(pd.DataFrame(), [], "status", {("AAA", 1): "slick"})
    out = wet_laps.update_sidecar(side, dry)["estimates"]
    assert out["compounds"]["stints"] == [stint]
    assert sum(n.startswith(wet_laps.SIDECAR_NOTE) for n in out["compounds"]["notes"]) == 1


def test_sourced_tyre_facts_are_held_through_the_fit(hungary, tmp_path):
    """A stint a race report gives (data/estimates/<id>.tyres.json) keeps its class, whatever
    the lap times say; "rain" (the report says only "wets") fixes it to a rain tyre and the
    fit picks inter or wet; the other stints are fitted as before."""
    blank = hungary.assign(Compound=None, TrackStatus=None)
    fitted = wet_laps.estimate(blank).classes
    wet_stint = next(k for k, c in fitted.items() if c != "slick")
    dry_stint = next(k for k, c in fitted.items() if c == "slick")
    facts = {
        "race": "hungary-2014",
        "stints": [
            {"driver": wet_stint[0], "stint": wet_stint[1], "class": "slick",
             "source": "https://example.org/report"},
            {"driver": dry_stint[0], "stint": dry_stint[1], "class": "rain",
             "source": "https://example.org/report"},
        ],
    }  # fmt: skip
    (tmp_path / "hungary-2014.tyres.json").write_text(json.dumps(facts))
    known = wet_laps.load_tyre_facts("hungary-2014", tmp_path)
    assert known == {wet_stint: "slick", dry_stint: "rain"}
    est = wet_laps.estimate(blank, known=known)
    assert est.classes[wet_stint] == "slick"
    assert est.classes[dry_stint] in ("inter", "wet")
    assert any("sourced tyre facts" in f for f in est.filled)
    assert wet_laps.load_tyre_facts("nowhere-2014", tmp_path) == {}


def test_a_tyre_fact_needs_a_class_and_a_source(tmp_path):
    for bad in (
        {"driver": "AAA", "stint": 1, "class": "dry", "source": "https://example.org"},
        {"driver": "AAA", "stint": 1, "class": "wet"},
        {"driver": "AAA", "stint": 1, "class": "wet", "source": "https://x.org", "laps": 3},
    ):
        (tmp_path / "x-2000.tyres.json").write_text(json.dumps({"stints": [bad]}))
        with pytest.raises(ValueError):
            wet_laps.load_tyre_facts("x-2000", tmp_path)


def test_committed_tyre_facts_load():
    for path in sorted((Path(__file__).parents[2] / "data" / "estimates").glob("*.tyres.json")):
        race = path.name.removesuffix(".tyres.json")
        assert wet_laps.load_tyre_facts(race), race
