"""Historical safety-car rates per circuit (eras build plan 9.2, eras spec 8 "Legend difficulty").

Legend difficulty draws its SC/VSC periods at the track's historical rate. This module measures
that rate from data, never guesses it, and writes data/sc_rates.json, which both sims read
(packages/sim/src/legend.ts, pipeline/legend.py).

Sources, one count per race (a race in two sources is counted once, from the first):
- data/raw/<race>.status.json: the status timeline of every race ingested so far (FastF1 /
  OpenF1, 2018+; also TUM- or Jolpica-ingested races, labelled from their sidecars). An empty
  timeline (Jolpica writes [] when it has no track status) is "no data", not "no SC".
- The TUM f1-timing-database's fcyphases, 2014-2019 (shared cache; tum.py pins the file).
- Jolpica-era SC estimates (build plan 2.4): none exist yet. When 2.4 writes estimated status
  timelines into data/raw they're counted, labelled "jolpica-estimate".

Counting: a SC period is each entry into status "4", a VSC period each entry into "6" (a VSC
that hands straight to a SC is one of each, as the race file's events have it). TUM: one per
fcyphases row. Red flags aren't counted (Legend keeps them where they were). VSC periods are
counted per race only from 2015, the VSC's first season (2014 races count for SC only).

Which circuit a race ran at comes from Jolpica's rounds: each round's name gives the repo's
race-id slug (ROUND_SLUGS, FastF1's event names: "British" -> great-britain) and its circuit
the track, so "europe-1997" is Jerez and "europe-2016" Baku. The same table goes into the
JSON (`events`) so a race model's id finds its circuit at run time.

A circuit with fewer than MIN_RACES races counted (MIN_RACES VSC-era races for the VSC rate)
falls back to the all-track rate and is flagged. Period lengths (laps) are all-track means:
per-track lengths from a handful of periods would be noise.

    uv run python -m pipeline.sc_rates --cache ../pipeline/cache/eras-sources
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from . import events as events_mod
from . import jolpica, tum
from .ingest import raw_snapshot_path
from .legend import SC_RATES_PATH, parse_race_id
from .paths import RAW_DIR, REPO_ROOT

DEFAULT_CACHE = REPO_ROOT / "pipeline" / "cache" / "eras-sources"
YEARS = range(1983, 2026)  # the Eras races' seasons
VSC_FROM = 2015  # the VSC's first season
MIN_RACES = 3  # fewer races counted at a circuit: the all-track rate, flagged
SC, VSC = "4", "6"

# Jolpica round name (without " Grand Prix") -> the repo's race-id slug (FastF1's event names,
# as ingest.default_race_id makes them). Unknown names are an error, never a guess.
ROUND_SLUGS = {
    "70th Anniversary": "70th-anniversary",
    "Abu Dhabi": "abu-dhabi",
    "Argentine": "argentina",
    "Australian": "australia",
    "Austrian": "austria",
    "Azerbaijan": "azerbaijan",
    "Bahrain": "bahrain",
    "Belgian": "belgium",
    "Brazilian": "brazil",
    "British": "great-britain",
    "Canadian": "canada",
    "Chinese": "china",
    "Dallas": "dallas",
    "Detroit": "detroit",
    "Dutch": "netherlands",
    "Eifel": "eifel",
    "Emilia Romagna": "emilia-romagna",
    "European": "europe",
    "French": "france",
    "German": "germany",
    "Hungarian": "hungary",
    "Indian": "india",
    "Italian": "italy",
    "Japanese": "japan",
    "Korean": "korea",
    "Las Vegas": "las-vegas",
    "Luxembourg": "luxembourg",
    "Malaysian": "malaysia",
    "Mexican": "mexico",
    "Mexico City": "mexico",
    "Miami": "miami",
    "Monaco": "monaco",
    "Pacific": "pacific",
    "Portuguese": "portugal",
    "Qatar": "qatar",
    "Russian": "russia",
    "Sakhir": "sakhir",
    "San Marino": "san-marino",
    "Saudi Arabian": "saudi-arabia",
    "Singapore": "singapore",
    "South African": "south-africa",
    "Spanish": "spain",
    "Styrian": "styria",
    "São Paulo": "brazil",
    "Turkish": "turkey",
    "Tuscan": "tuscany",
    "United States": "united-states",
    "United States West": "united-states-west",
}


def round_slug(name: str) -> str:
    base = name.replace(" Grand Prix", "")  # "United States Grand Prix West"
    if base not in ROUND_SLUGS:
        raise ValueError(f"no race-id slug for the round '{name}': add it to ROUND_SLUGS")
    return ROUND_SLUGS[base]


@dataclass(frozen=True)
class Round:
    slug: str
    year: int
    date: str
    circuit: str  # Jolpica circuit reference, e.g. 'yas_marina'
    circuit_name: str


def rounds(dump: jolpica.Dump, years: range = YEARS) -> list[Round]:
    """Every held round in `years`, with its race-id slug and circuit."""
    seasons = dump["season"].set_index("id")["year"]
    circuits = dump["circuit"].set_index("id")
    out = []
    for r in dump["round"].itertuples():
        year = int(seasons[r.season_id])
        if year not in years or r.is_cancelled == "t":
            continue
        c = circuits.loc[r.circuit_id]
        out.append(Round(round_slug(r.name), year, str(r.date), c["reference"], c["name"]))
    seen: dict[tuple[str, int], str] = {}
    for r in out:
        if seen.setdefault((r.slug, r.year), r.circuit) != r.circuit:
            raise ValueError(
                f"two circuits for {r.slug}-{r.year}: {seen[(r.slug, r.year)]}, {r.circuit}"
            )
    return sorted(out, key=lambda r: (r.slug, r.year))


def event_circuits(all_rounds: list[Round]) -> dict[str, list[list]]:
    """slug -> [[fromYear, circuit], ...]: from that year on (until the next entry) the slug's
    race ran at that circuit. Compact, and what circuit_for reads at run time."""
    out: dict[str, list[list]] = {}
    for r in all_rounds:
        spans = out.setdefault(r.slug, [])
        if not spans or spans[-1][1] != r.circuit:
            spans.append([r.year, r.circuit])
    return out


def count_status(timeline: list[dict]) -> tuple[int, int]:
    """(SC periods, VSC periods) in a status timeline: entries into "4" and into "6"."""
    sc = vsc = 0
    prev = None
    for entry in timeline:
        s = str(entry["status"])
        if s == SC and prev != SC:
            sc += 1
        elif s == VSC and prev != VSC:
            vsc += 1
        prev = s
    return sc, vsc


@dataclass
class RaceCount:
    race_id: str
    year: int
    circuit: str
    source: str
    sc: int
    vsc: int
    sc_lengths: list[int] = field(default_factory=list)
    vsc_lengths: list[int] = field(default_factory=list)


def _raw_source(race_id: str, raw_dir: Path) -> str:
    if jolpica.sidecar_path(race_id, raw_dir).exists():
        return "jolpica-estimate"
    if tum.provenance_path(race_id, raw_dir).exists():
        return "tum"
    return "fastf1"


def _lengths_from_parquet(race_id: str, raw_dir: Path) -> tuple[list[int], list[int]]:
    """SC and VSC period lengths in race laps, as the pipeline freezes them (events.py)."""
    path = raw_snapshot_path(race_id, raw_dir)
    if not path.exists():
        return [], []
    evs = events_mod.neutralization_events(pd.read_parquet(path))
    return (
        [int(e["laps"]) for e in evs if e["type"] == "SC"],
        [int(e["laps"]) for e in evs if e["type"] == "VSC"],
    )


def raw_counts(circuit_of: dict[tuple[str, int], str], raw_dir: Path = RAW_DIR) -> list[RaceCount]:
    out = []
    for path in sorted(raw_dir.glob("*.status.json")):
        # A reconstructed race's laps are synthetic (reconstruct.py): not evidence of a rate.
        if (raw_dir / path.name.replace(".status.json", ".reconstruction.json")).exists():
            continue
        race_id = path.name.removesuffix(".status.json")
        timeline = json.loads(path.read_text())
        if not timeline:
            continue  # no track status for this race: unknown, not zero
        slug, year = parse_race_id(race_id)
        if (slug, year) not in circuit_of:
            raise ValueError(f"{race_id}: no Jolpica round for {slug} {year}")
        sc, vsc = count_status(timeline)
        sc_len, vsc_len = _lengths_from_parquet(race_id, raw_dir)
        out.append(
            RaceCount(race_id, year, circuit_of[(slug, year)], _raw_source(race_id, raw_dir),
                      sc, vsc, sc_len, vsc_len)
        )  # fmt: skip
    return out


def tum_counts(con: sqlite3.Connection, by_date: dict[str, Round]) -> list[RaceCount]:
    races = con.execute("SELECT id, date FROM races ORDER BY date").fetchall()
    phases = con.execute("SELECT race_id, type, startlap, endlap FROM fcyphases").fetchall()
    out = []
    for race_id, date in races:
        r = by_date.get(date)
        if r is None:
            raise ValueError(f"TUM race {race_id} on {date}: no Jolpica round that day")
        mine = [p for p in phases if p[0] == race_id]
        unknown = {p[1] for p in mine} - {"SC", "VSC"}
        if unknown:
            raise ValueError(f"TUM race {race_id}: unknown FCY types {sorted(unknown)}")
        out.append(
            RaceCount(
                f"{r.slug}-{r.year}", r.year, r.circuit, "tum",
                sum(p[1] == "SC" for p in mine), sum(p[1] == "VSC" for p in mine),
                [int(p[3]) - int(p[2]) + 1 for p in mine if p[1] == "SC"],
                [int(p[3]) - int(p[2]) + 1 for p in mine if p[1] == "VSC"],
            )
        )  # fmt: skip
    return out


def dedupe(*sources: list[RaceCount]) -> list[RaceCount]:
    """One count per race id: the first source that has it wins."""
    seen: dict[str, RaceCount] = {}
    for counts in sources:
        for c in counts:
            seen.setdefault(c.race_id, c)
    return sorted(seen.values(), key=lambda c: c.race_id)


def _rate(periods: int, races: int) -> float:
    return round(periods / races, 4)


def _mean_laps(lengths: list[int]) -> int:
    if not lengths:
        raise ValueError("no measured period lengths")
    return max(1, round(sum(lengths) / len(lengths)))


def summarize(counts: list[RaceCount], all_rounds: list[Round], min_races: int = MIN_RACES) -> dict:
    """The data/sc_rates.json document from the per-race counts."""
    if not counts:
        raise ValueError("no races counted")
    vsc_counts = [c for c in counts if c.year >= VSC_FROM]
    all_tracks = {
        "races": len(counts),
        "vscRaces": len(vsc_counts),
        "scPeriods": sum(c.sc for c in counts),
        "vscPeriods": sum(c.vsc for c in vsc_counts),
    }
    all_tracks["scPerRace"] = _rate(all_tracks["scPeriods"], all_tracks["races"])
    all_tracks["vscPerRace"] = _rate(all_tracks["vscPeriods"], all_tracks["vscRaces"])
    sc_lengths = [n for c in counts for n in c.sc_lengths]
    vsc_lengths = [n for c in vsc_counts for n in c.vsc_lengths]

    names = {r.circuit: r.circuit_name for r in all_rounds}
    circuits: dict[str, dict] = {}
    for circuit in sorted({c.circuit for c in counts}):
        mine = [c for c in counts if c.circuit == circuit]
        mine_vsc = [c for c in mine if c.year >= VSC_FROM]
        sc_fallback = len(mine) < min_races
        vsc_fallback = len(mine_vsc) < min_races
        sc_periods = sum(c.sc for c in mine)
        vsc_periods = sum(c.vsc for c in mine_vsc)
        circuits[circuit] = {
            "name": names.get(circuit, circuit),
            "races": len(mine),
            "vscRaces": len(mine_vsc),
            "scPeriods": sc_periods,
            "vscPeriods": vsc_periods,
            "scPerRace": all_tracks["scPerRace"] if sc_fallback else _rate(sc_periods, len(mine)),
            "vscPerRace": (
                all_tracks["vscPerRace"] if vsc_fallback else _rate(vsc_periods, len(mine_vsc))
            ),
            "scFallback": sc_fallback,
            "vscFallback": vsc_fallback,
            "counted": [f"{c.race_id} ({c.source}): {c.sc} SC, {c.vsc} VSC" for c in mine],
        }
    sources = sorted({c.source for c in counts})
    return {
        "_comment": (
            "Historical SC/VSC periods per race at each circuit, for Legend difficulty (eras "
            "spec 8; build plan 9.2). Generated by pipeline/src/pipeline/sc_rates.py; do not "
            "edit by hand. scPerRace / vscPerRace are the rates the sims use: periods counted / "
            f"races counted, VSC from {VSC_FROM}. A circuit with fewer than minRaces races "
            "counted uses the all-track rate and is flagged (scFallback / vscFallback); a "
            "circuit not listed (no data, e.g. every pre-2014 track until the Jolpica-era "
            "estimates of build plan 2.4 exist) uses the all-track rate too. Lengths are "
            "all-track mean laps per period. events: race-id slug -> [[fromYear, circuit]] "
            "(Jolpica rounds)."
        ),
        "sources": {
            "counted": sources,
            "fastf1": "data/raw/<race>.status.json (FastF1 / OpenF1 track status, 2018+)",
            "tum": f"TUM f1-timing-database fcyphases, 2014-2019 ({tum.TUM_URL} @ "
            f"{tum.TUM_COMMIT[:7]}, {tum.TUM_LICENCE})",
            "jolpica": "circuits per round from the Jolpica dump; no SC estimates yet (2.4)",
        },
        "minRaces": min_races,
        "vscFrom": VSC_FROM,
        "lengths": {
            "scLaps": _mean_laps(sc_lengths),
            "vscLaps": _mean_laps(vsc_lengths),
            "scPeriodsMeasured": len(sc_lengths),
            "vscPeriodsMeasured": len(vsc_lengths),
        },
        "allTracks": all_tracks,
        "circuits": circuits,
        "events": event_circuits(all_rounds),
    }


def build(cache: Path = DEFAULT_CACHE, raw_dir: Path = RAW_DIR) -> dict:
    dump = jolpica.Dump(jolpica.latest_dump(cache / "jolpica"))
    all_rounds = rounds(dump)
    circuit_of = {(r.slug, r.year): r.circuit for r in all_rounds}
    by_date = {r.date: r for r in all_rounds}
    con = tum.connect(cache / "tum" / "repo" / "F1_timingdata_2014_2019.sqlite")
    try:
        counted = dedupe(raw_counts(circuit_of, raw_dir), tum_counts(con, by_date))
    finally:
        con.close()
    return summarize(counted, all_rounds)


def write(doc: dict, path: Path = SC_RATES_PATH) -> Path:
    path.write_text(
        json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n"
    )
    return path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help="eras-sources cache")
    parser.add_argument("--out", type=Path, default=SC_RATES_PATH)
    args = parser.parse_args(argv)
    doc = build(args.cache)
    write(doc, args.out)
    t = doc["allTracks"]
    flagged = sum(c["scFallback"] for c in doc["circuits"].values())
    print(
        f"wrote {args.out}: {t['races']} races, {len(doc['circuits'])} circuits "
        f"({flagged} on the all-track SC rate); all tracks {t['scPerRace']} SC, "
        f"{t['vscPerRace']} VSC per race"
    )


if __name__ == "__main__":
    main()
