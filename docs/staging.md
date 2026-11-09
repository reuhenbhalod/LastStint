# Staging

Staging is a second copy of the API and website for testing Eras mode before it reaches
players (eras build plan step 0.2, eras spec §5 and §16).

| | Production | Staging |
|---|---|---|
| API Worker | `pitwall` | `pitwall-staging` |
| API URL | https://pitwall.boxboxbox.workers.dev | https://pitwall-staging.boxboxbox.workers.dev |
| Web Worker | `pitwall-web` | `pitwall-web-staging` |
| Website | https://pitwall-web.boxboxbox.workers.dev | https://pitwall-web-staging.boxboxbox.workers.dev |
| D1 | `pitwall-db` | `pitwall-staging-db` (`6841f86e-2b24-416b-ae9e-ba3d3793a573`) |
| `ERAS_TEST_MODE` | `"false"` | `"true"`: every era and race open, Draft races shown |
| Daily queue-check cron | on (09:00 UTC) | off |
| Run rate limit (`RUNS_LIMITER`) | 10 per minute per IP | none |

The API is configured in `apps/worker/wrangler.jsonc` and the website in
`apps/web/wrangler.jsonc`; staging is the `env.staging` block of each.
Staging's D1 starts empty: no dailies are scheduled there, and its players, runs and tickets
are separate from production's.

## Deploying

Pushing to the `eras` branch runs `.github/workflows/staging.yml`: typecheck and tests, then
staging migrations, the staging API deploy, and the staging website build and deploy (in that
order, so the site never calls an older API). To do it by hand, from the repo root:

```sh
pnpm --filter @laststint/worker migrate:staging   # wrangler d1 migrations apply pitwall-staging-db --remote --env staging
pnpm --filter @laststint/worker deploy:staging    # wrangler deploy --env staging (pitwall-staging)
pnpm --filter @laststint/web deploy:staging       # build:staging, then wrangler deploy --env staging (pitwall-web-staging)
```

Always pass `--env staging`. Without it, wrangler targets production. To check which staging
migrations are still to apply:

```sh
cd apps/worker && npx wrangler d1 migrations list pitwall-staging-db --remote --env staging
```

## Migrations

New migrations in `apps/worker/migrations` are applied to staging by the workflow (or the
command above). **Production migrations are applied by the owner**, with the production
deploy that ships them, never from staging work.

## Dailies

Staging has no dailies until some are scheduled. The schedule script takes `--staging` to
write staging's D1 (pitwall-staging-db) instead of production's; `--remote` is still
production:

```sh
pnpm --filter @laststint/worker schedule --staging --days 7 --dry-run   # print the plan
pnpm --filter @laststint/worker schedule --staging --days 7
```

`--allow-ineligible` works with `--local` and `--staging` (never with `--remote`).

## Website

https://pitwall-web-staging.boxboxbox.workers.dev is the same site as production, built
(`apps/web` `build:staging`) with `VITE_API_BASE=https://pitwall-staging.boxboxbox.workers.dev`
and production's Google and Auth0 client values, and served by the `pitwall-web-staging`
Worker. Staging's `WEB_ORIGIN` allows it. With `ERAS_TEST_MODE` on, its era map shows every
era open.

A local web build can also use staging, since the API always allows `http://localhost:5173`:

```sh
VITE_API_BASE=https://pitwall-staging.boxboxbox.workers.dev pnpm --filter @laststint/web dev
```

### Sign-in on staging: owner steps

Playing signed out works as is. Signing in from the staging website needs its origin added
to the sign-in providers, which only the owner can do:

1. **Auth0** (dashboard, tenant `dev-umxcdh2y62l4e0gy.us.auth0.com`): Applications, then the
   application with client ID `Pdlxz3iAqJse61VUhOGpF8wSeFgV7yxM`, then Settings. Add
   `https://pitwall-web-staging.boxboxbox.workers.dev` (comma-separated, keeping the existing
   entries) to each of:
   - Allowed Callback URLs
   - Allowed Logout URLs
   - Allowed Web Origins
   - Allowed Origins (CORS)

   Then Save Changes.
2. **Google** (Google Cloud console, APIs and Services, Credentials): open the OAuth 2.0
   client `318278030629-s860fnjjpk6ihcn4iubjqiakf8vu0pqi.apps.googleusercontent.com` and add
   `https://pitwall-web-staging.boxboxbox.workers.dev` under Authorized JavaScript origins.
   Save. Changes can take a few minutes to apply.

Until then, sign-in from the staging website fails with an origin or callback error.

## Secrets

Staging needs none to run. `ALERT_WEBHOOK` (queue alerts) is optional and unused while the
cron is off.
