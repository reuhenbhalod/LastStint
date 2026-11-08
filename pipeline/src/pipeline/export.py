"""Validate and write the race-model JSON (Implementation Plan 1.6).

Validates the assembled race model against packages/schema/race-model.schema.json before
writing data/races/<race-id>.json. The schema checks each field's shape; `check_references`
adds the cross-field checks JSON Schema can't express (the drivers the Eras block names must
be in the race).
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

from .paths import RACES_DIR, SCHEMA_PATH


def load_schema(schema_path: Path = SCHEMA_PATH) -> dict:
    """Load the race-model JSON schema."""
    return json.loads(schema_path.read_text())


def check_references(model: dict) -> None:
    """Raise ValueError if the Eras block names a driver who isn't in the race.

    Covers eras.userSide, the hardCalls keys, the rival of a beat-rival / deny target or
    rewrite condition, and the storyline calls' drivers (each call must be one of its driver's
    real stops). A race without an Eras block always passes.
    """
    eras = model.get("eras")
    if not eras:
        return
    codes = {d["code"] for d in model["drivers"]}
    named: list[tuple[str, str]] = []
    if "userSide" in eras:
        named.append(("eras.userSide", eras["userSide"]))
    named += [(f"eras.hardCalls.{code}", code) for code in eras.get("hardCalls", {})]
    conditions = [("eras.target", eras.get("target"))]
    # A race the Eras side really won has no rewrite condition (owner decision, Nov 8 2026).
    rewrite = (eras.get("storyline") or {}).get("rewriteCondition")
    if rewrite:
        conditions.append(("eras.storyline.rewriteCondition", rewrite))
    named += [
        (f"{where}.rival", cond["rival"]) for where, cond in conditions if cond and "rival" in cond
    ]
    calls = eras.get("storylineCalls") or []
    named += [(f"eras.storylineCalls[{i}].driver", c["driver"]) for i, c in enumerate(calls)]
    unknown = [f"{where}={code}" for where, code in named if code not in codes]
    if unknown:
        raise ValueError(f"{model['race']['id']}: drivers not in the race: {', '.join(unknown)}")
    # A storyline call is one of its driver's real stops (its out-lap).
    real = {d["code"]: {s["lap"] for s in d["realStrategy"]} for d in model["drivers"]}
    stray = [
        f"eras.storylineCalls[{i}] ({c['driver']} lap {c['lap']})"
        for i, c in enumerate(calls)
        if c["lap"] not in real[c["driver"]]
    ]
    if stray:
        raise ValueError(f"{model['race']['id']}: not a real stop: {', '.join(stray)}")


def validate_model(model: dict, schema_path: Path = SCHEMA_PATH) -> None:
    """Raise jsonschema.ValidationError if the model does not match the schema, or ValueError
    if the Eras block names a driver who isn't in the race (check_references)."""
    import jsonschema

    jsonschema.validate(instance=model, schema=load_schema(schema_path))
    check_references(model)


def with_eras_fields(
    model: dict,
    *,
    eras: dict | None = None,
    provenance: dict | None = None,
    rules: dict | None = None,
    storyline_events: list[tuple[int, str]] | None = None,
    decision_moments: list[dict] | None = None,
) -> dict:
    """Return a validated copy of an assembled model with the schema v11 blocks set.

    None leaves a block as it is (absent keeps today's behaviour). `storyline_events` lists
    (lap, type) pairs, such as (53, "SC"), to flag `storylineEvent: true`; each must match an
    event in the model. `decision_moments` replaces the model's moments (the Eras side's, for
    a race whose Eras driver isn't its Daily one). Then the Eras view (`eras_side`): when the
    eras block's userSide is the model's rival, userSide and rival swap, so the model is played
    from the Eras driver's car (every car's takeover state is its own, so nothing else moves).
    Write the result with `write_race`.
    """
    out = copy.deepcopy(model)
    for key, block in (("eras", eras), ("provenance", provenance), ("rules", rules)):
        if block is not None:
            out[key] = copy.deepcopy(block)
    if decision_moments is not None:
        out["decisionMoments"] = copy.deepcopy(decision_moments)
    out = eras_side(out)
    for lap, kind in storyline_events or []:
        hits = [e for e in out["events"] if e["lap"] == lap and e["type"] == kind]
        if not hits:
            raise ValueError(f"{out['race']['id']}: no {kind} event on lap {lap} to flag")
        for event in hits:
            event["storylineEvent"] = True
    validate_model(out)
    return out


def eras_side(model: dict) -> dict:
    """The model seen from its eras block's userSide (eras spec section 4: the hard-call
    side): unchanged when that is absent or already the userSide; userSide and rival swapped
    (each keeping its key's place) when it is the rival. Any other driver is an error: the Eras
    side must be one of the race's two storyline drivers."""
    side = (model.get("eras") or {}).get("userSide")
    if side is None or side == model["userSide"]:
        return model
    if side != model["rival"]:
        raise ValueError(
            f"{model['race']['id']}: eras.userSide {side} is neither the userSide"
            f" {model['userSide']} nor the rival {model['rival']}"
        )
    return {**model, "userSide": model["rival"], "rival": model["userSide"]}


def write_race(model: dict, races_dir: Path = RACES_DIR) -> Path:
    """Validate then write data/races/<race-id>.json. Returns the written path."""
    validate_model(model)
    races_dir.mkdir(parents=True, exist_ok=True)
    out = races_dir / f"{model['race']['id']}.json"
    out.write_text(json.dumps(model, indent=2))
    return out
