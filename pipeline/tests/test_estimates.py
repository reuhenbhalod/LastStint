"""Estimated fields (eras build plan 2.4): compounds, SC laps, fuel loads, provenance and the
Eras overlay hook. Offline: the Jolpica fixture dump (tests/fixtures/jolpica, Japan 2005 and
Abu Dhabi 2012), the committed F1DB stops (data/raw/f1db/japan-2005.stops.csv) and committed
FastF1 snapshots. Everything written goes to tmp_path; data/ is read only.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import (
    build,
    clean,
    cli,
    estimates,
    events,
    export,
    ingest,
    jolpica,
    paths,
    refuel,
)

FIXTURE = Path(__file__).parent / "fixtures" / "jolpica" / "csv-2026-10-24"
# Jolpica drivers with no usable repo code yet (step 2.6 adds them to data/drivers.json); the
# race file needs 2-4 letter codes, so the end-to-end builds give them test-only codes.
TEST_CODES = {
    "Michael Schumacher": "MSH",
    "Robert Doornbos": "DOR",
    "Christijan Albers": "ALBS",
    "Jean-Éric Vergne": "VRG",
}


@pytest.fixture(scope="module")
def drivers_json(tmp_path_factory) -> Path:
    drivers = dict(json.loads((paths.DATA_DIR / "drivers.json").read_text())["drivers"])
    drivers.update({code: {"name": name} for name, code in TEST_CODES.items()})
    path = tmp_path_factory.mktemp("drivers") / "drivers.json"
    path.write_text(json.dumps({"drivers": drivers}))
    return path


@pytest.fixture(scope="module")
def raw(drivers_json) -> dict[str, jolpica.Ingested]:
    japan_stops = jolpica.f1db_stops("japan-2005")
    return {
        "japan-2005": jolpica.load(
            2005, "japan", dump_dir=FIXTURE, stops=japan_stops, drivers_path=drivers_json
        ),
        "abu-dhabi-2012": jolpica.load(
            2012, "abu dhabi", dump_dir=FIXTURE, drivers_path=drivers_json
        ),
        "europe-1997": jolpica.load(1997, "european", dump_dir=FIXTURE, drivers_path=drivers_json),
    }


@pytest.fixture(scope="module")
def estimated(raw) -> dict[str, estimates.RaceEstimates]:
    years = {"japan-2005": 2005, "abu-dhabi-2012": 2012, "europe-1997": 1997}
    return {
        rid: estimates.estimate_race(rid, got.laps, years[rid], sidecar=got.sidecar)
        for rid, got in raw.items()
    }


# --- stops before 2011 -------------------------------------------------------------------


def test_f1db_stops_fill_stints_and_pit_times_for_japan_2005(raw):
    df = raw["japan-2005"].laps
    stops = pd.read_csv(paths.RAW_DIR / "f1db" / "japan-2005.stops.csv")
    assert raw["japan-2005"].sidecar["stops"] == "given"
    assert df["PitInTime"].notna().sum() == len(stops) == 36
    assert df["Stint"].notna().all() and df["TyreLife"].notna().all()
    # Every F1DB stop lands on its car's in-lap (matched by car number, not F1DB's codes).
    numbers = {r["number"]: r["driver"] for r in raw["japan-2005"].sidecar["results"]}
    for s in stops.itertuples():
        mine = df[(df["Driver"] == numbers[s.number]) & (df["LapNumber"] == s.lap)]
        assert mine["PitInTime"].notna().all(), s
    assert df["IsAccurate"].dtype == bool


def test_stops_by_number_rejects_an_unknown_car(drivers_json):
    stops = pd.DataFrame({"Number": ["99"], "Lap": [10], "Duration": [25.0]})
    with pytest.raises(ingest.IncompleteDataError, match="99"):
        jolpica.load(2005, "japan", dump_dir=FIXTURE, stops=stops, drivers_path=drivers_json)


def test_f1db_stops_missing_file_is_none(tmp_path):
    assert jolpica.f1db_stops("japan-2005", tmp_path) is None


# --- compounds ---------------------------------------------------------------------------


def test_one_dry_compound_before_2007(estimated):
    for rid in ("japan-2005", "europe-1997"):
        laps = estimated[rid].laps
        assert (laps["Compound"] == estimates.SINGLE).all()
        assert "compounds" in estimated[rid].block["estimated"]


def test_two_compounds_from_2007_honour_the_both_compounds_rule(estimated):
    laps = estimated["abu-dhabi-2012"].laps
    assert set(laps["Compound"]) == {estimates.OPTION, estimates.PRIME}
    per_driver = laps.groupby("Driver").agg(
        stints=("Stint", "nunique"), used=("Compound", "nunique")
    )
    assert (per_driver.loc[per_driver["stints"] >= 2, "used"] == 2).all()
    # One compound per stint.
    assert (laps.groupby(["Driver", "Stint"])["Compound"].nunique() == 1).all()
    stints = estimated["abu-dhabi-2012"].block["compounds"]["stints"]
    assert {s["by"] for s in stints} <= {"pace", "rule", "default", "q3"}


ABU_DHABI_2012_OPTION_START = {"HAM", "WEB", "MAL", "RAI", "BUT", "ALO", "ROS", "MAS", "GRO"}


def test_option_starters_are_q3_cars_that_started_in_the_top_ten(raw):
    side = raw["abu-dhabi-2012"].sidecar
    starters, why = estimates.option_starters(2012, side)
    # VET was in Q3 but excluded (grid 24, a pit-lane start: free choice); HUL started 10th
    # without a Q3 time.
    assert starters == ABU_DHABI_2012_OPTION_START and why is None


@pytest.mark.parametrize("year", [2009, 2014, 2020])
def test_no_q3_tyre_rule_outside_2010_2013(raw, year):
    assert estimates.option_starters(year, raw["abu-dhabi-2012"].sidecar) == (None, None)


def test_a_sidecar_without_q3_says_the_rule_wasnt_applied(raw):
    side = {k: v for k, v in raw["abu-dhabi-2012"].sidecar.items() if k != "q3"}
    starters, why = estimates.option_starters(2012, side)
    assert starters is None and "re-ingest" in why
    block = estimates.estimate_race(
        "abu-dhabi-2012", raw["abu-dhabi-2012"].laps, 2012, sidecar=side
    ).block
    assert any(n.startswith("Q3 tyre rule not applied") for n in block["compounds"]["notes"])
    assert all(s["by"] != "q3" for s in block["compounds"]["stints"])


def test_the_top_ten_start_on_the_option_from_2010_to_2013(estimated):
    est = estimated["abu-dhabi-2012"]
    stints = est.block["compounds"]["stints"]
    first = {}
    for s in sorted(stints, key=lambda s: s["stint"]):
        first.setdefault(s["driver"], s)
    for driver in ABU_DHABI_2012_OPTION_START:
        assert (first[driver]["compound"], first[driver]["by"]) == (estimates.OPTION, "q3")
    assert sum(s["by"] == "q3" for s in stints) == len(ABU_DHABI_2012_OPTION_START)
    # The laps carry it, and a car that stopped still runs both compounds.
    laps = est.laps
    ham = laps[(laps["Driver"] == "HAM") & (laps["Stint"] == laps["Stint"].min())]
    assert (ham["Compound"] == estimates.OPTION).all()
    used = laps.groupby("Driver").agg(stints=("Stint", "nunique"), used=("Compound", "nunique"))
    assert (used.loc[used["stints"] >= 2, "used"] == 2).all()
    assert "Q3 tyre rule" in est.block["compounds"]["method"]
    assert any("top-ten first stints set to SOFT" in n for n in est.block["compounds"]["notes"])


def test_a_forced_stint_never_flips():
    scores = pd.DataFrame(
        {
            "Driver": ["AAA", "AAA", "AAA"],
            "Stint": [1.0, 2.0, 3.0],
            "softness": [1.0, 3.0, 2.0],
        }
    )
    # The median is 0.75, so AAA's three stints all score SOFT and one must flip to HARD.
    # Stint 1 is the closest to HARD, but the Q3 rule fixed it: stint 3 (the closer of the
    # two free ones) flips.
    others = pd.DataFrame(
        {"Driver": ["BBB"] * 3, "Stint": [1.0, 2.0, 3.0], "softness": [-3.0, -2.0, 0.5]}
    )
    label, why = estimates.assign_two_compounds(
        pd.concat([scores, others]), {("AAA", 1.0): estimates.OPTION}
    )
    assert (label[("AAA", 1.0)], why[("AAA", 1.0)]) == ("SOFT", "q3")
    assert label[("AAA", 2.0)] == "SOFT"
    assert (label[("AAA", 3.0)], why[("AAA", 3.0)]) == ("HARD", "rule")


def test_a_forced_first_stint_overrides_the_fit():
    """Two cars, a long first stint each (the fit calls it the prime); the Q3 rule puts AAA's
    on the option and the both-compounds rule then makes its second stint the prime."""
    rows = []
    for driver in ("AAA", "BBB"):
        for n in range(1, 41):
            stint = 1 if n <= 30 else 2
            age = n if stint == 1 else n - 30
            rows.append(
                {
                    **dict.fromkeys(ingest.LAP_COLUMNS),
                    "Driver": driver,
                    "LapNumber": float(n),
                    "LapTime": 90.0 + 0.05 * age,
                    "Stint": float(stint),
                    "TyreLife": float(age),
                    "TrackStatus": "1",
                    "IsAccurate": True,
                }
            )
    laps = pd.DataFrame(rows)
    plain = estimates.estimate_compounds(laps, 2011, 1.7, False)
    assert {(s["driver"], s["stint"]): s["compound"] for s in plain.stints}[("AAA", 1)] == "HARD"
    got = estimates.estimate_compounds(laps, 2011, 1.7, False, {"AAA", "ZZZ"})
    label = {(s["driver"], s["stint"]): (s["compound"], s["by"]) for s in got.stints}
    assert label[("AAA", 1)] == ("SOFT", "q3") and label[("AAA", 2)][0] == "HARD"
    assert label[("BBB", 1)][0] == "HARD"  # not a Q3 starter: as fitted
    assert "1 top-ten first stints set to SOFT by the Q3 tyre rule (1 the fit" in got.notes[0]


def test_real_compounds_are_never_relabelled():
    laps = pd.read_parquet(ingest.raw_snapshot_path("abu-dhabi-2021"))
    got = estimates.estimate_compounds(laps, 2021, 1.7, False)
    assert not got.estimated
    pd.testing.assert_frame_equal(got.laps, laps)
    block = estimates.estimate_race("abu-dhabi-2021", laps, 2021).block
    assert block["estimated"] == []  # real track status and compounds: nothing estimated


def test_two_compounds_need_the_stops():
    laps = pd.DataFrame(
        {c: [None] for c in ingest.LAP_COLUMNS} | {"Driver": ["AAA"], "LapNumber": [1.0]}
    )
    with pytest.raises(ValueError, match="needs the stops"):
        estimates.estimate_compounds(laps, 2008, 1.7, True)


def test_compound_estimate_on_a_race_with_real_compounds():
    """Saudi Arabia 2022 (MEDIUM / HARD, FastF1): blank the compounds, estimate them, and most
    stints get the right one of the two (79% over the 2018-2025 two-compound races)."""
    laps = pd.read_parquet(ingest.raw_snapshot_path("saudi-arabia-2022"))
    real = laps.groupby(["Driver", "Stint"])["Compound"].agg(lambda c: c.mode()[0])
    got = estimates.estimate_compounds(laps.assign(Compound=None), 2022, 1.7, False).laps
    guess = got.groupby(["Driver", "Stint"])["Compound"].first()
    softer = real == "MEDIUM"
    right = (guess.reindex(real.index) == estimates.OPTION) == softer
    assert right.mean() >= 0.8


def test_the_shorter_stint_scores_softer():
    """Two cars, a short and a long stint each: the short ones are the option."""
    rows = []
    for driver, stop in (("AAA", 12), ("BBB", 30)):
        for n in range(1, 41):
            stint = 1 if n <= stop else 2
            age = n if stint == 1 else n - stop
            rows.append(
                {
                    **dict.fromkeys(ingest.LAP_COLUMNS),
                    "Driver": driver,
                    "LapNumber": float(n),
                    "LapTime": 90.0 + 0.05 * age,
                    "Stint": float(stint),
                    "TyreLife": float(age),
                    "TrackStatus": "1",
                    "IsAccurate": True,
                }
            )
    got = estimates.estimate_compounds(pd.DataFrame(rows), 2010, 1.7, False)
    label = {(s["driver"], s["stint"]): s["compound"] for s in got.stints}
    assert label[("AAA", 1)] == estimates.OPTION and label[("AAA", 2)] == estimates.PRIME
    assert label[("BBB", 2)] == estimates.OPTION and label[("BBB", 1)] == estimates.PRIME


def test_both_compounds_rule_flips_the_closest_stint():
    scores = pd.DataFrame(
        {
            "Driver": ["AAA", "AAA", "BBB", "BBB"],
            "Stint": [1.0, 2.0, 1.0, 2.0],
            "softness": [2.0, 1.0, -1.0, -2.0],
        }
    )
    label, why = estimates.assign_two_compounds(scores)
    # The threshold is the median (0): AAA's stints both score soft, BBB's both hard; each
    # car's stint nearest the threshold flips.
    assert (label[("AAA", 1.0)], label[("AAA", 2.0)]) == ("SOFT", "HARD")
    assert (label[("BBB", 1.0)], label[("BBB", 2.0)]) == ("SOFT", "HARD")
    assert why[("AAA", 2.0)] == why[("BBB", 1.0)] == "rule"
    assert why[("AAA", 1.0)] == why[("BBB", 2.0)] == "pace"


def test_unscored_stints_take_the_compound_the_car_still_needs():
    scores = pd.DataFrame(
        {
            "Driver": ["AAA", "AAA", "BBB"],
            "Stint": [1.0, 2.0, 1.0],
            "softness": [1.0, np.nan, -1.0],
        }
    )
    label, why = estimates.assign_two_compounds(scores)
    assert label[("AAA", 1.0)] == "SOFT" and label[("AAA", 2.0)] == "HARD"
    assert why[("AAA", 2.0)] == "default"


# --- safety cars -------------------------------------------------------------------------


def test_sc_periods_detected_on_real_races(estimated):
    def spans(rid):
        return [(p["startLap"], p["endLap"], p["confidence"]) for p in estimated[rid].periods]

    # Japan 2005: the SC after Montoya's lap-1 crash; Abu Dhabi 2012: the lap-8 Rosberg /
    # Karthikeyan crash and the lap-38 Perez / Grosjean / Webber one. (Owner hand-check.)
    assert spans("japan-2005") == [(2, 7, "likely")]
    assert spans("abu-dhabi-2012") == [(9, 14, "likely"), (39, 42, "likely")]
    assert spans("europe-1997") == []
    assert all(p["status"] == "unchecked" for r in estimated.values() for p in r.periods)


def test_detected_sc_fills_track_status_and_events(estimated):
    est = estimated["abu-dhabi-2012"]
    laps = est.laps
    assert laps["TrackStatus"].notna().all()
    assert set(laps["TrackStatus"]) <= {"1", "4", "14", "41"}
    assert events.neutralization_events(laps) == [
        {"lap": 9, "type": "SC", "laps": 6},
        {"lap": 39, "type": "SC", "laps": 4},
    ]
    assert [r["status"] for r in est.status] == ["1", "4", "1", "4", "1"]
    lead = events.leader_laps(laps).set_index("LapNumber")["Time"]
    assert est.status[1]["time"] == pytest.approx(lead[8], abs=1e-3)
    # The pace fit now sees green laps (before, Jolpica's empty status dropped every lap).
    clean_df, _, log = clean.clean_laps(laps)
    assert log["clean"] > 500 and clean.is_green(clean_df).all()


def _field(ratios: list[float], spread: list[float], n_cars: int = 8) -> pd.DataFrame:
    """A synthetic race: each lap's time is ratio x 90 s for every car; car i finishes the lap
    spread[lap] * i / (n_cars - 1) behind the leader."""
    rows = []
    elapsed = 0.0
    for lap, (ratio, gap) in enumerate(zip(ratios, spread, strict=True), start=1):
        elapsed += 90.0 * ratio
        for i in range(n_cars):
            rows.append(
                {
                    **dict.fromkeys(ingest.LAP_COLUMNS),
                    "Driver": f"C{i}",
                    "LapNumber": float(lap),
                    "LapTime": 90.0 * ratio,
                    "Time": elapsed + gap * i / (n_cars - 1),
                    "Position": float(i + 1),
                    "Stint": 1.0,
                    "TyreLife": float(lap),
                    "IsAccurate": True,
                }
            )
    return pd.DataFrame(rows, columns=ingest.LAP_COLUMNS)


def test_rain_like_slowdown_is_ambiguous_and_applied_as_yellow():
    # Laps 10-14 15% slow while the field spreads out: rain, not a safety car.
    ratios = [1.0] * 9 + [1.15] * 5 + [1.0] * 10
    spread = [10.0 + 0.5 * n for n in range(24)]
    laps = _field(ratios, spread)
    (period,) = estimates.detect_neutralizations(laps)
    assert (period["startLap"], period["endLap"]) == (10, 14)
    assert period["confidence"] == "ambiguous"
    assert any("rain" in r for r in period["reasons"])
    applied, status = estimates.apply_neutralizations(laps, [period])
    assert set(applied.loc[applied["LapNumber"].between(11, 13), "TrackStatus"]) == {"2"}
    assert events.neutralization_events(applied) == []  # no frozen SC from an ambiguous one
    assert [r["status"] for r in status] == ["1", "2", "1"]


def test_sc_like_slowdown_is_likely():
    ratios = [1.0] * 9 + [1.2, 1.6, 1.6, 1.6, 1.3] + [1.0] * 10
    spread = [20.0] * 9 + [15.0, 5.0, 3.0, 3.0, 4.0] + [6.0] * 10
    (period,) = estimates.detect_neutralizations(_field(ratios, spread))
    assert (period["startLap"], period["endLap"], period["confidence"]) == (10, 14, "likely")
    # P1-P6 of 8 cars: 5/7 of the spread.
    assert period["gapBefore"] == round(20.0 * 5 / 7, 1)
    assert period["gapAfter"] == round(3.0 * 5 / 7, 1)


def test_red_flag_and_single_slow_laps_are_flagged():
    ratios = [1.0] * 9 + [4.0] + [1.0] * 10 + [1.13] + [1.0] * 5
    spread = [20.0] * 26
    first, second = estimates.detect_neutralizations(_field(ratios, spread))
    assert first["confidence"] == "ambiguous" and any("red flag" in r for r in first["reasons"])
    assert second["laps"] == 1 and any("single" in r for r in second["reasons"])


def test_hand_checks_are_kept_and_rejected_periods_not_applied(estimated, tmp_path):
    est = estimated["abu-dhabi-2012"]
    path = estimates.write_hand_checks("abu-dhabi-2012", est.periods, tmp_path)
    doc = json.loads(path.read_text())
    assert doc["race"] == "abu-dhabi-2012" and "2.4-estimates.md" in doc["how"]
    doc["periods"][0]["status"] = "rejected"
    doc["periods"][1].update(status="confirmed", startLap=38)
    path.write_text(json.dumps(doc))
    checks = estimates.load_hand_checks("abu-dhabi-2012", tmp_path)
    merged = estimates.merge_hand_checks(est.periods, checks)
    assert [(p["startLap"], p["status"]) for p in merged] == [(9, "rejected"), (38, "confirmed")]
    laps, status = estimates.apply_neutralizations(est.laps.assign(TrackStatus=None), merged)
    assert events.neutralization_events(laps) == [{"lap": 38, "type": "SC", "laps": 5}]


def test_an_owner_added_period_is_applied_and_reported(estimated):
    est = estimated["europe-1997"]  # no SC detected
    added = [{"startLap": 20, "endLap": 22, "kind": "RED", "status": "confirmed"}]
    merged = estimates.merge_hand_checks(est.periods, added)
    laps, _ = estimates.apply_neutralizations(est.laps.assign(TrackStatus=None), merged)
    assert events.neutralization_events(laps) == [{"lap": 20, "type": "RED", "laps": 3}]
    block = {**est.block, "safetyCars": {**est.block["safetyCars"], "periods": merged}}
    assert "    laps 20-22 RED, confirmed" in estimates.report_lines(block)


@pytest.mark.parametrize("laps", [(None, 3), (5, 4), (0, 2)])
def test_hand_check_laps_must_make_sense(laps):
    bad = [{"startLap": laps[0], "endLap": laps[1], "status": "confirmed"}]
    with pytest.raises(ValueError, match="startLap"):
        estimates.merge_hand_checks([], bad)


def test_hand_check_status_must_be_known():
    bad = [{"startLap": 1, "endLap": 2, "status": "maybe"}]
    with pytest.raises(ValueError, match="maybe"):
        estimates.merge_hand_checks([], bad)


# --- fuel loads --------------------------------------------------------------------------


def test_fuel_loads_are_stint_laps_times_the_burn(estimated):
    block = estimated["japan-2005"].block
    fuel = block["fuelLoads"]
    assert "fuelLoads" in block["estimated"] and fuel["unit"] == "kg"
    assert fuel["burnPerLap"] == estimates.burn_per_lap("1994-2009") == 1.7
    for s in fuel["stints"]:
        assert s["fuelKg"] == pytest.approx(s["laps"] * 1.7, abs=0.05)
    rai = [s for s in fuel["stints"] if s["driver"] == "RAI"]
    assert sum(s["laps"] for s in rai) == 53 and len(rai) == 3


def test_the_fill_rate_is_labelled_an_estimate(estimated):
    """A refuelling race's fill rate (refuel.py's physical prior) is listed with its fuel
    loads, so the race file's provenance (fuelLoads) covers it, and the report says so."""
    block = estimated["japan-2005"].block
    assert block["fuelLoads"]["fillRate"] == refuel.FILL_RATE_METHOD
    assert "an estimate, 0.25 s per lap of fuel" in block["fuelLoads"]["fillRate"]
    assert estimates.provenance(block["estimated"])["estimated"] == [
        "compounds",
        "safetyCars",
        "fuelLoads",
    ]
    assert refuel.FILL_RATE_METHOD in "\n".join(estimates.report_lines(block))


def test_no_fuel_loads_without_refuelling(estimated):
    assert "fuelLoads" not in estimated["abu-dhabi-2012"].block
    assert "fuelLoads" not in estimated["abu-dhabi-2012"].block["estimated"]


def test_burn_per_lap_needs_an_era_block(tmp_path):
    path = tmp_path / "headset.json"
    path.write_text("{}")
    with pytest.raises(KeyError, match="1994-2009"):
        estimates.burn_per_lap("1994-2009", path)


def test_era_for_year():
    assert [estimates.era_for_year(y) for y in (1990, 1994, 2009, 2010, 2013, 2014, 2026)] == [
        "1988-1993",
        "1994-2009",
        "1994-2009",
        "2010-2013",
        "2010-2013",
        "2014-2025",
        "2026+",
    ]


# --- quirks ------------------------------------------------------------------------------


def _check(diffs: dict[str, float]) -> list[dict]:
    return [
        {"driver": d, "position": i + 1, "official": 5000.0 + i, "summed": None, "diff": v}
        for i, (d, v) in enumerate(diffs.items())
    ]


def test_quirks_flag_a_time_rounded_to_a_tenth():
    """Hungary 1998: MSC's 1:45:26.4 is rounded, every lead-lap finisher is 0.849 s off."""
    results = [{"driver": "MSC", "position": 1, "time": 6326.4}]
    quirks = estimates.time_quirks(_check({"MSC": -0.849, "COU": -0.849, "VIL": -0.849}), results)
    assert any("rounded to 0.1s" in q for q in quirks)
    assert any("-0.849s off" in q for q in quirks)
    assert not any("penalty" in q for q in quirks)


@pytest.mark.parametrize(
    ("driver", "diff", "what"),
    [
        ("MAL", -20.0, "post-race time penalty"),  # Europe 2012
        ("VER", -5.0, "post-race time penalty"),  # Saudi Arabia 2021
        ("OCO", -5.0, "post-race time penalty"),  # Monaco 2022
        ("KOV", 25.0, "timing gap"),  # Brazil 2009
    ],
)
def test_quirks_flag_post_race_penalties(driver, diff, what):
    results = [{"driver": "AAA", "position": 1, "time": 5000.123}]
    quirks = estimates.time_quirks(_check({"AAA": 0.0, "BBB": 0.0, driver: diff}), results)
    (q,) = quirks
    assert q.startswith(driver) and what in q


def test_no_quirks_on_a_clean_race(estimated):
    assert estimated["abu-dhabi-2012"].block["quirks"] == []


# --- provenance and the overlay ----------------------------------------------------------


def test_provenance_merges_the_overlay():
    assert estimates.provenance([]) is None
    assert estimates.provenance(["safetyCars", "compounds"]) == {
        "kind": "real",
        "estimated": ["compounds", "safetyCars"],
    }
    merged = estimates.provenance(["compounds"], {"kind": "real", "estimated": ["weather"]})
    assert merged == {"kind": "real", "estimated": ["compounds", "weather"]}
    with pytest.raises(ValueError, match="tyres"):
        estimates.provenance(["tyres"])


def test_lap_time_weather_is_listed_as_estimated_but_a_rain_gauge_is_not():
    assert build.lap_time_weather([{"lap": 1, "time": 90.0, "rain": True, "source": "lap-times"}])
    assert not build.lap_time_weather([{"time": 150.0, "rain": True, "track": 30.0}])
    assert not build.lap_time_weather(None)
    assert not build.lap_time_weather([])


@pytest.fixture(scope="module")
def base_model() -> dict:
    return json.loads((paths.RACES_DIR / "abu-dhabi-2021.json").read_text())


def test_apply_eras_without_anything_is_the_same_model(base_model):
    model, lines = build.apply_eras(base_model, [], None)
    assert model is base_model and lines == []


def test_apply_eras_applies_all_four_overlay_keys(base_model, tmp_path):
    sc = next(e for e in base_model["events"] if e["type"] == "SC")
    overlay = {
        "eras": {"eraId": 1, "order": 1, "userSide": "HAM"},
        "provenance": {"kind": "real", "estimated": ["weather"]},
        "rules": {"vsc": True},
        "storylineEvents": [[sc["lap"], "SC"]],
    }
    (tmp_path / "abu-dhabi-2021.json").write_text(json.dumps(overlay))
    loaded = build.load_overlay("abu-dhabi-2021", tmp_path)
    model, lines = build.apply_eras(base_model, ["safetyCars"], loaded)
    assert model["eras"] == overlay["eras"] and model["rules"] == {"vsc": True}
    assert model["provenance"] == {"kind": "real", "estimated": ["safetyCars", "weather"]}
    assert any(e.get("storylineEvent") for e in model["events"] if e["lap"] == sc["lap"])
    assert lines == ["overlay: eras, provenance, rules, storylineEvents"]
    assert "provenance" not in base_model  # a copy


def test_overlay_with_an_unknown_key_is_an_error(tmp_path):
    (tmp_path / "x-2000.json").write_text(json.dumps({"eras": {}, "rule": {}}))
    with pytest.raises(ValueError, match="rule"):
        build.load_overlay("x-2000", tmp_path)
    assert build.load_overlay("y-2000", tmp_path) is None


def test_existing_races_build_unchanged_without_an_overlay(tmp_path):
    result = build.build_race("abu-dhabi-2021", eras_dir=tmp_path)
    assert result.estimates == []
    assert "provenance" not in result.model
    plain = build.build_race("abu-dhabi-2021", eras_dir=tmp_path / "none")
    assert json.dumps(result.model) == json.dumps(plain.model)
    # The committed file differs only by the schema version (10: not rebuilt since v11).
    committed = json.loads((paths.RACES_DIR / "abu-dhabi-2021.json").read_text())
    rebuilt = json.loads(json.dumps(result.model))
    assert {**rebuilt, "schemaVersion": committed["schemaVersion"]} == committed


# --- end to end: ingest + build into a temp dir ------------------------------------------


@pytest.fixture(scope="module")
def built(tmp_path_factory, drivers_json) -> dict:
    root = tmp_path_factory.mktemp("eras-build")
    raw_dir, checks = root / "raw", root / "estimates"
    out = {}
    for rid, year, event in (("japan-2005", 2005, "japan"), ("abu-dhabi-2012", 2012, "abu dhabi")):
        stops = jolpica.f1db_stops(rid) if year < jolpica.STOPS_FROM else None
        jolpica.ingest_jolpica(
            rid,
            year,
            event,
            dump_dir=FIXTURE,
            raw_dir=raw_dir,
            stops=stops,
            stops_source="f1db",
            drivers_path=drivers_json,
            estimate=True,
            estimates_dir=checks,
        )
        out[rid] = build.build_race(rid, raw_dir=raw_dir, eras_dir=root / "eras")
    return {"root": root, "results": out}


def test_e2e_japan_2005(built):
    result = built["results"]["japan-2005"]
    model = result.model
    export.validate_model(model)
    assert model["era"] == "1994-2009"
    assert model["provenance"] == {
        "kind": "real",
        "estimated": ["compounds", "safetyCars", "fuelLoads"],
    }
    assert model["fuelEffectPerLap"] == build.REFUELLING_FUEL
    assert result.estimates[0] == "estimated: compounds, safetyCars, fuelLoads"
    assert any("laps 2-7 SC likely, unchecked" in line for line in result.estimates)
    assert any("fuel loads: 56 stints" in line for line in result.estimates)
    side = json.loads(jolpica.sidecar_path("japan-2005", built["root"] / "raw").read_text())
    assert side["stops"] == "f1db" and side["estimates"]["estimated"][0] == "compounds"
    checks_path = estimates.sc_check_path("japan-2005", built["root"] / "estimates")
    checks = json.loads(checks_path.read_text())
    assert [p["status"] for p in checks["periods"]] == ["unchecked"]


def test_e2e_abu_dhabi_2012(built):
    result = built["results"]["abu-dhabi-2012"]
    model = result.model
    export.validate_model(model)
    assert model["era"] == "2010-2013"
    assert model["provenance"] == {"kind": "real", "estimated": ["compounds", "safetyCars"]}
    assert {c for c in model["compounds"]} == {"SOFT", "HARD"}
    # Registered (step 3.1c) with the takeover pinned to lap 8, before the lap-9 SC, so both
    # estimated SCs are played.
    assert model["race"]["takeoverLap"] == 8
    assert [e for e in model["events"] if e["type"] == "SC"] == [
        {"lap": 9, "type": "SC", "laps": 6},
        {"lap": 39, "type": "SC", "laps": 4},
    ]
    assert model["fuelEffectPerLap"] > 0
    assert sum("SC likely" in line for line in result.estimates) == 2
    status = ingest.load_track_status("abu-dhabi-2012", built["root"] / "raw")
    assert [r["status"] for r in status] == ["1", "4", "1", "4", "1"]


def test_cli_build_prints_the_estimates(built, tmp_path):
    root = built["root"]
    args = ["build", "abu-dhabi-2012", "--raw-dir", str(root / "raw"), "--out", str(tmp_path)]
    result = CliRunner().invoke(cli.app, [*args, "--eras-dir", str(root / "eras")])
    assert result.exit_code == 0, result.output
    assert "estimated: compounds, safetyCars" in result.output
    assert "laps 39-42 SC likely" in result.output
    assert (tmp_path / "abu-dhabi-2012.json").exists()
    assert (tmp_path / "golden" / "abu-dhabi-2012.json").exists()


def test_cli_build_reports_a_bad_overlay(built, tmp_path):
    root = built["root"]
    (tmp_path / "abu-dhabi-2012.json").write_text(json.dumps({"storylineEvents": [[3, "SC"]]}))
    args = ["build", "abu-dhabi-2012", "--raw-dir", str(root / "raw"), "--out", str(tmp_path)]
    result = CliRunner().invoke(cli.app, [*args, "--eras-dir", str(tmp_path)])
    assert result.exit_code == 1
    assert "no SC event on lap 3" in result.output


def test_cli_build_refuses_an_unknown_race(tmp_path):
    result = CliRunner().invoke(cli.app, ["build", "nowhere-1999", "--raw-dir", str(tmp_path)])
    assert result.exit_code != 0
    assert "unknown race" in result.output


def test_cli_jolpica_estimates_and_writes_the_hand_check(tmp_path):
    args = [
        "jolpica",
        "japan-2005",
        "--dump",
        str(FIXTURE),
        "--raw-dir",
        str(tmp_path / "raw"),
        "--estimates-dir",
        str(tmp_path / "estimates"),
    ]
    result = CliRunner().invoke(cli.app, args)
    assert result.exit_code == 0, result.output
    assert "stops: f1db" in result.output
    assert "estimated: compounds, safetyCars, fuelLoads" in result.output
    assert estimates.sc_check_path("japan-2005", tmp_path / "estimates").exists()
    laps = pd.read_parquet(ingest.raw_snapshot_path("japan-2005", tmp_path / "raw"))
    assert laps["Compound"].eq("MEDIUM").all() and laps["Stint"].max() == 4


def test_cli_jolpica_warns_without_f1db_stops(tmp_path):
    args = ["jolpica", "japan-2005", "--dump", str(FIXTURE), "--raw-dir", str(tmp_path)]
    args += ["--f1db-dir", str(tmp_path), "--no-estimate"]
    result = CliRunner().invoke(cli.app, args)
    assert result.exit_code == 0, result.output
    assert "no F1DB stops" in result.output
