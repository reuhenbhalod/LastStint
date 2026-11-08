# Reconstruction facts files

Races from 1983 to 1995 have no lap timing, so `pipeline reconstruct <race-id>`
(`pipeline/src/pipeline/reconstruct.py`, eras build plan 4.6) rebuilds them lap by lap from
their anchors. Most anchors come from the data sources:

| Anchor | Source |
|---|---|
| Grid, classification, laps completed, retirements, lead-lap race times | Jolpica dump |
| Each driver's fastest lap and the lap it came on | F1DB (`data/raw/f1db/<race-id>.fastest-laps.csv`) |
| Pit stops, 1994-95 | F1DB (`data/raw/f1db/<race-id>.stops.csv`) |
| Pit stops before 1994, safety cars | **a facts file, entered and checked by a person** |

Nothing is filled in from memory (eras spec §4, §19). A race with no facts file is rebuilt
with no stops before 1994 and no safety cars, and its sidecar says that both are unknown.

## Where

`data/reconstruction/<race-id>.json`, one file per race (`--facts-dir` to read another
folder).

## Format

```json
{
  "raceId": "brazil-1993",
  "stops": [
    {"driver": "SENA", "lap": 29, "laneTime": null, "source": "https://..."},
    {"number": 2, "lap": 30, "laneTime": 27.4, "source": "Autosport, 1 Apr 1993, p. 32"}
  ],
  "safetyCars": [
    {"startLap": 29, "endLap": 33, "source": "https://..."}
  ],
  "complete": {"stops": false, "safetyCars": true},
  "notes": "free text for the person who checks the file"
}
```

- `raceId`: optional; if present it must match the file name.
- `stops[]`: one per stop, in any order.
  - `driver` (the driver code the reconstruction uses, as in `data/drivers.json`, e.g.
    `MSCM` for Michael Schumacher) **or** `number` (the car number in that race);
  - `lap`: the in-lap, in official lap numbering (the car came in at the end of it);
  - `laneTime`: pit-lane time in seconds, or `null` if the source doesn't give it (the race's
    median lane time is used, or 25 s if none is known; marked estimated);
  - `source`: required, non-empty: a URL or a citation a person can check.
  A stop on the lap the car retired on (beyond its laps completed) is noted and not run.
  When F1DB has the race's stops (1994-95), the facts file's stops are ignored (and noted).
- `safetyCars[]`: one per deployment.
  - `startLap`, `endLap`: the first and last race laps (the leader's laps) run behind the
    safety car, `1 <= startLap <= endLap`;
  - `source`: required.
  A safety car in a race before 1993 is rejected.
- `complete`: optional. `stops: true` says every stop of the race is listed;
  `safetyCars: true` that every safety car is. Without it the race file's
  `provenance.estimated` includes `safetyCars`, and the sidecar notes that stops may be
  missing.

The loader rejects a file whose stop or safety car has no source, a stop with no lap or car,
or bad safety-car laps.

## What the reconstruction writes

Into `data/raw/` (or `--raw-dir`):

- `<race-id>.parquet`: the synthetic laps, in the raw snapshot's columns
  (`ingest.LAP_COLUMNS`), as `jolpica.py` writes them (Time in seconds from the start;
  a car out on lap 1 has lap 1 untimed at 0). Compound is left empty for step 2.4.
- `<race-id>.status.json`: green from the start, plus each sourced safety car.
- `<race-id>.reconstruction.json`: `reconstructed: true` and `provenance`
  (`{"kind": "reconstructed", "estimated": [...]}`) for the race file
  (`reconstruct.mark_model` sets both on an assembled model), the estimates in words, the
  sources, the solver's parameters and seed, and the anchor report.
- `<race-id>.anchors.md`: the anchor report as a table: each anchor's target, what was
  achieved, pass or fail. Reconstructed races are checked on these instead of Gate G1
  (eras build plan 5.1).
