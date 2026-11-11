# LastStint

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

- **Race model (Phase 1):** 32 races from 2018–2025, built from FastF1 timing. Model v3 (`docs/model-v3-spec.md`) adds each driver's pace after the takeover and fixes three data and mechanics bugs.
  - Gate G1 passes on 13 races (Abu Dhabi 21, Bahrain 21, Mexico 21, Miami 22, Canada 22, Bahrain 22, Hungary 19, Mexico 19, France 19, Spain 20, Portugal 20, Italy 24, Hungary 25), with France 21 and Hungary 22 borderline. Cars that really finished within 1.0 s count as tied for the order checks. Hungary 2019 is held back from daily content: its famous two-stop chase fails in the sim (long-stint tyre fade, see `docs/model-v3-spec.md`, What-if check).
  - Mean gap error on held-out races fell from 5.6 s to 2.3 s. Given perfect pace, the sim reproduces 11 of 15 held-out races; the model passes 5. The remaining misses are mostly pace that varies within a driver's race.
  - Miami 2025 is excluded: its tyre timing is corrupt upstream.
- **Simulator (Phase 2):** `packages/sim`, documented in `docs/sim-api.md`.
  - Matches the Python reference sim.
  - Player calls, headset modes, team orders, the reactive rival and the two-compound rule.
  - Grader without hindsight, decision moments, scoring.
  - Web Worker grading: 42 ms on 2 workers for the plan's budget case.
- **Next:** the game UI (Phase 3, @Reuhen) on top of `@laststint/sim` 0.1.0.

> Not affiliated with Formula 1. No F1 wordmark, team logos or liveries are used.
