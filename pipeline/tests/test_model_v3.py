"""Model v3 (docs/model-v3-spec.md): stops straddling the takeover and post-takeover pace."""

from __future__ import annotations

import pytest

from pipeline import build, events, ingest, pace, track


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
    # The model charges it in the sim's frame (M1): the out-lap only, well under the full stop.
    ver = next(d for d in model["drivers"] if d["code"] == "VER")
    assert ver["realStrategy"][0]["loss"] < whole[("VER", takeover + 1)] - 15


def test_sim_frame_loss_reproduces_the_real_in_and_out_laps(france):
    model, laps = france
    drivers = {d["code"]: d for d in model["drivers"]}
    pace_now = {c: d["basePace"] for c, d in drivers.items()}
    losses = pace.sim_frame_losses(
        laps,
        pace_now,
        model["compounds"],
        model["fuelEffectPerLap"],
        model["freshTyre"],
        model["race"]["takeoverLap"],
    )
    for d in model["drivers"]:
        for stop in d["realStrategy"]:
            if (d["code"], stop["lap"]) in losses:
                assert stop["loss"] == pytest.approx(losses[(d["code"], stop["lap"])], abs=0.01)


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


def test_deployment_times_start_each_neutralization_once():
    status = [
        {"time": 0.0, "status": "1"},
        {"time": 10.0, "status": "2"},
        {"time": 20.0, "status": "6"},  # VSC
        {"time": 25.0, "status": "4"},  # upgraded to SC: same neutralization
        {"time": 90.0, "status": "1"},
        {"time": 120.0, "status": "6"},
    ]
    assert events.deployment_times(status) == [20.0, 120.0]


def test_saudi_2022_perez_pitted_before_the_safety_car():
    """PER boxed at the end of lap 15; the SC came out during lap 16, so his stop was a
    green-flag stop while LEC, VER and SAI pitted under the SC a lap later."""
    model, laps = build.build_race_model("saudi-arabia-2022")
    status = ingest.load_track_status("saudi-arabia-2022")
    green = events.green_entry_stops(laps, events.extract_events(laps), status)
    assert ("PER", 16) in green
    assert not {("LEC", 17), ("VER", 17), ("SAI", 17)} & green
    per = next(d for d in model["drivers"] if d["code"] == "PER")
    assert per["realStrategy"][0]["loss"] == round(model["track"]["pitLoss"], 3)
    lec = next(d for d in model["drivers"] if d["code"] == "LEC")
    assert "loss" not in lec["realStrategy"][0]  # priced as an SC stop by the sim
