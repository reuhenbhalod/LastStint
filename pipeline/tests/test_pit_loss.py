"""Pit-loss sanity over every committed race file (docs/pit-loss-spec.md P4).

A new or rebuilt race can't ship a stop that is impossibly cheap or a VSC stop that costs more
than a green one.
"""

from __future__ import annotations

import json

import pytest

from pipeline import track
from pipeline.paths import RACES_DIR

RACES = sorted(RACES_DIR.glob("*.json"))
# Green loss this far from the circuit's reference is a measurement problem, not the track.
REFERENCE_TOLERANCE = 3.0


@pytest.mark.parametrize("path", RACES, ids=lambda p: p.stem)
def test_pit_loss_is_plausible(path):
    t = json.loads(path.read_text())["track"]
    green, vsc = t["pitLoss"], t["pitLossUnderVSC"]
    lo, hi = track.VSC_SHARE_RANGE
    assert lo <= vsc / green <= hi, f"VSC loss {vsc}s is {vsc / green:.0%} of green {green}s"
    assert all(d >= track.MIN_STOP_DEVIATION for d in t.get("pitLossDeviations") or [])
    reference = track.reference_pit_loss(path.stem)
    if reference is not None:
        assert abs(green - reference) <= REFERENCE_TOLERANCE, f"{green}s vs reference {reference}s"


def test_circuit_of():
    assert track.circuit_of("canada-2024") == "canada"
    assert track.circuit_of("70th-anniversary-2020") == "great-britain"
    assert track.circuit_of("styria-2021") == "austria"
