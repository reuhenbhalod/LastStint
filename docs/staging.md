# Staging

Staging is a second copy of the API for testing Eras mode before it reaches players
(eras build plan step 0.2, eras spec §5 and §16).

| | Production | Staging |
|---|---|---|
| Worker | `pitwall` | `pitwall-staging` |
| URL | https://pitwall.boxboxbox.workers.dev | https://pitwall-staging.boxboxbox.workers.dev |
| D1 | `pitwall-db` | `pitwall-staging-db` (`6841f86e-2b24-416b-ae9e-ba3d3793a573`) |
| `ERAS_TEST_MODE` | `"false"` | `"true"`: every era and race open, Draft races shown |
| Daily queue-check cron | on (09:00 UTC) | off |
| Run rate limit (`RUNS_LIMITER`) | 10 per minute per IP | none |

Both are configured in `apps/worker/wrangler.jsonc`; staging is its `env.staging` block.
Staging's D1 starts empty: no dailies are scheduled there, and its players, runs and tickets
are separate from production's.

## Deploying

Pushing to the `eras` branch runs `.github/workflows/staging.yml`: typecheck and tests, then
staging migrations and a staging deploy. To do it by hand, from the repo root:

```sh
pnpm --filter @laststint/worker migrate:staging   # wrangler d1 migrations apply pitwall-staging-db --remote --env staging
pnpm --filter @laststint/worker deploy:staging    # wrangler deploy --env staging
```

Always pass `--env staging`. Without it, wrangler targets production.

## Migrations

New migrations in `apps/worker/migrations` are applied to staging by the workflow (or the
command above). **Production migrations are applied by the owner**, with the production
deploy that ships them, never from staging work.

## Website

There is no staging website yet. A local web build can use staging, since the API always
allows `http://localhost:5173`:

```sh
VITE_API_BASE=https://pitwall-staging.boxboxbox.workers.dev pnpm --filter @laststint/web dev
```

If a staging web Worker is ever deployed, it would be `pitwall-web-staging`
(https://pitwall-web-staging.boxboxbox.workers.dev), which staging's `WEB_ORIGIN` already
allows. Sign-in from it would also need that origin added to the Auth0 application's
allowed origins and callback URLs.

## Secrets

Staging needs none to run. `ALERT_WEBHOOK` (queue alerts) is optional and unused while the
cron is off.
