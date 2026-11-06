from pipeline import incidents


def test_a_safety_car_is_put_down_to_the_car_that_retired_as_it_came_out():
    model = {
        "events": [
            {"lap": 36, "type": "RETIREMENT", "driver": "GIO"},
            {"lap": 36, "type": "VSC", "laps": 3},
            {"lap": 53, "type": "SC", "laps": 5},
            {"lap": 54, "type": "RETIREMENT", "driver": "LAT"},
            {"lap": 20, "type": "VSC", "laps": 1},
        ]
    }
    status = {"GIO": "Gearbox", "LAT": "Accident"}
    msgs = [(53, "CAR 6 (LAT) STOPPED AT TURN 14"), (20, "DEBRIS AT TURN 3")]
    assert incidents.causes(model, status, msgs) == [
        {"lap": 36, "type": "VSC", "driver": "GIO", "status": "Gearbox"},
        {"lap": 53, "type": "SC", "driver": "LAT", "status": "Accident", "turn": 14},
        {"lap": 20, "type": "VSC", "status": "Debris"},
    ]


def test_with_no_car_out_race_control_says_why():
    model = {"events": [{"lap": 43, "type": "VSC", "laps": 1}, {"lap": 50, "type": "VSC"}]}
    msgs = [
        (42, "TURN 2 INCIDENT INVOLVING CARS 8 (GRO) AND 5 (VET) NOTED"),
        (50, "YELLOW IN TRACK SECTOR 2"),
    ]
    assert incidents.causes(model, {}, msgs) == [
        {"lap": 43, "type": "VSC", "status": "Debris", "cars": ["GRO", "VET"], "turn": 2},
        {"lap": 50, "type": "VSC", "status": "Hazard", "sector": 2},
    ]


def test_each_retirement_has_its_reason_and_where_race_control_said():
    model = {
        "events": [
            {"lap": 26, "type": "RETIREMENT", "driver": "RAI"},
            {"lap": 36, "type": "RETIREMENT", "driver": "GIO"},
        ]
    }
    msgs = [(26, "CAR 7 (RAI) STOPPED AT TURN 6")]
    assert incidents.retirements(model, {"RAI": "Brakes", "GIO": "Gearbox"}, msgs) == {
        "RAI": {"lap": 26, "status": "Brakes", "turn": 6},
        "GIO": {"lap": 36, "status": "Gearbox"},
    }
