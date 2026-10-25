"""Takeover state and decision moments (Implementation Plan 1.5).

Record each car's state at the takeover lap (position, gap, compound, tyre age) and its
real strategy, and surface candidate decision moments (SC/VSC starts, rival pitting,
undercut windows, tyre cliff, rain). The final 2-4 per race are hand-picked in Phase 5.
"""

from __future__ import annotations


def state_at_takeover(laps, takeover_lap: int) -> list[dict]:
    """Per-car position, gap, compound, tyre age and real strategy at the takeover lap."""
    raise NotImplementedError("Phase 1.5: read per-car state at takeover")


def candidate_decision_moments(laps, events: list[dict]) -> list[int]:
    """Candidate decision-moment laps; the final set is hand-picked in Phase 5."""
    raise NotImplementedError("Phase 1.5: detect candidate decision moments")
