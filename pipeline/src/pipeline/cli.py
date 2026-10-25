"""Pipeline CLI (Implementation Plan 1.8).

pipeline build <race-id>     build one race model end to end
pipeline validate <race-id>  run the validation report for a built race
"""

from __future__ import annotations

import typer

app = typer.Typer(help="F1 timing data -> race-model JSON pipeline", no_args_is_help=True)


@app.command()
def build(race_id: str) -> None:
    """Build data/races/<race-id>.json from FastF1 timing."""
    typer.echo(f"build {race_id}: not implemented yet (Phase 1)")
    raise typer.Exit(code=1)


@app.command()
def validate(race_id: str) -> None:
    """Run the validation report for a built race model."""
    typer.echo(f"validate {race_id}: not implemented yet (Phase 1)")
    raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
