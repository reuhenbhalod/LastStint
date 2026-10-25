"""Race events (Implementation Plan 1.5).

Read race control messages and track status to log safety cars, VSCs, red flags, rain and
retirements with the laps they occurred on. These are frozen in the sim.
"""

from __future__ import annotations


def extract_events(session) -> list[dict]:
    """Return a list of {lap, type, laps?} events from race control + track status."""
    raise NotImplementedError("Phase 1.5: parse race control messages and track status")
