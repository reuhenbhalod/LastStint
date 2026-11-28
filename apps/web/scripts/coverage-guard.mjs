// The CI guard for control coverage (docs/test-suite-spec.md D1, S6). It reads the records the
// browser tests wrote with E2E_COVERAGE=1 (e2e/coverage.ts) and fails when a control on a
// release route came on screen but no test pressed it, unless e2e/coverage-exceptions.json
// names it with a reason. A new button that ships without a test therefore fails CI.
//
//   E2E_COVERAGE=1 pnpm --filter @laststint/web e2e && pnpm --filter @laststint/web coverage:guard
//
// Names match without case, as getByRole's do. An exception's `name` is a regular expression
// matched against the whole recorded name (numbers in names are recorded as '#'); `route` and
// `role` are exact when given. Exceptions no control matched are listed, so the file stays tidy.
//
// Two kinds of exception:
// - a plain one (a `reason`) excuses the controls it matches: an external link, a label a control
//   only wears after it's pressed, a route out of the release;
// - a `group` names one control whose name changes with the race or state (a car's details dot,
//   a plan card while its chance is worked out, the race engineer's brand). Its members count as
//   pressed when a test presses any one of them, on the same route, or on any route when the
//   group has no `route`. A group nobody pressed still fails, so it keeps its teeth.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const dir = join(here, '../test-results/control-coverage');
const exceptionsFile = join(here, '../e2e/coverage-exceptions.json');

// Versus is out of the first release (PR #54, D2): its routes aren't guarded.
const OUT_OF_RELEASE = [/^\/versus(\/|$)/, /^\/admin\/versus$/];

if (!existsSync(dir)) {
  console.error(`coverage:guard: no records in ${dir}. Run the browser tests with E2E_COVERAGE=1.`);
  process.exit(1);
}
const events = readdirSync(dir)
  .filter((f) => f.endsWith('.jsonl'))
  .flatMap((f) =>
    readFileSync(join(dir, f), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l)),
  );
if (!events.length) {
  console.error('coverage:guard: the records are empty.');
  process.exit(1);
}

/** route|role|folded name -> { route, role, name, used } */
const controls = new Map();
for (const e of events) {
  if (OUT_OF_RELEASE.some((r) => r.test(e.route))) continue;
  const key = `${e.route}|${e.role}|${e.name.toLowerCase()}`;
  const c = controls.get(key) ?? { route: e.route, role: e.role, name: e.name, used: false };
  if (e.kind === 'used') c.used = true;
  controls.set(key, c);
}

const exceptions = JSON.parse(readFileSync(exceptionsFile, 'utf8')).exceptions.map((x) => ({
  ...x,
  re: new RegExp(`^(?:${x.name})$`, 'i'),
  hits: 0,
}));
// The race screen (RaceScreen.tsx and its cards, towers, radio and plan) is one component on all
// of these routes: a race control pressed on one of them is pressed on all.
const RACE_ROUTES = ['/', '/gauntlet', '/tutorial', '/eras/:n/:race', '/eras/:n/:race/legend'];
const raceKey = (c) => `${c.role}|${c.name.toLowerCase()}`;
const pressedInRace = new Set(
  [...controls.values()].filter((c) => c.used && RACE_ROUTES.includes(c.route)).map(raceKey),
);
for (const c of controls.values())
  if (!c.used && RACE_ROUTES.includes(c.route) && pressedInRace.has(raceKey(c))) c.viaRace = true;

const matches = (x, c) =>
  (!x.route || x.route === c.route) && (!x.role || x.role === c.role) && x.re.test(c.name);
const all = [...controls.values()];
// A group is pressed when any member is, on its route (or anywhere if it names none).
for (const x of exceptions) if (x.group) x.pressed = all.some((c) => c.used && matches(x, c));
const excused = (c) => {
  const x = exceptions.find((x) => matches(x, c) && (!x.group || x.pressed));
  if (x) x.hits++;
  return x;
};

const pressed = all.filter((c) => c.used).length;
const viaRace = all.filter((c) => c.viaRace).length;
const missing = all.filter((c) => !c.used && !c.viaRace && !excused(c));
const unnamed = all.filter((c) => !c.name);

console.log(
  `coverage:guard: ${pressed} of ${all.length} controls on release routes pressed; ` +
    `${viaRace} pressed on another route of the race screen; ` +
    `${all.length - pressed - viaRace - missing.length} excused; ${missing.length} not covered.`,
);
for (const x of exceptions.filter((x) => !x.hits))
  console.log(`  (unused exception: ${x.route ?? '*'} ${x.role ?? '*'} /${x.name}/)`);

let failed = false;
if (unnamed.length) {
  failed = true;
  console.error('\nControls with no accessible name (D7):');
  for (const c of unnamed) console.error(`  ${c.route}  ${c.role}`);
}
if (missing.length) {
  failed = true;
  console.error(
    '\nControls no test presses. Press each in a spec (e2e/screens/), or, if it truly cannot be\n' +
      'pressed, add it to e2e/coverage-exceptions.json with a reason:',
  );
  for (const c of missing.sort((a, b) =>
    `${a.route}${a.name}`.localeCompare(`${b.route}${b.name}`),
  ))
    console.error(`  ${c.route}  ${c.role}: ${c.name}`);
}
process.exit(failed ? 1 : 0);
