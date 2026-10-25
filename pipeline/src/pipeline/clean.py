"""Lap cleaning rules (Implementation Plan 1.2).

Clean laps show true pace. Drop: inaccurate laps, non-green laps, pit in/out-laps and lap
1, traffic laps (kept separately for the dirty-air fit), and outliers slower than ~107% of
the driver's median clean lap. Log how many laps each rule removes.
"""

from __future__ import annotations

# Traffic = within this many seconds of the car ahead (kept to fit dirty-air penalty).
TRAFFIC_GAP_SECONDS = 1.0
# Outlier cutoff as a multiple of the driver's median clean lap.
OUTLIER_FACTOR = 1.07


def clean_laps(laps):
    """Return (clean_laps, traffic_laps, removal_log) for one race's lap frame."""
    raise NotImplementedError("Phase 1.2: apply cleaning rules and log removals")
