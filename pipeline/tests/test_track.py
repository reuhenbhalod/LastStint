"""Unit tests for track (Phase 1.4).

Fits track parameters on the committed Abu Dhabi 2021 snapshot (offline) and checks the
robust, physically-expected relationships.
"""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import clean, fit, ingest, track


@pytest.fixture(scope="module")
def abu():
    laps = pd.read_parquet(ingest.raw_snapshot_path("abu-dhabi-2021"))
    clean_df, traffic_df, _ = clean.clean_laps(laps)
    fitted = fit.fit_lap_model(clean_df)
    params = track.fit_track_params(laps, clean_df, traffic_df, fitted)
    return laps, clean_df, traffic_df, fitted, params


def test_green_pit_loss_plausible(abu):
    *_, params = abu
    assert 15 < params.pit_loss < 30  # Yas Marina pit loss ~20-23s


def test_sc_pit_loss_is_discounted_green(abu):
    *_, params = abu
    assert params.pit_loss_under_sc < params.pit_loss
    assert params.pit_loss_under_sc == pytest.approx(params.pit_loss * track.SC_PIT_LOSS_FACTOR)


def test_vsc_pit_loss_measured_between_sc_and_green(abu):
    laps, *_, params = abu
    # Abu Dhabi 2021: VER, PER, GAS, ALO, LEC pitted under the lap-36 VSC.
    _, n_vsc = track.pit_loss_under_vsc(laps)
    assert n_vsc >= track.MIN_VSC_STOPS
    assert params.pit_loss_under_sc < params.pit_loss_under_vsc < params.pit_loss
    # Measured by gap change to non-stopping cars: VER's VSC stop matches the real gap trace
    # (+2.1, +12.4, -3.8s over laps 36-38), far below a green stop.
    assert 13 < params.pit_loss_under_vsc < 17


def test_vsc_stop_measured_by_gap_change(abu):
    laps, *_ = abu
    vsc = {d: loss for d, f, loss in track.stop_losses(laps) if f == "VSC"}
    assert set(vsc) == {"ALO", "GAS", "LEC", "PER", "VER"}
    assert 13 < vsc["VER"] < 16


def test_stop_losses_flag_each_stop(abu):
    laps, *_ = abu
    flags = {(driver, flag) for driver, flag, _ in track.stop_losses(laps)}
    assert ("VER", "VSC") in flags and ("VER", "SC") in flags and ("VER", "green") in flags


def test_vsc_fallback_when_no_vsc_stops():
    laps = pd.read_parquet(ingest.raw_snapshot_path("spain-2021"))
    clean_df, traffic_df, _ = clean.clean_laps(laps)
    params = track.fit_track_params(laps, clean_df, traffic_df, fit.fit_lap_model(clean_df))
    assert params.pit_loss_under_vsc == pytest.approx(params.pit_loss * track.VSC_PIT_LOSS_FACTOR)
    assert any("pitLossUnderVSC" in note for note in params.notes)


def test_dirty_air_penalty_positive_and_small(abu):
    *_, params = abu
    assert 0 < params.dirty_air_penalty < 2


def test_overtake_difficulty_high_at_yas_marina(abu):
    *_, params = abu
    assert 0.0 <= params.overtake_difficulty <= 1.0
    assert params.overtake_difficulty > 0.7  # notoriously hard to overtake
    assert params.n_pass_opportunities > 0
    assert params.n_passes >= 0


def test_neutralized_lap_times_ordered(abu):
    *_, params = abu
    assert params.sc_lap_time > params.vsc_lap_time > params.green_lap_time


def test_pit_stops_found(abu):
    laps, *_ = abu
    assert len(track.pit_stops(laps)) > 10  # at least ~one per driver


def test_pass_events_schema(abu):
    laps, *_ = abu
    events = track.extract_pass_events(laps)
    assert not events.empty
    assert {"lap", "follower", "leader", "gap", "pace_delta", "passed"} <= set(events.columns)
    assert (events["gap"] <= 2.0).all()


def test_is_neutralized():
    assert track._is_neutralized("4")  # safety car
    assert track._is_neutralized("671")  # VSC codes present
    assert not track._is_neutralized("1")  # green
    assert not track._is_neutralized("12")  # green then yellow, no SC/VSC


def test_overtake_model_fitted_with_expected_signs(abu):
    *_, params = abu
    model = params.overtake_model
    assert model["paceCoef"] > 0 and model["gapCoef"] < 0
    assert not any("overtakeModel" in note for note in params.notes)  # fitted, not default


def test_overtake_model_falls_back_on_thin_data(abu):
    laps, _, _, fitted, _ = abu
    few = laps[laps["LapNumber"] <= 4]  # opening laps only: too few passes to fit
    model, note = track.fit_overtake_model(few, fitted)
    assert model == track.DEFAULT_OVERTAKE_MODEL
    assert note is not None


def test_stop_losses_are_pace_corrected(abu):
    # A slow car's slow in/out laps must not count as pit time: green-stop losses for the
    # quickest and slowest teams should sit near the track median, not ~2x their pace gap.
    laps, *_ = abu
    green = {(d, i): loss for i, (d, f, loss) in enumerate(track.stop_losses(laps)) if f == "green"}
    median = track.pit_loss(laps)
    # (PER's one genuinely slow ~29s stop is the only outlier.)
    near = [abs(loss - median) < 2.5 for loss in green.values()]
    assert sum(near) / len(near) >= 0.9
    ham = [loss for (d, _), loss in green.items() if d == "HAM"]
    assert abs(ham[0] - median) < 2.5
