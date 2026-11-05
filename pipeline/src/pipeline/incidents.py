"""Why each safety car or VSC came out (frontend: the race screen's flag and race control).

A neutralization is put down to the car that retired just before or as it came out (the race
model's RETIREMENT events), with that car's official result status from FastF1 ("Accident",
"Gearbox", ...). Race control's "CAR n (ABC) STOPPED AT TURN t" message, when there is one,
gives the corner. With no retirement nearby, race control's own words: a clash just before
(debris), debris named, or a yellow flag in a sector (a hazard); otherwise the cause is
unknown. Written to data/incidents.json, which the game reads for display only: the race
model and the server never see it.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from . import ingest, paths

INCIDENTS_PATH = paths.DATA_DIR / "incidents.json"
RETIREMENTS_PATH = paths.DATA_DIR / "retirements.json"
STOPPED = re.compile(r"CAR \d+ \((\w{3})\) STOPPED AT TURN (\d+)")
CLASH = re.compile(r"TURN (\d+) INCIDENT INVOLVING CARS \d+ \((\w{3})\) AND \d+ \((\w{3})\)")
YELLOW = re.compile(r"YELLOW IN TRACK SECTOR (\d+)")


def causes(
    model: dict, status: dict[str, str], messages: list[tuple[int | None, str]]
) -> list[dict]:
    """One cause per SC/VSC event in `model` (lap, type, and the driver, status and turn
    when known). `messages` are race control's (lap, text)."""
    retired = [e for e in model["events"] if e["type"] == "RETIREMENT"]
    out = []
    for e in model["events"]:
        if e["type"] not in ("SC", "VSC"):
            continue
        lap = e["lap"]
        near = [r for r in retired if lap - 2 <= r["lap"] <= lap + 1]
        # The closest retirement to the deployment, preferring one just before it.
        near.sort(key=lambda r: (abs(r["lap"] - lap), r["lap"] > lap))
        item: dict = {"lap": lap, "type": e["type"]}
        if near:
            code = near[0]["driver"]
            item["driver"] = code
            item["status"] = status.get(code, "Retired")
            for m_lap, text in messages:
                hit = STOPPED.search(text)
                if hit and hit.group(1) == code and (m_lap is None or abs(m_lap - lap) <= 3):
                    item["turn"] = int(hit.group(2))
                    break
        else:
            # No car out: race control's words. A clash just before (debris to clear), debris
            # named, or a yellow flag in a sector (a hazard there).
            recent = [t for m_lap, t in messages if m_lap is not None and lap - 2 <= m_lap <= lap]
            clash = next((m for t in reversed(recent) if (m := CLASH.search(t))), None)
            yellow = next((m for t in reversed(recent) if (m := YELLOW.search(t))), None)
            if clash:
                item.update(
                    status="Debris", cars=[clash.group(2), clash.group(3)], turn=int(clash.group(1))
                )
            elif any("DEBRIS" in t for t in recent):
                item["status"] = "Debris"
            elif yellow:
                item.update(status="Hazard", sector=int(yellow.group(1)))
        out.append(item)
    return out


def retirements(
    model: dict, status: dict[str, str], messages: list[tuple[int | None, str]]
) -> dict[str, dict]:
    """Why each car in `model` retired (its official status), and where when race control said
    ("CAR n (ABC) STOPPED AT TURN t" near its lap): the race screen parks it there."""
    out: dict[str, dict] = {}
    for e in model["events"]:
        if e["type"] != "RETIREMENT":
            continue
        code = e["driver"]
        item: dict = {"lap": e["lap"], "status": status.get(code, "Retired")}
        for m_lap, text in messages:
            hit = STOPPED.search(text)
            if hit and hit.group(1) == code and (m_lap is None or abs(m_lap - e["lap"]) <= 3):
                item["turn"] = int(hit.group(2))
                break
        out[code] = item
    return out


def fetch(year: int, event: str) -> tuple[dict[str, str], list[tuple[int | None, str]]]:
    """Result statuses by driver code, and race control's messages (network on first use)."""
    import fastf1

    ingest.enable_cache()
    session = fastf1.get_session(year, event, "R")
    session.load(laps=False, telemetry=False, weather=False, messages=True)
    status = {str(r["Abbreviation"]): str(r["Status"]) for _, r in session.results.iterrows()}
    msgs = []
    for _, r in session.race_control_messages.iterrows():
        lap = r.get("Lap")
        msgs.append((int(lap) if lap == lap and lap is not None else None, str(r["Message"])))
    return status, msgs


def fetch_openf1(year: int, country: str) -> tuple[dict[str, str], list[tuple[int | None, str]]]:
    """The same from OpenF1 (races registered with source "openf1"): race control's messages;
    OpenF1 has no result statuses, so a retirement reads "Retired"."""
    import urllib.parse
    import urllib.request

    from . import openf1

    query = urllib.parse.urlencode({"year": year, "session_name": "Race", "country_name": country})
    with urllib.request.urlopen(f"{openf1.API}/sessions?{query}", timeout=60) as r:
        key = int(json.load(r)[0]["session_key"])
    raw = openf1.fetch(key)
    msgs = [(m.get("lap_number"), str(m.get("message") or "")) for m in raw["race_control"]]
    return {}, msgs


def write(race_id: str, items: list[dict] | dict, path: Path = INCIDENTS_PATH) -> Path:
    """Put one race's entry into data/incidents.json (or retirements.json; other races kept,
    keys sorted)."""
    data = json.loads(path.read_text()) if path.exists() else {}
    data[race_id] = items
    path.write_text(json.dumps(dict(sorted(data.items())), indent=1) + "\n")
    return path
