"""VSC stop cost in the green frame (Abu Dhabi readiness review).

The current VSC loss is the gap change to nearby non-stoppers from the end of the lap before
the in-lap to the end of the out-lap. When the out-lap is still under the VSC, every time gap
is stretched by the slower VSC speed and shrinks back once racing resumes, but the sim keeps
the stretched gap. This measures the same gap change to the end of the first fully green lap
after the VSC instead.

    uv run python experiments/vsc_frame.py
"""

from __future__ import annotations

import pandas as pd

from pipeline import build as build_mod
from pipeline import ingest
from pipeline.track import VSC_REF_CLEAR_LAPS, VSC_REF_WINDOW, pit_stops, stop_records


def first_green_lap(laps: pd.DataFrame, after: int) -> int | None:
    status = laps.groupby("LapNumber")["TrackStatus"].agg(lambda s: (s.astype(str) == "1").mean())
    for lap in sorted(status.index):
        if lap > after and status[lap] >= 0.9:
            return int(lap)
    return None


def main() -> None:
    rows = []
    for rid in build_mod.RACES:
        try:
            laps = pd.read_parquet(ingest.RAW_DIR / f"{rid}.parquet")
        except FileNotFoundError:
            continue
        recs = [r for r in stop_records(laps) if r["flag"] == "VSC"]
        if not recs:
            continue
        end_time = {
            (str(d), int(n)): float(t)
            for d, n, t in zip(laps["Driver"], laps["LapNumber"], laps["Time"], strict=True)
            if not pd.isna(t) and not pd.isna(n)
        }
        stop_laps: dict[str, set[int]] = {}
        for d, i, o in pit_stops(laps):
            stop_laps.setdefault(d, set()).update({int(i["LapNumber"]), int(o["LapNumber"])})
        for r in recs:
            out_lap = r["out_lap"]
            in_lap = out_lap - 1
            g = first_green_lap(laps, out_lap)
            if g is None or g - out_lap > 4:
                continue
            a0, a1 = end_time.get((r["driver"], in_lap - 1)), end_time.get((r["driver"], g))
            if a0 is None or a1 is None:
                continue
            window = range(in_lap - VSC_REF_CLEAR_LAPS, g + 1)
            ch = []
            for other in {d for d, _ in end_time}:
                if other == r["driver"] or any(x in stop_laps.get(other, set()) for x in window):
                    continue
                b0, b1 = end_time.get((other, in_lap - 1)), end_time.get((other, g))
                if b0 is None or b1 is None or abs(a0 - b0) > VSC_REF_WINDOW:
                    continue
                ch.append((a1 - b1) - (a0 - b0))
            if ch:
                green = float(pd.Series(ch).median())
                rows.append((rid, r["driver"], out_lap, g, round(r["loss"], 2), round(green, 2)))
    df = pd.DataFrame(rows, columns=["race", "drv", "out", "green_lap", "now", "green_frame"])
    df["diff"] = df["green_frame"] - df["now"]
    print(df.to_string(index=False))
    print(f"\nmedian now {df['now'].median():.2f}  green-frame {df['green_frame'].median():.2f}")


if __name__ == "__main__":
    main()
