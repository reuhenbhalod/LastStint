"""Legend difficulty's safety cars (eras build plan 9.2): the draw, its rules and parity vectors."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import legend, sim_reference
from pipeline.paths import GOLDEN_DIR, RACES_DIR

VECTORS = Path(__file__).parent / "fixtures" / "legend_parity.json"
SEEDS = range(1, 101)


def _model(race: str) -> dict:
    return json.loads((RACES_DIR / f"{race}.json").read_text())


def _neutral(events: list[dict]) -> list[tuple]:
    return [(e["lap"], e["type"], e["laps"]) for e in events if e["type"] in ("SC", "VSC")]


def _blank(laps: int = 60, takeover: int = 10, race_id: str = "abu-dhabi-2021") -> dict:
    """A race with no events (only the fields the draw reads)."""
    return {"race": {"id": race_id, "laps": laps, "takeoverLap": takeover}, "events": []}


# --- the draw --------------------------------------------------------------------------------


def test_same_seed_same_events():
    model = _model("abu-dhabi-2021")
    for seed in (1, 7, 123456789):
        assert legend.legend_events(model, seed) == legend.legend_events(model, seed)


def test_events_move_between_seeds():
    model = _model("spain-2021")
    draws = {tuple(_neutral(legend.legend_events(model, s))) for s in SEEDS}
    assert len(draws) > 10
    starts = {lap for d in draws for lap, _, _ in d}
    assert len(starts) > 10  # SCs land on many different laps


def test_real_non_storyline_periods_after_takeover_are_replaced():
    model = _model("abu-dhabi-2021")  # real VSC lap 36, SC lap 53; takeover 34
    real = set(_neutral(model["events"]))
    hits = sum(bool(real & set(_neutral(legend.legend_events(model, s)))) for s in SEEDS)
    assert hits < len(SEEDS) / 10  # the real laps come back only by chance


def test_storyline_events_never_move():
    model = legend.variant(_model("abu-dhabi-2021"), "storyline")
    real = _neutral(model["events"])
    extra = 0
    for seed in SEEDS:
        got = _neutral(legend.legend_events(model, seed))
        assert all(e in got for e in real), seed
        extra += len(got) - len(real)
    assert extra > 0  # draws still happen around them


def test_only_some_events_flagged():
    model = _model("abu-dhabi-2021")
    for e in model["events"]:
        if e["type"] == "SC":
            e["storylineEvent"] = True  # the late SC defines the storyline; the VSC doesn't
    for seed in SEEDS:
        got = _neutral(legend.legend_events(model, seed))
        assert (53, "SC", 5) in got
        assert (36, "VSC", 3) not in got  # not kept (a drawn VSC runs 2 laps)


def test_retirements_red_flags_and_past_periods_are_kept():
    model = _blank()
    model["events"] = [
        {"lap": 8, "type": "SC", "laps": 4},  # started before the takeover (lap 10)
        {"lap": 30, "type": "RED", "laps": 1},
        {"lap": 31, "type": "RETIREMENT", "driver": "XXX"},
        {"lap": 40, "type": "VSC", "laps": 2},
    ]
    real_vsc = 0
    for seed in SEEDS:
        got = legend.legend_events(model, seed)
        for e in model["events"][:3]:
            assert e in got
        real_vsc += model["events"][3] in got
    assert real_vsc < len(SEEDS) / 10  # the post-takeover VSC is redrawn


def test_drawn_periods_fit_around_kept_ones():
    model = _blank(laps=40, takeover=5)
    model["events"] = [{"lap": 20, "type": "SC", "laps": 3, "storylineEvent": True}]
    rates = {**legend.load_rates(), "circuits": {}}
    rates["allTracks"] = {"scPerRace": 15.0, "vscPerRace": 10.0}  # crowd the race
    for seed in range(1, 300):
        got = legend.legend_events(model, seed, rates)
        laps = [lap for e in got if e["type"] in ("SC", "VSC")
                for lap in range(e["lap"], e["lap"] + e["laps"])]  # fmt: skip
        assert len(laps) == len(set(laps)), seed  # no overlap
        assert all(5 < lap <= 40 for lap in laps)
        for e in got:
            if e is model["events"][0] or e["type"] not in ("SC", "VSC"):
                continue
            end = e["lap"] + e["laps"]
            assert e["lap"] - 1 not in laps and end not in laps, (seed, e)  # green either side
            assert e["laps"] <= (5 if e["type"] == "SC" else 2)


def test_no_vsc_where_the_rules_forbid_it():
    model = legend.variant(_model("abu-dhabi-2021"), "no-vsc")
    allowed = _model("abu-dhabi-2021")
    vscs = sum(e[1] == "VSC" for s in SEEDS for e in _neutral(legend.legend_events(allowed, s)))
    assert vscs > 0
    for seed in SEEDS:
        assert all(e[1] != "VSC" for e in _neutral(legend.legend_events(model, seed)))
        # the SC draws don't change: the VSC share sits above the SC share
        assert [e for e in _neutral(legend.legend_events(model, seed)) if e[1] == "SC"] == [
            e for e in _neutral(legend.legend_events(allowed, seed)) if e[1] == "SC"
        ]


def test_draws_follow_the_tracks_rate():
    model = _blank(laps=60, takeover=0)
    rates = legend.legend_rates(model)
    n = 4000
    sc = vsc = 0
    for seed in range(n):
        for e in _neutral(legend.legend_events(model, seed)):
            sc += e[1] == "SC"
            vsc += e[1] == "VSC"
    # Spacing rules drop a few draws, so the realised rate sits a little under the measured one.
    assert 0.8 * rates["scPerRace"] < sc / n <= 1.02 * rates["scPerRace"]
    assert 0.8 * rates["vscPerRace"] < vsc / n <= 1.02 * rates["vscPerRace"]


# --- rates lookup ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("race_id", "circuit"),
    [
        ("abu-dhabi-2021", "yas_marina"),
        ("europe-1997", "jerez"),
        ("europe-2016", "baku"),
        ("great-britain-1987", "silverstone"),
        ("great-britain-1986", "brands_hatch"),
        ("great-britain-1985", "silverstone"),
        ("styria-2020", "red_bull_ring"),
        ("spain-1994-pits", "catalunya"),
        ("brazil-2021", "interlagos"),
        ("brazil-1989", "jacarepagua"),
        ("atlantis-2021", None),
    ],
)
def test_circuit_for(race_id, circuit):
    assert legend.circuit_for(race_id) == circuit


def test_rates_fall_back_and_flag():
    measured = legend.legend_rates(_model("abu-dhabi-2021"))
    assert measured["circuit"] == "yas_marina" and not measured["scFallback"]
    all_tracks = legend.load_rates()["allTracks"]
    for race_id in ("atlantis-2021", "south-africa-1983", "netherlands-2022"):
        r = legend.legend_rates({"race": {"id": race_id}})
        assert r["scFallback"] and r["vscFallback"], race_id
        assert (r["scPerRace"], r["vscPerRace"]) == (
            all_tracks["scPerRace"],
            all_tracks["vscPerRace"],
        )


def test_bad_race_id():
    with pytest.raises(ValueError, match="event-slug"):
        legend.parse_race_id("abu-dhabi")


# --- the hook in the reference sim -----------------------------------------------------------


def test_legend_changes_the_race_and_is_deterministic():
    model = _model("abu-dhabi-2021")
    assert sim_reference.simulate(model, 3, legend=True) == sim_reference.simulate(
        model, 3, legend=True
    )
    differs = sum(
        sim_reference.simulate(model, s, legend=True) != sim_reference.simulate(model, s)
        for s in range(1, 21)
    )
    assert differs > 10


@pytest.mark.parametrize("race", ["abu-dhabi-2021", "spain-2021", "canada-2024"])
def test_without_legend_the_golden_files_replay(race):
    model = _model(race)
    golden = json.loads((GOLDEN_DIR / f"{race}.json").read_text())
    for seed, want in golden.items():
        got = sim_reference.simulate(model, int(seed), legend=False)
        assert got == sim_reference.simulate(model, int(seed))
        assert got["order"] == want["order"]


# --- parity vectors --------------------------------------------------------------------------


def test_parity_vectors_are_current():
    assert json.loads(VECTORS.read_text()) == legend.parity_vectors(), (
        "regenerate with `uv run python -m pipeline.legend`"
    )


def test_parity_vectors_cover_moves_and_keeps():
    cases = json.loads(VECTORS.read_text())["cases"]
    plain = cases["abu-dhabi-2021"]["seeds"]
    assert len({json.dumps(v["events"]) for v in plain.values()}) > 5
    story = cases["abu-dhabi-2021+storyline"]["seeds"]
    assert all((53, "SC", 5) in _neutral(v["events"]) for v in story.values())
    no_vsc = cases["abu-dhabi-2021+no-vsc"]["seeds"]
    assert all(e["type"] != "VSC" for v in no_vsc.values() for e in v["events"])
