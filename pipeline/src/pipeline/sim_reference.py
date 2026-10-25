"""Python reference simulator (Implementation Plan 1.7).

A simple lap-loop simulator used to validate the model and to produce golden outputs for
the TypeScript port (data/golden/). The browser/Worker sim must match this.
"""

from __future__ import annotations


def simulate(model: dict, seed: int, decisions: list[dict] | None = None) -> dict:
    """Run one seeded simulation to the flag. Returns finishing order and gaps."""
    raise NotImplementedError("Phase 1.7: implement the reference lap loop")


def write_golden(model: dict, seeds: list[int]):
    """Write reference outputs for fixed seeds to data/golden/ for parity tests."""
    raise NotImplementedError("Phase 1.7: write golden files")
