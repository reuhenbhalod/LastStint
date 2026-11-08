"""Refuelling (1994-2009, and 1983) and fuel limits (1984-88): eras build plan 4.2, roadmap R4.

Mirrors packages/sim/src/refuel.ts (the model and the fill choices are documented there). The
reference sim replays real strategies, so here the refuelling replay runs in full (every car's
tank, its weight, the fill time of a stop without a measured loss); the fill choice and the
fuel-limit tank are the player's, live play only (TS), and are checked here as functions
(the parity vectors in tests/test_refuel.py).

Fuel is counted in laps at the standard burn. The fill rate is fitted per race from the real
stops (F1DB pit-lane times, data/raw/f1db/<race>.stops.csv): lane time = laneBase +
secondsPerLap x the next stint's laps (a team fuelled for the stint it planned). Stops more
than SLOW_STOP s over the race's median lane time are left out (a problem, a penalty, a
repair). The race's least-squares slope is noisy (a stop's time also holds the tyre change
and the driver's entry and exit), so it is shrunk toward the pooled slope of every refuelling
race in data/raw/f1db by inverse variance (a random-effects pool; PRIOR_SECONDS_PER_LAP and
PRIOR_TAU). The race file stores the result as track.refuel.

Rules by year (checked Nov 7, 2026):
- Refuelling allowed until 1983, banned 1984-93, allowed 1994-2009, banned from 2010:
  Wikipedia, "Pit stop" ("Refuelling ... was permitted until 1983, and then again from the
  1994 season to the 2009 season"; "mid-race refuelling has been banned since 2010");
  Wikipedia, "1984 Formula One World Championship" ("Refuelling was banned").
- Fuel allowance per race (turbo cars), with no refuelling:
  - 1984-85: 220 L (Wikipedia, "1984 Formula One World Championship": "Turbocharged cars
    would be limited to 220 L of fuel per race"; Motorsport Magazine's turbo-era table:
    1985 220 lt);
  - 1986: 195 L (Wikipedia, "1986 Formula One World Championship": "Fuel use during the race
    was limited from 220 L to 195 L");
  - 1987: 195 L for turbos, naturally aspirated cars unlimited (Wikipedia, "1987 Formula One
    World Championship");
  - 1988: 150 L for turbos, naturally aspirated cars unlimited (Honda, "1988 RA168E": "the
    maximum fuel capacity was lowered from 195L to 150L"; Wikipedia's 1988 season page says
    155 L, so the engine maker's figure is used).
  The race-level rule applies to the player's car; every appendix race of 1987-88
  (great-britain-1987, monaco-1988) is a turbo car's (Williams-Honda, McLaren-Honda).
- Litres to kg: the allowance was set by volume, so teams ran dense toluene blends. AGIP
  (Ferrari's supplier) recalled densities "of up to 0.85" (Luciano Nicastro, AGIP R&D, in
  Enrico Benzing's "Ferrari Formula 1 Annual 1990", p185, quoted by McCabism, "BMW's F1 'rocket
  fuel' and aromatic hydrocarbons", Sep 3 2015). FUEL_DENSITY = 0.85 kg/L.
- Running out of fuel stops the car: San Marino 1985, "a succession of drivers ran out of fuel
  in the last few laps" (Wikipedia, "1985 San Marino Grand Prix").
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from .paths import DATA_DIR, RAW_DIR

RESERVE_LAPS = 1  # laps of fuel every fill (and the takeover load) carries over the stint
FILL_CHOICES = ("short", "standard", "long")
SLOW_STOP = 4.0  # s over the race's median lane time: left out of the fit
REFUEL_YEARS = (1983, *range(1994, 2010))
FUEL_LIMIT_LITRES = {1984: 220, 1985: 220, 1986: 195, 1987: 195, 1988: 150}
FUEL_DENSITY = 0.85  # kg/L (AGIP's turbo-era fuel, see above)
# The pooled fill rate over the refuelling races in data/raw/f1db (pooled_prior(); a test
# recomputes it): the random-effects mean (s per lap of fuel) and the between-race sd.
PRIOR_SECONDS_PER_LAP = 0.0648
PRIOR_TAU = 0.0908

F1DB_DIR = RAW_DIR / "f1db"
ERAS_OVERLAY_DIR = DATA_DIR / "eras"


# --- The rules by year ------------------------------------------------------------------------


def fuel_limit_kg(year: int) -> float | None:
    """The race fuel allowance in kg for `year` (1984-88), or None."""
    litres = FUEL_LIMIT_LITRES.get(year)
    return None if litres is None else round(litres * FUEL_DENSITY, 2)


def r4_rules_for_year(year: int) -> dict:
    """The two `rules` keys this step owns: refuelling, and fuelLimit where there was one."""
    out: dict = {"refuelling": year in REFUEL_YEARS}
    kg = fuel_limit_kg(year)
    if kg is not None:
        out["fuelLimit"] = kg
    return out


def write_r4_overlays(race_ids: list[str], out_dir: Path = ERAS_OVERLAY_DIR) -> list[Path]:
    """Set rules.refuelling and rules.fuelLimit in data/eras/<id>.json from each race's year,
    leaving every other key as it is."""
    written = []
    for race_id in race_ids:
        path = out_dir / f"{race_id}.json"
        overlay = json.loads(path.read_text()) if path.exists() else {}
        rules = dict(overlay.get("rules") or {})
        rules.pop("fuelLimit", None)
        rules.update(r4_rules_for_year(int(race_id.rsplit("-", 1)[1])))
        overlay["rules"] = rules
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(overlay, indent=2) + "\n")
        written.append(path)
    return written


# --- The tank in the reference sim (refuel.ts) --------------------------------------------------


def refuelling(model: dict) -> bool:
    return (model.get("rules") or {}).get("refuelling") is True


def refuel_model(model: dict) -> dict:
    """The race's fill model: its fit, or the pooled prior with the tank holding the race."""
    return model["track"].get("refuel") or {
        "secondsPerLap": PRIOR_SECONDS_PER_LAP,
        "laneBase": 0.0,
        "refFill": 0.0,
        "tankLaps": int(model["race"]["laps"]),
        "stops": 0,
    }


def fill_stint(choice: str, remaining: int, tank_laps: float) -> int:
    """The laps the player's fill fuels from the out-lap (refuel.ts fillStint): long brims the
    tank (to the flag if it fits), standard splits what's left evenly over the fewest stints,
    short over one stint more."""
    r = max(0, remaining)
    if r == 0:
        return 0
    cap = max(1, math.floor(tank_laps))
    n = math.ceil(r / cap)
    if choice == "long":
        return min(r, cap)
    if choice == "standard":
        return math.ceil(r / n)
    return math.ceil(r / (n + 1))


def stint_to_next_stop(strategy: list[dict], out_lap: int, laps: int) -> int:
    """Laps from `out_lap` to the in-lap of the next stop in `strategy`, or to the flag."""
    nxt = laps + 1
    for s in strategy:
        if out_lap < s["lap"] < nxt:
            nxt = s["lap"]
    return nxt - out_lap


def takeover_tank(strategy: list[dict], takeover: int, laps: int) -> int:
    return stint_to_next_stop(strategy, takeover, laps) - 1 + RESERVE_LAPS


def init_tanks(model: dict, cars: dict) -> None:
    """Every car's takeover tank, from its strategy (the reference sim scripts every car)."""
    if not refuelling(model):
        return
    laps = int(model["race"]["laps"])
    takeover = int(model["race"]["takeoverLap"])
    for car in cars.values():
        car.tank = float(takeover_tank(car.strategy, takeover, laps))
        car.race_laps = laps


def refuel_at_stop(model: dict, car, stop: dict, out_lap: int) -> float:
    """Fill the tank at a stop (already off the car's strategy); returns the fill time over
    the stop's base cost (refuel.ts refuelAtStop)."""
    if not refuelling(model) or car.tank is None:
        return 0.0
    rm = refuel_model(model)
    laps = int(model["race"]["laps"])
    if stop.get("fill"):
        stint = fill_stint(stop["fill"], laps - out_lap + 1, rm["tankLaps"])
    else:
        stint = stint_to_next_stop(car.strategy, out_lap, laps)
    target = stint + RESERVE_LAPS
    fill = max(0.0, target - car.tank)
    car.tank = max(car.tank, float(target))
    if "loss" in stop:
        if not stop.get("fill"):
            return 0.0
        real = next(d for d in model["drivers"] if d["code"] == car.code)["realStrategy"]
        real_stint = stint_to_next_stop([s for s in real if s["lap"] != out_lap], out_lap, laps)
        return rm["secondsPerLap"] * (stint - real_stint)
    return rm["secondsPerLap"] * (fill - rm["refFill"])


def tank_weight_delta(car, fuel_per_lap: float, lap: int) -> float:
    """The weight's lap-time term over the single-tank model (0 without a tank)."""
    if car.tank is None:
        return 0.0
    return fuel_per_lap * (max(0.0, car.tank) - (car.race_laps - lap + 1))


def burn_tank(car) -> None:
    """A replay burns one lap of fuel a lap."""
    if car.tank is not None:
        car.tank -= 1.0


# --- The fill-rate fit ------------------------------------------------------------------------


def stints_from_stops(stops: pd.DataFrame, finished: dict[int, int] | None = None) -> pd.DataFrame:
    """The real stops with the stint each fuelled: [number, lap (the in-lap), stint, lane].

    `stops`: F1DB's [number, lap, lane_time]. A stop's stint runs to the car's next in-lap;
    the last stop's to the laps the car completed, when it finished (`finished`: car number ->
    laps completed); a retired car's last stop is left out (its planned stint is unknown).
    """
    rows = []
    for number, grp in stops.groupby("number"):
        grp = grp.sort_values("lap")
        laps = grp["lap"].astype(int).tolist()
        lane = grp["lane_time"].astype(float).tolist()
        for i, (lap, t) in enumerate(zip(laps, lane, strict=True)):
            if i + 1 < len(laps):
                stint = laps[i + 1] - lap
            elif finished and int(number) in finished:
                stint = finished[int(number)] - lap
            else:
                continue
            if stint > 0 and not math.isnan(t):
                rows.append((int(number), lap, stint, t))
    return pd.DataFrame(rows, columns=["number", "lap", "stint", "lane"])


def _ols(stints: pd.DataFrame) -> tuple[float, float, float, pd.DataFrame]:
    """Least squares of lane on stint, slow stops out: (slope, intercept, slope's se, kept)."""
    kept = stints[stints["lane"] <= stints["lane"].median() + SLOW_STOP]
    x = kept["stint"].to_numpy(float)
    y = kept["lane"].to_numpy(float)
    if len(kept) < 3 or np.ptp(x) == 0:
        return float("nan"), float(np.mean(y)) if len(y) else float("nan"), float("inf"), kept
    xc = x - x.mean()
    slope = float((xc * (y - y.mean())).sum() / (xc * xc).sum())
    intercept = float(y.mean() - slope * x.mean())
    resid = y - intercept - slope * x
    se = float(np.sqrt((resid @ resid) / (len(x) - 2) / (xc * xc).sum()))
    return slope, intercept, se, kept


def fit_fill_rate(stints: pd.DataFrame, prior: tuple[float, float] | None = None) -> dict:
    """The race's fill model (track.refuel) from its stints (stints_from_stops)."""
    mu, tau = prior if prior is not None else (PRIOR_SECONDS_PER_LAP, PRIOR_TAU)
    slope, _, se, kept = _ols(stints)
    if math.isnan(slope) or not math.isfinite(se) or tau <= 0:
        rate = mu
    else:
        w_race, w_prior = 1.0 / max(se, 1e-6) ** 2, 1.0 / tau**2
        rate = (slope * w_race + mu * w_prior) / (w_race + w_prior)
    rate = max(0.0, rate)
    ref_fill = float(kept["stint"].mean())
    lane_base = float(kept["lane"].mean() - rate * ref_fill)
    return {
        "secondsPerLap": round(rate, 4),
        "laneBase": round(lane_base, 3),
        "refFill": round(ref_fill, 3),
        "tankLaps": int(stints["stint"].max()),
        "stops": int(len(kept)),
    }


def race_slope(stints: pd.DataFrame) -> dict:
    """The race's own least-squares fit, unshrunk (for reports)."""
    slope, intercept, se, kept = _ols(stints)
    return {"slope": slope, "intercept": intercept, "se": se, "stops": int(len(kept))}


def pooled_prior(f1db_dir: Path = F1DB_DIR) -> tuple[float, float]:
    """The random-effects pool (DerSimonian-Laird) of the per-race slopes over the stops of
    every refuelling race in `f1db_dir`, from the stints between two stops (no results
    needed). Returns (mean, between-race sd)."""
    slopes, ses = [], []
    for path in sorted(f1db_dir.glob("*.stops.csv")):
        year = int(path.name.split(".")[0].rsplit("-", 1)[1])
        if year not in REFUEL_YEARS:
            continue
        slope, _, se, kept = _ols(stints_from_stops(pd.read_csv(path)))
        if len(kept) >= 8 and math.isfinite(se) and not math.isnan(slope):
            slopes.append(slope)
            ses.append(se)
    b, v = np.array(slopes), np.array(ses) ** 2
    w = 1.0 / v
    fixed = float((w * b).sum() / w.sum())
    q = float((w * (b - fixed) ** 2).sum())
    tau2 = max(0.0, (q - (len(b) - 1)) / (w.sum() - (w * w).sum() / w.sum()))
    w_re = 1.0 / (v + tau2)
    return float((w_re * b).sum() / w_re.sum()), float(math.sqrt(tau2))


# --- The weight in the pace fit ---------------------------------------------------------------


def effective_lap(
    laps: pd.DataFrame, stints_by_driver: dict[str, list[int]], total: int
) -> pd.Series:
    """The lap covariate that turns the fit's single-tank fuel term (-fuel x LapNumber) into a
    refuelling race's sawtooth: LapNumber - (tank - (total - LapNumber + 1)), with the tank at
    the start of each lap as the sim carries it (fuel to the next in-lap plus the reserve).
    `stints_by_driver`: each driver's in-laps. Replace LapNumber with it before fit.fit."""
    out = laps["LapNumber"].astype(float).copy()
    for i, row in laps.iterrows():
        lap = int(row["LapNumber"])
        ins = stints_by_driver.get(str(row["Driver"]), [])
        nxt = min((p for p in ins if p >= lap), default=total)
        tank = nxt - lap + 1 + RESERVE_LAPS
        out[i] = lap - (tank - (total - lap + 1))
    return out


def main(argv: list[str]) -> None:
    """python -m pipeline.refuel overlays: write rules.refuelling / rules.fuelLimit to the
    appendix races' overlays. python -m pipeline.refuel prior: print the pooled prior."""
    from .race_rules import appendix_races

    cmd = argv[0] if argv else "overlays"
    if cmd == "overlays":
        for p in write_r4_overlays(appendix_races()):
            print(p)
    elif cmd == "prior":
        print(pooled_prior())
    else:
        raise SystemExit(f"unknown command {cmd}")


if __name__ == "__main__":
    main(sys.argv[1:])
