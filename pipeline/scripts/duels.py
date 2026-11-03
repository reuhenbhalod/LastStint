"""Find a driver pairing (a duel) that passes G1 for a race (races batch 3, survivor spec).

A race's automatic duel is runner-up vs winner. When only its duel checks fail (the field and
podium replay fine), another close pair may pass: P3 chasing P2, or a defend race (the car
ahead holding off the one behind). This screens the pairs among the top six finishers with a
quick validation, then runs the robust check on the best one.

    uv run python scripts/duels.py <race-id> [<race-id> ...]

Prints, per race, either `<race> PASS <user> vs <rival> (<kind>) mean gap error <s>` or why
no pairing passes. Doesn't edit the registry: copy a passing pair into build.py by hand.
"""

from __future__ import annotations

import sys

from pipeline import build as build_mod
from pipeline import validate as validate_mod

QUICK_RUNS = 300


def quick(rid: str, user: str | None, rival: str | None):
    meta = build_mod.RACES[rid]
    saved = (meta["user_side"], meta["rival"])
    meta["user_side"], meta["rival"] = user, rival
    try:
        model, laps = build_mod.build_race_model(rid)
        resolved = build_mod.resolved_meta(rid, laps)
        gaps = validate_mod.real_finishing_gaps(laps)
        positions = resolved.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS)
        report = validate_mod.validate_race(
            model, gaps, runs=QUICK_RUNS, rival=resolved["rival"], score_positions=positions
        )
        return model, laps, gaps, positions, resolved, report
    finally:
        meta["user_side"], meta["rival"] = saved


def search(rid: str) -> str:
    try:
        model, laps, gaps, positions, resolved, report = quick(rid, None, None)
    except Exception as e:  # noqa: BLE001 - a broken race is reported, not fatal
        return f"{rid} ERROR {type(e).__name__}: {e}"
    others = [c.name for c in report.checks if not c.passed and not c.name.startswith("duel")]
    if others:
        return f"{rid} SKIP field/podium fail: {', '.join(others)}"
    order = [c for c in model["realResult"] if c in gaps][:6]
    pairs = []
    for i in range(1, len(order)):
        for j in (i - 1, i - 2):
            if j < 0:
                continue
            behind, ahead = order[i], order[j]
            pairs.append((behind, ahead, "beat"))  # user behind, chasing
            pairs.append((ahead, behind, "defend"))  # user ahead, holding
    best = None
    for user, rival, kind in pairs:
        try:
            *_, rep = quick(rid, user, rival)
        except Exception:  # noqa: BLE001
            continue
        duel = [c for c in rep.checks if c.name.startswith("duel")]
        if rep.passed:
            err = sum(c.value for c in duel if "gap error" in c.name)
            if best is None or err < best[0]:
                best = (err, user, rival, kind)
    if best is None:
        return f"{rid} NONE no pairing passes the quick check"
    _, user, rival, kind = best
    meta = build_mod.RACES[rid]
    saved = (meta["user_side"], meta["rival"])
    meta["user_side"], meta["rival"] = user, rival
    try:
        model, laps = build_mod.build_race_model(rid)
        res = validate_mod.robust_status(
            model, validate_mod.real_finishing_gaps(laps), rival=rival, score_positions=positions
        )
    finally:
        meta["user_side"], meta["rival"] = saved
    tag = "PASS" if res.status == "pass" else res.status.upper()
    return f"{rid} {tag} {user} vs {rival} ({kind}) mean gap error {res.mean_gap_error:.2f}s"


if __name__ == "__main__":
    for rid in sys.argv[1:]:
        print(search(rid), flush=True)
