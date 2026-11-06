"""Assemble the race-model dict (Phase 1.6).

Ties the fitted pieces (lap-time model, track params, events, takeover state, real
strategies) into one dict matching packages/schema/race-model.schema.json. Everything the
browser simulator needs, and nothing it doesn't.
"""

from __future__ import annotations

import json

import pandas as pd

from . import SCHEMA_VERSION
from . import events as events_mod
from . import pace as pace_mod
from . import scenario as scenario_mod
from . import track as track_mod
from .fit import LapTimeFit
from .paths import MOMENTS_DIR
from .track import TrackParams


def finishing_order(laps: pd.DataFrame) -> list[str]:
    """Classification order: most laps completed first, ties broken by earlier finish."""
    last_rows = laps.loc[laps.groupby("Driver")["LapNumber"].idxmax()]
    ordered = last_rows.sort_values(["LapNumber", "Time"], ascending=[False, True])
    return [str(d) for d in ordered["Driver"]]


def approved_moments(race_id: str) -> list[dict]:
    """Approved decision moments for a race (data/moments/<race>.json), else none."""
    path = MOMENTS_DIR / f"{race_id}.json"
    return json.loads(path.read_text()) if path.exists() else []


def longest_stints(laps: pd.DataFrame) -> dict[str, int]:
    """Longest tyre age observed per compound in the race (the edge of the evidence)."""
    known = laps.dropna(subset=["Compound", "TyreLife"])
    return {str(c): int(v) for c, v in known.groupby("Compound")["TyreLife"].max().items()}


def stint_counts(laps: pd.DataFrame) -> dict[str, int]:
    """How many stints were run on each compound in the race (the weight of the evidence)."""
    known = laps.dropna(subset=["Compound", "Stint"])
    stints = known[["Driver", "Stint", "Compound"]].drop_duplicates()
    return {str(c): int(n) for c, n in stints.groupby("Compound").size().items()}


# Tyre-life fix: a compound run in fewer stints than this has too little evidence for its own
# life (Monza 24: one soft stint, 2 laps), so its life comes from the compounds that were run,
# at these ratios of their longest stints (a soft lasts about 0.4x the longest hard stint...).
THIN_STINTS = 3
LIFE_RATIO = {
    ("SOFT", "MEDIUM"): 0.55,
    ("SOFT", "HARD"): 0.4,
    ("MEDIUM", "HARD"): 0.65,
    ("MEDIUM", "SOFT"): 1.6,
    ("HARD", "MEDIUM"): 1.5,
    ("HARD", "SOFT"): 2.2,
}


def life_floor(
    compound: str, longest: dict[str, int], stints: dict[str, int], total_laps: int
) -> int | None:
    """The least life the well-run compounds suggest for `compound`, or None with none to go
    on. (Teams that only ran a compound briefly chose to: it says nothing of its life.)"""
    floors = [
        ratio * longest[other]
        for (c, other), ratio in LIFE_RATIO.items()
        if c == compound and stints.get(other, 0) >= THIN_STINTS and other in longest
    ]
    return min(total_laps, round(max(floors))) if floors else None


def thin_life(
    compound: str, longest: dict[str, int], stints: dict[str, int], total_laps: int
) -> int | None:
    """The life of a thinly-run compound, from the well-run ones (None if it isn't thin, or
    nothing well-run to go on)."""
    if stints.get(compound, 0) >= THIN_STINTS:
        return None
    floor = life_floor(compound, longest, stints, total_laps)
    if floor is None:
        return None
    return min(total_laps, max(longest.get(compound, 0), floor))


def _team_map(laps: pd.DataFrame) -> dict[str, str]:
    teams = laps.dropna(subset=["Team"]).groupby("Driver")["Team"].first()
    return {str(k): str(v) for k, v in teams.items()}


def assemble_race_model(
    *,
    race_id: str,
    laps: pd.DataFrame,
    clean_laps: pd.DataFrame,
    fit: LapTimeFit,
    track_params: TrackParams,
    name: str,
    era: str,
    takeover_lap: int,
    seed: int,
    user_side: str,
    rival: str,
    fastest_lap_point: bool = False,
    track_status: list[dict] | None = None,
    sc_unlap: str | None = None,
    weather: dict | None = None,
    wet_pace: dict[str, float] | None = None,
) -> dict:
    """Build the race-model dict (validate + write it with export.write_race)."""
    total_laps = int(laps["LapNumber"].max())
    cliffs = fit.compound_cliff
    longest = longest_stints(laps)
    stints = stint_counts(laps)

    compounds = {}
    for compound, offset in fit.compound_offset.items():
        hinge = cliffs.get(compound)
        thin = thin_life(compound, longest, stints, total_laps)
        if thin is not None:
            # Too few stints to trust its own cliff: the life the well-run compounds suggest.
            compounds[compound] = {
                "offset": round(offset, 4),
                "degPerLap": round(fit.compound_wear[compound], 5),
                "cliffLap": thin,
            }
            continue
        compounds[compound] = {
            "offset": round(offset, 4),
            "degPerLap": round(fit.compound_wear[compound], 5),
            # No fitted cliff -> the edge of the evidence: the longest stint seen on this
            # compound, or the life the other compounds suggest if teams only ran it briefly
            # (tyre-life fix). Past it the sim's fallback wear applies (spec D5), instead of
            # assuming the tyre never falls off.
            "cliffLap": int(hinge[0])
            if hinge
            else max(
                longest.get(compound, total_laps),
                life_floor(compound, longest, stints, total_laps) or 0,
            ),
            **({"cliffDegPerLap": round(hinge[1], 4)} if hinge else {}),
        }

    # A wet race (weather spec): the wet tyres too (their pace is in the weather curves).
    if weather:
        from . import wet as wet_mod

        for compound, model in wet_mod.WET_TYRES.items():
            compounds.setdefault(compound, dict(model))
        # A dry tyre run only in the wet (softs fitted for a damp track) has no dry laps to
        # fit: the era's prior, against the nearest fitted one.
        from .fit import load_compound_priors

        prior = load_compound_priors(era)
        used = set(laps["Compound"].dropna().astype(str))
        fitted_dry = [c for c in prior["order"] if c in compounds]
        for c in prior["order"]:
            if c in used and c not in compounds and fitted_dry:
                anchor = min(
                    fitted_dry,
                    key=lambda f: abs(prior["order"].index(f) - prior["order"].index(c)),
                )
                compounds[c] = {
                    "offset": round(
                        compounds[anchor]["offset"] + prior["offset"][c] - prior["offset"][anchor],
                        4,
                    ),
                    "degPerLap": prior["wear"][c],
                    "cliffLap": max(
                        longest.get(c, 1), life_floor(c, longest, stints, total_laps) or 1
                    ),
                }
        wear = wet_mod.sim_wear(laps, weather)
    else:
        wear = None

    # Events and remaining strategy from the takeover lap onward; earlier history is already
    # baked into stateAtTakeover.
    future_events = [
        e for e in events_mod.extract_events(laps, total_laps) if e["lap"] >= takeover_lap
    ]
    takeover_state = scenario_mod.state_at_takeover(laps, takeover_lap)
    strategy = scenario_mod.real_strategy(laps)
    teams = _team_map(laps)
    # Real stops keep their measured time (spec B1): a slow or quick stop is a real event.
    measured = track_mod.measured_stop_losses(laps, takeover_lap)
    # Model v3 (spec B2a): each driver's pace over the laps the game replays.
    fresh = {"bonus": round(fit.fresh_tyre_bonus, 4), "laps": fit.fresh_tyre_laps}
    race_pace = pace_mod.post_takeover_offsets(
        laps,
        fit.driver_pace,
        compounds,
        round(fit.fuel_per_lap, 5),
        fresh,
        takeover_lap,
        pace_mod.SHRINK_LAPS,
        weather,
        wear,
    )
    if pace_mod.SIM_FRAME_LOSS:
        v3_pace = {c: p + race_pace.get(c, 0.0) for c, p in fit.driver_pace.items()}
        measured.update(
            pace_mod.sim_frame_losses(
                laps,
                v3_pace,
                compounds,
                round(fit.fuel_per_lap, 5),
                fresh,
                takeover_lap,
                weather,
                wear,
                wet_pace,
            )
        )

    # Model v3 stage 9: a stop entered before an SC/VSC was deployed is a green-flag stop,
    # though its out-lap is neutralized (the sim prices a stop by its out-lap's flag).
    if track_status and track_params.pit_loss is not None:
        all_events = events_mod.extract_events(laps, total_laps)
        for key in events_mod.green_entry_stops(laps, all_events, track_status):
            measured.setdefault(key, track_params.pit_loss)

    optional = (
        scenario_mod.fastest_lap_stops(laps, measured, track_params.pit_loss)
        if fastest_lap_point and track_params.pit_loss is not None
        else set()
    )

    drivers = []
    for code in sorted(set(takeover_state) & set(fit.driver_pace)):
        s = takeover_state[code]
        if s["position"] is None or s["compound"] is None:
            continue
        drivers.append(
            {
                "code": code,
                "team": teams.get(code, "Unknown"),
                "basePace": round(fit.driver_pace[code] + race_pace.get(code, 0.0), 4),
                "noise": round(fit.driver_noise[code], 4),
                **({"wetPace": wet_pace[code]} if wet_pace and code in wet_pace else {}),
                "stateAtTakeover": {
                    "position": s["position"],
                    "gapAhead": s["gapAhead"] if s["gapAhead"] is not None else 0.0,
                    "compound": s["compound"],
                    "tyreAge": s["tyreAge"] if s["tyreAge"] is not None else 0,
                    "compoundsUsed": s["compoundsUsed"],
                },
                "realStrategy": [
                    {
                        **st,
                        **(
                            {"loss": round(measured[(code, st["lap"])], 3)}
                            if (code, st["lap"]) in measured
                            else {}
                        ),
                        **({"optional": True} if (code, st["lap"]) in optional else {}),
                    }
                    for st in strategy.get(code, [])
                    if st["lap"] >= takeover_lap
                ],
            }
        )

    moments = [
        m for m in scenario_mod.candidate_decision_moments(laps, future_events) if m >= takeover_lap
    ]

    return {
        "schemaVersion": SCHEMA_VERSION,
        "race": {
            "id": race_id,
            "name": name,
            "laps": total_laps,
            "takeoverLap": takeover_lap,
            "seed": seed,
            **({"scUnlap": sc_unlap} if sc_unlap else {}),
        },
        "era": era,
        "track": {
            "pitLoss": round(track_params.pit_loss, 3),
            "pitLossUnderSC": round(track_params.pit_loss_under_sc, 3),
            "pitLossUnderVSC": round(track_params.pit_loss_under_vsc, 3),
            "pitLossDeviations": track_params.pit_loss_deviations,
            "overtakeDifficulty": round(track_params.overtake_difficulty, 4),
            "overtakeModel": {k: round(v, 4) for k, v in track_params.overtake_model.items()},
            "dirtyAirPenalty": round(track_params.dirty_air_penalty, 4),
            # Neutralized-lap pace for the simulator; omitted when a race had none.
            **(
                {"greenLapTime": round(track_params.green_lap_time, 3)}
                if track_params.green_lap_time == track_params.green_lap_time
                else {}
            ),
            **(
                {"scLapTime": round(track_params.sc_lap_time, 3)}
                if track_params.sc_lap_time is not None
                else {}
            ),
            **(
                {"vscLapTime": round(track_params.vsc_lap_time, 3)}
                if track_params.vsc_lap_time is not None
                else {}
            ),
        },
        "compounds": compounds,
        "drivers": drivers,
        "fuelEffectPerLap": round(fit.fuel_per_lap, 5),
        "freshTyre": {"bonus": round(fit.fresh_tyre_bonus, 4), "laps": fit.fresh_tyre_laps},
        "events": future_events,
        "decisionMoments": approved_moments(race_id),
        "candidateMomentLaps": moments,
        "realResult": finishing_order(laps),
        "userSide": user_side,
        "rival": rival,
        **({"weather": weather} if weather else {}),
    }
