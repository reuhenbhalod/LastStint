"""Red flags (eras build plan 4.3, simulator roadmap R1).

A red flag stops the race. The cars line up in the pit lane in race order, may change tyres
for free, and the race resumes: from a standing start on the grid, or rolling behind the
safety car. Either way the gaps from before the stoppage are gone. This module turns the
timing into the race file's frozen RED events, and gives the reference sim the rules it
replays (packages/sim/src/redflag.ts is the TypeScript twin; the two must agree).

How a red flag looks in the race file:

    {"lap": L, "type": "RED", "laps": k, "restart": "standing" | "rolling"}

- Laps L .. S (S = L + k - 1) are red laps: no racing, everyone runs the same neutral lap.
  L is the race lap (the leader's) on which the red flag was shown; S is the lap that holds
  the stoppage, the one the race resumes on.
- A stop whose out-lap is a red lap after L (L < out-lap <= S) is the tyre change made in
  the pit lane during the stoppage: free. A real stop with its out-lap on L whose car entered
  the pits after the red flag was shown (it hadn't crossed the line yet) is free too (its
  measured loss is 0); one that entered before paid for the flag it entered under.
- At the end of S the gaps are wiped: the field is lined up in order, BUNCH_GAP apart (the
  queue behind the safety car). The laps the safety car stays out after the resumption are an
  ordinary SC event straight after the red one. A standing restart then spreads the field
  STANDING_RESTART_GAP apart at the end of the last of those laps (the first racing lap is a
  start); a rolling one goes green from the queue.
- No `restart`: the race was never resumed (results taken from before the red flag).

Two red flags put no RED event in the race file (`race_entries`, `cut_at_results`):
- A race that ended under the red flag, with its results taken from an earlier lap
  (`"restart": "none"` and a `resultsLap`; Brazil 2003, Monaco 1984): the race simply ends at
  the results lap. Laps after it are cut from the lap frame, so the race's distance is the
  results lap and its classification is the order at the end of it (most laps, then the
  earlier lap-end time, as for any race). The red flag itself is after the cut: no RED event.
- A start voided and rerun over the full distance (VOIDED_START_RULE; Belgium 1998): before
  2005 a race stopped within the first VOIDED_START_LAPS laps was restarted from scratch, and
  the data holds only the rerun. It's a fresh race: no RED event, and the entry's
  `restartScLaps` are laps 1..n of the rerun behind the safety car.

Restart rules by year, from the regulations (see RESTART_RULES for the sources): from 2005
to 2017 a suspended race resumed behind the safety car (rolling); standing restarts came in
mid-2018 and were first used at Monza 2020, with a rolling restart when the race director
judges the track unsuitable for a standing start (wet races: Zandvoort 2023, Interlagos 2024).
So a race's restart comes, in order, from: a red-flag file entry (hand-entered, or written at
ingest from race control's "ROLLING START" / "STANDING START" messages), else the year's
rule. 2018 and before 2005 have no default (the 2018 rule changed mid-season; before 2005 a
stopped race was restarted as a second part, a different procedure): those need a file entry.

The red-flag file, data/redflags/<race-id>.json (hand-entered) or
data/raw/<race-id>.redflags.json (written by the ingest from race control):

    {
      "race": "<race-id>",
      "redFlags": [
        {
          "lap": <int>,           # race (leader's) lap the red flag was shown on
          "resumeLap": <int>,     # optional: the lap holding the stoppage (S), for sources
                                  #   with no red-flag timing (TUM, Jolpica); laps
                                  #   lap..resumeLap are marked red in the lap frame
          "restart": "rolling",   # standing | rolling | none (never resumed)
          "restartScLaps": <int>, # optional (hand entries): race laps behind the SC after S
                                  #   (a voided start: laps 1..n of the rerun)
          "resultsLap": <int>,    # optional, with "restart": "none": the lap the results were
                                  #   taken from (the race ends there)
          "source": "<where each fact comes from: the FIA document, race report, ...>"
        }
      ]
    }

Every entry must cite its `source` (eras spec 19: no invented race facts). With timed data
(FastF1, OpenF1) only `lap`, `restart` and `source` are needed; the stoppage and the restart
SC laps are read from the leader's lap times.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .paths import DATA_DIR, RAW_DIR

RED = "5"  # FastF1 / OpenF1 track-status code for a red flag
RESTARTS = ("standing", "rolling", "none")

# Behind the SC: the queue's spacing per car (sim_reference.BUNCH_GAP, measured on the final
# SC lap). A standing restart: the median gap between adjacent cars in the top ten at the end
# of lap 1, over the 47 races in data/raw/ with a green lap 1 (Nov 2026; p25-p75 0.52-1.01s).
BUNCH_GAP = 0.5
STANDING_RESTART_GAP = 0.74

# A leader lap holds the stoppage when it took this many times the race's median lap.
STOPPAGE_FACTOR = 3.0
# After the stoppage, a leader lap this much slower than the green laps that follow it ran
# behind the safety car (Zandvoort 2023: 138s against 81-86s).
RESTART_SC_FACTOR = 1.25
RESTART_SC_REFERENCE_LAPS = 8

REDFLAGS_DIR = DATA_DIR / "redflags"

FIA_2022 = (
    "FIA 2022 Formula 1 Sporting Regulations, issue 7 (29 June 2022), art. 57.4 b) vii)"
    " (tyres may be changed in the fast lane while suspended), 58.8 (resumed behind the safety"
    " car), 58.11 (standing start if the track is suitable), 58.12 (rolling start if not);"
    " https://www.fia.com/sites/default/files/"
    "fia_2022_formula_1_sporting_regulations_-_issue_7_-_2022-06-29.pdf"
)
RACEFANS_2023 = (
    "W. Wood, 'Do late-race standing restarts belong in F1?', RaceFans, 15 April 2023:"
    " standing restarts were introduced into the sporting regulations midway through 2018 and"
    " first used at the 2020 Italian GP; before that restarts were rolling behind the SC;"
    " https://www.racefans.net/?p=503663"
)
FIA_2005 = (
    "FIA 2005 Formula One Sporting Regulations, pp. 25-26 (cited by Wikipedia, 'List of"
    " red-flagged Formula One races', note 9): 'stopping' / 'restarting' became 'suspending'"
    " / 'resuming', every race resuming behind the safety car"
)

# A start voided (not suspended): stopped within this many laps before 2005, the race was
# rerun from scratch over its full distance.
VOIDED_START_LAPS = 2
VOIDED_START_BEFORE = 2005
VOIDED_START_RULE = (
    "Wikipedia, 1998 Belgian Grand Prix: the race was stopped within the first two laps, so"
    " 'a full restart over the original distance would take place'"
    " (https://en.wikipedia.org/wiki/1998_Belgian_Grand_Prix); from 2005 a stopped race is"
    f" suspended and resumed instead ({FIA_2005})"
)

# (first year, last year, restart, sources). A year in no row has no default.
RESTART_RULES: list[tuple[int, int | None, str, str]] = [
    (2019, None, "standing", f"{FIA_2022}; {RACEFANS_2023}"),
    (2005, 2017, "rolling", f"{FIA_2005}; {RACEFANS_2023}"),
]


class RedFlagError(ValueError):
    """A red flag the pipeline can't place or restart without a (hand-entered) file entry."""


def default_restart(year: int) -> str:
    """The regulation restart for a season (RESTART_RULES); raises with no rule for it."""
    for first, last, restart, _ in RESTART_RULES:
        if year >= first and (last is None or year <= last):
            return restart
    raise RedFlagError(
        f"no default red-flag restart for {year}: add an entry (with its source) to"
        f" data/redflags/<race-id>.json"
    )


# --- the red-flag file ------------------------------------------------------------------


def file_paths(race_id: str, raw_dir: Path = RAW_DIR, hand_dir: Path = REDFLAGS_DIR):
    """Hand-entered file first, then the one the ingest wrote from race control."""
    return [hand_dir / f"{race_id}.json", raw_dir / f"{race_id}.redflags.json"]


def validate_entries(entries: list[dict]) -> list[dict]:
    """Check a red-flag file's entries (see the module docstring); returns them."""
    for e in entries:
        where = f"red flag on lap {e.get('lap')}"
        if not isinstance(e.get("lap"), int) or e["lap"] < 1:
            raise RedFlagError(f"{where}: 'lap' must be a race lap")
        if e.get("restart") not in RESTARTS:
            raise RedFlagError(f"{where}: 'restart' must be one of {RESTARTS}")
        if not isinstance(e.get("source"), str) or not e["source"].strip():
            raise RedFlagError(f"{where}: every entry cites its 'source'")
        if "resumeLap" in e and (not isinstance(e["resumeLap"], int) or e["resumeLap"] < e["lap"]):
            raise RedFlagError(f"{where}: 'resumeLap' must be a lap on or after 'lap'")
        sc = e.get("restartScLaps", 0)
        if not isinstance(sc, int) or sc < 0:
            raise RedFlagError(f"{where}: 'restartScLaps' must be a whole number of laps")
        if "resultsLap" in e:
            if e["restart"] != "none":
                raise RedFlagError(f"{where}: 'resultsLap' is for a race never resumed")
            if not isinstance(e["resultsLap"], int) or not 1 <= e["resultsLap"] < e["lap"]:
                raise RedFlagError(f"{where}: 'resultsLap' must be a lap before 'lap'")
            if "resumeLap" in e:
                raise RedFlagError(f"{where}: a race never resumed has no 'resumeLap'")
    ended = [i for i, e in enumerate(entries) if "resultsLap" in e]
    if ended and ended != [len(entries) - 1]:
        raise RedFlagError("only the last red flag can end the race ('resultsLap')")
    return entries


def load_entries(race_id: str, raw_dir: Path = RAW_DIR, hand_dir: Path = REDFLAGS_DIR):
    """The race's red-flag entries (hand-entered file wins), or [] with no file."""
    for path in file_paths(race_id, raw_dir, hand_dir):
        if path.exists():
            return validate_entries(json.loads(path.read_text())["redFlags"])
    return []


def write_entries(race_id: str, entries: list[dict], raw_dir: Path = RAW_DIR) -> Path:
    """Write the ingest's red-flag file (data/raw/<race-id>.redflags.json)."""
    path = raw_dir / f"{race_id}.redflags.json"
    path.write_text(
        json.dumps({"race": race_id, "redFlags": validate_entries(entries)}, indent=1) + "\n"
    )
    return path


def restarts_from_messages(messages: list[dict], origin: str = "") -> list[dict]:
    """Red-flag entries from race control: [{date, lap, flag, message}] (OpenF1's fields;
    FastF1's are mapped by `fastf1_messages`). Each red flag's restart is the first "ROLLING
    START" / "STANDING START" message after it, else "none" if the chequered flag came first
    with no word of a resumption (otherwise the year's rule decides).
    `lap` is race control's lap number at the red flag; `origin` names the feed in `source`."""
    rows = sorted(messages, key=lambda r: str(r["date"]))
    out: list[dict] = []
    for i, r in enumerate(rows):
        if r.get("flag") != "RED":
            continue
        restart, quote, resumed = None, None, False
        for later in rows[i + 1 :]:
            msg = (later.get("message") or "").upper()
            resumed = resumed or "RESUME" in msg
            if later.get("flag") == "CHEQUERED":
                restart = None if resumed else "none"  # "none": the race never resumed
                break
            if later.get("flag") == "RED":
                break
            if "ROLLING START" in msg:
                restart, quote = "rolling", later
                break
            if "STANDING START" in msg:
                restart, quote = "standing", later
                break
        if restart is None:
            continue  # race control didn't say: the year's rule applies
        lap = int(r["lap_number"]) if r.get("lap_number") else None
        if lap is None:
            continue
        said = f" '{quote['message'].strip()}' at {quote['date']}" if quote else " (not resumed)"
        feed = f"{origin} race control" if origin else "race control"
        out.append(
            {"lap": lap, "restart": restart, "source": f"{feed}: RED FLAG at {r['date']};{said}"}
        )
    return out


def fastf1_messages(race_control: pd.DataFrame) -> list[dict]:
    """FastF1 `session.race_control_messages` in OpenF1's field names."""
    return [
        {
            "date": str(r.Time),
            "lap_number": None if pd.isna(r.Lap) else int(r.Lap),
            "flag": None if pd.isna(r.Flag) else str(r.Flag),
            "message": str(r.Message),
        }
        for r in race_control.itertuples()
    ]


# --- red flags that leave no red lap ---------------------------------------------------


def results_lap(entries: list[dict]) -> int | None:
    """The lap a race ended under the red flag took its results from, or None."""
    return next((int(e["resultsLap"]) for e in entries if "resultsLap" in e), None)


def is_voided_start(entry: dict, year: int | None) -> bool:
    """A start voided and rerun over the full distance (VOIDED_START_RULE): a red flag in the
    first VOIDED_START_LAPS laps before 2005, resumed, with no stoppage lap in the data."""
    return (
        year is not None
        and year < VOIDED_START_BEFORE
        and entry["lap"] <= VOIDED_START_LAPS
        and entry["restart"] in ("standing", "rolling")
        and "resumeLap" not in entry
    )


def cut_at_results(laps: pd.DataFrame, entries: list[dict]) -> pd.DataFrame:
    """A race ended under the red flag ends at its results lap: laps after it are cut (they
    don't count, and the classification is the order at the end of the results lap). Other
    races come back unchanged. A lap frame that stops before the results lap is an error."""
    last = results_lap(entries)
    if last is None:
        return laps
    have = int(laps["LapNumber"].max())
    if have < last:
        raise RedFlagError(f"results taken from lap {last}, but the lap data stops on lap {have}")
    return laps if have == last else laps[laps["LapNumber"] <= last].copy()


def race_entries(
    laps: pd.DataFrame, entries: list[dict], year: int | None
) -> tuple[pd.DataFrame, list[dict], list[str]]:
    """The red flags that are RED events in the race file, with the lap frame they apply to
    and build notes. A race ended under the red flag (`resultsLap`, see `cut_at_results`) and
    a voided start (`is_voided_start`) leave no RED event, so their entries are taken out; a
    voided start's `restartScLaps` mark laps 1..n of the rerun as SC laps. Red flags with a
    `resumeLap` have their laps marked red (`mark_hand_entries`)."""
    kept, notes = [], []
    for e in entries:
        if "resultsLap" in e:
            notes.append(
                f"red flag on lap {e['lap']}, never resumed: the race ends at its results lap"
                f" {e['resultsLap']} (no RED event)"
            )
        elif is_voided_start(e, year):
            sc = int(e.get("restartScLaps", 0))
            if sc:
                laps = _mark(laps, 1, sc, "4")
            notes.append(
                f"red flag on lap {e['lap']}: start voided, the race rerun over the full"
                f" distance (a fresh race, no RED event"
                + (f"; laps 1-{sc} of the rerun behind the SC)" if sc else ")")
            )
        else:
            kept.append(e)
    return mark_hand_entries(laps, kept), kept, notes


def _mark(laps: pd.DataFrame, first: int, last: int, code: str) -> pd.DataFrame:
    """Laps first..last of the frame with `code` added to their TrackStatus."""
    status = laps["TrackStatus"].astype("string").fillna("1")
    on = laps["LapNumber"].between(first, last) & ~status.str.contains(code)
    status = status.where(~on, status.where(status != "1", "") + code)
    return laps.assign(TrackStatus=status.astype(object))


# --- timing ---------------------------------------------------------------------------


def mark_hand_entries(laps: pd.DataFrame, entries: list[dict]) -> pd.DataFrame:
    """Sources with no red-flag timing (TUM, Jolpica): mark laps lap..resumeLap of each
    hand-entered red flag with the red-flag code, so every later step treats them as red
    laps. Entries without `resumeLap` (timed sources) leave the laps alone."""
    hand = [e for e in entries if "resumeLap" in e]
    if not hand:
        return laps
    for e in hand:
        laps = _mark(laps, e["lap"], e["resumeLap"], RED)
    return laps


def _lead_times(laps: pd.DataFrame) -> pd.Series:
    from .events import leader_laps

    lead = leader_laps(laps).set_index("LapNumber")["Time"].astype(float)
    lead.index = lead.index.astype(int)
    return lead


def stoppage_lap(lead_end: pd.Series, first: int) -> int | None:
    """The leader lap from `first` on that holds the stoppage (STOPPAGE_FACTOR x the race's
    median lap), or None if the race never resumed."""
    lap_time = lead_end.diff()
    median = float(lap_time.median())
    for n in lead_end.index:
        if n >= first and lap_time.get(n, 0.0) > STOPPAGE_FACTOR * median:
            return int(n)
    return None


def restart_sc_laps(lead_end: pd.Series, stop: int) -> int:
    """Leader laps straight after the stoppage run behind the safety car (RESTART_SC_FACTOR
    slower than the median of the RESTART_SC_REFERENCE_LAPS laps after the stoppage)."""
    lap_time = lead_end.diff()
    after = lap_time[(lap_time.index > stop) & (lap_time.index <= stop + RESTART_SC_REFERENCE_LAPS)]
    if after.empty:
        return 0
    ref = float(after.median())
    n = 0
    for lap in after.index:
        if after[lap] > RESTART_SC_FACTOR * ref:
            n += 1
        else:
            break
    return n


def refine_events(laps: pd.DataFrame, events: list[dict]) -> list[dict]:
    """Status-derived neutralizations with each RED event stretched to its stoppage lap and
    the safety-car laps of the resumption added as an SC event. Races without a red flag come
    back unchanged."""
    reds = [e for e in events if e["type"] == "RED"]
    if not reds:
        return events
    lead_end = _lead_times(laps)
    out = [e for e in events if e["type"] != "RED"]
    for e in reds:
        first = int(e["lap"])
        status_end = first + int(e.get("laps", 1)) - 1
        stop = stoppage_lap(lead_end, first)
        last = stop if stop is not None else max(status_end, int(lead_end.index.max()))
        red = {"lap": first, "type": "RED", "laps": last - first + 1}
        # The SC/VSC laps inside the red flag are red laps.
        out = [x for x in out if not (x["type"] in ("SC", "VSC") and first <= x["lap"] <= last)]
        out.append(red)
        if stop is None:
            continue
        n = restart_sc_laps(lead_end, stop)
        if n and not any(x["type"] == "SC" and x["lap"] == stop + 1 for x in out):
            out.append({"lap": stop + 1, "type": "SC", "laps": n})
    return out


def apply_hand_spans(events: list[dict], entries: list[dict]) -> list[dict]:
    """A hand-entered red flag's span (lap..resumeLap) and restart SC laps override the timed
    ones (sources without red-flag timing)."""
    out = list(events)
    for entry in entries:
        if "resumeLap" not in entry:
            continue
        lap, stop = entry["lap"], entry["resumeLap"]
        out = [
            x
            for x in out
            if not (x["type"] in ("SC", "VSC", "RED") and lap <= x["lap"] <= stop)
            and not (x["type"] == "SC" and x["lap"] == stop + 1)
        ]
        out.append({"lap": lap, "type": "RED", "laps": stop - lap + 1})
        if entry.get("restartScLaps"):
            out.append({"lap": stop + 1, "type": "SC", "laps": entry["restartScLaps"]})
    return sorted(out, key=lambda e: (e["lap"], e["type"]))


def annotate_restarts(events: list[dict], entries: list[dict], year: int | None) -> list[dict]:
    """Each RED event with its `restart`: the file entry for its lap, else the year's rule.
    An entry whose lap matches no red flag in the timing is an error (a typo, or a red flag the
    timing doesn't show: give it a resumeLap)."""
    by_lap = {e["lap"]: e for e in entries}
    reds = {e["lap"] for e in events if e["type"] == "RED"}
    stray = sorted(set(by_lap) - reds)
    if stray:
        raise RedFlagError(f"red-flag entries for laps {stray} match no red flag in the timing")
    out = []
    for e in events:
        if e["type"] != "RED":
            out.append(e)
            continue
        entry = by_lap.get(e["lap"])
        if entry is not None:
            restart = entry["restart"]
        elif year is not None:
            restart = default_restart(year)
        else:
            raise RedFlagError(f"red flag on lap {e['lap']}: no year to take its restart rule from")
        out.append({**e, **({"restart": restart} if restart != "none" else {})})
    return out


def stop_losses(
    laps: pd.DataFrame,
    events: list[dict],
    track_status: list[dict] | None,
    pit_loss: float,
    pit_loss_sc: float,
    pit_loss_vsc: float,
) -> dict[tuple[str, int], float]:
    """(driver, out-lap) -> loss for real stops whose out-lap is a red lap. Their in- and
    out-laps hold the stoppage, so they can't be measured: a car that entered the pits after
    the red flag was shown changed tyres in the stoppage (0, free); one that entered before
    paid the track's figure for the flag it entered under (status timeline). Without timing
    (hand entries) a stop on the first red lap pays pitLoss; later ones are free."""
    spans = [(e["lap"], e["lap"] + int(e.get("laps", 1)) - 1) for e in events if e["type"] == "RED"]
    if not spans:
        return {}
    from .scenario import real_strategy

    timeline = sorted(track_status or [], key=lambda r: float(r["time"]))

    def status_at(t: float) -> str:
        current = "1"
        for row in timeline:
            if float(row["time"]) > t:
                break
            current = str(row["status"])
        return current

    lead_end = _lead_times(laps)
    pit_in = {
        (str(r.Driver), int(r.LapNumber)): float(r.PitInTime)
        for r in laps.itertuples()
        if not pd.isna(r.PitInTime)
    }
    end = {
        (str(r.Driver), int(r.LapNumber)): float(r.Time)
        for r in laps.itertuples()
        if not pd.isna(r.Time)
    }
    out: dict[tuple[str, int], float] = {}
    for driver, stops in real_strategy(laps).items():
        for stop in stops:
            lap = stop["lap"]
            span = next(((a, b) for a, b in spans if a <= lap <= b), None)
            if span is None:
                continue
            if lap > span[0]:
                out[(driver, lap)] = 0.0
                continue
            entered = pit_in.get((driver, lap - 1), end.get((driver, lap - 1)))
            red_at = next(
                (
                    float(r["time"])
                    for r in timeline
                    if str(r["status"]) == RED
                    and float(r["time"]) >= float(lead_end.get(span[0] - 1, float("-inf")))
                ),
                None,
            )
            if entered is not None and red_at is not None and entered >= red_at:
                out[(driver, lap)] = 0.0
                continue
            flag = status_at(entered) if entered is not None else "1"
            out[(driver, lap)] = (
                pit_loss_sc if flag == "4" else pit_loss_vsc if flag in ("6", "7") else pit_loss
            )
    return out


# --- the rules the sims replay (sim_reference.py; packages/sim/src/redflag.ts) --------------


def plan(events: list[dict]) -> dict:
    """What the sim does with a race's red flags: `free` laps (a stop with its out-lap there
    costs nothing) and `wipes` {lap: (gap, red lap)} (at the end of `lap`, the running cars
    are lined up `gap` apart, if the red flag on `red lap` is in the run's events)."""
    free: set[int] = set()
    wipes: dict[int, tuple[float, int]] = {}
    scs = {int(e["lap"]): int(e.get("laps", 1)) for e in events if e["type"] == "SC"}
    for e in events:
        if e["type"] != "RED" or e.get("restart") not in ("standing", "rolling"):
            continue
        first = int(e["lap"])
        stop = first + int(e.get("laps", 1)) - 1
        free.update(range(first + 1, stop + 1))
        wipes[stop] = (BUNCH_GAP, first)
        if e["restart"] == "standing":
            wipes[stop + scs.get(stop + 1, 0)] = (STANDING_RESTART_GAP, first)
    return {"free": free, "wipes": wipes}


def line_up(live: list[str], cars: dict, gap: float) -> None:
    """Wipe the gaps: the running cars (in order) `gap` apart behind the leader."""
    for i in range(1, len(live)):
        cars[live[i]].total_time = cars[live[0]].total_time + i * gap
