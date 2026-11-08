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


def test_a_race_wet_from_start_to_finish_says_why_it_cant_build():
    # Interlagos 2024 (OpenF1): every lap on inters or wets, so no dry lap model to correct.
    import pytest

    from pipeline import build

    with pytest.raises(ValueError, match="no clean slick lap outside the wet period"):
        build.build_race("brazil-2024")
