// Every test starts from an empty, fully migrated local D1.
import { applyD1Migrations, env, reset } from 'cloudflare:test';
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
