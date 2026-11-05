"""OpenF1 -> the FastF1 snapshot's shape (openf1.py), on a small hand-made session."""

from pipeline import openf1
from pipeline.ingest import LAP_COLUMNS

T = "2024-07-07T14:00:{:02d}+00:00"


def stamp(s: float) -> str:
    """Session second `s` (under an hour) as an OpenF1 date."""
    m, sec = divmod(s, 60)
    return f"2024-07-07T14:{int(m):02d}:{sec:06.3f}+00:00"


def session() -> dict:
    lap = lambda n, start, dur, out=False: {  # noqa: E731
        "driver_number": 44,
        "lap_number": n,
        "date_start": stamp(start) if start is not None else None,
        "lap_duration": dur,
        "is_pit_out_lap": out,
    }
    return {
        "sessions": [
            {"date_start": stamp(0), "country_name": "United Kingdom", "location": "Silverstone"}
        ],
        "drivers": [{"driver_number": 44, "name_acronym": "HAM", "team_name": "Mercedes"}],
        "laps": [
            lap(1, None, None),
            lap(2, 100, 90.0),
            lap(3, 190, 95.0, out=True),
            lap(4, 285, 91.0),
        ],
        "stints": [
            {
                "driver_number": 44,
                "stint_number": 1,
                "lap_start": 1,
                "lap_end": 2,
                "compound": "MEDIUM",
                "tyre_age_at_start": 0,
            },
            {
                "driver_number": 44,
                "stint_number": 2,
                "lap_start": 3,
                "lap_end": 4,
                "compound": "INTERMEDIATE",
                "tyre_age_at_start": 0,
            },
        ],
        "pit": [{"driver_number": 44, "lap_number": 2, "date": stamp(185), "lane_duration": 22.0}],
        "position": [
            {"driver_number": 44, "date": stamp(5), "position": 3},
            {"driver_number": 44, "date": stamp(200), "position": 2},
        ],
        "race_control": [
            {
                "date": stamp(150),
                "category": "Flag",
                "flag": "YELLOW",
                "scope": "Sector",
                "sector": 7,
                "message": "YELLOW IN TRACK SECTOR 7",
            },
            {
                "date": stamp(160),
                "category": "Flag",
                "flag": "CLEAR",
                "scope": "Sector",
                "sector": 7,
                "message": "CLEAR IN TRACK SECTOR 7",
            },
            {
                "date": stamp(290),
                "category": "SafetyCar",
                "flag": None,
                "scope": None,
                "message": "SAFETY CAR DEPLOYED",
            },
        ],
        "weather": [
            {"date": stamp(60), "rainfall": 0, "track_temperature": 30.0, "air_temperature": 20.0},
            {"date": stamp(240), "rainfall": 1, "track_temperature": 25.0, "air_temperature": 18.0},
        ],
    }


def test_laps_have_the_snapshot_columns_and_values():
    df = openf1.laps_frame(session())
    assert list(df.columns) == LAP_COLUMNS
    by = df.set_index("LapNumber")
    # A lap ends when the next one starts; the last lap at its start + duration.
    assert by.loc[2, "Time"] == 190.0 and by.loc[4, "Time"] == 376.0
    assert by.loc[2, "Compound"] == "MEDIUM" and by.loc[3, "Compound"] == "INTERMEDIATE"
    assert by.loc[3, "TyreLife"] == 1.0 and by.loc[4, "Stint"] == 2.0
    # The pit stop: in at the end of lap 2, out on lap 3 (entry + lane time).
    assert by.loc[2, "PitInTime"] == 185.0 and by.loc[3, "PitOutTime"] == 207.0
    assert not by.loc[2, "IsAccurate"] and not by.loc[3, "IsAccurate"] and by.loc[4, "IsAccurate"]
    assert by.loc[2, "Position"] == 3.0 and by.loc[3, "Position"] == 2.0


def test_track_status_yellows_and_safety_car():
    timeline = openf1.track_status(session())
    assert [s["status"] for s in timeline] == ["2", "1", "4"]
    by = openf1.laps_frame(session()).set_index("LapNumber")
    assert by.loc[2, "TrackStatus"] == "12"  # a yellow came and went (each status once, as FastF1)
    assert by.loc[4, "TrackStatus"] == "14"


def test_weather_by_the_minute():
    assert openf1.weather(session()) == [
        {"time": 60.0, "rain": False, "track": 30.0, "air": 20.0},
        {"time": 240.0, "rain": True, "track": 25.0, "air": 18.0},
    ]
