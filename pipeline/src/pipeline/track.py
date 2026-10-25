"""Track parameters (Implementation Plan 1.4).

Pit loss (normal and under SC/VSC), dirty-air penalty, overtaking difficulty (logistic
regression of pass probability on pace delta and gap), and SC/VSC neutralized lap times.
"""

from __future__ import annotations


def pit_loss(laps, under_neutralization: bool = False) -> float:
    """In-lap + out-lap minus two clean laps, median over all (relevant) stops."""
    raise NotImplementedError("Phase 1.4: measure pit loss")


def dirty_air_penalty(clean_laps, traffic_laps) -> float:
    """Mean lap-time difference of traffic laps vs clean laps, same driver and stint."""
    raise NotImplementedError("Phase 1.4: estimate dirty-air penalty")


def overtake_model(passes):
    """Logistic regression of pass probability on pace delta and gap; pool seasons."""
    raise NotImplementedError("Phase 1.4: fit overtaking difficulty")
