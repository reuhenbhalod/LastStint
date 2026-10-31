"""Model validation (Phase 1.7, Gate G1).

Runs N simulations with every team's real strategy and scores them against the real result
on the cars the game depends on. Gate G1 passes only if every check passes:

- duel: the user's driver vs the rival. Mean error in the gap between them within
  DUEL_GAP_TOLERANCE, and their relative order right in at least DUEL_ORDER_TOLERANCE of runs.
- podium: each podium finisher's mean gap to the winner within GAP_TOLERANCE, and the exact
  podium order in at least PODIUM_ORDER_TOLERANCE of runs.
- field: every scored finisher's mean gap to the winner within GAP_TOLERANCE or
  FIELD_RELATIVE_TOLERANCE of their real gap, whichever is larger.

Near-ties (model v3 spec C2): cars that really finished within TIE_GAP of each other are
treated as tied, because their order is close to a coin flip that even a perfect model can't
call. The duel order check is skipped when the duel's real gap is under TIE_GAP (its gap check
still applies), and the podium order matches when the sim's order differs from the real one
only by swaps within such ties. `strict_checks` keeps the original rule for comparison.

Scored finishers are the lead-lap finishers down to `score_positions`, which the race
registry can lower where race control decided the order (frozen events the sim can't model).
Errors are the bias of the MEAN simulated gap vs the real gap; noise averages out over runs.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .sim_reference import simulate

DEFAULT_RUNS = 500
DEFAULT_SCORE_POSITIONS = 6
DUEL_GAP_TOLERANCE = 3.0
# The duel bar is no stricter than real races are decisive: Abu Dhabi 2021's duel came down
# to a single restart pass on the final lap, which the sim reproduces in ~70% of runs.
DUEL_ORDER_TOLERANCE = 0.6
GAP_TOLERANCE = 5.0  # seconds: "within a few seconds"
PODIUM_ORDER_TOLERANCE = 0.5
FIELD_RELATIVE_TOLERANCE = 0.10
PODIUM = 3
TIE_GAP = 1.0  # seconds: real finishes closer than this are near-ties (C2)


@dataclass
class Check:
    name: str
    value: float
    limit: float
    passed: bool

    def line(self) -> str:
        mark = "PASS" if self.passed else "FAIL"
        return f"  [{mark}] {self.name}: {self.value:.2f} (limit {self.limit:.2f})"


@dataclass
class ValidationReport:
    runs: int
    contenders: list[str]  # scored finishers, real order
    mean_gap_error: dict[str, float]
    order_match_rate: float  # exact podium order
    duel: tuple[str, str] | None
    checks: list[Check] = field(default_factory=list)
    strict_checks: list[Check] = field(default_factory=list)  # without the near-tie rule

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    @property
    def strict_passed(self) -> bool:
        return all(c.passed for c in self.strict_checks)

    @property
    def failures(self) -> list[Check]:
        return [c for c in self.checks if not c.passed]

    def summary(self) -> str:
        head = f"runs={self.runs}  podium_order={self.order_match_rate:.0%}  passed={self.passed}"
        return "\n".join([head, *(c.line() for c in self.checks)])


# A final lap with no LapTime whose timestamp step is longer than this x the driver's recent
# laps is a timing glitch, not a real lap (Bahrain 2018: the top three's last laps are stored
# ~53s late, which shrank every other finisher's gap by as much).
BROKEN_LAST_LAP = 1.5
RECENT_LAPS = 3


def _finish_time(driver_laps: pd.DataFrame) -> float:
    """Session time at the flag; repairs a broken final lap (BROKEN_LAST_LAP)."""
    d = driver_laps.sort_values("LapNumber")
    end = float(d["Time"].iloc[-1])
    if len(d) < 2 or pd.notna(d["LapTime"].iloc[-1]):
        return end
    recent = d["LapTime"].iloc[:-1].dropna().tail(RECENT_LAPS)
    prev_end = d["Time"].iloc[-2]
    if recent.empty or pd.isna(prev_end):
        return end
    typical = float(recent.median())
    if end - float(prev_end) > BROKEN_LAST_LAP * typical:
        return float(prev_end) + typical
    return end


def real_finishing_gaps(laps: pd.DataFrame, total_laps: int | None = None) -> dict[str, float]:
    """Gap (s) to the winner for each lead-lap finisher, from lap-end session Time."""
    total = total_laps or int(laps["LapNumber"].max())
    last = laps.loc[laps.groupby("Driver")["LapNumber"].idxmax()]
    lead = last[(last["LapNumber"] == total) & last["Time"].notna()]
    finish = {str(c): _finish_time(laps[laps["Driver"] == c]) for c in lead["Driver"]}
    winner_time = min(finish.values())
    return {c: t - winner_time for c, t in finish.items()}


def tie_groups(order: list[str], real_gaps: dict[str, float]) -> dict[str, int]:
    """Group index per car in real order; a car within TIE_GAP of the one ahead shares its
    group (chains of near-ties form one group)."""
    groups: dict[str, int] = {}
    g = 0
    for i, c in enumerate(order):
        if i > 0 and real_gaps[c] - real_gaps[order[i - 1]] >= TIE_GAP:
            g += 1
        groups[c] = g
    return groups


def validate_race(
    model: dict,
    real_gaps: dict[str, float],
    runs: int = DEFAULT_RUNS,
    base_seed: int = 1000,
    rival: str | None = None,
    score_positions: int = DEFAULT_SCORE_POSITIONS,
) -> ValidationReport:
    """Replay real strategies `runs` times and score the G1 checks (module docstring)."""
    real_order = [c for c in model["realResult"] if c in real_gaps]
    contenders = real_order[:score_positions]
    podium = real_order[:PODIUM]
    real_winner = real_order[0]
    user = model["userSide"]
    duel = (user, rival) if rival and user in real_gaps and rival in real_gaps else None

    gap_sum = dict.fromkeys(contenders, 0.0)
    gap_counts = dict.fromkeys(contenders, 0)
    podium_matches = 0
    podium_tied_matches = 0
    groups = tie_groups(podium, real_gaps)
    duel_sum, duel_n, duel_order = 0.0, 0, 0
    real_duel = real_gaps[duel[0]] - real_gaps[duel[1]] if duel else 0.0

    for i in range(runs):
        times = simulate(model, seed=base_seed + i)["times"]
        if real_winner not in times:
            continue
        ref = times[real_winner]
        for c in contenders:
            if c in times:
                gap_sum[c] += times[c] - ref
                gap_counts[c] += 1
        sim_podium = sorted((c for c in podium if c in times), key=lambda c: times[c])
        if sim_podium == podium:
            podium_matches += 1
        if len(sim_podium) == len(podium) and [groups[c] for c in sim_podium] == [
            groups[c] for c in podium
        ]:
            podium_tied_matches += 1
        if duel and duel[0] in times and duel[1] in times:
            sim_duel = times[duel[0]] - times[duel[1]]
            duel_sum += sim_duel
            duel_n += 1
            duel_order += (sim_duel > 0) == (real_duel > 0)

    mean_gap_error = {
        c: (abs(gap_sum[c] / gap_counts[c] - real_gaps[c]) if gap_counts[c] else float("inf"))
        for c in contenders
    }
    order_match_rate = podium_matches / runs if runs else 0.0
    tied_rate = podium_tied_matches / runs if runs else 0.0
    duel_err = abs(duel_sum / duel_n - real_duel) if duel_n else float("inf")
    duel_rate = duel_order / duel_n if duel_n else 0.0

    def build(ties: bool) -> list[Check]:
        checks: list[Check] = []
        if duel:
            name = f"{duel[0]} vs {duel[1]}"
            checks.append(
                Check(
                    f"duel {name} gap error",
                    duel_err,
                    DUEL_GAP_TOLERANCE,
                    duel_err <= DUEL_GAP_TOLERANCE,
                )
            )
            if not (ties and abs(real_duel) < TIE_GAP):
                checks.append(
                    Check(
                        f"duel {name} order rate",
                        duel_rate,
                        DUEL_ORDER_TOLERANCE,
                        duel_rate >= DUEL_ORDER_TOLERANCE,
                    )
                )
        rate = tied_rate if ties else order_match_rate
        checks.append(
            Check("podium order rate", rate, PODIUM_ORDER_TOLERANCE, rate >= PODIUM_ORDER_TOLERANCE)
        )
        for c in contenders:
            limit = GAP_TOLERANCE
            if c not in podium:
                limit = max(GAP_TOLERANCE, FIELD_RELATIVE_TOLERANCE * real_gaps[c])
            group = "podium" if c in podium else "field"
            err = mean_gap_error[c]
            checks.append(Check(f"{group} {c} gap error", err, limit, err <= limit))
        return checks

    return ValidationReport(
        runs=runs,
        contenders=contenders,
        mean_gap_error=mean_gap_error,
        order_match_rate=order_match_rate,
        duel=duel,
        checks=build(ties=True),
        strict_checks=build(ties=False),
    )


# Robust pass status (Phase 1-2 perfection spec, guard amendment of Oct 26, 2026): a race's
# G1 status for the guard comes from ROBUST_RUNS runs on each of two seed sets, so a coin
# flip at a limit isn't counted as a real change.
ROBUST_RUNS = 1000
ROBUST_SEEDS = (10000, 20000)


@dataclass
class RobustStatus:
    status: str  # "pass" (both seed sets), "borderline" (one), "fail" (neither)
    mean_gap_error: float  # mean over the gap checks, averaged across both seed sets
    reports: list[ValidationReport]
    strict_status: str = ""  # the same without the near-tie rule (C2)


def robust_status(
    model: dict,
    real_gaps: dict[str, float],
    rival: str | None = None,
    score_positions: int = DEFAULT_SCORE_POSITIONS,
    runs: int = ROBUST_RUNS,
) -> RobustStatus:
    """G1 on two independent seed sets; status by how many of them pass."""
    reports = [
        validate_race(model, real_gaps, runs, seed, rival, score_positions) for seed in ROBUST_SEEDS
    ]
    names = {2: "pass", 1: "borderline", 0: "fail"}
    status = names[sum(r.passed for r in reports)]
    strict = names[sum(r.strict_passed for r in reports)]
    errs = [c.value for r in reports for c in r.checks if "gap error" in c.name]
    return RobustStatus(status, sum(errs) / len(errs) if errs else 0.0, reports, strict)
