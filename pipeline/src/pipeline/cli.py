"""Pipeline CLI (Implementation Plan 1.8).

pipeline list                 registered races and whether each has a snapshot / model
pipeline ingest <race-id>     download a race from FastF1 into data/raw/ (network)
pipeline jolpica <race-id>    read a race from the cached Jolpica CSV dump into data/raw/
pipeline build <race-id>      build data/races/<id>.json and data/golden/<id>.json
pipeline validate <race-id>   run the Gate G1 report; exits 1 if the race fails
pipeline f1db [race-id ...]   F1DB stops and fastest laps -> data/raw/f1db/ (Eras races)
pipeline tum-ingest <race-id> read a 2014-2019 race from the TUM database into data/raw/
pipeline hard-calls <race-id> count each storyline driver's hard calls -> data/eras/<id>.json
pipeline wet-laps <race-id>   wetness from the lap times for a wet race before 2018
pipeline reconstruct <race-id> rebuild a 1983-1995 race lap by lap from its anchors (data/raw/)
"""

from __future__ import annotations

import json
import re

import typer

from . import build as build_mod
from . import export, incidents, ingest, outline, paths, sim_reference
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
    offline: bool = typer.Option(
        False, help="FastF1 races: read the on-disk FastF1 cache only, never the network."
    ),
) -> None:
    """Download registered races into data/raw/: FastF1, OpenF1 for races registered with
    source "openf1" (network; rate-limit safe), or the cached TUM database for source "tum".
    Source "jolpica" races are skipped: `pipeline jolpica` reads them. `--offline` builds a
    FastF1 race from the project cache alone (FastF1 needs an F1TV login since Oct 2026)."""
    for rid in _race_ids(race_id, all_races):
        if ingest.raw_snapshot_path(rid).exists() and not force:
            typer.echo(f"{rid}: snapshot exists, skipped")
            continue
        meta = build_mod.RACES[rid]
        if meta.get("source") == "jolpica":
            # Its own command, never FastF1: read from the cached dump with its F1DB stops,
            # estimates, options (Eras 5.1) and the owner's SC hand-check file.
            typer.echo(f"{rid}: a Jolpica race, skipped (run `pipeline jolpica {rid} --force`)")
            continue
        if meta.get("source") == "reconstruct":
            # No lap timing before 1996: rebuilt from its anchors (step 4.6), offline.
            typer.echo(f"{rid}: a reconstructed race, skipped (run `pipeline reconstruct {rid}`)")
            continue
        if meta.get("source") == "tum":
            from . import tum

            laps, facts = tum.ingest_tum(rid)  # offline: the pinned TUM SQLite in the cache
        elif meta.get("source") == "openf1":
            laps, facts = ingest.ingest_openf1(rid, meta["year"], meta["event"])
        elif offline:
            laps, facts = ingest.ingest_race(rid, meta["year"], meta["event"], offline=True)
        else:
            laps, facts = ingest.ingest_race(rid, meta["year"], meta["event"])
        problems = ingest.race_suitability(laps)
        note = f"  NOT SUITABLE: {'; '.join(problems)}" if problems else ""
        typer.echo(f"{rid}: {len(laps)} laps, {facts['totalLaps']} race laps -> data/raw/{note}")


@app.command("tum-ingest")
def tum_ingest_cmd(
    race_id: str = typer.Argument(..., help="A 2014-2019 race, e.g. abu-dhabi-2018."),
    db: str = typer.Option(None, help="TUM SQLite path (default: the pipeline cache)."),
    out: str = typer.Option(None, help="Directory to write to (default: data/raw/)."),
    location: str = typer.Option(None, help="TUM location, if the race id's slug has none."),
    force: bool = typer.Option(False, help="Overwrite an existing snapshot."),
    verify: bool = typer.Option(True, help="Require the pinned TUM version (sha256)."),
) -> None:
    """Read a 2014-2019 race from the TUM f1-timing-database (CC BY-NC-SA 3.0) into the
    raw snapshot, status timeline and provenance (offline; see pipeline/tum.py)."""
    from pathlib import Path

    from . import tum

    raw_dir = Path(out) if out else paths.RAW_DIR
    if ingest.raw_snapshot_path(race_id, raw_dir).exists() and not force:
        typer.echo(f"{race_id}: snapshot exists in {raw_dir}, skipped (--force to overwrite)")
        return
    try:
        laps, facts = tum.ingest_tum(
            race_id, Path(db) if db else tum.DEFAULT_DB, raw_dir, location=location, verify=verify
        )
    except (ValueError, FileNotFoundError, RuntimeError) as e:
        raise typer.BadParameter(str(e)) from e
    problems = [*facts["notes"], *ingest.race_suitability(laps)]
    note = f"  NOT SUITABLE: {'; '.join(problems)}" if problems else ""
    typer.echo(f"{race_id}: {len(laps)} laps, {facts['totalLaps']} race laps -> {raw_dir}{note}")
    typer.echo(f"  {facts['credit']}")


@app.command("jolpica")
def jolpica_cmd(
    race_id: str = typer.Argument(..., help="e.g. hungary-1998 (any id; need not be registered)."),
    year: int = typer.Option(None, help="Season (default: the race id's year)."),
    event: str = typer.Option(
        None,
        help="Part of the round's name, or the circuit's country or town (default: the race"
        " id's name, e.g. 'abu dhabi').",
    ),
    round_number: int = typer.Option(None, "--round", help="The round, if the event is ambiguous."),
    dump: str = typer.Option(None, help="An extracted Jolpica CSV dump (default: newest cached)."),
    raw_dir: str = typer.Option(None, help="Where to write (default: data/raw/)."),
    force: bool = typer.Option(False, help="Overwrite an existing snapshot."),
    estimate: bool = typer.Option(
        True, help="Estimate compounds, SC laps and fuel loads (step 2.4)."
    ),
    estimates_dir: str = typer.Option(
        None, help="Where the SC hand-check file goes (default: data/estimates/)."
    ),
    f1db_dir: str = typer.Option(
        None, help="F1DB stops for races before 2011 (default: data/raw/f1db/)."
    ),
) -> None:
    """Read a race from the Jolpica CSV dump into the raw parquet, status JSON and a
    <race-id>.jolpica.json sidecar (results, standings, gaps), offline. Before 2011 the stops
    come from F1DB (`pipeline f1db`); the estimated fields are filled and listed."""
    from pathlib import Path

    from . import estimates, jolpica

    match = re.fullmatch(r"(.+)-(\d{4})", race_id)
    if year is None and not match:
        raise typer.BadParameter(f"can't read a year from '{race_id}'; give --year")
    year = year if year is not None else int(match.group(2))
    if event is None and round_number is None:
        if not match:
            raise typer.BadParameter("give --event or --round")
        event = match.group(1).replace("-", " ")
    out = Path(raw_dir) if raw_dir else paths.RAW_DIR
    if ingest.raw_snapshot_path(race_id, out).exists() and not force:
        typer.echo(f"{race_id}: snapshot exists, skipped (--force to overwrite)")
        return
    stops, stops_source = None, "given"
    if year < jolpica.STOPS_FROM:
        stops = jolpica.f1db_stops(race_id, Path(f1db_dir) if f1db_dir else jolpica.F1DB_DIR)
        stops_source = "f1db"
        if stops is None:
            typer.echo(
                f"  WARNING: no F1DB stops for {race_id} (run `pipeline f1db {race_id}`):"
                " stints, tyre ages and pit times stay unknown",
                err=True,
            )
    try:
        got = jolpica.ingest_jolpica(
            race_id,
            year,
            event,
            round_number,
            Path(dump) if dump else None,
            out,
            stops=stops,
            stops_source=stops_source,
            estimate=estimate,
            estimates_dir=Path(estimates_dir) if estimates_dir else None,
        )
    except (LookupError, FileNotFoundError, ValueError, ingest.IncompleteDataError) as e:
        typer.echo(f"{race_id}: {e}", err=True)
        raise typer.Exit(code=1) from e
    side = got.sidecar
    typer.echo(
        f"{race_id}: {got.facts['eventName']} {year}, {len(got.laps)} laps,"
        f" {got.facts['totalLaps']} race laps, stops: {side['stops'] or 'none'} -> {out}"
    )
    typer.echo("  lead-lap finishers, summed laps vs official time:")
    for r in side["raceTimeCheck"]:
        diff = "untimed lap" if r["diff"] is None else f"{r['diff']:+.3f}s"
        typer.echo(f"    P{r['position']:<3} {r['driver']:20s} {r['official']:10.3f}s  {diff}")
    for d in side["driversFromJolpica"]:
        typer.echo(f"  not in drivers.json, Jolpica code: {d['code']} {d['name']}")
    for d in side["driversWithoutCode"]:
        typer.echo(f"  NO CODE ({d['why']}): {d['name']} -> '{d['reference']}'")
    for gap in side["timingGaps"]:
        typer.echo(f"  timing gap: {gap}")
    typer.echo(f"  not supplied: {', '.join(side['missing'])}")
    if "estimates" in side:
        for line in estimates.report_lines(side["estimates"]):
            typer.echo(f"  {line}")
        hand = side["estimates"].get("safetyCars", {}).get("handCheck")
        if hand:
            typer.echo(f"  SC hand-check: {hand} (docs/eras-checks/2.4-estimates.md)")


@app.command("wet-laps")
def wet_laps_cmd(
    race_id: str = typer.Argument(..., help="A race before 2018, e.g. hungary-2014."),
    raw_dir: str = typer.Option(None, help="Where its raw snapshot is (default: data/raw/)."),
    force: bool = typer.Option(False, help="Overwrite an existing weather file."),
    estimates_dir: str = typer.Option(
        None, help="Where the sourced tyre facts are (default: data/estimates/)."
    ),
) -> None:
    """Fit when the track was wet from the lap times (no weather data before 2018) and write
    it as the race's weather records, plus a <race-id>.wet-laps.json report for the hand
    check; a source without compounds or track status (Jolpica) gets them estimated too."""
    from pathlib import Path

    import pandas as pd

    from . import wet_laps

    raw = Path(raw_dir) if raw_dir else paths.RAW_DIR
    snapshot = ingest.raw_snapshot_path(race_id, raw)
    if not snapshot.exists():
        raise typer.BadParameter(f"no snapshot at {snapshot}")
    if ingest.weather_path(race_id, raw).exists() and not force:
        typer.echo(f"{race_id}: weather file exists in {raw}, skipped (--force to overwrite)")
        return
    # A Jolpica race ingested with step 2.4's estimates: its compounds are all dry labels, so
    # the tyre classes are refitted here and the slick stints keep 2.4's labels. Its SC laps
    # (TrackStatus, with the owner's hand checks) are kept.
    sidecar = build_mod.load_sidecar(race_id, raw)
    dry_labels = wet_laps.estimated_dry_labels(sidecar)
    known = wet_laps.load_tyre_facts(race_id, Path(estimates_dir) if estimates_dir else None)
    est = wet_laps.estimate(pd.read_parquet(snapshot), dry_labels=dry_labels, known=known)
    if dry_labels is not None:
        from . import jolpica

        jolpica.sidecar_path(race_id, raw).write_text(
            json.dumps(wet_laps.update_sidecar(sidecar, est), indent=1) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    wet_laps.write(race_id, est, raw)
    rep = wet_laps.report(est, race_id)
    typer.echo(
        f"{race_id}: wet laps {', '.join(rep['wetSpells']) or 'none'};"
        f" neutralised {', '.join(rep['neutralLaps']) or 'none'} ({rep['neutralSource']})"
    )
    for a in rep["ambiguous"]:
        typer.echo(f"  ambiguous lap {a['lap']}: {a['why']}")
    for f in rep["filled"]:
        typer.echo(f"  filled {f}")
    typer.echo(f"  -> {wet_laps.report_path(race_id, raw)}")


@app.command("reconstruct")
def reconstruct_cmd(
    race_id: str = typer.Argument(..., help="A 1983-1995 race, e.g. australia-1994."),
    event: str = typer.Option(None, help="Jolpica round name, country or town, if the id's isn't."),
    round_number: int = typer.Option(None, "--round", help="The round, if the event is ambiguous."),
    dump: str = typer.Option(None, help="An extracted Jolpica CSV dump (default: newest cached)."),
    facts_dir: str = typer.Option(None, help="Facts files (default: data/reconstruction/)."),
    raw_dir: str = typer.Option(None, help="Where to write (default: data/raw/)."),
    seed: int = typer.Option(0, help="Noise seed (the output is deterministic per seed)."),
    force: bool = typer.Option(False, help="Overwrite an existing snapshot."),
) -> None:
    """Reconstruct a 1983-1995 race lap by lap from its anchors (Jolpica results, F1DB fastest
    laps and stops, sourced facts) into a synthetic raw parquet, status JSON, provenance
    sidecar and anchor report (offline; see pipeline/reconstruct.py). Exits 1 if an anchor
    fails."""
    from pathlib import Path

    from . import reconstruct

    out = Path(raw_dir) if raw_dir else paths.RAW_DIR
    if ingest.raw_snapshot_path(race_id, out).exists() and not force:
        typer.echo(f"{race_id}: snapshot exists in {out}, skipped (--force to overwrite)")
        return
    try:
        anchors = reconstruct.load_anchors(
            race_id,
            dump_dir=Path(dump) if dump else None,
            facts_dir=Path(facts_dir) if facts_dir else reconstruct.FACTS_DIR,
            event=event,
            round_number=round_number,
        )
    except (LookupError, FileNotFoundError, ValueError, ingest.IncompleteDataError) as e:
        typer.echo(f"{race_id}: {e}", err=True)
        raise typer.Exit(code=1) from e
    result = reconstruct.reconstruct(anchors, reconstruct.Params(seed=seed))
    written = reconstruct.write(race_id, result, out)
    side = result.sidecar
    typer.echo(
        f"{race_id}: {len(result.laps)} laps, {side['laps']} race laps, reconstructed"
        f" ({side['solver']['attempts']} attempt(s), sigma {side['solver']['sigma']}s) -> {out}"
    )
    for name, s in side["summary"].items():
        typer.echo(f"  {name:17s} {s['pass']:3d}/{s['total']:<3d}")
    for r in reconstruct.failures(side["anchors"]):
        typer.echo(
            f"  FAIL {r['anchor']} {r['subject']}: target {r['target']}, got {r['achieved']}"
        )
    for note in side["notes"]:
        typer.echo(f"  note: {note}")
    if side.get("weather"):
        w = side["weather"]["wetness"]
        wet_laps = sum(x >= reconstruct.RAIN_FROM for x in w)
        typer.echo(f"  weather: {wet_laps}/{len(w)} wet laps (sourced timeline), max {max(w)}")
    typer.echo(f"  report: {reconstruct.report_path(race_id, out)} ({len(written)} files)")
    if not side["solver"]["passed"]:
        raise typer.Exit(code=1)


@app.command("wet-fit")
def wet_fit_cmd(
    eras: bool = typer.Option(
        False, help="Fit the Eras curves (data/wet-eras.json) on the Eras wet races instead."
    ),
    race: list[str] = typer.Option(  # noqa: B008
        None, help="With --eras: only build these races' fit inputs into --cache (no fit)."
    ),
    cache: str = typer.Option(
        None, help="With --eras: keep each race's fit inputs here (built once, then reused)."
    ),
) -> None:
    """Fit the weather curves (data/wet.json) on every wet race at once (weather spec); with
    --eras, the Eras builds' curves (model fix 1.3, wet.fit_eras_curves) on every timed Eras
    wet race (an overlay, not a Daily/Gauntlet or reconstructed race)."""
    import json as json_mod

    import pandas as pd

    from . import wet

    if eras:
        _wet_fit_eras(race, cache)
        return
    races = []
    for rid, meta in build_mod.RACES.items():
        if meta.get("split") != "wet":
            continue
        laps = pd.read_parquet(ingest.raw_snapshot_path(rid))
        dry = build_mod.dry_fit(rid, laps, meta["era"])
        obs = wet.race_observations(laps, dry.rain, dry.fitted, wet.load_curves())
        races.append((rid, *obs))
    curves = wet.fit_curves([r[1:] for r in races], wet.load_curves())
    wet.WET_CURVES_PATH.write_text(
        json_mod.dumps(curves, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    typer.echo(f"wrote {wet.WET_CURVES_PATH.name}: {curves}")
    for rid, obs, n, rain in races:
        typer.echo(f"{rid:22s} rms {wet.rms(obs, wet.timeline(obs, n, rain, curves), curves):.2%}")


def eras_wet_races() -> list[str]:
    """The timed Eras wet races: an Eras overlay, not a Daily/Gauntlet race, not
    reconstructed, with wet tyres or rain in the snapshot."""
    import pandas as pd

    from . import wet

    shared = build_mod.shared_races()
    out = []
    for rid, meta in build_mod.RACES.items():
        if rid in shared or meta.get("source") == "reconstruct":
            continue
        if build_mod.load_overlay(rid, build_mod.ERAS_DIR) is None:
            continue
        path = ingest.raw_snapshot_path(rid)
        if not path.exists() or build_mod.load_reconstruction(rid, paths.RAW_DIR) is not None:
            continue
        if wet.is_wet_race(pd.read_parquet(path), ingest.load_weather(rid)):
            out.append(rid)
    return out


def _wet_fit_eras(only: list[str] | None, cache: str | None) -> None:
    import pickle
    from pathlib import Path

    from . import wet

    start = wet.load_curves()
    races = []
    for rid in only or eras_wet_races():
        path = Path(cache) / f"{rid}.wet-fit.pkl" if cache else None
        if path is not None and path.exists():
            inputs = pickle.loads(path.read_bytes())
        else:
            captured: list = []
            try:
                build_mod.build_race(rid, wet_inputs=captured)
            except ValueError as e:  # a race that can't be built (china-2007): no inputs
                typer.echo(f"{rid}: not built ({e}), skipped")
                continue
            if not captured:
                typer.echo(f"{rid}: no timed Eras wet build, skipped")
                continue
            laps, rain, fitted = captured[0]
            obs, n, rain_laps = wet.race_observations(laps, rain, fitted, start)
            mixed = wet.mixed_laps(laps, wet.weather_block(laps, rain, fitted, start), fitted)
            inputs = (obs, n, rain_laps, wet.dry_laps(rain), mixed)
            if path is not None:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(pickle.dumps(inputs))
        typer.echo(f"{rid}: {len(inputs[4])} mixed clear-air laps")
        races.append((rid, inputs))
    if only:
        return
    curves = wet.fit_eras_curves([r for _, r in races], start)
    wet.ERAS_CURVES_PATH.write_text(
        json.dumps(curves, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    typer.echo(f"wrote {wet.ERAS_CURVES_PATH.name}: {curves}")


@app.command("outline")
def outline_cmd(
    race_id: str = typer.Argument(..., help="A registered race, e.g. abu-dhabi-2021."),
    driver: str = typer.Option(None, help="Whose fastest lap to trace (default: the fastest)."),
) -> None:
    """Write data/tracks/<race-id>.json: the circuit outline for the game's track map
    (network: FastF1 position data)."""
    meta = build_mod.RACES[race_id]
    shape = outline.fetch_outline(meta["year"], meta["event"], driver)
    path = outline.write_outline(race_id, shape)
    typer.echo(
        f"{race_id}: {len(shape['points'])} points, {len(shape['corners'])} corners,"
        f" {len(shape.get('pit', []))} pit-lane points"
        f" -> {path.relative_to(paths.REPO_ROOT)}"
    )


@app.command("incidents")
def incidents_cmd(
    race_ids: list[str] = typer.Argument(..., help="Registered races, e.g. abu-dhabi-2021."),  # noqa: B008
) -> None:
    """Write data/incidents.json (why each safety car / VSC came out) and data/retirements.json
    (why and where each car retired), for the race screen
    (network: FastF1 results and race control messages)."""
    for race_id in race_ids:
        meta = build_mod.RACES[race_id]
        model = json.loads((paths.DATA_DIR / "races" / f"{race_id}.json").read_text())
        if meta.get("source") == "openf1":
            status, msgs = incidents.fetch_openf1(meta["year"], meta["event"])
        else:
            status, msgs = incidents.fetch(meta["year"], meta["event"])
        items = incidents.causes(model, status, msgs)
        incidents.write(race_id, items)
        incidents.write(
            race_id, incidents.retirements(model, status, msgs), incidents.RETIREMENTS_PATH
        )
        typer.echo(f"{race_id}: {items}")


@app.command()
def build(
    race_id: str = typer.Argument(None),
    all_races: bool = typer.Option(False, "--all", help="Build every registered race."),
    raw_dir: str = typer.Option(None, help="Read the raw snapshot here (default: data/raw/)."),
    out: str = typer.Option(
        None, help="Write the race file and golden file here (default: data/races/, data/golden/)."
    ),
    eras_dir: str = typer.Option(None, help="Eras overlay files (default: data/eras/)."),
) -> None:
    """Build data/races/<race-id>.json (schema-validated) and its golden file. A race with an
    Eras overlay (data/eras/<race-id>.json) gets its eras, provenance, rules and
    storylineEvents keys, except a Daily/Gauntlet pool race: its file stays as it is and the
    worker serves the overlay beside it. An ingested Jolpica race need not be registered. The
    report lists
    each race's estimated fields and data quirks."""
    from pathlib import Path

    raw = Path(raw_dir) if raw_dir else paths.RAW_DIR
    dirs = {"raw_dir": raw, "eras_dir": Path(eras_dir) if eras_dir else build_mod.ERAS_DIR}
    if race_id is not None and not all_races and race_id not in build_mod.RACES:
        if build_mod.load_sidecar(race_id, raw) is None:
            _race_ids(race_id, all_races)  # raises: unknown, and no Jolpica ingest to build
        ids = [race_id]
    else:
        ids = _race_ids(race_id, all_races)
    races_dir = Path(out) if out else paths.RACES_DIR
    golden_dir = Path(out) / "golden" if out else None
    for rid in ids:
        try:
            result = build_mod.build_race(rid, **dirs)
        except ValueError as e:  # a bad overlay or estimate: say which race, no traceback
            typer.echo(f"{rid}: {e}", err=True)
            raise typer.Exit(code=1) from e
        written = export.write_race(result.model, races_dir=races_dir)
        sim_reference.write_golden(result.model, sim_reference.GOLDEN_SEEDS, golden_dir)
        shown = written.resolve()
        if shown.is_relative_to(paths.REPO_ROOT):
            shown = shown.relative_to(paths.REPO_ROOT)
        typer.echo(f"{rid}: wrote {shown} + golden")
        for note in result.notes:
            typer.echo(f"  note: {note}")
        for line in result.estimates:
            typer.echo(f"  {line}")


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
        Path(report).write_text(_report_markdown(rows), encoding="utf-8", newline="\n")
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


@app.command("f1db")
def f1db_cmd(
    race_ids: list[str] = typer.Argument(  # noqa: B008
        None, help="Races like japan-2005 (default: every appendix race before 2011)."
    ),
) -> None:
    """Write data/raw/f1db/<race-id>.stops.csv and .fastest-laps.csv from the pinned F1DB
    release (downloaded once into the shared Eras cache); exits 1 if a stop fails its check."""
    from . import f1db

    db = f1db.F1DB.load(f1db.download())
    f1db.write_source()
    bad = []
    for rid in race_ids or f1db.APPENDIX_RACES:
        stops, fastest, problems = f1db.write_race(db, rid)
        note = f"  PROBLEMS: {'; '.join(problems)}" if problems else ""
        typer.echo(f"{rid}: {len(stops)} stops, {len(fastest)} fastest laps{note}")
        if problems:
            bad.append(rid)
    typer.echo(f"F1DB {f1db.VERSION} -> {f1db.OUT_DIR.relative_to(paths.REPO_ROOT)}/")
    if bad:
        raise typer.Exit(code=1)


@app.command("hard-calls")
def hard_calls_cmd(
    race_id: str = typer.Argument(..., help="A race in data/races/, e.g. abu-dhabi-2021."),
    samples: int = typer.Option(None, help="Grader samples per option (default: the grader's)."),
    out: str = typer.Option(None, help="Overlay directory to write to (default: data/eras/)."),
) -> None:
    """Count the hard calls from each storyline driver's side (moment finder + grader on the
    real race) and write eras.hardCalls and eras.userSide into the race's Eras overlay. A
    Daily/Gauntlet race is counted on its file merged with its overlay (the Eras grader)."""
    import tempfile
    from pathlib import Path

    from . import hard_calls

    try:
        with tempfile.TemporaryDirectory() as tmp:
            race_file = hard_calls.eras_race_file(race_id, Path(tmp))
            result = hard_calls.run_counter(race_file, samples)
        written = hard_calls.write_overlay(
            race_id, result, Path(out) if out else hard_calls.ERAS_DIR
        )
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        typer.echo(f"{race_id}: {e}", err=True)
        raise typer.Exit(code=1) from e
    counts = ", ".join(f"{code} {n}" for code, n in result["hardCalls"].items())
    gave_up = ", ".join(f"{code} {pts:.1f}" for code, pts in result["gaveUp"].items())
    typer.echo(
        f"{race_id}: hard calls {counts}; chance given up (pts) {gave_up};"
        f" userSide {result['userSide']} (by {result['decidedBy']}) -> {written}"
    )


if __name__ == "__main__":
    app()
