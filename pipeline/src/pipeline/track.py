"""Track parameters (Phase 1.4).

Fits the track-level constants the simulator needs:

- pit loss under green, VSC (both measured) and SC (estimated),
- dirty-air penalty (time lost per lap stuck behind a car),
- safety-car and virtual-safety-car lap times,
- overtaking difficulty (share of close-following laps without a pass, for display) and
  the overtake model the simulator rolls against: logistic P(pass) on the follower's
  model pace advantage and the gap.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .clean import gap_to_car_ahead, tyre_change_out_laps
from .fit import LapTimeFit, predict


@dataclass
class TrackParams:
    pit_loss: float | None
    pit_loss_under_sc: float | None
    pit_loss_under_vsc: float | None
    dirty_air_penalty: float
    overtake_difficulty: float
    green_lap_time: float
    sc_lap_time: float | None
    vsc_lap_time: float | None
    n_pass_opportunities: int
    n_passes: int
    overtake_model: dict[str, float] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)  # where a fallback/estimate was used


def _status(laps: pd.DataFrame) -> pd.Series:
    return laps["TrackStatus"].astype("string")


def _is_neutralized(status_value: object) -> bool:
    """A lap that ran under SC (code 4) or VSC (codes 6/7) for any part."""
    s = "" if status_value is None else str(status_value)
    return any(code in s for code in ("4", "6", "7"))


def pit_stops(laps: pd.DataFrame) -> list[tuple[str, pd.Series, pd.Series]]:
    """Return (driver, in_lap, out_lap) for each pit stop (in-lap paired with next out-lap).

    Only stops where tyres changed count (clean.tyre_change_out_laps).
    """
    stops: list[tuple[str, pd.Series, pd.Series]] = []
    changed = tyre_change_out_laps(laps)
    for driver, grp in laps.groupby("Driver"):
        grp = grp.sort_values("LapNumber")
        for _, in_lap in grp[grp["PitInTime"].notna()].iterrows():
            out = grp[(grp["LapNumber"] == in_lap["LapNumber"] + 1) & changed.loc[grp.index]]
            if len(out):
                stops.append((str(driver), in_lap, out.iloc[0]))
    return stops


# Under a safety car the field bunches behind the SC car, so lap times on those laps mix the
# bunching lap with steady SC pace and a stop's in/out laps can't be compared with the
# field's (the comparison comes out negative). We estimate it as a fraction of the green
# loss instead; the product doc's own example is 12.1/21.4 ~= 0.55. Refinable later with
# telemetry or pooled races.
SC_PIT_LOSS_FACTOR = 0.55
# Under a VSC the field keeps its gaps at a fixed delta, so VSC stops CAN be measured against
# same-lap non-pitters. With fewer than MIN_VSC_STOPS measured, fall back to this fraction of
# the green loss (Abu Dhabi 2021 measures ~0.82).
VSC_PIT_LOSS_FACTOR = 0.8
MIN_VSC_STOPS = 2


def _has_sc(status_value: object) -> bool:
    return "4" in ("" if status_value is None else str(status_value))


def _has_vsc(status_value: object) -> bool:
    s = "" if status_value is None else str(status_value)
    return "6" in s or "7" in s


def stop_losses(laps: pd.DataFrame) -> list[tuple[str, str, float]]:
    """Per pit stop: (driver, flag, loss). Loss = in-lap + out-lap minus the median lap time
    of cars that did not pit on those same laps, so fuel, track evolution and neutralized
    pace cancel out, minus twice the driver's own green-lap pace offset to that field median,
    so a slow car's slow in/out laps aren't counted as pit time. Flag is "SC" if either lap
    touched a safety car, "VSC" if either touched a virtual safety car, else "green".
    """
    stops = pit_stops(laps)
    pitting = set()
    for driver, in_lap, out_lap in stops:
        pitting.add((driver, int(in_lap["LapNumber"])))
        pitting.add((driver, int(out_lap["LapNumber"])))
    timed = laps[laps["LapTime"].notna()]
    keys = list(zip(timed["Driver"].astype(str), timed["LapNumber"].astype(int), strict=True))
    non_pit = timed[[k not in pitting for k in keys]]
    field_median = non_pit.groupby("LapNumber")["LapTime"].median()
    green = non_pit[non_pit["TrackStatus"].astype(str) == "1"]
    pace_offset = (
        (green["LapTime"] - green["LapNumber"].map(field_median)).groupby(green["Driver"]).median()
    )

    out: list[tuple[str, str, float]] = []
    for driver, in_lap, out_lap in stops:
        if pd.isna(in_lap["LapTime"]) or pd.isna(out_lap["LapTime"]):
            continue
        laps_used = (in_lap["LapNumber"], out_lap["LapNumber"])
        if any(lap not in field_median.index for lap in laps_used):
            continue
        statuses = (in_lap["TrackStatus"], out_lap["TrackStatus"])
        if any(_has_sc(st) for st in statuses):
            flag = "SC"
        elif any(_has_vsc(st) for st in statuses):
            flag = "VSC"
        else:
            flag = "green"
        reference = sum(float(field_median[lap]) for lap in laps_used)
        reference += 2 * float(pace_offset.get(driver, 0.0))
        loss = float(in_lap["LapTime"]) + float(out_lap["LapTime"]) - reference
        out.append((driver, flag, loss))
    return out


def pit_loss(laps: pd.DataFrame) -> float | None:
    """Green-flag pit loss: median over green stops of `stop_losses`. None if no stops."""
    losses = [loss for _, flag, loss in stop_losses(laps) if flag == "green"]
    return float(pd.Series(losses).median()) if losses else None


def pit_loss_under_vsc(laps: pd.DataFrame) -> tuple[float | None, int]:
    """Median VSC-stop loss and how many VSC stops it rests on (None if none measured)."""
    losses = [loss for _, flag, loss in stop_losses(laps) if flag == "VSC"]
    return (float(pd.Series(losses).median()) if losses else None), len(losses)


def dirty_air_penalty(traffic_laps: pd.DataFrame, fit: LapTimeFit) -> float:
    """Median seconds lost on a traffic lap vs the free-air pace the model predicts."""
    if traffic_laps.empty:
        return 0.0
    predicted = [
        predict(fit, r.Driver, r.Compound, r.TyreLife, r.LapNumber)
        for r in traffic_laps.itertuples()
    ]
    residual = traffic_laps["LapTime"].astype(float).to_numpy() - predicted
    return float(pd.Series(residual).median())


def sc_vsc_lap_times(laps: pd.DataFrame) -> dict[str, float | None]:
    """Median green / SC / VSC lap times, excluding pit in/out laps."""
    status = _status(laps)
    on_track = laps["LapTime"].notna() & laps["PitInTime"].isna() & laps["PitOutTime"].isna()

    def median_where(mask: pd.Series) -> float | None:
        vals = laps.loc[mask & on_track, "LapTime"]
        return float(vals.median()) if len(vals) else None

    is_sc = status.str.contains("4", na=False)
    is_vsc = (status.str.contains("6", na=False) | status.str.contains("7", na=False)) & ~is_sc
    return {
        "green": median_where(status == "1"),
        "sc": median_where(is_sc),
        "vsc": median_where(is_vsc),
    }


def extract_pass_events(laps: pd.DataFrame, close_gap: float = 2.0) -> pd.DataFrame:
    """On-track pass opportunities: a car within `close_gap` of the car ahead, and whether it
    got past on the next lap. Pit-stop-driven position swaps are excluded.
    """
    work = laps.copy()
    work["_gap"] = gap_to_car_ahead(work)
    pos = {(int(r.LapNumber), r.Driver): r.Position for r in work.itertuples()}
    lt = {(int(r.LapNumber), r.Driver): r.LapTime for r in work.itertuples()}
    pitting = {
        (int(r.LapNumber), r.Driver)
        for r in work.itertuples()
        if not pd.isna(r.PitInTime) or not pd.isna(r.PitOutTime)
    }

    rows: list[dict] = []
    for lap_num, grp in work.groupby("LapNumber"):
        lap = int(lap_num)
        order = grp.dropna(subset=["Position"]).sort_values("Position")
        codes = list(order["Driver"])
        gaps = dict(zip(order["Driver"], order["_gap"], strict=False))
        for i in range(1, len(codes)):
            follower, leader = codes[i], codes[i - 1]
            gap = gaps.get(follower)
            if gap is None or pd.isna(gap) or gap > close_gap:
                continue
            if any((lap, c) in pitting or (lap + 1, c) in pitting for c in (follower, leader)):
                continue
            pf, pl = pos.get((lap + 1, follower)), pos.get((lap + 1, leader))
            lf, ll = lt.get((lap, follower)), lt.get((lap, leader))
            if pf is None or pl is None or pd.isna(lf) or pd.isna(ll):
                continue
            rows.append(
                {
                    "lap": lap,
                    "follower": follower,
                    "leader": leader,
                    "gap": float(gap),
                    "pace_delta": float(ll - lf),  # positive: follower was quicker this lap
                    "passed": bool(pf < pl),
                }
            )
    return pd.DataFrame(rows)


def overtake_difficulty(laps: pd.DataFrame, close_gap: float = 2.0) -> tuple[float, int, int]:
    """Scalar difficulty in [0, 1] = share of close-following opportunities that did NOT pass.

    Returns (difficulty, n_opportunities, n_passes). Falls back to 0.5 with no data.
    """
    events = extract_pass_events(laps, close_gap=close_gap)
    n = len(events)
    if n == 0:
        return 0.5, 0, 0
    passes = int(events["passed"].sum())
    return 1.0 - passes / n, n, passes


# Overtake model fallback: between the Abu Dhabi and Spain 2021 fits. Used when a race has
# too few passes to fit, or the fit has the wrong signs.
DEFAULT_OVERTAKE_MODEL = {"intercept": 0.5, "paceCoef": 2.0, "gapCoef": -5.0}
MIN_PASSES = 8


def fit_overtake_model(
    laps: pd.DataFrame, fit: LapTimeFit, close_gap: float = 2.0
) -> tuple[dict[str, float], str | None]:
    """Logistic P(pass next lap) = sigmoid(intercept + paceCoef*adv + gapCoef*gap).

    `adv` is the follower's MODEL pace advantage (leader's predicted lap minus follower's,
    from the fitted lap-time model), the same quantity the simulator compares, rather than
    the observed lap delta (which the pass itself distorts). Returns (model, note); the note
    is set when the default model was used.
    """
    import statsmodels.api as sm

    events = extract_pass_events(laps, close_gap=close_gap)
    if events.empty:
        return dict(DEFAULT_OVERTAKE_MODEL), "overtakeModel: no pass opportunities, default"
    state = {
        (int(r.LapNumber), str(r.Driver)): r
        for r in laps.itertuples()
        if not pd.isna(r.Compound) and not pd.isna(r.TyreLife)
    }

    def predicted(driver: str, lap: int) -> float:
        r = state.get((lap, driver))
        if r is None or driver not in fit.driver_pace:
            return float("nan")
        return predict(fit, driver, str(r.Compound), float(r.TyreLife), lap)

    events = events.assign(
        adv=[predicted(e.leader, e.lap) - predicted(e.follower, e.lap) for e in events.itertuples()]
    ).dropna(subset=["adv"])
    n_passes = int(events["passed"].sum())
    if n_passes < MIN_PASSES:
        return dict(DEFAULT_OVERTAKE_MODEL), f"overtakeModel: {n_passes} passes, default"
    x = sm.add_constant(events[["adv", "gap"]].astype(float))
    try:
        params = sm.Logit(events["passed"].astype(float), x).fit(disp=0).params
    except Exception:  # perfect separation / non-convergence on thin data
        return dict(DEFAULT_OVERTAKE_MODEL), "overtakeModel: fit failed, default"
    if params["adv"] <= 0 or params["gap"] >= 0:
        return dict(DEFAULT_OVERTAKE_MODEL), "overtakeModel: wrong-signed fit, default"
    model = {
        "intercept": float(params["const"]),
        "paceCoef": float(params["adv"]),
        "gapCoef": float(params["gap"]),
    }
    return model, None


def fit_track_params(
    laps: pd.DataFrame,
    clean_laps: pd.DataFrame,
    traffic_laps: pd.DataFrame,
    fit: LapTimeFit,
) -> TrackParams:
    """Fit every track-level parameter from one race."""
    times = sc_vsc_lap_times(laps)
    difficulty, n_opp, n_pass = overtake_difficulty(laps)
    green = times["green"]
    green_pit = pit_loss(laps)
    notes: list[str] = []
    sc_pit = green_pit * SC_PIT_LOSS_FACTOR if green_pit is not None else None
    notes.append(f"pitLossUnderSC estimated as {SC_PIT_LOSS_FACTOR} x green")
    vsc_pit, n_vsc = pit_loss_under_vsc(laps)
    if n_vsc < MIN_VSC_STOPS:
        vsc_pit = green_pit * VSC_PIT_LOSS_FACTOR if green_pit is not None else None
        notes.append(
            f"pitLossUnderVSC: {n_vsc} VSC stops measured, using {VSC_PIT_LOSS_FACTOR} x green"
        )
    overtake, overtake_note = fit_overtake_model(laps, fit)
    if overtake_note:
        notes.append(overtake_note)
    return TrackParams(
        overtake_model=overtake,
        pit_loss=green_pit,
        pit_loss_under_sc=sc_pit,
        pit_loss_under_vsc=vsc_pit,
        dirty_air_penalty=dirty_air_penalty(traffic_laps, fit),
        overtake_difficulty=difficulty,
        green_lap_time=green if green is not None else float("nan"),
        sc_lap_time=times["sc"],
        vsc_lap_time=times["vsc"],
        n_pass_opportunities=n_opp,
        n_passes=n_pass,
        notes=notes,
    )
