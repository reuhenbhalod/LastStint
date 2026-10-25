# pipeline

Offline Python pipeline that turns raw F1 timing (via FastF1) into a compact race-model
JSON file per race. Runs locally or in GitHub Actions — **never on a server**.

```bash
uv sync                           # create .venv and install deps
uv run pytest                     # tests
uv run pipeline build abu-dhabi-2021   # (Phase 1) build one race model
```

## Modules (`src/pipeline/`)

| Module            | Responsibility |
|-------------------|----------------|
| `ingest.py`       | FastF1 loading + local cache; raw parquet snapshot per race |
| `clean.py`        | Lap filtering rules (accuracy, green-flag, pit/out-laps, traffic, outliers) |
| `fit.py`          | OLS lap-time model: driver pace, compound offset/wear, fuel, cliff, noise |
| `track.py`        | Pit loss, dirty air, overtaking difficulty, SC/VSC lap times |
| `events.py`       | SC, VSC, red flags, rain, retirements from race control messages |
| `scenario.py`     | Takeover state, real strategies, candidate decision moments |
| `export.py`       | Validate against the JSON schema and write `data/races/<id>.json` |
| `validate.py`     | Replay real strategies; report gap error + finishing-order accuracy |
| `sim_reference.py`| Python reference simulator; produces golden files for the TS port |
| `cli.py`          | `pipeline build <race>` entry point (typer) |

Heavy scientific imports (fastf1, statsmodels, scipy) are done inside functions, not at
module top level, so `import pipeline` stays fast.
