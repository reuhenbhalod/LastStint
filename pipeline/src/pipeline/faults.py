"""Car faults (simulator roadmap R2; eras build plan 4.4).

A fault from the real race: stuck in a gear, a power loss, a puncture or a failed tyre. It is
frozen on its real lap like a safety car, and flagged `storylineEvent`. In the race model it
is an event:

    {"lap": 37, "type": "FAULT", "driver": "ROS", "fault": "power-loss",
     "paceLoss": 2.1, "storylineEvent": true}

with optional `laps` (how long it lasts; absent: to the flag), `untilStop` (it lasts until the
car's next stop: a puncture or failed tyre is fixed by new tyres) and `slowLap` (extra seconds
on the fault's own lap: the forced slow lap). While a fault lasts its car loses `paceLoss` on
every green lap (neutralized laps run at the SC/VSC pace whatever the car); `slowLap` is added
once, on the fault's lap. Same rule in packages/sim/src/faults.ts (parity).

The facts (which lap, which car, what broke, how long, a source) are hand-checked and live in
data/incidents.json (incidents.fault_facts); the magnitudes are never guessed, they are fitted
here from that car's real lap times (fit_fault).

The fit is in the sim's own frame, like the real stops' losses (pace.sim_frame_losses). Each
of the car's usable laps (green, not an in- or out-lap, timed, on a modelled compound) gets a
residual: its real time minus the sim's clean lap for that car (its race-model base pace,
tyres, fuel). The pace loss is the mean residual over its usable laps while the fault lasts:
the constant that gives the sim's car the real car's time over those laps, so the real race
replays. A slow lap is the fault lap's own residual less the pace loss; when the fault lap is
the in-lap of the stop that fixed it, less the field's median in-lap residual too (the part of
an in-lap that is pit entry, not the fault). A fault fixed at once (a puncture with no laps
run on it before the stop) has no limping laps to fit: limping on costs what its measured
slow lap did, per lap. Anything else with too few laps raises: no invented magnitudes.
"""

from __future__ import annotations

import pandas as pd

from .sim_reference import Car, _clean_lap

FAULT_KINDS = ("gear-stuck", "power-loss", "puncture", "tyre-failure")
# By default a tyre fault lasts until the next stop and costs a forced slow lap; a gear or
# power fault lasts to the flag (a fact can say otherwise).
TYRE_FAULTS = ("puncture", "tyre-failure")
MIN_FAULT_LAPS = 1
DECIMALS = 3


class FaultFitError(ValueError):
    """The car's real laps can't support a fitted magnitude for this fault."""


def until_stop(fact: dict) -> bool:
    return bool(fact.get("untilStop", fact["fault"] in TYRE_FAULTS))


def has_slow_lap(fact: dict) -> bool:
    return bool(fact.get("slowLap", fact["fault"] in TYRE_FAULTS))


def residuals(
    laps: pd.DataFrame,
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    weather: dict | None = None,
) -> pd.DataFrame:
    """Every timed lap of a car in `base_pace` on a modelled compound: Driver, LapNumber,
    residual (real minus the sim's clean lap for the car), green, usable (green, not an in- or
    out-lap) and in_lap."""
    rows = []
    timed = laps[laps["LapTime"].notna() & laps["TyreLife"].notna()]
    for r in timed.itertuples():
        compound = None if pd.isna(r.Compound) else str(r.Compound)
        if compound not in compounds or str(r.Driver) not in base_pace:
            continue
        car = Car(
            code=str(r.Driver),
            base_pace=base_pace[str(r.Driver)],
            noise=0.0,
            compound=compound,
            tyre_age=max(0, int(r.TyreLife) - 1),  # the sim's age while running this lap
            total_time=0.0,
        )
        lap = int(r.LapNumber)
        predicted = _clean_lap(car, compounds, fuel_per_lap, lap, fresh_tyre, weather)
        in_lap = not pd.isna(r.PitInTime)
        out_lap = not pd.isna(r.PitOutTime)
        rows.append(
            {
                "Driver": str(r.Driver),
                "LapNumber": lap,
                "residual": float(r.LapTime) - predicted,
                "green": str(r.TrackStatus) == "1",
                "usable": str(r.TrackStatus) == "1" and not in_lap and not out_lap,
                "in_lap": in_lap,
            }
        )
    return pd.DataFrame(
        rows, columns=["Driver", "LapNumber", "residual", "green", "usable", "in_lap"]
    )


def stop_out_laps(laps: pd.DataFrame, driver: str) -> list[int]:
    """The car's out-laps (the sim's stop laps)."""
    own = laps[(laps["Driver"] == driver) & laps["PitOutTime"].notna()]
    return sorted(int(n) for n in own["LapNumber"])


def fault_window(laps: pd.DataFrame, fact: dict) -> range:
    """The race laps the fault lasts in the real race: from its lap for `laps` laps, or until
    the stop that fixed it (to the in-lap), or to the car's last lap."""
    own = laps[laps["Driver"] == fact["driver"]]
    last = int(own["LapNumber"].max())
    start = int(fact["lap"])
    if fact.get("laps"):
        return range(start, min(last, start + int(fact["laps"]) - 1) + 1)
    if until_stop(fact):
        nxt = [n for n in stop_out_laps(laps, fact["driver"]) if n > start]
        if nxt:
            return range(start, nxt[0])
    return range(start, last + 1)


def in_lap_excess(res: pd.DataFrame, exclude: str | None = None) -> float:
    """The field's median green in-lap residual (less car `exclude`'s): the part of an in-lap
    that is pit entry."""
    ins = res[res["in_lap"] & res["green"] & (res["Driver"] != exclude)]
    return float(ins["residual"].median()) if not ins.empty else 0.0


def fit_fault(
    laps: pd.DataFrame,
    fact: dict,
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    weather: dict | None = None,
    res: pd.DataFrame | None = None,
) -> dict:
    """The FAULT event for one fact, its magnitudes fitted from the car's real laps against
    the sim's clean laps for it (`base_pace`: the race model's basePace per car)."""
    if res is None:
        res = residuals(laps, base_pace, compounds, fuel_per_lap, fresh_tyre, weather)
    code, start = fact["driver"], int(fact["lap"])
    where = f"{code} {fact['fault']} on lap {start}"
    own = res[res["Driver"] == code]
    if own.empty:
        raise FaultFitError(f"{where}: the car has no modelled laps")

    window = fault_window(laps, fact)
    slow = has_slow_lap(fact)
    during = own[own["usable"] & own["LapNumber"].isin(window)]
    if slow:
        during = during[during["LapNumber"] != start]
    pace_loss: float | None = None
    if len(during) >= MIN_FAULT_LAPS:
        pace_loss = max(0.0, float(during["residual"].mean()))

    slow_lap: float | None = None
    if slow:
        row = own[(own["LapNumber"] == start) & own["green"]]
        if row.empty:
            raise FaultFitError(f"{where}: the fault lap isn't a timed green lap")
        excess = float(row["residual"].iloc[0])
        if bool(row["in_lap"].iloc[0]):
            excess -= in_lap_excess(res, code)
        slow_lap = max(0.0, excess - (pace_loss or 0.0))

    if pace_loss is None:
        if until_stop(fact) and slow_lap is not None:
            # Fixed at the first stop, nothing run on it: limping on a lap costs what the
            # measured slow lap did.
            pace_loss = slow_lap
        else:
            raise FaultFitError(
                f"{where}: {len(during)} usable laps while it lasts (need {MIN_FAULT_LAPS})"
            )

    event: dict = {
        "lap": start,
        "type": "FAULT",
        "driver": code,
        "fault": fact["fault"],
        "paceLoss": round(pace_loss, DECIMALS),
    }
    if fact.get("laps"):
        event["laps"] = int(fact["laps"])
    if until_stop(fact):
        event["untilStop"] = True
    if slow_lap is not None:
        event["slowLap"] = round(slow_lap, DECIMALS)
    event["storylineEvent"] = True
    return event


def split_retired(laps: pd.DataFrame, facts: list[dict]) -> tuple[list[dict], list[str]]:
    """(the facts to fit, a note for each one set aside). A fault whose car never completed
    its fault lap (its last lap in the data is before it: it retired there, e.g. a tyre
    failure into the wall) has no laps to fit and nothing to add to the race, since the car's
    RETIREMENT event on that lap already takes it out. Such a fact is kept out of the FAULT
    events, never given a guessed magnitude."""
    kept: list[dict] = []
    notes: list[str] = []
    for f in facts:
        own = laps.loc[laps["Driver"] == f["driver"], "LapNumber"]
        if not own.empty and int(own.max()) < int(f["lap"]):
            notes.append(
                f"{f['driver']} {f['fault']} on lap {f['lap']}: the car retired on its fault"
                f" lap (last lap {int(own.max())}), so its RETIREMENT event carries it;"
                " no FAULT event"
            )
            continue
        kept.append(f)
    return kept, notes


def fault_events(
    laps: pd.DataFrame,
    facts: list[dict],
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    weather: dict | None = None,
) -> list[dict]:
    """The FAULT events for a race's facts (incidents.fault_facts), sorted by lap."""
    if not facts:
        return []
    res = residuals(laps, base_pace, compounds, fuel_per_lap, fresh_tyre, weather)
    out = [
        fit_fault(laps, f, base_pace, compounds, fuel_per_lap, fresh_tyre, weather, res)
        for f in facts
    ]
    return sorted(out, key=lambda e: (e["lap"], e["driver"]))


def lasts_past(fact: dict, laps: pd.DataFrame, lap: int) -> bool:
    """True if the fault is still on after race lap `lap` in the real race (a game taking
    over then still needs it)."""
    window = fault_window(laps, fact)
    return len(window) > 0 and window[-1] > lap


def fault_laps(
    frame: pd.DataFrame, facts: list[dict], laps: pd.DataFrame | None = None
) -> pd.Series:
    """True for each row of `frame` that the facts' faults touch, their windows taken from the
    race's full `laps` (default: `frame` itself)."""
    ref = frame if laps is None else laps
    hit = pd.Series(False, index=frame.index)
    for f in facts:
        window = fault_window(ref, f)
        hit |= (frame["Driver"] == f["driver"]) & frame["LapNumber"].isin(window)
    return hit


def without_fault_laps(
    frame: pd.DataFrame, facts: list[dict], laps: pd.DataFrame | None = None
) -> pd.DataFrame:
    """`frame` less the rows a fault touches, so the car's normal pace is fitted on its normal
    laps (the same frame, untouched, when there are no faults)."""
    if not facts:
        return frame
    return frame[~fault_laps(frame, facts, laps)]


def lap_cost(event: dict, lap: int, green: bool) -> float:
    """What the fault adds to its car's lap `lap` while it lasts: the pace loss on a green
    lap, plus the slow lap on its own lap. (Whether it lasts is FaultState's job.)"""
    cost = event["paceLoss"] if green else 0.0
    if lap == event["lap"]:
        cost += event.get("slowLap", 0.0)
    return cost


def adjust_stop_losses(
    losses: dict[tuple[str, int], float], events: list[dict], laps: pd.DataFrame
) -> dict[tuple[str, int], float]:
    """Sim-frame stop losses (pace.sim_frame_losses) less the fault cost the sim adds to the
    stop's in-lap itself (its out-lap is past an until-stop fault, but a lasting fault costs
    it too), so a real stop made with a fault still replays its real time."""
    if not events:
        return losses
    out = dict(losses)
    for (code, out_lap), loss in losses.items():
        stops = stop_out_laps(laps, code)
        for e in events:
            if e["driver"] != code:
                continue
            if e.get("untilStop") and any(e["lap"] < s < out_lap for s in stops):
                continue  # an earlier stop fixed it
            for lap in (out_lap - 1, out_lap):
                if lap < e["lap"] or (e.get("laps") and lap >= e["lap"] + e["laps"]):
                    continue
                if e.get("untilStop") and lap >= out_lap and out_lap > e["lap"]:
                    continue  # the stop fixed it: the out-lap is on new tyres
                loss -= lap_cost(e, lap, True)
        out[(code, out_lap)] = loss
    return out


class FaultState:
    """The faults of one simulated race and which have ended (an until-stop fault ends at the
    car's next stop). Mirrors faults.ts."""

    def __init__(self, events: list[dict]):
        self.by_car: dict[str, list[dict]] = {}
        for e in events:
            if e["type"] == "FAULT":
                self.by_car.setdefault(e["driver"], []).append(e)
        self.ended: set[int] = set()

    def cost(self, code: str, lap: int, pitted: bool, green: bool) -> tuple[float, float]:
        """(pace, extra) for the car's lap: `pace` belongs to its model pace (green laps, the
        pass model sees it), `extra` is the slow lap, on top. A stop on this lap (its out-lap)
        after an until-stop fault's lap ends it first."""
        faults = self.by_car.get(code)
        if not faults:
            return 0.0, 0.0
        pace = extra = 0.0
        for e in faults:
            key = id(e)
            if key in self.ended or lap < e["lap"]:
                continue
            if e.get("laps") and lap >= e["lap"] + e["laps"]:
                continue
            if e.get("untilStop") and pitted and lap > e["lap"]:
                self.ended.add(key)
                continue
            if green:
                pace += e["paceLoss"]
            if lap == e["lap"]:
                extra += e.get("slowLap", 0.0)
        return pace, extra
