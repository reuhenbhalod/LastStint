# BoxThisLap Tickets

A small tracker for the team's game-change tickets. It lists open and in-progress tickets grouped
by category, with a collapsible **Completed** section at the bottom. You can filter by category,
search the text, switch a ticket's status in place, and add, edit or delete tickets. Delete asks
you to confirm first, inside the app.

**There is no login.** Anyone with the URL can read and change the tickets. Sign-in can be added
later.

One Cloudflare Worker, `boxthislap-tickets`, serves both parts from the same origin:

- the React app (`src/web`, built by Vite into `dist/`), as static assets;
- the JSON API under `/api/*` (`src/worker`, Hono), backed by its own D1 database,
  `boxthislap-tickets` (`migrations/`).

| Route                     | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `GET /api/tickets`        | every ticket, newest first                          |
| `POST /api/tickets`       | create `{ title, category, description?, status?, notes?, source? }` |
| `PATCH /api/tickets/:id`  | change any of those fields                          |
| `DELETE /api/tickets/:id` | delete                                              |

`completed_at` is set when a ticket becomes `done` and cleared when it leaves `done`. Errors come
back as `{ error, detail? }` JSON.

## Local dev

```sh
pnpm install
pnpm --filter @boxthislap/tickets migrate:local   # once: create the local D1's table
pnpm --filter @boxthislap/tickets seed:local      # optional: load data/tickets.json
pnpm --filter @boxthislap/tickets dev
```

`dev` runs `wrangler dev` (the API on a local D1, port 8788) and Vite (the app, with hot reload,
port 5174, forwarding `/api` to the Worker). Open http://localhost:5174.

Checks: `pnpm --filter @boxthislap/tickets typecheck`, `test` (the API in workerd against a local
D1), `build`, and `pnpm exec biome check apps/tickets`.

## Seeding

`data/tickets.json` is an array of `{ title, description, category, status, notes, source }`.
`scripts/seed.ts` checks each entry the same way the API checks a new ticket and writes
`data/seed.sql` (generated, not committed). `seed:local` / `seed:remote` build that file and run
`wrangler d1 execute boxthislap-tickets --local|--remote --file data/seed.sql`.

Seeding inserts rows. It does not replace existing ones, so running it twice gives you duplicates.

## One-time setup (production)

From `apps/tickets`:

1. `pnpm exec wrangler d1 create boxthislap-tickets`, then paste the `database_id` it prints into
   `wrangler.jsonc` in place of `REPLACE_AFTER_D1_CREATE`.
2. `pnpm migrate:remote`
3. `pnpm seed:remote` (after replacing `data/tickets.json` with the real list)
4. `pnpm run deploy` (builds the app, then `wrangler deploy`). Use `run`: a bare `pnpm deploy`
   is pnpm's own command.

The app is then at https://boxthislap-tickets.boxboxbox.workers.dev.
