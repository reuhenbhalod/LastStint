"""Regenerate tum_sample.sqlite, the test fixture cut from the TUM f1-timing-database
(CC BY-NC-SA 3.0, https://github.com/TUMFTM/f1-timing-database, commit 9eaad9c; credit:
Institute of Automotive Technology, Technical University of Munich).

Same schema as the full database, holding:
- Abu Dhabi 2018 (race 100), whole: three nominated compounds, an SC and a VSC, lap-1 and
  later retirements. tests compare it with the committed FastF1 snapshot.
- Monaco 2015 (race 25), three drivers: two nominated compounds, a VSC straight into an SC.
- Silverstone 2014 (race 9), three drivers: a red flag only the race comment records.

    uv run python tests/fixtures/make_tum_fixture.py <path to F1_timingdata_2014_2019.sqlite>
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

OUT = Path(__file__).parent / "tum_sample.sqlite"
WHOLE = (100,)
PARTIAL = {25: ("HAM", "ROS", "VET"), 9: ("HAM", "ROS", "ALO")}
TABLES = ("drivers", "races", "starterfields", "laps", "fcyphases")


def main(src: str) -> None:
    OUT.unlink(missing_ok=True)
    con = sqlite3.connect(f"file:{OUT}", uri=True)  # uri: so ATTACH can open src read-only
    con.execute(f"ATTACH DATABASE 'file:{src}?mode=ro' AS src")
    for table in TABLES:
        (ddl,) = con.execute(
            "SELECT sql FROM src.sqlite_master WHERE type = 'table' AND name = ?", (table,)
        ).fetchone()
        con.execute(ddl)
    races = (*WHOLE, *PARTIAL)
    marks = ",".join("?" * len(races))
    con.execute(f"INSERT INTO races SELECT * FROM src.races WHERE id IN ({marks})", races)
    con.execute(
        f"INSERT INTO fcyphases SELECT * FROM src.fcyphases WHERE race_id IN ({marks})", races
    )
    keep = "(race_id IN ({}) OR {})".format(
        ",".join(map(str, WHOLE)),
        " OR ".join(
            f"(race_id = {r} AND driver_id IN (SELECT id FROM src.drivers WHERE initials IN"
            f" ({','.join(repr(i) for i in initials)})))"
            for r, initials in PARTIAL.items()
        ),
    )
    for table in ("starterfields", "laps"):
        con.execute(f"INSERT INTO {table} SELECT * FROM src.{table} WHERE {keep}")
    con.execute(
        "INSERT INTO drivers SELECT * FROM src.drivers"
        " WHERE id IN (SELECT driver_id FROM starterfields)"
    )
    con.commit()
    con.execute("DETACH DATABASE src")
    con.execute("VACUUM")
    con.close()
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1])
