"""F1 timing data -> race-model JSON pipeline.

Keep this module import light: do not import fastf1/pandas/statsmodels here.
Heavy dependencies are imported inside the functions that need them.
"""

__version__ = "0.0.0"

SCHEMA_VERSION = 1
