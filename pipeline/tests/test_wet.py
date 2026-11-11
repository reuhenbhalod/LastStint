"""Weather (wet.py): the curves' shape, the timeline fit, and the sims' wet lap."""

import numpy as np
import pandas as pd

from pipeline import wet
from pipeline.sim_reference import Car, _clean_lap, weather_wear, wet_penalty

CURVES = wet.load_curves()


def test_curves_cross_over_like_real_races():
    w = np.linspace(0, 1, 101)
    slick = wet.penalty(CURVES, "SOFT", w)
    inter = wet.penalty(CURVES, "INTERMEDIATE", w)
    wets = wet.penalty(CURVES, "WET", w)
    # Dry: slicks win, inters several % off. Damp: inters take over once slicks are ~5-8%
    # off, and stay ahead from then on. Soaked: full wets beat inters.
    assert slick[0] == 0 and inter[0] > 0.06
    cross = int(np.argmax(inter < slick))
    assert 0.03 < slick[cross] < 0.12
    assert (inter[cross:] <= slick[cross:]).all()
    assert wets[-1] < inter[-1]


def test_the_timeline_follows_the_laps():
    # A dry race that turns wet: slicks lose ~15% from lap 6, then everyone's on inters.
    s_wet = float(wet.penalty(CURVES, "SOFT", 0.3))
    i_wet = float(wet.penalty(CURVES, "INTERMEDIATE", 0.3))
    rows = [(lap, "slick", 0.0, 18) for lap in range(1, 6)]
    rows += [(6, "slick", s_wet, 18), (7, "slick", s_wet, 18)]
    rows += [(lap, "inter", i_wet, 18) for lap in range(8, 13)]
    obs = pd.DataFrame(rows, columns=["lap", "cls", "median", "count"])
    w = wet.timeline(obs, 12, set(range(6, 13)), CURVES)
    assert max(w[:4]) <= 0.02 and w[4] < 0.06  # the lap before eases in (smooth)
    assert all(0.2 <= x <= 0.4 for x in w[6:])


def test_an_eras_timeline_puts_an_inters_only_lap_on_the_wet_side():
    # A dry race with a late shower: the field stays on slicks to lap 10, then runs inters
    # whose laps fit the inter curve on either side of its best. Eras builds (wet_side) read
    # the inters-only laps as at least the slick / inter crossover; other builds as before.
    curves = wet.load_curves(eras=True)
    cross = wet.crossover(curves)
    best = curves["inter"]["best"]
    assert 0.0 < cross < best
    dry_side = float(wet.penalty(curves, "INTERMEDIATE", 0.08))
    rows = [(lap, "slick", 0.0, 18) for lap in range(1, 11)]
    rows += [(lap, "inter", dry_side, 18) for lap in range(11, 17)]
    obs = pd.DataFrame(rows, columns=["lap", "cls", "median", "count"])
    plain = wet.timeline(obs, 16, set(range(11, 17)), curves)
    eras = wet.timeline(obs, 16, set(range(11, 17)), curves, wet_side=True)
    assert max(plain[11:]) < cross  # the dry side: slicks would beat inters there
    assert min(eras[11:]) >= cross and max(eras[:9]) <= 0.02
    # A lap with a slick car on it is left to the lap times.
    mixed = [*rows, *((lap, "slick", 0.1, 2) for lap in range(11, 17))]
    obs = pd.DataFrame(mixed, columns=["lap", "cls", "median", "count"])
    assert wet.timeline(obs, 16, set(range(11, 17)), curves, wet_side=True) == wet.timeline(
        obs, 16, set(range(11, 17)), curves
    )


def test_python_sim_wet_lap_and_wear_match_the_pipeline():
    weather = {"curves": CURVES, "wetness": [0.0, 0.3]}
    assert wet_penalty(weather, "SOFT", 2) == float(wet.penalty(CURVES, "SOFT", 0.3))
    assert wet_penalty(weather, "INTERMEDIATE", 1) == float(
        wet.penalty(CURVES, "INTERMEDIATE", 0.0)
    )
    for comp in ("SOFT", "INTERMEDIATE", "WET"):
        for lap, w in ((1, 0.0), (2, 0.3)):
            assert weather_wear(weather, comp, lap) == wet.wear_mult(comp, w)
    car = Car(code="HAM", base_pace=90.0, noise=0, compound="MEDIUM", tyre_age=5, total_time=0)
    compounds = {"MEDIUM": {"offset": 0.0, "degPerLap": 0.05, "cliffLap": 30}}
    dry = _clean_lap(car, compounds, 0.05, 2)
    assert _clean_lap(car, compounds, 0.05, 2, None, weather) == dry * (
        1 + wet_penalty(weather, "MEDIUM", 2)
    )


# Model fix M1 (Eras builds): driver pace by track state, and the race's full wets vs inters.


def _band_race(traffic_gap: float = 5.0):
    """Six cars, 20 laps on inters: laps 2-10 damp (0.08), 11-20 wet (0.3). Car A is 2% quicker
    than the field on the wet laps only; car T runs `traffic_gap` behind A and 3% slower."""
    from pipeline.fit import LapTimeFit

    wetness = [0.08] * 10 + [0.3] * 10
    weather = {"curves": CURVES, "wetness": wetness}
    cars = ["A", "B", "C", "D", "E", "T"]
    fitted = LapTimeFit(
        driver_pace={c: 80.0 for c in cars},
        driver_noise={c: 0.3 for c in cars},
        compound_offset={"INTERMEDIATE": 0.0},
        compound_wear={"INTERMEDIATE": 0.0},
        fuel_per_lap=0.0,
        reference_compound="INTERMEDIATE",
        r_squared=1.0,
        n_obs=1,
    )
    rng = np.random.default_rng(1)
    rows, t = [], {c: 0.0 for c in cars}
    for lap in range(1, 21):
        w = wetness[lap - 1]
        base = 80.0 * (1 + float(wet.penalty(CURVES, "INTERMEDIATE", w)))
        for i, c in enumerate(cars):
            extra = -0.02 if (c == "A" and w >= wet.DAMP_EDGE) else 0.0
            extra += 0.03 if c == "T" else 0.0
            lt = base * (1 + extra + rng.normal(0, 0.002))
            t[c] = (lap * 100.0 + i * 10.0) if c != "T" else (lap * 100.0 + traffic_gap)
            rows.append(
                {
                    "Driver": c,
                    "LapNumber": lap,
                    "LapTime": lt,
                    "Time": t[c],
                    "Position": i + 1 if c != "T" else 1.5,
                    "Compound": "INTERMEDIATE",
                    "TyreLife": float(lap),
                    "Stint": 1,
                    "TrackStatus": "1",
                    "IsAccurate": True,
                    "PitInTime": np.nan,
                    "PitOutTime": np.nan,
                }
            )
    laps = pd.DataFrame(rows)
    laps.loc[laps["Driver"] == "T", "Position"] = 2  # just behind A on the road
    laps.loc[(laps["Driver"] != "T") & (laps["Position"] >= 2), "Position"] += 1
    return laps, weather, fitted


def test_driver_band_pace_splits_damp_and_wet_and_shrinks_to_the_field():
    laps, weather, fitted = _band_race()
    wet_pace, damp_pace = wet.driver_band_pace(laps, weather, fitted)
    # A: quicker in the wet only, shrunk a little (prior), and its damp pace near the field's.
    assert -0.024 < wet_pace["A"] < -0.012  # 2% of an inter lap: 2.4% of a dry one
    assert damp_pace["A"] > wet_pace["A"] + 0.005
    for c in "BCDE":
        assert abs(wet_pace[c]) < 0.006 and abs(damp_pace[c]) < 0.006


def test_driver_band_pace_leaves_out_traffic_and_restart_laps():
    laps, weather, fitted = _band_race(traffic_gap=0.8)  # T within 1.5 s of A: dirty air
    _, damp_pace = wet.driver_band_pace(laps, weather, fitted)
    assert "T" not in damp_pace
    laps2, *_ = _band_race(traffic_gap=5.0)
    laps2.loc[laps2["LapNumber"] == 12, "TrackStatus"] = "4"  # an SC lap: it and the next out
    res = wet.band_residuals(laps2, weather, fitted)
    assert not res["lap"].isin([1, 12, 13]).any()
    assert res["lap"].isin([2, 11, 14]).any()


def test_wet_tyre_shift_needs_both_tyres_on_track():
    laps, weather, fitted = _band_race()
    assert wet.wet_tyre_shift(laps, weather, fitted) == 0.0  # inters only: can't tell
    # Cars D, E, T on full wets from lap 11, 1% quicker than the curves say against inters.
    late = (laps["LapNumber"] >= 11) & laps["Driver"].isin(["D", "E", "T"])
    w = 0.3
    ratio = (1 + float(wet.penalty(CURVES, "WET", w)) - 0.01) / (
        1 + float(wet.penalty(CURVES, "INTERMEDIATE", w))
    )
    laps.loc[late, "Compound"] = "WET"
    laps.loc[late, "LapTime"] *= ratio
    shift = wet.wet_tyre_shift(laps, weather, fitted)
    assert -0.01 < shift < -0.005  # ten laps, shrunk by three
    shifted = wet.shifted_curves(CURVES, shift)
    assert shifted["wet"]["min"] == round(CURVES["wet"]["min"] + shift, 4)
    assert shifted["inter"] == CURVES["inter"] and CURVES["wet"]["min"] != shifted["wet"]["min"]


def test_python_sim_takes_damp_pace_under_the_edge():
    from pipeline.sim_reference import DAMP_EDGE, driver_wet

    assert DAMP_EDGE == wet.DAMP_EDGE
    car = Car(
        code="A",
        base_pace=80.0,
        noise=0,
        compound="INTERMEDIATE",
        tyre_age=1,
        total_time=0,
        wet_pace=0.02,
    )
    assert driver_wet(car, 0.05) == 0.02  # no damp pace: the wet pace everywhere
    car.damp_pace = -0.01
    assert driver_wet(car, 0.05) == -0.01 and driver_wet(car, 0.15) == 0.02
    weather = {"curves": CURVES, "wetness": [0.05]}
    compounds = {"INTERMEDIATE": {"offset": 0.0, "degPerLap": 0.0, "cliffLap": 30}}
    got = _clean_lap(car, compounds, 0.0, 1, None, weather)
    assert got == 80.0 * (1 + wet_penalty(weather, "INTERMEDIATE", 1) - 0.01 * 0.5)


def test_band_pace_is_an_eras_build_only():
    """A wet Daily/Gauntlet race keeps the one wet pace; a wet Eras race takes dampPace."""
    import pytest

    from pipeline import build, ingest

    for race_id in ("canada-2024", "belgium-2023"):
        if not ingest.raw_snapshot_path(race_id, build.RAW_DIR).exists():
            pytest.skip(f"no raw snapshot for {race_id}")
    assert "canada-2024" in build.shared_races()
    pool = build.build_race("canada-2024").model
    assert any("wetPace" in d for d in pool["drivers"])
    assert not any("dampPace" in d for d in pool["drivers"])
    eras = build.build_race("belgium-2023").model
    assert all("dampPace" in d for d in eras["drivers"] if "wetPace" in d)
    assert any("dampPace" in d for d in eras["drivers"])


# Model fix 1.3 (Eras builds): the Eras curves from mixed-tyre laps, and the race's slick scale.

ERAS = wet.load_curves(eras=True)


def test_eras_curves_cross_over_and_open_up_in_the_wet():
    w = np.linspace(0, 1, 101)
    slick = wet.penalty(ERAS, "SOFT", w)
    inter = wet.penalty(ERAS, "INTERMEDIATE", w)
    wets = wet.penalty(ERAS, "WET", w)
    assert slick[0] == 0 and inter[0] > 0.06
    cross = int(np.argmax(inter < slick))
    assert 0.03 < slick[cross] < 0.12
    assert (inter[cross:] <= slick[cross:]).all()
    assert wets[-1] < inter[-1]

    # The real mixed laps (europe-1999's second shower: inters ~17% off a dry lap, slicks
    # ~24%): at the wetness that puts the inters there, the Eras slicks are ~6% further off;
    # the shared curves had them ~2.5%.
    def gap_at_inter(c, share):
        i = wet.penalty(c, "INTERMEDIATE", w)
        k = int(np.argmax((w > c["inter"]["best"]) & (i >= share)))
        return float(wet.penalty(c, "SOFT", w[k]) - i[k])

    assert gap_at_inter(ERAS, 0.17) > 0.05
    assert gap_at_inter(CURVES, 0.17) < 0.035


def _mixed_obs(gap_extra: float, laps: int = 10, n: int = 4) -> tuple[pd.DataFrame, list]:
    """Laps at wetness 0.3 with n cars on slicks and n on inters, the slicks `gap_extra` (share
    of a dry lap) further off than the Eras curves say."""
    w = [0.3] * laps
    s = float(wet.penalty(ERAS, "SOFT", 0.3))
    i = float(wet.penalty(ERAS, "INTERMEDIATE", 0.3))
    rows = [(lap, "slick", s + gap_extra, n) for lap in range(1, laps + 1)]
    rows += [(lap, "inter", i, n) for lap in range(1, laps + 1)]
    return pd.DataFrame(rows, columns=["lap", "cls", "median", "count"]), w


def test_slick_scale_is_one_where_the_curves_fit_or_nothing_is_mixed():
    obs, w = _mixed_obs(0.0)
    assert wet.slick_scale(obs, w, ERAS) == 1.0
    only = obs[obs["cls"] == "inter"]
    assert wet.slick_scale(only, w, ERAS) == 1.0


def test_slick_scale_follows_the_race_and_shrinks_to_the_pooled_curves():
    s = float(wet.penalty(ERAS, "SOFT", 0.3))
    obs, w = _mixed_obs(-0.03)  # slicks 3% nearer the inters: a drying line
    k = wet.slick_scale(obs, w, ERAS)
    full = 1 - 0.03 / s  # what the laps alone say
    assert full < k < 1.0
    few, w3 = _mixed_obs(-0.03, laps=2, n=1)  # two laps, one car each: barely moves
    assert k < wet.slick_scale(few, w3, ERAS) < 1.0
    big, _ = _mixed_obs(-0.5)
    assert wet.slick_scale(big, w, ERAS) == wet.SLICK_SCALE_BOUNDS[0]
    scaled = wet.scaled_curves(ERAS, 0.8)
    assert scaled["slick"]["a"] == round(ERAS["slick"]["a"] * 0.8, 4)
    assert scaled["inter"] == ERAS["inter"] and scaled["wet"] == ERAS["wet"]


def test_mixed_laps_pair_the_tyre_classes_in_clear_air():
    laps, weather, fitted = _band_race()
    assert wet.mixed_laps(laps, weather, fitted) == []  # inters only
    late = (laps["LapNumber"] >= 11) & laps["Driver"].isin(["B", "C", "D"])
    laps.loc[late, "Compound"] = "WET"
    laps.loc[late, "LapTime"] *= 1.01
    mixed = wet.mixed_laps(laps, weather, fitted)
    assert mixed and {(a, b) for _, a, b, _, _ in mixed} == {("inter", "wet")}
    for lap, _, _, gap, n in mixed:
        assert lap >= 11 and n >= wet.MIXED_MIN_FIELD
        # Every car ran the inter curve, the wets' laps 1% longer: wets ~1% of a lap slower.
        inter = float(wet.penalty(CURVES, "INTERMEDIATE", 0.3))
        assert abs(gap + 0.01 * (1 + inter)) < 0.005
    # The fit's mixed term is zero on the curves that made the laps' gap, positive off them.
    exact = [(lap, a, b, float(wet.penalty(CURVES, "INTERMEDIATE", 0.3)
              - wet.penalty(CURVES, "WET", 0.3)), n) for lap, a, b, _, n in mixed]  # fmt: skip
    assert wet.mixed_cost(exact, weather["wetness"], CURVES) == 0.0
    assert wet.mixed_cost(exact, weather["wetness"], ERAS) > 0.0


def test_eras_curves_are_an_eras_timed_build_only():
    """A wet Daily/Gauntlet race and a wet reconstructed race keep the shared curves; a timed
    wet Eras race takes the Eras curves (its slick scaled by its own mixed laps)."""
    import pytest

    from pipeline import build, ingest

    for race_id in ("canada-2024", "germany-2000", "monaco-1984"):
        if not ingest.raw_snapshot_path(race_id, build.RAW_DIR).exists():
            pytest.skip(f"no raw snapshot for {race_id}")
    assert build.build_race("canada-2024").model["weather"]["curves"] == CURVES
    assert build.build_race("monaco-1984").model["weather"]["curves"] == CURVES
    eras = build.build_race("germany-2000").model["weather"]["curves"]
    assert eras["inter"] == ERAS["inter"] and eras["wet"] == ERAS["wet"]
    assert eras["slick"] != ERAS["slick"]  # Barrichello's slicks kept the inters' pace
    assert eras["slick"]["a"] < ERAS["slick"]["a"]


# Model fix 1.6 (Eras builds): a car that ran only wet laps takes an estimated dry pace.


def _without(fitted, car):
    from dataclasses import replace

    return replace(
        fitted,
        driver_pace={c: p for c, p in fitted.driver_pace.items() if c != car},
        driver_noise={c: n for c, n in fitted.driver_noise.items() if c != car},
    )


def test_estimated_dry_pace_inverts_the_wet_model_at_the_field_offset():
    laps, weather, fitted = _band_race()
    # B ran at the field's pace (80 s dry) in the wet: its laps give 80 s back.
    p, noise, how = wet.estimated_dry_pace(laps, weather, _without(fitted, "B"), ["B"])["B"]
    assert abs(p - 80.0) < 0.2 and noise == 0.3 and "laps against the wet model" in how
    # The whole field 2% slower in the wet than the curves say: still B's 80 s (the field's
    # offset, not B's dry pace).
    laps2 = laps.assign(LapTime=laps["LapTime"] * 1.02)
    p2, *_ = wet.estimated_dry_pace(laps2, weather, _without(fitted, "B"), ["B"])["B"]
    assert abs(p2 - 80.0) < 0.2


def test_estimated_dry_pace_blends_with_the_team_mate_and_falls_back_to_it():
    laps, weather, fitted = _band_race()
    laps["Team"] = laps["Driver"].map({"A": "X", "B": "X"}).fillna("Y")
    f = _without(fitted, "B")
    f.driver_pace["A"] = 81.0  # B's team-mate
    p, _, how = wet.estimated_dry_pace(laps, weather, f, ["B"])["B"]
    w = wet.ESTIMATE_WET_WEIGHT
    assert abs(p - (w * 80.0 + (1 - w) * 81.0)) < 0.1 and "team-mate A" in how
    # Too few laps (two): the team-mate's pace alone; no team-mate either: the field's median.
    short = laps[(laps["Driver"] != "B") | (laps["LapNumber"] <= 3)]
    assert wet.estimated_dry_pace(short, weather, f, ["B"])["B"][0] == 81.0
    alone = short.assign(Team=short["Team"].where(short["Driver"] != "B", "Z"))
    p, _, how = wet.estimated_dry_pace(alone, None, f, ["B"])["B"]
    assert p == 80.0 and "field's median" in how  # A 81, the rest 80


def test_a_car_with_only_wet_laps_stays_in_an_eras_race():
    """china-2007: Hamilton (the user's car) ran only wet laps before retiring; his dry pace is
    estimated (provenance driverPace) and every car running at the takeover is in the model."""
    import pytest

    from pipeline import build, ingest

    if not ingest.raw_snapshot_path("china-2007", build.RAW_DIR).exists():
        pytest.skip("no raw snapshot for china-2007")
    result = build.build_race("china-2007")
    codes = {d["code"] for d in result.model["drivers"]}
    assert {"HAM", "SCH", "SUT"} <= codes
    takeover = result.model["race"]["takeoverLap"]
    assert build.running_at(result.laps, takeover) <= codes
    assert "driverPace" in result.model["provenance"]["estimated"]
    assert any(line.startswith("estimated: driverPace (HAM") for line in result.estimates)
