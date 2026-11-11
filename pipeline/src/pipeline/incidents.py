"""Why each safety car or VSC came out (frontend: the race screen's flag and race control).

A neutralization is put down to the car that retired just before or as it came out (the race
model's RETIREMENT events), with that car's official result status from FastF1 ("Accident",
"Gearbox", ...). Race control's "CAR n (ABC) STOPPED AT TURN t" message, when there is one,
gives the corner. With no retirement nearby, race control's own words: a clash just before
(debris), debris named, or a yellow flag in a sector (a hazard); otherwise the cause is
unknown. Written to data/incidents.json, which the game reads for display only: the race
model and the server never see it.

Car faults (eras build plan 4.4) are hand-checked facts in the same file (step 2.6 writes
them): a race's list may also hold items with "type": "FAULT", which the build reads
(fault_facts) and turns into frozen FAULT events with fitted magnitudes (pipeline/faults.py):

    {"lap": 37, "type": "FAULT", "driver": "ROS", "status": "Power Unit",
     "detail": "MGU-K shut down approaching turn 1: no electrical boost", "turn": 1,
     "source": "https://en.wikipedia.org/wiki/2014_Canadian_Grand_Prix"}

- lap: the race lap the fault struck; driver: the car's code;
- status: what broke, in the official result words ("Power Unit", "Gearbox", "Puncture",
  "Tyre"...); it gives the sim's fault kind (FAULT_STATUS) unless `fault` names it;
- source: where the fact was checked (an http(s) URL; required);
- display only, optional: detail (what happened, in words), turn, note;
- sim parameters, optional: fault (the kind: "gear-stuck", "power-loss", "puncture",
  "tyre-failure" or "damage", a collision's contact and damage; overrides the status), laps
  (how many laps it lasted; absent: to the flag, or to the next stop for a tyre fault),
  untilStop (true: it lasted until the car's next stop; default true for a puncture or tyre
  failure), slowLap (true: its lap was a forced slow lap; default true for a puncture, a
  tyre failure or damage: the contact lap).

No magnitudes: the seconds lost are fitted from the car's real laps, never written here.

Team orders and let-bys (Eras model fixes M4) are hand-checked facts too, items with
"type": "TEAM_ORDER", which an Eras build turns into TEAM_ORDER events (team_order_events)
that both sims replay as a forced swap (sim_reference.apply_team_orders):

    {"lap": 68, "type": "TEAM_ORDER", "driver": "NOR", "passer": "PIA",
     "detail": "Norris slowed on the start-finish straight and gave Piastri the lead",
     "source": "https://en.wikipedia.org/wiki/2024_Hungarian_Grand_Prix"}

- lap: the race lap at whose end the passer is ahead (the timing's lap where it has one);
- driver: the car told to let the other by; passer: the car let by;
- source: where the fact was checked (http(s) URLs; required); detail, note: display only.

A safety car that picked up a car behind the race leader (Eras sim fixes, SC/red-flag
mechanics) is a hand-checked fact too, an item with "type": "SC_PICKUP", which an Eras build
writes onto the race's SC event that begins on that lap as `pickup` (sc_pickup_events):

    {"lap": 28, "type": "SC_PICKUP", "driver": "VER",
     "detail": "The safety car picked up Verstappen; Norris, leading, ran on ahead of it",
     "source": "https://en.wikipedia.org/wiki/2024_Miami_Grand_Prix"}

- lap: the first lap of the SC (the model's SC event); driver: the car it picked up;
- source: where the fact was checked (http(s) URL; required); detail, note: display only.
The sims run the cars ahead of that car on the road a racing lap on the SC's first lap, and
keep their gaps on its second (sim_reference.sc_front / queue_behind).

The SC causes written by `pipeline incidents` keep a race's FAULT, TEAM_ORDER and SC_PICKUP
items (write).
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


FAULT_KEYS = {
    "lap", "type", "driver", "status", "detail", "turn", "source", "note",
    "fault", "laps", "untilStop", "slowLap",
}  # fmt: skip
FAULT_KINDS = ("gear-stuck", "power-loss", "puncture", "tyre-failure", "damage")  # = faults
# A fault's official status -> the sim's fault kind (a fact's own `fault` overrides it).
FAULT_STATUS = {
    "Gearbox": "gear-stuck",
    "Transmission": "gear-stuck",
    "Power Unit": "power-loss",
    "Engine": "power-loss",
    "ERS": "power-loss",
    "Electrical": "power-loss",
    "Puncture": "puncture",
    "Tyre": "tyre-failure",
    "Collision": "damage",
    "Collision damage": "damage",
}


def check_fault_fact(item: dict, where: str) -> dict:
    """The fault fact with its kind (`fault`) filled in from its status; ValueError unless it
    is well formed (the module docstring)."""
    bad = sorted(set(item) - FAULT_KEYS)
    if bad:
        raise ValueError(f"{where}: unknown fault fields {bad} (magnitudes are fitted)")
    lap = item.get("lap")
    if not isinstance(lap, int) or isinstance(lap, bool) or lap < 1:
        raise ValueError(f"{where}: lap must be a race lap (int >= 1), got {lap!r}")
    if not isinstance(item.get("driver"), str) or not item["driver"]:
        raise ValueError(f"{where}: driver must be a driver code")
    kind = item.get("fault", FAULT_STATUS.get(item.get("status")))
    if kind not in FAULT_KINDS:
        raise ValueError(
            f"{where}: no fault kind (status {item.get('status')!r} isn't one of "
            f"{sorted(FAULT_STATUS)}; or set fault to one of {FAULT_KINDS})"
        )
    src = item.get("source")
    if not isinstance(src, str) or not src.startswith(("http://", "https://")):
        raise ValueError(f"{where}: a fault fact needs its source URL")
    if "laps" in item and (
        not isinstance(item["laps"], int) or isinstance(item["laps"], bool) or item["laps"] < 1
    ):
        raise ValueError(f"{where}: laps must be an int >= 1")
    for key in ("untilStop", "slowLap"):
        if key in item and not isinstance(item[key], bool):
            raise ValueError(f"{where}: {key} must be true or false")
    if item.get("laps") and item.get("untilStop"):
        raise ValueError(f"{where}: give laps or untilStop, not both")
    return {**item, "fault": kind}


TEAM_ORDER_KEYS = {"lap", "type", "driver", "passer", "detail", "source", "note"}


def check_team_order(item: dict, where: str) -> dict:
    """The team-order fact, checked (the module docstring); ValueError unless well formed."""
    bad = sorted(set(item) - TEAM_ORDER_KEYS)
    if bad:
        raise ValueError(f"{where}: unknown team-order fields {bad}")
    lap = item.get("lap")
    if not isinstance(lap, int) or isinstance(lap, bool) or lap < 1:
        raise ValueError(f"{where}: lap must be a race lap (int >= 1), got {lap!r}")
    for key in ("driver", "passer"):
        if not isinstance(item.get(key), str) or not item[key]:
            raise ValueError(f"{where}: {key} must be a driver code")
    if item["driver"] == item["passer"]:
        raise ValueError(f"{where}: a car can't let itself by")
    src = item.get("source")
    if not isinstance(src, str) or not src.startswith(("http://", "https://")):
        raise ValueError(f"{where}: a team-order fact needs its source URL")
    return dict(item)


SC_PICKUP_KEYS = {"lap", "type", "driver", "detail", "source", "note"}


def check_sc_pickup(item: dict, where: str) -> dict:
    """The SC pickup fact, checked (the module docstring); ValueError unless well formed."""
    bad = sorted(set(item) - SC_PICKUP_KEYS)
    if bad:
        raise ValueError(f"{where}: unknown SC pickup fields {bad}")
    lap = item.get("lap")
    if not isinstance(lap, int) or isinstance(lap, bool) or lap < 1:
        raise ValueError(f"{where}: lap must be a race lap (int >= 1), got {lap!r}")
    if not isinstance(item.get("driver"), str) or not item["driver"]:
        raise ValueError(f"{where}: driver must be a driver code")
    src = item.get("source")
    if not isinstance(src, str) or not src.startswith(("http://", "https://")):
        raise ValueError(f"{where}: an SC pickup fact needs its source URL")
    return dict(item)


def sc_pickup_facts(race_id: str, path: Path = INCIDENTS_PATH) -> list[dict]:
    """A race's SC pickups (its SC_PICKUP items), checked; [] for none."""
    if not path.exists():
        return []
    entry = json.loads(path.read_text()).get(race_id) or []
    if not isinstance(entry, list):
        raise ValueError(f"{path.name}: {race_id} must be a list")
    return [
        check_sc_pickup(item, f"{path.name}: {race_id}[{i}]")
        for i, item in enumerate(entry)
        if isinstance(item, dict) and item.get("type") == "SC_PICKUP"
    ]


def sc_pickup_events(facts: list[dict], model: dict) -> list[dict]:
    """The model's events with each pickup written onto the SC event beginning on its lap.
    Raises on a fact naming a car the race doesn't have, or a lap with no SC beginning."""
    codes = {d["code"] for d in model["drivers"]}
    events = [dict(e) for e in model["events"]]
    for f in facts:
        if f["driver"] not in codes:
            raise ValueError(
                f"{model['race']['id']}: SC pickup lap {f['lap']}: no car {f['driver']}"
            )
        sc = next((e for e in events if e["type"] == "SC" and e["lap"] == f["lap"]), None)
        if sc is None:
            raise ValueError(f"{model['race']['id']}: SC pickup lap {f['lap']}: no SC begins then")
        sc["pickup"] = f["driver"]
    return events


def team_order_facts(race_id: str, path: Path = INCIDENTS_PATH) -> list[dict]:
    """A race's team orders and let-bys (its TEAM_ORDER items), checked; [] for none."""
    if not path.exists():
        return []
    entry = json.loads(path.read_text()).get(race_id) or []
    if not isinstance(entry, list):
        raise ValueError(f"{path.name}: {race_id} must be a list")
    return [
        check_team_order(item, f"{path.name}: {race_id}[{i}]")
        for i, item in enumerate(entry)
        if isinstance(item, dict) and item.get("type") == "TEAM_ORDER"
    ]


def team_order_events(facts: list[dict], model: dict) -> list[dict]:
    """The race model's TEAM_ORDER events: the facts on the laps the game replays (after the
    takeover), for cars in the race. Raises on a fact naming a car the race doesn't have."""
    codes = {d["code"] for d in model["drivers"]}
    takeover = int(model["race"]["takeoverLap"])
    out = []
    for f in facts:
        for key in ("driver", "passer"):
            if f[key] not in codes:
                raise ValueError(
                    f"{model['race']['id']}: team order lap {f['lap']}: no car {f[key]}"
                )
        if f["lap"] > takeover:
            out.append({"lap": f["lap"], "type": "TEAM_ORDER", "driver": f["driver"],
                        "other": f["passer"]})  # fmt: skip
    return out


def fault_facts(race_id: str, path: Path = INCIDENTS_PATH) -> list[dict]:
    """A race's fault facts (its FAULT items in data/incidents.json), checked; [] for none."""
    if not path.exists():
        return []
    entry = json.loads(path.read_text()).get(race_id) or []
    if not isinstance(entry, list):
        raise ValueError(f"{path.name}: {race_id} must be a list")
    return [
        check_fault_fact(item, f"{path.name}: {race_id}[{i}]")
        for i, item in enumerate(entry)
        if isinstance(item, dict) and item.get("type") == "FAULT"
    ]


def write(race_id: str, items: list[dict] | dict, path: Path = INCIDENTS_PATH) -> Path:
    """Put one race's entry into data/incidents.json (or retirements.json; other races kept,
    keys sorted). A list replaces the race's SC causes but keeps its hand-checked FAULT items."""
    data = json.loads(path.read_text()) if path.exists() else {}
    old = data.get(race_id)
    if isinstance(items, list) and isinstance(old, list):
        hand = ("FAULT", "TEAM_ORDER", "SC_PICKUP")  # hand-checked facts
        kept = [i for i in old if isinstance(i, dict) and i.get("type") in hand]
        items = [*[i for i in items if i.get("type") not in hand], *kept]
    data[race_id] = items
    path.write_text(
        json.dumps(dict(sorted(data.items())), indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    return path
