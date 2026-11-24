// The flows' local stack settings (docs/test-suite-spec.md S4, D5), made once per
// `playwright test` run and handed to the web servers and test workers through process.env
// (Playwright loads the config in every worker; the first load sets them, later loads reuse
// them): a fresh D1 directory, two free ports, the fixed date, and a sign-in key pair that the
// local Worker trusts in place of Google's (GOOGLE_JWKS, the Worker's test path).

import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The fixed "now" every flow starts from: midday UTC, so the day is the same everywhere
 * from UTC-11 to UTC+11. Days are scheduled from this date. */
export const FIXED_NOW = '2026-06-01T12:00:00.000Z';
export const FIXED_DATE = FIXED_NOW.slice(0, 10);
/** Days scheduled from FIXED_DATE (the daily, the next day's streak, the admin's edit). */
export const SCHEDULED_DAYS = 7;
/** The Google client ID the local Worker and the flows' web build share. */
export const CLIENT_ID = 'flows-client.apps.googleusercontent.com';
export const ADMIN_EMAIL = 'admin@flows.test';
/** The Eras player: seeded with 20 Era 10 stars (stack.mjs), one short of Era 9. */
export const ERAS_PLAYER = '4e7a5000-0000-4000-8000-000000000001';
/** The Gauntlet's pool: Spain 2020 only (the real calls win it; stack.mjs). */
export const SURVIVOR_POOL = { 'spain-2020': [85579] };

export interface FlowsEnv {
  FLOWS_DIR: string;
  FLOWS_API_PORT: string;
  FLOWS_WEB_PORT: string;
  FLOWS_PUBLIC_JWKS: string;
  FLOWS_PRIVATE_JWK: string;
}

function freePorts(n: number): number[] {
  const script = `const net=require('net');const out=[];const ss=[];let left=${n};
for(let i=0;i<${n};i++){const s=net.createServer();ss.push(s);s.listen(0,'127.0.0.1',()=>{out.push(s.address().port);if(--left===0){console.log(out.join(','));ss.forEach(x=>x.close());}});}`;
  const res = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`no free ports: ${res.stderr}`);
  return res.stdout.trim().split(',').map(Number);
}

/** The run's settings: made on the first call (and put in process.env), then reused. */
export function flowsEnv(): FlowsEnv {
  if (!process.env.FLOWS_DIR) {
    const [api, web] = freePorts(2) as [number, number];
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pub = {
      ...publicKey.export({ format: 'jwk' }),
      kid: 'flows-key',
      alg: 'RS256',
      use: 'sig',
    };
    const priv = { ...privateKey.export({ format: 'jwk' }), kid: 'flows-key', alg: 'RS256' };
    // Made (and removed at the end) by stack.mjs, so a config load that starts no stack leaves
    // nothing behind.
    process.env.FLOWS_DIR = join(tmpdir(), `laststint-flows-${randomBytes(6).toString('hex')}`);
    process.env.FLOWS_API_PORT = String(process.env.FLOWS_API_PORT ?? api);
    process.env.FLOWS_WEB_PORT = String(process.env.FLOWS_WEB_PORT ?? web);
    process.env.FLOWS_PUBLIC_JWKS = JSON.stringify({ keys: [pub] });
    process.env.FLOWS_PRIVATE_JWK = JSON.stringify(priv);
  }
  return {
    FLOWS_DIR: process.env.FLOWS_DIR as string,
    FLOWS_API_PORT: process.env.FLOWS_API_PORT as string,
    FLOWS_WEB_PORT: process.env.FLOWS_WEB_PORT as string,
    FLOWS_PUBLIC_JWKS: process.env.FLOWS_PUBLIC_JWKS as string,
    FLOWS_PRIVATE_JWK: process.env.FLOWS_PRIVATE_JWK as string,
  };
}
