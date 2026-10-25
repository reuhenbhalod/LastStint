"""Validate and write the race-model JSON (Implementation Plan 1.6).

Validates the assembled race model against packages/schema/race-model.schema.json before
writing data/races/<race-id>.json.
"""

from __future__ import annotations

import json
from pathlib import Path

from .paths import RACES_DIR, SCHEMA_PATH


def load_schema(schema_path: Path = SCHEMA_PATH) -> dict:
    """Load the race-model JSON schema."""
    return json.loads(schema_path.read_text())


def validate_model(model: dict, schema_path: Path = SCHEMA_PATH) -> None:
    """Raise jsonschema.ValidationError if the model does not match the schema."""
    import jsonschema

    jsonschema.validate(instance=model, schema=load_schema(schema_path))


def write_race(model: dict, races_dir: Path = RACES_DIR) -> Path:
    """Validate then write data/races/<race-id>.json. Returns the written path."""
    validate_model(model)
    races_dir.mkdir(parents=True, exist_ok=True)
    out = races_dir / f"{model['race']['id']}.json"
    out.write_text(json.dumps(model, indent=2))
    return out
