"""Assemble the race-model dict (Phase 1.6).

Ties the fitted pieces (lap-time model, track params, events, takeover state, real
strategies) into one dict matching packages/schema/race-model.schema.json. Everything the
browser simulator needs, and nothing it doesn't.
"""

from __future__ import annotations

import pandas as pd

from . import SCHEMA_VERSION
from . import events as events_mod
from . import scenario as scenario_mod
from .fit import LapTimeFit
from .track import TrackParams


def finishing_order(laps: pd.DataFrame) -> list[str]:
    """Classification order: most laps completed first, ties broken by earlier finish."""
    last_rows = laps.loc[laps.groupby("Driver")["LapNumber"].idxmax()]
    ordered = last_rows.sort_values(["LapNumber", "Time"], ascending=[False, True])
    return [str(d) for d in ordered["Driver"]]


def longest_stints(laps: pd.DataFrame) -> dict[str, int]:
    """Longest tyre age observed per compound in the race (the edge of the evidence)."""
    known = laps.dropna(subset=["Compound", "TyreLife"])
    return {str(c): int(v) for c, v in known.groupby("Compound")["TyreLife"].max().items()}


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
) -> dict:
    """Build the race-model dict (validate + write it with export.write_race)."""
    total_laps = int(laps["LapNumber"].max())
    cliffs = fit.compound_cliff
    longest = longest_stints(laps)

    compounds = {}
    for compound, offset in fit.compound_offset.items():
        hinge = cliffs.get(compound)
        compounds[compound] = {
            "offset": round(offset, 4),
            "degPerLap": round(fit.compound_wear[compound], 5),
            # No fitted cliff -> the edge of the evidence: the longest stint seen on this
            # compound. Past it the sim's fallback wear applies (spec D5), instead of assuming
            # the tyre never falls off.
            "cliffLap": int(hinge[0]) if hinge else longest.get(compound, total_laps),
            **({"cliffDegPerLap": round(hinge[1], 4)} if hinge else {}),
        }

    # Events and remaining strategy from the takeover lap onward; earlier history is already
    # baked into stateAtTakeover.
    future_events = [
        e for e in events_mod.extract_events(laps, total_laps) if e["lap"] >= takeover_lap
    ]
    takeover_state = scenario_mod.state_at_takeover(laps, takeover_lap)
    strategy = scenario_mod.real_strategy(laps)
    teams = _team_map(laps)

    drivers = []
    for code in sorted(set(takeover_state) & set(fit.driver_pace)):
        s = takeover_state[code]
        if s["position"] is None or s["compound"] is None:
            continue
        drivers.append(
            {
                "code": code,
                "team": teams.get(code, "Unknown"),
                "basePace": round(fit.driver_pace[code], 4),
                "noise": round(fit.driver_noise[code], 4),
                "stateAtTakeover": {
                    "position": s["position"],
                    "gapAhead": s["gapAhead"] if s["gapAhead"] is not None else 0.0,
                    "compound": s["compound"],
                    "tyreAge": s["tyreAge"] if s["tyreAge"] is not None else 0,
                },
                "realStrategy": [st for st in strategy.get(code, []) if st["lap"] >= takeover_lap],
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
        },
        "era": era,
        "track": {
            "pitLoss": round(track_params.pit_loss, 3),
            "pitLossUnderSC": round(track_params.pit_loss_under_sc, 3),
            "pitLossUnderVSC": round(track_params.pit_loss_under_vsc, 3),
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
        "events": future_events,
        "decisionMoments": moments,
        "realResult": finishing_order(laps),
        "userSide": user_side,
        "rival": rival,
    }
