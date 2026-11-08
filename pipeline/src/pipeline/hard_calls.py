"""Hard-call counter (eras build plan 1.5; eras spec section 4, "Which driver the player runs").

The counting runs in the TS sim (packages/sim/src/eras/hard-calls.ts: the moment finder and
the grader live there), through `pnpm --filter @laststint/sim hard-calls <race-file>`, which
prints one JSON line. This module runs it and writes the result into the race's Eras overlay,
data/eras/<race-id>.json, touching only `eras.hardCalls` and `eras.userSide` (every other key
is preserved; the file is created if missing).

A Daily or Gauntlet pool race (a shared race) keeps its Daily file, which has no `eras` or
`rules` block, so the sim would grade it as Daily does. `eras_race_file` gives the counter the
model the Eras API serves instead (the file merged with its overlay, as `build.apply_eras` and
the Worker's withErasOverlay merge it), so its count uses the Eras grader (docs/eras-grader.md).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from . import paths

ERAS_DIR = paths.DATA_DIR / "eras"  # authored Eras overlays, one per race


def eras_race_file(
    race_id: str,
    tmp_dir: Path,
    races_dir: Path = paths.RACES_DIR,
    eras_dir: Path = ERAS_DIR,
    pools_path: Path | None = None,
) -> Path:
    """The race file the counter grades for `race_id`: its data/races file, or, for a shared
    race with an overlay, that file merged with the overlay, written into `tmp_dir`."""
    from . import build

    race_file = Path(races_dir) / f"{race_id}.json"
    shared = build.shared_races(pools_path) if pools_path else build.shared_races()
    overlay = build.load_overlay(race_id, eras_dir) if race_id in shared else None
    if not overlay or not race_file.is_file():
        return race_file
    model = json.loads(race_file.read_text())
    merged, _ = build.apply_eras(model, [], overlay)
    out = Path(tmp_dir) / f"{race_id}.json"
    out.write_text(json.dumps(merged))
    return out


def run_counter(race_file: Path, samples: int | None = None) -> dict:
    """Run the TS hard-call counter on a race file and return its result.

    The result has hardCalls (code -> count), gaveUp (code -> percentage points), userSide,
    decidedBy and samples. Raises RuntimeError if pnpm is missing or the counter fails.
    """
    if not race_file.is_file():
        raise FileNotFoundError(f"no race file at {race_file}")
    if samples is not None and samples < 1:
        raise ValueError(f"samples must be a positive integer, got {samples}")
    pnpm = shutil.which("pnpm")
    if pnpm is None:
        raise RuntimeError("pnpm not found on PATH (needed to run the TS sim)")
    cmd = [pnpm, "--silent", "--filter", "@laststint/sim", "hard-calls", str(race_file.resolve())]
    if samples is not None:
        cmd += ["--samples", str(samples)]
    proc = subprocess.run(cmd, cwd=paths.REPO_ROOT, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"hard-call counter failed ({proc.returncode}): {proc.stderr.strip()}")
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    if not lines:
        raise RuntimeError("hard-call counter printed nothing")
    return parse_result(lines[-1])


def parse_result(line: str) -> dict:
    """Parse and check the counter's JSON line."""
    try:
        result = json.loads(line)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"hard-call counter printed invalid JSON: {line!r}") from e
    counts = result.get("hardCalls") if isinstance(result, dict) else None
    if not isinstance(counts, dict) or not all(
        isinstance(v, int) and v >= 0 for v in counts.values()
    ):
        raise RuntimeError(f"hard-call counter result has no valid hardCalls: {line!r}")
    if result.get("userSide") not in counts:
        raise RuntimeError(f"hard-call counter userSide is not a counted driver: {line!r}")
    return result


def write_overlay(race_id: str, result: dict, eras_dir: Path = ERAS_DIR) -> Path:
    """Set eras.hardCalls and eras.userSide in <eras_dir>/<race-id>.json; keep everything else."""
    path = eras_dir / f"{race_id}.json"
    overlay: dict = {}
    if path.exists():
        overlay = json.loads(path.read_text())
        if not isinstance(overlay, dict):
            raise ValueError(f"{path}: an Eras overlay must be a JSON object")
    eras = overlay.setdefault("eras", {})
    if not isinstance(eras, dict):
        raise ValueError(f"{path}: 'eras' must be a JSON object")
    eras["hardCalls"] = dict(result["hardCalls"])
    eras["userSide"] = result["userSide"]
    eras_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(overlay, indent=2) + "\n")
    return path
