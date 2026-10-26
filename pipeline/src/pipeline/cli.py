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
) -> None:
    """Run the Gate G1 validation report; exit code 1 if any race fails."""
    ids = _race_ids(race_id, all_races or split is not None)
    if split:
        ids = [r for r in ids if build_mod.RACES[r].get("split") == split]
    if robust:
        _robust(ids)
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


def _robust(ids: list[str]) -> None:
    counts = {"pass": 0, "borderline": 0, "fail": 0}
    errs = []
    for rid in ids:
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        res = validate_mod.robust_status(
            model,
            validate_mod.real_finishing_gaps(laps),
            rival=meta.get("rival"),
            score_positions=meta.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS),
        )
        counts[res.status] += 1
        errs.append(res.mean_gap_error)
        typer.echo(f"{rid:24s} {res.status:10s} mean gap error {res.mean_gap_error:.2f}s")
    mean = sum(errs) / len(errs) if errs else 0.0
    typer.echo(
        f"== {counts['pass']} pass, {counts['borderline']} borderline, {counts['fail']} fail;"
        f" mean gap error {mean:.2f}s over {len(ids)} races"
    )


if __name__ == "__main__":
    app()
