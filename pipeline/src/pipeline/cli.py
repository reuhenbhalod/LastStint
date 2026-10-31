"""Pipeline CLI (Implementation Plan 1.8).

pipeline list                 registered races and whether each has a snapshot / model
pipeline ingest <race-id>     download a race from FastF1 into data/raw/ (network)
pipeline build <race-id>      build data/races/<id>.json and data/golden/<id>.json
pipeline validate <race-id>   run the Gate G1 report; exits 1 if the race fails
"""

from __future__ import annotations

import typer

from . import build as build_mod
from . import export, ingest, paths, sim_reference
from . import validate as validate_mod

app = typer.Typer(help="F1 timing data -> race-model JSON pipeline", no_args_is_help=True)


def _race_ids(race_id: str | None, all_races: bool) -> list[str]:
    if all_races:
        return list(build_mod.RACES)
    if race_id is None:
        raise typer.BadParameter("give a race id or --all")
    if race_id not in build_mod.RACES:
        known = ", ".join(sorted(build_mod.RACES))
        raise typer.BadParameter(f"unknown race '{race_id}' (known: {known})")
    return [race_id]


@app.command("list")
def list_races() -> None:
    """List registered races with snapshot / model status."""
    for race_id, meta in build_mod.RACES.items():
        raw = ingest.raw_snapshot_path(race_id).exists()
        model = (paths.RACES_DIR / f"{race_id}.json").exists()
        duel = f"{meta['user_side']} vs {meta['rival']}" if meta["user_side"] else "auto duel "
        typer.echo(
            f"{race_id:24s} {duel:10s} {meta.get('split', '?'):7s}"
            f" snapshot={'yes' if raw else 'no ':3s} model={'yes' if model else 'no'}"
        )


@app.command("ingest")
def ingest_race(
    race_id: str = typer.Argument(None),
    all_races: bool = typer.Option(False, "--all", help="Ingest every registered race."),
    force: bool = typer.Option(False, help="Re-download even if a snapshot exists."),
) -> None:
    """Download registered races from FastF1 into data/raw/ (network; rate-limit safe)."""
    for rid in _race_ids(race_id, all_races):
        if ingest.raw_snapshot_path(rid).exists() and not force:
            typer.echo(f"{rid}: snapshot exists, skipped")
            continue
        meta = build_mod.RACES[rid]
        laps, facts = ingest.ingest_race(rid, meta["year"], meta["event"])
        problems = ingest.race_suitability(laps)
        note = f"  NOT SUITABLE: {'; '.join(problems)}" if problems else ""
        typer.echo(f"{rid}: {len(laps)} laps, {facts['totalLaps']} race laps -> data/raw/{note}")


@app.command()
def build(
    race_id: str = typer.Argument(None),
    all_races: bool = typer.Option(False, "--all", help="Build every registered race."),
) -> None:
    """Build data/races/<race-id>.json (schema-validated) and its golden file."""
    for rid in _race_ids(race_id, all_races):
        result = build_mod.build_race(rid)
        out = export.write_race(result.model, races_dir=paths.RACES_DIR)
        sim_reference.write_golden(result.model, sim_reference.GOLDEN_SEEDS)
        typer.echo(f"{rid}: wrote {out.relative_to(paths.REPO_ROOT)} + golden")
        for note in result.notes:
            typer.echo(f"  note: {note}")


@app.command()
def validate(
    race_id: str = typer.Argument(None),
    all_races: bool = typer.Option(False, "--all", help="Validate every registered race."),
    split: str = typer.Option(None, help="Only races in this split (tune / holdout)."),
    runs: int = typer.Option(validate_mod.DEFAULT_RUNS, help="Simulations per race."),
    robust: bool = typer.Option(
        False, help="Guard mode: 1000 runs on two seed sets; pass / borderline / fail."
    ),
    report: str = typer.Option(
        None, help="With --robust: write a Markdown G1 report (with diagnoses) to this path."
    ),
) -> None:
    """Run the Gate G1 validation report; exit code 1 if any race fails."""
    ids = _race_ids(race_id, all_races or split is not None)
    if split:
        ids = [r for r in ids if build_mod.RACES[r].get("split") == split]
    if robust:
        _robust(ids, report)
        return
    failed = []
    for rid in ids:
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        report = validate_mod.validate_race(
            model,
            validate_mod.real_finishing_gaps(laps),
            runs=runs,
            rival=meta.get("rival"),
            score_positions=meta.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS),
        )
        typer.echo(f"== {rid}\n{report.summary()}")
        if not report.passed:
            failed.append(rid)
    if failed:
        typer.echo(f"G1 FAILED: {', '.join(failed)}")
        raise typer.Exit(code=1)


def _robust(ids: list[str], report: str | None = None) -> None:
    from pathlib import Path

    from . import diagnose

    rows = []
    for rid in ids:
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        positions = meta.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS)
        res = validate_mod.robust_status(
            model,
            validate_mod.real_finishing_gaps(laps),
            rival=meta.get("rival"),
            score_positions=positions,
        )
        if meta.get("data_issue"):
            res.status = res.strict_status = "data issue"
        failing = sorted(
            {c.name for r in res.reports for c in r.checks if not c.passed},
            key=str,
        )
        why = (
            meta["data_issue"]
            if meta.get("data_issue")
            else diagnose.diagnose(model, laps, positions).line()
            if res.status != "pass"
            else ""
        )
        rows.append((rid, meta, res, failing, why))
        typer.echo(
            f"{rid:24s} {res.status:10s} (strict {res.strict_status:10s})"
            f" mean gap error {res.mean_gap_error:.2f}s"
        )
    for split in sorted({m.get("split", "?") for _, m, *_ in rows}, reverse=True):
        part = [r for r in rows if r[1].get("split") == split and not r[1].get("data_issue")]
        n = {s: sum(r[2].status == s for r in part) for s in ("pass", "borderline", "fail")}
        mean = sum(r[2].mean_gap_error for r in part) / len(part)
        typer.echo(
            f"== {split}: {n['pass']} pass, {n['borderline']} borderline, {n['fail']} fail;"
            f" mean gap error {mean:.2f}s over {len(part)} races"
        )
    if report:
        Path(report).write_text(_report_markdown(rows))
        typer.echo(f"wrote {report}")


def _report_markdown(rows: list) -> str:
    lines = [
        "# Gate G1 report",
        "",
        "Generated by `pipeline validate --all --robust --report docs/g1-report.md`. Status is",
        "robust: 1,000 runs on each of two seed sets (pass = both pass, borderline = one).",
        "Mean gap error averages the gap checks. Held-out races were never used to choose a",
        "model change. Diagnosis = the dominant source of the race's gap error",
        "(`pipeline/src/pipeline/diagnose.py`). Races with a data issue are listed, not counted.",
        "Near-ties: cars that really finished within 1.0s are tied for the order checks (model",
        "v3 spec C2); the status without that rule is shown alongside.",
        "",
    ]
    for split in ("holdout", "tune"):
        part = [r for r in rows if r[1].get("split") == split]
        if not part:
            continue
        counted = [r for r in part if not r[1].get("data_issue")]
        n = {s: sum(r[2].status == s for r in counted) for s in ("pass", "borderline", "fail")}
        mean = sum(r[2].mean_gap_error for r in counted) / len(counted)
        title = "Held-out races" if split == "holdout" else "Tuning races"
        lines += [
            f"## {title}: {n['pass']} pass, {n['borderline']} borderline, {n['fail']} fail"
            f" (mean gap error {mean:.2f}s)",
            "",
            "| Race | Duel | Status | Without near-tie rule | Mean gap error | Failing checks"
            " | Diagnosis |",
            "|---|---|---|---|---|---|---|",
        ]
        for rid, meta, res, failing, why in part:
            duel = f"{meta['user_side']} vs {meta['rival']}"
            checks = "; ".join(failing) if failing else ""
            lines.append(
                f"| {rid} | {duel} | {res.status} | {res.strict_status} |"
                f" {res.mean_gap_error:.2f}s | {checks} | {why} |"
            )
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    app()
