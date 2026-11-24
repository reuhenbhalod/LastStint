// A fixed clock for the browser flows (docs/test-suite-spec.md D5: apps/web/e2e/flows run
// against `wrangler dev` with a fresh local D1 and fixed dates). Off unless the Worker's
// FLOWS_TEST var is exactly "true", which only the flows' local stack sets
// (apps/web/e2e/flows/stack.mjs); production and staging never set it, so nothing here runs.
//
// When on, "now" for a request is the `x-flows-now` request header (an ISO time or epoch ms),
// else the FLOWS_NOW var, and it runs on from there in real time. The Worker reads the time in
// many places (Date.now(), new Date()), so the clock is swapped globally rather than threaded
// through every call: Date.now() and an argument-less new Date() both read it. It is set per
// request; concurrent requests with different times would see each other's (the flows run one
// test at a time).

import type { Env } from './index.js';

const RealDate = Date;
const realNow = RealDate.now.bind(RealDate);

/** The fixed time and the real time it was set at (the clock runs on from there). */
let fixed: { at: number; setAt: number } | null = null;
let installed = false;

function clockNow(): number {
  return fixed ? fixed.at + (realNow() - fixed.setAt) : realNow();
}

class FlowsDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(clockNow());
    else super(...(args as [string | number | Date]));
  }
  static override now(): number {
    return clockNow();
  }
}

/** The flows' clock is on for this Worker (FLOWS_TEST "true": the local flows stack only). */
export function flowsTestOn(env: Pick<Env, 'FLOWS_TEST'>): boolean {
  return env.FLOWS_TEST === 'true';
}

function parseTime(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = /^\d+$/.test(s) ? Number(s) : RealDate.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** Point the clock at this request's time (FLOWS_TEST only; otherwise does nothing). */
export function setFlowsClock(request: Request, env: Pick<Env, 'FLOWS_TEST' | 'FLOWS_NOW'>) {
  if (!flowsTestOn(env)) return;
  const at = parseTime(request.headers.get('x-flows-now')) ?? parseTime(env.FLOWS_NOW);
  if (at === null) return;
  if (!installed) {
    (globalThis as { Date: DateConstructor }).Date = FlowsDate as unknown as DateConstructor;
    installed = true;
  }
  fixed = { at, setAt: realNow() };
}

/** Back to the real clock (tests of this module). */
export function resetFlowsClock(): void {
  fixed = null;
  if (installed) {
    (globalThis as { Date: DateConstructor }).Date = RealDate;
    installed = false;
  }
}
