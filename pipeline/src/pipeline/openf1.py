"""OpenF1 ingest (weather spec, data source decision Nov 5 2026).

Since October 2026 FastF1's live-timing archive needs an F1TV subscription. OpenF1
(api.openf1.org, free, 2023 on) serves the same timing: laps, tyre stints, pit stops, race
control, positions and the weather by the minute. This turns a race session into the same raw
snapshot the FastF1 ingest writes (ingest.LAP_COLUMNS, session seconds), plus its track-status
timeline, so the rest of the pipeline doesn't know the difference. Responses are cached under
cache/openf1/ (git-ignored), so each race downloads once.

Session seconds count from the session's scheduled start; only differences matter downstream
(gaps, and the status timeline against lap ends, which share the clock).
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

import pandas as pd

from .paths import CACHE_DIR

API = "https://api.openf1.org/v1"
# Seconds from an out-lap's start to the lane exit, where no pit record gives it.
DERIVED_LANE_EXIT = 20.0
ENDPOINTS = ("sessions", "drivers", "laps", "stints", "pit", "position", "race_control", "weather")


def _cache_path(cache_dir: Path, session_key: int, endpoint: str) -> Path:
    return cache_dir / "openf1" / str(session_key) / f"{endpoint}.json"


def fetch(session_key: int, cache_dir: Path = CACHE_DIR, sleep=time.sleep) -> dict[str, list]:
    """Every endpoint for a session, from the cache or the API (retrying a few times)."""
    out: dict[str, list] = {}
    for endpoint in ENDPOINTS:
        path = _cache_path(cache_dir, session_key, endpoint)
        if path.exists():
            out[endpoint] = json.loads(path.read_text())
            continue
        url = f"{API}/{endpoint}?session_key={session_key}"
        for attempt in range(5):
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    data = json.load(r)
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:  # OpenF1's answer for no records (Monaco 2023's pit stops)
                    data = []
                    break
                if attempt == 4:
                    raise
                sleep(2 + 3 * attempt)
            except Exception:
                if attempt == 4:
                    raise
                sleep(2 + 3 * attempt)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))
        out[endpoint] = data
        sleep(0.5)  # OpenF1 asks for a few requests a second at most
    return out


def _t(stamp: str | None, t0: datetime) -> float | None:
    if not stamp:
        return None
    return round((datetime.fromisoformat(stamp) - t0).total_seconds(), 3)


def session_start(raw: dict) -> datetime:
    return datetime.fromisoformat(raw["sessions"][0]["date_start"])


# Race control -> FastF1 track status codes: 1 green, 2 yellow (any sector), 4 SC, 5 red,
# 6 VSC, 7 VSC ending. A neutralization holds until the track is clear; a sector's yellow
# until that sector is cleared.
def track_status(raw: dict) -> list[dict]:
    """The race's track-status timeline [{time (session s), status}], as FastF1's."""
    t0 = session_start(raw)
    out: list[dict] = []
    neutral: str | None = None
    yellow: set[str] = set()
    for r in sorted(raw["race_control"], key=lambda r: r["date"]):
        msg = (r.get("message") or "").upper()
        flag, scope = r.get("flag"), r.get("scope")
        if r.get("category") == "SafetyCar":
            if "VIRTUAL SAFETY CAR DEPLOYED" in msg:
                neutral = "6"
            elif "ENDING" in msg:
                neutral = "7"
            elif "SAFETY CAR DEPLOYED" in msg:
                neutral = "4"
        elif flag == "RED":
            neutral = "5"
        elif flag in ("GREEN", "CLEAR") and scope == "Track":
            neutral = None
            yellow.clear()
        elif flag in ("YELLOW", "DOUBLE YELLOW"):
            yellow.add(str(r.get("sector") or scope))
        elif flag == "CLEAR" and scope == "Sector":
            yellow.discard(str(r.get("sector")))
        code = neutral or ("2" if yellow else "1")
        if not out or out[-1]["status"] != code:
            out.append({"time": _t(r["date"], t0), "status": code})
    return out


def _status_during(timeline: list[dict], start: float, end: float) -> str:
    """FastF1's per-lap TrackStatus: every status in force during the lap, in order."""
    current = "1"
    codes: list[str] = []
    for s in timeline:
        if s["time"] <= start:
            current = s["status"]
        elif s["time"] < end:
            if current not in codes:
                codes.append(current)
            current = s["status"]
    if current not in codes:
        codes.append(current)
    return "".join(codes)


def laps_frame(raw: dict) -> pd.DataFrame:
    """The race's laps in the FastF1 snapshot's shape (ingest.LAP_COLUMNS)."""
    t0 = session_start(raw)
    who = {d["driver_number"]: (d["name_acronym"], d["team_name"]) for d in raw["drivers"]}
    timeline = track_status(raw)
    stints = raw["stints"]
    pits = {(p["driver_number"], p["lap_number"]): p for p in raw["pit"]}
    # No pit records (Monaco 2023): the stops are the stint changes; the lane entry is taken
    # as the in-lap's end and the lane time as the race's typical one.
    derived = not pits
    if derived:
        for st in stints:
            later = [
                x
                for x in stints
                if x["driver_number"] == st["driver_number"]
                and x["stint_number"] == st["stint_number"] + 1
            ]
            if later and st["lap_end"]:
                pits[(st["driver_number"], st["lap_end"])] = {"date": None, "lane_duration": None}
    positions = sorted(raw["position"], key=lambda p: p["date"])
    pos_by_driver: dict[int, list[tuple[float, int]]] = {}
    for p in positions:
        pos_by_driver.setdefault(p["driver_number"], []).append((_t(p["date"], t0), p["position"]))

    # Laps begun after the chequered flag aren't race laps (OpenF1 lists a 79th at Monaco 2023).
    # The winner's phantom lap after the flag (untimed) is dropped too: no lap past the
    # chequered flag's.
    flags = [r for r in raw["race_control"] if r.get("flag") == "CHEQUERED"]
    chequered = _t(min(r["date"] for r in flags), t0) if flags else None
    last_lap = min((r["lap_number"] for r in flags if r.get("lap_number")), default=None)
    by_driver: dict[int, list[dict]] = {}
    for lap in raw["laps"]:
        begun = _t(lap["date_start"], t0)
        if chequered is not None and begun is not None and begun > chequered:
            continue
        if last_lap is not None and lap["lap_number"] > last_lap:
            continue
        by_driver.setdefault(lap["driver_number"], []).append(lap)

    rows = []
    for num, laps in by_driver.items():
        if num not in who:
            continue
        laps = sorted(laps, key=lambda x: x["lap_number"])
        code, team = who[num]
        mine = [s for s in stints if s["driver_number"] == num]
        for i, lap in enumerate(laps):
            n = lap["lap_number"]
            start = _t(lap["date_start"], t0)
            nxt = laps[i + 1] if i + 1 < len(laps) else None
            end = _t(nxt["date_start"], t0) if nxt and nxt["lap_number"] == n + 1 else None
            dur = lap["lap_duration"]
            if end is None and start is not None and dur is not None:
                end = round(start + dur, 3)
            if dur is None and start is not None and end is not None:
                dur = round(end - start, 3)
            # A car's last lap, never finished (it stopped on it): timed at its start, so the
            # pipeline sees the retirement on that lap (events.retirement_events). No lap time.
            stopped = end is None and nxt is None and start is not None and n > 1
            if stopped:
                end = start
            # The stint covering the lap; a lap past the last recorded one (a crash, the
            # final lap) is still on the latest set.
            started = [x for x in mine if x["lap_start"] and x["lap_start"] <= n]
            covering = [x for x in started if x["lap_end"] and n <= x["lap_end"]]
            stint = (covering or sorted(started, key=lambda x: x["lap_start"])[-1:] or [None])[0]
            pit = pits.get((num, n))
            # The in-lap is still on the old set (as FastF1 has it); OpenF1 sometimes starts
            # the new stint on it (Canada 2024). Not when the in-lap is also an out-lap: that
            # set did start there (Alonso at Monaco 2023: out on mediums, straight back in).
            out_lap = bool(lap["is_pit_out_lap"]) or (derived and (num, n - 1) in pits)
            if derived:  # OpenF1's out-lap flags lag the stints where it has no pit records
                out_lap = (num, n - 1) in pits
            if pit and stint and stint["lap_start"] == n and not out_lap:
                before = [x for x in mine if x["stint_number"] == stint["stint_number"] - 1]
                if before:
                    stint = {**before[0], "lap_end": n}
            prev_pit = pits.get((num, n - 1))
            pit_in = _t(pit["date"], t0) if pit and pit["date"] else (end if pit else None)
            pit_out = None
            if out_lap and prev_pit:
                if prev_pit["date"]:
                    pit_out = round(_t(prev_pit["date"], t0) + (prev_pit["lane_duration"] or 0), 3)
                elif start is not None:
                    pit_out = round(start + DERIVED_LANE_EXIT, 3)
            position = None
            if end is not None:
                for t, p in pos_by_driver.get(num, []):
                    if t is not None and t <= end:
                        position = p
                    else:
                        break
            rows.append(
                {
                    "Driver": code,
                    "Team": team,
                    "LapNumber": float(n),
                    "LapTime": dur,
                    "Time": end,
                    "Compound": stint["compound"] if stint else None,
                    "TyreLife": float(stint["tyre_age_at_start"] + n - stint["lap_start"] + 1)
                    if stint
                    else None,
                    "Stint": float(stint["stint_number"]) if stint else None,
                    "PitInTime": pit_in,
                    "PitOutTime": pit_out,
                    "TrackStatus": _status_during(timeline, start, end)
                    if start is not None and end is not None
                    else "1",
                    "Position": float(position) if position is not None else None,
                    # OpenF1 has no accuracy flag: a lap is accurate when fully timed and not
                    # an in- or out-lap (as FastF1 marks them).
                    "IsAccurate": dur is not None and start is not None and not pit and not out_lap,
                }
            )
    df = pd.DataFrame(rows)
    return df.sort_values(["LapNumber", "Time"]).reset_index(drop=True)


def weather(raw: dict) -> list[dict]:
    """The weather by the minute [{time (session s), rain, track, air}]."""
    t0 = session_start(raw)
    return [
        {
            "time": _t(w["date"], t0),
            "rain": bool(w["rainfall"]),
            "track": w["track_temperature"],
            "air": w["air_temperature"],
        }
        for w in sorted(raw["weather"], key=lambda w: w["date"])
    ]


def race_facts(raw: dict, df: pd.DataFrame) -> dict:
    s = raw["sessions"][0]
    return {
        "totalLaps": int(df["LapNumber"].max()),
        "eventName": s.get("country_name"),
        "location": s.get("location"),
        "country": s.get("country_name"),
        "date": s.get("date_start"),
    }
