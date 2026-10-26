"""Repo-root-anchored paths, so pipeline commands work from any working directory.

Resolved from this file's location (pipeline/src/pipeline/paths.py), not from cwd.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

CACHE_DIR = REPO_ROOT / "cache"
DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
RACES_DIR = DATA_DIR / "races"
GOLDEN_DIR = DATA_DIR / "golden"

PIPELINE_ENV = REPO_ROOT / "pipeline" / ".env"  # git-ignored F1 account credentials
CONFIG_DIR = REPO_ROOT / "pipeline" / "config"
COMPOUND_PRIORS_PATH = CONFIG_DIR / "compound_priors.json"

SCHEMA_PATH = REPO_ROOT / "packages" / "schema" / "race-model.schema.json"
