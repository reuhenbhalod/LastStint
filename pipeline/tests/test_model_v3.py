"""Model v3 (docs/model-v3-spec.md): stops straddling the takeover and post-takeover pace."""

from __future__ import annotations

import pytest

from pipeline import build, pace, track


@pytest.fixture(scope="module")
def france():
    return build.build_race_model("france-2019")


def test_stop_straddling_the_takeover_is_charged_its_out_lap_only(france):
    model, laps = france
    takeover = model["race"]["takeoverLap"]
    whole = track.measured_stop_losses(laps)
    straddling = track.measured_stop_losses(laps, takeover)
    # VER's in-lap is the takeover lap: at Paul Ricard most of the stop is in the in-lap,
    # which is already in the takeover gaps.
    assert whole[("VER", takeover + 1)] > 20
    assert straddling[("VER", takeover + 1)] < whole[("VER", takeover + 1)] - 15
    # Stops later in the race are unchanged.
    later = [k for k in whole if k[1] > takeover + 1]
    assert later and all(straddling[k] == whole[k] for k in later)
    ver = next(d for d in model["drivers"] if d["code"] == "VER")
    assert ver["realStrategy"][0]["loss"] == round(straddling[("VER", takeover + 1)], 3)


def test_post_takeover_pace_is_shrunk_by_lap_count(france):
    model, laps = france
    args = (
        laps,
        {d["code"]: 90.0 for d in model["drivers"]},
        model["compounds"],
        model["fuelEffectPerLap"],
        model["freshTyre"],
        model["race"]["takeoverLap"],
    )
    raw = pace.post_takeover_offsets(*args, shrink_laps=0.0)
    shrunk = pace.post_takeover_offsets(*args, shrink_laps=5.0)
    assert raw.keys() == shrunk.keys() and raw
    for code, offset in raw.items():
        assert abs(shrunk[code]) < abs(offset) or offset == 0
    assert pace.post_takeover_offsets(*args, shrink_laps=float("inf")) == dict.fromkeys(raw, 0.0)
