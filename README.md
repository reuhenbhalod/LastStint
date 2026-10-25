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

Phase 0 (foundation / scaffolding). See `docs/F1 Pit Wall Implementation Plan.md`.

> Not affiliated with Formula 1. No F1 wordmark, team logos or liveries are used.
