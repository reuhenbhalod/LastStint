"""Seeded PRNG shared with the TypeScript simulator (Implementation Plan 2.2).

Bit-exact port of packages/sim/src/rng.ts: mulberry32 and deriveSeed, so the Python
reference sim and the TS sim draw identical random streams for parity tests. `normal`
uses Box-Muller exactly as the TS side does. All arithmetic is on unsigned 32-bit ints,
mirroring JavaScript's `>>> 0`, `| 0` and `Math.imul`.
"""

from __future__ import annotations

import math

_MASK = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """Math.imul: low 32 bits of the product, as unsigned."""
    return (a * b) & _MASK


class Mulberry32:
    """mulberry32: a 32-bit seeded generator (matches rng.ts)."""

    def __init__(self, seed: int) -> None:
        self._a = seed & _MASK

    def next(self) -> float:
        """Next float in [0, 1)."""
        self._a = (self._a + 0x6D2B79F5) & _MASK
        a = self._a
        t = _imul(a ^ (a >> 15), 1 | a)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & _MASK) ^ t
        return ((t ^ (t >> 14)) & _MASK) / 4294967296

    def normal(self, sd: float = 1.0) -> float:
        """Normal(0, sd) by Box-Muller; consumes two draws (matches rng.ts `normal`)."""
        u1 = 1.0 - self.next()  # (0, 1]: log is finite
        u2 = self.next()
        return sd * math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def derive_seed(daily_seed: int, stream: int) -> int:
    """Per-stream seed from the daily seed and a stream index (matches rng.ts deriveSeed)."""
    h = (daily_seed ^ 0x9E3779B9) & _MASK
    h = _imul(h ^ stream, 0x85EBCA6B)
    h = _imul(h ^ (h >> 13), 0xC2B2AE35)
    return (h ^ (h >> 16)) & _MASK
