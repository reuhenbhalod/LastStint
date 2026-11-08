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
from . import faults as faults_mod
from . import pace as pace_mod
from . import redflag as redflag_mod
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
# A life guessed from the other compounds stops short of this share of the race (tyre-life fix
# 2): 1.5x the longest medium stint often came out past the flag, a hard that never wore out.
GUESS_CAP = 0.8
LIFE_RATIO = {
    ("SOFT", "MEDIUM"): 0.55,
    ("SOFT", "HARD"): 0.4,
    ("MEDIUM", "HARD"): 0.65,
    ("MEDIUM", "SOFT"): 1.6,
    ("HARD", "MEDIUM"): 1.5,
    ("HARD", "SOFT"): 2.2,
}


def life_floor(
    compound: str,
    longest: dict[str, int],
    stints: dict[str, int],
    total_laps: int,
    harder_only: bool = False,
) -> int | None:
    """The least life the well-run compounds suggest for `compound`, or None with none to go
    on. (Teams that only ran a compound briefly chose to: it says nothing of its life.)
    `harder_only`: only from harder compounds (a soft's life from the hards'), never stretching
    a harder tyre past its own evidence from a softer one's (tyre-life fix 2)."""
    floors = [
        ratio * longest[other]
        for (c, other), ratio in LIFE_RATIO.items()
        if c == compound
        and stints.get(other, 0) >= THIN_STINTS
        and other in longest
        and (ratio < 1 or not harder_only)
    ]
    return min(round(GUESS_CAP * total_laps), round(max(floors))) if floors else None


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
    damp_pace: dict[str, float] | None = None,
    fault_facts: list[dict] | None = None,
    year: int | None = None,
    red_flags: list[dict] | None = None,
    refuel: dict | None = None,
    service_stops: bool = False,
    eras_stops: bool = False,
    stint_pace: bool = False,
) -> dict:
    """Build the race-model dict (validate + write it with export.write_race). `fault_facts`:
    the race's hand-checked car faults (incidents.fault_facts), fitted into FAULT events.
    `year` and `red_flags` (the race's red-flag file entries, redflag.load_entries) give each
    red flag its restart; races without one ignore them. `refuel`: a refuelling race's fill
    model (refuel.race_fill_model), stored as track.refuel; its laps carry the Tank and
    FuelLap columns (refuel.with_fuel_columns), so every fuel term below is the sim's.
    `service_stops` (Eras builds): each driver's stops that changed no tyres (a repair, a
    stop-go, a drive-through: track.service_stops) after the takeover, as drivers[].serviceStops
    at their measured loss in the sim frame. `eras_stops` (Eras builds): back-to-back stops
    count their shared lap once, and stops on laps partly under a local yellow are priced in the
    sim frame (track.stop_records, pace.sim_frame_losses). `stint_pace` (Eras builds, model fix
    M2): each car's pace offset by real stint (pace.stint_offsets), as drivers[].stintPace; the
    faults' and the stops' sim-frame fits then carry it too."""
    total_laps = int(laps["LapNumber"].max())
    cliffs = fit.compound_cliff
    longest = longest_stints(laps)
    stints = stint_counts(laps)

    def proven(compound: str) -> dict:
        """The longest stint run on it (the game's life never falls short of it)."""
        laps_run = longest.get(compound, 0)
        return {"provenLaps": laps_run} if laps_run >= 1 else {}

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
                **proven(compound),
            }
            continue
        compounds[compound] = {
            "offset": round(offset, 4),
            "degPerLap": round(fit.compound_wear[compound], 5),
            # No fitted cliff -> the edge of the evidence: the longest stint seen on this
            # compound. Past it the sim's fallback wear applies (spec D5), instead of assuming
            # the tyre never falls off.
            # (A softer tyre run only briefly still gets the life its harder ones suggest; a
            # harder one is never stretched by a softer one's: tyre-life fix 2.)
            "cliffLap": int(hinge[0])
            if hinge
            else max(
                longest.get(compound, total_laps),
                life_floor(compound, longest, stints, total_laps, harder_only=True) or 0,
            ),
            **({"cliffDegPerLap": round(hinge[1], 4)} if hinge else {}),
            **proven(compound),
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
    all_events = events_mod.extract_events(laps, total_laps)
    if any(e["type"] == "RED" for e in all_events) or red_flags:
        # Eras build plan 4.3: each red flag's span (hand-entered for untimed sources) and
        # restart (standing / rolling).
        all_events = redflag_mod.annotate_restarts(
            redflag_mod.apply_hand_spans(all_events, red_flags or []), red_flags or [], year
        )
    # An SC/VSC already running at the takeover is kept from the takeover lap to its end.
    future_events = events_mod.from_takeover(all_events, takeover_lap)
    facts = fault_facts or []
    takeover_state = scenario_mod.state_at_takeover(laps, takeover_lap)
    strategy = scenario_mod.real_strategy(laps)
    teams = _team_map(laps)
    # Real stops keep their measured time (spec B1): a slow or quick stop is a real event.
    measured = track_mod.measured_stop_losses(laps, takeover_lap, eras_stops)
    # Model v3 (spec B2a): each driver's pace over the laps the game replays.
    fresh = {"bonus": round(fit.fresh_tyre_bonus, 4), "laps": fit.fresh_tyre_laps}
    race_pace = pace_mod.post_takeover_offsets(
        faults_mod.without_fault_laps(laps, facts),  # a faulted car's normal pace
        fit.driver_pace,
        compounds,
        round(fit.fuel_per_lap, 5),
        fresh,
        takeover_lap,
        pace_mod.SHRINK_LAPS,
        weather,
        wear,
    )
    # Pace by stint (Eras model fix M2, pace.stint_offsets): fitted against the file's basePace.
    stint_table = (
        pace_mod.stint_offsets(
            faults_mod.without_fault_laps(laps, facts),
            {c: round(p + race_pace.get(c, 0.0), 4) for c, p in fit.driver_pace.items()},
            compounds,
            round(fit.fuel_per_lap, 5),
            fresh,
            takeover_lap,
            pace_mod.real_stops(strategy, takeover_lap),
            weather,
            wear,
        )
        if stint_pace
        else None
    )
    # Car faults (faults.py): fitted from the car's own laps against its sim pace; one that
    # struck before the takeover and still lasts is kept too (the sim runs it from then on).
    fault_events = faults_mod.fault_events(
        laps,
        facts,
        {c: round(p + race_pace.get(c, 0.0), 4) for c, p in fit.driver_pace.items()},
        compounds,
        round(fit.fuel_per_lap, 5),
        fresh,
        weather,
        stint_table,
    )
    future_events = events_mod.with_faults(
        future_events,
        [
            e
            for e in fault_events
            if e["lap"] >= takeover_lap or faults_mod.lasts_past(e, laps, takeover_lap)
        ],
    )
    if pace_mod.SIM_FRAME_LOSS:
        v3_pace = {c: p + race_pace.get(c, 0.0) for c, p in fit.driver_pace.items()}
        frame = pace_mod.sim_frame_losses(
            laps,
            v3_pace,
            compounds,
            round(fit.fuel_per_lap, 5),
            fresh,
            takeover_lap,
            weather,
            wear,
            wet_pace,
            eras_stops=eras_stops,
            damp_pace=damp_pace,
            stint=stint_table,
        )
        # A stop made with a fault: the sim adds the fault's cost to its laps itself.
        measured.update(faults_mod.adjust_stop_losses(frame, fault_events, laps))

    # Model v3 stage 9: a stop entered before an SC/VSC was deployed is a green-flag stop,
    # though its out-lap is neutralized (the sim prices a stop by its out-lap's flag).
    if track_status and track_params.pit_loss is not None:
        for key in events_mod.green_entry_stops(laps, all_events, track_status):
            measured.setdefault(key, track_params.pit_loss)
    # Red flags: a stop made in the stoppage is free; one entered before it pays its flag's
    # figure (the stoppage makes both unmeasurable).
    measured.update(
        redflag_mod.stop_losses(
            laps,
            all_events,
            track_status,
            track_params.pit_loss,
            track_params.pit_loss_under_sc,
            track_params.pit_loss_under_vsc,
        )
    )

    optional = (
        scenario_mod.fastest_lap_stops(laps, measured, track_params.pit_loss)
        if fastest_lap_point and track_params.pit_loss is not None
        else set()
    )

    # Stops with no tyre change (Eras sim fix 1): every car pays them on their real lap,
    # whatever its strategy, at the loss measured in the sim frame.
    service: dict[str, list[dict]] = {}
    if service_stops:
        v3_pace = {c: p + race_pace.get(c, 0.0) for c, p in fit.driver_pace.items()}
        frame = pace_mod.sim_frame_losses(
            laps,
            v3_pace,
            compounds,
            round(fit.fuel_per_lap, 5),
            fresh,
            takeover_lap,
            weather,
            wear,
            wet_pace,
            service=True,
            eras_stops=eras_stops,
            damp_pace=damp_pace,
            stint=stint_table,
        )
        for (code, out_lap), loss in sorted(frame.items()):
            if out_lap > takeover_lap:
                service.setdefault(code, []).append({"lap": out_lap, "loss": round(loss, 3)})

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
                **({"dampPace": damp_pace[code]} if damp_pace and code in damp_pace else {}),
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
                **({"serviceStops": service[code]} if code in service else {}),
                **(
                    {"stintPace": stint_table.entries(code)}
                    if stint_table and stint_table.entries(code)
                    else {}
                ),
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
            # A refuelling race's fill model: a new stop pays the pit loss (which holds a
            # typical fill, refFill) plus secondsPerLap x (its fill - refFill).
            **({"refuel": refuel} if refuel else {}),
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
