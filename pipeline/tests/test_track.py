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
