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
| A wet race's weather and wet-tyre stints | **the facts file's `weather` block** |

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

- `stops[].tyre`: optional, the tyre class fitted at the stop, `"slick"`, `"inter"` or
  `"wet"`, where the source says it. A stop without one (a penalty, a repair, a source that
  doesn't say) leaves its stint's tyre to the estimate below.
- `weather`: optional, only for a race run (partly) in the wet. See below.
- `roadPositions[]`: optional, a disqualified car a source places on the road (owner decision,
  Nov 8 2026; monaco-1984's Bellof). See below.
- `lastLapStops[]`: optional, a classified car a source says stopped on the last lap (out of
  fuel; germany-1986's Rosberg and Prost). See below.

The loader rejects a file whose stop or safety car has no source, a stop with no lap or car,
bad safety-car laps, a `weather` block that breaks the rules below, or a road position with
no source, no car, a place that isn't 1, 2, ... or a negative gap.

## A disqualified car on the road (`roadPositions`)

```json
"roadPositions": [
  {"number": 4, "position": 3, "gap": 21.141, "source": "Motor Sport, Jul 1984: ..."}
]
```

Jolpica lists a car excluded after the flag (Tyrrell's whole 1984 season, an underweight
car) as `disqualified`, with its laps and no time. Without a road position the solver treats
it like a retirement, so to look retired with every lap done it runs ahead of the winner (the
order anchor fails). With one:

- `driver` or `number`: the car; it must be one Jolpica has `disqualified` (anything else is
  an error);
- `position`: its place on the road at the flag (1 = first across the line);
- `gap`: seconds behind the winner on the road, where a source gives one, else `null`. A gap
  is only for a car on the winner's lap;
- `source`: required.

The car runs to the flag at that place. With a gap its race time (the winner's plus the gap)
is a lead-lap anchor like any other (a `gap` row in the report). Without one it is placed
midway between its road neighbours on its lap, and the sidecar and notes mark the time as an
estimate. The order anchor checks the road order: the classification with each road-placed
car at its place. The car stays out of the official result: it isn't classified, and the
build lists it behind the classified cars in the race file's `realResult` (as Jolpica's order
has it; `build.official_result`). The sidecar's `roadPositions` and `classified` carry this to
the build.

## A car that stopped on the last lap (`lastLapStops`)

```json
"lastLapStops": [
  {"driver": "ROSK", "gap": 2.0, "source": "https://www.autosport.com/...", "note": "..."}
]
```

Jolpica classifies a car that ran dry on the last lap a lap down ("Out of fuel", one lap fewer
than the winner). Without this entry the solver treats it like any retirement and ends its last
completed lap early enough to read as one, which puts it well ahead of where it really was (at
Hockenheim 1986, ahead of the leader). With it:

- `driver` or `number`: the car; it must be classified, not a finisher in Jolpica's words, and
  exactly one lap down (anything else is an error);
- `gap`: optional, seconds behind the leader at the start of the last lap, where a source gives
  one;
- `source`: required.

The car's last completed lap ends after the leader's (the leader's last lap is taken as its
estimated lap) and before the flag: at the sourced gap, else at its natural time inside that
window. The sidecar's `lastLapStops` carries it to the build, which writes its RETIREMENT event
on the race's last lap (Eras builds); the anchor report checks it was running when the leader
started the last lap and stopped before the flag.

## Weather (wet races)

```json
"weather": {
  "timeline": [
    {"fromLap": 1, "toLap": 25, "state": "dry", "source": "https://..."},
    {"fromLap": 26, "toLap": 29, "state": "heavy", "source": "Motor Sport, May 1993: ..."},
    {"fromLap": 30, "toLap": 36, "state": "heavy", "toState": "wet", "source": "...",
     "note": "behind the safety car; no source describes these laps"},
    {"fromLap": 37, "toLap": 71, "wetness": 0.0, "source": "..."}
  ],
  "startTyre": {"tyre": "slick", "source": "..."},
  "startTyres": [{"number": 30, "tyre": "slick", "source": "..."}],
  "tyreChanges": [{"number": 5, "lap": 21, "tyre": "wet", "source": "..."}]
}
```

- `timeline[]`: the track's state per lap range, **every entry with a `source`**.
  - `fromLap`, `toLap`: official laps; the entries run from lap 1 with no gap or overlap
    and must reach the winner's last lap (an entry past it, e.g. a red-flag race's flag
    lap, is cut);
  - `state`: `dry`, `damp`, `wet` or `heavy`, or `wetness` (0..1) for a value worked out from
    a source (say how in `note`);
  - `toState` / `toWetness`: optional; the state at `toLap`, ramped linearly from the entry's
    state at `fromLap` (drying, or rain building). A ramp between two sourced points is an
    interpolation, and its `note` should say so;
  - `note`: optional, for the checker.
- `startTyre`: the tyre class the field started on, with its source. `startTyres[]`: a car's
  own start tyre where it differs (by `driver` or `number`).
- `tyreChanges[]`: the tyre fitted at a stop, by `driver` or `number`, the stop's in-`lap`,
  `tyre` and `source`. For 1994-95 races, whose stops come from F1DB (so `stops[]` stays
  empty), this is how a stop gets its tyre: it is matched to the F1DB stop on that in-lap
  (one that matches no stop is noted in the sidecar and not used). It works on facts-file
  stops too.

The states stand for these wetness values (`reconstruct.STATE_WETNESS`), on the weather
model's scale (0 dry, 1 standing water; docs/weather-spec.md):

| State | Wetness | Why |
|---|---|---|
| `dry` | 0.0 | |
| `damp` | 0.15 | clearly slick weather: slicks lose ~5% of a dry lap, wets ~20% |
| `wet` | 0.45 | wets weather: wets lose ~25%, slicks ~29% |
| `heavy` | 0.65 | standing water: wets ~38%, slicks ~54%; the wettest the fitted modern races reach (Brazil 2012, Monaco 2023: 0.64-0.65) |

The percentages are the fitted curves of data/wet.json, which put the slick/wet crossover at
w ~ 0.36; the values are chosen around it, not fitted, so they are estimates (the race file's
provenance lists `weather`).

### What the reconstruction does with it

- **Wetness**: each lap's from the timeline.
- **Tyre per stint**: the start tyre and each stop's tyre where sourced. A stint no source
  names gets the class, slick or wet, that loses the least time over its laps at their
  wetness (teams fit the tyre that suits the stint; wet_laps.py's rule), and the sidecar's
  `weather.tyres` marks it `estimate`. An inter is used only where a source names one. **No
  stop is invented**: a car whose wet-tyre stop no source gives stays on its start tyre.
- **Wet pace**: the weather model's own relationship, as both sims run it
  (`wet.penalty`, `sim_reference`, `packages/sim/src/weather.ts`): a lap's time is the car's
  dry lap (pace + wear + fuel) x (1 + its tyre's penalty at the lap's wetness), plus pit loss
  and noise. Tyre wear counts at `wet.wear_mult` (slicks barely wear on a wet track, wets
  wear fast on a dry one). The solver still hits every anchor: the car's dry pace is solved
  from its total with the multipliers in, and its fastest lap is pinned where F1DB has it.
  On a wet race the lap-1 ladder also goes through any fastest lap set on lap 1, and a
  car pushed back by a slow wet fastest lap pushes the cars behind it back too, so the lap-1
  order stays the grid order.
- **Snapshot**: Compound is `WET` (or `INTERMEDIATE`) on wet-tyre stints and empty on slick
  stints, which the build fills with step 2.4's dry compound (`build.reconstructed_laps`).
- **Weather records**: `<race-id>.weather.json`, one record a lap at the leader's lap end,
  `{"lap", "time", "rain", "source": "reconstruction-facts", "wetness"}`, `rain` from wetness
  0.05. That is the form `wet.py` reads for a wet race with lap records (as `pipeline
  wet-laps` writes them), so the build fits the race's `weather` block from the synthetic
  laps like any other wet race's, and the file lists `weather` in `provenance.estimated`.
- **Anchor report**: a `tyre` row for every sourced stint (the snapshot's Compound on its
  laps).

A race wet from start to finish (no slick lap outside the rain: monaco-1984, portugal-1985,
europe-1993, where damp laps count as wet) gives the build no dry laps to fit its dry lap
model on. For a reconstructed race the build takes the solver's instead (owner decision, Nov
8 2026; `build.solver_dry_fit`): each car's dry pace from the sidecar's `fitted` pace in the
sims' terms (pace + fuel x (laps + 1)), its noise, the field's median wear for the dry
compound and the wet tyres (the solver ran one wear rate on every tyre, at `wet.wear_mult`),
and the solver's fuel effect. The build report says so ("dry pace: wet on every lap"); the
race file's provenance lists `weather` (the schema has no value of its own for it). A
real-timing race wet on every lap still can't be built.

## What the reconstruction writes

Into `data/raw/` (or `--raw-dir`):

- `<race-id>.parquet`: the synthetic laps, in the raw snapshot's columns
  (`ingest.LAP_COLUMNS`), as `jolpica.py` writes them (Time in seconds from the start;
  a car out on lap 1 has lap 1 untimed at 0). Compound is left empty for step 2.4 (a wet
  race's wet-tyre stints excepted).
- `<race-id>.status.json`: green from the start, plus each sourced safety car.
- `<race-id>.reconstruction.json`: `reconstructed: true` and `provenance`
  (`{"kind": "reconstructed", "estimated": [...]}`) for the race file
  (`reconstruct.mark_model` sets both on an assembled model), the estimates in words, the
  sources, the solver's parameters and seed, and the anchor report.
- `<race-id>.weather.json`: a wet race's weather records (above).
- `<race-id>.anchors.md`: the anchor report as a table: each anchor's target, what was
  achieved, pass or fail. Reconstructed races are checked on these instead of Gate G1
  (eras build plan 5.1).
