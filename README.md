# BoxThisLap

A free daily F1 strategy game. Everyone gets the same real race situation each day; you
make the pit-wall calls and a simulator grades them against the best possible call and
against what the real team did.

See [`docs/`](./docs) for the product doc and implementation plan.

## Monorepo layout

```
pipeline/          Python: FastF1 timing -> race-model JSON (offline, never on a server)
packages/
  schema/          race-model.schema.json — single source of truth for the race model
  sim/             TypeScript simulator (runs in the browser AND the Worker)
apps/
  web/             Vite + React + Tailwind game
  worker/          Cloudflare Worker (Hono) + D1 — leaderboard & score verification
data/
  races/           generated race JSON, one per race
  golden/          Python sim outputs for TS<->Python parity tests
docs/              product doc + implementation plan
```

## Toolchains

| Area   | Tool  | Install |
|--------|-------|---------|
| Python | uv    | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node   | pnpm  | `npm install -g pnpm` |

## Quick start

```bash
# JS/TS workspace
pnpm install
pnpm test        # vitest across packages
pnpm typecheck   # tsc --noEmit across packages
pnpm lint        # biome

# Python pipeline
cd pipeline
uv sync
uv run pytest
```

## Status

**Phases 1 and 2 are closed** (Oct 26, 2026) with documented limits. Details are in `docs/phase-1-2-perfection-spec.md` and `docs/g1-report.md`.

- **Race model (Phase 1):** 32 races from 2018–2025, built from FastF1 timing.
  - Gate G1 passes on 6 races (Abu Dhabi 21, Canada 22, Bahrain 22, Miami 22, Hungary 19, Spain 20), with Mexico 21 borderline. These are the validated pool for daily content.
  - Known limit: the model doesn't capture driver- or stint-specific pace. That is the dominant error in most failing races (see the report's diagnoses). A model v3 would target it.
- **Simulator (Phase 2):** `packages/sim`, documented in `docs/sim-api.md`.
  - Matches the Python reference sim.
  - Player calls, headset modes, team orders, the reactive rival and the two-compound rule.
  - Grader without hindsight, decision moments, scoring.
  - Web Worker grading: 42 ms on 2 workers for the plan's budget case.
- **Next:** the game UI (Phase 3, @Reuhen) on top of `@boxthislap/sim` 0.1.0.

> Not affiliated with Formula 1. No F1 wordmark, team logos or liveries are used.
