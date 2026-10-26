"""Phase 0 smoke tests: the package imports and light paths work without heavy deps."""

from __future__ import annotations

import pipeline
from pipeline import clean, export, ingest


def test_version_and_schema_version():
    assert pipeline.__version__ == "0.0.0"
    assert pipeline.SCHEMA_VERSION == 5


def test_cleaning_constants():
    assert clean.TRAFFIC_GAP_SECONDS == 1.0
    assert clean.OUTLIER_FACTOR == 1.07


def test_lap_columns_present():
    for col in ("Driver", "LapNumber", "Compound", "TyreLife", "Position"):
        assert col in ingest.LAP_COLUMNS


def test_schema_file_is_valid_json():
    schema = export.load_schema()
    assert schema["$schema"].startswith("http")
    assert "schemaVersion" in schema.get("properties", {})
